/**
 * Script pour vider le cache du navigateur
 * À exécuter dans la console du navigateur (F12) ou à inclure dans une page
 */

(function() {
  'use strict';

  /**
   * Vide le cache du navigateur et recharge la page
   */
  function clearCacheAndReload() {
    console.log('🧹 Début du vidage du cache...');

    // 1. Vider le cache de l'API Cache
    if ('caches' in window) {
      caches.keys().then(function(names) {
        console.log('📦 Caches trouvés:', names);
        return Promise.all(
          names.map(function(name) {
            console.log('🗑️ Suppression du cache:', name);
            return caches.delete(name);
          })
        );
      }).then(function() {
        console.log('✅ Tous les caches ont été supprimés');
      }).catch(function(error) {
        console.error('❌ Erreur lors de la suppression des caches:', error);
      });
    }

    // 2. Désenregistrer les Service Workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        console.log('👷 Service Workers trouvés:', registrations.length);
        return Promise.all(
          registrations.map(function(registration) {
            console.log('🗑️ Désenregistrement du Service Worker:', registration.scope);
            return registration.unregister();
          })
        );
      }).then(function() {
        console.log('✅ Tous les Service Workers ont été désenregistrés');
      }).catch(function(error) {
        console.error('❌ Erreur lors du désenregistrement des Service Workers:', error);
      });
    }

    // 3. Vider LocalStorage (optionnel - commenté pour ne pas perdre les données)
    // localStorage.clear();
    // console.log('✅ LocalStorage vidé');

    // 4. Vider SessionStorage (optionnel - commenté pour ne pas perdre les données)
    // sessionStorage.clear();
    // console.log('✅ SessionStorage vidé');

    // 5. Recharger la page sans cache
    console.log('🔄 Rechargement de la page sans cache...');
    setTimeout(function() {
      // Méthode 1: location.reload avec force
      window.location.reload(true);
      
      // Méthode 2: Alternative avec timestamp (décommentez si la méthode 1 ne fonctionne pas)
      // window.location.href = window.location.href.split('?')[0] + '?nocache=' + Date.now();
    }, 1000);
  }

  /**
   * Vide uniquement LocalStorage
   */
  function clearLocalStorage() {
    const count = localStorage.length;
    localStorage.clear();
    console.log(`✅ LocalStorage vidé (${count} éléments supprimés)`);
    return count;
  }

  /**
   * Vide uniquement SessionStorage
   */
  function clearSessionStorage() {
    const count = sessionStorage.length;
    sessionStorage.clear();
    console.log(`✅ SessionStorage vidé (${count} éléments supprimés)`);
    return count;
  }

  /**
   * Vide tout (cache, LocalStorage, SessionStorage)
   */
  function clearAll() {
    console.log('🔥 Vidage complet...');
    
    // Vider LocalStorage
    clearLocalStorage();
    
    // Vider SessionStorage
    clearSessionStorage();
    
    // Vider le cache
    if ('caches' in window) {
      caches.keys().then(function(names) {
        return Promise.all(names.map(name => caches.delete(name)));
      });
    }
    
    // Désenregistrer les Service Workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        return Promise.all(registrations.map(reg => reg.unregister()));
      });
    }
    
    console.log('✅ Tout a été vidé');
  }

  /**
   * Affiche les informations sur le cache actuel
   */
  function showCacheInfo() {
    console.log('📊 Informations sur le cache:');
    console.log('  - LocalStorage:', localStorage.length, 'éléments');
    console.log('  - SessionStorage:', sessionStorage.length, 'éléments');
    
    if ('caches' in window) {
      caches.keys().then(function(names) {
        console.log('  - Caches:', names.length, 'caches trouvés');
        names.forEach(function(name) {
          console.log('    *', name);
        });
      });
    }
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        console.log('  - Service Workers:', registrations.length, 'enregistrés');
        registrations.forEach(function(reg) {
          console.log('    *', reg.scope);
        });
      });
    }
  }

  // Exposer les fonctions globalement
  window.clearCache = clearCacheAndReload;
  window.clearLocalStorage = clearLocalStorage;
  window.clearSessionStorage = clearSessionStorage;
  window.clearAll = clearAll;
  window.showCacheInfo = showCacheInfo;

  console.log('✅ Script de vidage de cache chargé !');
  console.log('📝 Commandes disponibles:');
  console.log('  - clearCache() : Vide le cache et recharge la page');
  console.log('  - clearLocalStorage() : Vide uniquement LocalStorage');
  console.log('  - clearSessionStorage() : Vide uniquement SessionStorage');
  console.log('  - clearAll() : Vide tout (cache + storage)');
  console.log('  - showCacheInfo() : Affiche les informations sur le cache');
})();
