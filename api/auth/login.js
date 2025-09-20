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

  // Create default admin user
  const adminPassword = bcrypt.hashSync('123456', 10);
  db.run(`
    INSERT OR IGNORE INTO users (name, email, password_hash, role) 
    VALUES ('admin', 'admin@ccrb.local', ?, 'admin')
  `, [adminPassword]);

  // Create default supervisor user
  const supervisorPassword = bcrypt.hashSync('123456', 10);
  db.run(`
    INSERT OR IGNORE INTO users (name, email, password_hash, role) 
    VALUES ('Superviseur', 'supervisor@ccrb.local', ?, 'supervisor')
  `, [supervisorPassword]);
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
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  
  db.get('SELECT id, password_hash, role FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token });
  });
};
