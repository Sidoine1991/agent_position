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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    // Lire le body de la requête
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body);
        
        // Vérifier les credentials
        if (email === 'admin@ccrb.local' && password === '123456') {
          // Générer un token simple (en production, utiliser JWT)
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
      } catch (parseError) {
        res.status(400).json({ error: 'Données invalides' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};