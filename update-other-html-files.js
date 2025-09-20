const fs = require('fs');

console.log('📊 Mise à jour des autres fichiers HTML...');

try {
  // Lire le script intégré depuis index.html
  const indexHtml = fs.readFileSync('./web/index.html', 'utf8');
  
  // Extraire le script intégré
  const scriptMatch = indexHtml.match(/<script>\/\/ Données géographiques du Bénin \(intégrées\)[\s\S]*?<\/script>/);
  if (!scriptMatch) {
    throw new Error('Script intégré non trouvé dans index.html');
  }
  
  const embeddedScript = scriptMatch[0];
  console.log('✅ Script intégré extrait');
  
  // Mettre à jour admin-agents.html
  let adminAgentsHtml = fs.readFileSync('./web/admin-agents.html', 'utf8');
  const adminScriptTag = '<script src="/geo-data.js?v=4"></script>';
  adminAgentsHtml = adminAgentsHtml.replace(adminScriptTag, embeddedScript);
  fs.writeFileSync('./web/admin-agents.html', adminAgentsHtml);
  console.log('✅ admin-agents.html mis à jour');
  
  // Mettre à jour dashboard.html
  let dashboardHtml = fs.readFileSync('./web/dashboard.html', 'utf8');
  const dashboardScriptTag = '<script src="/geo-data.js?v=4"></script>';
  dashboardHtml = dashboardHtml.replace(dashboardScriptTag, embeddedScript);
  fs.writeFileSync('./web/dashboard.html', dashboardHtml);
  console.log('✅ dashboard.html mis à jour');
  
  console.log('✅ Tous les fichiers HTML mis à jour avec succès');
  
} catch (error) {
  console.error('❌ Erreur lors de la mise à jour:', error.message);
}
