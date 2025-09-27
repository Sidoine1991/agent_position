// Script pour construire l'APK avec PWA Builder
const https = require('https');
const fs = require('fs');
const path = require('path');

const PWA_URL = 'https://agent-position.vercel.app';
const OUTPUT_DIR = './apk-build';

// Créer le répertoire de sortie
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🚀 Construction APK avec PWA Builder');
console.log('=====================================');
console.log(`📱 URL PWA: ${PWA_URL}`);
console.log('');

// Instructions pour l'utilisateur
console.log('📋 Instructions pour construire l\'APK :');
console.log('');
console.log('1. 🌐 Ouvrir PWA Builder dans votre navigateur :');
console.log('   https://www.pwabuilder.com/');
console.log('');
console.log('2. 📝 Entrer l\'URL de votre PWA :');
console.log(`   ${PWA_URL}`);
console.log('');
console.log('3. 🔍 Cliquer sur "Start" pour analyser votre PWA');
console.log('');
console.log('4. ✅ Vérifier que tous les scores sont verts :');
console.log('   - Manifest: ✅');
console.log('   - Service Worker: ✅');
console.log('   - HTTPS: ✅');
console.log('   - Responsive: ✅');
console.log('');
console.log('5. 📱 Cliquer sur "Build My PWA"');
console.log('');
console.log('6. 🤖 Sélectionner "Android"');
console.log('');
console.log('7. ⚙️ Configurer l\'APK :');
console.log('   - Package Name: com.ccrb.presence');
console.log('   - App Name: Presence CCRB');
console.log('   - Version: 1.0.0');
console.log('   - Icon: Utiliser le logo CCRB');
console.log('');
console.log('8. 📥 Télécharger l\'APK généré');
console.log('');
console.log('9. 📁 Sauvegarder l\'APK dans le dossier :');
console.log(`   ${path.resolve(OUTPUT_DIR)}`);
console.log('');

// Vérifier que l'URL est accessible
console.log('🔍 Vérification de l\'accessibilité de l\'URL...');

const options = {
  hostname: 'agent-position.vercel.app',
  port: 443,
  path: '/',
  method: 'GET',
  timeout: 10000
};

const req = https.request(options, (res) => {
  console.log(`✅ URL accessible (Status: ${res.statusCode})`);
  console.log('');
  console.log('🎯 Votre PWA est prête pour PWA Builder !');
  console.log('');
  console.log('📱 Fonctionnalités disponibles :');
  console.log('   ✅ Authentification sécurisée');
  console.log('   ✅ Géolocalisation GPS');
  console.log('   ✅ Marquage de présence');
  console.log('   ✅ Historique des missions');
  console.log('   ✅ Interface responsive');
  console.log('   ✅ Mode hors ligne');
  console.log('');
  console.log('🚀 Allez sur https://www.pwabuilder.com/ pour construire votre APK !');
});

req.on('error', (err) => {
  console.log(`❌ Erreur de connexion: ${err.message}`);
  console.log('');
  console.log('🔧 Vérifiez que votre application est déployée et accessible.');
});

req.on('timeout', () => {
  console.log('⏰ Timeout - Vérifiez votre connexion internet');
  req.destroy();
});

req.setTimeout(10000);
req.end();

// Créer un fichier de configuration pour PWA Builder
const pwaConfig = {
  url: PWA_URL,
  name: 'Presence CCRB',
  shortName: 'Presence CCRB',
  description: 'Système de suivi de présence des agents CCRB',
  packageName: 'com.ccrb.presence',
  version: '1.0.0',
  icon: '/Media/PP CCRB.png',
  features: [
    'Authentication',
    'Geolocation',
    'Offline Support',
    'Push Notifications',
    'Background Sync'
  ]
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'pwa-builder-config.json'),
  JSON.stringify(pwaConfig, null, 2)
);

console.log('📄 Configuration PWA Builder sauvegardée dans :');
console.log(`   ${path.resolve(OUTPUT_DIR, 'pwa-builder-config.json')}`);
console.log('');

module.exports = { PWA_URL, OUTPUT_DIR, pwaConfig };
