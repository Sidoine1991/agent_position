/**
 * Script pour synchroniser les données de checkin_validations vers presences
 * 
 * Ce script :
 * 1. Récupère toutes les validations qui n'ont pas encore été synchronisées dans presences
 * 2. Récupère les données checkins associées pour les coordonnées et photos
 * 3. Insère les données dans la table presences
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncValidationsToPresences() {
  console.log('🔄 Synchronisation des validations vers presences...\n');

  try {
    // 1. Récupérer toutes les validations avec leurs checkins associés
    console.log('📊 Récupération des validations...');
    const { data: validations, error: validationsError } = await supabase
      .from('checkin_validations')
      .select(`
        id,
        checkin_id,
        agent_id,
        valid,
        distance_m,
        tolerance_m,
        reference_lat,
        reference_lon,
        planned_start_time,
        planned_end_time,
        created_at,
        checkins (
          id,
          lat,
          lon,
          note,
          photo_path,
          timestamp
        )
      `)
      .order('created_at', { ascending: true });

    if (validationsError) {
      console.error('❌ Erreur lors de la récupération des validations:', validationsError);
      throw validationsError;
    }

    console.log(`✅ ${validations.length} validations trouvées\n`);

    if (validations.length === 0) {
      console.log('ℹ️ Aucune validation à synchroniser');
      return;
    }

    // 2. Récupérer les presences existantes pour éviter les doublons
    const { data: existingPresences, error: existingError } = await supabase
      .from('presences')
      .select('id, user_id, start_time, created_at');

    if (existingError) {
      console.error('❌ Erreur lors de la récupération des presences existantes:', existingError);
      throw existingError;
    }

    // Créer un Set pour vérifier rapidement les doublons
    const existingSet = new Set();
    if (existingPresences && existingPresences.length > 0) {
      existingPresences.forEach(p => {
        const key = `${p.user_id}_${p.start_time}`;
        existingSet.add(key);
      });
      console.log(`📋 ${existingPresences.length} presences déjà existantes\n`);
    }

    // 3. Préparer les données à insérer
    const presencesToInsert = [];
    let skipped = 0;

    for (const validation of validations) {
      const checkin = validation.checkins;
      
      if (!checkin) {
        console.warn(`⚠️ Validation ${validation.id} sans checkin associé, ignorée`);
        skipped++;
        continue;
      }

      const key = `${validation.agent_id}_${validation.planned_start_time || validation.created_at}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      // Fonction pour convertir une heure simple en timestamp complet
      const parseTimeToTimestamp = (time, defaultDate) => {
        if (!time) return null;
        // Si c'est déjà un timestamp complet (ISO), le retourner
        if (time.includes('T') || time.match(/^\d{4}-\d{2}-\d{2}/)) {
          return time;
        }
        // Si c'est juste une heure comme "17:00:00", combiner avec la date du defaultDate
        if (time.match(/^\d{2}:\d{2}:\d{2}$/)) {
          const date = new Date(defaultDate || validation.created_at);
          const [hours, minutes, seconds] = time.split(':');
          date.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds));
          return date.toISOString();
        }
        return null;
      };

      const startTime = parseTimeToTimestamp(validation.planned_start_time, validation.created_at) || validation.created_at;
      const endTime = parseTimeToTimestamp(validation.planned_end_time, startTime);

      const presence = {
        user_id: validation.agent_id,
        start_time: startTime,
        end_time: endTime,
        location_lat: Number(checkin.lat) || null,
        location_lng: Number(checkin.lon) || null,
        location_name: null, // Peut être enrichi plus tard
        notes: checkin.note || null,
        photo_url: checkin.photo_path || null,
        status: 'completed',
        checkin_type: validation.valid ? 'validated' : 'rejected',
        created_at: validation.created_at,
        within_tolerance: validation.valid,
        distance_from_reference_m: validation.distance_m || null,
        tolerance_meters: validation.tolerance_m || null
      };

      presencesToInsert.push(presence);
    }

    console.log(`📋 ${presencesToInsert.length} presences à insérer (${skipped} déjà existantes, ignorées)\n`);

    if (presencesToInsert.length === 0) {
      console.log('ℹ️ Aucune nouvelle présence à synchroniser');
      return;
    }

    // 4. Insérer par lots de 100 pour éviter de surcharger
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < presencesToInsert.length; i += batchSize) {
      const batch = presencesToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('presences')
        .insert(batch)
        .select('id');

      if (error) {
        console.error(`❌ Erreur lors de l'insertion du lot ${Math.floor(i / batchSize) + 1}:`, error);
        // Continuer avec le prochain lot
        continue;
      }

      inserted += data ? data.length : 0;
      console.log(`✅ Lot ${Math.floor(i / batchSize) + 1}: ${data ? data.length : 0} presences insérées`);
    }

    console.log(`\n✅ Synchronisation terminée: ${inserted} presences insérées`);
    
    // 5. Vérification finale
    const { count } = await supabase
      .from('presences')
      .select('id', { count: 'exact', head: true });
    
    console.log(`📊 Total de presences dans la base: ${count}`);

  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation:', error);
    throw error;
  }
}

// Exécuter le script
syncValidationsToPresences()
  .then(() => {
    console.log('\n✅ Synchronisation terminée avec succès');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erreur lors de la synchronisation:', error);
    process.exit(1);
  });

