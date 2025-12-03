// Script pour créer des checkins de test dans IndexedDB
// Exécutez ce script dans la console du navigateur pour créer des données de test

async function createTestOfflineCheckins() {
  console.log('🧪 Création de checkins de test hors-ligne...');
  
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
          const store = db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true });
          store.createIndex('user_id', 'user_id', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };
    });
    
    console.log('✅ Base de données ouverte');
    
    // 2. Créer des checkins de test
    const testCheckins = [
      {
        user_id: 88, // ID de l'utilisateur test
        lat: 48.8566,
        lon: 2.3522,
        type: 'start_mission',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Il y a 2 heures
        start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        accuracy: 15.5,
        note: 'Test hors-ligne - Début de mission',
        photo_url: 'https://example.com/test-photo-1.jpg',
        mission_id: 845,
        synced: false,
        created_at: new Date().toISOString()
      },
      {
        user_id: 88,
        lat: 48.8570,
        lon: 2.3530,
        type: 'checkin',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Il y a 1 heure
        start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        accuracy: 8.2,
        note: 'Test hors-ligne - Point de contrôle',
        photo_url: null,
        mission_id: 845,
        synced: false,
        created_at: new Date().toISOString()
      },
      {
        user_id: 88,
        lat: 48.8560,
        lon: 2.3510,
        type: 'end_mission',
        timestamp: new Date().toISOString(), // Maintenant
        start_time: new Date().toISOString(),
        accuracy: 12.0,
        note: 'Test hors-ligne - Fin de mission',
        photo_url: 'https://example.com/test-photo-3.jpg',
        mission_id: 845,
        synced: false,
        created_at: new Date().toISOString()
      }
    ];
    
    // 3. Insérer les checkins dans IndexedDB
    const transaction = db.transaction(['checkins'], 'readwrite');
    const store = transaction.objectStore('checkins');
    
    let insertedCount = 0;
    for (const checkin of testCheckins) {
      await new Promise((resolve, reject) => {
        const request = store.add(checkin);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          console.log(`✅ Checkin test créé: ${checkin.type}`);
          insertedCount++;
          resolve();
        };
      });
    }
    
    console.log(`🎉 ${insertedCount} checkins de test créés dans IndexedDB`);
    console.log('📋 Vous pouvez maintenant les synchroniser avec:');
    console.log('   await syncOfflineCheckins()');
    
    // 4. Vérifier les données créées
    await checkOfflineData();
    
  } catch (error) {
    console.error('❌ Erreur création checkins de test:', error);
  }
}

// Fonction pour vérifier les données (réutilisée)
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
        console.log(`     Date: ${new Date(checkin.timestamp || checkin.start_time).toLocaleString()}`);
        console.log(`     Position: ${checkin.lat}, ${checkin.lon}`);
        console.log(`     Note: ${checkin.note || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur vérification:', error);
  }
}

// Instructions
console.log('📖 Script de création de checkins de test');
console.log('');
console.log('🚀 Pour créer des checkins de test, exécutez:');
console.log('  await createTestOfflineCheckins()');
console.log('');
console.log('🔍 Pour vérifier les données:');
console.log('  await checkOfflineData()');
console.log('');
console.log('🔄 Pour synchroniser (après avoir créé les données):');
console.log('  await syncOfflineCheckins()');
