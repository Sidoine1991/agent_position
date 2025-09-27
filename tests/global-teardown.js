// Nettoyage global après les tests
async function globalTeardown(config) {
  console.log('🧹 Nettoyage des tests automatisés');
  
  // Générer un rapport de synthèse
  const fs = require('fs');
  const path = require('path');
  
  const resultsFile = path.join(__dirname, '..', 'test-results', 'results.json');
  
  if (fs.existsSync(resultsFile)) {
    try {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      
      const summary = {
        total: results.stats?.total || 0,
        passed: results.stats?.passed || 0,
        failed: results.stats?.failed || 0,
        skipped: results.stats?.skipped || 0,
        duration: results.stats?.duration || 0
      };
      
      console.log('📊 Résumé des tests:');
      console.log(`   Total: ${summary.total}`);
      console.log(`   Réussis: ${summary.passed}`);
      console.log(`   Échoués: ${summary.failed}`);
      console.log(`   Ignorés: ${summary.skipped}`);
      console.log(`   Durée: ${Math.round(summary.duration / 1000)}s`);
      
      // Écrire le résumé
      const summaryFile = path.join(__dirname, '..', 'test-results', 'summary.json');
      fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
      
    } catch (error) {
      console.log('⚠️ Erreur lors de la génération du résumé:', error.message);
    }
  }
  
  console.log('✅ Nettoyage terminé');
  console.log('📁 Résultats disponibles dans: test-results/');
}

module.exports = globalTeardown;
