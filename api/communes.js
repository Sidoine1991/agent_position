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
    const depId = Number(req.query.departement_id);
    
    if (!depId) {
      return res.status(400).json({ error: 'departement_id is required' });
    }

    const departement = geoData.departements.find(d => d.id === depId);
    if (!departement) {
      return res.status(404).json({ error: 'Département non trouvé' });
    }

    const communes = geoData.communes[departement.name] || [];
    res.json(communes);
  } catch (error) {
    console.error('Erreur lors du chargement des communes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
