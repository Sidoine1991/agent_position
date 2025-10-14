const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkAndAddMissionDuration() {
  try {
    console.log('🔍 Vérification de la colonne mission_duration...');
    
    // Vérifier si la colonne existe en essayant de la sélectionner
    const { data, error } = await supabaseClient
      .from('checkins')
      .select('mission_duration')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('column "mission_duration" does not exist')) {
        console.log('❌ La colonne mission_duration n\'existe pas encore');
        console.log('');
        console.log('📝 Veuillez exécuter cette commande SQL dans l\'interface Supabase:');
        console.log('');
        console.log('ALTER TABLE checkins ADD COLUMN mission_duration INTEGER DEFAULT NULL;');
        console.log('COMMENT ON COLUMN checkins.mission_duration IS \'Durée de la mission en minutes (calculée entre début et fin de mission)\';');
        console.log('');
        console.log('Puis relancez ce script avec: node scripts/calculate_mission_duration.js');
        return;
      } else {
        console.error('❌ Erreur lors de la vérification:', error);
        return;
      }
    }
    
    console.log('✅ La colonne mission_duration existe déjà');
    
    // Vérifier combien de checkins ont une durée calculée
    const { data: checkinsWithDuration, error: countError } = await supabaseClient
      .from('checkins')
      .select('id, mission_duration')
      .not('mission_duration', 'is', null);
    
    if (countError) {
      console.error('❌ Erreur lors du comptage:', countError);
      return;
    }
    
    console.log(`📊 ${checkinsWithDuration?.length || 0} checkins ont déjà une durée calculée`);
    
    if (checkinsWithDuration && checkinsWithDuration.length > 0) {
      console.log('✅ La colonne est prête à être utilisée');
    } else {
      console.log('⚠️ Aucune durée calculée. Lancez: node scripts/calculate_mission_duration.js');
    }
    
  } catch (err) {
    console.error('❌ Erreur inattendue:', err);
  }
}

checkAndAddMissionDuration();
