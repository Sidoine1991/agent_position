// Script pour diagnostiquer et corriger la contrainte de la table planifications
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosePlanificationsTable() {
  try {
    console.log('🔍 Diagnostic de la table planifications...');
    
    // 1. Vérifier la structure de la table
    console.log('\n📋 Structure de la table planifications:');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'planifications')
      .eq('table_schema', 'public');
    
    if (columnsError) {
      console.error('❌ Erreur lors de la récupération des colonnes:', columnsError);
      return;
    }
    
    console.log('Colonnes trouvées:');
    columns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // 2. Vérifier les contraintes existantes
    console.log('\n📋 Contraintes existantes:');
    const { data: constraints, error: constraintsError } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name, constraint_type')
      .eq('table_name', 'planifications')
      .eq('table_schema', 'public');
    
    if (constraintsError) {
      console.error('❌ Erreur lors de la récupération des contraintes:', constraintsError);
    } else {
      console.log('Contraintes trouvées:');
      constraints.forEach(constraint => {
        console.log(`   ${constraint.constraint_name}: ${constraint.constraint_type}`);
      });
    }
    
    // 3. Vérifier les index existants
    console.log('\n📋 Index existants:');
    const { data: indexes, error: indexesError } = await supabase
      .from('pg_indexes')
      .select('indexname, indexdef')
      .eq('tablename', 'planifications')
      .eq('schemaname', 'public');
    
    if (indexesError) {
      console.error('❌ Erreur lors de la récupération des index:', indexesError);
    } else {
      console.log('Index trouvés:');
      indexes.forEach(index => {
        console.log(`   ${index.indexname}: ${index.indexdef}`);
      });
    }
    
    // 4. Vérifier les données existantes
    console.log('\n📋 Données existantes:');
    const { data: planifications, error: dataError } = await supabase
      .from('planifications')
      .select('*')
      .limit(5);
    
    if (dataError) {
      console.error('❌ Erreur lors de la récupération des données:', dataError);
    } else {
      console.log(`Nombre d'enregistrements: ${planifications.length}`);
      if (planifications.length > 0) {
        console.log('Exemple d\'enregistrement:');
        console.log(JSON.stringify(planifications[0], null, 2));
      }
    }
    
    // 5. Vérifier s'il y a des doublons agent_id,date
    console.log('\n📋 Vérification des doublons (agent_id, date):');
    const { data: duplicates, error: duplicatesError } = await supabase
      .rpc('check_duplicates_planifications');
    
    if (duplicatesError) {
      console.log('⚠️  Fonction check_duplicates_planifications non disponible');
      
      // Alternative: vérifier manuellement
      const { data: allPlanifications, error: allError } = await supabase
        .from('planifications')
        .select('agent_id, date');
      
      if (!allError && allPlanifications) {
        const seen = new Set();
        const duplicates = [];
        
        allPlanifications.forEach(plan => {
          const key = `${plan.agent_id}_${plan.date}`;
          if (seen.has(key)) {
            duplicates.push(plan);
          } else {
            seen.add(key);
          }
        });
        
        if (duplicates.length > 0) {
          console.log(`❌ ${duplicates.length} doublons trouvés:`, duplicates);
        } else {
          console.log('✅ Aucun doublon trouvé');
        }
      }
    } else {
      console.log('Doublons trouvés:', duplicates);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  }
}

// Fonction pour créer la contrainte unique
async function createUniqueConstraint() {
  try {
    console.log('\n🔧 Création de la contrainte unique...');
    
    // Créer la contrainte unique sur (agent_id, date)
    const { error } = await supabase
      .rpc('exec_sql', {
        sql: `
          -- Créer la contrainte unique sur (agent_id, date)
          ALTER TABLE planifications 
          ADD CONSTRAINT planifications_agent_date_unique 
          UNIQUE (agent_id, date);
        `
      });
    
    if (error) {
      console.error('❌ Erreur lors de la création de la contrainte:', error);
      
      // Alternative: utiliser une requête directe
      console.log('🔄 Tentative alternative...');
      const { error: altError } = await supabase
        .from('planifications')
        .select('*')
        .limit(1);
      
      if (altError) {
        console.error('❌ Impossible d\'accéder à la table:', altError);
        return false;
      }
      
      console.log('⚠️  Contrainte unique non créée automatiquement');
      console.log('💡 Exécutez manuellement dans Supabase SQL Editor:');
      console.log(`
        ALTER TABLE planifications 
        ADD CONSTRAINT planifications_agent_date_unique 
        UNIQUE (agent_id, date);
      `);
      return false;
    }
    
    console.log('✅ Contrainte unique créée avec succès!');
    return true;
    
  } catch (error) {
    console.error('❌ Erreur lors de la création de la contrainte:', error);
    return false;
  }
}

// Fonction pour tester l'upsert
async function testUpsert() {
  try {
    console.log('\n🧪 Test de l\'upsert...');
    
    // Récupérer un utilisateur existant
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ Aucun utilisateur trouvé pour le test');
      return false;
    }
    
    const userId = users[0].id;
    const testDate = new Date().toISOString().split('T')[0];
    
    console.log(`📋 Test avec user_id: ${userId}, date: ${testDate}`);
    
    // Test d'insertion
    const payload = {
      user_id: userId,
      agent_id: userId,
      date: testDate,
      planned_start_time: '08:00:00',
      planned_end_time: '17:00:00',
      description_activite: 'Test de contrainte unique',
      project_name: 'Test Project',
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('planifications')
      .upsert(payload, { onConflict: 'agent_id,date' });
    
    if (error) {
      console.error('❌ Erreur lors de l\'upsert:', error);
      return false;
    }
    
    console.log('✅ Upsert réussi!');
    console.log('📋 Données insérées/mises à jour:', data);
    
    // Test de mise à jour (même agent_id, date)
    const updatePayload = {
      ...payload,
      description_activite: 'Test de mise à jour - contrainte unique'
    };
    
    const { data: updateData, error: updateError } = await supabase
      .from('planifications')
      .upsert(updatePayload, { onConflict: 'agent_id,date' });
    
    if (updateError) {
      console.error('❌ Erreur lors de la mise à jour:', updateError);
      return false;
    }
    
    console.log('✅ Mise à jour réussie!');
    console.log('📋 Données mises à jour:', updateData);
    
    return true;
    
  } catch (error) {
    console.error('❌ Erreur lors du test d\'upsert:', error);
    return false;
  }
}

// Fonction principale
async function main() {
  console.log('🚀 Diagnostic et correction de la table planifications...');
  
  try {
    // 1. Diagnostic
    await diagnosePlanificationsTable();
    
    // 2. Créer la contrainte unique
    const constraintCreated = await createUniqueConstraint();
    
    // 3. Tester l'upsert
    if (constraintCreated) {
      await testUpsert();
    }
    
    console.log('\n📊 Résumé:');
    console.log('─'.repeat(50));
    console.log('✅ Diagnostic terminé');
    if (constraintCreated) {
      console.log('✅ Contrainte unique créée');
      console.log('✅ Upsert testé');
    } else {
      console.log('⚠️  Contrainte unique à créer manuellement');
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  }
}

// Exécuter le script
main();
