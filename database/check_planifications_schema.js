#!/usr/bin/env node

/**
 * Script pour vérifier le schéma de la table planifications
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

async function checkPlanificationsSchema() {
  console.log('🔍 Vérification du schéma de la table planifications...\n');
  
  try {
    // Récupérer la structure de la table
    const { data, error } = await supabase
      .from('planifications')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Erreur:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('📋 Colonnes de la table planifications:');
      Object.keys(data[0]).forEach(column => {
        console.log(`   - ${column}`);
      });
    } else {
      console.log('⚠️  Aucune donnée dans la table planifications');
    }

    // Vérifier si la colonne notes existe
    const hasNotes = data && data.length > 0 && 'notes' in data[0];
    console.log(`\n📊 Colonne 'notes': ${hasNotes ? 'EXISTE' : 'N\'EXISTE PAS'}`);

    // Vérifier les colonnes importantes
    const importantColumns = ['id', 'user_id', 'agent_id', 'date', 'planned_start_time', 'planned_end_time', 'description_activite', 'project_name'];
    console.log('\n📊 Vérification des colonnes importantes:');
    importantColumns.forEach(column => {
      const exists = data && data.length > 0 && column in data[0];
      console.log(`   ${exists ? '✅' : '❌'} ${column}`);
    });

    return { hasNotes, columns: data && data.length > 0 ? Object.keys(data[0]) : [] };
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return { hasNotes: false, columns: [] };
  }
}

async function generateFixScript() {
  console.log('\n📄 Génération du script de correction...\n');
  
  const fixScript = `
-- Script pour corriger la table planifications
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier la structure actuelle
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;

-- 2. Ajouter la colonne notes si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='planifications' AND column_name='notes') THEN
        ALTER TABLE planifications ADD COLUMN notes TEXT;
        RAISE NOTICE 'Colonne notes ajoutée à la table planifications.';
    ELSE
        RAISE NOTICE 'Colonne notes existe déjà dans la table planifications.';
    END IF;
END $$;

-- 3. Vérifier la structure finale
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;
`;

  console.log('📋 Script de correction:');
  console.log('─'.repeat(60));
  console.log(fixScript);
  console.log('─'.repeat(60));

  // Sauvegarder le script
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'fix_planifications_notes_column.sql');
  
  fs.writeFileSync(scriptPath, fixScript);
  console.log(`\n💾 Script sauvegardé dans: ${scriptPath}`);
}

async function main() {
  console.log('🔍 Diagnostic du schéma planifications\n');
  console.log('═'.repeat(60));

  try {
    // Vérifier le schéma
    const { hasNotes, columns } = await checkPlanificationsSchema();
    
    // Générer le script de correction
    await generateFixScript();

    console.log('\n📊 Résumé du diagnostic:');
    console.log('─'.repeat(60));
    console.log(`Colonne 'notes': ${hasNotes ? 'EXISTE' : 'N\'EXISTE PAS'}`);
    console.log(`Colonnes totales: ${columns.length}`);

    if (!hasNotes) {
      console.log('\n💡 Solution:');
      console.log('─'.repeat(60));
      console.log('1. 📝 Exécutez le script database/fix_planifications_notes_column.sql dans Supabase');
      console.log('2. ✅ La colonne notes sera ajoutée à la table planifications');
      console.log('3. 🔄 L\'erreur d\'enregistrement sera résolue');
    } else {
      console.log('\n✅ La colonne notes existe déjà');
      console.log('🔍 L\'erreur peut venir d\'un autre problème');
    }

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

module.exports = { checkPlanificationsSchema, generateFixScript };
