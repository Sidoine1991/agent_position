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

// Afficher une notification de succès au lieu de recharger automatiquement
if (window.location.search.includes('clear-cache')) {
  console.log('✅ Cache nettoyé avec succès');
  
  // Afficher une notification de succès
  const notification = document.createElement('div');
  notification.className = 'alert alert-success alert-dismissible fade show position-fixed';
  notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 300px;';
  notification.innerHTML = `
    <strong>✅ Cache nettoyé</strong>
    <p class="mb-2">Tous les caches ont été supprimés avec succès.</p>
    <button type="button" class="btn btn-sm btn-primary" onclick="window.location.href = window.location.pathname">
      Recharger la page
    </button>
    <button type="button" class="btn btn-sm btn-secondary ms-2" onclick="this.parentElement.remove()">
      Fermer
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

console.log('✅ Nettoyage du cache terminé');
