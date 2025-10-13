#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Vérifier si une sauvegarde récente existe (moins de 24h)
function hasRecentBackup() {
  const backupDir = path.join(__dirname, 'backups');
  const latestBackupPath = path.join(backupDir, 'latest_backup.json');
  
  if (!fs.existsSync(latestBackupPath)) {
    return false;
  }
  
  const stats = fs.statSync(latestBackupPath);
  const now = new Date();
  const backupTime = new Date(stats.mtime);
  const hoursDiff = (now - backupTime) / (1000 * 60 * 60);
  
  return hoursDiff < 24; // Moins de 24 heures
}

// Créer une sauvegarde rapide
function createQuickBackup() {
  console.log('🔄 Création d\'une sauvegarde rapide au démarrage...');
  
  exec('node backup_supabase.js', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      return;
    }
    
    if (stderr) {
      console.error('⚠️  Avertissement:', stderr);
    }
    
    console.log('✅ Sauvegarde de démarrage terminée');
  });
}

// Fonction principale
function checkAndBackup() {
  if (!hasRecentBackup()) {
    console.log('📅 Aucune sauvegarde récente trouvée, création d\'une sauvegarde...');
    createQuickBackup();
  } else {
    console.log('✅ Sauvegarde récente trouvée, pas de sauvegarde nécessaire');
  }
}

// Exécuter seulement si appelé directement
if (require.main === module) {
  checkAndBackup();
}

module.exports = { checkAndBackup, hasRecentBackup };
