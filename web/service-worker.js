self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('presence-v1').then((c) => c.addAll([
    '/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest'
  ])));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
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
      await addToQueue({ endpoint: data.endpoint, method: data.method || 'POST', payload: data.payload });
      if (self.registration && 'sync' in self.registration) {
        try { await self.registration.sync.register('sync-checkins'); } catch {}
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
              headers: { 'Content-Type': 'application/json' },
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


