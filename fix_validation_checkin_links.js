const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixValidationCheckinLinks() {
  console.log('🔍 Correction des liens validation -> checkin...');
  
  try {
    // 1. Supprimer les validations actuelles qui n'ont pas de checkin_id
    console.log('\n🗑️ Étape 1: Supprimer les validations sans checkin_id...');
    const { error: deleteError } = await supabase
      .from('checkin_validations')
      .delete()
      .is('checkin_id', null);
    
    if (deleteError) {
      console.error('❌ Erreur suppression:', deleteError);
      return;
    }
    
    console.log('✅ Anciennes validations supprimées');
    
    // 2. Récupérer les checkins récents qui pourraient être validés
    console.log('\n📊 Étape 2: Récupérer les checkins récents...');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const { data: recentCheckins, error: checkinsError } = await supabase
      .from('checkins')
      .select('*')
      .gte('created_at', `${threeDaysAgo}T00:00:00.000Z`)
      .order('created_at', { ascending: false });
    
    if (checkinsError) {
      console.error('❌ Erreur checkins:', checkinsError);
      return;
    }
    
    console.log(`✅ ${recentCheckins.length} checkins récents trouvés`);
    
    // 3. Grouper les checkins par utilisateur et par jour
    const checkinsByUserAndDay = new Map();
    
    recentCheckins.forEach(checkin => {
      const date = new Date(checkin.created_at).toISOString().split('T')[0];
      const key = `${checkin.user_id}_${date}`;
      
      if (!checkinsByUserAndDay.has(key)) {
        checkinsByUserAndDay.set(key, []);
      }
      checkinsByUserAndDay.get(key).push(checkin);
    });
    
    console.log(`📊 ${checkinsByUserAndDay.size} combinaisons utilisateur/jour trouvées`);
    
    // 4. Créer des validations pour les checkins de type 'checkin'
    console.log('\n🔄 Étape 3: Créer les validations...');
    const validationsToInsert = [];
    
    for (const [key, userCheckins] of checkinsByUserAndDay) {
      const [userId, date] = key.split('_');
      
      // Prendre le premier checkin de type 'checkin' de la journée
      const dailyCheckin = userCheckins.find(c => c.type === 'checkin');
      
      if (dailyCheckin) {
        // Récupérer les coordonnées de référence de l'utilisateur
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('reference_lat, reference_lon')
          .eq('id', userId)
          .single();
        
        let refLat = null;
        let refLon = null;
        let distance = null;
        
        if (!userError && user && user.reference_lat && user.reference_lon) {
          refLat = user.reference_lat;
          refLon = user.reference_lon;
          
          // Calculer la distance
          distance = calculateDistance(
            refLat, refLon,
            dailyCheckin.lat, dailyCheckin.lon
          );
        }
        
        // Déterminer si la validation est valide (distance < 500m si référence disponible)
        const isValid = distance === null ? true : distance <= 500;
        
        validationsToInsert.push({
          checkin_id: dailyCheckin.id,
          agent_id: parseInt(userId),
          valid: isValid,
          reason: isValid ? 'ok' : (distance ? 'hors_zone' : 'pas_de_reference'),
          distance_m: Math.round(distance) || null,
          tolerance_m: 500,
          reference_lat: refLat,
          reference_lon: refLon,
          created_at: dailyCheckin.created_at // Garder le même timestamp que le checkin
        });
        
        console.log(`📍 Validation créée: User ${userId}, Checkin ${dailyCheckin.id}, Distance: ${Math.round(distance)}m, Valid: ${isValid}`);
      }
    }
    
    // 5. Insérer les nouvelles validations
    if (validationsToInsert.length > 0) {
      console.log(`\n💾 Étape 4: Insérer ${validationsToInsert.length} validations...`);
      
      // Insérer par batches de 10
      const batchSize = 10;
      let totalInserted = 0;
      
      for (let i = 0; i < validationsToInsert.length; i += batchSize) {
        const batch = validationsToInsert.slice(i, i + batchSize);
        
        const { data: inserted, error: insertError } = await supabase
          .from('checkin_validations')
          .insert(batch)
          .select();
        
        if (insertError) {
          console.error(`❌ Erreur insertion batch ${i}-${i + batchSize}:`, insertError);
        } else {
          totalInserted += (inserted || []).length;
          console.log(`✅ Batch ${i}-${i + batchSize}: ${(inserted || []).length} validations insérées`);
        }
      }
      
      console.log(`🎉 Total de validations insérées: ${totalInserted}`);
    } else {
      console.log('ℹ️ Aucune validation à insérer');
    }
    
    // 6. Vérifier le résultat
    console.log('\n🔍 Étape 5: Vérifier le résultat...');
    const { data: finalValidations, error: finalError } = await supabase
      .from('checkin_validations')
      .select(`
        id,
        checkin_id,
        agent_id,
        valid,
        distance_m,
        created_at,
        checkins!left(
          id,
          user_id,
          lat,
          lon,
          start_time,
          note,
          photo_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (finalError) {
      console.error('❌ Erreur vérification finale:', finalError);
    } else {
      console.log(`✅ ${finalValidations.length} validations trouvées avec jointure:`);
      finalValidations.forEach((v, i) => {
        console.log(`  ${i + 1}. ID: ${v.id}, Checkin: ${v.checkin_id}, Agent: ${v.agent_id}`);
        console.log(`      Checkin data: ${v.checkins ? '✅' : '❌'}`);
        if (v.checkins) {
          console.log(`      Checkin user: ${v.checkins.user_id}, Lat: ${v.checkins.lat}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Fonction pour calculer la distance entre deux points
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

fixValidationCheckinLinks();
