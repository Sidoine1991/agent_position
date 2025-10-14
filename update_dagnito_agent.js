const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

async function updateDagnitoAgent() {
  try {
    console.log('🔄 Mise à jour des informations de DAGNITO Mariano...');
    
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
    
    // D'abord, récupérer l'agent existant
    console.log('📥 Récupération de l\'agent existant...');
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
    
    // Trouver l'agent DAGNITO
    const dagnitoAgent = agents.find(agent => agent.email === 'damarubb@gmail.com');
    
    if (!dagnitoAgent) {
      console.error('❌ Agent DAGNITO non trouvé dans la liste');
      return;
    }
    
    console.log('👤 Agent trouvé:', dagnitoAgent.name);
    console.log('🆔 ID:', dagnitoAgent.id);
    
    // Préparer les données de mise à jour
    const updateData = {
      name: 'DAGNITO Mariano',
      phone: '0197210972',
      departement: 'Zou',
      commune: 'Zogbodomey',
      arrondissement: 'Domè',
      village: 'Bolamè',
      reference_lat: 2.342387,
      reference_lon: 7.072755,
      contract_start_date: '2024-10-30',
      contract_end_date: '2026-01-31',
      years_of_service: 3.0,
      tolerance_radius_meters: 5000
    };
    
    console.log('📝 Données à mettre à jour:', updateData);
    
    // Mettre à jour via l'API PUT
    console.log('🔄 Mise à jour via API...');
    const updateResponse = await fetch(`http://localhost:3010/api/admin/agents/${dagnitoAgent.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Erreur mise à jour: ${updateResponse.status} - ${errorText}`);
    }
    
    const updatedData = await updateResponse.json();
    console.log('✅ Agent mis à jour avec succès !');
    
    // Vérifier la mise à jour
    console.log('🔍 Vérification de la mise à jour...');
    const verifyResponse = await fetch('http://localhost:3010/api/admin/agents', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      const updatedAgent = verifyData.data.find(agent => agent.email === 'damarubb@gmail.com');
      
      if (updatedAgent) {
        console.log('📋 Nouvelles informations:');
        console.log('   Nom:', updatedAgent.name);
        console.log('   Téléphone:', updatedAgent.phone);
        console.log('   Département:', updatedAgent.departement);
        console.log('   Commune:', updatedAgent.commune);
        console.log('   Arrondissement:', updatedAgent.arrondissement);
        console.log('   Village:', updatedAgent.village);
        console.log('   Latitude:', updatedAgent.reference_lat);
        console.log('   Longitude:', updatedAgent.reference_lon);
        console.log('   Début contrat:', updatedAgent.contract_start_date);
        console.log('   Fin contrat:', updatedAgent.contract_end_date);
        console.log('   Expérience:', updatedAgent.years_of_service, 'ans');
        
        // Vérifier si les données correspondent
        const expectedData = {
          name: 'DAGNITO Mariano',
          phone: '0197210972',
          departement: 'Zou',
          commune: 'Zogbodomey',
          arrondissement: 'Domè',
          village: 'Bolamè',
          reference_lat: 2.342387,
          reference_lon: 7.072755,
          contract_start_date: '2024-10-30',
          contract_end_date: '2026-01-31',
          years_of_service: 3.0
        };
        
        console.log('\n🔍 Vérification des données:');
        let allCorrect = true;
        
        Object.keys(expectedData).forEach(key => {
          const expected = expectedData[key];
          const actual = updatedAgent[key];
          const isCorrect = expected === actual || (typeof expected === 'number' && Math.abs(expected - actual) < 0.001);
          
          console.log(`   ${key}: ${isCorrect ? '✅' : '❌'} (attendu: ${expected}, reçu: ${actual})`);
          if (!isCorrect) allCorrect = false;
        });
        
        if (allCorrect) {
          console.log('\n🎉 Toutes les données ont été mises à jour correctement !');
        } else {
          console.log('\n⚠️  Certaines données ne correspondent pas aux attentes.');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error.message);
    console.error('Détails:', error);
  }
}

// Vérifier que le serveur est démarré
console.log('⚠️  Assurez-vous que le serveur est démarré (npm start)');
console.log('🚀 Démarrage de la mise à jour...\n');

// Exécuter la mise à jour
updateDagnitoAgent();
