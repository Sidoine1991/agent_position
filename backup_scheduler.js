#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 heures en millisecondes
const MAX_BACKUPS = 7; // Garder seulement les 7 dernières sauvegardes

// Fonction pour exécuter la sauvegarde
function runBackup() {
  console.log('🕐 Exécution de la sauvegarde programmée...');
  
  exec('node backup_supabase.js', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      return;
    }
    
    if (stderr) {
      console.error('⚠️  Avertissement:', stderr);
    }
    
    console.log('✅ Sauvegarde programmée terminée');
    console.log(stdout);
    
    // Nettoyer les anciennes sauvegardes
    cleanupOldBackups();
  });
}

// Fonction pour nettoyer les anciennes sauvegardes
function cleanupOldBackups() {
  const backupDir = path.join(__dirname, 'backups');
  
  if (!fs.existsSync(backupDir)) {
    return;
  }
  
  const files = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.json') && file !== 'latest_backup.json')
    .map(file => ({
      name: file,
      path: path.join(backupDir, file),
      mtime: fs.statSync(path.join(backupDir, file)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);
  
  if (files.length > MAX_BACKUPS) {
    const filesToDelete = files.slice(MAX_BACKUPS);
    
    console.log(`🧹 Nettoyage: suppression de ${filesToDelete.length} anciennes sauvegardes`);
    
    filesToDelete.forEach(file => {
      try {
        fs.unlinkSync(file.path);
        console.log(`  🗑️  Supprimé: ${file.name}`);
      } catch (err) {
        console.error(`  ❌ Erreur lors de la suppression de ${file.name}:`, err.message);
      }
    });
  }
}

// Fonction pour démarrer le planificateur
function startScheduler() {
  console.log('🚀 Démarrage du planificateur de sauvegarde');
  console.log(`⏰ Intervalle: ${BACKUP_INTERVAL / (60 * 60 * 1000)} heures`);
  console.log(`📁 Dossier de sauvegarde: ${path.join(__dirname, 'backups')}`);
  console.log(`🗂️  Nombre maximum de sauvegardes: ${MAX_BACKUPS}`);
  
  // Exécuter une sauvegarde immédiate
  runBackup();
  
  // Programmer les sauvegardes suivantes
  setInterval(runBackup, BACKUP_INTERVAL);
  
  console.log('✅ Planificateur démarré. Appuyez sur Ctrl+C pour arrêter.');
}

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du planificateur de sauvegarde');
  process.exit(0);
});

// Démarrer le planificateur
startScheduler();
