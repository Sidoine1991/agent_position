#!/usr/bin/env node

/**
 * Script pour diagnostiquer et corriger le problème de colonne agent_id dans planifications
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

async function checkPlanificationsStructure() {
  console.log('🔍 Vérification de la structure de la table planifications...\n');
  
  try {
    // Essayer de récupérer une ligne pour voir les colonnes
    const { data, error } = await supabase
      .from('planifications')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Erreur lors de la vérification:', error.message);
      return [];
    } else {
      if (data.length > 0) {
        console.log('✅ Colonnes existantes dans planifications:');
        const columns = Object.keys(data[0]);
        columns.forEach(col => {
          console.log(`   - ${col}`);
        });
        return columns;
      } else {
        console.log('📋 Table planifications vide - colonnes inconnues');
        return [];
      }
    }
  } catch (err) {
    console.log('❌ Exception lors de la vérification:', err.message);
    return [];
  }
}

async function testAgentIdColumn() {
  console.log('\n🧪 Test de la colonne agent_id...\n');
  
  try {
    // Essayer de sélectionner la colonne agent_id
    const { data, error } = await supabase
      .from('planifications')
      .select('agent_id')
      .limit(1);

    if (error) {
      if (error.message.includes('agent_id')) {
        console.log('❌ Colonne agent_id manquante');
        console.log('📋 Erreur:', error.message);
        return false;
      } else {
        console.log('⚠️  Autre erreur:', error.message);
        return false;
      }
    } else {
      console.log('✅ Colonne agent_id existe');
      return true;
    }
  } catch (err) {
    console.log('❌ Exception lors du test agent_id:', err.message);
    return false;
  }
}

async function testUserIdColumn() {
  console.log('\n🧪 Test de la colonne user_id...\n');
  
  try {
    // Essayer de sélectionner la colonne user_id
    const { data, error } = await supabase
      .from('planifications')
      .select('user_id')
      .limit(1);

    if (error) {
      console.log('❌ Colonne user_id manquante');
      console.log('📋 Erreur:', error.message);
      return false;
    } else {
      console.log('✅ Colonne user_id existe');
      return true;
    }
  } catch (err) {
    console.log('❌ Exception lors du test user_id:', err.message);
    return false;
  }
}

async function checkCodeReferences() {
  console.log('\n🔍 Vérification des références dans le code...\n');
  
  try {
    // Chercher les références à agent_id dans le code
    const fs = require('fs');
    const path = require('path');
    
    const filesToCheck = [
      'server.js',
      'api/index.js',
      'web/planning.js',
      'www/planning.js'
    ];
    
    console.log('📋 Recherche des références à agent_id dans le code:');
    
    for (const file of filesToCheck) {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const agentIdMatches = content.match(/agent_id/g);
        if (agentIdMatches) {
          console.log(`   ${file}: ${agentIdMatches.length} références à agent_id`);
        } else {
          console.log(`   ${file}: aucune référence à agent_id`);
        }
      }
    }
    
  } catch (err) {
    console.log('❌ Exception lors de la vérification du code:', err.message);
  }
}

async function generateFixScript() {
  console.log('\n📄 Génération du script de correction...\n');
  
  const fixScript = `
-- Script de correction pour le problème agent_id dans planifications
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier la structure actuelle de la table planifications
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;

-- 2. Vérifier les contraintes de clé étrangère
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'planifications'
    AND tc.constraint_type = 'FOREIGN KEY';

-- 3. Ajouter la colonne agent_id si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'planifications' 
        AND column_name = 'agent_id'
    ) THEN
        ALTER TABLE planifications ADD COLUMN agent_id INTEGER REFERENCES users(id);
        RAISE NOTICE 'Colonne agent_id ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne agent_id existe déjà';
    END IF;
END $$;

-- 4. Créer un index sur agent_id pour les performances
CREATE INDEX IF NOT EXISTS idx_planifications_agent_id ON planifications(agent_id);

-- 5. Vérifier la structure finale
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;

-- 6. Test d'insertion avec agent_id
-- Remplacez USER_ID par un ID valide de la table users
/*
INSERT INTO planifications (
    user_id,
    agent_id,
    date,
    planned_start_time,
    planned_end_time,
    description_activite,
    project_name
) VALUES (
    USER_ID,  -- Remplacez par un ID valide
    USER_ID,  -- Même ID pour agent_id
    '2025-01-27',
    '08:00:00',
    '17:00:00',
    'Test avec agent_id',
    'Test Project'
);
*/
`;

  console.log('📋 Script de correction généré:');
  console.log('─'.repeat(60));
  console.log(fixScript);
  console.log('─'.repeat(60));

  // Sauvegarder le script
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'fix_planifications_agent_id.sql');
  
  fs.writeFileSync(scriptPath, fixScript);
  console.log(`\n💾 Script sauvegardé dans: ${scriptPath}`);
}

async function testPlanificationWithAgentId() {
  console.log('\n🧪 Test d\'insertion avec agent_id...\n');
  
  try {
    // Récupérer un utilisateur valide
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.log('❌ Aucun utilisateur trouvé pour le test');
      return false;
    }

    const userId = users[0].id;
    console.log(`📋 Test avec l'utilisateur ID: ${userId}`);

    // Essayer d'insérer avec agent_id
    const testData = {
      user_id: userId,
      agent_id: userId,
      date: '2025-01-27',
      planned_start_time: '08:00:00',
      planned_end_time: '17:00:00',
      description_activite: 'Test avec agent_id',
      project_name: 'Test Project'
    };

    const { data, error } = await supabase
      .from('planifications')
      .upsert([testData], { 
        onConflict: 'user_id,date',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      console.log('❌ Erreur lors de l\'insertion avec agent_id:', error.message);
      if (error.message.includes('agent_id')) {
        console.log('💡 La colonne agent_id n\'existe pas encore');
        console.log('💡 Exécutez le script de correction pour l\'ajouter');
      }
      return false;
    } else {
      console.log('✅ Insertion réussie avec agent_id');
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
    console.log('❌ Exception lors du test:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Diagnostic et correction du problème agent_id dans planifications\n');
  console.log('═'.repeat(60));

  try {
    // Vérifier la structure de la table
    const columns = await checkPlanificationsStructure();
    
    // Tester les colonnes
    const agentIdExists = await testAgentIdColumn();
    const userIdExists = await testUserIdColumn();
    
    // Vérifier les références dans le code
    await checkCodeReferences();
    
    // Tester l'insertion
    const insertOk = await testPlanificationWithAgentId();
    
    console.log('\n📊 Résumé du diagnostic:');
    console.log('─'.repeat(60));
    console.log(`Colonne user_id: ${userIdExists ? '✅ Existe' : '❌ Manquante'}`);
    console.log(`Colonne agent_id: ${agentIdExists ? '✅ Existe' : '❌ Manquante'}`);
    console.log(`Insertion test: ${insertOk ? '✅ Réussie' : '❌ Échouée'}`);
    
    if (!agentIdExists) {
      console.log('\n💡 Problème identifié:');
      console.log('   - La colonne agent_id manque dans la table planifications');
      console.log('   - Le code fait référence à cette colonne');
      console.log('   - Il faut ajouter cette colonne à la table');
    }

    // Générer le script de correction
    await generateFixScript();

    console.log('\n💡 Instructions pour résoudre le problème:');
    console.log('─'.repeat(60));
    console.log('1. 📋 Copiez le contenu du fichier database/fix_planifications_agent_id.sql');
    console.log('2. 🌐 Allez sur https://supabase.com/dashboard');
    console.log('3. 🔍 Sélectionnez votre projet: eoamsmtdspedumjmmeui');
    console.log('4. 📝 Allez dans SQL Editor');
    console.log('5. 📋 Collez le script SQL');
    console.log('6. ▶️  Cliquez sur "Run" pour exécuter');
    console.log('7. ✅ Vérifiez que la colonne agent_id est ajoutée');
    console.log('8. 🧪 Testez l\'enregistrement d\'une planification');

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

module.exports = { 
  checkPlanificationsStructure, 
  testAgentIdColumn, 
  testUserIdColumn, 
  testPlanificationWithAgentId 
};
