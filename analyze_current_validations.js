const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyzeCurrentValidations() {
  console.log('🔍 Analyse des validations actuelles...');
  
  try {
    // 1. Analyser les validations existantes
    console.log('\n📊 Étape 1: Analyse des validations existantes...');
    const { data: validations, error: validationError } = await supabase
      .from('checkin_validations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (validationError) {
      console.error('❌ Erreur:', validationError);
      return;
    }
    
    console.log(`✅ ${validations.length} validations analysées`);
    validations.forEach((v, i) => {
      console.log(`  ${i + 1}. ID: ${v.id}, Agent: ${v.agent_id}, Valid: ${v.valid}, Checkin_ID: ${v.checkin_id}`);
      console.log(`      Date: ${v.created_at}`);
      console.log(`      Distance: ${v.distance_m}m, Référence: ${v.reference_lat}, ${v.reference_lon}`);
      console.log('');
    });
    
    // 2. Vérifier les checkins pour ces agents à ces dates
    console.log('\n📊 Étape 2: Vérifier les checkins correspondants...');
    for (const validation of validations) {
      const validationDate = new Date(validation.created_at).toISOString().split('T')[0];
      const nextDay = new Date(validation.created_at);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      
      console.log(`\n🔍 Validation ${validation.id} - Agent ${validation.agent_id} - ${validationDate}`);
      
      // Chercher les checkins de cet agent ce jour-là
      const { data: agentCheckins, error: checkinError } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', validation.agent_id)
        .gte('created_at', `${validationDate}T00:00:00.000Z`)
        .lt('created_at', `${nextDayStr}T00:00:00.000Z`)
        .order('created_at', { ascending: false });
      
      if (checkinError) {
        console.error(`❌ Erreur checkins agent ${validation.agent_id}:`, checkinError);
      } else {
        console.log(`  📍 ${agentCheckins.length} checkins trouvés pour l'agent ${validation.agent_id}:`);
        agentCheckins.forEach((c, i) => {
          console.log(`    ${i + 1}. ID: ${c.id}, Type: ${c.type}, Heure: ${c.created_at}`);
          console.log(`       Lat: ${c.lat}, Lon: ${c.lon}`);
          
          // Calculer la distance avec la référence de la validation
          if (validation.reference_lat && validation.reference_lon) {
            const distance = calculateDistance(
              validation.reference_lat, validation.reference_lon,
              c.lat, c.lon
            );
            console.log(`       Distance: ${Math.round(distance)}m (vs ${validation.distance_m}m dans validation)`);
          }
        });
      }
    }
    
    // 3. Vérifier s'il y a un script qui a créé ces validations
    console.log('\n📊 Étape 3: Analyser la source des validations...');
    
    // Regarder les dates de création
    const creationDates = validations.map(v => new Date(v.created_at).toISOString().split('T')[0]);
    const uniqueDates = [...new Set(creationDates)];
    console.log(`📅 Dates de création des validations: ${uniqueDates.join(', ')}`);
    
    // Vérifier si elles ont été créées en masse
    const firstValidation = validations[validations.length - 1];
    const lastValidation = validations[0];
    const timeSpan = new Date(lastValidation.created_at) - new Date(firstValidation.created_at);
    console.log(`⏱️ Période de création: ${Math.round(timeSpan / 1000 / 60)} minutes`);
    
    if (timeSpan < 60000) { // Moins d'une minute
      console.log('🤔 Les validations semblent avoir été créées en masse rapidement');
      console.log('   → Probablement par un script de génération');
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

analyzeCurrentValidations();
