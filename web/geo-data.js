// Données géographiques pour le frontend - Mises à jour avec les 12 départements du Bénin
window.geoData = {
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
    1: [ // Alibori
      { id: 1, name: "Banikoara" },
      { id: 2, name: "Gogounou" },
      { id: 3, name: "Kandi" },
      { id: 4, name: "Karimama" },
      { id: 5, name: "Malanville" },
      { id: 6, name: "Segbana" }
    ],
    2: [ // Atacora
      { id: 7, name: "Kérou" },
      { id: 8, name: "Kouandé" },
      { id: 9, name: "Matéri" },
      { id: 10, name: "Natitingou" },
      { id: 11, name: "Péhunco" },
      { id: 12, name: "Tanguiéta" },
      { id: 13, name: "Toucountouna" }
    ],
    3: [ // Atlantique
      { id: 14, name: "Abomey-Calavi" },
      { id: 15, name: "Allada" },
      { id: 16, name: "Kpomassè" },
      { id: 17, name: "Ouidah" },
      { id: 18, name: "Sô-Ava" },
      { id: 19, name: "Toffo" },
      { id: 20, name: "Tori-Bossito" },
      { id: 21, name: "Zè" }
    ],
    4: [ // Borgou
      { id: 22, name: "Bembèrèkè" },
      { id: 23, name: "Kalalé" },
      { id: 24, name: "N'Dali" },
      { id: 25, name: "Nikki" },
      { id: 26, name: "Parakou" },
      { id: 27, name: "Pèrèrè" },
      { id: 28, name: "Sinendé" },
      { id: 29, name: "Tchaourou" }
    ],
    3: [ // Collines
      { id: 17, name: "Bantè" },
      { id: 18, name: "Dassa-Zoumè" },
      { id: 19, name: "Glazoué" },
      { id: 20, name: "Ouèssè" },
      { id: 21, name: "Savalou" },
      { id: 22, name: "Savé" }
    ],
    4: [ // Couffo
      { id: 23, name: "Aplahoué" },
      { id: 24, name: "Djakotomey" },
      { id: 25, name: "Klouékanmè" },
      { id: 26, name: "Lalo" },
      { id: 27, name: "Toviklin" }
    ],
    5: [ // Donga
      { id: 28, name: "Bassila" },
      { id: 29, name: "Copargo" },
      { id: 30, name: "Djougou" },
      { id: 31, name: "Ouaké" }
    ],
    6: [ // Littoral
      { id: 32, name: "Cotonou" }
    ],
    7: [ // Mono
      { id: 33, name: "Athiémé" },
      { id: 34, name: "Bopa" },
      { id: 35, name: "Comè" },
      { id: 36, name: "Grand-Popo" },
      { id: 37, name: "Houéyogbé" },
      { id: 38, name: "Lokossa" }
    ],
    8: [ // Ouémé
      { id: 39, name: "Adjarra" },
      { id: 40, name: "Adjohoun" },
      { id: 41, name: "Aguégués" },
      { id: 42, name: "Akpro-Missérété" },
      { id: 43, name: "Avrankou" },
      { id: 44, name: "Bonou" },
      { id: 45, name: "Dangbo" },
      { id: 46, name: "Porto-Novo" },
      { id: 47, name: "Sèmè-Kpodji" }
    ],
    9: [ // Plateau
      { id: 48, name: "Adja-Ouèrè" },
      { id: 49, name: "Ifangni" },
      { id: 50, name: "Kétou" },
      { id: 51, name: "Pobè" },
      { id: 52, name: "Sakété" }
    ],
    10: [ // Zou
      { id: 53, name: "Abomey" },
      { id: 54, name: "Agbangnizoun" },
      { id: 55, name: "Bohicon" },
      { id: 56, name: "Covè" },
      { id: 57, name: "Djidja" },
      { id: 58, name: "Ouinhi" },
      { id: 59, name: "Zangnanado" },
      { id: 60, name: "Za-Kpota" },
      { id: 61, name: "Zogbodomey" }
    ],
    11: [ // Alibori
      { id: 62, name: "Banikoara" },
      { id: 63, name: "Gogounou" },
      { id: 64, name: "Kandi" },
      { id: 65, name: "Karimama" },
      { id: 66, name: "Malanville" },
      { id: 67, name: "Ségbana" }
    ],
    12: [ // Atacora
      { id: 68, name: "Boukoumbè" },
      { id: 69, name: "Cobly" },
      { id: 70, name: "Kérou" },
      { id: 71, name: "Kouandé" },
      { id: 72, name: "Matéri" },
      { id: 73, name: "Natitingou" },
      { id: 74, name: "Pehonko" },
      { id: 75, name: "Tanguiéta" },
      { id: 76, name: "Toucountouna" }
    ]
  },
  
  arrondissements: {
    1: [ // Abomey-Calavi
      { id: 1, name: "Abomey-Calavi Centre" },
      { id: 2, name: "Akassato" },
      { id: 3, name: "Godomey" },
      { id: 4, name: "Hêvié" },
      { id: 5, name: "Kpanroun" }
    ],
    2: [ // Allada
      { id: 6, name: "Allada Centre" },
      { id: 7, name: "Sékou" },
      { id: 8, name: "Togba" }
    ],
    3: [ // Kpomassè
      { id: 9, name: "Kpomassè Centre" },
      { id: 10, name: "Avlékété" }
    ],
    4: [ // Ouidah
      { id: 11, name: "Ouidah Centre" },
      { id: 12, name: "Djègbadji" },
      { id: 13, name: "Sèhouè" }
    ],
    5: [ // Sô-Ava
      { id: 14, name: "Sô-Ava Centre" },
      { id: 15, name: "Ganvié" }
    ],
    6: [ // Toffo
      { id: 16, name: "Toffo Centre" },
      { id: 17, name: "Dodji-Bata" }
    ],
    7: [ // Tori-Bossito
      { id: 18, name: "Tori-Bossito Centre" },
      { id: 19, name: "Avamè" }
    ],
    8: [ // Zè
      { id: 20, name: "Zè Centre" },
      { id: 21, name: "Djidja" }
    ],
    32: [ // Cotonou
      { id: 22, name: "1er Arrondissement" },
      { id: 23, name: "2ème Arrondissement" },
      { id: 24, name: "3ème Arrondissement" },
      { id: 25, name: "4ème Arrondissement" },
      { id: 26, name: "5ème Arrondissement" },
      { id: 27, name: "6ème Arrondissement" },
      { id: 28, name: "7ème Arrondissement" },
      { id: 29, name: "8ème Arrondissement" },
      { id: 30, name: "9ème Arrondissement" },
      { id: 31, name: "10ème Arrondissement" },
      { id: 32, name: "11ème Arrondissement" },
      { id: 33, name: "12ème Arrondissement" },
      { id: 34, name: "13ème Arrondissement" }
    ],
    46: [ // Porto-Novo
      { id: 35, name: "Porto-Novo Centre" },
      { id: 36, name: "Adjarra" },
      { id: 37, name: "Akpro-Missérété" }
    ],
    53: [ // Abomey
      { id: 38, name: "Abomey Centre" },
      { id: 39, name: "Agbangnizoun" }
    ],
    55: [ // Bohicon
      { id: 40, name: "Bohicon Centre" },
      { id: 41, name: "Covè" }
    ]
  },
  
  villages: {
    1: [ // Abomey-Calavi Centre
      { id: 1, name: "Abomey-Calavi" },
      { id: 2, name: "Akassato" },
      { id: 3, name: "Godomey" }
    ],
    2: [ // Akassato
      { id: 4, name: "Akassato Centre" },
      { id: 5, name: "Hêvié" }
    ],
    3: [ // Godomey
      { id: 6, name: "Godomey Centre" },
      { id: 7, name: "Kpanroun" }
    ],
    6: [ // Allada Centre
      { id: 8, name: "Allada Centre" },
      { id: 9, name: "Sékou" }
    ],
    7: [ // Sékou
      { id: 10, name: "Sékou Centre" },
      { id: 11, name: "Togba" }
    ],
    9: [ // Kpomassè Centre
      { id: 12, name: "Kpomassè Centre" },
      { id: 13, name: "Avlékété" }
    ],
    11: [ // Ouidah Centre
      { id: 14, name: "Ouidah Centre" },
      { id: 15, name: "Djègbadji" }
    ],
    12: [ // Djègbadji
      { id: 16, name: "Djègbadji Centre" },
      { id: 17, name: "Sèhouè" }
    ],
    14: [ // Sô-Ava Centre
      { id: 18, name: "Sô-Ava Centre" },
      { id: 19, name: "Ganvié" }
    ],
    16: [ // Toffo Centre
      { id: 20, name: "Toffo Centre" },
      { id: 21, name: "Dodji-Bata" }
    ],
    18: [ // Tori-Bossito Centre
      { id: 22, name: "Tori-Bossito Centre" },
      { id: 23, name: "Avamè" }
    ],
    20: [ // Zè Centre
      { id: 24, name: "Zè Centre" },
      { id: 25, name: "Djidja" }
    ],
    22: [ // 1er Arrondissement Cotonou
      { id: 26, name: "Cotonou Centre" },
      { id: 27, name: "Ganhi" },
      { id: 28, name: "Gbegamey" }
    ],
    23: [ // 2ème Arrondissement Cotonou
      { id: 29, name: "Cadjehoun" },
      { id: 30, name: "Fidjrossè" }
    ],
    24: [ // 3ème Arrondissement Cotonou
      { id: 31, name: "Gbegamey" },
      { id: 32, name: "Houéyiho" }
    ],
    35: [ // Porto-Novo Centre
      { id: 33, name: "Porto-Novo Centre" },
      { id: 34, name: "Adjarra" }
    ],
    36: [ // Adjarra
      { id: 35, name: "Adjarra Centre" },
      { id: 36, name: "Akpro-Missérété" }
    ],
    38: [ // Abomey Centre
      { id: 37, name: "Abomey Centre" },
      { id: 38, name: "Agbangnizoun" }
    ],
    40: [ // Bohicon Centre
      { id: 39, name: "Bohicon Centre" },
      { id: 40, name: "Covè" }
    ]
  }
};

// Fonctions pour récupérer les données
window.getDepartements = function() {
  return window.geoData.departements;
};

window.getCommunes = function(departementId) {
  return window.geoData.communes[departementId] || [];
};

window.getArrondissements = function(communeId) {
  return window.geoData.arrondissements[communeId] || [];
};

window.getVillages = function(arrondissementId) {
  return window.geoData.villages[arrondissementId] || [];
};
