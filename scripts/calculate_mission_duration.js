const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

async function calculateMissionDuration() {
  try {
    console.log('🔧 Calcul de la durée de mission pour tous les checkins...');
    
    // Récupérer tous les checkins groupés par mission_id
    const { data: checkins, error: checkinsError } = await supabaseClient
      .from('checkins')
      .select('id, mission_id, timestamp, mission_duration')
      .order('mission_id, timestamp');
    
    if (checkinsError) {
      console.error('❌ Erreur lors de la récupération des checkins:', checkinsError);
      return;
    }
    
    if (!checkins || checkins.length === 0) {
      console.log('⚠️ Aucun checkin trouvé');
      return;
    }
    
    console.log(`📊 ${checkins.length} checkins trouvés`);
    
    // Grouper par mission_id
    const missions = {};
    checkins.forEach(checkin => {
      if (!missions[checkin.mission_id]) {
        missions[checkin.mission_id] = [];
      }
      missions[checkin.mission_id].push(checkin);
    });
    
    console.log(`📋 ${Object.keys(missions).length} missions trouvées`);
    
    let updated = 0;
    let skipped = 0;
    
    // Calculer la durée pour chaque mission
    for (const [missionId, missionCheckins] of Object.entries(missions)) {
      if (missionCheckins.length < 2) {
        console.log(`⚠️ Mission ${missionId}: moins de 2 checkins, impossible de calculer la durée`);
        skipped++;
        continue;
      }
      
      // Trier par timestamp
      missionCheckins.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      const startTime = new Date(missionCheckins[0].timestamp);
      const endTime = new Date(missionCheckins[missionCheckins.length - 1].timestamp);
      const durationMinutes = Math.round((endTime - startTime) / (1000 * 60)); // Durée en minutes
      
      console.log(`📅 Mission ${missionId}: ${startTime.toLocaleString()} → ${endTime.toLocaleString()} = ${durationMinutes} min`);
      
      // Mettre à jour tous les checkins de cette mission
      for (const checkin of missionCheckins) {
        if (checkin.mission_duration === null || checkin.mission_duration === undefined) {
          const { error: updateError } = await supabaseClient
            .from('checkins')
            .update({ mission_duration: durationMinutes })
            .eq('id', checkin.id);
          
          if (updateError) {
            console.error(`❌ Erreur mise à jour checkin ${checkin.id}:`, updateError);
          } else {
            updated++;
          }
        } else {
          console.log(`⏭️ Checkin ${checkin.id}: durée déjà calculée (${checkin.mission_duration} min)`);
          skipped++;
        }
      }
    }
    
    console.log(`✅ Calcul terminé: ${updated} checkins mis à jour, ${skipped} ignorés`);
    
  } catch (err) {
    console.error('❌ Erreur inattendue:', err);
  }
}

calculateMissionDuration();
