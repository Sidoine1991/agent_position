const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// In-memory storage (for serverless compatibility)
let users = [];
let missions = [];
let checkins = [];

// Initialize default users
function initializeUsers() {
  if (users.length === 0) {
    users = [
      {
        id: 1,
        name: 'admin',
        email: 'admin@ccrb.local',
        password_hash: bcrypt.hashSync('123456', 10),
        role: 'admin',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        name: 'Superviseur',
        email: 'supervisor@ccrb.local',
        password_hash: bcrypt.hashSync('123456', 10),
        role: 'supervisor',
        created_at: new Date().toISOString()
      }
    ];
  }
}

module.exports = (req, res) => {
  // Initialize users
  initializeUsers();
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const { url, method } = req;
  
  // Route handling
  if (url === '/api/health' && method === 'GET') {
    return res.json({ 
      ok: true, 
      message: 'Backend CCRB opérationnel',
      timestamp: new Date().toISOString()
    });
  }
  
  if (url === '/api/test' && method === 'GET') {
    return res.json({ 
      message: 'API Test fonctionne !',
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });
  }
  
  if (url === '/api/auth/login' && method === 'POST') {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    
    const user = users.find(u => u.email === email);
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token });
    return;
  }
  
  if (url === '/api/auth/register' && method === 'POST') {
    const { name, email, password, role = 'agent' } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mot de passe trop court' });
    }
    
    const passwordHash = bcrypt.hashSync(password, 10);
    
    const existingUser = users.find(u => u.email === email);
    
    if (existingUser) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }
    
    const newUser = {
      id: users.length + 1,
      name,
      email,
      password_hash: passwordHash,
      role,
      created_at: new Date().toISOString()
    };
    
    users.push(newUser);
    
    const token = jwt.sign({ userId: newUser.id, role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token });
    return;
  }
  
  // Default response
  res.status(404).json({ error: 'Endpoint non trouvé', url, method });
};
