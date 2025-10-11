#!/usr/bin/env node

/**
 * Script pour corriger les filtres de planification
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

async function createSamplePlanifications() {
  console.log('📋 Création de planifications d\'exemple...\n');
  
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

    // Créer des planifications d'exemple pour différentes dates
    const samplePlanifications = [
      {
        user_id: agent.id,
        agent_id: agent.id,
        date: '2025-01-27',
        planned_start_time: '08:00:00',
        planned_end_time: '17:00:00',
        description_activite: 'Visite des riziculteurs dans la zone de production',
        project_name: agent.project_name,
        resultat_journee: null,
        observations: null
      },
      {
        user_id: agent.id,
        agent_id: agent.id,
        date: '2025-01-28',
        planned_start_time: '09:00:00',
        planned_end_time: '16:00:00',
        description_activite: 'Formation des agriculteurs sur les nouvelles techniques',
        project_name: agent.project_name,
        resultat_journee: null,
        observations: null
      },
      {
        user_id: agent.id,
        agent_id: agent.id,
        date: '2025-01-29',
        planned_start_time: '08:30:00',
        planned_end_time: '17:30:00',
        description_activite: 'Suivi des parcelles de démonstration',
        project_name: agent.project_name,
        resultat_journee: null,
        observations: null
      }
    ];

    // Insérer les planifications
    const { data, error } = await supabase
      .from('planifications')
      .upsert(samplePlanifications, { 
        onConflict: 'user_id,date',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.log('❌ Erreur lors de la création des planifications:', error.message);
      return false;
    } else {
      console.log('✅ Planifications d\'exemple créées:', data.length);
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

async function verifyDataForFilters() {
  console.log('\n🔍 Vérification des données pour les filtres...\n');
  
  try {
    // Vérifier les agents
    const { data: agents, error: agentError } = await supabase
      .from('users')
      .select('id, name, email, role, project_name')
      .eq('role', 'agent');

    if (agentError) {
      console.log('❌ Erreur agents:', agentError.message);
      return false;
    }

    console.log('👥 Agents pour le filtre:');
    if (agents.length === 0) {
      console.log('   ❌ Aucun agent trouvé');
    } else {
      agents.forEach(agent => {
        console.log(`   ✅ ${agent.name} (${agent.email}) - Projet: ${agent.project_name || 'Aucun'}`);
      });
    }

    // Vérifier les projets
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('project_name')
      .not('project_name', 'is', null);

    if (userError) {
      console.log('❌ Erreur projets:', userError.message);
      return false;
    }

    const projects = new Set(users.map(u => u.project_name?.trim()).filter(Boolean));
    console.log('\n📁 Projets pour le filtre:');
    if (projects.size === 0) {
      console.log('   ❌ Aucun projet trouvé');
    } else {
      Array.from(projects).forEach(project => {
        console.log(`   ✅ ${project}`);
      });
    }

    // Vérifier les planifications
    const { data: plans, error: planError } = await supabase
      .from('planifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (planError) {
      console.log('❌ Erreur planifications:', planError.message);
      return false;
    }

    console.log('\n📋 Planifications existantes:');
    if (plans.length === 0) {
      console.log('   ❌ Aucune planification trouvée');
    } else {
      plans.forEach((plan, index) => {
        console.log(`   ${index + 1}. ${plan.date} - Agent ID: ${plan.user_id} - Projet: ${plan.project_name || 'Aucun'} - ${plan.description_activite || 'Aucune activité'}`);
      });
    }

    return agents.length > 0 && projects.size > 0 && plans.length > 0;
  } catch (err) {
    console.log('❌ Exception lors de la vérification:', err.message);
    return false;
  }
}

async function generateFrontendFixScript() {
  console.log('\n📄 Génération du script de correction frontend...\n');
  
  const frontendFixScript = `
// Script de correction pour les filtres de planification
// Ajoutez ce code dans la console du navigateur sur la page de planification

console.log('🔧 Correction des filtres de planification...');

// Fonction pour charger les agents
async function loadAgentsFixed() {
  try {
    console.log('📡 Chargement des agents...');
    
    // Récupérer le token JWT
    const token = localStorage.getItem('jwt') || localStorage.getItem('access_token') || localStorage.getItem('token');
    if (!token) {
      console.error('❌ Token JWT non trouvé');
      return;
    }

    const response = await fetch('/api/admin/agents', {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Erreur API:', response.status, response.statusText);
      return;
    }

    const result = await response.json();
    console.log('✅ Réponse API:', result);

    const users = result.data || result.agents || result || [];
    const agents = users.filter(user => user.role === 'agent');
    
    console.log(\`👥 Agents trouvés: \${agents.length}\`);

    // Mettre à jour le select des agents
    const agentSelect = document.getElementById('agent-select');
    if (agentSelect) {
      agentSelect.innerHTML = '<option value="">Tous les agents</option>';
      agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        const name = agent.name || \`\${agent.first_name || ''} \${agent.last_name || ''}\`.trim() || agent.email;
        option.textContent = \`\${name} (\${agent.email})\`;
        agentSelect.appendChild(option);
      });
      console.log('✅ Select des agents mis à jour');
    } else {
      console.error('❌ Élément agent-select non trouvé');
    }

    return agents;
  } catch (error) {
    console.error('❌ Erreur lors du chargement des agents:', error);
  }
}

// Fonction pour charger les projets
async function loadProjectsFixed(agents) {
  try {
    console.log('📡 Chargement des projets...');
    
    // Extraire les projets uniques des agents
    const projects = new Set();
    agents.forEach(agent => {
      if (agent.project_name && agent.project_name.trim()) {
        projects.add(agent.project_name.trim());
      }
    });
    
    console.log(\`📁 Projets trouvés: \${projects.size}\`);

    // Mettre à jour le select des projets
    const projectSelect = document.getElementById('project-select');
    if (projectSelect) {
      projectSelect.innerHTML = '<option value="">Tous les projets</option>';
      Array.from(projects).sort().forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        projectSelect.appendChild(option);
      });
      console.log('✅ Select des projets mis à jour');
    } else {
      console.error('❌ Élément project-select non trouvé');
    }

    return Array.from(projects);
  } catch (error) {
    console.error('❌ Erreur lors du chargement des projets:', error);
  }
}

// Fonction principale
async function fixPlanningFilters() {
  console.log('🚀 Démarrage de la correction des filtres...');
  
  const agents = await loadAgentsFixed();
  if (agents && agents.length > 0) {
    await loadProjectsFixed(agents);
    console.log('🎉 Filtres corrigés avec succès!');
  } else {
    console.error('❌ Impossible de corriger les filtres - aucun agent trouvé');
  }
}

// Exécuter la correction
fixPlanningFilters();
`;

  console.log('📋 Script de correction frontend généré:');
  console.log('─'.repeat(60));
  console.log(frontendFixScript);
  console.log('─'.repeat(60));

  // Sauvegarder le script
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'fix_planning_filters_frontend.js');
  
  fs.writeFileSync(scriptPath, frontendFixScript);
  console.log(`\n💾 Script sauvegardé dans: ${scriptPath}`);
}

async function main() {
  console.log('🔧 Correction des filtres de planification\n');
  console.log('═'.repeat(60));

  try {
    // Vérifier les données existantes
    const dataOk = await verifyDataForFilters();
    
    if (!dataOk) {
      console.log('\n⚠️  Données insuffisantes détectées');
      console.log('💡 Création de planifications d\'exemple...');
      
      const created = await createSamplePlanifications();
      if (created) {
        console.log('✅ Planifications d\'exemple créées');
      } else {
        console.log('❌ Impossible de créer des planifications d\'exemple');
      }
    }

    // Vérifier à nouveau après création
    await verifyDataForFilters();

    // Générer le script de correction frontend
    await generateFrontendFixScript();

    console.log('\n💡 Instructions pour résoudre le problème:');
    console.log('─'.repeat(60));
    console.log('1. 🌐 Ouvrez la page de planification dans votre navigateur');
    console.log('2. 🔧 Ouvrez les outils de développement (F12)');
    console.log('3. 📝 Allez dans l\'onglet Console');
    console.log('4. 📋 Copiez et collez le contenu de database/fix_planning_filters_frontend.js');
    console.log('5. ⏎ Appuyez sur Entrée pour exécuter');
    console.log('6. ✅ Vérifiez que les filtres Agent et Projet se remplissent');
    console.log('7. 🔄 Rechargez la page si nécessaire');

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

module.exports = { createSamplePlanifications, verifyDataForFilters, generateFrontendFixScript };
