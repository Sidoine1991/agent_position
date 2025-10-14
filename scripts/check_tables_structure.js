const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTablesStructure() {
  try {
    console.log('🔍 Vérification des structures des tables...');
    
    // 1. Vérifier checkin_validations
    console.log('\n📊 Table checkin_validations:');
    const { data: validations, error: validationsError } = await supabase
      .from('checkin_validations')
      .select('*')
      .limit(1);
    
    if (validationsError) {
      console.error('❌ Erreur checkin_validations:', validationsError.message);
    } else {
      console.log('✅ checkin_validations accessible');
      if (validations && validations.length > 0) {
        console.log('📋 Colonnes:', Object.keys(validations[0]));
        console.log('📋 Exemple:', validations[0]);
      }
    }
    
    // 2. Vérifier checkins
    console.log('\n📊 Table checkins:');
    const { data: checkins, error: checkinsError } = await supabase
      .from('checkins')
      .select('*')
      .limit(1);
    
    if (checkinsError) {
      console.error('❌ Erreur checkins:', checkinsError.message);
    } else {
      console.log('✅ checkins accessible');
      if (checkins && checkins.length > 0) {
        console.log('📋 Colonnes:', Object.keys(checkins[0]));
        console.log('📋 Exemple:', checkins[0]);
      }
    }
    
    // 3. Vérifier users
    console.log('\n📊 Table users:');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (usersError) {
      console.error('❌ Erreur users:', usersError.message);
    } else {
      console.log('✅ users accessible');
      if (users && users.length > 0) {
        console.log('📋 Colonnes:', Object.keys(users[0]));
        console.log('📋 Exemple:', users[0]);
      }
    }
    
    // 4. Test de la relation checkin_validations -> checkins
    console.log('\n🔗 Test relation checkin_validations -> checkins:');
    const { data: relationTest, error: relationError } = await supabase
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
        created_at,
        checkins(
          id,
          mission_id,
          lat,
          lon,
          timestamp,
          note,
          photo_path
        )
      `)
      .limit(2);
    
    if (relationError) {
      console.error('❌ Erreur relation:', relationError.message);
    } else {
      console.log('✅ Relation fonctionne');
      console.log('📊 Nombre de résultats:', relationTest?.length || 0);
      if (relationTest && relationTest.length > 0) {
        console.log('📋 Exemple relation:', JSON.stringify(relationTest[0], null, 2));
      }
    }
    
    // 5. Test complet de l'API /api/reports/validations
    console.log('\n🔗 Test complet API /api/reports/validations:');
    const { data: fullTest, error: fullError } = await supabase
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
        created_at,
        checkins(
          id,
          mission_id,
          lat,
          lon,
          timestamp,
          note,
          photo_path
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (fullError) {
      console.error('❌ Erreur test complet:', fullError.message);
    } else {
      console.log('✅ Test complet réussi');
      console.log('📊 Nombre de résultats:', fullTest?.length || 0);
      if (fullTest && fullTest.length > 0) {
        console.log('📋 Premier résultat:', JSON.stringify(fullTest[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

checkTablesStructure();
