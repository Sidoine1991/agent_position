// Script de test pour les nouvelles routes de fin de mission
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// Fonction pour tester la fin de mission normale
async function testNormalEnd() {
    console.log('🧪 Test de fin de mission normale...');
    
    try {
        const response = await fetch(`${BASE_URL}/api/presence/end`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token' // Remplacez par un vrai token
            },
            body: JSON.stringify({
                mission_id: 1,
                lat: 4.0511,
                lon: 9.7679,
                note: 'Test fin mission normale'
            })
        });
        
        const result = await response.json();
        console.log('✅ Fin normale:', result);
    } catch (error) {
        console.error('❌ Erreur fin normale:', error.message);
    }
}

// Fonction pour tester la fin forcée de mission
async function testForceEnd() {
    console.log('🧪 Test de fin forcée de mission...');
    
    try {
        const response = await fetch(`${BASE_URL}/api/presence/force-end`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token' // Remplacez par un vrai token
            },
            body: JSON.stringify({
                mission_id: 1,
                note: 'Test fin forcée'
            })
        });
        
        const result = await response.json();
        console.log('✅ Fin forcée:', result);
    } catch (error) {
        console.error('❌ Erreur fin forcée:', error.message);
    }
}

// Exécuter les tests
async function runTests() {
    console.log('🚀 Démarrage des tests de fin de mission...\n');
    
    await testNormalEnd();
    console.log('');
    await testForceEnd();
    
    console.log('\n✅ Tests terminés');
}

// Exécuter si le script est appelé directement
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testNormalEnd, testForceEnd };
