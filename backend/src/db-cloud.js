const { Pool } = require('pg');

// Configuration de la base de données avec gestion d'erreur
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dbccrb_user:THMWBv1Ur2hP1XyNJExmemPodp0pzeV6@dpg-d37s6vmmcj7s73fs2chg-a.oregon-postgres.render.com/dbccrb',
  ssl: { 
    rejectUnauthorized: false,
    require: true
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test de connexion avec gestion d'erreur
db.connect()
  .then(() => console.log('✅ Connexion PostgreSQL réussie'))
  .catch(err => {
    console.error('❌ Erreur de connexion PostgreSQL:', err.message);
    // Ne pas arrêter l'application, continuer avec des données par défaut
  });

// Obtenir tous les départements
async function getDepartements() {
  try {
    const result = await db.query('SELECT * FROM departements ORDER BY nom');
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des départements:', error);
    // Retourner des données par défaut si la base n'est pas accessible
    return [
      { id: 1, nom: 'Atlantique' },
      { id: 2, nom: 'Littoral' },
      { id: 3, nom: 'Ouémé' },
      { id: 4, nom: 'Plateau' },
      { id: 5, nom: 'Zou' },
      { id: 6, nom: 'Collines' },
      { id: 7, nom: 'Donga' },
      { id: 8, nom: 'Borgou' },
      { id: 9, nom: 'Alibori' },
      { id: 10, nom: 'Atacora' },
      { id: 11, nom: 'Couffo' },
      { id: 12, nom: 'Mono' }
    ];
  }
}

// Obtenir les communes d'un département
async function getCommunes(departementId) {
  try {
    const result = await db.query(
      'SELECT * FROM communes WHERE departement_id = $1 ORDER BY nom',
      [departementId]
    );
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des communes:', error);
    // Retourner des communes par défaut selon le département
    const communesParDefaut = {
      1: [{ id: 1, nom: 'Abomey-Calavi' }, { id: 2, nom: 'Allada' }, { id: 3, nom: 'Ouidah' }],
      2: [{ id: 4, nom: 'Cotonou' }],
      3: [{ id: 5, nom: 'Porto-Novo' }, { id: 6, nom: 'Adjohoun' }, { id: 7, nom: 'Avrankou' }],
      4: [{ id: 8, nom: 'Pobè' }, { id: 9, nom: 'Adja-Ouèrè' }, { id: 10, nom: 'Ifangni' }],
      5: [{ id: 11, nom: 'Abomey' }, { id: 12, nom: 'Bohicon' }, { id: 13, nom: 'Cové' }],
      6: [{ id: 14, nom: 'Savè' }, { id: 15, nom: 'Dassa-Zoumè' }, { id: 16, nom: 'Glazoué' }],
      7: [{ id: 17, nom: 'Djougou' }, { id: 18, nom: 'Bassila' }, { id: 19, nom: 'Copargo' }],
      8: [{ id: 20, nom: 'Parakou' }, { id: 21, nom: 'Nikki' }, { id: 22, nom: 'Pèrèrè' }],
      9: [{ id: 23, nom: 'Kandi' }, { id: 24, nom: 'Gogounou' }, { id: 25, nom: 'Banikoara' }],
      10: [{ id: 26, nom: 'Natitingou' }, { id: 27, nom: 'Toucountouna' }, { id: 28, nom: 'Kérou' }],
      11: [{ id: 29, nom: 'Aplahoué' }, { id: 30, nom: 'Djakotomey' }, { id: 31, nom: 'Klouékanmè' }],
      12: [{ id: 32, nom: 'Lokossa' }, { id: 33, nom: 'Bopa' }, { id: 34, nom: 'Comè' }]
    };
    return communesParDefaut[departementId] || [];
  }
}

// Obtenir les arrondissements d'une commune
async function getArrondissements(communeId) {
  try {
    const result = await db.query(
      'SELECT * FROM arrondissements WHERE commune_id = $1 ORDER BY nom',
      [communeId]
    );
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des arrondissements:', error);
    // Retourner des arrondissements par défaut
    return [
      { id: 1, nom: 'Arrondissement 1' },
      { id: 2, nom: 'Arrondissement 2' },
      { id: 3, nom: 'Arrondissement 3' }
    ];
  }
}

// Obtenir les villages d'un arrondissement
async function getVillages(arrondissementId) {
  try {
    const result = await db.query(
      'SELECT * FROM villages WHERE arrondissement_id = $1 ORDER BY nom',
      [arrondissementId]
    );
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des villages:', error);
    // Retourner des villages par défaut
    return [
      { id: 1, nom: 'Village 1', lat: 6.3667, lng: 2.4333 },
      { id: 2, nom: 'Village 2', lat: 6.4000, lng: 2.4500 },
      { id: 3, nom: 'Village 3', lat: 6.3500, lng: 2.4000 }
    ];
  }
}

module.exports = {
  getDepartements,
  getCommunes,
  getArrondissements,
  getVillages
};