const { Pool } = require('pg');

// Configuration de la base de données PostgreSQL
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dbccrb_user:THMWBv1Ur2hP1XyNJExmemPodp0pzeV6@dpg-d37s6vmmcj7s73fs2chg-a.oregon-postgres.render.com/dbccrb',
  ssl: {
    rejectUnauthorized: false
  }
});

// Test de connexion
db.connect()
  .then(() => console.log('✅ Connexion PostgreSQL réussie'))
  .catch(err => console.error('❌ Erreur de connexion PostgreSQL:', err));

module.exports = { db };
