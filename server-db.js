// Redirection vers server.js
// Ce fichier existe temporairement pour éviter l'erreur de déploiement Render
console.log('🔄 Redirection vers server.js...');

// Vérifier les variables d'environnement requises
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variables d\'environnement manquantes:', missingVars.join(', '));
  console.error('📋 Veuillez configurer ces variables dans votre dashboard Render:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('🔗 Guide: https://render.com/docs/environment-variables');
  process.exit(1);
}

try {
  require('./server.js');
} catch (error) {
  console.error('❌ Erreur lors du chargement de server.js:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
