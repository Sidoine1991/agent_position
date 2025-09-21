// Données géographiques du Bénin
const geoData = {
  "departements": [
    { "id": 1, "name": "Atlantique" },
    { "id": 2, "name": "Borgou" },
    { "id": 3, "name": "Collines" },
    { "id": 4, "name": "Couffo" },
    { "id": 5, "name": "Donga" },
    { "id": 6, "name": "Littoral" },
    { "id": 7, "name": "Mono" },
    { "id": 8, "name": "Ouémé" },
    { "id": 9, "name": "Plateau" },
    { "id": 10, "name": "Zou" }
  ],
  "communes": {
    "Atlantique": [
      { "id": 1, "name": "Abomey-Calavi" },
      { "id": 2, "name": "Allada" },
      { "id": 3, "name": "Kpomassè" },
      { "id": 4, "name": "Ouidah" },
      { "id": 5, "name": "Sô-Ava" },
      { "id": 6, "name": "Toffo" },
      { "id": 7, "name": "Tori-Bossito" },
      { "id": 8, "name": "Zè" }
    ],
    "Borgou": [
      { "id": 9, "name": "Bembèrèkè" },
      { "id": 10, "name": "Kalalé" },
      { "id": 11, "name": "N'Dali" },
      { "id": 12, "name": "Nikki" },
      { "id": 13, "name": "Parakou" },
      { "id": 14, "name": "Pèrèrè" },
      { "id": 15, "name": "Sinendé" },
      { "id": 16, "name": "Tchaourou" }
    ],
    "Collines": [
      { "id": 17, "name": "Bantè" },
      { "id": 18, "name": "Dassa-Zoumè" },
      { "id": 19, "name": "Glazoué" },
      { "id": 20, "name": "Ouèssè" },
      { "id": 21, "name": "Savalou" },
      { "id": 22, "name": "Savè" }
    ],
    "Couffo": [
      { "id": 23, "name": "Aplahoué" },
      { "id": 24, "name": "Djakotomey" },
      { "id": 25, "name": "Klouékanmè" },
      { "id": 26, "name": "Lalo" },
      { "id": 27, "name": "Toviklin" }
    ],
    "Donga": [
      { "id": 28, "name": "Bassila" },
      { "id": 29, "name": "Copargo" },
      { "id": 30, "name": "Djougou" },
      { "id": 31, "name": "Ouaké" }
    ],
    "Littoral": [
      { "id": 32, "name": "Cotonou" }
    ],
    "Mono": [
      { "id": 33, "name": "Athiémé" },
      { "id": 34, "name": "Bopa" },
      { "id": 35, "name": "Comè" },
      { "id": 36, "name": "Grand-Popo" },
      { "id": 37, "name": "Houéyogbé" },
      { "id": 38, "name": "Lokossa" }
    ],
    "Ouémé": [
      { "id": 39, "name": "Adjarra" },
      { "id": 40, "name": "Adjohoun" },
      { "id": 41, "name": "Aguégués" },
      { "id": 42, "name": "Akpro-Missérété" },
      { "id": 43, "name": "Avrankou" },
      { "id": 44, "name": "Bonou" },
      { "id": 45, "name": "Dangbo" },
      { "id": 46, "name": "Porto-Novo" },
      { "id": 47, "name": "Sèmè-Kpodji" }
    ],
    "Plateau": [
      { "id": 48, "name": "Adja-Ouèrè" },
      { "id": 49, "name": "Ifangni" },
      { "id": 50, "name": "Kétou" },
      { "id": 51, "name": "Pobè" },
      { "id": 52, "name": "Sakété" }
    ],
    "Zou": [
      { "id": 53, "name": "Abomey" },
      { "id": 54, "name": "Agbangnizoun" },
      { "id": 55, "name": "Bohicon" },
      { "id": 56, "name": "Cové" },
      { "id": 57, "name": "Djidja" },
      { "id": 58, "name": "Ouinhi" },
      { "id": 59, "name": "Zangnanado" },
      { "id": 60, "name": "Za-Kpota" },
      { "id": 61, "name": "Zogbodomey" }
    ]
  },
  "arrondissements": {},
  "villages": {}
};

export function getDepartements() {
  return geoData.departements;
}

export function getCommunes(departementId) {
  const departement = geoData.departements.find(d => d.id === departementId);
  if (!departement) return [];
  return geoData.communes[departement.name] || [];
}

export function getArrondissements(communeId) {
  // Pour simplifier, retourner des arrondissements génériques
  return [
    { "id": 1, "name": "Arrondissement 1" },
    { "id": 2, "name": "Arrondissement 2" },
    { "id": 3, "name": "Arrondissement 3" }
  ];
}

export function getVillages(arrondissementId) {
  // Pour simplifier, retourner des villages génériques
  return [
    { "id": 1, "name": "Village 1" },
    { "id": 2, "name": "Village 2" },
    { "id": 3, "name": "Village 3" },
    { "id": 4, "name": "Village 4" },
    { "id": 5, "name": "Village 5" }
  ];
}
