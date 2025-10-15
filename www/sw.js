const CACHE_NAME = 'presence-ccrb-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/profile.html',
  '/dashboard.html',
  '/admin-agents.html',
  '/reports.html',
  '/agent-activity-tracking.html',
  '/planning.html',
  '/admin.html',
  '/register.html',
  '/login.html',
  '/manifest.webmanifest',
  '/Media/logo-ccrb.png',
  '/css/style.css',
  '/js/app.js',
  '/js/navigation.js',
  '/js/auth.js',
  '/js/profile.js',
  '/js/dashboard.js',
  '/js/admin-agents.js',
  '/js/reports-backend.js',
  '/web/agent-activity-tracking.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  const isAPI = url.pathname.startsWith('/api/');

  if (!isAPI && request.method === 'GET') {
    // Cache-first for navigation and static assets
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(()=>{});
        return resp;
      }).catch(() => caches.match('/index.html')))
    );
    return;
  }

  if (isAPI && (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH')) {
    // Network-first with background queue when offline
    event.respondWith((async () => {
      try {
        const resp = await fetch(request.clone());
        return resp;
      } catch (e) {
        // Queue the request for retry
        const body = await request.clone().text().catch(()=>null);
        const queued = { url: request.url, method: request.method, headers: Array.from(request.headers.entries()), body, ts: Date.now() };
        const db = await caches.open(CACHE_NAME);
        // Store queue in a synthetic key in cache storage via put of a Response
        try {
          const key = new Request('/__queue__/requests');
          const existing = await db.match(key).then(r => r ? r.json() : []);
          existing.push(queued);
          await db.put(key, new Response(JSON.stringify(existing), { headers: { 'Content-Type': 'application/json' } }));
        } catch {}
        return new Response(JSON.stringify({ queued: true, offline: true }), { status: 202, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // Default: network falling back to cache
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

self.addEventListener('activate', event => {
    event.waitUntil(
    caches.keys().then(cacheNames => {
        return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync via periodic retry when coming online
self.addEventListener('sync', event => {
  if (event.tag === 'flush-queue') {
    event.waitUntil(flushQueue());
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'flush-queue') {
    event.waitUntil(flushQueue());
  }
});

async function flushQueue() {
  try {
    const db = await caches.open(CACHE_NAME);
    const key = new Request('/__queue__/requests');
    const list = await db.match(key).then(r => r ? r.json() : []);
    if (!Array.isArray(list) || !list.length) return;
    const remaining = [];
    for (const q of list) {
      try {
        const headers = new Headers(q.headers || []);
        await fetch(q.url, { method: q.method || 'POST', headers, body: q.body || undefined });
      } catch (e) {
        remaining.push(q);
      }
    }
    await db.put(key, new Response(JSON.stringify(remaining), { headers: { 'Content-Type': 'application/json' } }));
  } catch {}
}
