// Version ultra-basique pour Railway
const express = require('express');
const path = require('path');
const app = express();

// Servir les fichiers statiques
const webPath = path.join(__dirname, '../../web');
app.use(express.static(webPath));

// Route pour la page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(webPath, 'index.html'));
});

// Routes API
app.post('/api/login', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Login simulé - API fonctionne',
    token: 'demo-token-123'
  });
});

app.post('/api/register', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Inscription simulée - API fonctionne'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
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
