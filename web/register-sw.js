// Enregistrement du Service Worker pour Presence CCRB
console.log('🔧 Enregistrement du Service Worker...');

// Vérifier si le Service Worker est supporté
if ('serviceWorker' in navigator) {
  // Enregistrer le Service Worker
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('✅ Service Worker enregistré avec succès:', registration.scope);
      
      // Vérifier les mises à jour
      registration.addEventListener('updatefound', () => {
        console.log('🔄 Service Worker: Mise à jour trouvée');
        const newWorker = registration.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('🔄 Service Worker: Nouvelle version disponible');
              // Notifier l'utilisateur d'une mise à jour disponible
              showUpdateNotification();
            } else {
              console.log('✅ Service Worker: Installation terminée');
            }
          }
        });
      });
      
      // Gérer les messages du Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { data } = event.data;
        console.log('📨 Message du Service Worker:', data);
      });
      
    })
    .catch((error) => {
      console.error('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
    });
  
  // Gérer les changements d'état du Service Worker
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 Service Worker: Contrôleur changé');
    // Éviter les rechargements automatiques qui peuvent créer des boucles
    // Afficher plutôt une notification pour proposer le rafraîchissement manuel
    try {
      showUpdateNotification();
    } catch (e) {
      console.warn('Impossible d\'afficher la notification de mise à jour:', e);
    }
  });
  
} else {
  console.warn('⚠️ Service Worker non supporté par ce navigateur');
}

// Fonction pour afficher une notification de mise à jour
function showUpdateNotification() {
  // Créer une notification personnalisée
  const notification = document.createElement('div');
  notification.className = 'alert alert-info alert-dismissible fade show position-fixed';
  notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 300px;';
  notification.innerHTML = `
    <strong>🔄 Mise à jour disponible</strong>
    <p class="mb-2">Une nouvelle version de l'application est disponible.</p>
    <button type="button" class="btn btn-sm btn-primary me-2" onclick="updateApp()">
      Mettre à jour
    </button>
    <button type="button" class="btn btn-sm btn-secondary" onclick="this.parentElement.remove()">
      Plus tard
    </button>
  `;
  
  document.body.appendChild(notification);
  
  // Supprimer automatiquement après 10 secondes
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 10000);
}

// Fonction pour mettre à jour l'application
function updateApp() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Fonction pour vérifier la version du Service Worker
function checkSWVersion() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      console.log('📦 Version du Service Worker:', event.data.version);
    };
    navigator.serviceWorker.controller.postMessage(
      { type: 'GET_VERSION' },
      [messageChannel.port2]
    );
  }
}

// Fonction pour vider le cache
function clearCache() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data.success) {
        console.log('✅ Cache vidé avec succès');
        // Ne pas recharger automatiquement; laisser l'utilisateur décider
        try { showUpdateNotification(); } catch {}
      }
    };
    navigator.serviceWorker.controller.postMessage(
      { type: 'CLEAR_CACHE' },
      [messageChannel.port2]
    );
  }
}

// Vérifier la version au chargement
document.addEventListener('DOMContentLoaded', () => {
  checkSWVersion();
});

// Exposer les fonctions globalement
window.updateApp = updateApp;
window.clearCache = clearCache;
window.checkSWVersion = checkSWVersion;

console.log('✅ Script d\'enregistrement du Service Worker chargé');
