// Script de diagnostic pour l'enregistrement des planifications
// Ajoutez ce code dans la console du navigateur sur la page de planification

console.log('🔍 Diagnostic de l\'enregistrement des planifications...');

// Fonction pour diagnostiquer l'enregistrement
async function debugPlanificationSave() {
  try {
    console.log('📡 Test de l\'enregistrement avec diagnostic détaillé...');
    
    // Récupérer le token JWT
    const token = localStorage.getItem('jwt') || localStorage.getItem('access_token') || localStorage.getItem('token');
    if (!token) {
      console.error('❌ Token JWT non trouvé');
      console.log('💡 Vérifiez que vous êtes connecté');
      return;
    }

    console.log('✅ Token JWT trouvé');

    // Données de test
    const testDate = new Date().toISOString().split('T')[0];
    const requestData = {
      date: testDate,
      planned_start_time: '08:00:00',
      planned_end_time: '17:00:00',
      description_activite: 'Test de diagnostic - saisie manuelle',
      project_id: 'DELTA Mono'
    };

    console.log('📋 Données à envoyer:', requestData);
    console.log('📋 Headers:', {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const response = await fetch('/api/planifications', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    console.log('📡 Réponse reçue:');
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);
    console.log('   Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error('❌ Erreur API:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('📋 Détails de l\'erreur:', errorText);
      
      // Analyser l'erreur
      try {
        const errorJson = JSON.parse(errorText);
        console.log('📋 Erreur JSON:', errorJson);
      } catch (e) {
        console.log('📋 Erreur texte brut:', errorText);
      }
      
      return false;
    }

    const result = await response.json();
    console.log('✅ Réponse JSON:', result);

    if (result.success) {
      console.log('🎉 Planification enregistrée avec succès!');
      console.log('📋 Planification créée:', result.planification);
      return true;
    } else {
      console.error('❌ Échec de l\'enregistrement:', result.error);
      return false;
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    console.log('📋 Stack trace:', error.stack);
    return false;
  }
}

// Fonction pour vérifier l'interface de saisie
function checkPlanningInterface() {
  console.log('\n🔍 Vérification de l\'interface de planification...');
  
  // Vérifier les éléments de l'interface
  const weekStartInput = document.getElementById('week-start');
  const monthInput = document.getElementById('month');
  const agentSelect = document.getElementById('agent-select');
  const projectSelect = document.getElementById('project-select');
  
  console.log('📋 Éléments de l\'interface:');
  console.log(`   Week start input: ${weekStartInput ? '✅ Trouvé' : '❌ Manquant'}`);
  console.log(`   Month input: ${monthInput ? '✅ Trouvé' : '❌ Manquant'}`);
  console.log(`   Agent select: ${agentSelect ? '✅ Trouvé' : '❌ Manquant'}`);
  console.log(`   Project select: ${projectSelect ? '✅ Trouvé' : '❌ Manquant'}`);
  
  // Vérifier les boutons d'édition
  const editButtons = document.querySelectorAll('[onclick*="editWeekPlanning"]');
  console.log(`   Boutons d'édition: ${editButtons.length} trouvés`);
  
  if (editButtons.length === 0) {
    console.log('⚠️  Aucun bouton d\'édition trouvé');
    console.log('💡 Vérifiez que la semaine est chargée');
  }
  
  // Vérifier les fonctions globales
  console.log('\n📋 Fonctions globales:');
  console.log(`   editWeekPlanning: ${typeof window.editWeekPlanning !== 'undefined' ? '✅ Définie' : '❌ Manquante'}`);
  console.log(`   saveWeekPlanning: ${typeof window.saveWeekPlanning !== 'undefined' ? '✅ Définie' : '❌ Manquante'}`);
  console.log(`   loadWeek: ${typeof window.loadWeek !== 'undefined' ? '✅ Définie' : '❌ Manquante'}`);
  
  return {
    weekStartInput: !!weekStartInput,
    monthInput: !!monthInput,
    agentSelect: !!agentSelect,
    projectSelect: !!projectSelect,
    editButtons: editButtons.length,
    functions: {
      editWeekPlanning: typeof window.editWeekPlanning !== 'undefined',
      saveWeekPlanning: typeof window.saveWeekPlanning !== 'undefined',
      loadWeek: typeof window.loadWeek !== 'undefined'
    }
  };
}

// Fonction pour tester l'ouverture de la modal d'édition
function testEditModal() {
  console.log('\n🔍 Test de l\'ouverture de la modal d\'édition...');
  
  try {
    // Simuler l'ouverture de la modal
    if (typeof window.editWeekPlanning === 'function') {
      const today = new Date();
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
      
      const weekStart = startOfWeek.toISOString().split('T')[0];
      const weekEnd = endOfWeek.toISOString().split('T')[0];
      
      console.log(`📅 Test avec la semaine: ${weekStart} à ${weekEnd}`);
      
      // Appeler la fonction
      window.editWeekPlanning(weekStart, weekEnd);
      
      console.log('✅ Fonction editWeekPlanning appelée');
      
      // Vérifier si la modal s'est ouverte
      setTimeout(() => {
        const modal = document.getElementById('weekEditModal');
        if (modal) {
          console.log('✅ Modal d\'édition ouverte');
        } else {
          console.log('❌ Modal d\'édition non trouvée');
        }
      }, 1000);
      
    } else {
      console.log('❌ Fonction editWeekPlanning non disponible');
    }
  } catch (error) {
    console.error('❌ Erreur lors du test de la modal:', error);
  }
}

// Fonction principale de diagnostic
async function runDiagnostic() {
  console.log('🚀 Démarrage du diagnostic complet...');
  
  try {
    // 1. Vérifier l'interface
    const interfaceCheck = checkPlanningInterface();
    
    // 2. Tester l'enregistrement
    const saveTest = await debugPlanificationSave();
    
    // 3. Tester la modal d'édition
    testEditModal();
    
    // Résumé
    console.log('\n📊 Résumé du diagnostic:');
    console.log('─'.repeat(60));
    console.log(`Interface complète: ${interfaceCheck.weekStartInput && interfaceCheck.monthInput && interfaceCheck.agentSelect && interfaceCheck.projectSelect ? '✅' : '❌'}`);
    console.log(`Boutons d'édition: ${interfaceCheck.editButtons > 0 ? '✅' : '❌'}`);
    console.log(`Fonctions disponibles: ${interfaceCheck.functions.editWeekPlanning && interfaceCheck.functions.saveWeekPlanning ? '✅' : '❌'}`);
    console.log(`Enregistrement: ${saveTest ? '✅' : '❌'}`);
    
    if (interfaceCheck.editButtons === 0) {
      console.log('\n💡 Solution pour l\'interface:');
      console.log('1. Vérifiez que la semaine est chargée');
      console.log('2. Rechargez la page');
      console.log('3. Vérifiez que les filtres Agent et Projet sont remplis');
    }
    
    if (!saveTest) {
      console.log('\n💡 Solution pour l\'enregistrement:');
      console.log('1. Vérifiez que vous êtes connecté');
      console.log('2. Vérifiez les logs du serveur');
      console.log('3. Redémarrez le serveur si nécessaire');
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale lors du diagnostic:', error);
  }
}

// Exécuter le diagnostic
runDiagnostic();
