const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Simuler des checkins qui pourraient être en cache client
const mockOfflineCheckins = [
  {
    id: 1,
    user_id: 88,
    lat: 48.8566,
    lon: 2.3522,
    type: 'start_mission',
    timestamp: '2025-11-19T08:30:00.000Z',
    start_time: '2025-11-19T08:30:00.000Z',
    accuracy: 15.5,
    note: 'Début de mission - Test sync',
    photo_url: 'https://example.com/photo1.jpg',
    mission_id: 845,
    synced: false,
    created_at: '2025-11-19T08:30:00.000Z'
  },
  {
    id: 2,
    user_id: 88,
    lat: 48.8570,
    lon: 2.3530,
    type: 'checkin',
    timestamp: '2025-11-19T10:15:00.000Z',
    start_time: '2025-11-19T10:15:00.000Z',
    accuracy: 8.2,
    note: 'Point de contrôle - Test sync',
    photo_url: null,
    mission_id: 845,
    synced: false,
    created_at: '2025-11-19T10:15:00.000Z'
  },
  {
    id: 3,
    user_id: 88,
    lat: 48.8560,
    lon: 2.3510,
    type: 'end_mission',
    timestamp: '2025-11-19T12:45:00.000Z',
    start_time: '2025-11-19T12:45:00.000Z',
    accuracy: 12.0,
    note: 'Fin de mission - Test sync',
    photo_url: 'https://example.com/photo3.jpg',
    mission_id: 845,
    synced: false,
    created_at: '2025-11-19T12:45:00.000Z'
  }
];

async function syncOfflineCheckins() {
  console.log('🔄 Simulation de synchronisation des checkins hors-ligne...');
  
  try {
    // Vérifier l'utilisateur
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', 88)
      .single();
    
    if (userError || !user) {
      console.error('❌ Utilisateur non trouvé:', userError);
      return;
    }
    
    console.log(`✅ Utilisateur trouvé: ${user.email} (ID: ${user.id})`);
    console.log(`📊 ${mockOfflineCheckins.length} checkins à synchroniser`);
    
    let syncedCount = 0;
    const errors = [];
    
    for (const checkin of mockOfflineCheckins) {
      try {
        // Préparer les données pour Supabase
        const checkinData = {
          user_id: user.id,
          lat: Number(checkin.lat),
          lon: Number(checkin.lon),
          type: checkin.type || 'checkin',
          start_time: checkin.start_time || checkin.timestamp || new Date().toISOString(),
          accuracy: checkin.accuracy ? Number(checkin.accuracy) : null,
          note: checkin.note || null,
          photo_url: checkin.photo_url || null,
          mission_id: checkin.mission_id || null
        };
        
        console.log(`📍 Synchronisation checkin ID ${checkin.id}: ${checkin.type}`);
        
        // Insérer dans Supabase
        const { data, error } = await supabase
          .from('checkins')
          .insert([checkinData])
          .select()
          .single();
        
        if (error) {
          console.error(`❌ Erreur insertion checkin ${checkin.id}:`, error);
          errors.push({ checkin: checkin.id, error: error.message });
        } else {
          console.log(`✅ Checkin synchronisé: Supabase ID ${data.id}`);
          syncedCount++;
          
          // Marquer comme synchronisé dans le cache simulé
          checkin.synced = true;
          checkin.supabase_id = data.id;
        }
      } catch (e) {
        console.error(`❌ Erreur traitement checkin ${checkin.id}:`, e);
        errors.push({ checkin: checkin.id, error: e.message });
      }
    }
    
    console.log(`\n🎉 Synchronisation terminée:`);
    console.log(`   ✅ ${syncedCount}/${mockOfflineCheckins.length} checkins synchronisés`);
    
    if (errors.length > 0) {
      console.log(`   ❌ ${errors.length} erreurs:`);
      errors.forEach(err => {
        console.log(`      - Checkin ${err.checkin}: ${err.error}`);
      });
    }
    
    // Afficher les checkins synchronisés
    console.log(`\n📋 Détails des checkins synchronisés:`);
    mockOfflineCheckins
      .filter(c => c.synced)
      .forEach((checkin, index) => {
        console.log(`   ${index + 1}. Supabase ID: ${checkin.supabase_id}, Type: ${checkin.type}, Heure: ${checkin.start_time}`);
      });
    
    // Vérifier dans Supabase
    console.log(`\n🔍 Vérification dans Supabase...`);
    const { data: recentCheckins, error: checkError } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', '2025-11-19')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (checkError) {
      console.error('❌ Erreur vérification:', checkError);
    } else {
      console.log(`✅ ${recentCheckins.length} checkins trouvés dans Supabase pour aujourd'hui:`);
      recentCheckins.forEach((checkin, index) => {
        console.log(`   ${index + 1}. ID: ${checkin.id}, Type: ${checkin.type}, Heure: ${checkin.start_time}, Note: ${checkin.note}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Fonction pour créer des checkins de test réels
async function createTestCheckins() {
  console.log('🧪 Création de checkins de test...');
  
  try {
    const testCheckins = [
      {
        user_id: 88,
        lat: 48.8566,
        lon: 2.3522,
        type: 'start_mission',
        start_time: new Date().toISOString(),
        accuracy: 15.5,
        note: 'Test sync 1 - Début mission',
        photo_url: 'https://example.com/test1.jpg',
        mission_id: 845
      },
      {
        user_id: 88,
        lat: 48.8570,
        lon: 2.3530,
        type: 'checkin',
        start_time: new Date(Date.now() + 60000).toISOString(),
        accuracy: 8.2,
        note: 'Test sync 2 - Point contrôle',
        photo_url: null,
        mission_id: 845
      }
    ];
    
    for (const checkin of testCheckins) {
      const { data, error } = await supabase
        .from('checkins')
        .insert([checkin])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erreur création test checkin:', error);
      } else {
        console.log(`✅ Test checkin créé: ID ${data.id}`);
      }
    }
  } catch (error) {
    console.error('❌ Erreur création tests:', error);
  }
}

// Menu principal
const args = process.argv.slice(2);
const command = args[0];

if (command === 'sync') {
  syncOfflineCheckins();
} else if (command === 'test') {
  createTestCheckins();
} else {
  console.log('Usage:');
  console.log('  node sync_offline_checkins_node.js sync  - Synchroniser les checkins simulés');
  console.log('  node sync_offline_checkins_node.js test  - Créer des checkins de test');
  console.log('');
  console.log('Exemple:');
  console.log('  node sync_offline_checkins_node.js sync');
}
