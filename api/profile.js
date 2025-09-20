module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Vérifier l'autorisation
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'autorisation requis' });
  }

  const token = authHeader.substring(7);
  
  // Pour simplifier, on accepte n'importe quel token et on retourne un profil admin
  // En production, il faudrait vérifier le JWT
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
};