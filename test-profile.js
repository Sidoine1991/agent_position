// Script de test pour le profil utilisateur avec token
const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Fonction pour faire des requêtes HTTP avec token
function makeRequestWithToken(path, method = 'GET', token = null, data = null) {
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

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

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

// Test complet de connexion et profil
async function testCompleteLogin() {
  console.log('🧪 Test Complet - Connexion et Profil\n');

  const userCredentials = {
    email: process.env.TEST_EMAIL || 'test@example.com',
    password: process.env.TEST_PASSWORD || 'testpassword'
  };

  // 1. Connexion
  console.log('1. Connexion utilisateur...');
  try {
    const loginResult = await makeRequestWithToken('/api/login', 'POST', null, userCredentials);
    
    if (loginResult.status === 200 && loginResult.data.success) {
      console.log('   ✅ Connexion réussie !');
      const token = loginResult.data.token;
      console.log(`   🎫 Token: ${token.substring(0, 50)}...`);
      
      // 2. Test du profil avec token
      console.log('\n2. Test du profil avec token...');
      const profileResult = await makeRequestWithToken('/api/profile', 'GET', token);
      
      if (profileResult.status === 200) {
        console.log('   ✅ Profil accessible avec token !');
        console.log(`   👤 Utilisateur: ${JSON.stringify(profileResult.data)}`);
      } else {
        console.log(`   ❌ Profil non accessible: ${profileResult.status}`);
        console.log(`   📋 Response: ${JSON.stringify(profileResult.data)}`);
      }
      
      // 3. Test des missions
      console.log('\n3. Test des missions...');
      const missionsResult = await makeRequestWithToken('/api/me/missions', 'GET', token);
      
      if (missionsResult.status === 200) {
        console.log('   ✅ Missions accessibles !');
        console.log(`   📊 Missions: ${JSON.stringify(missionsResult.data)}`);
      } else {
        console.log(`   ⚠️ Missions non accessibles: ${missionsResult.status}`);
      }
      
    } else {
      console.log('   ❌ Échec de la connexion');
      console.log(`   📊 Status: ${loginResult.status}`);
      console.log(`   📋 Response: ${JSON.stringify(loginResult.data)}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}`);
  }

  console.log('\n✅ Test terminé !');
}

// Exécuter le test
if (require.main === module) {
  testCompleteLogin().catch(console.error);
}

module.exports = { testCompleteLogin };
