const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

// Créer le dossier de sauvegarde
const backupDir = path.join(process.cwd(), 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Timestamp pour le nom du fichier
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFileName = `supabase_backup_${timestamp}.json`;

async function backupTable(tableName) {
  try {
    console.log(`📊 Sauvegarde de la table: ${tableName}`);
    
    const { data, error } = await supabaseClient
      .from(tableName)
      .select('*');
    
    if (error) {
      console.error(`❌ Erreur lors de la sauvegarde de ${tableName}:`, error);
      return { table: tableName, error: error.message, data: null };
    }
    
    console.log(`✅ ${tableName}: ${data?.length || 0} enregistrements sauvegardés`);
    return { 
      table: tableName, 
      count: data?.length || 0, 
      data: data,
      timestamp: new Date().toISOString()
    };
    
  } catch (err) {
    console.error(`❌ Erreur inattendue pour ${tableName}:`, err);
    return { table: tableName, error: err.message, data: null };
  }
}

async function getAllTables() {
  try {
    console.log('🔍 Récupération de la liste des tables...');
    
    // Essayer de récupérer les tables via une requête système
    const { data, error } = await supabaseClient
      .rpc('get_tables_info');
    
    if (error) {
      console.warn('⚠️ Impossible de récupérer la liste des tables via RPC, utilisation de la liste manuelle');
      return getKnownTables();
    }
    
    return data?.map(t => t.table_name) || getKnownTables();
    
  } catch (err) {
    console.warn('⚠️ Erreur lors de la récupération des tables, utilisation de la liste manuelle');
    return getKnownTables();
  }
}

function getKnownTables() {
  // Liste des tables connues dans votre projet
  return [
    'users',
    'profiles', 
    'checkins',
    'checkin_validations',
    'missions',
    'attendance_records',
    'projects',
    'departments',
    'communes',
    'arrondissements',
    'villages',
    'roles',
    'permissions',
    'user_roles',
    'sessions',
    'verification_codes',
    'password_resets',
    'audit_logs',
    'settings',
    'notifications',
    'reports',
    'report_presence_view'
  ];
}

async function createBackup() {
  try {
    console.log('🚀 Début de la sauvegarde Supabase...');
    console.log(`📅 Timestamp: ${timestamp}`);
    console.log(`📁 Dossier de sauvegarde: ${backupDir}`);
    
    // Récupérer la liste des tables
    const tables = await getAllTables();
    console.log(`📋 Tables à sauvegarder: ${tables.length}`);
    console.log(`📋 Liste: ${tables.join(', ')}`);
    
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        supabase_url: supabaseUrl,
        total_tables: tables.length,
        backup_version: '1.0'
      },
      tables: {}
    };
    
    let successCount = 0;
    let errorCount = 0;
    
    // Sauvegarder chaque table
    for (const table of tables) {
      const result = await backupTable(table);
      
      if (result.error) {
        backup.tables[table] = {
          error: result.error,
          timestamp: new Date().toISOString()
        };
        errorCount++;
      } else {
        backup.tables[table] = result;
        successCount++;
      }
      
      // Petite pause pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Ajouter les statistiques finales
    backup.metadata.success_count = successCount;
    backup.metadata.error_count = errorCount;
    backup.metadata.total_records = Object.values(backup.tables)
      .reduce((sum, table) => sum + (table.count || 0), 0);
    
    // Sauvegarder le fichier
    const backupPath = path.join(backupDir, backupFileName);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    console.log('\n📊 Résumé de la sauvegarde:');
    console.log(`✅ Tables sauvegardées avec succès: ${successCount}`);
    console.log(`❌ Tables en erreur: ${errorCount}`);
    console.log(`📄 Total d'enregistrements: ${backup.metadata.total_records}`);
    console.log(`💾 Fichier de sauvegarde: ${backupPath}`);
    console.log(`📏 Taille du fichier: ${(fs.statSync(backupPath).size / 1024 / 1024).toFixed(2)} MB`);
    
    // Créer aussi un fichier de résumé
    const summaryPath = path.join(backupDir, `backup_summary_${timestamp}.txt`);
    const summary = `
SAUVEGARDE SUPABASE - ${timestamp}
=====================================

Tables sauvegardées: ${successCount}/${tables.length}
Enregistrements total: ${backup.metadata.total_records}
Fichier principal: ${backupFileName}
Taille: ${(fs.statSync(backupPath).size / 1024 / 1024).toFixed(2)} MB

DÉTAIL PAR TABLE:
${Object.entries(backup.tables).map(([table, data]) => 
  `- ${table}: ${data.error ? '❌ ' + data.error : '✅ ' + (data.count || 0) + ' enregistrements'}`
).join('\n')}

${errorCount > 0 ? `
TABLES EN ERREUR:
${Object.entries(backup.tables)
  .filter(([_, data]) => data.error)
  .map(([table, data]) => `- ${table}: ${data.error}`)
  .join('\n')}
` : ''}

Instructions de restauration:
1. Utiliser le script restore_backup.js
2. Ou importer manuellement via l'interface Supabase
3. Vérifier les contraintes et relations après restauration
`;
    
    fs.writeFileSync(summaryPath, summary);
    console.log(`📋 Résumé créé: ${summaryPath}`);
    
    return backupPath;
    
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde:', error);
    throw error;
  }
}

// Exécuter la sauvegarde
createBackup()
  .then(backupPath => {
    console.log(`\n🎉 Sauvegarde terminée avec succès!`);
    console.log(`📁 Fichier: ${backupPath}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Échec de la sauvegarde:', error);
    process.exit(1);
  });
