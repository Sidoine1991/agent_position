#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Désactivation des Vercel Analytics...');

// Fichiers HTML à corriger
const htmlFiles = [
  'web/index.html',
  'web/register.html', 
  'web/admin.html',
  'web/profile.html',
  'web/dashboard.html',
  'web/dashboard-modern.html',
  'web/agents.html',
  'web/reports.html',
  'web/map.html',
  'web/admin-agents.html',
  'web/admin-settings.html'
];

// Règles de désactivation
const disableRules = [
  // Désactiver Vercel Speed Insights
  { 
    from: /import\('https:\/\/unpkg\.com\/@vercel\/speed-insights@1\.2\.0\/dist\/index\.js'\)\.then\(\(\{ inject \}\) => \{[\s\S]*?\}\);/g, 
    to: '/* Vercel Speed Insights désactivé pour éviter les erreurs CSP */' 
  },
  // Désactiver Vercel Analytics
  { 
    from: /import\('https:\/\/unpkg\.com\/@vercel\/analytics@1\.2\.0\/dist\/index\.js'\)\.then\(\(\{ inject \}\) => \{[\s\S]*?\}\);/g, 
    to: '/* Vercel Analytics désactivé pour éviter les erreurs CSP */' 
  }
];

// Fonction pour désactiver les analytics
function disableAnalytics(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier non trouvé: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  disableRules.forEach(rule => {
    const newContent = content.replace(rule.from, rule.to);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Analytics désactivés: ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  Aucun analytics trouvé: ${filePath}`);
    return false;
  }
}

// Désactiver dans tous les fichiers
let totalFixed = 0;
htmlFiles.forEach(file => {
  if (disableAnalytics(file)) {
    totalFixed++;
  }
});

console.log(`\n🎉 Désactivation terminée! ${totalFixed} fichiers modifiés.`);
console.log('\n📋 Résumé:');
console.log('- Vercel Speed Insights désactivés');
console.log('- Vercel Analytics désactivés');
console.log('- Erreurs CSP évitées');
