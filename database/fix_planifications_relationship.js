#!/usr/bin/env node

/**
 * Script pour corriger le problème de relation multiple entre planifications et users
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

// Initialiser le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testPlanificationsWithoutEmbed() {
  console.log('🧪 Test des planifications sans embedding...\n');
  
  try {
    // Récupérer les planifications sans embedding
    const { data, error } = await supabase
      .from('planifications')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.log('❌ Erreur:', error.message);
      return [];
    }

    console.log('✅ Planifications récupérées:', data.length);
    
    if (data.length > 0) {
      console.log('\n📋 Détails des planifications:');
      data.forEach((plan, index) => {
        console.log(`   ${index + 1}. Date: ${plan.date} - Agent: ${plan.user_id} - Projet: ${plan.project_name || 'Aucun'} - Activité: ${plan.description_activite || 'Aucune'}`);
      });
    }
    
    return data;
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return [];
  }
}

async function enrichPlanificationsWithUsers(planifications) {
  console.log('\n👥 Enrichissement avec les données utilisateurs...\n');
  
  try {
    if (planifications.length === 0) {
      console.log('⚠️  Aucune planification à enrichir');
      return [];
    }

    // Récupérer les IDs des utilisateurs uniques
    const userIds = [...new Set(planifications.map(p => p.user_id).filter(Boolean))];
    console.log('📋 IDs utilisateurs uniques:', userIds);

    // Récupérer les données des utilisateurs
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, project_name')
      .in('id', userIds);

    if (userError) {
      console.log('❌ Erreur lors de la récupération des utilisateurs:', userError.message);
      return planifications;
    }

    console.log('✅ Utilisateurs récupérés:', users.length);

    // Créer un map pour l'enrichissement
    const usersMap = new Map(users.map(u => [u.id, u]));

    // Enrichir les planifications
    const enrichedPlanifications = planifications.map(plan => ({
      ...plan,
      user: usersMap.get(plan.user_id) || null
    }));

    console.log('\n📊 Planifications enrichies:');
    enrichedPlanifications.forEach((plan, index) => {
      const userName = plan.user ? plan.user.name : `Utilisateur ${plan.user_id}`;
      console.log(`   ${index + 1}. ${plan.date} - ${userName} (${plan.user?.email || 'N/A'}) - Projet: ${plan.project_name || 'Aucun'}`);
    });

    return enrichedPlanifications;
  } catch (err) {
    console.log('❌ Exception lors de l\'enrichissement:', err.message);
    return planifications;
  }
}

async function testFilteringFixed(planifications) {
  console.log('\n🔍 Test du filtrage corrigé...\n');
  
  try {
    // Filtre par agent
    console.log('👥 Test filtre par agent (ID 22):');
    const agentFiltered = planifications.filter(p => p.user_id === 22);
    console.log(`✅ Résultats: ${agentFiltered.length}`);
    agentFiltered.forEach((plan, index) => {
      console.log(`   ${index + 1}. ${plan.date} - ${plan.project_name || 'Aucun projet'}`);
    });
    
    // Filtre par projet
    console.log('\n📁 Test filtre par projet (DELTA Mono):');
    const projectFiltered = planifications.filter(p => p.project_name === 'DELTA Mono');
    console.log(`✅ Résultats: ${projectFiltered.length}`);
    projectFiltered.forEach((plan, index) => {
      console.log(`   ${index + 1}. ${plan.date} - Agent: ${plan.user_id}`);
    });
    
    // Filtre par date (semaine actuelle)
    console.log('\n📅 Test filtre par date (semaine actuelle):');
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    
    const from = startOfWeek.toISOString().split('T')[0];
    const to = endOfWeek.toISOString().split('T')[0];
    
    const dateFiltered = planifications.filter(p => p.date >= from && p.date <= to);
    console.log(`✅ Résultats pour ${from} à ${to}: ${dateFiltered.length}`);
    dateFiltered.forEach((plan, index) => {
      console.log(`   ${index + 1}. ${plan.date} - Agent: ${plan.user_id} - Projet: ${plan.project_name || 'Aucun'}`);
    });
    
  } catch (err) {
    console.log('❌ Exception lors du test de filtrage:', err.message);
  }
}

async function createTestPlanifications() {
  console.log('\n📋 Création de planifications de test...\n');
  
  try {
    // Récupérer l'agent existant
    const { data: agents, error: agentError } = await supabase
      .from('users')
      .select('id, name, email, project_name')
      .eq('role', 'agent')
      .limit(1);

    if (agentError || !agents || agents.length === 0) {
      console.log('❌ Aucun agent trouvé pour créer des planifications');
      return false;
    }

    const agent = agents[0];
    console.log(`📋 Agent trouvé: ${agent.name} (${agent.email}) - Projet: ${agent.project_name}`);

    // Créer des planifications pour différentes dates
    const testDates = [
      '2025-01-27',
      '2025-01-28', 
      '2025-01-29',
      '2025-01-30',
      '2025-01-31'
    ];

    const testPlanifications = testDates.map((date, index) => ({
      user_id: agent.id,
      agent_id: agent.id,
      date: date,
      planned_start_time: '08:00:00',
      planned_end_time: '17:00:00',
      description_activite: `Activité de test ${index + 1} - ${agent.project_name}`,
      project_name: agent.project_name,
      resultat_journee: null,
      observations: null
    }));

    // Insérer les planifications
    const { data, error } = await supabase
      .from('planifications')
      .upsert(testPlanifications, { 
        onConflict: 'user_id,date',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.log('❌ Erreur lors de la création:', error.message);
      return false;
    } else {
      console.log('✅ Planifications de test créées:', data.length);
      data.forEach((plan, index) => {
        console.log(`   ${index + 1}. ${plan.date} - ${plan.description_activite}`);
      });
      return true;
    }
  } catch (err) {
    console.log('❌ Exception lors de la création:', err.message);
    return false;
  }
}

async function generateFixedAPIScript() {
  console.log('\n📄 Génération du script API corrigé...\n');
  
  const fixedAPIScript = `
// Script de correction pour l'API des planifications
// Ce script montre comment corriger l'endpoint /api/planifications

// Dans api/index.js, remplacez la requête Supabase par :

const { data: planifications, error } = await supabaseClient
  .from('planifications')
  .select('*')  // Récupérer toutes les colonnes sans embedding
  .order('date', { ascending: false });

if (error) throw error;

// Enrichir avec les données utilisateurs séparément
const userIds = [...new Set(planifications.map(p => p.user_id).filter(Boolean))];
const { data: users } = await supabaseClient
  .from('users')
  .select('id, name, email, role, project_name')
  .in('id', userIds);

// Créer un map pour l'enrichissement
const usersMap = new Map(users.map(u => [u.id, u]));

// Enrichir les planifications
const enrichedPlanifications = planifications.map(plan => ({
  ...plan,
  user: usersMap.get(plan.user_id) || null
}));

// Appliquer les filtres
let filteredPlanifications = enrichedPlanifications;

if (agent_id) {
  filteredPlanifications = filteredPlanifications.filter(p => p.user_id == agent_id);
}

if (project_id) {
  filteredPlanifications = filteredPlanifications.filter(p => p.project_name === project_id);
}

if (from) {
  filteredPlanifications = filteredPlanifications.filter(p => p.date >= from);
}

if (to) {
  filteredPlanifications = filteredPlanifications.filter(p => p.date <= to);
}

return res.json({
  success: true,
  items: filteredPlanifications
});
`;

  console.log('📋 Script API corrigé:');
  console.log('─'.repeat(60));
  console.log(fixedAPIScript);
  console.log('─'.repeat(60));

  // Sauvegarder le script
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'fix_planifications_api.sql');
  
  fs.writeFileSync(scriptPath, fixedAPIScript);
  console.log(`\n💾 Script sauvegardé dans: ${scriptPath}`);
}

async function generateFrontendFixScript() {
  console.log('\n📄 Génération du script de correction frontend...\n');
  
  const frontendFixScript = `
// Script de correction pour l'affichage des planifications
// Ajoutez ce code dans la console du navigateur sur la page de planification

console.log('🔧 Correction de l\'affichage des planifications...');

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
    let url = \`/api/planifications?from=\${from}&to=\${to}\`;
    if (agentId) url += \`&agent_id=\${agentId}\`;
    if (projectName) url += \`&project_id=\${projectName}\`;

    console.log('🌐 URL:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
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
    console.log(\`📊 Planifications trouvées: \${planifications.length}\`);

    if (planifications.length > 0) {
      console.log('📋 Détails des planifications:');
      planifications.forEach((plan, index) => {
        const userName = plan.user ? plan.user.name : \`Utilisateur \${plan.user_id}\`;
        console.log(\`   \${index + 1}. \${plan.date} - \${userName} - Projet: \${plan.project_name || 'Aucun'} - \${plan.description_activite || 'Aucune activité'}\`);
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
  console.log('\\n🔍 Test sans filtres:');
  const allPlanifications = await loadPlanificationsFixed(from, to);
  
  // Test avec filtre agent
  console.log('\\n👤 Test avec filtre agent (ID 22):');
  const agentPlanifications = await loadPlanificationsFixed(from, to, '22');
  
  // Test avec filtre projet
  console.log('\\n📁 Test avec filtre projet (DELTA Mono):');
  const projectPlanifications = await loadPlanificationsFixed(from, to, '', 'DELTA Mono');
  
  // Afficher le résumé
  console.log('\\n📊 Résumé des tests:');
  console.log(\`   Toutes les planifications: \${allPlanifications.length}\`);
  console.log(\`   Filtre par agent: \${agentPlanifications.length}\`);
  console.log(\`   Filtre par projet: \${projectPlanifications.length}\`);
}

// Exécuter les tests
testCurrentWeek();
`;

  console.log('📋 Script de correction frontend:');
  console.log('─'.repeat(60));
  console.log(frontendFixScript);
  console.log('─'.repeat(60));

  // Sauvegarder le script
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'fix_planifications_display_fixed.js');
  
  fs.writeFileSync(scriptPath, frontendFixScript);
  console.log(`\n💾 Script sauvegardé dans: ${scriptPath}`);
}

async function main() {
  console.log('🔧 Correction du problème de relation multiple\n');
  console.log('═'.repeat(60));

  try {
    // Tester les planifications sans embedding
    const planifications = await testPlanificationsWithoutEmbed();
    
    // Enrichir avec les données utilisateurs
    const enrichedPlanifications = await enrichPlanificationsWithUsers(planifications);
    
    // Tester le filtrage
    await testFilteringFixed(enrichedPlanifications);
    
    // Créer des planifications de test si nécessaire
    if (planifications.length < 3) {
      console.log('\n⚠️  Peu de planifications trouvées, création de données de test...');
      await createTestPlanifications();
    }

    // Générer les scripts de correction
    await generateFixedAPIScript();
    await generateFrontendFixScript();

    console.log('\n💡 Instructions pour résoudre le problème:');
    console.log('─'.repeat(60));
    console.log('1. 🔧 Le problème vient de la relation multiple entre planifications et users');
    console.log('2. 📝 Modifiez l\'endpoint /api/planifications dans api/index.js');
    console.log('3. 🔄 Utilisez le script database/fix_planifications_api.sql comme référence');
    console.log('4. 🌐 Testez avec le script database/fix_planifications_display_fixed.js');
    console.log('5. ✅ Les filtres Agent et Projet devraient maintenant fonctionner');

    console.log('\n✨ Correction terminée!');

  } catch (error) {
    console.error('❌ Erreur fatale lors de la correction:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { 
  testPlanificationsWithoutEmbed, 
  enrichPlanificationsWithUsers, 
  testFilteringFixed,
  createTestPlanifications 
};
