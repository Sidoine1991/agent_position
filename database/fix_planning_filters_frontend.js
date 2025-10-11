
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
        'Authorization': `Bearer ${token}`,
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
    
    console.log(`👥 Agents trouvés: ${agents.length}`);

    // Mettre à jour le select des agents
    const agentSelect = document.getElementById('agent-select');
    if (agentSelect) {
      agentSelect.innerHTML = '<option value="">Tous les agents</option>';
      agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        const name = agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email;
        option.textContent = `${name} (${agent.email})`;
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
    
    console.log(`📁 Projets trouvés: ${projects.size}`);

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
