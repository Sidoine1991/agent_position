const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnoseCheckinPresenceIssue() {
  console.log('🔍 Diagnostic du problème checkin/présence...');
  
  try {
    // 1. Vérifier les checkins récents
    console.log('\n📊 Étape 1: Checkins récents (24 dernières heures)...');
    const { data: recentCheckins, error: checkinsError } = await supabase
      .from('checkins')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    if (checkinsError) {
      console.error('❌ Erreur checkins:', checkinsError);
      return;
    }
    
    console.log(`✅ ${recentCheckins?.length || 0} checkins trouvés`);
    
    // 2. Vérifier les présences récentes
    console.log('\n📊 Étape 2: Présences récentes (24 dernières heures)...');
    const { data: recentPresences, error: presencesError } = await supabase
      .from('presences')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    if (presencesError) {
      console.error('❌ Erreur présences:', presencesError);
      return;
    }
    
    console.log(`✅ ${recentPresences?.length || 0} présences trouvées`);
    
    // 3. Comparer les données
    console.log('\n🔍 Étape 3: Analyse comparative...');
    
    if (recentCheckins && recentCheckins.length > 0) {
      console.log('\n📋 Checkins récents:');
      recentCheckins.forEach((checkin, index) => {
        console.log(`  ${index + 1}. ID: ${checkin.id}, User: ${checkin.user_id}, Time: ${checkin.created_at}, Lat: ${checkin.lat}, Lon: ${checkin.lon}`);
      });
    }
    
    if (recentPresences && recentPresences.length > 0) {
      console.log('\n📋 Présences récentes:');
      recentPresences.forEach((presence, index) => {
        console.log(`  ${index + 1}. ID: ${presence.id}, User: ${presence.user_id}, Time: ${presence.created_at}, Lat: ${presence.location_lat}, Lon: ${presence.location_lng}`);
      });
    }
    
    // 4. Identifier les checkins sans présence correspondante
    console.log('\n🚨 Étape 4: Checkins sans présence...');
    
    if (recentCheckins && recentCheckins.length > 0) {
      const checkinsWithoutPresence = [];
      
      for (const checkin of recentCheckins) {
        const { data: matchingPresence } = await supabase
          .from('presences')
          .select('*')
          .eq('user_id', checkin.user_id)
          .eq('created_at', checkin.created_at)
          .maybeSingle();
        
        if (!matchingPresence) {
          checkinsWithoutPresence.push(checkin);
        }
      }
      
      console.log(`📊 ${checkinsWithoutPresence.length} checkins sans présence correspondante`);
      
      if (checkinsWithoutPresence.length > 0) {
        console.log('\n🔧 Checkins à corriger:');
        checkinsWithoutPresence.forEach((checkin, index) => {
          console.log(`  ${index + 1}. ID: ${checkin.id}, User: ${checkin.user_id}, Time: ${checkin.created_at}`);
        });
        
        // 5. Proposer la correction
        console.log('\n🔧 Étape 5: Correction automatique...');
        
        for (const checkin of checkinsWithoutPresence) {
          try {
            const presenceData = {
              user_id: checkin.user_id,
              start_time: checkin.start_time || checkin.created_at,
              end_time: null,
              location_lat: checkin.lat,
              location_lng: checkin.lon,
              location_name: null,
              notes: checkin.note || 'Checkin mobile',
              photo_url: null,
              status: 'completed',
              checkin_type: checkin.type || 'checkin',
              created_at: checkin.created_at,
              zone_id: null,
              within_tolerance: true,
              distance_from_reference_m: null,
              tolerance_meters: 500
            };
            
            const { data: newPresence, error: insertError } = await supabase
              .from('presences')
              .insert(presenceData)
              .select()
              .single();
            
            if (insertError) {
              console.error(`❌ Erreur insertion présence pour checkin ${checkin.id}:`, insertError);
            } else {
              console.log(`✅ Présence créée: ID ${newPresence.id} pour checkin ${checkin.id}`);
            }
          } catch (error) {
            console.error(`❌ Erreur traitement checkin ${checkin.id}:`, error);
          }
        }
      }
    }
    
    // 6. Vérifier l'état après correction
    console.log('\n📊 Étape 6: Vérification finale...');
    
    const { data: finalPresences, error: finalError } = await supabase
      .from('presences')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    if (finalError) {
      console.error('❌ Erreur vérification finale:', finalError);
    } else {
      console.log(`✅ ${finalPresences?.length || 0} présences totales après correction`);
    }
    
    console.log('\n🎉 Diagnostic terminé!');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

diagnoseCheckinPresenceIssue();
