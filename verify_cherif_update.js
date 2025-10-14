const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

async function verifyCherifUpdate() {
  try {
    console.log('🔍 Vérification de la mise à jour de CHERIF FABADE DEKANDE LUC...');
    
    // Créer un token JWT pour l'admin
    const adminToken = jwt.sign(
      { 
        id: 33, 
        email: 'syebadokpo@gmail.com', 
        role: 'admin' 
      }, 
      JWT_SECRET, 
      { expiresIn: '1h' }
    );
    
    console.log('🔑 Token JWT créé pour admin');
    
    // Récupérer l'agent mis à jour
    console.log('📥 Récupération de l\'agent mis à jour...');
    const getResponse = await fetch('http://localhost:3010/api/admin/agents', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!getResponse.ok) {
      throw new Error(`Erreur récupération agents: ${getResponse.status}`);
    }
    
    const agentsData = await getResponse.json();
    const agents = agentsData.data || agentsData.agents || [];
    
    // Trouver l'agent CHERIF
    const cherifAgent = agents.find(agent => agent.email === 'lucherifabade@gmail.com');
    
    if (!cherifAgent) {
      console.error('❌ Agent CHERIF non trouvé dans la liste');
      return;
    }
    
    console.log('✅ Agent trouvé !');
    console.log('📋 Informations actuelles:');
    console.log('   ID:', cherifAgent.id);
    console.log('   Nom:', cherifAgent.name);
    console.log('   Email:', cherifAgent.email);
    console.log('   Téléphone:', cherifAgent.phone);
    console.log('   Département:', cherifAgent.departement);
    console.log('   Commune:', cherifAgent.commune);
    console.log('   Arrondissement:', cherifAgent.arrondissement);
    console.log('   Village:', cherifAgent.village);
    console.log('   Latitude:', cherifAgent.reference_lat);
    console.log('   Longitude:', cherifAgent.reference_lon);
    console.log('   Début contrat:', cherifAgent.contract_start_date);
    console.log('   Fin contrat:', cherifAgent.contract_end_date);
    console.log('   Expérience:', cherifAgent.years_of_service, 'ans');
    console.log('   Rayon de tolérance:', cherifAgent.tolerance_radius_meters, 'm');
    
    // Vérifier si les données correspondent
    const expectedData = {
      name: 'CHERIF FABADE DEKANDE LUC',
      phone: '0197721043',
      departement: 'Collines',
      commune: 'Savalou',
      arrondissement: 'OUESSE',
      village: 'AKETE',
      reference_lat: 7.987124,
      reference_lon: 1.886619,
      contract_start_date: '2025-02-03',
      contract_end_date: '2027-03-31',
      years_of_service: 5.0
    };
    
    console.log('\n🔍 Vérification des données:');
    let allCorrect = true;
    
    Object.keys(expectedData).forEach(key => {
      const expected = expectedData[key];
      const actual = cherifAgent[key];
      const isCorrect = expected === actual || (typeof expected === 'number' && Math.abs(expected - actual) < 0.001);
      
      console.log(`   ${key}: ${isCorrect ? '✅' : '❌'} (attendu: ${expected}, reçu: ${actual})`);
      if (!isCorrect) allCorrect = false;
    });
    
    if (allCorrect) {
      console.log('\n🎉 Toutes les données ont été mises à jour correctement !');
    } else {
      console.log('\n⚠️  Certaines données ne correspondent pas aux attentes.');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    console.error('Détails:', error);
  }
}

// Exécuter la vérification
verifyCherifUpdate();
