const { Pool } = require('pg');

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function clearUnverifiedUsers() {
  try {
    console.log('🗑️ Suppression des utilisateurs non vérifiés...');
    
    // Supprimer les utilisateurs non vérifiés
    const result = await pool.query('DELETE FROM users WHERE is_verified = FALSE');
    console.log(`✅ ${result.rowCount} utilisateurs non vérifiés supprimés`);
    
    // Supprimer les missions orphelines
    await pool.query('DELETE FROM missions WHERE user_id NOT IN (SELECT id FROM users)');
    console.log('✅ Missions orphelines supprimées');
    
    // Supprimer les check-ins orphelins
    await pool.query('DELETE FROM checkins WHERE mission_id NOT IN (SELECT id FROM missions)');
    console.log('✅ Check-ins orphelins supprimés');
    
    console.log('🎯 Nettoyage terminé !');
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    await pool.end();
  }
}

clearUnverifiedUsers();
