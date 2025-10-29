// Script pour nettoyer les données des agents DELTA MONO antérieures au 26/10/2025
const { createClient } = require('@supabase/supabase-js');

// Charger dotenv si disponible
try {
  require('dotenv').config();
} catch (e) {
  // dotenv pas disponible, pas grave
}

// Désactiver la vérification SSL si NODE_TLS_REJECT_UNAUTHORIZED n'est pas déjà défini
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Configuration Supabase - même logique que server.js
const supabaseUrlRaw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseUrl = typeof supabaseUrlRaw === 'string' 
  ? supabaseUrlRaw.trim().replace(/\/+$/, '') 
  : '';
const supabaseKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY 
  || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseKey = typeof supabaseKeyRaw === 'string' ? supabaseKeyRaw.trim() : '';

console.log('🔗 Configuration Supabase:');
console.log('URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NON DÉFINI');
console.log('Key:', supabaseKey ? 'DÉFINI' : 'NON DÉFINI\n');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: Variables d\'environnement Supabase non définies.');
  console.error('Définissez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const cutoffDate = '2025-10-26'; // Date limite: 26/10/2025

async function cleanupDeltaMonoData() {
  console.log('🧹 Début du nettoyage des données DELTA MONO avant le 26/10/2025...\n');
  
  try {
    // 1. Récupérer les IDs des agents du projet DELTA MONO
    console.log('📋 Récupération des agents DELTA MONO...');
    const { data: agents, error: agentsError } = await supabase
      .from('users')
      .select('id, name, project_name')
      .eq('project_name', 'DELTA MONO');
    
    if (agentsError) {
      console.error('❌ Erreur lors de la récupération des agents:', agentsError);
      return;
    }
    
    if (!agents || agents.length === 0) {
      console.log('⚠️ Aucun agent DELTA MONO trouvé.');
      return;
    }
    
    const agentIds = agents.map(a => a.id);
    console.log(`✅ ${agentIds.length} agents DELTA MONO trouvés: ${agents.map(a => a.name).join(', ')}\n`);
    
    // 2. Supprimer dans planifications
    console.log('🗑️  Suppression des planifications...');
    const { error: planningError } = await supabase
      .from('planifications')
      .delete()
      .in('user_id', agentIds)
      .lt('date', cutoffDate);
    
    if (planningError) {
      console.error('❌ Erreur planifications:', planningError);
    } else {
      console.log('✅ Planifications supprimées');
    }
    
    // 3. Supprimer dans presences
    console.log('🗑️  Suppression des presences...');
    const { error: presencesError } = await supabase
      .from('presences')
      .delete()
      .in('user_id', agentIds)
      .lt('start_time', cutoffDate);
    
    if (presencesError) {
      console.error('❌ Erreur presences:', presencesError);
    } else {
      console.log('✅ Presences supprimées');
    }
    
    // 4. Supprimer dans presence_validations
    console.log('🗑️  Suppression des presence_validations...');
    const { error: validationsError } = await supabase
      .from('presence_validations')
      .delete()
      .in('user_id', agentIds)
      .lt('checkin_timestamp', cutoffDate);
    
    if (validationsError) {
      console.error('❌ Erreur presence_validations:', validationsError);
    } else {
      console.log('✅ Presence validations supprimées');
    }
    
    // 5. Supprimer dans missions
    console.log('🗑️  Suppression des missions...');
    const { error: missionsError } = await supabase
      .from('missions')
      .delete()
      .in('user_id', agentIds)
      .lt('date_start', cutoffDate);
    
    if (missionsError) {
      console.error('❌ Erreur missions:', missionsError);
    } else {
      console.log('✅ Missions supprimées');
    }
    
    // 6. Supprimer dans checkins
    console.log('🗑️  Suppression des checkins...');
    const { error: checkinsError } = await supabase
      .from('checkins')
      .delete()
      .in('user_id', agentIds)
      .lt('timestamp', cutoffDate);
    
    if (checkinsError) {
      console.error('❌ Erreur checkins:', checkinsError);
    } else {
      console.log('✅ Checkins supprimés');
    }
    
    console.log('\n✅ Nettoyage terminé avec succès!');
    console.log('📝 Note: Les informations des agents dans la table users sont préservées.');
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  }
}

// Exécuter le script
cleanupDeltaMonoData()
  .then(() => {
    console.log('\n🏁 Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
