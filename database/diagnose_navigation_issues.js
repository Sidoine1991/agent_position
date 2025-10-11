const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnostic des problèmes de navigation...\n');

function diagnoseNavigationIssues() {
  try {
    // 1. Vérifier la structure HTML du dashboard
    console.log('1️⃣ Vérification de la structure HTML du dashboard...');
    
    const dashboardHtml = 'web/dashboard.html';
    if (fs.existsSync(dashboardHtml)) {
      const content = fs.readFileSync(dashboardHtml, 'utf8');
      
      // Vérifier le logo
      const logoMatch = content.match(/<img[^>]*class="navbar-logo"[^>]*>/);
      if (logoMatch) {
        console.log('✅ Logo trouvé dans dashboard.html:', logoMatch[0]);
      } else {
        console.log('❌ Logo non trouvé dans dashboard.html');
      }
      
      // Vérifier le lien présence
      const presenceLinkMatch = content.match(/<a[^>]*id="presence-link"[^>]*>/);
      if (presenceLinkMatch) {
        console.log('✅ Lien présence trouvé:', presenceLinkMatch[0]);
      } else {
        console.log('❌ Lien présence non trouvé');
      }
    } else {
      console.log('❌ Fichier dashboard.html non trouvé');
    }

    // 2. Vérifier les gestionnaires d'événements dans dashboard.js
    console.log('\n2️⃣ Vérification des gestionnaires d\'événements dans dashboard.js...');
    
    const dashboardJs = 'web/dashboard.js';
    if (fs.existsSync(dashboardJs)) {
      const content = fs.readFileSync(dashboardJs, 'utf8');
      
      // Chercher les gestionnaires d'événements storage
      const storageMatches = content.match(/window\.addEventListener\('storage'/g);
      if (storageMatches) {
        console.log(`⚠️ ${storageMatches.length} gestionnaire(s) storage trouvé(s) - peut causer des redirections automatiques`);
      }
      
      // Chercher les redirections automatiques
      const redirectMatches = content.match(/window\.location\.href\s*=/g);
      if (redirectMatches) {
        console.log(`⚠️ ${redirectMatches.length} redirection(s) automatique(s) trouvée(s)`);
      }
      
      // Chercher les gestionnaires de clic
      const clickMatches = content.match(/addEventListener\('click'/g);
      if (clickMatches) {
        console.log(`ℹ️ ${clickMatches.length} gestionnaire(s) de clic trouvé(s)`);
      }
    } else {
      console.log('❌ Fichier dashboard.js non trouvé');
    }

    // 3. Vérifier les gestionnaires d'événements dans app.js
    console.log('\n3️⃣ Vérification des gestionnaires d\'événements dans app.js...');
    
    const appJs = 'web/app.js';
    if (fs.existsSync(appJs)) {
      const content = fs.readFileSync(appJs, 'utf8');
      
      // Chercher le gestionnaire de clic global
      const globalClickMatch = content.match(/document\.addEventListener\('click'/);
      if (globalClickMatch) {
        console.log('✅ Gestionnaire de clic global trouvé dans app.js');
        
        // Chercher la logique du logo
        const logoLogicMatch = content.match(/navbar-logo.*window\.location\.href.*home\.html/s);
        if (logoLogicMatch) {
          console.log('✅ Logique de redirection du logo vers home.html trouvée');
        } else {
          console.log('❌ Logique de redirection du logo non trouvée');
        }
      } else {
        console.log('❌ Gestionnaire de clic global non trouvé');
      }
    } else {
      console.log('❌ Fichier app.js non trouvé');
    }

    // 4. Analyser les problèmes identifiés
    console.log('\n4️⃣ Analyse des problèmes identifiés...');
    
    console.log('🔍 Problème 1: Logo ne redirige pas vers home');
    console.log('   - Le logo a la classe "navbar-logo"');
    console.log('   - app.js a un gestionnaire pour ".navbar-logo"');
    console.log('   - Le gestionnaire redirige vers "/home.html"');
    console.log('   - Problème possible: Conflit avec d\'autres gestionnaires');
    
    console.log('\n🔍 Problème 2: Bouton Présence redirige vers index puis revient à dashboard');
    console.log('   - Le bouton a href="/" et id="presence-link"');
    console.log('   - app.js redirige vers "/" (index)');
    console.log('   - dashboard.js a un gestionnaire storage qui rafraîchit automatiquement');
    console.log('   - Problème possible: Le gestionnaire storage force le retour au dashboard');

    // 5. Recommandations de correction
    console.log('\n5️⃣ Recommandations de correction...');
    
    console.log('🔧 Pour le logo:');
    console.log('   1. Vérifier que le logo a bien la classe "navbar-logo"');
    console.log('   2. S\'assurer qu\'aucun autre gestionnaire ne bloque l\'événement');
    console.log('   3. Ajouter des logs de débogage pour tracer le clic');
    
    console.log('\n🔧 Pour le bouton Présence:');
    console.log('   1. Modifier le gestionnaire storage pour ne pas rediriger automatiquement');
    console.log('   2. Ajouter une condition pour éviter la redirection si on vient de cliquer sur Présence');
    console.log('   3. Utiliser un flag temporaire pour désactiver le rafraîchissement automatique');

    // 6. Créer un script de test
    console.log('\n6️⃣ Script de test pour diagnostiquer la navigation...');
    
    const testScript = `
// Script de test pour diagnostiquer les problèmes de navigation
console.log('🧪 Test de navigation - Logo et bouton Présence');

// 1. Tester le clic sur le logo
const logo = document.querySelector('.navbar-logo');
if (logo) {
  console.log('✅ Logo trouvé:', logo);
  
  // Ajouter un gestionnaire de test
  logo.addEventListener('click', (e) => {
    console.log('🎯 Clic sur logo détecté');
    console.log('Event:', e);
    console.log('Target:', e.target);
    console.log('Current target:', e.currentTarget);
  });
} else {
  console.log('❌ Logo non trouvé');
}

// 2. Tester le clic sur le bouton Présence
const presenceBtn = document.getElementById('presence-link');
if (presenceBtn) {
  console.log('✅ Bouton Présence trouvé:', presenceBtn);
  
  // Ajouter un gestionnaire de test
  presenceBtn.addEventListener('click', (e) => {
    console.log('🎯 Clic sur bouton Présence détecté');
    console.log('Event:', e);
    console.log('Href:', presenceBtn.href);
  });
} else {
  console.log('❌ Bouton Présence non trouvé');
}

// 3. Surveiller les changements de location
let currentLocation = window.location.href;
const checkLocation = setInterval(() => {
  if (window.location.href !== currentLocation) {
    console.log('🔄 CHANGEMENT DE LOCATION DÉTECTÉ!');
    console.log('De:', currentLocation);
    console.log('Vers:', window.location.href);
    currentLocation = window.location.href;
  }
}, 100);

// 4. Surveiller les événements storage
window.addEventListener('storage', (e) => {
  console.log('💾 Événement storage détecté:', e.key, e.newValue);
});

console.log('✅ Surveillance de navigation activée');
console.log('💡 Cliquez sur le logo et le bouton Présence pour voir les logs');
`;

    console.log('📝 Script de test créé. Copiez et collez ce code dans la console du navigateur :');
    console.log(testScript);

    console.log('\n✅ Diagnostic des problèmes de navigation terminé !');

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  }
}

diagnoseNavigationIssues();
