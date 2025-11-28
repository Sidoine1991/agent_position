/**
 * Script pour vider le cache du navigateur
 * À inclure dans votre page ou exécuter dans la console
 */

// Fonction pour vider complètement le cache
async function clearBrowserCache() {
    try {
        console.log('🧹 Début du nettoyage du cache...');

        // 1. Vider le cache API (CacheStorage)
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            console.log(`📦 ${cacheNames.length} cache(s) trouvé(s)`);
            
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log(`✅ Cache "${cacheName}" supprimé`);
            }
        }

        // 2. Désenregistrer tous les Service Workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            console.log(`🔧 ${registrations.length} Service Worker(s) trouvé(s)`);
            
            for (const registration of registrations) {
                await registration.unregister();
                console.log(`✅ Service Worker désenregistré`);
            }
        }

        // 3. Vider localStorage (optionnel - décommentez si nécessaire)
        // localStorage.clear();
        // console.log('✅ localStorage vidé');

        // 4. Vider sessionStorage (optionnel - décommentez si nécessaire)
        // sessionStorage.clear();
        // console.log('✅ sessionStorage vidé');

        console.log('✅ Nettoyage terminé !');
        return true;
    } catch (error) {
        console.error('❌ Erreur lors du nettoyage :', error);
        return false;
    }
}

// Fonction pour recharger la page sans cache
function reloadWithoutCache() {
    // Méthode 1 : Rechargement avec timestamp
    window.location.href = window.location.href.split('?')[0] + '?nocache=' + Date.now();
    
    // Méthode 2 : Rechargement forcé (si la méthode 1 ne fonctionne pas)
    // window.location.reload(true); // Déprécié mais fonctionne encore
}

// Fonction complète : vider le cache puis recharger
async function clearCacheAndReload() {
    await clearBrowserCache();
    setTimeout(() => {
        reloadWithoutCache();
    }, 500);
}

// Exporter les fonctions pour utilisation globale
if (typeof window !== 'undefined') {
    window.clearBrowserCache = clearBrowserCache;
    window.reloadWithoutCache = reloadWithoutCache;
    window.clearCacheAndReload = clearCacheAndReload;
}

// Exécution automatique si appelé directement
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        clearBrowserCache,
        reloadWithoutCache,
        clearCacheAndReload
    };
}

