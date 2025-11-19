const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkValidationHistory() {
  console.log('🔍 Vérification de l\'historique des validations...');
  
  try {
    // 1. Compter les validations avec et sans checkin_id
    console.log('\n📊 Étape 1: Compter les validations...');
    const { count: totalCount } = await supabase
      .from('checkin_validations')
      .select('*', { count: 'exact', head: true });
    
    const { count: withCheckinId } = await supabase
      .from('checkin_validations')
      .select('*', { count: 'exact', head: true })
      .not('checkin_id', 'is', null);
    
    const { count: withoutCheckinId } = await supabase
      .from('checkin_validations')
      .select('*', { count: 'exact', head: true })
      .is('checkin_id', null);
    
    console.log(`📊 Total validations: ${totalCount}`);
    console.log(`📊 Avec checkin_id: ${withCheckinId}`);
    console.log(`📊 Sans checkin_id: ${withoutCheckinId}`);
    
    // 2. Chercher des validations avec checkin_id
    console.log('\n📊 Étape 2: Chercher des validations avec checkin_id...');
    const { data: withCheckin, error: withError } = await supabase
      .from('checkin_validations')
      .select(`
        id,
        checkin_id,
        agent_id,
        valid,
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
      .not('checkin_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (withError) {
      console.error('❌ Erreur:', withError);
    } else {
      console.log(`✅ ${withCheckin.length} validations avec checkin_id trouvées`);
      withCheckin.forEach((v, i) => {
        console.log(`  ${i + 1}. ID: ${v.id}, Checkin: ${v.checkin_id}, Checkin data: ${v.checkins ? '✅' : '❌'}`);
      });
    }
    
    // 3. Vérifier les checkins récents
    console.log('\n📊 Étape 3: Vérifier les checkins récents...');
    const { data: recentCheckins, error: checkinsError } = await supabase
      .from('checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (checkinsError) {
      console.error('❌ Erreur checkins:', checkinsError);
    } else {
      console.log(`✅ ${recentCheckins.length} checkins récents`);
      recentCheckins.forEach((c, i) => {
        console.log(`  ${i + 1}. ID: ${c.id}, User: ${c.user_id}, Type: ${c.type}, Date: ${c.created_at}`);
      });
    }
    
    // 4. Vérifier s'il y a une relation inversée dans les checkins
    console.log('\n📊 Étape 4: Vérifier si les checkins ont des validations...');
    const { data: checkinsWithValidations, error: checkValidError } = await supabase
      .from('checkins')
      .select(`
        id,
        user_id,
        created_at,
        checkin_validations!left(
          id,
          agent_id,
          valid,
          created_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (checkValidError) {
      console.error('❌ Erreur checkins avec validations:', checkValidError);
    } else {
      console.log(`✅ ${checkinsWithValidations.length} checkins avec relations vérifiées`);
      checkinsWithValidations.forEach((c, i) => {
        console.log(`  ${i + 1}. Checkin ID: ${c.id}, Validations: ${c.checkin_validations?.length || 0}`);
      });
    }
    
    // 5. Diagnostiquer le problème
    console.log('\n🔍 DIAGNOSTIC:');
    if (withoutCheckinId > 0) {
      console.log('⚠️ Des validations existent sans checkin_id');
      console.log('   → Cela peut indiquer un problème dans la création des validations');
      console.log('   → Ou les checkins ont été supprimés mais pas les validations');
    }
    
    if (withCheckinId === 0) {
      console.log('❌ AUCUNE validation n\'a de checkin_id!');
      console.log('   → C\'est pourquoi checkin_found=false dans les rapports');
      console.log('   → Il faut corriger la création des validations');
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

checkValidationHistory();
