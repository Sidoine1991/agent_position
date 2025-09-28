// Script de test pour Render - Vérification des credentials
console.log('🧪 Test des credentials sur Render (silencieux par défaut)...');

async function testRenderAuth() {
  try {
    // Récupérer les paramètres URL
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    const password = urlParams.get('password');
    const debug = urlParams.get('debug-auth') === '1';
    
    if (!email || !password) {
      console.log('❌ Email ou mot de passe manquant dans l\'URL');
      return;
    }
    
    if (debug) console.log('📧 Test avec email:', email);
    
    // Test de l'API Render
    const response = await fetch(`/api/test-auth?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
    const result = await response.json();
    if (debug) console.log('🔍 Résultat du test:', result);
    
    if (result.success) {
      if (debug) {
        console.log('✅ Authentification réussie sur Render');
        console.log('👤 Utilisateur:', result.user);
      }
      // pas d'UI visible par défaut
    } else {
      if (debug) {
        console.log('❌ Échec de l\'authentification:', result.message);
        console.log('🔍 Type de test:', result.test);
      }
      // pas d'UI visible par défaut
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Exécuter le test au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', testRenderAuth);
} else {
  testRenderAuth();
}

// Exposer la fonction globalement
window.testRenderAuth = testRenderAuth;
