// Redirection vers server.js
// Ce fichier existe temporairement pour éviter l'erreur de déploiement Render
console.log('🔄 Redirection vers server.js...');
try {
  require('./server.js');
} catch (error) {
  console.error('❌ Erreur lors du chargement de server.js:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
