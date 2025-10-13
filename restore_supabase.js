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

// Fonction pour restaurer une table
async function restoreTable(tableName, data, clearFirst = true) {
  try {
    console.log(`📊 Restauration de la table: ${tableName}`);
    
    if (clearFirst) {
      console.log(`🗑️  Suppression des données existantes de ${tableName}...`);
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .neq('id', 0); // Supprimer tous les enregistrements
      
      if (deleteError) {
        console.log(`⚠️  Avertissement lors de la suppression de ${tableName}:`, deleteError.message);
      }
    }
    
    if (!data || data.length === 0) {
      console.log(`ℹ️  Aucune donnée à restaurer pour ${tableName}`);
      return true;
    }
    
    // Insérer les données par lots de 100 pour éviter les limites
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from(tableName)
        .insert(batch);
      
      if (error) {
        console.log(`❌ Erreur lors de l'insertion dans ${tableName}:`, error.message);
        return false;
      }
      
      console.log(`  ✅ Lot ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)} inséré`);
    }
    
    console.log(`✅ ${tableName}: ${data.length} enregistrements restaurés`);
    return true;
  } catch (err) {
    console.log(`❌ Exception lors de la restauration de ${tableName}:`, err.message);
    return false;
  }
}

// Fonction principale de restauration
async function restoreFromBackup(backupFile) {
  try {
    console.log('🚀 Début de la restauration Supabase...');
    
    // Vérifier que le fichier de sauvegarde existe
    if (!fs.existsSync(backupFile)) {
      console.log(`❌ Fichier de sauvegarde non trouvé: ${backupFile}`);
      process.exit(1);
    }
    
    // Lire le fichier de sauvegarde
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    console.log('📅 Date de la sauvegarde:', backupData.metadata.created_at);
    console.log('📝 Description:', backupData.metadata.description);
    
    // Demander confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('⚠️  ATTENTION: Cette opération va remplacer toutes les données existantes. Continuer ? (oui/non): ', resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() !== 'oui' && answer.toLowerCase() !== 'o') {
      console.log('❌ Restauration annulée par l\'utilisateur');
      process.exit(0);
    }
    
    // Restaurer chaque table
    const tables = Object.keys(backupData.tables);
    let successCount = 0;
    
    for (const table of tables) {
      const success = await restoreTable(table, backupData.tables[table]);
      if (success) successCount++;
    }
    
    console.log('\n✅ Restauration terminée !');
    console.log(`📊 ${successCount}/${tables.length} tables restaurées avec succès`);
    
    // Afficher le résumé
    console.log('\n📊 Résumé de la restauration:');
    Object.entries(backupData.tables).forEach(([table, data]) => {
      console.log(`  - ${table}: ${data.length} enregistrements restaurés`);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la restauration:', error.message);
    process.exit(1);
  }
}

// Fonction pour lister les sauvegardes disponibles
function listBackups() {
  const backupDir = path.join(__dirname, 'backups');
  
  if (!fs.existsSync(backupDir)) {
    console.log('❌ Aucun dossier de sauvegarde trouvé');
    return;
  }
  
  const files = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    console.log('❌ Aucune sauvegarde trouvée');
    return;
  }
  
  console.log('📁 Sauvegardes disponibles:');
  files.forEach((file, index) => {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024).toFixed(2);
    console.log(`  ${index + 1}. ${file} (${size} KB) - ${stats.mtime.toLocaleString()}`);
  });
}

// Gestion des arguments de ligne de commande
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  node restore_supabase.js list                    - Lister les sauvegardes');
  console.log('  node restore_supabase.js restore <fichier>       - Restaurer depuis un fichier');
  console.log('  node restore_supabase.js restore latest          - Restaurer depuis la dernière sauvegarde');
  process.exit(0);
}

if (args[0] === 'list') {
  listBackups();
} else if (args[0] === 'restore') {
  let backupFile;
  
  if (args[1] === 'latest') {
    backupFile = path.join(__dirname, 'backups', 'latest_backup.json');
  } else {
    backupFile = args[1];
  }
  
  restoreFromBackup(backupFile);
} else {
  console.log('❌ Commande non reconnue');
  process.exit(1);
}
