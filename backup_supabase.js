#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Variables d\'environnement manquantes');
  console.log('Assurez-vous d\'avoir SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans votre .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Créer le dossier de sauvegarde s'il n'existe pas
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Fonction pour sauvegarder une table
async function backupTable(tableName) {
  try {
    console.log(`📊 Sauvegarde de la table: ${tableName}`);
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) {
      console.log(`❌ Erreur lors de la sauvegarde de ${tableName}:`, error.message);
      return null;
    }
    
    console.log(`✅ ${tableName}: ${data?.length || 0} enregistrements sauvegardés`);
    return data;
  } catch (err) {
    console.log(`❌ Exception lors de la sauvegarde de ${tableName}:`, err.message);
    return null;
  }
}

// Fonction principale de sauvegarde
async function createBackup() {
  try {
    console.log('🚀 Début de la sauvegarde Supabase...');
    console.log('📅 Date:', new Date().toISOString());
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFileName = `supabase_backup_${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFileName);
    
    // Liste des tables à sauvegarder (ajustez selon vos tables)
    const tables = [
      'users',
      'planifications',
      'missions',
      'checkins',
      'profiles'
    ];
    
    const backup = {
      metadata: {
        created_at: new Date().toISOString(),
        supabase_url: supabaseUrl,
        version: '1.0.0',
        description: 'Sauvegarde complète de la base de données Presence CCR-B'
      },
      tables: {}
    };
    
    // Sauvegarder chaque table
    for (const table of tables) {
      const data = await backupTable(table);
      if (data !== null) {
        backup.tables[table] = data;
      }
    }
    
    // Sauvegarder le fichier
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    console.log('✅ Sauvegarde terminée avec succès !');
    console.log(`📁 Fichier sauvegardé: ${backupPath}`);
    
    // Afficher le résumé
    console.log('\n📊 Résumé de la sauvegarde:');
    Object.entries(backup.tables).forEach(([table, data]) => {
      console.log(`  - ${table}: ${data.length} enregistrements`);
    });
    
    // Créer un lien symbolique vers la dernière sauvegarde
    const latestBackupPath = path.join(backupDir, 'latest_backup.json');
    if (fs.existsSync(latestBackupPath)) {
      fs.unlinkSync(latestBackupPath);
    }
    fs.copyFileSync(backupPath, latestBackupPath);
    console.log(`🔗 Lien vers la dernière sauvegarde: ${latestBackupPath}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde:', error.message);
    process.exit(1);
  }
}

// Exécuter la sauvegarde
createBackup();
