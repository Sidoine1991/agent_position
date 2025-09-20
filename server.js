const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('web'));

// Import des endpoints API
const health = require('./api/health');
const login = require('./api/login');
const profile = require('./api/profile');
const test = require('./api/test');
const geo = require('./api/geo');

// Routes API
app.get('/api/health', health);
app.post('/api/login', login);
app.get('/api/profile', profile);
app.get('/api/test', test);
app.get('/api/geo/departements', geo);
app.get('/api/geo/communes', geo);
app.get('/api/geo/arrondissements', geo);
app.get('/api/geo/villages', geo);

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📱 Application: http://localhost:${PORT}`);
  console.log(`🔧 API: http://localhost:${PORT}/api/health`);
});
