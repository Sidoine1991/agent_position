const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env');
  process.exit(1);
}

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

async function generateMissingValidations() {
  try {
    console.log('🔄 Génération des validations manquantes...');
    
    // 1. Récupérer tous les checkins récents (derniers 7 jours)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: checkins, error: checkinsError } = await supabase
      .from('checkins')
      .select('*')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false });
    
    if (checkinsError) {
      console.error('❌ Erreur récupération checkins:', checkinsError);
      return;
    }
    
    console.log(`📊 Checkins trouvés: ${checkins?.length || 0}`);
    
    if (!checkins || checkins.length === 0) {
      console.log('ℹ️ Aucun checkin récent trouvé');
      return;
    }
    
    // 2. Récupérer les utilisateurs pour les coordonnées de référence
    const userIds = [...new Set(checkins.map(c => c.user_id).filter(Boolean))];
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, reference_lat, reference_lon, tolerance_radius_meters')
      .in('id', userIds);
    
    if (usersError) {
      console.error('❌ Erreur récupération utilisateurs:', usersError);
      return;
    }
    
    const usersMap = new Map((users || []).map(u => [u.id, u]));
    console.log(`👥 Utilisateurs chargés: ${usersMap.size}`);
    
    // 3. Pour chaque checkin, créer une validation
    const validations = [];
    
    for (const checkin of checkins) {
      const user = usersMap.get(checkin.user_id);
      
      if (!user) {
        console.log(`⚠️ Utilisateur ${checkin.user_id} non trouvé, skip checkin ${checkin.id}`);
        continue;
      }
      
      // Calculer la distance
      let distance = null;
      let isValid = false;
      let reason = '';
      
      if (user.reference_lat && user.reference_lon && checkin.lat && checkin.lon) {
        distance = calculateDistance(
          user.reference_lat, 
          user.reference_lon, 
          checkin.lat, 
          checkin.lon
        );
        
        const tolerance = user.tolerance_radius_meters || 5000;
        isValid = distance <= tolerance;
        reason = isValid ? 'Dans la zone' : 'Hors de la zone';
      } else {
        isValid = false;
        reason = 'Coordonnées de référence manquantes';
      }
      
      const validation = {
        checkin_id: checkin.id,
        agent_id: checkin.user_id, // Utiliser user_id comme agent_id
        valid: isValid,
        reason: reason,
        distance_m: distance,
        tolerance_m: user.tolerance_radius_meters || 5000,
        reference_lat: user.reference_lat,
        reference_lon: user.reference_lon,
        created_at: checkin.created_at
      };
      
      validations.push(validation);
    }
    
    console.log(`📝 Validations à créer: ${validations.length}`);
    
    if (validations.length === 0) {
      console.log('ℹ️ Aucune validation à créer');
      return;
    }
    
    // 4. Insérer les validations par lots
    const batchSize = 100;
    let totalInserted = 0;
    
    for (let i = 0; i < validations.length; i += batchSize) {
      const batch = validations.slice(i, i + batchSize);
      
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
    
    // 5. Vérifier le résultat
    const { count: finalCount, error: finalError } = await supabase
      .from('checkin_validations')
      .select('*', { count: 'exact', head: true });
    
    if (finalError) {
      console.error('❌ Erreur vérification finale:', finalError);
    } else {
      console.log(`📊 Total final de validations dans la table: ${finalCount}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

generateMissingValidations();
