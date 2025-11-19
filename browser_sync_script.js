// Script de synchronisation côté client à exécuter dans la console du navigateur
// Copiez-collez ce script dans la console de votre application web

async function syncOfflineCheckins() {
  console.log('🔄 Début de la synchronisation des checkins hors-ligne...');
  
  try {
    // 1. Ouvrir IndexedDB
    const dbName = 'offlineDB';
    const dbVersion = 1;
    
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('checkins')) {
          console.log('⚠️ La table checkins n\'existe pas encore');
          const store = db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true });
          store.createIndex('user_id', 'user_id', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };
    });
    
    console.log('✅ Base de données ouverte');
    
    // 2. Vérifier si la table checkins existe
    if (!db.objectStoreNames.contains('checkins')) {
      console.log('ℹ️ Aucune table checkins trouvée - Pas de données à synchroniser');
      return { success: true, message: 'Aucune donnée à synchroniser', synced: 0 };
    }
    
    // 3. Récupérer tous les checkins non synchronisés
    const transaction = db.transaction(['checkins'], 'readonly');
    const store = transaction.objectStore('checkins');
    const index = store.index('synced');
    
    const checkins = await new Promise((resolve, reject) => {
      const request = index.getAll(false); // false = non synchronisés
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
    
    console.log(`📊 Trouvé ${checkins.length} checkins non synchronisés`);
    
    if (checkins.length === 0) {
      console.log('ℹ️ Aucun checkin à synchroniser');
      return { success: true, message: 'Aucun checkin à synchroniser', synced: 0 };
    }
    
    // 4. Afficher les détails des checkins à synchroniser
    console.log('📋 Checkins à synchroniser:');
    checkins.forEach((checkin, index) => {
      console.log(`  ${index + 1}. ID: ${checkin.id}, Type: ${checkin.type || 'checkin'}`);
      console.log(`     Lat/Lon: ${checkin.lat}, ${checkin.lon}`);
      console.log(`     Date: ${checkin.timestamp || checkin.start_time || checkin.created_at}`);
      console.log(`     Note: ${checkin.note || 'N/A'}`);
      console.log(`     Photo: ${checkin.photo_url || checkin.photo_path || 'N/A'}`);
    });
    
    // 5. Envoyer les checkins au serveur
    console.log('📤 Envoi des checkins au serveur...');
    
    const response = await fetch('/api/sync/offline-checkins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('jwt')
      },
      body: JSON.stringify({ checkins })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📤 Résultat de la synchronisation:', result);
    
    // 6. Marquer comme synchronisés si succès
    if (result.success && result.synced > 0) {
      console.log(`✅ Mise à jour de ${result.synced} checkins comme synchronisés...`);
      
      const syncTransaction = db.transaction(['checkins'], 'readwrite');
      const syncStore = syncTransaction.objectStore('checkins');
      
      let updatedCount = 0;
      for (const checkin of checkins) {
        await new Promise((resolve, reject) => {
          const updateRequest = syncStore.put({ ...checkin, synced: true });
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => {
            updatedCount++;
            resolve();
          };
        });
      }
      
      console.log(`✅ ${updatedCount} checkins marqués comme synchronisés`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Erreur synchronisation:', error);
    return { success: false, error: error.message };
  }
}

// Fonction pour vérifier les données hors-ligne
async function checkOfflineData() {
  console.log('🔍 Vérification des données hors-ligne...');
  
  try {
    const dbName = 'offlineDB';
    const dbVersion = 1;
    
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => resolve(request.result);
    });
    
    if (!db.objectStoreNames.contains('checkins')) {
      console.log('ℹ️ Aucune table checkins trouvée');
      return;
    }
    
    const transaction = db.transaction(['checkins'], 'readonly');
    const store = transaction.objectStore('checkins');
    
    const allCheckins = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
    
    const syncedCheckins = allCheckins.filter(c => c.synced);
    const unsyncedCheckins = allCheckins.filter(c => !c.synced);
    
    console.log(`📊 Total checkins en cache: ${allCheckins.length}`);
    console.log(`✅ Checkins synchronisés: ${syncedCheckins.length}`);
    console.log(`⏳ Checkins non synchronisés: ${unsyncedCheckins.length}`);
    
    if (unsyncedCheckins.length > 0) {
      console.log('\n📋 Checkins non synchronisés:');
      unsyncedCheckins.forEach((checkin, index) => {
        console.log(`  ${index + 1}. ID: ${checkin.id}, Type: ${checkin.type || 'checkin'}`);
        console.log(`     Date: ${checkin.timestamp || checkin.start_time || new Date(checkin.created_at).toLocaleString()}`);
        console.log(`     Position: ${checkin.lat}, ${checkin.lon}`);
        console.log(`     Note: ${checkin.note || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur vérification:', error);
  }
}

// Fonction pour effacer toutes les données hors-ligne
async function clearOfflineData() {
  if (!confirm('Êtes-vous sûr de vouloir effacer TOUTES les données hors-ligne?')) {
    return;
  }
  
  console.log('🗑️ Suppression des données hors-ligne...');
  
  try {
    const dbName = 'offlineDB';
    const dbVersion = 1;
    
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => resolve(request.result);
    });
    
    if (!db.objectStoreNames.contains('checkins')) {
      console.log('ℹ️ Aucune donnée à supprimer');
      return;
    }
    
    const transaction = db.transaction(['checkins'], 'readwrite');
    const store = transaction.objectStore('checkins');
    
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
    
    console.log('✅ Données hors-ligne supprimées');
    
  } catch (error) {
    console.error('❌ Erreur suppression:', error);
  }
}

// Instructions d'utilisation
console.log('📖 Outils de synchronisation disponibles:');
console.log('  syncOfflineCheckins()  - Synchroniser les checkins hors-ligne');
console.log('  checkOfflineData()    - Vérifier les données hors-ligne');
console.log('  clearOfflineData()     - Effacer les données hors-ligne');
console.log('');
console.log('🚀 Pour lancer la synchronisation, exécutez:');
console.log('  await syncOfflineCheckins()');
