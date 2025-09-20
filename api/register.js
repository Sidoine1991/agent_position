// Simple register endpoint
let users = [
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
  
  const { name, email, password, role = 'agent' } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nom, email et mot de passe requis' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mot de passe trop court (minimum 6 caractères)' });
  }
  
  const existingUser = users.find(u => u.email === email);
  
  if (existingUser) {
    return res.status(409).json({ error: 'Email déjà utilisé' });
  }
  
  const newUser = {
    id: users.length + 1,
    name,
    email,
    password,
    role
  };
  
  users.push(newUser);
  
  // Simple token (just user info encoded)
  const token = Buffer.from(JSON.stringify({ userId: newUser.id, role })).toString('base64');
  
  res.json({ 
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    }
  });
};
