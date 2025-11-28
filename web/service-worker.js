const CACHE_NAME = 'presence-v3-20250930';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      // Precache only minimal, version-agnostic assets. Avoid app.js to prevent staleness.
      try {
        await cache.addAll(['/', '/index.html', '/styles.css', '/manifest.webmanifest']);
      } catch (err) {
        console.warn('SW install: cache.addAll warning', err);
      }
    } catch (err) {
      console.warn('SW install: cache open failed', err);
    } finally {
      try { await self.skipWaiting(); } catch {}
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    } catch {}
    try { await clients.claim(); } catch {}
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // Only same-origin

  // Always bypass cache for API - network only, don't intercept if server is down
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      (async () => {
        try {
          const response = await fetch(e.request.clone());
          return response;
        } catch (error) {
          console.error('Service Worker: API fetch failed:', error);
          // Don't intercept - let the error propagate to the page
          // This allows the page to handle the error properly
          throw error;
        }
      })()
    );
    return;
  }

  const dest = e.request.destination;
  const isDoc = e.request.mode === 'navigate' || dest === 'document';
  const isCode = dest === 'script' || dest === 'style';

  // Network-first for HTML, JS, CSS to ensure newest UI without hard reload
  if (isDoc || isCode) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request, { cache: 'no-store' });
        try {
          const cache = await caches.open(CACHE_NAME);
          cache.put(e.request, fresh.clone());
        } catch {}
        return fresh;
      } catch {
        const cached = await caches.match(e.request, { ignoreSearch: false });
        if (cached) return cached;
        throw new Error('offline');
      }
    })());
    return;
  }

  // Cache-first for other static assets (images, fonts)
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// IndexedDB helpers for offline queue
function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('presence-queue-db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addToQueue(item) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add({ ...item, createdAt: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllQueue() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromQueue(id) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Receive queue messages from pages
self.addEventListener('message', async (event) => {
  const data = event.data || {};
  if (data.type === 'queue-presence') {
    try {
      await addToQueue({ endpoint: data.endpoint, method: data.method || 'POST', payload: data.payload, headers: data.headers });
      if (self.registration && 'sync' in self.registration) {
        try { await self.registration.sync.register('sync-checkins'); } catch {}
      }
    } catch {}
  } else if (data.type === 'flush-queue') {
    // Traitement manuel immédiat de la file d'attente
    try {
      const items = await getAllQueue();
      for (const item of items) {
        try {
          await fetch(item.endpoint, {
            method: item.method || 'POST',
            headers: item.headers || { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload || {})
          });
          await deleteFromQueue(item.id);
        } catch {}
      }
      if (event && event.ports && event.ports[0]) {
        try { event.ports[0].postMessage({ ok: true }); } catch {}
      }
    } catch {}
  }
});

// Background Sync processor
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-checkins') {
    event.waitUntil((async () => {
      try {
        const items = await getAllQueue();
        for (const item of items) {
          try {
            await fetch(item.endpoint, {
              method: item.method || 'POST',
              headers: item.headers || { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload || {})
            });
            await deleteFromQueue(item.id);
          } catch {}
        }
      } catch {}
    })());
  }
});

// Gestion de l'événement push
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = (() => {
    try { return event.data.json(); } catch { return { title: 'Notification', body: event.data.text() }; }
  })();
  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/Media/logo-ccrb.png',
    badge: data.badge || '/Media/logo-ccrb.png',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Ouvrir la page au clic
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});


