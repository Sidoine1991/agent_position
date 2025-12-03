// Script de diagnostic et correction pour les problèmes d'authentification
console.log('🔍 DIAGNOSTIC AUTH FRONTEND - Démarrage...\n');

// 1. Vérifier le token JWT dans localStorage
function checkToken() {
  const token = localStorage.getItem('jwt');
  console.log('1️⃣ Vérification du token JWT:');
  
  if (!token) {
    console.error('❌ Aucun token JWT trouvé dans localStorage');
    return false;
  }
  
  console.log('✅ Token JWT trouvé (longueur):', token.length);
  console.log('✅ Token JWT (premiers 20 chars):', token.substring(0, 20) + '...');
  
  // Vérifier le format du token (JWT a 3 parties séparées par des points)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.error('❌ Token JWT invalide: devrait avoir 3 parties séparées par des points');
    return false;
  }
  
  console.log('✅ Token JWT format valide');
  
  // Décoder le payload (partie 2)
  try {
    const payload = JSON.parse(atob(parts[1]));
    console.log('✅ Payload JWT décodé:', {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      exp: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'N/A'
    });
    
    // Vérifier si le token est expiré
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.error('❌ Token JWT expiré le:', new Date(payload.exp * 1000).toLocaleString());
      return false;
    }
    
    console.log('✅ Token JWT non expiré');
    return payload;
  } catch (error) {
    console.error('❌ Erreur décodage payload JWT:', error.message);
    return false;
  }
}

// 2. Tester l'authentification avec le serveur
async function testAuthWithServer(tokenPayload) {
  console.log('\n2️⃣ Test authentification avec le serveur:');
  
  const token = localStorage.getItem('jwt');
  if (!token) {
    console.error('❌ Impossible de tester: pas de token');
    return;
  }
  
  try {
    // Test endpoint /api/profile
    console.log('🔍 Test /api/profile...');
    const profileResponse = await fetch('/api/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Réponse /api/profile:', {
      status: profileResponse.status,
      statusText: profileResponse.statusText,
      ok: profileResponse.ok
    });
    
    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('❌ Erreur /api/profile:', errorText);
      
      if (profileResponse.status === 403) {
        console.log('🔧 Possible cause: Token invalide ou utilisateur non autorisé');
      } else if (profileResponse.status === 401) {
        console.log('🔧 Possible cause: Token expiré ou mal formaté');
      }
      return false;
    }
    
    const profileData = await profileResponse.json();
    console.log('✅ /apiprofile réussi:', {
      id: profileData.user?.id || profileData.id,
      email: profileData.user?.email || profileData.email,
      role: profileData.user?.role || profileData.role
    });
    
    // Test endpoint analytics (nécessite superviseur/admin)
    if (['admin', 'supervisor', 'superviseur'].includes(tokenPayload.role)) {
      console.log('🔍 Test /api/analytics/performance...');
      const analyticsResponse = await fetch('/api/analytics/performance', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📊 Réponse /api/analytics/performance:', {
        status: analyticsResponse.status,
        statusText: analyticsResponse.statusText,
        ok: analyticsResponse.ok
      });
      
      if (analyticsResponse.ok) {
        console.log('✅ /api/analytics/performance réussi');
      } else {
        const errorText = await analyticsResponse.text();
        console.error('❌ Erreur /api/analytics/performance:', errorText);
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Erreur test authentification:', error.message);
    return false;
  }
}

// 3. Corriger les problèmes courants
function fixAuthIssues() {
  console.log('\n3️⃣ Correction des problèmes:');
  
  // Vérifier si le token est valide
  const token = localStorage.getItem('jwt');
  if (!token) {
    console.log('🔧 Redirection vers login.html...');
    window.location.href = '/login.html';
    return;
  }
  
  // Vérifier le format
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.log('🔧 Token invalide, suppression et redirection...');
    localStorage.removeItem('jwt');
    window.location.href = '/login.html';
    return;
  }
  
  // Vérifier l'expiration
  try {
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.log('🔧 Token expiré, suppression et redirection...');
      localStorage.removeItem('jwt');
      window.location.href = '/login.html';
      return;
    }
  } catch (error) {
    console.log('🔧 Erreur lecture token, suppression et redirection...');
    localStorage.removeItem('jwt');
    window.location.href = '/login.html';
    return;
  }
  
  console.log('✅ Token semble valide, pas de correction nécessaire');
}

// 4. Fonction utilitaire pour les futures requêtes API
window.safeApiCall = async function(url, options = {}) {
  const token = localStorage.getItem('jwt');
  if (!token) {
    console.error('❌ safeApiCall: Aucun token disponible');
    throw new Error('Non authentifié');
  }
  
  // Vérifier si le token est expiré
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        console.log('🔧 Token expiré, redirection...');
        localStorage.removeItem('jwt');
        window.location.href = '/login.html';
        throw new Error('Token expiré');
      }
    }
  } catch (error) {
    console.log('🔧 Token invalide, redirection...');
    localStorage.removeItem('jwt');
    window.location.href = '/login.html';
    throw new Error('Token invalide');
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    if (response.status === 401 || response.status === 403) {
      console.error(`❌ safeApiCall: Erreur auth ${response.status} pour ${url}`);
      if (response.status === 401) {
        localStorage.removeItem('jwt');
        window.location.href = '/login.html';
      }
      throw new Error(`Erreur authentification: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    console.error(`❌ safeApiCall: Erreur pour ${url}:`, error.message);
    throw error;
  }
};

// Exécuter le diagnostic
async function runDiagnostic() {
  const tokenPayload = checkToken();
  if (tokenPayload) {
    await testAuthWithServer(tokenPayload);
  }
  fixAuthIssues();
}

// Lancer le diagnostic
runDiagnostic().then(() => {
  console.log('\n🏁 Diagnostic terminé');
}).catch(error => {
  console.error('❌ Erreur diagnostic:', error);
});
