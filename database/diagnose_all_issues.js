// Script de diagnostic complet pour tous les problèmes
// Exécutez ce script dans la console du navigateur sur http://localhost:3010/planning.html

console.log('🔍 Diagnostic complet des problèmes de planification...');

// Fonction pour diagnostiquer les fonctions globales
function diagnoseGlobalFunctions() {
  console.log('\n🔍 Diagnostic des fonctions globales:');
  
  const functions = ['editWeekPlanning', 'saveWeekPlanning', 'loadWeek', 'loadMonth'];
  let allAvailable = true;
  
  functions.forEach(func => {
    const available = typeof window[func] !== 'undefined';
    console.log(`   ${func}: ${available ? '✅' : '❌'}`);
    if (!available) allAvailable = false;
  });
  
  if (!allAvailable) {
    console.log('❌ Certaines fonctions ne sont pas disponibles globalement');
    console.log('💡 Solution: Rechargez la page pour que les fonctions soient exposées');
    return false;
  }
  
  console.log('✅ Toutes les fonctions sont disponibles globalement');
  return true;
}

// Fonction pour diagnostiquer les endpoints API
async function diagnoseAPIEndpoints() {
  console.log('\n🔍 Diagnostic des endpoints API:');
  
  const token = localStorage.getItem('jwt') || localStorage.getItem('access_token') || localStorage.getItem('token');
  if (!token) {
    console.log('❌ Token JWT non trouvé');
    return false;
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`
  };
  
  // Test 1: Endpoint /api/planifications
  console.log('📡 Test de /api/planifications...');
  try {
    const response1 = await fetch('/api/planifications', { headers });
    console.log(`   Status: ${response1.status} ${response1.statusText}`);
    
    if (response1.status === 500) {
      console.log('❌ Erreur 500 sur /api/planifications');
      const errorText = await response1.text();
      console.log('📋 Détails:', errorText);
      return false;
    } else if (response1.ok) {
      console.log('✅ /api/planifications fonctionne');
    }
  } catch (error) {
    console.log('❌ Erreur réseau:', error.message);
    return false;
  }
  
  // Test 2: Endpoint /api/planifications/weekly-summary
  console.log('📡 Test de /api/planifications/weekly-summary...');
  try {
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    
    const from = startOfWeek.toISOString().split('T')[0];
    const to = endOfWeek.toISOString().split('T')[0];
    
    const response2 = await fetch(`/api/planifications/weekly-summary?from=${from}&to=${to}`, { headers });
    console.log(`   Status: ${response2.status} ${response2.statusText}`);
    
    if (response2.status === 404) {
      console.log('❌ Erreur 404 sur /api/planifications/weekly-summary');
      console.log('💡 Solution: Vérifiez que le serveur est redémarré');
      return false;
    } else if (response2.ok) {
      console.log('✅ /api/planifications/weekly-summary fonctionne');
    }
  } catch (error) {
    console.log('❌ Erreur réseau:', error.message);
    return false;
  }
  
  return true;
}

// Fonction pour diagnostiquer l'interface
function diagnoseInterface() {
  console.log('\n🔍 Diagnostic de l\'interface:');
  
  // Vérifier les éléments de base
  const weekStartInput = document.getElementById('week-start');
  const monthInput = document.getElementById('month');
  const agentSelect = document.getElementById('agent-select');
  const projectSelect = document.getElementById('project-select');
  
  console.log(`   Week start input: ${weekStartInput ? '✅' : '❌'}`);
  console.log(`   Month input: ${monthInput ? '✅' : '❌'}`);
  console.log(`   Agent select: ${agentSelect ? '✅' : '❌'}`);
  console.log(`   Project select: ${projectSelect ? '✅' : '❌'}`);
  
  // Vérifier les boutons d'édition
  const editButtons = document.querySelectorAll('[onclick*="editWeekPlanning"]');
  console.log(`   Boutons d'édition: ${editButtons.length} trouvés`);
  
  // Vérifier les champs de saisie dans le Gantt
  const startTimeInputs = document.querySelectorAll('input[id^="gs-"]');
  const endTimeInputs = document.querySelectorAll('input[id^="ge-"]');
  const okButtons = document.querySelectorAll('button[data-date]');
  
  console.log(`   Champs heure début: ${startTimeInputs.length}`);
  console.log(`   Champs heure fin: ${endTimeInputs.length}`);
  console.log(`   Boutons OK: ${okButtons.length}`);
  
  const interfaceOk = weekStartInput && monthInput && agentSelect && projectSelect;
  
  if (!interfaceOk) {
    console.log('❌ Interface incomplète');
    return false;
  }
  
  if (editButtons.length === 0 && okButtons.length === 0) {
    console.log('⚠️  Aucun bouton d\'édition trouvé');
    console.log('💡 Solution: Chargez une semaine pour voir les boutons d\'édition');
    return false;
  }
  
  console.log('✅ Interface complète');
  return true;
}

// Fonction pour tester l'enregistrement
async function testSaving() {
  console.log('\n🔍 Test de l\'enregistrement:');
  
  const token = localStorage.getItem('jwt') || localStorage.getItem('access_token') || localStorage.getItem('token');
  if (!token) {
    console.log('❌ Token JWT non trouvé');
    return false;
  }
  
  const testDate = new Date().toISOString().split('T')[0];
  const requestData = {
    date: testDate,
    planned_start_time: '08:00:00',
    planned_end_time: '17:00:00',
    description_activite: 'Test de diagnostic complet',
    project_name: 'DELTA Mono'
  };
  
  console.log('📋 Test d\'enregistrement avec:', requestData);
  
  try {
    const response = await fetch('/api/planifications', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 500) {
      console.log('❌ Erreur 500 lors de l\'enregistrement');
      const errorText = await response.text();
      console.log('📋 Détails:', errorText);
      return false;
    } else if (response.ok) {
      const result = await response.json();
      console.log('✅ Enregistrement réussi:', result);
      return true;
    } else {
      console.log('❌ Erreur lors de l\'enregistrement');
      const errorText = await response.text();
      console.log('📋 Détails:', errorText);
      return false;
    }
  } catch (error) {
    console.log('❌ Erreur réseau lors de l\'enregistrement:', error.message);
    return false;
  }
}

// Fonction pour forcer le rechargement des fonctions
function forceReloadFunctions() {
  console.log('\n🔧 Tentative de rechargement des fonctions...');
  
  try {
    // Vérifier si le script planning.js est chargé
    const scripts = Array.from(document.scripts);
    const planningScript = scripts.find(script => script.src && script.src.includes('planning.js'));
    
    if (planningScript) {
      console.log('✅ Script planning.js trouvé');
      
      // Essayer de recharger le script
      const newScript = document.createElement('script');
      newScript.src = planningScript.src + '?v=' + Date.now();
      newScript.onload = () => {
        console.log('✅ Script planning.js rechargé');
        // Vérifier si les fonctions sont maintenant disponibles
        setTimeout(() => {
          const functions = ['editWeekPlanning', 'saveWeekPlanning', 'loadWeek', 'loadMonth'];
          functions.forEach(func => {
            const available = typeof window[func] !== 'undefined';
            console.log(`   ${func}: ${available ? '✅' : '❌'}`);
          });
        }, 1000);
      };
      newScript.onerror = () => {
        console.log('❌ Erreur lors du rechargement du script');
      };
      document.head.appendChild(newScript);
    } else {
      console.log('❌ Script planning.js non trouvé');
    }
  } catch (error) {
    console.log('❌ Erreur lors du rechargement:', error);
  }
}

// Fonction principale
async function runCompleteDiagnostic() {
  console.log('🚀 Démarrage du diagnostic complet...');
  
  try {
    // 1. Diagnostic des fonctions globales
    const functionsOk = diagnoseGlobalFunctions();
    
    // 2. Diagnostic des endpoints API
    const apiOk = await diagnoseAPIEndpoints();
    
    // 3. Diagnostic de l'interface
    const interfaceOk = diagnoseInterface();
    
    // 4. Test de l'enregistrement
    const savingOk = await testSaving();
    
    // Résumé
    console.log('\n📊 Résumé du diagnostic:');
    console.log('─'.repeat(60));
    console.log(`Fonctions globales: ${functionsOk ? '✅' : '❌'}`);
    console.log(`Endpoints API: ${apiOk ? '✅' : '❌'}`);
    console.log(`Interface: ${interfaceOk ? '✅' : '❌'}`);
    console.log(`Enregistrement: ${savingOk ? '✅' : '❌'}`);
    
    // Solutions
    console.log('\n💡 Solutions recommandées:');
    
    if (!functionsOk) {
      console.log('1. Rechargez la page (F5) pour que les fonctions soient exposées');
    }
    
    if (!apiOk) {
      console.log('2. Redémarrez le serveur Node.js');
      console.log('3. Vérifiez que le serveur fonctionne sur le port 3010');
    }
    
    if (!interfaceOk) {
      console.log('4. Chargez une semaine dans le calendrier');
      console.log('5. Vérifiez que les filtres Agent et Projet sont remplis');
    }
    
    if (!savingOk) {
      console.log('6. Vérifiez les logs du serveur pour les erreurs de contrainte');
      console.log('7. Exécutez le script SQL de correction des contraintes');
    }
    
    // Tentative de correction automatique
    if (!functionsOk) {
      console.log('\n🔧 Tentative de correction automatique...');
      forceReloadFunctions();
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale lors du diagnostic:', error);
  }
}

// Exécuter le diagnostic
runCompleteDiagnostic();
