// Script pour la gestion des agents
let jwt = localStorage.getItem('jwt') || '';
let agents = [];
let currentUser = null;

function $(id) { return document.getElementById(id); }

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  headers['Content-Type'] = 'application/json';
  if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
  
  const response = await fetch('/api' + path, {
    ...opts,
    headers
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(error.error || 'Erreur API');
  }
  
  return response.json();
}

// Vérifier l'authentification et les permissions
async function checkAuth() {
  if (!jwt) {
    alert('Veuillez vous connecter pour accéder à cette page');
    window.location.href = window.location.origin + '/';
    return false;
  }
  
  try {
    currentUser = await api('/profile');
    
    // Vérifier que l'utilisateur est admin ou superviseur
    if (currentUser.role !== 'admin' && currentUser.role !== 'supervisor') {
      alert('Accès refusé. Cette page est réservée aux administrateurs et superviseurs.');
      window.location.href = window.location.origin + '/';
      return false;
    }
    
    return true;
  } catch (error) {
    alert('Session expirée. Veuillez vous reconnecter.');
    localStorage.removeItem('jwt');
    window.location.href = window.location.origin + '/';
    return false;
  }
}

// Charger la liste des agents
async function loadAgents() {
  try {
    // Simuler le chargement des agents (à remplacer par une vraie API)
    agents = [
      {
        id: 1,
        name: 'Admin Principal',
        email: 'admin@ccrb.local',
        role: 'admin',
        status: 'active',
        lastActivity: new Date().toISOString(),
        phone: '+229 12 34 56 78'
      },
      {
        id: 2,
        name: 'Superviseur Principal',
        email: 'supervisor@ccrb.local',
        role: 'supervisor',
        status: 'active',
        lastActivity: new Date(Date.now() - 3600000).toISOString(),
        phone: '+229 12 34 56 79'
      },
      {
        id: 3,
        name: 'Agent Test',
        email: 'agent@test.com',
        role: 'agent',
        status: 'active',
        lastActivity: new Date(Date.now() - 7200000).toISOString(),
        phone: '+229 12 34 56 80'
      }
    ];
    
    displayAgents();
    updateStatistics();
    
  } catch (error) {
    console.error('Erreur lors du chargement des agents:', error);
    alert('Erreur lors du chargement des agents');
  }
}

// Afficher les agents dans le tableau
function displayAgents() {
  const tbody = $('agents-table-body');
  
  if (agents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">Aucun agent trouvé</td></tr>';
    return;
  }
  
  tbody.innerHTML = agents.map(agent => `
    <tr>
      <td>
        <img src="/Media/default-avatar.png" alt="Avatar" class="agent-avatar-small">
      </td>
      <td>${agent.name}</td>
      <td>${agent.email}</td>
      <td><span class="role-badge role-${agent.role}">${getRoleText(agent.role)}</span></td>
      <td><span class="status-badge status-${agent.status}">${getStatusText(agent.status)}</span></td>
      <td>${formatDate(agent.lastActivity)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" onclick="editAgent(${agent.id})" title="Modifier">
            ✏️
          </button>
          <button class="btn-icon" onclick="viewAgent(${agent.id})" title="Voir">
            👁️
          </button>
          ${currentUser.role === 'admin' ? `
            <button class="btn-icon btn-danger" onclick="deleteAgent(${agent.id})" title="Supprimer">
              🗑️
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// Mettre à jour les statistiques
function updateStatistics() {
  const totalAgents = agents.length;
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const adminCount = agents.filter(a => a.role === 'admin').length;
  const supervisorCount = agents.filter(a => a.role === 'supervisor').length;
  
  $('total-agents').textContent = totalAgents;
  $('active-agents').textContent = activeAgents;
  $('admin-count').textContent = adminCount;
  $('supervisor-count').textContent = supervisorCount;
}

// Filtrer les agents
function filterAgents() {
  const searchTerm = $('search-agents').value.toLowerCase();
  const roleFilter = $('filter-role').value;
  const statusFilter = $('filter-status').value;
  
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm) || 
                         agent.email.toLowerCase().includes(searchTerm);
    const matchesRole = !roleFilter || agent.role === roleFilter;
    const matchesStatus = !statusFilter || agent.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });
  
  // Afficher les agents filtrés
  const tbody = $('agents-table-body');
  if (filteredAgents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">Aucun agent ne correspond aux critères</td></tr>';
    return;
  }
  
  tbody.innerHTML = filteredAgents.map(agent => `
    <tr>
      <td>
        <img src="/Media/default-avatar.png" alt="Avatar" class="agent-avatar-small">
      </td>
      <td>${agent.name}</td>
      <td>${agent.email}</td>
      <td><span class="role-badge role-${agent.role}">${getRoleText(agent.role)}</span></td>
      <td><span class="status-badge status-${agent.status}">${getStatusText(agent.status)}</span></td>
      <td>${formatDate(agent.lastActivity)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" onclick="editAgent(${agent.id})" title="Modifier">
            ✏️
          </button>
          <button class="btn-icon" onclick="viewAgent(${agent.id})" title="Voir">
            👁️
          </button>
          ${currentUser.role === 'admin' ? `
            <button class="btn-icon btn-danger" onclick="deleteAgent(${agent.id})" title="Supprimer">
              🗑️
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// Ouvrir le modal de création d'agent
function openCreateAgentModal() {
  $('modal-title').textContent = 'Créer un Agent';
  $('agent-form').reset();
  $('agent-modal').classList.remove('hidden');
}

// Fermer le modal
function closeAgentModal() {
  $('agent-modal').classList.add('hidden');
}

// Modifier un agent
function editAgent(agentId) {
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return;
  
  $('modal-title').textContent = 'Modifier l\'Agent';
  $('agent-name').value = agent.name;
  $('agent-email').value = agent.email;
  $('agent-role').value = agent.role;
  $('agent-phone').value = agent.phone || '';
  $('agent-status').value = agent.status;
  $('agent-password').value = '';
  $('agent-password').required = false;
  
  $('agent-modal').classList.remove('hidden');
}

// Voir les détails d'un agent
function viewAgent(agentId) {
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return;
  
  alert(`Détails de l'agent:\n\nNom: ${agent.name}\nEmail: ${agent.email}\nRôle: ${getRoleText(agent.role)}\nStatut: ${getStatusText(agent.status)}\nTéléphone: ${agent.phone || 'Non renseigné'}\nDernière activité: ${formatDate(agent.lastActivity)}`);
}

// Supprimer un agent
async function deleteAgent(agentId) {
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return;
  
  if (!confirm(`Êtes-vous sûr de vouloir supprimer l'agent "${agent.name}" ?`)) {
    return;
  }
  
  try {
    // À implémenter : API pour supprimer un agent
    agents = agents.filter(a => a.id !== agentId);
    displayAgents();
    updateStatistics();
    alert('Agent supprimé avec succès');
  } catch (error) {
    alert('Erreur lors de la suppression: ' + error.message);
  }
}

// Gestion du formulaire d'agent
async function handleAgentForm(e) {
  e.preventDefault();
  
  const formData = {
    name: $('agent-name').value.trim(),
    email: $('agent-email').value.trim(),
    role: $('agent-role').value,
    phone: $('agent-phone').value.trim(),
    status: $('agent-status').value
  };
  
  if ($('agent-password').value.trim()) {
    formData.password = $('agent-password').value.trim();
  }
  
  try {
    // À implémenter : API pour créer/modifier un agent
    const isEdit = $('modal-title').textContent.includes('Modifier');
    
    if (isEdit) {
      alert('Fonctionnalité de modification à implémenter');
    } else {
      // Simuler la création d'un nouvel agent
      const newAgent = {
        id: Math.max(...agents.map(a => a.id)) + 1,
        ...formData,
        lastActivity: new Date().toISOString()
      };
      
      agents.push(newAgent);
      displayAgents();
      updateStatistics();
      closeAgentModal();
      alert('Agent créé avec succès');
    }
  } catch (error) {
    alert('Erreur: ' + error.message);
  }
}

// Exporter les agents
function exportAgents() {
  const csvContent = [
    ['Nom', 'Email', 'Rôle', 'Statut', 'Téléphone', 'Dernière activité'],
    ...agents.map(agent => [
      agent.name,
      agent.email,
      getRoleText(agent.role),
      getStatusText(agent.status),
      agent.phone || '',
      formatDate(agent.lastActivity)
    ])
  ].map(row => row.join(',')).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agents_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Actualiser la liste
function refreshAgents() {
  loadAgents();
}

// Utilitaires
function getRoleText(role) {
  const roleTexts = {
    'admin': 'Administrateur',
    'supervisor': 'Superviseur',
    'agent': 'Agent'
  };
  return roleTexts[role] || role;
}

function getStatusText(status) {
  const statusTexts = {
    'active': 'Actif',
    'inactive': 'Inactif'
  };
  return statusTexts[status] || status;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Déconnexion
function logout() {
  localStorage.removeItem('jwt');
  window.location.href = window.location.origin + '/';
}

// Mettre à jour la navbar
async function updateNavbar() {
  const profileLink = $('profile-link');
  const dashboardLink = $('dashboard-link');
  const agentsLink = $('agents-link');
  const reportsLink = $('reports-link');
  const adminLink = $('admin-link');
  const navbarUser = $('navbar-user');
  const userInfo = $('user-info');
  
  if (jwt && currentUser) {
    // Afficher le profil pour tous les utilisateurs connectés
    if (profileLink) profileLink.style.display = 'flex';
    
    // Navigation pour Admin et Superviseur
    if (currentUser.role === 'admin' || currentUser.role === 'supervisor') {
      if (dashboardLink) dashboardLink.style.display = 'flex';
      if (agentsLink) agentsLink.style.display = 'flex';
      if (reportsLink) reportsLink.style.display = 'flex';
    } else {
      if (dashboardLink) dashboardLink.style.display = 'none';
      if (agentsLink) agentsLink.style.display = 'none';
      if (reportsLink) reportsLink.style.display = 'none';
    }
    
    // Navigation pour Admin uniquement
    if (currentUser.role === 'admin') {
      if (adminLink) adminLink.style.display = 'flex';
    } else {
      if (adminLink) adminLink.style.display = 'none';
    }
    
    // Afficher les informations utilisateur
    if (navbarUser) navbarUser.style.display = 'flex';
    if (userInfo) {
      const roleText = {
        'admin': 'Administrateur',
        'supervisor': 'Superviseur',
        'agent': 'Agent'
      };
      userInfo.textContent = `${currentUser.name} (${roleText[currentUser.role] || currentUser.role})`;
    }
  }
}

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await checkAuth();
  if (isAuthenticated) {
    await loadAgents();
    await updateNavbar();
    
    // Gestion du formulaire d'agent
    $('agent-form').addEventListener('submit', handleAgentForm);
  }
});
