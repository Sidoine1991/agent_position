const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

async function updateCherifAgent() {
  try {
    console.log('🔄 Mise à jour des informations de CHERIF FABADE DEKANDE LUC via API...');
    
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
    
    // Trouver l'agent CHERIF
    const cherifAgent = agents.find(agent => agent.email === 'lucherifabade@gmail.com');
    
    if (!cherifAgent) {
      console.error('❌ Agent CHERIF non trouvé dans la liste');
      return;
    }
    
    console.log('👤 Agent trouvé:', cherifAgent.name);
    console.log('🆔 ID:', cherifAgent.id);
    
    // Préparer les données de mise à jour
    const updateData = {
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
      years_of_service: 5.0,
      tolerance_radius_meters: 5000
    };
    
    console.log('📝 Données à mettre à jour:', updateData);
    
    // Mettre à jour via l'API PUT
    console.log('🔄 Mise à jour via API...');
    const updateResponse = await fetch(`http://localhost:3010/api/admin/agents/${cherifAgent.id}`, {
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
    console.log('📋 Nouvelles informations:');
    console.log('   Nom:', updatedData.data?.name || updatedData.name);
    console.log('   Téléphone:', updatedData.data?.phone || updatedData.phone);
    console.log('   Département:', updatedData.data?.departement || updatedData.departement);
    console.log('   Commune:', updatedData.data?.commune || updatedData.commune);
    console.log('   Arrondissement:', updatedData.data?.arrondissement || updatedData.arrondissement);
    console.log('   Village:', updatedData.data?.village || updatedData.village);
    console.log('   Latitude:', updatedData.data?.reference_lat || updatedData.reference_lat);
    console.log('   Longitude:', updatedData.data?.reference_lon || updatedData.reference_lon);
    console.log('   Début contrat:', updatedData.data?.contract_start_date || updatedData.contract_start_date);
    console.log('   Fin contrat:', updatedData.data?.contract_end_date || updatedData.contract_end_date);
    console.log('   Expérience:', updatedData.data?.years_of_service || updatedData.years_of_service, 'ans');
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error.message);
    console.error('Détails:', error);
  }
}

// Vérifier que le serveur est démarré
console.log('⚠️  Assurez-vous que le serveur est démarré (npm start)');
console.log('🚀 Démarrage de la mise à jour...\n');

// Exécuter la mise à jour
updateCherifAgent();
