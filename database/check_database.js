#!/usr/bin/env node

/**
 * Script de diagnostic de la base de données Supabase
 * Ce script vérifie l'état actuel de la base de données et identifie les problèmes
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('   SUPABASE_URL:', !!SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_ROLE_KEY);
  console.error('\n💡 Créez un fichier .env avec ces variables ou définissez-les dans votre environnement.');
  process.exit(1);
}

// Initialiser le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkTables() {
  console.log('🔍 Vérification des tables dans Supabase...\n');

  const tablesToCheck = [
    'users', 'presences', 'missions', 'checkins', 'reports', 
    'absences', 'verification_codes', 'departements', 'communes', 
    'villages', 'projects', 'user_projects', 'planifications', 
    'weekly_planning_summary', 'app_settings'
  ];

  const results = [];

  for (const tableName of tablesToCheck) {
    try {
      console.log(`   Vérification de la table: ${tableName}`);
      
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
      results.push({ table: tableName, status: '❌ Erreur', error: err.message });
    }
  }

  return results;
}

async function checkUsers() {
  console.log('\n👥 Vérification des utilisateurs...\n');

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, is_verified, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.log('❌ Erreur lors de la récupération des utilisateurs:', error.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️  Aucun utilisateur trouvé dans la base de données');
      console.log('💡 Créez un utilisateur admin via l\'interface d\'inscription');
      return;
    }

    console.log(`📊 ${users.length} utilisateur(s) trouvé(s):`);
    console.log('─'.repeat(80));
    
    users.forEach(user => {
      const verified = user.is_verified ? '✅' : '❌';
      console.log(`${verified} ${user.name} (${user.email}) - ${user.role} - ${user.created_at}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la vérification des utilisateurs:', error.message);
  }
}

async function checkPresences() {
  console.log('\n📍 Vérification des présences...\n');

  try {
    const { data: presences, error } = await supabase
      .from('presences')
      .select('id, user_id, start_time, end_time, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Table presences manquante - c\'est la cause de votre erreur!');
        console.log('💡 Exécutez le script de migration pour créer cette table');
      } else {
        console.log('❌ Erreur lors de la récupération des présences:', error.message);
      }
      return;
    }

    if (!presences || presences.length === 0) {
      console.log('⚠️  Aucune présence trouvée dans la base de données');
      return;
    }

    console.log(`📊 ${presences.length} présence(s) trouvée(s):`);
    console.log('─'.repeat(80));
    
    presences.forEach(presence => {
      const status = presence.status || 'unknown';
      const endTime = presence.end_time ? ` - ${presence.end_time}` : ' (en cours)';
      console.log(`${presence.id}: ${presence.start_time}${endTime} - ${status}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la vérification des présences:', error.message);
  }
}

async function checkAppSettings() {
  console.log('\n⚙️  Vérification des paramètres de l\'application...\n');

  try {
    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('key, value, description')
      .order('key');

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Table app_settings manquante');
        console.log('💡 Exécutez le script de migration pour créer cette table');
      } else {
        console.log('❌ Erreur lors de la récupération des paramètres:', error.message);
      }
      return;
    }

    if (!settings || settings.length === 0) {
      console.log('⚠️  Aucun paramètre trouvé dans la base de données');
      return;
    }

    console.log(`📊 ${settings.length} paramètre(s) trouvé(s):`);
    console.log('─'.repeat(80));
    
    settings.forEach(setting => {
      console.log(`${setting.key}: ${setting.value} - ${setting.description || 'N/A'}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la vérification des paramètres:', error.message);
  }
}

async function generateDiagnosticReport() {
  console.log('🏥 Diagnostic de la base de données Presence CCRB\n');
  console.log('═'.repeat(60));

  // Vérifier les tables
  const tableResults = await checkTables();
  
  console.log('\n📋 Résumé des tables:');
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

  // Vérifier les données
  await checkUsers();
  await checkPresences();
  await checkAppSettings();

  // Recommandations
  console.log('\n💡 Recommandations:');
  console.log('─'.repeat(60));
  
  if (missingTables.length > 0) {
    console.log('1. 🔧 Exécutez le script de migration:');
    console.log('   node database/setup_database.js');
    console.log('   ou');
    console.log('   Copiez le contenu de database/supabase_migration.sql dans le SQL Editor de Supabase');
  }

  if (existingTables.length > 0) {
    console.log('2. ✅ Certaines tables existent déjà - la migration est partielle');
  }

  console.log('3. 🧪 Testez l\'application après la migration');
  console.log('4. 👤 Créez un utilisateur admin si nécessaire');

  console.log('\n✨ Diagnostic terminé!');
}

async function main() {
  try {
    await generateDiagnosticReport();
  } catch (error) {
    console.error('❌ Erreur fatale lors du diagnostic:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { checkTables, checkUsers, checkPresences, checkAppSettings };
