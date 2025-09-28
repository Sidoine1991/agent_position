#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Correction automatique des chemins de fichiers...');

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

// Règles de correction
const pathCorrections = [
  // CSS files
  { from: /href="styles\.css/g, to: 'href="/web/styles.css' },
  { from: /href="modern-styles\.css/g, to: 'href="/web/modern-styles.css' },
  { from: /href="styles-tailwind\.css/g, to: 'href="/web/styles-tailwind.css' },
  
  // JavaScript files
  { from: /src="navigation\.js"/g, to: 'src="/web/navigation.js"' },
  { from: /src="capacitor-native\.js"/g, to: 'src="/web/capacitor-native.js"' },
  { from: /src="geo-data\.js"/g, to: 'src="/web/geo-data.js"' },
  { from: /src="test-render-auth\.js"/g, to: 'src="/web/test-render-auth.js"' },
  { from: /src="clear-cache\.js"/g, to: 'src="/web/clear-cache.js"' },
  { from: /src="mobile-gps-detector\.js"/g, to: 'src="/web/mobile-gps-detector.js"' },
  { from: /src="gps-enhanced\.js"/g, to: 'src="/web/gps-enhanced.js"' },
  { from: /src="offline-manager\.js"/g, to: 'src="/web/offline-manager.js"' },
  { from: /src="register-sw\.js"/g, to: 'src="/web/register-sw.js"' },
  { from: /src="data-manager\.js"/g, to: 'src="/web/data-manager.js"' },
  { from: /src="dashboard-modern\.js"/g, to: 'src="/web/dashboard-modern.js"' },
  { from: /src="agents\.js"/g, to: 'src="/web/agents.js"' },
  { from: /src="reports\.js"/g, to: 'src="/web/reports.js"' },
  { from: /src="map\.js"/g, to: 'src="/web/map.js"' },
  { from: /src="admin-agents\.js"/g, to: 'src="/web/admin-agents.js"' },
  { from: /src="admin-settings\.js"/g, to: 'src="/web/admin-settings.js"' },
  { from: /src="admin\.js"/g, to: 'src="/web/admin.js"' },
  { from: /src="profile\.js"/g, to: 'src="/web/profile.js"' },
  { from: /src="dashboard\.js"/g, to: 'src="/web/dashboard.js"' },
  { from: /src="register\.js"/g, to: 'src="/web/register.js"' },
  
  // Bootstrap paths
  { from: /href="\/bootstrap-5\.3\.8-dist\//g, to: 'href="/web/bootstrap-5.3.8-dist/' },
  { from: /src="\/bootstrap-5\.3\.8-dist\//g, to: 'src="/web/bootstrap-5.3.8-dist/' },
  
  // Leaflet paths (use CDN instead of local)
  { from: /href="\/leaflet\/leaflet\.css"/g, to: 'href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"' },
  { from: /src="\/leaflet\/leaflet\.js"/g, to: 'src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"' },
  
  // Media paths
  { from: /src="Media\//g, to: 'src="/Media/' },
  { from: /href="Media\//g, to: 'href="/Media/' },
  
  // Manifest paths
  { from: /href="manifest\.webmanifest"/g, to: 'href="/web/manifest.webmanifest"' },
  
  // HTML navigation paths
  { from: /href="index\.html"/g, to: 'href="/"' },
  { from: /href="profile\.html"/g, to: 'href="/web/profile.html"' },
  { from: /href="dashboard\.html"/g, to: 'href="/web/dashboard.html"' },
  { from: /href="agents\.html"/g, to: 'href="/web/agents.html"' },
  { from: /href="reports\.html"/g, to: 'href="/web/reports.html"' },
  { from: /href="admin\.html"/g, to: 'href="/web/admin.html"' },
  { from: /href="admin-agents\.html"/g, to: 'href="/web/admin-agents.html"' },
  { from: /href="admin-settings\.html"/g, to: 'href="/web/admin-settings.html"' },
  { from: /href="map\.html"/g, to: 'href="/web/map.html"' },
  { from: /href="register\.html"/g, to: 'href="/web/register.html"' }
];

// Fonction pour corriger un fichier
function fixFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier non trouvé: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  pathCorrections.forEach(correction => {
    const newContent = content.replace(correction.from, correction.to);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Corrigé: ${filePath}`);
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

console.log(`\n🎉 Correction terminée! ${totalFixed} fichiers modifiés.`);
console.log('\n📋 Résumé des corrections:');
console.log('- Chemins CSS standardisés vers /web/');
console.log('- Chemins JavaScript standardisés vers /web/');
console.log('- Chemins Bootstrap corrigés');
console.log('- Chemins Leaflet remplacés par CDN');
console.log('- Chemins Media corrigés');
console.log('- Navigation HTML corrigée');
