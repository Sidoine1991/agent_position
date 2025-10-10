// Service Worker optimisé pour Presence CCRB
const CACHE_NAME = 'presence-ccrb-v1.0.0';
const STATIC_CACHE = 'presence-static-v1';
const DYNAMIC_CACHE = 'presence-dynamic-v1';

// Ressources à mettre en cache (chemins côté client, car Express sert 'web' à la racine)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/bootstrap-5.3.8-dist/css/bootstrap.min.css',
  '/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installation');
  
  event.waitUntil(
    Promise.all([
      // Cache des ressources statiques avec gestion d'erreur
      caches.open(STATIC_CACHE).then(async (cache) => {
        console.log('📦 Service Worker: Mise en cache des ressources statiques');
        for (const asset of STATIC_ASSETS) {
          try {
            await cache.add(asset);
          } catch (error) {
            console.warn('⚠️ Service Worker: Impossible de mettre en cache', asset, error && (error.message || error));
          }
        }
      }),
      // Cache des ressources dynamiques
      caches.open(DYNAMIC_CACHE).then((cache) => {
        console.log('📦 Service Worker: Cache dynamique initialisé');
        return cache;
      })
    ]).then(() => {
      console.log('✅ Service Worker: Installation terminée');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('❌ Service Worker: Erreur installation:', error);
      // Continuer même en cas d'erreur
      return self.skipWaiting();
    })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activation');
  
  event.waitUntil(
    Promise.all([
      // Nettoyer les anciens caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Service Worker: Suppression ancien cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Prendre le contrôle de tous les clients
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker: Activation terminée');
    })
  );
});

// Gestion des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Stratégie de cache pour les ressources statiques
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          console.log('📦 Service Worker: Ressource statique depuis le cache:', url.pathname);
          return response;
        }
        return fetch(request).then((response) => {
          if (response.status === 200 && request.url.startsWith('http')) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone).catch((error) => {
                console.warn('⚠️ Service Worker: Erreur mise en cache statique:', error);
              });
            });
          }
          return response;
        });
      })
    );
    return;
  }
  
  // Stratégie de cache pour les API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then((response) => {
        // Mettre en cache les réponses API réussies (éviter les schémas non supportés)
        if (response.status === 200 && request.url.startsWith('http')) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone).catch((error) => {
              console.warn('⚠️ Service Worker: Erreur mise en cache API:', error);
            });
          });
        }
        return response;
      }).catch(() => {
        // En cas d'erreur réseau, essayer le cache
        return caches.match(request).then((response) => {
          if (response) {
            console.log('📦 Service Worker: API depuis le cache:', url.pathname);
            return response;
          }
          // Retourner une réponse d'erreur hors ligne
          return new Response(
            JSON.stringify({ 
              error: 'Hors ligne', 
              message: 'Vérifiez votre connexion internet' 
            }),
            { 
              status: 503, 
              headers: { 'Content-Type': 'application/json' } 
            }
          );
        });
      })
    );
    return;
  }
  
  // Stratégie de cache pour les autres ressources
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        console.log('📦 Service Worker: Ressource depuis le cache:', url.pathname);
        return response;
      }
      
      return fetch(request).then((response) => {
        // Mettre en cache les réponses réussies (éviter les schémas non supportés)
        if (response.status === 200 && request.url.startsWith('http')) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone).catch((error) => {
              console.warn('⚠️ Service Worker: Erreur mise en cache:', error);
            });
          });
        }
        return response;
      }).catch(() => {
        // En cas d'erreur, retourner une page d'erreur hors ligne
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
        return new Response('Ressource non disponible hors ligne', { status: 503 });
      });
    })
  );
});

// Gestion des messages
self.addEventListener('message', (event) => {
  const { data } = event;
  
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

// Gestion des notifications push
self.addEventListener('push', (event) => {
  console.log('🔔 Service Worker: Notification push reçue');
  
  let notificationData = {
    title: 'Presence CCRB',
    body: 'Nouvelle notification',
    icon: '/Media/PP%20CCRB.png',
    badge: '/Media/PP%20CCRB.png',
    tag: 'presence-notification',
    data: { url: '/' }
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      actions: [
        {
          action: 'open',
          title: 'Ouvrir',
          icon: '/Media/PP%20CCRB.png'
        }
      ]
    })
  );
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Service Worker: Clic sur notification');
  
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Chercher une fenêtre existante
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Gestion de la synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Synchronisation en arrière-plan');
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Logique de synchronisation
      console.log('🔄 Service Worker: Synchronisation des données')
    );
  }
});

// Gestion des erreurs
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker: Erreur:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker: Promesse rejetée:', event.reason);
});

console.log('✅ Service Worker: Chargé et prêt');
