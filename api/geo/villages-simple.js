const geoData = require('../geo-data');

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

  const arrondissementId = Number(req.query.arrondissement_id);
  
  if (!arrondissementId) {
    return res.status(400).json({ error: 'arrondissement_id is required' });
  }

  // Trouver l'arrondissement par ID dans toutes les communes
  let arrondissement = null;
  for (const [communeName, arrondissements] of Object.entries(geoData.arrondissements)) {
    arrondissement = arrondissements.find(a => a.id === arrondissementId);
    if (arrondissement) break;
  }

  if (!arrondissement) {
    return res.status(404).json({ error: 'Arrondissement non trouvé' });
  }

  // Retourner les villages de l'arrondissement
  const villages = geoData.villages[arrondissement.name] || [];
  res.json(villages);
};
