const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_ANON_KEY manquant dans .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCheckinsStructure() {
  try {
    console.log('🔍 Vérification de la structure des checkins...');
    
    // 1. Essayer de récupérer quelques checkins pour voir la structure
    const { data: checkins, error: checkinsError } = await supabase
      .from('checkins')
      .select('*')
      .limit(5);
    
    if (checkinsError) {
      console.error('❌ Erreur checkins:', checkinsError);
      return;
    }
    
    console.log(`📊 Checkins trouvés: ${checkins?.length || 0}`);
    
    if (checkins && checkins.length > 0) {
      console.log('🔍 Structure des checkins (colonnes disponibles):');
      const columns = Object.keys(checkins[0]);
      columns.forEach(col => {
        console.log(`  - ${col}`);
      });
      
      console.log('\n🔍 Exemples de checkins:');
      checkins.forEach((c, i) => {
        console.log(`  ${i + 1}.`, c);
      });
    }
    
    // 2. Vérifier les checkins récents avec une autre colonne de date
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    // Essayer avec 'created_at' ou 'date' au lieu de 'timestamp'
    const { data: recentCheckins, error: recentError } = await supabase
      .from('checkins')
      .select('*')
      .gte('created_at', `${yesterday}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`)
      .limit(5);
    
    if (recentError) {
      console.error('❌ Erreur checkins récents avec created_at:', recentError);
      
      // Essayer avec 'date'
      const { data: dateCheckins, error: dateError } = await supabase
        .from('checkins')
        .select('*')
        .gte('date', yesterday)
        .lte('date', today)
        .limit(5);
      
      if (dateError) {
        console.error('❌ Erreur checkins avec date:', dateError);
      } else {
        console.log(`📊 Checkins récents avec date: ${dateCheckins?.length || 0}`);
      }
    } else {
      console.log(`📊 Checkins récents avec created_at: ${recentCheckins?.length || 0}`);
    }
    
    // 3. Vérifier s'il y a des missions récentes
    const { data: recentMissions, error: missionsError } = await supabase
      .from('missions')
      .select('*')
      .gte('date_start', `${yesterday}T00:00:00.000Z`)
      .lte('date_start', `${today}T23:59:59.999Z`)
      .limit(5);
    
    if (missionsError) {
      console.error('❌ Erreur missions récentes:', missionsError);
    } else {
      console.log(`🎯 Missions récentes: ${recentMissions?.length || 0}`);
      
      if (recentMissions && recentMissions.length > 0) {
        console.log('🔍 Exemples de missions récentes:');
        recentMissions.forEach((m, i) => {
          console.log(`  ${i + 1}. ID: ${m.id}, Agent: ${m.agent_id}, Status: ${m.status}, Date: ${m.date_start}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

debugCheckinsStructure();
