const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Simuler la structure des checkins qui pourraient être dans IndexedDB
// En réalité, ces données viendraient du cache client via un appel API
const simulateOfflineCheckins = [
  {
    id: 1001,
    user_id: 88,
    lat: 9.123456,
    lon: 1.234567,
    type: 'start_mission',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // Il y a 3 heures
    start_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    accuracy: 20.5,
    note: 'Début de mission - Zone rurale',
    photo_url: null,
    mission_id: 846,
    synced: false,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 1002,
    user_id: 88,
    lat: 9.124567,
    lon: 1.235678,
    type: 'checkin',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Il y a 2 heures
    start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    accuracy: 15.2,
    note: 'Point de contrôle - Village A',
    photo_url: null,
    mission_id: 846,
    synced: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 1003,
    user_id: 88,
    lat: 9.125678,
    lon: 1.236789,
    type: 'end_mission',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // Il y a 1 heure
    start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    accuracy: 18.0,
    note: 'Fin de mission - Retour base',
    photo_url: 'https://example.com/mission-end-photo.jpg',
    mission_id: 846,
    synced: false,
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  },
  {
    id: 1004,
    user_id: 93, // Autre utilisateur
    lat: 8.987654,
    lon: 2.345678,
    type: 'start_mission',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // Il y a 4 heures
    start_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    accuracy: 12.8,
    note: 'Début mission - Inspection',
    photo_url: null,
    mission_id: 847,
    synced: false,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  }
];

async function syncAllOfflineCheckins() {
  console.log('🔄 Synchronisation automatique des checkins hors-ligne...');
  
  try {
    // Regrouper les checkins par utilisateur
    const checkinsByUser = {};
    simulateOfflineCheckins.forEach(checkin => {
      if (!checkinsByUser[checkin.user_id]) {
        checkinsByUser[checkin.user_id] = [];
      }
      checkinsByUser[checkin.user_id].push(checkin);
    });
    
    console.log(`📊 Checkins à synchroniser pour ${Object.keys(checkinsByUser).length} utilisateurs`);
    
    let totalSynced = 0;
    let totalErrors = 0;
    
    // Synchroniser par utilisateur
    for (const userId in checkinsByUser) {
      const userCheckins = checkinsByUser[userId];
      console.log(`\n👤 Synchronisation pour utilisateur ${userId} (${userCheckins.length} checkins)...`);
      
      // Vérifier que l'utilisateur existe
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single();
      
      if (userError || !user) {
        console.error(`❌ Utilisateur ${userId} non trouvé, skipping`);
        totalErrors += userCheckins.length;
        continue;
      }
      
      console.log(`✅ Utilisateur trouvé: ${user.email}`);
      
      // Synchroniser les checkins de cet utilisateur
      for (const checkin of userCheckins) {
        try {
          const checkinData = {
            user_id: userId,
            lat: Number(checkin.lat),
            lon: Number(checkin.lon),
            type: checkin.type || 'checkin',
            start_time: checkin.start_time || checkin.timestamp || new Date().toISOString(),
            accuracy: checkin.accuracy ? Number(checkin.accuracy) : null,
            note: checkin.note || null,
            photo_url: checkin.photo_url || null,
            mission_id: checkin.mission_id || null
          };
          
          console.log(`  📍 Checkin ${checkin.id}: ${checkin.type} à ${checkin.lat}, ${checkin.lon}`);
          
          const { data, error } = await supabase
            .from('checkins')
            .insert([checkinData])
            .select()
            .single();
          
          if (error) {
            console.error(`    ❌ Erreur insertion:`, error.message);
            totalErrors++;
          } else {
            console.log(`    ✅ Synchronisé: Supabase ID ${data.id}`);
            totalSynced++;
            
            // Marquer comme synchronisé dans la simulation
            checkin.synced = true;
            checkin.supabase_id = data.id;
          }
        } catch (e) {
          console.error(`    ❌ Erreur traitement:`, e.message);
          totalErrors++;
        }
      }
    }
    
    console.log(`\n🎉 Synchronisation terminée:`);
    console.log(`   ✅ ${totalSynced} checkins synchronisés avec succès`);
    console.log(`   ❌ ${totalErrors} checkins en erreur`);
    
    // Afficher le résumé par utilisateur
    console.log(`\n📊 Résumé par utilisateur:`);
    for (const userId in checkinsByUser) {
      const userCheckins = checkinsByUser[userId];
      const synced = userCheckins.filter(c => c.synced).length;
      const errors = userCheckins.filter(c => !c.synced).length;
      console.log(`   User ${userId}: ${synced} synchronisés, ${errors} erreurs`);
    }
    
    // Vérifier les derniers checkins dans Supabase
    console.log(`\n🔍 Vérification dans Supabase...`);
    const { data: recentCheckins, error: checkError } = await supabase
      .from('checkins')
      .select('*')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()) // 5 dernières heures
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (checkError) {
      console.error('❌ Erreur vérification:', checkError);
    } else {
      console.log(`✅ ${recentCheckins.length} checkins trouvés dans Supabase (5 dernières heures):`);
      recentCheckins.forEach((checkin, index) => {
        console.log(`   ${index + 1}. ID: ${checkin.id}, User: ${checkin.user_id}, Type: ${checkin.type}, Heure: ${new Date(checkin.start_time).toLocaleString()}`);
      });
    }
    
    return { success: true, synced: totalSynced, errors: totalErrors };
    
  } catch (error) {
    console.error('❌ Erreur générale synchronisation:', error);
    return { success: false, error: error.message };
  }
}

// Fonction pour créer une mission de test si besoin
async function createTestMission() {
  console.log('🧪 Création d\'une mission de test...');
  
  try {
    const missionData = {
      title: 'Mission de synchronisation test',
      description: 'Mission créée pour tester la synchronisation des checkins hors-ligne',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      status: 'active',
      project_id: 1, // Adapter selon vos projets
      created_by: 88
    };
    
    const { data, error } = await supabase
      .from('missions')
      .insert([missionData])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erreur création mission:', error);
      return null;
    }
    
    console.log(`✅ Mission créée: ID ${data.id}`);
    return data.id;
    
  } catch (error) {
    console.error('❌ Erreur création mission:', error);
    return null;
  }
}

// Fonction pour nettoyer les checkins de test
async function cleanupTestCheckins() {
  console.log('🧹 Nettoyage des checkins de test...');
  
  try {
    const { error } = await supabase
      .from('checkins')
      .delete()
      .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // 6 dernières heures
      .in('note', ['Début de mission - Zone rurale', 'Point de contrôle - Village A', 'Fin de mission - Retour base', 'Début mission - Inspection']);
    
    if (error) {
      console.error('❌ Erreur nettoyage:', error);
    } else {
      console.log('✅ Checkins de test supprimés');
    }
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
  }
}

// Menu principal
const args = process.argv.slice(2);
const command = args[0];

if (command === 'sync') {
  syncAllOfflineCheckins();
} else if (command === 'create-mission') {
  createTestMission();
} else if (command === 'cleanup') {
  cleanupTestCheckins();
} else {
  console.log('Usage:');
  console.log('  node sync_offline_complete.js sync         - Synchroniser tous les checkins simulés');
  console.log('  node sync_offline_complete.js create-mission - Créer une mission de test');
  console.log('  node sync_offline_complete.js cleanup      - Nettoyer les checkins de test');
  console.log('');
  console.log('Exemple:');
  console.log('  node sync_offline_complete.js sync');
}
