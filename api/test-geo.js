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

  res.json({ 
    message: 'API géographique fonctionne !',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/geo/departements',
      '/api/geo/communes',
      '/api/geo/arrondissements', 
      '/api/geo/villages',
      '/api/init-geo-data'
    ]
  });
};
