#!/usr/bin/env node

/**
 * Script de diagnostic pour les erreurs de planification
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

// Initialiser le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkUsers() {
  console.log('👥 Vérification des utilisateurs existants...\n');
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role')
      .order('id');

    if (error) {
      console.log('❌ Erreur:', error.message);
      return [];
    } else {
      console.log('✅ Utilisateurs trouvés:');
      data.forEach(user => {
        console.log(`   ID: ${user.id} - ${user.name} (${user.email}) - ${user.role}`);
      });
      
      if (data.length > 0) {
        console.log(`\n💡 Premier utilisateur valide: ID ${data[0].id}`);
      }
      
      return data;
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return [];
  }
}

async function checkPlanificationsTable() {
  console.log('\n📋 Vérification de la table planifications...\n');
  
  try {
    const { data, error } = await supabase
      .from('planifications')
      .select('*')
      .limit(5);

    if (error) {
      console.log('❌ Erreur:', error.message);
      return false;
    } else {
      console.log('✅ Table planifications accessible');
      console.log(`📊 Nombre d'enregistrements: ${data.length}`);
      
      if (data.length > 0) {
        console.log('📋 Structure des données:');
        console.log('   Colonnes:', Object.keys(data[0]));
        console.log('   Exemple:', data[0]);
      }
      
      return true;
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return false;
  }
}

async function testPlanificationInsert(userId) {
  console.log(`\n🧪 Test d'insertion d'une planification pour l'utilisateur ${userId}...\n`);
  
  const testData = {
    user_id: userId,
    date: '2025-01-27',
    planned_start_time: '08:00:00',
    planned_end_time: '17:00:00',
    description_activite: 'Test de planification',
    project_name: 'Test Project',
    resultat_journee: null,
    observations: null
  };

  try {
    const { data, error } = await supabase
      .from('planifications')
      .upsert([testData], { 
        onConflict: 'user_id,date',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      console.log('❌ Erreur lors de l\'insertion:', error.message);
      console.log('📋 Code d\'erreur:', error.code);
      console.log('📋 Détails:', error.details);
      console.log('📋 Hint:', error.hint);
      
      if (error.code === '23503') {
        console.log('\n💡 Erreur de clé étrangère:');
        console.log('   - L\'utilisateur avec cet ID n\'existe pas');
        console.log('   - Vérifiez que l\'utilisateur est connecté');
        console.log('   - Vérifiez que le token JWT contient un ID valide');
      }
      
      return false;
    } else {
      console.log('✅ Planification insérée avec succès');
      console.log('📊 Données insérées:', data);
      
      // Nettoyer le test
      await supabase
        .from('planifications')
        .delete()
        .eq('id', data.id);
      console.log('🧹 Données de test supprimées');
      
      return true;
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return false;
  }
}

async function checkTableStructure() {
  console.log('\n🔍 Vérification de la structure de la table planifications...\n');
  
  try {
    // Essayer de récupérer les informations de la table
    const { data, error } = await supabase
      .from('planifications')
      .select('*')
      .limit(0);

    if (error) {
      console.log('❌ Erreur lors de la vérification de la structure:', error.message);
      return false;
    } else {
      console.log('✅ Structure de la table accessible');
      return true;
    }
  } catch (err) {
    console.log('❌ Exception lors de la vérification:', err.message);
    return false;
  }
}

async function generateFixScript() {
  console.log('\n📄 Génération du script de correction...\n');
  
  const fixScript = `
-- Script de correction pour les problèmes de planification
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier la structure de la table planifications
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;

-- 2. Vérifier les contraintes de clé étrangère
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'planifications';

-- 3. Vérifier les utilisateurs existants
SELECT id, email, name, role FROM users ORDER BY id LIMIT 10;

-- 4. Vérifier les planifications existantes
SELECT * FROM planifications ORDER BY created_at DESC LIMIT 5;
`;

  console.log('📋 Script de diagnostic généré:');
  console.log('─'.repeat(60));
  console.log(fixScript);
  console.log('─'.repeat(60));

  // Sauvegarder le script
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'diagnose_planification.sql');
  
  fs.writeFileSync(scriptPath, fixScript);
  console.log(`\n💾 Script sauvegardé dans: ${scriptPath}`);
}

async function main() {
  console.log('🔍 Diagnostic des erreurs de planification\n');
  console.log('═'.repeat(60));

  try {
    // Vérifier les utilisateurs
    const users = await checkUsers();
    
    // Vérifier la table planifications
    const tableOk = await checkPlanificationsTable();
    
    // Vérifier la structure
    const structureOk = await checkTableStructure();
    
    if (users.length > 0 && tableOk && structureOk) {
      // Tester l'insertion avec le premier utilisateur
      const firstUserId = users[0].id;
      const insertOk = await testPlanificationInsert(firstUserId);
      
      if (insertOk) {
        console.log('\n🎉 Le système de planification fonctionne correctement!');
        console.log('💡 Le problème pourrait être lié à l\'authentification ou à l\'ID utilisateur');
      } else {
        console.log('\n⚠️  Problème détecté lors de l\'insertion');
      }
    } else {
      console.log('\n⚠️  Problèmes détectés avec la base de données');
    }

    // Générer le script de diagnostic
    await generateFixScript();

    console.log('\n💡 Instructions pour résoudre le problème:');
    console.log('─'.repeat(60));
    console.log('1. 📋 Exécutez le script database/diagnose_planification.sql dans Supabase');
    console.log('2. 🔍 Vérifiez que l\'utilisateur est bien connecté');
    console.log('3. 🔍 Vérifiez que le token JWT contient un ID utilisateur valide');
    console.log('4. 🔍 Vérifiez que l\'utilisateur existe dans la table users');
    console.log('5. 🧪 Testez l\'enregistrement d\'une planification');

    console.log('\n✨ Diagnostic terminé!');

  } catch (error) {
    console.error('❌ Erreur fatale lors du diagnostic:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { checkUsers, checkPlanificationsTable, testPlanificationInsert };
