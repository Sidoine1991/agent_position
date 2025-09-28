#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Correction des chemins pour Render...');

// Fichiers HTML à corriger pour Render
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

// Règles de correction pour Render
const renderPathCorrections = [
  // CSS files - Render sert les fichiers depuis la racine
  { from: /href="\/web\/styles\.css/g, to: 'href="/styles.css' },
  { from: /href="\/web\/modern-styles\.css/g, to: 'href="/modern-styles.css' },
  { from: /href="\/web\/styles-tailwind\.css/g, to: 'href="/styles-tailwind.css' },
  
  // JavaScript files - Render sert depuis la racine
  { from: /src="\/web\/navigation\.js"/g, to: 'src="/navigation.js"' },
  { from: /src="\/web\/capacitor-native\.js"/g, to: 'src="/capacitor-native.js"' },
  { from: /src="\/web\/geo-data\.js"/g, to: 'src="/geo-data.js"' },
  { from: /src="\/web\/test-render-auth\.js"/g, to: 'src="/test-render-auth.js"' },
  { from: /src="\/web\/clear-cache\.js"/g, to: 'src="/clear-cache.js"' },
  { from: /src="\/web\/mobile-gps-detector\.js"/g, to: 'src="/mobile-gps-detector.js"' },
  { from: /src="\/web\/gps-enhanced\.js"/g, to: 'src="/gps-enhanced.js"' },
  { from: /src="\/web\/offline-manager\.js"/g, to: 'src="/offline-manager.js"' },
  { from: /src="\/web\/register-sw\.js"/g, to: 'src="/register-sw.js"' },
  { from: /src="\/web\/data-manager\.js"/g, to: 'src="/data-manager.js"' },
  { from: /src="\/web\/dashboard-modern\.js"/g, to: 'src="/dashboard-modern.js"' },
  { from: /src="\/web\/agents\.js"/g, to: 'src="/agents.js"' },
  { from: /src="\/web\/reports\.js"/g, to: 'src="/reports.js"' },
  { from: /src="\/web\/map\.js"/g, to: 'src="/map.js"' },
  { from: /src="\/web\/admin-agents\.js"/g, to: 'src="/admin-agents.js"' },
  { from: /src="\/web\/admin-settings\.js"/g, to: 'src="/admin-settings.js"' },
  { from: /src="\/web\/admin\.js"/g, to: 'src="/admin.js"' },
  { from: /src="\/web\/profile\.js"/g, to: 'src="/profile.js"' },
  { from: /src="\/web\/dashboard\.js"/g, to: 'src="/dashboard.js"' },
  { from: /src="\/web\/register\.js"/g, to: 'src="/register.js"' },
  { from: /src="\/web\/app\.js"/g, to: 'src="/app.js"' },
  
  // Bootstrap paths - Render sert depuis la racine
  { from: /href="\/web\/bootstrap-5\.3\.8-dist\//g, to: 'href="/bootstrap-5.3.8-dist/' },
  { from: /src="\/web\/bootstrap-5\.3\.8-dist\//g, to: 'src="/bootstrap-5.3.8-dist/' },
  
  // Media paths - Render sert depuis la racine
  { from: /src="\/Media\//g, to: 'src="/Media/' },
  { from: /href="\/Media\//g, to: 'href="/Media/' },
  
  // Manifest paths - Render sert depuis la racine
  { from: /href="\/web\/manifest\.webmanifest"/g, to: 'href="/manifest.webmanifest"' },
  
  // HTML navigation paths - Render sert depuis la racine
  { from: /href="\/web\/profile\.html"/g, to: 'href="/profile.html"' },
  { from: /href="\/web\/dashboard\.html"/g, to: 'href="/dashboard.html"' },
  { from: /href="\/web\/agents\.html"/g, to: 'href="/agents.html"' },
  { from: /href="\/web\/reports\.html"/g, to: 'href="/reports.html"' },
  { from: /href="\/web\/admin\.html"/g, to: 'href="/admin.html"' },
  { from: /href="\/web\/admin-agents\.html"/g, to: 'href="/admin-agents.html"' },
  { from: /href="\/web\/admin-settings\.html"/g, to: 'href="/admin-settings.html"' },
  { from: /href="\/web\/map\.html"/g, to: 'href="/map.html"' },
  { from: /href="\/web\/register\.html"/g, to: 'href="/register.html"' }
];

// Fonction pour corriger un fichier
function fixFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier non trouvé: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  renderPathCorrections.forEach(correction => {
    const newContent = content.replace(correction.from, correction.to);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Corrigé pour Render: ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  Aucune correction nécessaire: ${filePath}`);
    return false;
  }
}

// Corriger tous les fichiers
let totalFixed = 0;
htmlFiles.forEach(file => {
  if (fixFile(file)) {
    totalFixed++;
  }
});

console.log(`\n🎉 Correction Render terminée! ${totalFixed} fichiers modifiés.`);
console.log('\n📋 Résumé des corrections pour Render:');
console.log('- Chemins CSS corrigés pour Render');
console.log('- Chemins JavaScript corrigés pour Render');
console.log('- Chemins Bootstrap corrigés pour Render');
console.log('- Chemins Media corrigés pour Render');
console.log('- Navigation HTML corrigée pour Render');
