#!/usr/bin/env node

/**
 * Script pour créer les tables manquantes dans Supabase
 * Ce script crée spécifiquement les tables presences, projects, user_projects
 * et corrige la table app_settings
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('   SUPABASE_URL:', !!SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_ROLE_KEY);
  process.exit(1);
}

// Initialiser le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createPresencesTable() {
  console.log('📍 Création de la table presences...');
  
  const sql = `
    CREATE TABLE IF NOT EXISTS presences (
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
    
    CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
    CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);
  `;

  try {
    // Utiliser la méthode SQL directe
    const { error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      console.log('⚠️  Erreur avec exec, tentative alternative...');
      // Essayer une approche alternative
      await createTableAlternative('presences', sql);
    } else {
      console.log('✅ Table presences créée avec succès!');
    }
  } catch (err) {
    console.log('⚠️  Erreur lors de la création, tentative alternative...');
    await createTableAlternative('presences', sql);
  }
}

async function createProjectsTable() {
  console.log('📁 Création de la table projects...');
  
  const sql = `
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    const { error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      console.log('⚠️  Erreur avec exec, tentative alternative...');
      await createTableAlternative('projects', sql);
    } else {
      console.log('✅ Table projects créée avec succès!');
    }
  } catch (err) {
    console.log('⚠️  Erreur lors de la création, tentative alternative...');
    await createTableAlternative('projects', sql);
  }
}

async function createUserProjectsTable() {
  console.log('🔗 Création de la table user_projects...');
  
  const sql = `
    CREATE TABLE IF NOT EXISTS user_projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      project_id INTEGER REFERENCES projects(id),
      role VARCHAR(50) DEFAULT 'member',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, project_id)
    );
  `;

  try {
    const { error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      console.log('⚠️  Erreur avec exec, tentative alternative...');
      await createTableAlternative('user_projects', sql);
    } else {
      console.log('✅ Table user_projects créée avec succès!');
    }
  } catch (err) {
    console.log('⚠️  Erreur lors de la création, tentative alternative...');
    await createTableAlternative('user_projects', sql);
  }
}

async function fixAppSettingsTable() {
  console.log('⚙️  Correction de la table app_settings...');
  
  const sql = `
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS description TEXT;
  `;

  try {
    const { error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      console.log('⚠️  Erreur avec exec, tentative alternative...');
      await createTableAlternative('app_settings_fix', sql);
    } else {
      console.log('✅ Table app_settings corrigée avec succès!');
    }
  } catch (err) {
    console.log('⚠️  Erreur lors de la correction, tentative alternative...');
    await createTableAlternative('app_settings_fix', sql);
  }
}

async function createTableAlternative(tableName, sql) {
  console.log(`🔄 Tentative alternative pour ${tableName}...`);
  
  // Diviser le SQL en commandes individuelles
  const commands = sql
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

  console.log(`📝 ${commands.length} commande(s) SQL à exécuter pour ${tableName}`);
  
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    if (command.trim()) {
      console.log(`   ${i + 1}/${commands.length}: ${command.substring(0, 50)}...`);
      
      try {
        // Essayer d'exécuter la commande via une requête simple
        if (command.toLowerCase().includes('create table')) {
          // Pour CREATE TABLE, on peut essayer une approche différente
          console.log(`   ⚠️  Commande CREATE TABLE à exécuter manuellement`);
        } else if (command.toLowerCase().includes('create index')) {
          console.log(`   ⚠️  Commande CREATE INDEX à exécuter manuellement`);
        } else if (command.toLowerCase().includes('alter table')) {
          console.log(`   ⚠️  Commande ALTER TABLE à exécuter manuellement`);
        }
      } catch (err) {
        console.log(`   ❌ Erreur pour la commande ${i + 1}`);
      }
    }
  }
}

async function verifyTables() {
  console.log('\n🔍 Vérification des tables après création...\n');

  const tablesToCheck = ['presences', 'projects', 'user_projects'];

  for (const tableName of tablesToCheck) {
    try {
      console.log(`   Vérification de la table: ${tableName}`);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          console.log(`   ❌ Table ${tableName} toujours manquante`);
        } else {
          console.log(`   ⚠️  Erreur pour ${tableName}: ${error.message}`);
        }
      } else {
        console.log(`   ✅ Table ${tableName} existe maintenant!`);
      }
    } catch (err) {
      console.log(`   ❌ Erreur lors de la vérification de ${tableName}: ${err.message}`);
    }
  }
}

async function generateSQLScript() {
  console.log('\n📄 Génération du script SQL à exécuter manuellement...\n');
  
  const sqlScript = `
-- Script SQL pour créer les tables manquantes dans Supabase
-- Copiez ce script dans le SQL Editor de Supabase et exécutez-le

-- 1. Créer la table presences
CREATE TABLE IF NOT EXISTS presences (
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

-- 2. Créer les index pour presences
CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);

-- 3. Créer la table projects
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Créer la table user_projects
CREATE TABLE IF NOT EXISTS user_projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  project_id INTEGER REFERENCES projects(id),
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, project_id)
);

-- 5. Corriger la table app_settings
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS description TEXT;

-- 6. Insérer des données de test pour projects
INSERT INTO projects (name, description, status) VALUES
('Projet Riz', 'Projet de développement de la culture du riz', 'active'),
('Projet Maïs', 'Projet de développement de la culture du maïs', 'active'),
('Projet Formation', 'Projet de formation des agriculteurs', 'active')
ON CONFLICT DO NOTHING;

-- 7. Vérifier les tables créées
SELECT 'presences' as table_name, COUNT(*) as count FROM presences
UNION ALL
SELECT 'projects' as table_name, COUNT(*) as count FROM projects
UNION ALL
SELECT 'user_projects' as table_name, COUNT(*) as count FROM user_projects;
`;

  console.log('📋 Script SQL généré:');
  console.log('─'.repeat(60));
  console.log(sqlScript);
  console.log('─'.repeat(60));
  
  // Sauvegarder le script dans un fichier
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'fix_tables.sql');
  
  fs.writeFileSync(scriptPath, sqlScript);
  console.log(`\n💾 Script sauvegardé dans: ${scriptPath}`);
}

async function main() {
  console.log('🔧 Correction des tables manquantes dans Supabase\n');
  console.log('═'.repeat(60));

  try {
    // Essayer de créer les tables programmatiquement
    await createPresencesTable();
    await createProjectsTable();
    await createUserProjectsTable();
    await fixAppSettingsTable();

    // Vérifier les résultats
    await verifyTables();

    // Générer le script SQL pour exécution manuelle
    await generateSQLScript();

    console.log('\n💡 Instructions:');
    console.log('─'.repeat(60));
    console.log('1. 📋 Copiez le contenu du fichier database/fix_tables.sql');
    console.log('2. 🌐 Allez sur https://supabase.com/dashboard');
    console.log('3. 🔍 Sélectionnez votre projet: eoamsmtdspedumjmmeui');
    console.log('4. 📝 Allez dans SQL Editor');
    console.log('5. 📋 Collez le script SQL');
    console.log('6. ▶️  Cliquez sur "Run" pour exécuter');
    console.log('7. ✅ Vérifiez que les tables sont créées');
    console.log('8. 🧪 Testez votre application');

    console.log('\n✨ Correction terminée!');

  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { createPresencesTable, createProjectsTable, createUserProjectsTable, fixAppSettingsTable };
