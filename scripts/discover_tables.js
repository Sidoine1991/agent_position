const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

async function discoverTables() {
  try {
    console.log('🔍 Découverte des tables Supabase...');
    
    // Essayer différentes méthodes pour découvrir les tables
    
    // Méthode 1: Via une requête système PostgreSQL
    try {
      const { data, error } = await supabaseClient
        .rpc('get_tables_info');
      
      if (!error && data) {
        console.log('✅ Tables découvertes via RPC:');
        data.forEach(table => {
          console.log(`  - ${table.table_name} (${table.table_type})`);
        });
        return data.map(t => t.table_name);
      }
    } catch (e) {
      console.log('⚠️ RPC get_tables_info non disponible');
    }
    
    // Méthode 2: Essayer de lire les tables système
    try {
      const { data, error } = await supabaseClient
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (!error && data) {
        console.log('✅ Tables découvertes via information_schema:');
        data.forEach(table => {
          console.log(`  - ${table.table_name}`);
        });
        return data.map(t => t.table_name);
      }
    } catch (e) {
      console.log('⚠️ information_schema non accessible');
    }
    
    // Méthode 3: Tester les tables connues et découvrir les vraies
    const knownTables = [
      'users', 'profiles', 'checkins', 'checkin_validations', 'missions',
      'attendance_records', 'projects', 'departments', 'communes', 
      'arrondissements', 'villages', 'roles', 'permissions', 'user_roles',
      'sessions', 'verification_codes', 'password_resets', 'audit_logs',
      'settings', 'notifications', 'reports', 'report_presence_view',
      // Tables possibles avec noms français
      'departements', 'presences', 'absences', 'custom_reports',
      'activity_logs', 'app_settings'
    ];
    
    console.log('🔍 Test des tables connues...');
    const existingTables = [];
    
    for (const table of knownTables) {
      try {
        const { data, error } = await supabaseClient
          .from(table)
          .select('*')
          .limit(1);
        
        if (!error) {
          existingTables.push(table);
          console.log(`✅ ${table} - existe`);
        } else {
          console.log(`❌ ${table} - n'existe pas (${error.code})`);
        }
      } catch (e) {
        console.log(`❌ ${table} - erreur: ${e.message}`);
      }
    }
    
    console.log(`\n📊 Résultat: ${existingTables.length} tables trouvées`);
    console.log('📋 Tables existantes:', existingTables.join(', '));
    
    return existingTables;
    
  } catch (error) {
    console.error('❌ Erreur lors de la découverte des tables:', error);
    return [];
  }
}

async function getTableInfo(tableName) {
  try {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      return { error: error.message };
    }
    
    const count = data ? data.length : 0;
    const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
    
    return {
      count,
      columns,
      sample: data && data.length > 0 ? data[0] : null
    };
    
  } catch (err) {
    return { error: err.message };
  }
}

async function analyzeTables() {
  try {
    console.log('📊 Analyse détaillée des tables...\n');
    
    const tables = await discoverTables();
    
    if (tables.length === 0) {
      console.log('❌ Aucune table trouvée');
      return;
    }
    
    console.log('\n📋 Informations détaillées par table:');
    console.log('=====================================\n');
    
    for (const table of tables) {
      console.log(`📊 Table: ${table}`);
      const info = await getTableInfo(table);
      
      if (info.error) {
        console.log(`  ❌ Erreur: ${info.error}`);
      } else {
        console.log(`  📄 Colonnes: ${info.columns.length}`);
        console.log(`  📊 Colonnes: ${info.columns.join(', ')}`);
        console.log(`  📈 Échantillon: ${info.sample ? 'Oui' : 'Non'}`);
        if (info.sample) {
          console.log(`  🔍 Exemple:`, JSON.stringify(info.sample, null, 2));
        }
      }
      console.log('');
    }
    
    // Générer un script de sauvegarde mis à jour
    const updatedScript = `const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

// Tables découvertes automatiquement
const DISCOVERED_TABLES = ${JSON.stringify(tables, null, 2)};

async function backupTable(tableName) {
  try {
    console.log(\`📊 Sauvegarde de la table: \${tableName}\`);
    
    const { data, error } = await supabaseClient
      .from(tableName)
      .select('*');
    
    if (error) {
      console.error(\`❌ Erreur lors de la sauvegarde de \${tableName}:\`, error);
      return { table: tableName, error: error.message, data: null };
    }
    
    console.log(\`✅ \${tableName}: \${data?.length || 0} enregistrements sauvegardés\`);
    return { 
      table: tableName, 
      count: data?.length || 0, 
      data: data,
      timestamp: new Date().toISOString()
    };
    
  } catch (err) {
    console.error(\`❌ Erreur inattendue pour \${tableName}:\`, err);
    return { table: tableName, error: err.message, data: null };
  }
}

async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = path.join(process.cwd(), 'backups');
    const backupFileName = \`supabase_backup_\${timestamp}.json\`;
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    console.log('🚀 Début de la sauvegarde Supabase...');
    console.log(\`📋 Tables à sauvegarder: \${DISCOVERED_TABLES.length}\`);
    
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
    
    console.log('\\n📊 Résumé de la sauvegarde:');
    console.log(\`✅ Tables sauvegardées avec succès: \${successCount}\`);
    console.log(\`❌ Tables en erreur: \${errorCount}\`);
    console.log(\`📄 Total d'enregistrements: \${backup.metadata.total_records}\`);
    console.log(\`💾 Fichier de sauvegarde: \${backupPath}\`);
    
    return backupPath;
    
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde:', error);
    throw error;
  }
}

createBackup()
  .then(backupPath => {
    console.log(\`\\n🎉 Sauvegarde terminée avec succès!\`);
    console.log(\`📁 Fichier: \${backupPath}\`);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Échec de la sauvegarde:', error);
    process.exit(1);
  });`;

    const fs = require('fs');
    fs.writeFileSync('./scripts/backup_supabase_updated.js', updatedScript);
    console.log('✅ Script de sauvegarde mis à jour créé: scripts/backup_supabase_updated.js');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
  }
}

analyzeTables();
