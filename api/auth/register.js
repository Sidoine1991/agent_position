const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Database setup
const db = new sqlite3.Database(':memory:');

// Initialize database
function initializeDatabase() {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'agent',
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = (req, res) => {
  // Initialize database
  initializeDatabase();
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { name, email, password, role = 'agent' } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Données manquantes' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mot de passe trop court' });
  }
  
  const passwordHash = bcrypt.hashSync(password, 10);
  
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    
    if (row) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }
    
    db.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Erreur création utilisateur' });
        }
        
        const token = jwt.sign({ userId: this.lastID, role }, JWT_SECRET, { expiresIn: '12h' });
        res.json({ token });
      }
    );
  });
};
