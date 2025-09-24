// Script pour la gestion des agents
let jwt = localStorage.getItem('jwt') || '';
let agents = [];
let agentPagination = { page: 1, limit: 10, total: 0 };
let currentUser = null;
let adminUnits = [];

function $(id) { return document.getElementById(id); }

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || '';
}

function getEmailHint() {
  return getQueryParam('email') || localStorage.getItem('email') || localStorage.getItem('user_email') || '';
}

// Configuration de l'API - utiliser Render en production sur Vercel
const apiBase = window.location.hostname === 'agent-position.vercel.app' 
    ? 'https://presence-ccrb-v2.onrender.com/api'
    : '/api';

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
  
  console.log('API call:', apiBase + path, { method: opts.method || 'GET', headers, body: opts.body });
  
  const res = await fetch(apiBase + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body instanceof FormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  
  console.log('API response:', res.status, res.statusText);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('API error:', errorText);
    throw new Error(errorText || res.statusText);
  }
  
  const ct = res.headers.get('content-type') || '';
  const result = ct.includes('application/json') ? await res.json() : await res.text();
  console.log('API result:', result);
  return result;
}

// Inscription aux notifications push
async function ensurePushSubscription() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    // Récupérer la clé publique
    const { publicKey } = await api('/push/public-key');
    if (!publicKey) return;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    await api('/push/subscribe', { method: 'POST', body: { subscription: sub } });
  } catch (e) {
    console.warn('Push subscription failed:', e?.message || e);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Vérifier l'authentification et les permissions
async function checkAuth() {
  const emailHint = getEmailHint();

  // 1) Si on a un token, tenter le profil standard
  if (jwt) {
    try {
      const result = await api('/profile');
      currentUser = result?.user || result || null;
    } catch (e) {
      console.warn('Profil via token indisponible, tentative par email...', e?.message);
    }
  }

  // 2) Tentative soft-auth via email (sans token ou après échec)
  if (!currentUser && emailHint) {
    try {
      const result = await api('/profile?email=' + encodeURIComponent(emailHint));
      currentUser = result?.user || result || null;
    } catch (e) {
      console.warn('Profil via email indisponible, bascule en mode admin allégé pour:', emailHint);
      currentUser = {
        name: emailHint.split('@')[0],
        email: emailHint,
        role: 'admin'
      };
    }
  }

  // 3) Aucune info: continuer en mode très limité mais ne pas bloquer la page
  if (!currentUser) {
    console.warn('Aucun token ni email. Accès limité.');
    currentUser = { name: 'Utilisateur', email: '', role: 'agent' };
  }
  return true;
}

// Charger la liste des agents
async function loadAgents() {
  try {
    const searchTerm = ($('search-agents')?.value || '').trim();
    const roleFilter = ($('filter-role')?.value || '').trim();
    const statusFilter = ($('filter-status')?.value || '').trim();
    const params = new URLSearchParams();
    params.set('page', String(agentPagination.page));
    params.set('limit', String(agentPagination.limit));
    if (searchTerm) params.set('search', searchTerm);
    if (roleFilter) params.set('role', roleFilter);
    if (statusFilter) params.set('status', statusFilter);
    params.set('sortBy', 'name');
    params.set('sortDir', 'asc');

    const response = await api('/users?' + params.toString());
    agents = response.items || [];
    agentPagination.total = response.total || agents.length;
    displayAgents();
    updateStatistics();
    renderAgentPaginator();
    
  } catch (error) {
    console.error('Erreur lors du chargement des agents:', error);
  }
}

// Charger les unités administratives
async function loadAdminUnits() {
  try {
    adminUnits = await api('/admin-units');
    populateAdminUnitsSelect();
  } catch (error) {
    console.error('Erreur lors du chargement des unités administratives:', error);
    // Utiliser des unités par défaut en cas d'erreur
    adminUnits = [
      { id: 1, name: 'Direction Générale', code: 'DG' },
      { id: 2, name: 'Direction des Opérations', code: 'DO' },
      { id: 3, name: 'Direction Administrative et Financière', code: 'DAF' },
      { id: 4, name: 'Service Ressources Humaines', code: 'SRH' },
      { id: 5, name: 'Service Comptabilité', code: 'SC' },
      { id: 6, name: 'Service Logistique', code: 'SL' },
      { id: 7, name: 'Service Sécurité', code: 'SS' },
      { id: 8, name: 'Service Informatique', code: 'SI' },
      { id: 9, name: 'Service Communication', code: 'SCOM' },
      { id: 10, name: 'Service Juridique', code: 'SJ' }
    ];
    populateAdminUnitsSelect();
  }
}

// Remplir le select des unités administratives
function populateAdminUnitsSelect() {
  const select = $('agent-admin-unit');
  if (!select) return;
  
  select.innerHTML = '<option value="">Sélectionner une unité administrative</option>';
  
  adminUnits.forEach(unit => {
    const option = document.createElement('option');
    option.value = unit.name;
    option.textContent = `${unit.name} (${unit.code})`;
    select.appendChild(option);
  });
}

// Afficher les agents dans le tableau
function displayAgents() {
  const tbody = $('agents-table-body');
  
  if (agents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="no-data">Aucun agent trouvé</td></tr>';
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
      <td>${agent.adminUnit || 'Non assigné'}</td>
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
  agentPagination.page = 1;
  loadAgents();
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
  $('agent-admin-unit').value = agent.adminUnit || '';
  $('agent-password').value = '';
  $('agent-password').required = false;
  
  $('agent-modal').classList.remove('hidden');
}

// Voir les détails d'un agent
function viewAgent(agentId) {
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return;
  
  alert(`Détails de l'agent:\n\nNom: ${agent.name}\nEmail: ${agent.email}\nRôle: ${getRoleText(agent.role)}\nUnit Administrative: ${agent.adminUnit || 'Non assigné'}\nStatut: ${getStatusText(agent.status)}\nTéléphone: ${agent.phone || 'Non renseigné'}\nDernière activité: ${formatDate(agent.lastActivity)}`);
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
    status: $('agent-status').value,
    adminUnit: $('agent-admin-unit').value
  };
  
  if ($('agent-password').value.trim()) {
    formData.password = $('agent-password').value.trim();
  }
  
  try {
    const isEdit = $('modal-title').textContent.includes('Modifier');
    
    if (isEdit) {
      alert('Fonctionnalité de modification à implémenter');
    } else {
      // Créer un nouvel agent via l'API
      const newAgent = await api('/users', {
        method: 'POST',
        body: formData
      });
      
      // Recharger la liste des agents
      await loadAgents();
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

function renderAgentPaginator() {
  const container = document.getElementById('agents-paginator');
  if (!container) return;
  const totalPages = Math.max(1, Math.ceil(agentPagination.total / agentPagination.limit));
  const page = Math.min(agentPagination.page, totalPages);
  agentPagination.page = page;
  container.innerHTML = '';
  const prev = document.createElement('button');
  prev.textContent = 'Précédent';
  prev.disabled = page <= 1;
  prev.onclick = () => { agentPagination.page = Math.max(1, page - 1); loadAgents(); };
  const info = document.createElement('span');
  info.style.margin = '0 8px';
  info.textContent = `Page ${page} / ${totalPages} (${agentPagination.total} agents)`;
  const next = document.createElement('button');
  next.textContent = 'Suivant';
  next.disabled = page >= totalPages;
  next.onclick = () => { agentPagination.page = Math.min(totalPages, page + 1); loadAgents(); };
  container.appendChild(prev);
  container.appendChild(info);
  container.appendChild(next);
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
  await checkAuth();
  try { await loadAdminUnits(); } catch {}
  try { await loadAgents(); } catch {}
  try { await updateNavbar(); } catch {}
  try { await ensurePushSubscription(); } catch {}
  const form = $('agent-form');
  if (form) form.addEventListener('submit', handleAgentForm);
});
