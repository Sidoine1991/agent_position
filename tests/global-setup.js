// Configuration globale pour les tests
async function globalSetup(config) {
  console.log('🚀 Démarrage des tests automatisés Presence CCRB');
  
  // Vérifier que le serveur est accessible
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';
  
  try {
    const response = await fetch(`${baseURL}/api/health`);
    if (response.ok) {
      console.log('✅ Serveur accessible:', baseURL);
    } else {
      console.log('⚠️ Serveur accessible mais API non fonctionnelle');
    }
  } catch (error) {
    console.log('❌ Serveur non accessible:', baseURL);
    console.log('💡 Assurez-vous que le serveur est démarré avec: npm start');
  }
  
  // Créer le dossier de résultats
  const fs = require('fs');
  const path = require('path');
  
  const resultsDir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
    console.log('📁 Dossier de résultats créé:', resultsDir);
  }
  
  console.log('🎯 Configuration globale terminée');
}

module.exports = globalSetup;
