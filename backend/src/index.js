// Version JavaScript simplifiée pour Railway
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3');
const fs = require('fs');

// Configuration des chemins
const __dirname = path.dirname(__filename);

// Initialisation de l'application Express
const app = express();

// Trust proxy pour les reverse proxies (Railway, etc.)
app.set('trust proxy', 1);

// CORS
app.use(cors({
  origin: true,
  credentials: true,
}));

// Parsing des requêtes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques
const webPath = path.join(__dirname, '../../web');
app.use('/', express.static(webPath));

// Route pour la page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(webPath, 'index.html'));
});

// Servir les uploads
const uploadsPath = path.join(__dirname, '../../data/uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Servir les médias
const mediaPath = path.join(__dirname, '../../Media');
app.use('/Media', express.static(mediaPath));

// Base de données
const dataDir = path.join(process.cwd(), 'data');
const dbFile = path.join(dataDir, 'app.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbFile);

// Migration de la base de données
function migrate() {
  const sql = `
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'agent',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      date_start TEXT NOT NULL,
      date_end TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(agent_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      photo_path TEXT,
      note TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(mission_id) REFERENCES missions(id)
    );
  `;

  db.exec(sql, (err) => {
    if (err) {
      console.error('Erreur lors de la migration:', err);
    } else {
      console.log('✅ Migration de la base de données terminée');
    }
  });
}

// Routes API
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Service opérationnel',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0',
  });
});

// Démarrage du serveur
const port = Number(process.env.PORT) || 3001;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Serveur démarré sur le port ${port}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
});

// Initialiser la base de données
migrate();

// Gestion propre de l'arrêt du serveur
const gracefulShutdown = (signal) => {
  console.log(`📴 Signal ${signal} reçu, arrêt du serveur...`);
  
  server.close(() => {
    console.log('✅ Serveur fermé proprement');
    process.exit(0);
  });
  
  // Forcer l'arrêt après 10 secondes
  setTimeout(() => {
    console.error('❌ Arrêt forcé du serveur');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
