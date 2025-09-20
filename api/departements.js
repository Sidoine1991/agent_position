const geoData = require('./geo-data');

module.exports = (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    res.json(geoData.departements);
  } catch (error) {
    console.error('Erreur lors du chargement des départements:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
