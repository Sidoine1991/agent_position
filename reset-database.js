const { Pool } = require('pg');

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetDatabase() {
  try {
    console.log('🔄 Réinitialisation complète de la base de données...');
    
    // Supprimer toutes les tables
    await pool.query('DROP TABLE IF EXISTS checkins CASCADE');
    console.log('✅ Table checkins supprimée');
    
    await pool.query('DROP TABLE IF EXISTS missions CASCADE');
    console.log('✅ Table missions supprimée');
    
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    console.log('✅ Table users supprimée');
    
    // Recréer les tables
    console.log('🔨 Recréation des tables...');
    
    // Table users
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'agent',
        phone VARCHAR(20),
        is_verified BOOLEAN DEFAULT FALSE,
        verification_code VARCHAR(10),
        verification_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table users recréée');
    
    // Table missions
    await pool.query(`
      CREATE TABLE missions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        start_lat DECIMAL(10, 8),
        start_lon DECIMAL(11, 8),
        end_lat DECIMAL(10, 8),
        end_lon DECIMAL(11, 8),
        departement VARCHAR(100),
        commune VARCHAR(100),
        arrondissement VARCHAR(100),
        village VARCHAR(100),
        note TEXT,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table missions recréée');
    
    // Table checkins
    await pool.query(`
      CREATE TABLE checkins (
        id SERIAL PRIMARY KEY,
        mission_id INTEGER REFERENCES missions(id),
        lat DECIMAL(10, 8),
        lon DECIMAL(11, 8),
        note TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table checkins recréée');
    
    console.log('🎯 Base de données réinitialisée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error);
  } finally {
    await pool.end();
  }
}

resetDatabase();
