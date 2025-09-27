// Script de test pour l'API Presence CCRB
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

// Tests des routes principales
async function testAPI() {
  console.log('🧪 Test de l\'API Presence CCRB\n');

  // Test 1: Health check
  console.log('1. Test Health Check...');
  try {
    const result = await makeRequest('/api/health');
    console.log(`   ✅ Status: ${result.status}`);
    console.log(`   📊 Response: ${JSON.stringify(result.data)}\n`);
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
  }

  // Test 2: Unités administratives
  console.log('2. Test Unités Administratives...');
  try {
    const result = await makeRequest('/api/admin-units');
    console.log(`   ✅ Status: ${result.status}`);
    if (result.data.success && result.data.data.departements) {
      console.log(`   📊 Départements trouvés: ${result.data.data.departements.length}`);
      console.log(`   🏛️ Premier département: ${result.data.data.departements[0].nom}\n`);
    } else {
      console.log(`   ⚠️ Format de réponse inattendu\n`);
    }
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
  }

  // Test 3: Géolocalisation - Départements
  console.log('3. Test Géolocalisation - Départements...');
  try {
    const result = await makeRequest('/api/geo/departements');
    console.log(`   ✅ Status: ${result.status}`);
    console.log(`   📊 Response: ${JSON.stringify(result.data)}\n`);
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
  }

  // Test 4: Settings
  console.log('4. Test Settings...');
  try {
    const result = await makeRequest('/api/settings');
    console.log(`   ✅ Status: ${result.status}`);
    console.log(`   📊 Response: ${JSON.stringify(result.data)}\n`);
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
  }

  // Test 5: Test de connexion (sans authentification)
  console.log('5. Test Connexion (sans auth)...');
  try {
    const result = await makeRequest('/api/profile');
    console.log(`   ✅ Status: ${result.status}`);
    console.log(`   📊 Response: ${JSON.stringify(result.data)}\n`);
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
  }

  console.log('✅ Tests terminés !');
}

// Exécuter les tests
if (require.main === module) {
  testAPI().catch(console.error);
}

module.exports = { testAPI, makeRequest };
