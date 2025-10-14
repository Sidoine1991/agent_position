const CACHE_NAME = 'presence-ccrb-v1';
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
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
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