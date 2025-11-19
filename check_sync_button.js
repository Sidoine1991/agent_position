// Ouvrez la console du navigateur (F12) et collez ce code pour vérifier
console.log('🔍 Vérification du bouton de synchronisation...');

// 1. Vérifier le rôle de l'utilisateur
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('Utilisateur connecté:', user);
console.log('Rôle:', user.role);

// 2. Vérifier si le bouton existe
const syncBtn = document.getElementById('sync-offline-btn');
console.log('Bouton sync trouvé:', !!syncBtn);

if (syncBtn) {
  console.log('Style actuel du bouton:', syncBtn.style.display);
  console.log('Classes du bouton:', syncBtn.className);
}

// 3. Vérifier les checkins hors-ligne
async function checkOfflineCheckins() {
  try {
    const db = await openIndexedDB();
    const checkins = await getAllOfflineCheckins(db);
    console.log('Checkins hors-ligne trouvés:', checkins.length);
    
    if (checkins.length > 0) {
      console.log('Premier checkin hors-ligne:', checkins[0]);
      console.log('✅ Le bouton devrait être visible!');
    } else {
      console.log('❌ Aucun checkin hors-ligne → le bouton reste caché');
    }
  } catch (error) {
    console.error('Erreur vérification hors-ligne:', error);
  }
}

// Fonctions pour IndexedDB (copiées du code)
async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CCRB_OfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('checkins')) {
        const store = db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true });
        store.createIndex('user_id', 'user_id', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

async function getAllOfflineCheckins(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['checkins'], 'readonly');
    const store = transaction.objectStore('checkins');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

// Exécuter la vérification
checkOfflineCheckins();

// 4. Forcer l'affichage du bouton pour tester
console.log('🔧 Forcer l\'affichage du bouton pour test...');
if (syncBtn) {
  syncBtn.style.display = 'block';
  console.log('✅ Bouton maintenant visible!');
}
