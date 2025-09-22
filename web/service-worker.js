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


