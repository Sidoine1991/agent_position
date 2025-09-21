// Version ultra-basique pour Railway
const express = require('express');
const app = express();

// Route de test
app.get('/', (req, res) => {
  res.send('🚀 Presence CCRB - Railway fonctionne !');
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Railway fonctionne' });
});

// Démarrage
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});

module.exports = app;
