// Données géographiques complètes du Bénin
const geoData = {
  departements: [
    { id: 1, name: "Alibori" },
    { id: 2, name: "Atacora" },
    { id: 3, name: "Atlantique" },
    { id: 4, name: "Borgou" },
    { id: 5, name: "Collines" },
    { id: 6, name: "Couffo" },
    { id: 7, name: "Donga" },
    { id: 8, name: "Littoral" },
    { id: 9, name: "Mono" },
    { id: 10, name: "Ouémé" },
    { id: 11, name: "Plateau" },
    { id: 12, name: "Zou" }
  ],
  communes: {
    "Alibori": [
      { id: 1, name: "Banikoara" },
      { id: 2, name: "Gogounou" },
      { id: 3, name: "Kandi" },
      { id: 4, name: "Karimama" },
      { id: 5, name: "Malanville" },
      { id: 6, name: "Segbana" }
    ],
    "Atacora": [
      { id: 7, name: "Boukoumbé" },
      { id: 8, name: "Cobly" },
      { id: 9, name: "Kérou" },
      { id: 10, name: "Kouandé" },
      { id: 11, name: "Matéri" },
      { id: 12, name: "Natitingou" },
      { id: 13, name: "Pehonko" },
      { id: 14, name: "Tanguiéta" },
      { id: 15, name: "Toucountouna" }
    ],
    "Atlantique": [
      { id: 16, name: "Abomey-Calavi" },
      { id: 17, name: "Allada" },
      { id: 18, name: "Kpomassè" },
      { id: 19, name: "Ouidah" },
      { id: 20, name: "Sô-Ava" },
      { id: 21, name: "Toffo" },
      { id: 22, name: "Tori-Bossito" },
      { id: 23, name: "Zè" }
    ],
    "Borgou": [
      { id: 24, name: "Bembèrèkè" },
      { id: 25, name: "Kalalé" },
      { id: 26, name: "N'Dali" },
      { id: 27, name: "Nikki" },
      { id: 28, name: "Parakou" },
      { id: 29, name: "Pèrèrè" },
      { id: 30, name: "Sinendé" },
      { id: 31, name: "Tchaourou" }
    ],
    "Collines": [
      { id: 32, name: "Bantè" },
      { id: 33, name: "Dassa-Zoumè" },
      { id: 34, name: "Glazoué" },
      { id: 35, name: "Ouèssè" },
      { id: 36, name: "Savalou" },
      { id: 37, name: "Savé" }
    ],
    "Couffo": [
      { id: 38, name: "Aplahoué" },
      { id: 39, name: "Djakotomey" },
      { id: 40, name: "Klouékanmè" },
      { id: 41, name: "Lalo" },
      { id: 42, name: "Toviklin" }
    ],
    "Donga": [
      { id: 43, name: "Bassila" },
      { id: 44, name: "Copargo" },
      { id: 45, name: "Djougou" },
      { id: 46, name: "Ouaké" }
    ],
    "Littoral": [
      { id: 47, name: "Cotonou" }
    ],
    "Mono": [
      { id: 48, name: "Athiémé" },
      { id: 49, name: "Bopa" },
      { id: 50, name: "Comè" },
      { id: 51, name: "Grand-Popo" },
      { id: 52, name: "Houéyogbé" },
      { id: 53, name: "Lokossa" }
    ],
    "Ouémé": [
      { id: 54, name: "Adjarra" },
      { id: 55, name: "Adjohoun" },
      { id: 56, name: "Aguégués" },
      { id: 57, name: "Akpro-Missérété" },
      { id: 58, name: "Avrankou" },
      { id: 59, name: "Bonou" },
      { id: 60, name: "Dangbo" },
      { id: 61, name: "Porto-Novo" },
      { id: 62, name: "Sèmè-Kpodji" }
    ],
    "Plateau": [
      { id: 63, name: "Adja-Ouèrè" },
      { id: 64, name: "Ifangni" },
      { id: 65, name: "Kétou" },
      { id: 66, name: "Pobè" },
      { id: 67, name: "Sakété" }
    ],
    "Zou": [
      { id: 68, name: "Abomey" },
      { id: 69, name: "Agbangnizoun" },
      { id: 70, name: "Bohicon" },
      { id: 71, name: "Covè" },
      { id: 72, name: "Djidja" },
      { id: 73, name: "Ouinhi" },
      { id: 74, name: "Zagnanado" },
      { id: 75, name: "Za-Kpota" },
      { id: 76, name: "Zogbodomey" }
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
    ],
    "Parakou": [
      { id: 19, name: "1er Arrondissement" },
      { id: 20, name: "2ème Arrondissement" },
      { id: 21, name: "3ème Arrondissement" }
    ],
    "Abomey": [
      { id: 22, name: "1er Arrondissement" },
      { id: 23, name: "2ème Arrondissement" },
      { id: 24, name: "3ème Arrondissement" }
    ],
    "Bohicon": [
      { id: 25, name: "1er Arrondissement" },
      { id: 26, name: "2ème Arrondissement" }
    ]
  },
  villages: {
    "1er Arrondissement": [
      { id: 1, name: "Centre-ville" },
      { id: 2, name: "Ganhi" },
      { id: 3, name: "Gbegamey" },
      { id: 4, name: "Tokan" }
    ],
    "2ème Arrondissement": [
      { id: 5, name: "Akpakpa" },
      { id: 6, name: "Cadjehoun" },
      { id: 7, name: "Fidjrossè" },
      { id: 8, name: "Ganhi" }
    ],
    "3ème Arrondissement": [
      { id: 9, name: "Agblangandan" },
      { id: 10, name: "Aïdjedo" },
      { id: 11, name: "Akpakpa" },
      { id: 12, name: "Cotonou-Gare" }
    ],
    "1er Arrondissement": [
      { id: 13, name: "Centre-ville" },
      { id: 14, name: "Ganhi" },
      { id: 15, name: "Gbegamey" }
    ],
    "2ème Arrondissement": [
      { id: 16, name: "Akpakpa" },
      { id: 17, name: "Cadjehoun" },
      { id: 18, name: "Fidjrossè" }
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
