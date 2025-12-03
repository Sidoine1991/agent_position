// Script à exécuter dans la console du navigateur pour créer des checkins de test hors-ligne

(async function createOfflineTestCheckins() {
  console.log('🧪 Création de checkins de test hors-ligne...');
  
  try {
    // Ouvrir/ créer IndexedDB
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('offlineDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('checkins')) {
          db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
    
    // Récupérer l'utilisateur connecté
    const token = localStorage.getItem('jwt');
    if (!token) {
      console.error('❌ Utilisateur non connecté. Veuillez vous connecter d\'abord.');
      return;
    }
    
    const userResponse = await fetch('/api/profile', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const user = await userResponse.json();
    
    // Créer des checkins de test
    const testCheckins = [
      {
        user_id: user.id,
        lat: 9.123456,
        lon: 1.234567,
        type: 'start_mission',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        start_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        accuracy: 20.5,
        note: 'Début de mission - Zone rurale (test)',
        photo_url: null,
        mission_id: 846,
        synced: false,
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      },
      {
        user_id: user.id,
        lat: 9.124567,
        lon: 1.235678,
        type: 'checkin',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        accuracy: 15.2,
        note: 'Point de contrôle - Village A (test)',
        photo_url: null,
        mission_id: 846,
        synced: false,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        user_id: user.id,
        lat: 9.125678,
        lon: 1.236789,
        type: 'end_mission',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        accuracy: 18.0,
        note: 'Fin de mission - Retour base (test)',
        photo_url: 'https://example.com/mission-end-photo.jpg',
        mission_id: 846,
        synced: false,
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString()
      }
    ];
    
    // Insérer les checkins dans IndexedDB
    const transaction = db.transaction(['checkins'], 'readwrite');
    const store = transaction.objectStore('checkins');
    
    for (const checkin of testCheckins) {
      await new Promise((resolve, reject) => {
        const request = store.add(checkin);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    
    console.log(`✅ ${testCheckins.length} checkins de test créés dans IndexedDB`);
    console.log('📋 Détails des checkins créés:');
    testCheckins.forEach((checkin, index) => {
      console.log(`   ${index + 1}. ${checkin.type} - ${new Date(checkin.timestamp).toLocaleString()}`);
    });
    
    // Vérifier que les checkins sont bien stockés
    const allCheckins = await new Promise((resolve, reject) => {
      const transaction = db.transaction(['checkins'], 'readonly');
      const store = transaction.objectStore('checkins');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    console.log(`📊 Total checkins dans IndexedDB: ${allCheckins.length}`);
    
    // Afficher le bouton de synchronisation s'il est caché
    const syncBtn = document.getElementById('sync-offline-btn');
    if (syncBtn && syncBtn.style.display === 'none') {
      syncBtn.style.display = 'block';
      console.log('🔄 Bouton de synchronisation affiché');
    }
    
    // Mettre à jour le compteur sur le bouton
    if (syncBtn) {
      syncBtn.innerHTML = `<div class="icon">🔄</div><div class="label">Sync (${testCheckins.length})</div>`;
      syncBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    }
    
    console.log('🎯 Test prêt! Vous pouvez maintenant cliquer sur le bouton "Sync" pour synchroniser les checkins.');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création des checkins de test:', error);
  }
})();

// Fonction pour vérifier les checkins hors-ligne
async function checkOfflineCheckins() {
  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('offlineDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('checkins')) {
          db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
    
    const checkins = await new Promise((resolve, reject) => {
      const transaction = db.transaction(['checkins'], 'readonly');
      const store = transaction.objectStore('checkins');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    console.log(`📊 Checkins hors-ligne: ${checkins.length}`);
    checkins.forEach((checkin, index) => {
      console.log(`   ${index + 1}. ID: ${checkin.id}, Type: ${checkin.type}, Sync: ${checkin.synced ? '✅' : '❌'}`);
    });
    
    return checkins;
  } catch (error) {
    console.error('❌ Erreur:', error);
    return [];
  }
}

// Fonction pour nettoyer les checkins de test
async function clearOfflineTestCheckins() {
  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('offlineDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('checkins')) {
          db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
    
    const transaction = db.transaction(['checkins'], 'readwrite');
    const store = transaction.objectStore('checkins');
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    console.log('🧹 Checkins hors-ligne supprimés');
    
    // Mettre à jour le bouton
    const syncBtn = document.getElementById('sync-offline-btn');
    if (syncBtn) {
      syncBtn.innerHTML = '<div class="icon">🔄</div><div class="label">Sync</div>';
      syncBtn.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
    }
    
  } catch (error) {
    console.error('❌ Erreur suppression:', error);
  }
}

console.log('📋 Fonctions disponibles:');
console.log('  - createOfflineTestCheckins() // Crée des checkins de test');
console.log('  - checkOfflineCheckins() // Vérifie les checkins hors-ligne');
console.log('  - clearOfflineTestCheckins() // Nettoie les checkins de test');
