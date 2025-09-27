// Script de lancement des tests automatisés
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Lancement des tests automatisés Presence CCRB');
console.log('=' .repeat(50));

// Vérifier que Playwright est installé
try {
  require('@playwright/test');
  console.log('✅ Playwright installé');
} catch (error) {
  console.log('❌ Playwright non installé. Installation...');
  execSync('npm install --save-dev @playwright/test', { stdio: 'inherit' });
  execSync('npx playwright install', { stdio: 'inherit' });
}

// Créer le dossier de résultats
const resultsDir = path.join(__dirname, 'test-results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Options de test
const testOptions = {
  // Test local
  local: {
    command: 'npx playwright test --project=chromium',
    description: 'Test local sur Chrome'
  },
  
  // Test multi-navigateurs
  all: {
    command: 'npx playwright test',
    description: 'Test sur tous les navigateurs'
  },
  
  // Test mobile
  mobile: {
    command: 'npx playwright test --project="Mobile Chrome"',
    description: 'Test sur mobile'
  },
  
  // Test Vercel
  vercel: {
    command: 'npx playwright test --grep="Test déploiement Vercel"',
    description: 'Test spécifique Vercel'
  },
  
  // Test avec interface
  ui: {
    command: 'npx playwright test --ui',
    description: 'Test avec interface graphique'
  }
};

// Fonction pour exécuter les tests
function runTests(testType) {
  const option = testOptions[testType];
  
  if (!option) {
    console.log('❌ Type de test invalide. Options disponibles:');
    Object.keys(testOptions).forEach(key => {
      console.log(`   ${key}: ${testOptions[key].description}`);
    });
    return;
  }
  
  console.log(`🎯 ${option.description}`);
  console.log(`📝 Commande: ${option.command}`);
  console.log('-'.repeat(50));
  
  try {
    execSync(option.command, { 
      stdio: 'inherit',
      cwd: __dirname
    });
    
    console.log('✅ Tests terminés avec succès');
    
    // Afficher les résultats
    const resultsFile = path.join(resultsDir, 'results.json');
    if (fs.existsSync(resultsFile)) {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      console.log('📊 Résultats:');
      console.log(`   Total: ${results.stats?.total || 0}`);
      console.log(`   Réussis: ${results.stats?.passed || 0}`);
      console.log(`   Échoués: ${results.stats?.failed || 0}`);
    }
    
  } catch (error) {
    console.log('❌ Erreur lors des tests:', error.message);
    process.exit(1);
  }
}

// Gestion des arguments
const args = process.argv.slice(2);
const testType = args[0] || 'local';

// Afficher les options
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node test-runner.js [type]');
  console.log('');
  console.log('Types de tests disponibles:');
  Object.keys(testOptions).forEach(key => {
    console.log(`   ${key}: ${testOptions[key].description}`);
  });
  console.log('');
  console.log('Exemples:');
  console.log('   node test-runner.js local    # Test local');
  console.log('   node test-runner.js all      # Tous les navigateurs');
  console.log('   node test-runner.js mobile   # Test mobile');
  console.log('   node test-runner.js vercel   # Test Vercel');
  console.log('   node test-runner.js ui       # Interface graphique');
  process.exit(0);
}

// Exécuter les tests
runTests(testType);
