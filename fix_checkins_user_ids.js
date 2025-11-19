const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixCheckinsUserIds() {
  console.log('🔧 Correction des user_id dans la table checkins...');
  
  try {
    // 1. Récupérer tous les checkins avec mission_id
    const { data: checkins, error: checkinsError } = await supabase
      .from('checkins')
      .select('id, mission_id, user_id, created_at')
      .not('mission_id', 'is', null);
    
    if (checkinsError) {
      console.error('❌ Erreur récupération checkins:', checkinsError);
      return;
    }
    
    console.log(`📊 ${checkins.length} checkins avec mission_id trouvés`);
    
    // 2. Pour chaque checkin, récupérer le user_id depuis la mission
    let corrections = 0;
    let errors = 0;
    
    for (const checkin of checkins) {
      try {
        // Récupérer la mission pour obtenir l'agent_id
        const { data: mission, error: missionError } = await supabase
          .from('missions')
          .select('agent_id')
          .eq('id', checkin.mission_id)
          .single();
        
        if (missionError || !mission) {
          console.log(`⚠️ Mission ${checkin.mission_id} non trouvée pour checkin ${checkin.id}`);
          errors++;
          continue;
        }
        
        // Si le user_id est différent, le corriger
        if (checkin.user_id !== mission.agent_id) {
          console.log(`🔄 Correction checkin ${checkin.id}: ${checkin.user_id} → ${mission.agent_id} (mission: ${checkin.mission_id})`);
          
          const { error: updateError } = await supabase
            .from('checkins')
            .update({ user_id: mission.agent_id })
            .eq('id', checkin.id);
          
          if (updateError) {
            console.error(`❌ Erreur mise à jour checkin ${checkin.id}:`, updateError);
            errors++;
          } else {
            corrections++;
          }
        }
      } catch (e) {
        console.error(`❌ Erreur traitement checkin ${checkin.id}:`, e.message);
        errors++;
      }
    }
    
    console.log(`\n✅ Correction terminée:`);
    console.log(`   - ${corrections} checkins corrigés`);
    console.log(`   - ${errors} erreurs`);
    
    // 3. Vérifier les checkins sans mission_id
    const { data: noMission, error: noMissionError } = await supabase
      .from('checkins')
      .select('id, user_id, created_at')
      .is('mission_id', null)
      .limit(10);
    
    if (noMissionError) {
      console.error('❌ Erreur checkins sans mission:', noMissionError);
    } else {
      console.log(`\n📋 ${noMission.length} checkins sans mission_id (conserver user_id actuel):`);
      noMission.forEach(c => {
        console.log(`   - ID: ${c.id}, user_id: ${c.user_id}, date: ${new Date(c.created_at).toLocaleDateString('fr-FR')}`);
      });
    }
    
  } catch (e) {
    console.error('❌ Erreur générale:', e);
  }
}

fixCheckinsUserIds();
