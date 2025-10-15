const fs = require('fs');
const path = require('path');

const backupDir = path.join(process.cwd(), 'backups');

function listBackups() {
  try {
    console.log('📁 Sauvegardes Supabase disponibles:');
    console.log('=====================================\n');
    
    if (!fs.existsSync(backupDir)) {
      console.log('❌ Aucun dossier de sauvegarde trouvé');
      return;
    }
    
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('supabase_backup_') && file.endsWith('.json'))
      .sort()
      .reverse(); // Plus récent en premier
    
    if (files.length === 0) {
      console.log('❌ Aucune sauvegarde trouvée');
      return;
    }
    
    files.forEach((file, index) => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      // Extraire la date du nom de fichier
      const dateMatch = file.match(/supabase_backup_(.+)\.json/);
      const dateStr = dateMatch ? dateMatch[1].replace(/-/g, ':').replace('T', ' ').slice(0, 19) : 'Inconnue';
      
      console.log(`${index + 1}. ${file}`);
      console.log(`   📅 Date: ${dateStr}`);
      console.log(`   📏 Taille: ${sizeMB} MB`);
      console.log(`   📁 Chemin: ${filePath}`);
      console.log('');
    });
    
    console.log(`📊 Total: ${files.length} sauvegarde(s)`);
    console.log('\n💡 Pour restaurer une sauvegarde:');
    console.log('node scripts/restore_backup.js backups/<nom_du_fichier> --force');
    
  } catch (error) {
    console.error('❌ Erreur lors de la lecture des sauvegardes:', error);
  }
}

listBackups();
