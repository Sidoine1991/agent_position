// Endpoint pour synchroniser les checkins en cache depuis le client
app.post('/api/sync/offline-checkins', authenticateToken, async (req, res) => {
  try {
    const { checkins } = req.body || {};
    
    if (!Array.isArray(checkins) || checkins.length === 0) {
      return res.json({ success: true, message: 'Aucun checkin à synchroniser', synced: 0 });
    }
    
    console.log(`🔄 Synchronisation de ${checkins.length} checkins hors-ligne pour user ${req.user.id}...`);
    
    let syncedCount = 0;
    const errors = [];
    
    for (const checkin of checkins) {
      try {
        // Préparer les données pour Supabase
        const checkinData = {
          user_id: req.user.id,
          lat: Number(checkin.lat),
          lon: Number(checkin.lon),
          type: checkin.type || 'checkin',
          start_time: checkin.start_time || checkin.timestamp || new Date().toISOString(),
          accuracy: checkin.accuracy ? Number(checkin.accuracy) : null,
          note: checkin.note || null,
          photo_url: checkin.photo_url || checkin.photo_path || null,
          mission_id: checkin.mission_id || null
        };
        
        // Insérer dans Supabase
        const { data, error } = await supabaseClient
          .from('checkins')
          .insert([checkinData])
          .select()
          .single();
        
        if (error) {
          console.error(`❌ Erreur insertion checkin ${checkin.id || 'unknown'}:`, error);
          errors.push({ checkin: checkin.id || 'unknown', error: error.message });
        } else {
          console.log(`✅ Checkin synchronisé: ID ${data.id}`);
          syncedCount++;
        }
      } catch (e) {
        console.error(`❌ Erreur traitement checkin:`, e);
        errors.push({ checkin: checkin.id || 'unknown', error: e.message });
      }
    }
    
    console.log(`🎉 Synchronisation terminée: ${syncedCount}/${checkins.length} checkins synchronisés`);
    
    return res.json({
      success: true,
      message: `${syncedCount} checkins synchronisés avec succès`,
      synced: syncedCount,
      total: checkins.length,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('❌ Erreur générale synchronisation checkins:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la synchronisation',
      error: error.message
    });
  }
});

// Endpoint pour récupérer les checkins en cache depuis IndexedDB (via un script client)
app.get('/api/sync/get-offline-checkins', authenticateToken, async (req, res) => {
  try {
    // Cet endpoint retourne un script JavaScript qui sera exécuté côté client
    // pour récupérer les checkins depuis IndexedDB et les envoyer à /api/sync/offline-checkins
    
    const syncScript = `
(async function() {
  try {
    console.log('🔍 Récupération des checkins hors-ligne depuis IndexedDB...');
    
    // Ouvrir la base de données IndexedDB
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
    
    // Récupérer tous les checkins non synchronisés
    const transaction = db.transaction(['checkins'], 'readonly');
    const store = transaction.objectStore('checkins');
    const index = store.index('synced');
    
    const checkins = await new Promise((resolve, reject) => {
      const request = index.getAll(false); // false = non synchronisés
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
    
    console.log(\`📊 Trouvé \${checkins.length} checkins non synchronisés\`);
    
    if (checkins.length > 0) {
      // Envoyer les checkins au serveur
      const response = await fetch('/api/sync/offline-checkins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('jwt')
        },
        body: JSON.stringify({ checkins })
      });
      
      const result = await response.json();
      console.log('📤 Résultat de la synchronisation:', result);
      
      // Marquer comme synchronisés si succès
      if (result.success && result.synced > 0) {
        const syncTransaction = db.transaction(['checkins'], 'readwrite');
        const syncStore = syncTransaction.objectStore('checkins');
        
        for (const checkin of checkins) {
          await new Promise((resolve, reject) => {
            const updateRequest = syncStore.put({ ...checkin, synced: true });
            updateRequest.onerror = () => reject(updateRequest.error);
            updateRequest.onsuccess = () => resolve();
          });
        }
        
        console.log(\`✅ \${result.synced} checkins marqués comme synchronisés\`);
      }
      
      return result;
    } else {
      console.log('ℹ️ Aucun checkin à synchroniser');
      return { success: true, message: 'Aucun checkin à synchroniser' };
    }
    
  } catch (error) {
    console.error('❌ Erreur synchronisation automatique:', error);
    return { success: false, error: error.message };
  }
})();
`;
    
    res.setHeader('Content-Type', 'application/javascript');
    res.send(syncScript);
    
  } catch (error) {
    console.error('❌ Erreur génération script sync:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
