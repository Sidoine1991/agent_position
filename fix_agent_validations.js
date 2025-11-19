const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Calcul de distance Haversine
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function fixAgentValidations() {
  try {
    console.log('🔄 Correction des validations pour les vrais agents...');
    
    // 1. Supprimer les anciennes validations incorrectes
    console.log('🗑️ Suppression des anciennes validations...');
    const { error: deleteError } = await supabase
      .from('checkin_validations')
      .delete()
      .neq('id', 0); // Supprimer tout
    
    if (deleteError) {
      console.error('❌ Erreur suppression anciennes validations:', deleteError);
      return;
    }
    
    console.log('✅ Anciennes validations supprimées');
    
    // 2. Récupérer les missions récentes des agents
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const { data: missions, error: missionsError } = await supabase
      .from('missions')
      .select(`
        id,
        agent_id,
        status,
        date_start,
        users!inner (
          role,
          name,
          reference_lat,
          reference_lon,
          tolerance_radius_meters,
          project_name
        )
      `)
      .eq('users.role', 'agent')
      .gte('date_start', `${yesterday}T00:00:00.000Z`)
      .lte('date_start', `${yesterday}T23:59:59.999Z`);
    
    if (missionsError) {
      console.error('❌ Erreur missions:', missionsError);
      return;
    }
    
    console.log(`📊 Missions agents trouvées pour ${yesterday}: ${missions?.length || 0}`);
    
    if (!missions || missions.length === 0) {
      console.log('ℹ️ Aucune mission d\'agent trouvée pour hier');
      return;
    }
    
    // 3. Pour chaque mission, créer une validation
    const validations = [];
    
    for (const mission of missions) {
      const user = mission.users;
      
      // Créer une validation basée sur la mission
      // On suppose que l'agent était présent si la mission est completed ou active
      const isValid = mission.status === 'completed' || mission.status === 'active';
      
      const validation = {
        checkin_id: null, // Pas de checkin direct, on utilise la mission
        agent_id: mission.agent_id, // L'ID de l'agent
        valid: isValid,
        reason: isValid ? 'Mission confirmée' : 'Mission non complétée',
        distance_m: null, // Pas de coordonnées GPS disponibles
        tolerance_m: user.tolerance_radius_meters || 5000,
        reference_lat: user.reference_lat,
        reference_lon: user.reference_lon,
        created_at: mission.date_start
      };
      
      validations.push(validation);
    }
    
    console.log(`📝 Validations à créer: ${validations.length}`);
    
    if (validations.length === 0) {
      console.log('ℹ️ Aucune validation à créer');
      return;
    }
    
    // 4. Insérer les nouvelles validations
    const { data: inserted, error: insertError } = await supabase
      .from('checkin_validations')
      .insert(validations)
      .select();
    
    if (insertError) {
      console.error('❌ Erreur insertion validations:', insertError);
      return;
    }
    
    console.log(`✅ Validations insérées: ${(inserted || []).length}`);
    
    // 5. Afficher un résumé
    console.log('\n🔍 Résumé des validations créées:');
    const projects = {};
    const statuses = {};
    
    inserted?.forEach(v => {
      const mission = missions.find(m => m.agent_id === v.agent_id);
      if (mission) {
        const project = mission.users.project_name;
        projects[project] = (projects[project] || 0) + 1;
      }
      
      statuses[v.valid ? 'valid' : 'invalid'] = (statuses[v.valid ? 'valid' : 'invalid'] || 0) + 1;
    });
    
    console.log('\n📊 Par projet:');
    Object.entries(projects).forEach(([project, count]) => {
      console.log(`  - ${project}: ${count}`);
    });
    
    console.log('\n📊 Par statut:');
    Object.entries(statuses).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`);
    });
    
    // 6. Vérifier le résultat final
    const { count: finalCount, error: finalError } = await supabase
      .from('checkin_validations')
      .select('*', { count: 'exact', head: true });
    
    if (finalError) {
      console.error('❌ Erreur vérification finale:', finalError);
    } else {
      console.log(`\n🎉 Total final de validations: ${finalCount}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

fixAgentValidations();
