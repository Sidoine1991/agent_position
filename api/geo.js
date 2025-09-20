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
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const searchParams = url.searchParams;

    console.log('Geo API called:', path, searchParams.toString());

    if (path === '/api/geo/departements') {
      res.json(geoData.departements);
    } 
    else if (path === '/api/geo/communes') {
      const depId = Number(searchParams.get('departement_id'));
      
      if (!depId) {
        return res.status(400).json({ error: 'departement_id is required' });
      }

      const departement = geoData.departements.find(d => d.id === depId);
      if (!departement) {
        return res.status(404).json({ error: 'Département non trouvé' });
      }

      const communes = geoData.communes[departement.name] || [];
      res.json(communes);
    }
    else if (path === '/api/geo/arrondissements') {
      const communeId = Number(searchParams.get('commune_id'));
      
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
    }
    else if (path === '/api/geo/villages') {
      const arrondissementId = Number(searchParams.get('arrondissement_id'));
      
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
    }
    else {
      res.status(404).json({ error: 'Endpoint non trouvé' });
    }
  } catch (error) {
    console.error('Erreur dans geo.js:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
