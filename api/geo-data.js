// Données géographiques du Bénin extraites du fichier Excel
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
    { id: 10, name: "Zou" }
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
      { id: 1, name: "Kérou" },
      { id: 2, name: "Kouandé" },
      { id: 3, name: "Matéri" },
      { id: 4, name: "Natitingou" },
      { id: 5, name: "Péhunco" },
      { id: 6, name: "Tanguiéta" },
      { id: 7, name: "Toucountouna" }
    ],
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
    "Borgou": [
      { id: 1, name: "Bembèrèkè" },
      { id: 2, name: "Kalalé" },
      { id: 3, name: "N'Dali" },
      { id: 4, name: "Nikki" },
      { id: 5, name: "Parakou" },
      { id: 6, name: "Pèrèrè" },
      { id: 7, name: "Sinendé" },
      { id: 8, name: "Tchaourou" }
    ],
    "Collines": [
      { id: 1, name: "Bantè" },
      { id: 2, name: "Dassa-Zoumè" },
      { id: 3, name: "Glazoué" },
      { id: 4, name: "Ouèssè" },
      { id: 5, name: "Savalou" },
      { id: 6, name: "Savé" }
    ],
    "Couffo": [
      { id: 1, name: "Aplahoué" },
      { id: 2, name: "Djakotomey" },
      { id: 3, name: "Klouékanmè" },
      { id: 4, name: "Lalo" },
      { id: 5, name: "Toviklin" }
    ],
    "Donga": [
      { id: 1, name: "Bassila" },
      { id: 2, name: "Copargo" },
      { id: 3, name: "Djougou" },
      { id: 4, name: "Ouaké" }
    ],
    "Littoral": [
      { id: 1, name: "Cotonou" }
    ],
    "Mono": [
      { id: 1, name: "Athiémé" },
      { id: 2, name: "Bopa" },
      { id: 3, name: "Comè" },
      { id: 4, name: "Grand-Popo" },
      { id: 5, name: "Houéyogbé" },
      { id: 6, name: "Lokossa" }
    ],
    "Ouémé": [
      { id: 1, name: "Adjarra" },
      { id: 2, name: "Adjohoun" },
      { id: 3, name: "Aguégués" },
      { id: 4, name: "Akpro-Missérété" },
      { id: 5, name: "Avrankou" },
      { id: 6, name: "Bonou" },
      { id: 7, name: "Dangbo" },
      { id: 8, name: "Porto-Novo" },
      { id: 9, name: "Sèmè-Kpodji" }
    ],
    "Plateau": [
      { id: 1, name: "Adja-Ouèrè" },
      { id: 2, name: "Ifangni" },
      { id: 3, name: "Kétou" },
      { id: 4, name: "Pobè" },
      { id: 5, name: "Sakété" }
    ],
    "Zou": [
      { id: 1, name: "Abomey" },
      { id: 2, name: "Agbangnizoun" },
      { id: 3, name: "Bohicon" },
      { id: 4, name: "Covè" },
      { id: 5, name: "Djidja" },
      { id: 6, name: "Ouinhi" },
      { id: 7, name: "Zangnanado" },
      { id: 8, name: "Za-Kpota" },
      { id: 9, name: "Zogbodomey" }
    ]
  },

  arrondissements: {
    "Banikoara": [
      { id: 1, name: "Banikoara_Banikoara" },
      { id: 2, name: "Founougo_Banikoara" },
      { id: 3, name: "Gomparou_Banikoara" },
      { id: 4, name: "Goumori_Banikoara" },
      { id: 5, name: "Ouénou_Banikoara" }
    ],
    "Abomey-Calavi": [
      { id: 1, name: "Abomey-Calavi_Abomey-Calavi" },
      { id: 2, name: "Akassato_Abomey-Calavi" },
      { id: 3, name: "Godomey_Abomey-Calavi" },
      { id: 4, name: "Hêvié_Abomey-Calavi" },
      { id: 5, name: "Hinvi_Abomey-Calavi" },
      { id: 6, name: "Kpanroun_Abomey-Calavi" },
      { id: 7, name: "Sèmè-Kpodji_Abomey-Calavi" }
    ],
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
    ]
  },

  villages: {
    "Banikoara_Banikoara": [
      { id: 1, name: "Banikoara" },
      { id: 2, name: "Bembèrèkè" },
      { id: 3, name: "Dèmè" },
      { id: 4, name: "Gourou" }
    ],
    "Abomey-Calavi_Abomey-Calavi": [
      { id: 1, name: "Abomey-Calavi" },
      { id: 2, name: "Akassato" },
      { id: 3, name: "Godomey" },
      { id: 4, name: "Hêvié" }
    ],
    "1er Arrondissement": [
      { id: 1, name: "Centre" },
      { id: 2, name: "Ganhi" },
      { id: 3, name: "Gbegamey" },
      { id: 4, name: "Houéyiho" }
    ]
  }
};

module.exports = geoData;
