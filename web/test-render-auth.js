// Script de test pour Render - Vérification des credentials
console.log('🧪 Test des credentials sur Render...');

async function testRenderAuth() {
  try {
    // Récupérer les paramètres URL
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    const password = urlParams.get('password');
    
    if (!email || !password) {
      console.log('❌ Email ou mot de passe manquant dans l\'URL');
      return;
    }
    
    console.log('📧 Test avec email:', email);
    
    // Test de l'API Render
    const response = await fetch(`/api/test-auth?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
    const result = await response.json();
    
    console.log('🔍 Résultat du test:', result);
    
    if (result.success) {
      console.log('✅ Authentification réussie sur Render');
      console.log('👤 Utilisateur:', result.user);
      
      // Afficher un message de succès
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 15px;
        border-radius: 8px;
        z-index: 10000;
        font-family: Arial, sans-serif;
      `;
      notification.innerHTML = `
        <strong>✅ Authentification Render OK</strong><br>
        Utilisateur: ${result.user.name}<br>
        Rôle: ${result.user.role}
      `;
      document.body.appendChild(notification);
      
      // Supprimer après 5 secondes
      setTimeout(() => notification.remove(), 5000);
      
    } else {
      console.log('❌ Échec de l\'authentification:', result.message);
      console.log('🔍 Type de test:', result.test);
      
      // Afficher un message d'erreur
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 15px;
        border-radius: 8px;
        z-index: 10000;
        font-family: Arial, sans-serif;
      `;
      notification.innerHTML = `
        <strong>❌ Erreur d'authentification</strong><br>
        ${result.message}<br>
        Type: ${result.test}
      `;
      document.body.appendChild(notification);
      
      // Supprimer après 5 secondes
      setTimeout(() => notification.remove(), 5000);
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
