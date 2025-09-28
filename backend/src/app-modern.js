const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// Configuration de la base de données PostgreSQL
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dbccrb_user:THMWBv1Ur2hP1XyNJExmemPodp0pzeV6@dpg-d37s6vmmcj7s73fs2chg-a.oregon-postgres.render.com/dbccrb',
  ssl: {
    rejectUnauthorized: false
  }
});

// Test de connexion à la base de données
db.connect()
  .then(() => console.log('✅ Connexion PostgreSQL réussie'))
  .catch(err => console.error('❌ Erreur de connexion PostgreSQL:', err));

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques
const webPath = path.join(__dirname, '../../web');
app.use(express.static(webPath));

// Route pour la page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(webPath, 'index.html'));
});

// Routes API modernes
const routesModern = require('../../web/routes-modern');
app.use('/api', routesModern);

// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API moderne fonctionne',
    database: 'PostgreSQL connecté',
    timestamp: new Date().toISOString()
  });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: err.message 
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Démarrage
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 Serveur moderne démarré sur le port ${port}`);
  console.log(`📊 Base de données: PostgreSQL`);
  console.log(`🌐 Interface: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Développement'}`);
});

module.exports = app;
