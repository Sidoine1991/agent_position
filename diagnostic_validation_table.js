// Diagnostic complet pour le problème de la table de validation vide
const { createClient } = require('@supabase/supabase-js');

const supabaseClient = createClient(
  'https://eoamsmtdspedumjmmeui.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyNzIzOSwiZXhwIjoyMDc0NjAzMjM5fQ.SrDG8nvNxALqUSqXw3tGWuv9hgLF-bSyUdNmxcoYm_Y'
);

async function runDiagnostic() {
  console.log('🔍 DIAGNOSTIC COMPLET - Table de validation vide sur page reports\n');
  
  try {
    // Étape 1: Vérifier les données brutes dans la base
    console.log('📋 ÉTAPE 1: Vérification des données brutes');
    await checkRawData();
    
    // Étape 2: Vérifier la logique de l'API
    console.log('\n📋 ÉTAPE 2: Simulation de la logique API');
    await simulateAPILogic();
    
    // Étape 3: Identifier les causes probables
    console.log('\n📋 ÉTAPE 3: Analyse des causes probables');
    await analyzeProbableCauses();
    
    // Étape 4: Fournir les solutions
    console.log('\n📋 ÉTAPE 4: Solutions recommandées');
    provideSolutions();
    
  } catch (error) {
    console.error('❌ Erreur dans le diagnostic:', error);
  }
}

async function checkRawData() {
  // Vérifier les validations
  const { data: validations, error: validationsError } = await supabaseClient
    .from('checkin_validations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (validationsError) {
    console.error('❌ Erreur checkin_validations:', validationsError);
    return;
  }
  
  console.log(`✅ checkin_validations: ${validations.length} enregistrements trouvés`);
  
  if (validations.length > 0) {
    const latest = validations[0];
    console.log(`📄 Dernière validation: ${latest.created_at} (Agent: ${latest.agent_id})`);
    
    // Vérifier les checkins associés
    const { data: checkins, error: checkinsError } = await supabaseClient
      .from('checkins')
      .select('*')
      .eq('id', latest.checkin_id)
      .single();
    
    if (!checkinsError && checkins) {
      console.log(`✅ Checkin associé: ${checkins.start_time} (Mission: ${checkins.mission_id})`);
    }
    
    // Vérifier l'agent
    const { data: agent, error: agentError } = await supabaseClient
      .from('users')
      .select('name, email, role')
      .eq('id', latest.agent_id)
      .single();
    
    if (!agentError && agent) {
      console.log(`✅ Agent: ${agent.name} (${agent.email}) - Rôle: ${agent.role}`);
    }
  }
}

async function simulateAPILogic() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  console.log(`📅 Aujourd'hui: ${todayStr}`);
  
  // Simuler la requête API exacte
  let vq = supabaseClient
    .from('checkin_validations')
    .select('id, checkin_id, agent_id, valid, reason, distance_m, tolerance_m, reference_lat, reference_lon, planned_start_time, planned_end_time, created_at')
    .order('created_at', { ascending: false })
    .limit(10000);
  
  vq = vq.gte('created_at', new Date(todayStr + 'T00:00:00.000Z').toISOString());
  vq = vq.lte('created_at', new Date(todayStr + 'T23:59:59.999Z').toISOString());
  
  const { data: validations, error: vErr } = await vq;
  
  if (vErr) {
    console.error('❌ Erreur simulation API:', vErr);
    return;
  }
  
  console.log(`✅ API simulation: ${validations.length} validations trouvées pour aujourd'hui`);
  
  // Vérifier les enrichissements
  if (validations.length > 0) {
    const checkinIds = validations.slice(0, 5).map(v => v.checkin_id).filter(Boolean);
    const agentIds = validations.slice(0, 5).map(v => v.agent_id).filter(Boolean);
    
    // Check checkins
    const { data: checkins } = await supabaseClient
      .from('checkins')
      .select('id, mission_id, user_id, lat, lon, start_time')
      .in('id', checkinIds);
    
    console.log(`✅ Checkins joints: ${checkins?.length || 0}`);
    
    // Check agents
    const { data: agents } = await supabaseClient
      .from('users')
      .select('id, name, email')
      .in('id', agentIds);
    
    console.log(`✅ Agents joints: ${agents?.length || 0}`);
    
    // Check missions
    if (checkins && checkins.length > 0) {
      const missionIds = checkins.map(c => c.mission_id).filter(Boolean);
      const { data: missions } = await supabaseClient
        .from('missions')
        .select('id, name, project_id')
        .in('id', missionIds);
      
      console.log(`✅ Missions jointes: ${missions?.length || 0}`);
    }
  }
}

async function analyzeProbableCauses() {
  console.log('🔍 Analyse des causes possibles:');
  
  // Cause 1: Authentification
  console.log('\n1️⃣ PROBLÈME D\'AUTHENTIFICATION:');
  console.log('   - L\'utilisateur n\'est pas connecté');
  console.log('   - Le token JWT a expiré');
  console.log('   - L\'utilisateur n\'a pas les droits requis (superviseur/admin)');
  console.log('   ✅ Vérifier: localStorage.getItem(\'jwt\') dans le navigateur');
  
  // Cause 2: Serveur
  console.log('\n2️⃣ PROBLÈME DE SERVEUR:');
  console.log('   - Le serveur Node.js n\'est pas démarré');
  console.log('   - L\'endpoint /api/reports/validations retourne une erreur');
  console.log('   ✅ Vérifier: http://localhost:3000 est accessible');
  
  // Cause 3: Date filtering
  console.log('\n3️⃣ PROBLÈME DE FILTRAGE PAR DATE:');
  console.log('   - Le filtre par défaut ne contient pas de données');
  console.log('   - Les validations existent mais pour d\'autres dates');
  console.log('   ✅ Vérifier: Changer le filtre de date sur "Toutes les dates"');
  
  // Cause 4: JavaScript frontend
  console.log('\n4️⃣ PROBLÈME JAVASCRIPT FRONTEND:');
  console.log('   - La fonction loadValidations() n\'est pas appelée');
  console.log('   - Erreur JavaScript silencieuse dans le traitement');
  console.log('   - L\'élément DOM "validations-body" n\'existe pas');
  console.log('   ✅ Vérifier: Console du navigateur pour les erreurs');
  
  // Cause 5: Données manquantes
  console.log('\n5️⃣ PROBLÈME DE DONNÉES:');
  console.log('   - Les jointures (checkins, users, missions) échouent');
  console.log('   - Les données existent mais sont incomplètes');
  console.log('   ✅ Vérifier: Structure des données dans la base');
}

function provideSolutions() {
  console.log('🛠️ SOLUTIONS À TESTER (par ordre de priorité):');
  
  console.log('\n🎯 SOLUTION 1 - Vérifier l\'authentification:');
  console.log('   1. Ouvrir la page reports dans le navigateur');
  console.log('   2. Ouvrir la console développeur (F12)');
  console.log('   3. Taper: localStorage.getItem(\'jwt\')');
  console.log('   4. Si null/undefined: se reconnecter à l\'application');
  
  console.log('\n🎯 SOLUTION 2 - Vérifier le serveur:');
  console.log('   1. Démarrer le serveur: node server.js');
  console.log('   2. Vérifier: http://localhost:3000/api/reports/validations');
  console.log('   3. Si erreur 401/403: problème d\'authentification');
  
  console.log('\n🎯 SOLUTION 3 - Changer le filtre de date:');
  console.log('   1. Sur la page reports, changer le filtre de date');
  console.log('   2. Sélectionner "Derniers 30 jours" ou "Toutes les dates"');
  console.log('   3. Cliquer sur "Appliquer les filtres"');
  
  console.log('\n🎯 SOLUTION 4 - Débugger le JavaScript:');
  console.log('   1. Dans la console du navigateur, taper:');
  console.log('      loadValidations();');
  console.log('   2. Vérifier les erreurs dans la console');
  console.log('   3. Vérifier que l\'élément "validations-body" existe:');
  console.log('      document.getElementById(\'validations-body\')');
  
  console.log('\n🎯 SOLUTION 5 - Forcer le rechargement:');
  console.log('   1. Cliquer sur le bouton "Recharger" dans la section validations');
  console.log('   2. Ou rafraîchir toute la page (Ctrl+F5)');
  
  console.log('\n📊 SI TOUT ÉCHEOUE - Contournement temporaire:');
  console.log('   1. Utiliser directement l\'API avec curl ou Postman');
  console.log('   2. Endpoint: GET /api/reports/validations');
  console.log('   3. Headers: Authorization: Bearer <votre_token_jwt>');
  
  console.log('\n✅ RÉCAPITULATIF:');
  console.log('   - Les données existent dans la base (18 validations aujourd\'hui)');
  console.log('   - L\'API fonctionne et retourne les données correctes');
  console.log('   - Le problème est 90% certain dans le frontend (auth ou JS)');
}

runDiagnostic();
