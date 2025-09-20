// Simple login endpoint
const users = [
  {
    id: 1,
    name: 'admin',
    email: 'admin@ccrb.local',
    password: '123456',
    role: 'admin'
  },
  {
    id: 2,
    name: 'Superviseur',
    email: 'supervisor@ccrb.local',
    password: '123456',
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
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  
  // Simple token (just user info encoded)
  const token = Buffer.from(JSON.stringify({ userId: user.id, role: user.role })).toString('base64');
  
  res.json({ 
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
};
