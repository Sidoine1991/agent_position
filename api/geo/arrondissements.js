const geoData = require('../geo-data');

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
    const communeId = Number(req.query.commune_id);
    
    if (!communeId) {
      return res.status(400).json({ error: 'commune_id is required' });
    }

    // Trouver la commune par ID dans tous les départements
    let commune = null;
    for (const [depName, communes] of Object.entries(geoData.communes)) {
      commune = communes.find(c => c.id === communeId);
      if (commune) break;
    }

    if (!commune) {
      return res.status(404).json({ error: 'Commune non trouvée' });
    }

    const arrondissements = geoData.arrondissements[commune.name] || [];
    res.json(arrondissements);
  } catch (error) {
    console.error('Erreur lors du chargement des arrondissements:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
