// Script de nettoyage du cache pour Vercel
console.log('🧹 Nettoyage du cache Vercel...');

// Vider tous les caches
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name);
      console.log('🗑️ Cache supprimé:', name);
    }
  });
}

// Vider le localStorage des données de cache
try {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('cache') || key.includes('sw') || key.includes('version'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log('🗑️ localStorage supprimé:', key);
  });
} catch (e) {
  console.warn('Erreur nettoyage localStorage:', e);
}

// Vider le sessionStorage
try {
  sessionStorage.clear();
  console.log('🗑️ sessionStorage vidé');
} catch (e) {
  console.warn('Erreur nettoyage sessionStorage:', e);
}

// Forcer le rechargement sans cache
if (window.location.search.includes('clear-cache')) {
  console.log('🔄 Rechargement sans cache...');
  window.location.href = window.location.pathname;
}

console.log('✅ Nettoyage du cache terminé');
