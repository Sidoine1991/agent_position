const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Diagnostic du problème de redirection...\n');

async function diagnoseRedirectIssue() {
  try {
    // 1. Vérifier l'état du serveur
    console.log('1️⃣ Vérification de l\'état du serveur...');
    try {
      const response = await fetch('http://localhost:3010/api/me');
      if (response.ok) {
        console.log('✅ Serveur local accessible');
      } else {
        console.log('❌ Serveur local non accessible:', response.status);
      }
    } catch (error) {
      console.log('❌ Erreur de connexion au serveur:', error.message);
    }

    // 2. Vérifier les endpoints critiques
    console.log('\n2️⃣ Vérification des endpoints critiques...');
    const endpoints = [
      '/api/me',
      '/api/profile',
      '/api/admin/agents',
      '/api/planifications',
      '/api/admin/checkins/latest'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://localhost:3010${endpoint}`);
        console.log(`${response.ok ? '✅' : '❌'} ${endpoint}: ${response.status}`);
      } catch (error) {
        console.log(`❌ ${endpoint}: ${error.message}`);
      }
    }

    // 3. Vérifier la structure de la base de données
    console.log('\n3️⃣ Vérification de la structure de la base de données...');
    
    // Vérifier la table users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, role, project_name')
      .limit(5);
    
    if (usersError) {
      console.log('❌ Erreur table users:', usersError.message);
    } else {
      console.log('✅ Table users accessible:', users.length, 'utilisateurs trouvés');
    }

    // Vérifier la table planifications
    const { data: planifications, error: planError } = await supabase
      .from('planifications')
      .select('*')
      .limit(5);
    
    if (planError) {
      console.log('❌ Erreur table planifications:', planError.message);
    } else {
      console.log('✅ Table planifications accessible:', planifications.length, 'planifications trouvées');
    }

    // 4. Analyser le problème de redirection
    console.log('\n4️⃣ Analyse du problème de redirection...');
    console.log('🔍 Le problème pourrait être causé par :');
    console.log('   - Erreurs JavaScript qui interrompent le flux normal');
    console.log('   - Gestionnaires d\'événements qui redirigent automatiquement');
    console.log('   - Logique de navigation qui force le retour au Dashboard');
    console.log('   - Erreurs 404 qui déclenchent des fallbacks de navigation');

    // 5. Vérifier les logs d'erreur spécifiques
    console.log('\n5️⃣ Erreurs détectées dans les logs :');
    console.log('❌ 404: /api/admin/checkins - Endpoint manquant');
    console.log('❌ TypeError: users.forEach is not a function - Erreur de traitement des données');
    console.log('❌ admin/agents indisponible - Problème d\'affichage des agents');

    // 6. Recommandations
    console.log('\n6️⃣ Recommandations pour corriger le problème :');
    console.log('   1. Ajouter l\'endpoint manquant /api/admin/checkins');
    console.log('   2. Corriger l\'erreur users.forEach dans dashboard.js');
    console.log('   3. Vérifier la logique de navigation après clic sur "Marquer ma présence"');
    console.log('   4. Ajouter des logs de débogage pour tracer le flux de navigation');

    // 7. Créer un script de test pour la navigation
    console.log('\n7️⃣ Création d\'un script de test de navigation...');
    
    const testScript = `
// Script de test pour diagnostiquer la redirection
console.log('🧪 Test de navigation - Marquer ma présence');

// Intercepter les changements de location
let originalLocation = window.location;
let navigationLog = [];

// Override de window.location pour capturer les redirections
Object.defineProperty(window, 'location', {
  get: function() {
    return originalLocation;
  },
  set: function(val) {
    navigationLog.push({
      timestamp: new Date().toISOString(),
      action: 'location_change',
      from: originalLocation.href,
      to: val
    });
    console.log('🔄 Redirection détectée:', val);
    originalLocation = val;
  }
});

// Intercepter les clics sur le bouton "Marquer ma présence"
document.addEventListener('click', function(event) {
  if (event.target.textContent.includes('Marquer ma présence') || 
      event.target.textContent.includes('Présence')) {
    console.log('🎯 Clic sur bouton présence détecté');
    navigationLog.push({
      timestamp: new Date().toISOString(),
      action: 'presence_button_click',
      element: event.target
    });
  }
});

// Afficher les logs de navigation
setInterval(() => {
  if (navigationLog.length > 0) {
    console.log('📊 Logs de navigation:', navigationLog);
  }
}, 5000);

console.log('✅ Script de diagnostic de navigation chargé');
`;

    console.log('📝 Script de test créé. Copiez et collez ce code dans la console du navigateur :');
    console.log(testScript);

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  }
}

diagnoseRedirectIssue();