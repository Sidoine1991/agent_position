const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugValidationJoin() {
  console.log('🔍 Débogage de la jointure validation -> checkin...');
  
  try {
    // 1. Récupérer quelques validations récentes
    console.log('\n📊 Étape 1: Récupérer les validations récentes...');
    const { data: validations, error: validationError } = await supabase
      .from('checkin_validations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (validationError) {
      console.error('❌ Erreur validations:', validationError);
      return;
    }
    
    console.log(`✅ ${validations.length} validations trouvées`);
    validations.forEach((v, i) => {
      console.log(`  ${i + 1}. ID: ${v.id}, Checkin_ID: ${v.checkin_id}, Agent: ${v.agent_id}, Valid: ${v.valid}`);
    });
    
    // 2. Vérifier si les checkins correspondants existent
    console.log('\n📊 Étape 2: Vérifier les checkins correspondants...');
    for (const validation of validations) {
      if (validation.checkin_id) {
        const { data: checkin, error: checkinError } = await supabase
          .from('checkins')
          .select('*')
          .eq('id', validation.checkin_id)
          .single();
        
        if (checkinError) {
          console.log(`❌ Checkin ${validation.checkin_id} non trouvé pour validation ${validation.id}`);
        } else {
          console.log(`✅ Checkin ${validation.checkin_id} trouvé: User ${checkin.user_id}, Type ${checkin.type}`);
        }
      } else {
        console.log(`⚠️ Validation ${validation.id} n'a pas de checkin_id`);
      }
    }
    
    // 3. Tester la jointure avec checkins!left
    console.log('\n📊 Étape 3: Tester la jointure checkins!left...');
    const { data: joinedData, error: joinError } = await supabase
      .from('checkin_validations')
      .select(`
        id,
        checkin_id,
        agent_id,
        valid,
        created_at,
        checkins!left(
          id,
          mission_id,
          user_id,
          lat,
          lon,
          start_time,
          note,
          photo_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (joinError) {
      console.error('❌ Erreur jointure:', joinError);
      return;
    }
    
    console.log(`✅ Jointure réussie: ${joinedData.length} résultats`);
    joinedData.forEach((item, i) => {
      console.log(`  ${i + 1}. Validation ID: ${item.id}`);
      console.log(`      Checkin_ID: ${item.checkin_id}`);
      console.log(`      Agent: ${item.agent_id}`);
      console.log(`      Checkin jointure: ${item.checkins ? '✅' : '❌'}`);
      if (item.checkins) {
        console.log(`      Checkin data: User ${item.checkins.user_id}, Lat ${item.checkins.lat}`);
      } else {
        console.log(`      Checkin data: null`);
      }
      console.log('');
    });
    
    // 4. Tester avec checkins!inner (pour voir la différence)
    console.log('\n📊 Étape 4: Tester avec checkins!inner...');
    const { data: innerData, error: innerError } = await supabase
      .from('checkin_validations')
      .select(`
        id,
        checkin_id,
        agent_id,
        valid,
        created_at,
        checkins!inner(
          id,
          mission_id,
          user_id,
          lat,
          lon,
          start_time,
          note,
          photo_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (innerError) {
      console.error('❌ Erreur jointure inner:', innerError);
    } else {
      console.log(`✅ Jointure inner réussie: ${innerData.length} résultats`);
      innerData.forEach((item, i) => {
        console.log(`  ${i + 1}. Validation ID: ${item.id}, Checkin ID: ${item.checkins.id}`);
      });
    }
    
    // 5. Vérifier les clés étrangères
    console.log('\n📊 Étape 5: Vérifier les clés étrangères...');
    const { data: foreignKeys, error: fkError } = await supabase
      .from('checkin_validations')
      .select('checkin_id, id')
      .not('checkin_id', 'is', null)
      .limit(10);
    
    if (fkError) {
      console.error('❌ Erreur clés étrangères:', fkError);
    } else {
      console.log(`✅ ${foreignKeys.length} validations avec checkin_id non null`);
      
      // Vérifier combien de ces checkins existent vraiment
      let existingCount = 0;
      for (const fk of foreignKeys) {
        const { data: checkin } = await supabase
          .from('checkins')
          .select('id')
          .eq('id', fk.checkin_id)
          .single();
        
        if (checkin) existingCount++;
      }
      
      console.log(`📊 ${existingCount}/${foreignKeys.length} checkins existent vraiment`);
      if (existingCount < foreignKeys.length) {
        console.log('⚠️ Certaines validations pointent vers des checkins qui n\'existent plus!');
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

debugValidationJoin();
