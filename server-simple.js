const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('web'));

// Import des données géographiques
const geoData = require('./api/geo-data');

// Routes API
app.get('/api/health', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Backend CCRB opérationnel',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/health',
      '/api/test',
      '/api/login',
      '/api/profile',
      '/api/geo/departements',
      '/api/geo/communes',
      '/api/geo/arrondissements',
      '/api/geo/villages'
    ]
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API fonctionne !',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/test',
      '/api/geo/departements',
      '/api/geo/communes?departement_id=1',
      '/api/geo/arrondissements?commune_id=1',
      '/api/geo/villages?arrondissement_id=1'
    ]
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'admin@ccrb.local' && password === '123456') {
    const token = 'admin-token-' + Date.now();
    
    res.json({
      token: token,
      user: {
        id: 1,
        name: 'Admin Principal',
        email: 'admin@ccrb.local',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({ error: 'Identifiants invalides' });
  }
});

app.get('/api/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'autorisation requis' });
  }

  const profile = {
    id: 1,
    name: 'Admin Principal',
    email: 'admin@ccrb.local',
    role: 'admin',
    phone: '+229 12345678',
    project_name: 'CCRB Presence System',
    created_at: new Date().toISOString()
  };

  res.json(profile);
});

// Endpoints géographiques
app.get('/api/geo/departements', (req, res) => {
  res.json(geoData.departements);
});

app.get('/api/geo/communes', (req, res) => {
  const depId = Number(req.query.departement_id);
  
  if (!depId) {
    return res.status(400).json({ error: 'departement_id is required' });
  }

  const departement = geoData.departements.find(d => d.id === depId);
  if (!departement) {
    return res.status(404).json({ error: 'Département non trouvé' });
  }

  const communes = geoData.communes[departement.name] || [];
  res.json(communes);
});

app.get('/api/geo/arrondissements', (req, res) => {
  const communeId = Number(req.query.commune_id);
  
  if (!communeId) {
    return res.status(400).json({ error: 'commune_id is required' });
  }

  // Trouver la commune par ID dans tous les départements
  let commune = null;
  for (const [depName, communes] of Object.entries(geoData.communes)) {
    commune = communes.find(c => c.id === communeId);
    if (commune) break;
  }

  if (!commune) {
    return res.status(404).json({ error: 'Commune non trouvée' });
  }

  const arrondissements = geoData.arrondissements[commune.name] || [];
  res.json(arrondissements);
});

app.get('/api/geo/villages', (req, res) => {
  const arrondissementId = Number(req.query.arrondissement_id);
  
  if (!arrondissementId) {
    return res.status(400).json({ error: 'arrondissement_id is required' });
  }

  // Trouver l'arrondissement par ID dans toutes les communes
  let arrondissement = null;
  for (const [communeName, arrondissements] of Object.entries(geoData.arrondissements)) {
    arrondissement = arrondissements.find(a => a.id === arrondissementId);
    if (arrondissement) break;
  }

  if (!arrondissement) {
    return res.status(404).json({ error: 'Arrondissement non trouvé' });
  }

  const villages = geoData.villages[arrondissement.name] || [];
  res.json(villages);
});

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📱 Application: http://localhost:${PORT}`);
  console.log(`🔧 API: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Login: admin@ccrb.local / 123456`);
});
