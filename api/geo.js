// Données géographiques intégrées pour éviter les dépendances
const geoData = {
  departements: [
    { id: 1, name: "Atlantique" },
    { id: 2, name: "Borgou" },
    { id: 3, name: "Collines" },
    { id: 4, name: "Couffo" },
    { id: 5, name: "Donga" },
    { id: 6, name: "Littoral" },
    { id: 7, name: "Mono" },
    { id: 8, name: "Ouémé" },
    { id: 9, name: "Plateau" },
    { id: 10, name: "Zou" },
    { id: 11, name: "Alibori" },
    { id: 12, name: "Atacora" }
  ],
  communes: {
    "Atlantique": [
      { id: 1, name: "Abomey-Calavi" },
      { id: 2, name: "Allada" },
      { id: 3, name: "Kpomassè" },
      { id: 4, name: "Ouidah" },
      { id: 5, name: "Sô-Ava" },
      { id: 6, name: "Toffo" },
      { id: 7, name: "Tori-Bossito" },
      { id: 8, name: "Zè" }
    ],
    "Littoral": [
      { id: 9, name: "Cotonou" }
    ],
    "Ouémé": [
      { id: 10, name: "Adjarra" },
      { id: 11, name: "Adjohoun" },
      { id: 12, name: "Aguégués" },
      { id: 13, name: "Akpro-Missérété" },
      { id: 14, name: "Avrankou" },
      { id: 15, name: "Bonou" },
      { id: 16, name: "Dangbo" },
      { id: 17, name: "Porto-Novo" },
      { id: 18, name: "Sèmè-Kpodji" }
    ]
  },
  arrondissements: {
    "Cotonou": [
      { id: 1, name: "1er Arrondissement" },
      { id: 2, name: "2ème Arrondissement" },
      { id: 3, name: "3ème Arrondissement" },
      { id: 4, name: "4ème Arrondissement" },
      { id: 5, name: "5ème Arrondissement" },
      { id: 6, name: "6ème Arrondissement" },
      { id: 7, name: "7ème Arrondissement" },
      { id: 8, name: "8ème Arrondissement" },
      { id: 9, name: "9ème Arrondissement" },
      { id: 10, name: "10ème Arrondissement" },
      { id: 11, name: "11ème Arrondissement" },
      { id: 12, name: "12ème Arrondissement" },
      { id: 13, name: "13ème Arrondissement" }
    ],
    "Porto-Novo": [
      { id: 14, name: "1er Arrondissement" },
      { id: 15, name: "2ème Arrondissement" },
      { id: 16, name: "3ème Arrondissement" },
      { id: 17, name: "4ème Arrondissement" },
      { id: 18, name: "5ème Arrondissement" }
    ]
  },
  villages: {
    "1er Arrondissement": [
      { id: 1, name: "Centre-ville" },
      { id: 2, name: "Ganhi" },
      { id: 3, name: "Gbegamey" }
    ],
    "2ème Arrondissement": [
      { id: 4, name: "Akpakpa" },
      { id: 5, name: "Cadjehoun" },
      { id: 6, name: "Fidjrossè" }
    ]
  }
};

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
