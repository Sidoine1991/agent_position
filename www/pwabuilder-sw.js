// Service Worker pour PWA Builder
const CACHE_NAME = 'presence-ccrb-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/agents.html',
  '/admin.html',
  '/admin-agents.html',
  '/profile.html',
  '/reports.html',
  '/styles.css',
  '/app.js',
  '/dashboard.js',
  '/agents.js',
  '/admin.js',
  '/admin-agents.js',
  '/profile.js',
  '/reports.js',
  '/service-worker.js',
  '/Media/logo-ccrb.png',
  '/Media/default-avatar.png',
  '/Media/default-avatar.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
