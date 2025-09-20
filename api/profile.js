// Simple profile endpoint
const users = [
  {
    id: 1,
    name: 'admin',
    email: 'admin@ccrb.local',
    role: 'admin'
  },
  {
    id: 2,
    name: 'Superviseur',
    email: 'supervisor@ccrb.local',
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
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  
  try {
    const userData = JSON.parse(Buffer.from(token, 'base64').toString());
    const user = users.find(u => u.id === userData.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
};
