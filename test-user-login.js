// Script de test pour la connexion utilisateur
const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Fonction pour faire des requêtes HTTP
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test de connexion utilisateur
async function testUserLogin() {
  console.log('🧪 Test de Connexion Utilisateur - Presence CCRB\n');

  const userCredentials = {
    email: process.env.TEST_EMAIL || 'test@example.com',
    password: process.env.TEST_PASSWORD || 'testpassword'
  };

  console.log('1. Test de connexion avec les identifiants...');
  console.log(`   📧 Email: ${userCredentials.email}`);
  console.log(`   🔑 Mot de passe: ${userCredentials.password}\n`);

  try {
    const result = await makeRequest('/api/login', 'POST', userCredentials);
    
    if (result.status === 200 && result.data.success) {
      console.log('   ✅ Connexion réussie !');
      console.log(`   🎫 Token reçu: ${result.data.token.substring(0, 50)}...`);
      console.log(`   👤 Utilisateur: ${result.data.user?.name || 'N/A'}`);
      console.log(`   🏷️ Rôle: ${result.data.user?.role || 'N/A'}`);
      
      // Test du profil avec le token
      console.log('\n2. Test du profil utilisateur...');
      const profileResult = await makeRequest('/api/profile', 'GET');
      
      if (profileResult.status === 200) {
        console.log('   ✅ Profil accessible');
        console.log(`   📊 Données: ${JSON.stringify(profileResult.data)}`);
      } else {
        console.log(`   ⚠️ Profil non accessible: ${profileResult.status}`);
      }
      
    } else {
      console.log('   ❌ Échec de la connexion');
      console.log(`   📊 Status: ${result.status}`);
      console.log(`   📋 Response: ${JSON.stringify(result.data)}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}`);
  }

  console.log('\n✅ Test terminé !');
}

// Exécuter le test
if (require.main === module) {
  testUserLogin().catch(console.error);
}

module.exports = { testUserLogin };
