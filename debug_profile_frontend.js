// Script de débogage pour vérifier les appels API depuis le frontend
console.log('🔍 Débogage des appels API du profil...');

// Fonction pour intercepter les appels fetch
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('📡 Appel fetch intercepté:', args[0], args[1]);
  return originalFetch.apply(this, args)
    .then(response => {
      console.log('📡 Réponse fetch:', response.status, response.statusText);
      return response;
    })
    .catch(error => {
      console.error('❌ Erreur fetch:', error);
      throw error;
    });
};

// Fonction pour vérifier le token JWT
function checkJWT() {
  const jwt = localStorage.getItem('jwt');
  if (!jwt) {
    console.error('❌ Aucun token JWT trouvé dans localStorage');
    return false;
  }
  
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error('❌ Token JWT expiré');
      return false;
    }
    console.log('✅ Token JWT valide, utilisateur:', payload.id, payload.email);
    return true;
  } catch (error) {
    console.error('❌ Token JWT invalide:', error);
    return false;
  }
}

// Fonction pour tester l'API directement
async function testProfileAPI() {
  console.log('🧪 Test de l\'API /api/me/profile...');
  
  if (!checkJWT()) {
    console.error('❌ Token JWT invalide, impossible de tester l\'API');
    return;
  }
  
  const jwt = localStorage.getItem('jwt');
  const testData = {
    phone: '+229123456789',
    departement: 'Test Frontend Département'
  };
  
  try {
    const response = await fetch('/api/me/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify(testData)
    });
    
    console.log('📡 Statut de la réponse:', response.status);
    const result = await response.json();
    console.log('📋 Réponse de l\'API:', result);
    
    if (response.ok && result.success) {
      console.log('✅ Mise à jour réussie via frontend !');
    } else {
      console.error('❌ Erreur lors de la mise à jour:', result.error || result.message);
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'appel API:', error);
  }
}

// Exposer les fonctions globalement
window.checkJWT = checkJWT;
window.testProfileAPI = testProfileAPI;

console.log('🔧 Fonctions de débogage disponibles:');
console.log('  - checkJWT() : Vérifier le token JWT');
console.log('  - testProfileAPI() : Tester l\'API /api/me/profile');
console.log('  - Tous les appels fetch sont maintenant loggés');
