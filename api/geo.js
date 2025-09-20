const geoData = require('./geo-data');

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

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const params = url.searchParams;

  try {
    if (path === '/api/geo/departements') {
      // Retourner tous les départements
      res.json(geoData.departements);
      
    } else if (path === '/api/geo/communes') {
      // Retourner les communes d'un département
      const depId = Number(params.get('departement_id'));
      
      if (!depId) {
        return res.status(400).json({ error: 'departement_id is required' });
      }

      const departement = geoData.departements.find(d => d.id === depId);
      if (!departement) {
        return res.status(404).json({ error: 'Département non trouvé' });
      }

      const communes = geoData.communes[departement.name] || [];
      res.json(communes);
      
    } else if (path === '/api/geo/arrondissements') {
      // Retourner les arrondissements d'une commune
      const communeId = Number(params.get('commune_id'));
      
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
      
    } else if (path === '/api/geo/villages') {
      // Retourner les villages d'un arrondissement
      const arrondissementId = Number(params.get('arrondissement_id'));
      
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

      const villages = geoData.villages[arrondissement.name] || [];
      res.json(villages);
      
    } else {
      // Endpoint non trouvé
      res.status(404).json({ error: 'Endpoint non trouvé' });
    }
    
  } catch (error) {
    console.error('Error in geo endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
