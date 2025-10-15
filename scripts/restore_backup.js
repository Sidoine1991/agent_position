const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

async function restoreTable(tableName, data) {
  try {
    console.log(`📊 Restauration de la table: ${tableName}`);
    
    if (!data || data.length === 0) {
      console.log(`⚠️ ${tableName}: Aucune donnée à restaurer`);
      return { table: tableName, restored: 0, error: null };
    }
    
    // Supprimer les données existantes (ATTENTION!)
    console.log(`🗑️ Suppression des données existantes dans ${tableName}...`);
    const { error: deleteError } = await supabaseClient
      .from(tableName)
      .delete()
      .neq('id', 0); // Supprimer tous les enregistrements
    
    if (deleteError) {
      console.warn(`⚠️ Impossible de supprimer les données existantes dans ${tableName}:`, deleteError.message);
    }
    
    // Insérer les nouvelles données par lots
    const batchSize = 100;
    let totalRestored = 0;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const { error: insertError } = await supabaseClient
        .from(tableName)
        .insert(batch);
      
      if (insertError) {
        console.error(`❌ Erreur lors de l'insertion du lot ${Math.floor(i/batchSize) + 1} dans ${tableName}:`, insertError);
        return { table: tableName, restored: totalRestored, error: insertError.message };
      }
      
      totalRestored += batch.length;
      console.log(`✅ ${tableName}: ${totalRestored}/${data.length} enregistrements restaurés`);
    }
    
    return { table: tableName, restored: totalRestored, error: null };
    
  } catch (err) {
    console.error(`❌ Erreur inattendue pour ${tableName}:`, err);
    return { table: tableName, restored: 0, error: err.message };
  }
}

async function restoreFromBackup(backupFilePath) {
  try {
    console.log('🚀 Début de la restauration Supabase...');
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Fichier de sauvegarde non trouvé: ${backupFilePath}`);
    }
    
    // Lire le fichier de sauvegarde
    console.log(`📖 Lecture du fichier: ${backupFilePath}`);
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    
    console.log(`📅 Sauvegarde du: ${backupData.metadata.timestamp}`);
    console.log(`📋 Tables dans la sauvegarde: ${backupData.metadata.total_tables}`);
    console.log(`📄 Total d'enregistrements: ${backupData.metadata.total_records}`);
    
    // Demander confirmation
    console.log('\n⚠️ ATTENTION: Cette opération va:');
    console.log('1. Supprimer TOUTES les données existantes');
    console.log('2. Restaurer les données de la sauvegarde');
    console.log('3. Cette action est IRRÉVERSIBLE!');
    
    // En mode automatique, on continue (pour les scripts)
    if (process.argv.includes('--force')) {
      console.log('🔄 Mode automatique activé, continuation...');
    } else {
      console.log('\n❌ Pour confirmer, relancez avec --force');
      console.log('Exemple: node scripts/restore_backup.js backup_file.json --force');
      process.exit(1);
    }
    
    const results = [];
    let totalRestored = 0;
    let errorCount = 0;
    
    // Restaurer chaque table
    for (const [tableName, tableData] of Object.entries(backupData.tables)) {
      if (tableData.error) {
        console.log(`⚠️ ${tableName}: Ignorée (erreur dans la sauvegarde: ${tableData.error})`);
        results.push({ table: tableName, restored: 0, error: `Erreur dans sauvegarde: ${tableData.error}` });
        errorCount++;
        continue;
      }
      
      const result = await restoreTable(tableName, tableData.data);
      results.push(result);
      
      if (result.error) {
        errorCount++;
      } else {
        totalRestored += result.restored;
      }
      
      // Pause entre les tables
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Résumé
    console.log('\n📊 Résumé de la restauration:');
    console.log(`✅ Tables restaurées avec succès: ${results.filter(r => !r.error).length}`);
    console.log(`❌ Tables en erreur: ${errorCount}`);
    console.log(`📄 Total d'enregistrements restaurés: ${totalRestored}`);
    
    if (errorCount > 0) {
      console.log('\n❌ Tables en erreur:');
      results.filter(r => r.error).forEach(r => {
        console.log(`- ${r.table}: ${r.error}`);
      });
    }
    
    console.log('\n🎉 Restauration terminée!');
    console.log('💡 N\'oubliez pas de vérifier les contraintes et relations dans Supabase');
    
  } catch (error) {
    console.error('💥 Erreur lors de la restauration:', error);
    throw error;
  }
}

// Vérifier les arguments
const backupFile = process.argv[2];
if (!backupFile) {
  console.log('Usage: node scripts/restore_backup.js <backup_file.json> [--force]');
  console.log('Exemple: node scripts/restore_backup.js backups/supabase_backup_2024-01-15T10-30-00.json --force');
  process.exit(1);
}

// Exécuter la restauration
restoreFromBackup(backupFile)
  .then(() => {
    console.log('✅ Restauration terminée avec succès!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Échec de la restauration:', error);
    process.exit(1);
  });
