// Serveur ultra-simple pour Railway
const express = require('express');
const path = require('path');
const app = express();

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '..', 'web')));

// Routes pour toutes les pages HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'index.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'dashboard.html'));
});

app.get('/agents.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'agents.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'admin.html'));
});

app.get('/admin-agents.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'admin-agents.html'));
});

app.get('/profile.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'profile.html'));
});

app.get('/reports.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'reports.html'));
});

// Middleware pour parser JSON
app.use(express.json());

// Routes API
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  // Simulation d'authentification avec gestion des rôles
  if (email && password) {
    const token = 'demo-token-' + Date.now();
    
    // Déterminer le rôle selon l'email
    let role = 'agent';
    let name = 'Agent Demo';
    
    if (email.includes('admin') || email === 'admin@ccrb.local') {
      role = 'admin';
      name = 'Administrateur';
    } else if (email.includes('sup') || email.includes('superviseur') || email === 'superviseur@ccrb.local') {
      role = 'superviseur';
      name = 'Superviseur';
    }
    
    res.json({ 
      success: true, 
      message: 'Connexion réussie',
      token: token,
      user: {
        id: 1,
        name: name,
        email: email,
        role: role
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Email et mot de passe requis'
    });
  }
});

app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  
  if (name && email && password) {
    res.json({ 
      success: true, 
      message: 'Inscription réussie',
      user: {
        id: Date.now(),
        name: name,
        email: email,
        role: 'agent'
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Tous les champs sont requis'
    });
  }
});

// Routes de présence
app.post('/api/presence/start', (req, res) => {
  res.json({
    success: true,
    message: 'Présence (début) enregistrée avec succès',
    mission_id: Date.now(),
    checkin_id: Date.now() + 1
  });
});

app.post('/api/presence/end', (req, res) => {
  res.json({
    success: true,
    message: 'Présence (fin) enregistrée avec succès'
  });
});

app.get('/api/me/missions', (req, res) => {
  res.json({
    success: true,
    missions: [
      {
        id: 1,
        date_start: new Date().toISOString(),
        status: 'active',
        village_name: 'Village Demo'
      }
    ]
  });
});

// Route pour récupérer le profil utilisateur
app.get('/api/profile', (req, res) => {
  // Récupérer les données de connexion depuis le localStorage côté client
  // Pour l'instant, on simule selon l'email dans l'en-tête
  const authHeader = req.headers.authorization;
  
  // Simulation basée sur l'email (en réalité, décoder le JWT)
  let role = 'agent';
  let name = 'Utilisateur Demo';
  let email = 'demo@ccrb.com';
  
  // Vérifier si c'est un admin
  if (authHeader && authHeader.includes('demo-token')) {
    // En réalité, on décoderait le JWT ici
    // Pour la démo, on simule selon l'email
    role = 'admin';
    name = 'Administrateur';
    email = 'admin@ccrb.local';
  }
  
  res.json({
    success: true,
    id: 1,
    name: name,
    email: email,
    role: role,
    first_name: name.split(' ')[0] || 'Demo',
    last_name: name.split(' ')[1] || 'User',
    phone: '+237 6XX XX XX XX',
    project_name: 'Projet CCRB',
    planning_start_date: '2024-01-01',
    planning_end_date: '2024-12-31',
    zone_name: 'Zone Centre',
    expected_days_per_month: 22
  });
});

// Route pour supprimer un rapport
app.delete('/api/reports/:id', (req, res) => {
  const reportId = req.params.id;
  
  // Simulation de la suppression
  // En réalité, vous supprimeriez le rapport de la base de données
  console.log(`Suppression du rapport ${reportId}`);
  
  res.json({
    success: true,
    message: `Rapport ${reportId} supprimé avec succès`
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// Démarrage
const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Serveur démarré sur le port ${port}`);
  console.log(`✅ Application prête !`);
});

module.exports = app;
