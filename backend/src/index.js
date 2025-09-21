// Version JavaScript ultra-simplifiée pour Railway
const express = require('express');
const path = require('path');
const fs = require('fs');

// Configuration des chemins
const __dirname = path.dirname(__filename);

// Initialisation de l'application Express
const app = express();

// Trust proxy pour les reverse proxies (Railway, etc.)
app.set('trust proxy', 1);

// Parsing des requêtes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Route de test simple
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Presence CCRB</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body>
      <h1>🚀 Presence CCRB - Application déployée avec succès !</h1>
      <p>✅ Serveur Railway fonctionnel</p>
      <p>📱 Prêt pour la création d'APK</p>
      <p>🌍 Environnement: ${process.env.NODE_ENV || 'production'}</p>
      <p>⏰ ${new Date().toISOString()}</p>
    </body>
    </html>
  `);
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Service opérationnel',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    version: '2.0.0',
  });
});

// Route API simple
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// Démarrage du serveur
const port = Number(process.env.PORT) || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Serveur démarré sur le port ${port}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'production'}`);
  console.log(`✅ Application prête !`);
});

module.exports = app;
