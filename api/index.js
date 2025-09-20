// Simple authentication without external dependencies

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Simple JWT implementation
function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from(JWT_SECRET).toString('base64url');
  return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload;
  } catch {
    return null;
  }
}

// In-memory storage (for serverless compatibility)
let users = [];
let missions = [];
let checkins = [];

// Simple password hashing (for demo purposes)
function simpleHash(password) {
  return Buffer.from(password).toString('base64');
}

function simpleVerify(password, hash) {
  return simpleHash(password) === hash;
}

// Initialize default users
function initializeUsers() {
  if (users.length === 0) {
    users = [
      {
        id: 1,
        name: 'admin',
        email: 'admin@ccrb.local',
        password_hash: simpleHash('123456'),
        role: 'admin',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        name: 'Superviseur',
        email: 'supervisor@ccrb.local',
        password_hash: simpleHash('123456'),
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
    
    if (!user || !simpleVerify(password, user.password_hash)) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    
    const token = createToken({ userId: user.id, role: user.role });
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
    
    const passwordHash = simpleHash(password);
    
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
    
    const token = createToken({ userId: newUser.id, role });
    res.json({ token });
    return;
  }
  
  // Default response
  res.status(404).json({ error: 'Endpoint non trouvé', url, method });
};
