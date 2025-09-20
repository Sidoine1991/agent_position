// Simple authentication without external dependencies
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Simple password hashing (for demo purposes)
function simpleHash(password) {
  return Buffer.from(password).toString('base64');
}

function simpleVerify(password, hash) {
  return simpleHash(password) === hash;
}

// Simple JWT implementation
function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from(JWT_SECRET).toString('base64url');
  return `${header}.${data}.${signature}`;
}

// Default users
const users = [
  {
    id: 1,
    name: 'admin',
    email: 'admin@ccrb.local',
    password_hash: simpleHash('123456'),
    role: 'admin'
  },
  {
    id: 2,
    name: 'Superviseur',
    email: 'supervisor@ccrb.local',
    password_hash: simpleHash('123456'),
    role: 'supervisor'
  }
];

module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
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
};
