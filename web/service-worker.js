const CACHE_NAME = 'presence-v3-20251202';

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
      try { await self.skipWaiting(); } catch { }
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    } catch { }
    try { await clients.claim(); } catch { }
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET requests and cross-origin requests
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // For API requests, try to fetch from network first
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      (async () => {
        try {
          // Try to fetch from network first
          const response = await fetch(e.request);

          // If the response is not ok (status not in the range 200-299),
          // it's still a response, so we should return it
          if (!response.ok) {
            console.warn('API response not OK:', response.status, response.statusText, url.pathname);
          }

          // Cache the response for future offline use
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, responseToCache).catch(err => {
              console.warn('Failed to cache API response:', err);
            });
          });

          return response;
        } catch (error) {
          console.warn('Network request failed, trying cache for:', url.pathname, error);

          // If fetch fails (network error), try to get from cache
          try {
            const cachedResponse = await caches.match(e.request);
            if (cachedResponse) {
              console.log('Serving from cache:', url.pathname);
              return cachedResponse;
            }

            // If not in cache, rethrow the original error
            console.error('No cache available for failed request:', url.pathname, error);
            throw error;
          } catch (cacheError) {
            console.error('Cache lookup failed:', cacheError);
            throw error; // Re-throw the original error
          }
        }
      })()
    );
    return;
  }

  // For navigation requests, always try network first
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(e.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If fetch fails, try to get from cache
          return caches.match(e.request).then(response => {
            return response || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // For other static assets (JS, CSS, images, fonts), try cache first
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      // Return cached response if found
      if (cachedResponse) {
        // Update cache in the background
        fetchAndCache(e.request);
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache the response
      return fetchAndCache(e.request);
    })
  );

  // Helper function to fetch and cache a request
  function fetchAndCache(request) {
    return fetch(request).then(response => {
      // Check if we received a valid response
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }

      // Clone the response (a stream can only be consumed once)
      const responseToCache = response.clone();

      // Cache the response
      caches.open(CACHE_NAME).then(cache => {
        cache.put(request, responseToCache).catch(err => {
          console.warn('Failed to cache response:', err);
        });
      });

      return response;
    }).catch(error => {
      console.error('Fetch failed:', error);
      // If offline and the request is for an image, return a fallback
      if (request.headers.get('Accept').includes('image/')) {
        return caches.match('/images/offline.png');
      }
      // Return a 503 response instead of throwing to avoid unhandled promise rejections in the browser console
      return new Response(JSON.stringify({ error: 'Network error', message: error.message }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      });
    });
  }
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
        try { await self.registration.sync.register('sync-checkins'); } catch { }
      }
    } catch { }
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
        } catch { }
      }
      if (event && event.ports && event.ports[0]) {
        try { event.ports[0].postMessage({ ok: true }); } catch { }
      }
    } catch { }
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
          } catch { }
        }
      } catch { }
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


