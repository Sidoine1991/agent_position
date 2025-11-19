const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixUser1Checkins() {
  console.log('🔧 Correction des checkins avec user_id=1...');
  
  try {
    // 1. Récupérer tous les checkins avec user_id=1
    console.log('\n📍 Étape 1: Récupération des checkins user_id=1...');
    const { data: checkinsUser1, error: checkinsError } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', 1)
      .order('created_at', { ascending: false });
    
    if (checkinsError) {
      console.error('❌ Erreur checkins user 1:', checkinsError);
      return;
    }
    
    console.log(`✅ ${checkinsUser1?.length || 0} checkins à corriger`);
    
    if (!checkinsUser1 || checkinsUser1.length === 0) {
      console.log('ℹ️ Aucun checkin à corriger');
      return;
    }
    
    // 2. Pour chaque checkin, trouver le bon agent_id depuis la mission
    console.log('\n🎯 Étape 2: Correction des checkins...');
    
    let correctedCount = 0;
    let errorCount = 0;
    
    for (const checkin of checkinsUser1) {
      try {
        console.log(`\n🔍 Traitement checkin ID ${checkin.id} (Mission ${checkin.mission_id})...`);
        
        // Vérifier la mission
        const { data: mission, error: missionError } = await supabase
          .from('missions')
          .select('agent_id, status')
          .eq('id', checkin.mission_id)
          .single();
        
        if (missionError) {
          console.error(`❌ Erreur mission ${checkin.mission_id}:`, missionError);
          errorCount++;
          continue;
        }
        
        const correctUserId = mission.agent_id;
        console.log(`📊 Mission agent_id: ${correctUserId}`);
        
        // Vérifier que l'agent existe
        const { data: agent, error: agentError } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('id', correctUserId)
          .single();
        
        if (agentError) {
          console.error(`❌ Erreur agent ${correctUserId}:`, agentError);
          errorCount++;
          continue;
        }
        
        console.log(`👤 Agent trouvé: ${agent.name} (${agent.role})`);
        
        // Mettre à jour le checkin
        const { data: updatedCheckin, error: updateError } = await supabase
          .from('checkins')
          .update({ user_id: correctUserId })
          .eq('id', checkin.id)
          .select()
          .single();
        
        if (updateError) {
          console.error(`❌ Erreur mise à jour checkin ${checkin.id}:`, updateError);
          errorCount++;
          continue;
        }
        
        console.log(`✅ Checkin ${checkin.id} mis à jour: user_id 1 → ${correctUserId}`);
        correctedCount++;
        
        // Créer la présence correspondante
        try {
          const presenceData = {
            user_id: correctUserId,
            start_time: updatedCheckin.start_time || updatedCheckin.created_at,
            end_time: null,
            location_lat: updatedCheckin.lat,
            location_lng: updatedCheckin.lon,
            location_name: null,
            notes: updatedCheckin.note || 'Checkin corrigé',
            photo_url: updatedCheckin.photo_url,
            status: 'completed',
            checkin_type: updatedCheckin.type || 'checkin',
            created_at: updatedCheckin.created_at,
            zone_id: null,
            within_tolerance: true,
            distance_from_reference_m: null,
            tolerance_meters: 500
          };
          
          const { data: newPresence, error: presenceError } = await supabase
            .from('presences')
            .insert(presenceData)
            .select()
            .single();
          
          if (presenceError) {
            console.error(`⚠️ Erreur création présence pour checkin ${checkin.id}:`, presenceError);
          } else {
            console.log(`✅ Présence créée: ID ${newPresence.id}`);
          }
        } catch (presenceErr) {
          console.error(`⚠️ Erreur traitement présence pour checkin ${checkin.id}:`, presenceErr);
        }
        
      } catch (error) {
        console.error(`❌ Erreur traitement checkin ${checkin.id}:`, error);
        errorCount++;
      }
    }
    
    // 3. Vérification finale
    console.log('\n📊 Étape 3: Vérification finale...');
    
    const { data: remainingCheckins, error: remainingError } = await supabase
      .from('checkins')
      .select('id')
      .eq('user_id', 1);
    
    if (remainingError) {
      console.error('❌ Erreur vérification finale:', remainingError);
    } else {
      console.log(`📈 Checkins restants avec user_id=1: ${remainingCheckins?.length || 0}`);
    }
    
    // Statistiques des présences créées récemment
    const { data: recentPresences, error: recentPresencesError } = await supabase
      .from('presences')
      .select('*')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Dernière heure
      .order('created_at', { ascending: false });
    
    if (recentPresencesError) {
      console.error('❌ Erreur présences récentes:', recentPresencesError);
    } else {
      console.log(`📈 Présences créées dans la dernière heure: ${recentPresences?.length || 0}`);
    }
    
    console.log('\n🎉 Correction terminée!');
    console.log(`✅ Checkins corrigés: ${correctedCount}`);
    console.log(`❌ Erreurs: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

fixUser1Checkins();
