
// Script de correction pour l'affichage des planifications
// Ajoutez ce code dans la console du navigateur sur la page de planification

console.log('🔧 Correction de l'affichage des planifications...');

// Fonction pour charger les planifications avec filtres (version corrigée)
async function loadPlanificationsFixed(from, to, agentId = '', projectName = '') {
  try {
    console.log('📡 Chargement des planifications...');
    console.log('📅 Période:', from, 'à', to);
    console.log('👤 Agent:', agentId || 'Tous');
    console.log('📁 Projet:', projectName || 'Tous');
    
    // Récupérer le token JWT
    const token = localStorage.getItem('jwt') || localStorage.getItem('access_token') || localStorage.getItem('token');
    if (!token) {
      console.error('❌ Token JWT non trouvé');
      return [];
    }

    // Construire l'URL avec les paramètres
    let url = `/api/planifications?from=${from}&to=${to}`;
    if (agentId) url += `&agent_id=${agentId}`;
    if (projectName) url += `&project_id=${projectName}`;

    console.log('🌐 URL:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Erreur API:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('📋 Détails:', errorText);
      return [];
    }

    const result = await response.json();
    console.log('✅ Réponse API:', result);

    const planifications = result.items || result.data || result || [];
    console.log(`📊 Planifications trouvées: ${planifications.length}`);

    if (planifications.length > 0) {
      console.log('📋 Détails des planifications:');
      planifications.forEach((plan, index) => {
        const userName = plan.user ? plan.user.name : `Utilisateur ${plan.user_id}`;
        console.log(`   ${index + 1}. ${plan.date} - ${userName} - Projet: ${plan.project_name || 'Aucun'} - ${plan.description_activite || 'Aucune activité'}`);
      });
    }

    return planifications;
  } catch (error) {
    console.error('❌ Erreur lors du chargement:', error);
    return [];
  }
}

// Fonction pour tester le chargement de la semaine actuelle
async function testCurrentWeek() {
  const today = new Date();
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
  const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
  
  const from = startOfWeek.toISOString().split('T')[0];
  const to = endOfWeek.toISOString().split('T')[0];
  
  console.log('📅 Test de la semaine actuelle:', from, 'à', to);
  
  // Test sans filtres
  console.log('\n🔍 Test sans filtres:');
  const allPlanifications = await loadPlanificationsFixed(from, to);
  
  // Test avec filtre agent
  console.log('\n👤 Test avec filtre agent (ID 22):');
  const agentPlanifications = await loadPlanificationsFixed(from, to, '22');
  
  // Test avec filtre projet
  console.log('\n📁 Test avec filtre projet (DELTA Mono):');
  const projectPlanifications = await loadPlanificationsFixed(from, to, '', 'DELTA Mono');
  
  // Afficher le résumé
  console.log('\n📊 Résumé des tests:');
  console.log(`   Toutes les planifications: ${allPlanifications.length}`);
  console.log(`   Filtre par agent: ${agentPlanifications.length}`);
  console.log(`   Filtre par projet: ${projectPlanifications.length}`);
}

// Exécuter les tests
testCurrentWeek();
