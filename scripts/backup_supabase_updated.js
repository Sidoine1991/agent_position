const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

// Tables découvertes automatiquement
const DISCOVERED_TABLES = [
  "users",
  "profiles",
  "checkins",
  "checkin_validations",
  "missions",
  "communes",
  "arrondissements",
  "villages",
  "verification_codes",
  "notifications",
  "reports",
  "report_presence_view",
  "departements",
  "presences",
  "absences",
  "custom_reports",
  "activity_logs",
  "app_settings"
];

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

async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = path.join(process.cwd(), 'backups');
    const backupFileName = `supabase_backup_${timestamp}.json`;
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    console.log('🚀 Début de la sauvegarde Supabase...');
    console.log(`📋 Tables à sauvegarder: ${DISCOVERED_TABLES.length}`);
    
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        supabase_url: supabaseUrl,
        total_tables: DISCOVERED_TABLES.length,
        backup_version: '2.0',
        discovered_tables: true
      },
      tables: {}
    };
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const table of DISCOVERED_TABLES) {
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
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    backup.metadata.success_count = successCount;
    backup.metadata.error_count = errorCount;
    backup.metadata.total_records = Object.values(backup.tables)
      .reduce((sum, table) => sum + (table.count || 0), 0);
    
    const backupPath = path.join(backupDir, backupFileName);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    console.log('\n📊 Résumé de la sauvegarde:');
    console.log(`✅ Tables sauvegardées avec succès: ${successCount}`);
    console.log(`❌ Tables en erreur: ${errorCount}`);
    console.log(`📄 Total d'enregistrements: ${backup.metadata.total_records}`);
    console.log(`💾 Fichier de sauvegarde: ${backupPath}`);
    
    return backupPath;
    
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde:', error);
    throw error;
  }
}

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