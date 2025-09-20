const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(morgan('combined'));

// Database setup
const db = new sqlite3.Database(':memory:'); // Utiliser une base en mémoire pour Vercel

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
      project_name TEXT,
      project_description TEXT,
      planning_start_date TEXT,
      planning_end_date TEXT,
      village_id INTEGER,
      expected_days_per_month INTEGER DEFAULT 20,
      expected_hours_per_month INTEGER DEFAULT 160,
      work_schedule TEXT,
      contract_type TEXT,
      tolerance_radius_meters INTEGER DEFAULT 100,
      reference_lat REAL,
      reference_lon REAL,
      gps_accuracy TEXT DEFAULT 'medium',
      observations TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create missions table
  db.run(`
    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Create checkins table
  db.run(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mission_id INTEGER,
      checkin_time DATETIME NOT NULL,
      checkout_time DATETIME,
      latitude REAL,
      longitude REAL,
      accuracy REAL,
      location_name TEXT,
      status TEXT DEFAULT 'present',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (mission_id) REFERENCES missions (id)
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

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Backend CCRB opérationnel' });
});

// Auth endpoints
app.post('/auth/register', (req, res) => {
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
});

app.post('/auth/login', (req, res) => {
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
});

// Profile endpoint
app.get('/profile', requireAuth, (req, res) => {
  const userId = req.user.userId;
  
  db.get('SELECT id, name, email, role, first_name, last_name, phone FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(user);
  });
});

// Mission endpoints
app.post('/mission/start', requireAuth, (req, res) => {
  const userId = req.user.userId;
  
  db.run(
    'INSERT INTO missions (user_id, start_time) VALUES (?, datetime("now"))',
    [userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erreur démarrage mission' });
      }
      
      res.json({ missionId: this.lastID, message: 'Mission démarrée' });
    }
  );
});

app.post('/mission/end', requireAuth, (req, res) => {
  const userId = req.user.userId;
  
  db.run(
    'UPDATE missions SET end_time = datetime("now"), status = "completed" WHERE user_id = ? AND status = "active"',
    [userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erreur arrêt mission' });
      }
      
      res.json({ message: 'Mission terminée' });
    }
  );
});

// Checkin endpoints
app.post('/checkin', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const { latitude, longitude, accuracy, location_name } = req.body;
  
  db.run(
    'INSERT INTO checkins (user_id, checkin_time, latitude, longitude, accuracy, location_name) VALUES (?, datetime("now"), ?, ?, ?, ?)',
    [userId, latitude, longitude, accuracy, location_name],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erreur enregistrement présence' });
      }
      
      res.json({ checkinId: this.lastID, message: 'Présence enregistrée' });
    }
  );
});

app.get('/checkins', requireAuth, (req, res) => {
  const userId = req.user.userId;
  
  db.all(
    'SELECT * FROM checkins WHERE user_id = ? ORDER BY checkin_time DESC LIMIT 10',
    [userId],
    (err, checkins) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur récupération présences' });
      }
      
      res.json(checkins);
    }
  );
});

// Admin endpoints
app.get('/admin/agents', requireAuth, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  
  db.all('SELECT id, name, email, role, phone, first_name, last_name FROM users ORDER BY created_at DESC', (err, agents) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur récupération agents' });
    }
    
    res.json(agents);
  });
});

app.post('/admin/agents', requireAuth, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  
  const { name, email, password = 'Agent@123', role = 'agent', phone, first_name, last_name } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Nom et email requis' });
  }
  
  const passwordHash = bcrypt.hashSync(password, 10);
  
  db.run(
    'INSERT INTO users (name, email, password_hash, role, phone, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, email, passwordHash, role, phone || '', first_name || '', last_name || ''],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erreur création agent' });
      }
      
      res.json({ id: this.lastID, message: 'Agent créé avec succès' });
    }
  );
});

// Initialize database on startup
initializeDatabase();

module.exports = app;