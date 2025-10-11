#!/usr/bin/env node

/**
 * Script pour vérifier l'état actuel de la base de données
 * et identifier exactement ce qui manque
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

async function checkAllTables() {
  console.log('🔍 Vérification complète de toutes les tables...\n');

  const allTables = [
    'users', 'presences', 'missions', 'checkins', 'reports', 
    'absences', 'verification_codes', 'departements', 'communes', 
    'villages', 'projects', 'user_projects', 'planifications', 
    'weekly_planning_summary', 'app_settings'
  ];

  const results = [];

  for (const tableName of allTables) {
    try {
      console.log(`   Vérification: ${tableName}`);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          results.push({ table: tableName, status: '❌ Manquante', error: 'Table does not exist' });
        } else {
          results.push({ table: tableName, status: '⚠️  Erreur', error: error.message });
        }
      } else {
        results.push({ table: tableName, status: '✅ Existe', count: data ? data.length : 0 });
      }
    } catch (err) {
      results.push({ table: tableName, status: '❌ Exception', error: err.message });
    }
  }

  return results;
}

async function checkPresencesDetails() {
  console.log('\n📍 Analyse détaillée de la table presences...\n');

  try {
    // Essayer de récupérer les informations de la table
    const { data, error } = await supabase
      .from('presences')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Erreur détaillée pour presences:');
      console.log(`   Code: ${error.code}`);
      console.log(`   Message: ${error.message}`);
      console.log(`   Details: ${error.details || 'N/A'}`);
      console.log(`   Hint: ${error.hint || 'N/A'}`);
      
      if (error.code === '42P01') {
        console.log('\n💡 La table presences n\'existe pas du tout');
        console.log('   Solution: Exécutez le script de création de table');
      } else if (error.message.includes('schema cache')) {
        console.log('\n💡 Problème de cache de schéma');
        console.log('   Solution: Attendez quelques minutes ou rechargez la page Supabase');
      }
    } else {
      console.log('✅ Table presences accessible!');
      console.log(`   Nombre d\'enregistrements: ${data ? data.length : 0}`);
    }
  } catch (err) {
    console.log('❌ Exception lors de l\'analyse:', err.message);
  }
}

async function checkIndexes() {
  console.log('\n🔍 Vérification des index...\n');

  const indexQueries = [
    {
      name: 'idx_presences_user_id',
      query: `SELECT indexname FROM pg_indexes WHERE tablename = 'presences' AND indexname = 'idx_presences_user_id'`
    },
    {
      name: 'idx_presences_start_time', 
      query: `SELECT indexname FROM pg_indexes WHERE tablename = 'presences' AND indexname = 'idx_presences_start_time'`
    }
  ];

  for (const index of indexQueries) {
    try {
      console.log(`   Vérification de l'index: ${index.name}`);
      
      // Note: Cette requête pourrait ne pas fonctionner avec Supabase
      // mais on peut essayer
      const { data, error } = await supabase
        .rpc('exec', { sql: index.query });

      if (error) {
        console.log(`   ⚠️  Impossible de vérifier l'index ${index.name}: ${error.message}`);
      } else {
        console.log(`   ✅ Index ${index.name}: ${data ? 'existe' : 'n\'existe pas'}`);
      }
    } catch (err) {
      console.log(`   ❌ Erreur pour l'index ${index.name}: ${err.message}`);
    }
  }
}

async function generateFixScript() {
  console.log('\n📄 Génération du script de correction...\n');

  const fixScript = `
-- Script de correction pour la table presences
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier si la table existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'presences') THEN
        -- Créer la table presences
        CREATE TABLE presences (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            location_lat DECIMAL(10, 8),
            location_lng DECIMAL(11, 8),
            location_name VARCHAR(255),
            notes TEXT,
            photo_url VARCHAR(500),
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
            checkin_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        RAISE NOTICE 'Table presences créée avec succès!';
    ELSE
        RAISE NOTICE 'Table presences existe déjà.';
    END IF;
END $$;

-- 2. Créer les index seulement s'ils n'existent pas
CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);

-- 3. Vérifier le résultat
SELECT 
    'presences' as table_name,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'presences') 
        THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as status;

-- 4. Compter les enregistrements
SELECT COUNT(*) as record_count FROM presences;
`;

  console.log('📋 Script de correction généré:');
  console.log('─'.repeat(60));
  console.log(fixScript);
  console.log('─'.repeat(60));

  // Sauvegarder le script
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'fix_presences_table.sql');
  
  fs.writeFileSync(scriptPath, fixScript);
  console.log(`\n💾 Script sauvegardé dans: ${scriptPath}`);
}

async function main() {
  console.log('🔍 Diagnostic complet de l\'état de la base de données\n');
  console.log('═'.repeat(60));

  try {
    // Vérifier toutes les tables
    const tableResults = await checkAllTables();
    
    console.log('\n📊 Résumé des tables:');
    console.log('─'.repeat(60));
    
    const existingTables = tableResults.filter(r => r.status.includes('✅'));
    const missingTables = tableResults.filter(r => r.status.includes('❌'));
    const errorTables = tableResults.filter(r => r.status.includes('⚠️'));

    console.log(`✅ Tables existantes: ${existingTables.length}`);
    console.log(`❌ Tables manquantes: ${missingTables.length}`);
    console.log(`⚠️  Tables avec erreurs: ${errorTables.length}`);

    if (missingTables.length > 0) {
      console.log('\n❌ Tables manquantes:');
      missingTables.forEach(table => {
        console.log(`   - ${table.table}: ${table.error}`);
      });
    }

    if (errorTables.length > 0) {
      console.log('\n⚠️  Tables avec erreurs:');
      errorTables.forEach(table => {
        console.log(`   - ${table.table}: ${table.error}`);
      });
    }

    // Analyse détaillée de presences
    await checkPresencesDetails();

    // Vérifier les index
    await checkIndexes();

    // Générer le script de correction
    await generateFixScript();

    console.log('\n💡 Instructions pour corriger le problème:');
    console.log('─'.repeat(60));
    console.log('1. 📋 Copiez le contenu du fichier database/fix_presences_table.sql');
    console.log('2. 🌐 Allez sur https://supabase.com/dashboard');
    console.log('3. 🔍 Sélectionnez votre projet: eoamsmtdspedumjmmeui');
    console.log('4. 📝 Allez dans SQL Editor');
    console.log('5. 📋 Collez le script SQL');
    console.log('6. ▶️  Cliquez sur "Run" pour exécuter');
    console.log('7. ✅ Vérifiez que la table presences est créée');
    console.log('8. 🧪 Testez votre application');

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

module.exports = { checkAllTables, checkPresencesDetails, checkIndexes };
