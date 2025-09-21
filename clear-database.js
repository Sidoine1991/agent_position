const { Pool } = require('pg');

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function clearAllData() {
  try {
    console.log('🗑️ Début de la suppression de toutes les données...');
    
    // Supprimer toutes les données dans l'ordre des dépendances
    await pool.query('DELETE FROM checkins');
    console.log('✅ Check-ins supprimés');
    
    await pool.query('DELETE FROM missions');
    console.log('✅ Missions supprimées');
    
    await pool.query('DELETE FROM users');
    console.log('✅ Utilisateurs supprimés');
    
    console.log('🎯 Toutes les données ont été supprimées avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
  } finally {
    await pool.end();
  }
}

clearAllData();
