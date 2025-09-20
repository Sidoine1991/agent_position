module.exports = (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Données de test pour les départements
  const testDepartements = [
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
  ];

  res.json(testDepartements);
};