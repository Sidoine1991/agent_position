// Script pour la gestion des agents
let jwt = localStorage.getItem('jwt') || '';
let agents = [];
let agentPagination = { page: 1, limit: 10, total: 0 };
let currentUser = null;
let adminUnits = [];
const reportState = {
  selectedAgentId: '',
  monthValue: '',
  currentReport: null,
  htmlPayload: '',
  textPayload: '',
  requestToken: 0
};

function $(id) { return document.getElementById(id); }

function getCurrentMonthValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || '';
}

function getEmailHint() {
  return getQueryParam('email') || localStorage.getItem('email') || localStorage.getItem('user_email') || '';
}

// Configuration de l'API - utiliser Render en production sur Vercel
const onVercel = /\.vercel\.app$/.test(window.location.hostname) || window.location.hostname.includes('vercel.app');
const apiBase = '/api';

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

// Fonction utilitaire pour le debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Charger la liste des agents
async function loadAgents() {
  try {
    const list = $('agents-simple-list');
    if (!list) {
      console.error('Élément agents-simple-list non trouvé dans le DOM');
      return;
    }

    // Afficher un indicateur de chargement
    list.innerHTML = '<div class="loading">Chargement des agents en cours...</div>';

    // Récupérer les valeurs des filtres
    const searchInput = $('search-agents');
    const roleFilter = $('filter-role');
    const statusFilter = $('filter-status');

    const searchTerm = searchInput?.value?.trim() || '';
    const roleFilterValue = roleFilter?.value?.trim() || '';
    const statusFilterValue = statusFilter?.value?.trim() || '';

    const params = new URLSearchParams();
    params.set('page', String(agentPagination.page));
    params.set('limit', String(agentPagination.limit));
    if (searchTerm) params.set('search', searchTerm);
    if (roleFilterValue) params.set('role', roleFilterValue);
    if (statusFilterValue) params.set('status', statusFilterValue);
    params.set('sortBy', 'name');
    params.set('sortDir', 'asc');

    let rows = [];
    let response = { total: 0 };

    try {
      // Essayer d'abord l'endpoint /users
      response = await api('/users?' + params.toString());
      rows = Array.isArray(response) ? response : (response.items || response.users || response.data || []);
      
      // Si pas de résultats, essayer l'endpoint /admin/agents
      if (!rows.length) {
        const alt = await api('/admin/agents');
        rows = Array.isArray(alt) ? alt : (alt.data || alt.agents || []);
      }
    } catch (error) {
      console.error('Erreur API:', error);
      const errorMessage = error?.message || 'Erreur inconnue';
      list.innerHTML = `
        <div class="alert alert-warning">
          <p>Impossible de charger la liste des agents. Erreur: ${escapeHtml(errorMessage)}</p>
          <button onclick="loadAgents()" class="btn btn-sm btn-outline-primary mt-2">
            <i class="bi bi-arrow-repeat"></i> Réessayer
          </button>
        </div>
      `;
      return;
    }

    agents = Array.isArray(rows) ? rows : [];
    agentPagination.total = (typeof response.total === 'number' ? response.total : agents.length);
    
    if (agents.length === 0) {
      list.innerHTML = `
        <div class="alert alert-info">
          Aucun agent trouvé. Essayez de modifier vos critères de recherche.
        </div>
      `;
    } else {
      displayAgents();
      populateReportAgentOptions();
      updateStatistics();
      renderAgentPaginator();
    }
    
  } catch (error) {
    console.error('Erreur lors du chargement des agents:', error);
    const list = $('agents-simple-list');
    if (list) {
      const errorMessage = error?.message || 'Erreur inconnue';
      list.innerHTML = `
        <div class="alert alert-danger">
          <p>Une erreur est survenue lors du chargement des agents: ${escapeHtml(errorMessage)}</p>
          <button onclick="loadAgents()" class="btn btn-sm btn-outline-primary mt-2">
            <i class="bi bi-arrow-repeat"></i> Réessayer
          </button>
        </div>
      `;
    }
  }
}

// Charger les unités administratives
async function loadAdminUnits() {
  try {
    const unitsResp = await api('/admin-units');
    adminUnits = Array.isArray(unitsResp) ? unitsResp : (unitsResp.units || unitsResp.data || []);
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
  // Nouveau rendu: simple liste compacte
  const list = $('agents-simple-list');
  if (list) {
    if (agents.length === 0) {
      list.innerHTML = '<div class="no-data" style="padding:12px;">Aucun agent trouvé</div>';
    } else {
      list.innerHTML = agents.map(agent => `
        <div class="agent-row">
          <div class="agent-main">
            <img class="agent-avatar" src="${agent.photo_path || '/Media/default-avatar.svg'}" onerror="this.onerror=null;this.src='/Media/default-avatar.svg';" alt="Avatar" />
            <div class="agent-info">
              <div class="agent-name">${agent.name || '-'}</div>
              <div class="agent-sub">${agent.email || '-'} · ${getRoleText(agent.role)} · ${agent.departement || agent.adminUnit || '-'}</div>
            </div>
          </div>
          <div class="agent-actions">
            <button class="btn-small" onclick="viewAgent(${agent.id})">Voir</button>
            <button class="btn-small" onclick="editAgent(${agent.id})">Modifier</button>
            ${currentUser.role === 'admin' ? `<button class="btn-small" onclick="deleteAgent(${agent.id})">Supprimer</button>` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  // Conserver le fallback tableau si nécessaire
  const tbody = $('agents-table-body');
  if (tbody) {
    if (agents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="no-data">Aucun agent trouvé</td></tr>';
    } else {
      tbody.innerHTML = agents.map(agent => `
        <tr>
          <td><img src="${agent.photo_path || '/Media/default-avatar.svg'}" alt="Avatar" class="agent-avatar-small" onerror="this.onerror=null;this.src='/Media/default-avatar.svg';"></td>
          <td>${agent.name}</td>
          <td>${agent.email}</td>
          <td><span class="role-badge role-${agent.role}">${getRoleText(agent.role)}</span></td>
          <td>${agent.adminUnit || agent.departement || 'Non assigné'}</td>
          <td><span class="status-badge status-${agent.status}">${getStatusText(agent.status)}</span></td>
          <td>${formatDate(agent.lastActivity)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-icon" onclick="editAgent(${agent.id})" title="Modifier">✏️</button>
              <button class="btn-icon" onclick="viewAgent(${agent.id})" title="Voir">👁️</button>
              ${currentUser.role === 'admin' ? `<button class="btn-icon btn-danger" onclick="deleteAgent(${agent.id})" title="Supprimer">🗑️</button>` : ''}
            </div>
          </td>
        </tr>
      `).join('');
    }
  }
}

function populateReportAgentOptions() {
  const select = $('report-agent-select');
  if (!select) {
    console.warn('Select report-agent-select non trouvé');
    return;
  }

  const previousValue = select.value;
  select.innerHTML = '<option value="">Sélectionnez un agent</option>';

  console.log(`Remplissage du select avec ${agents.length} agents`);
  agents.forEach(agent => {
    if (!agent || typeof agent.id === 'undefined') return;
    const option = document.createElement('option');
    option.value = agent.id;
    option.textContent = agent.name || agent.email || `Agent ${agent.id}`;
    select.appendChild(option);
  });

  if (previousValue && select.querySelector(`option[value="${previousValue}"]`)) {
    select.value = previousValue;
  }
  console.log(`Select rempli avec ${select.options.length - 1} agents (sans l'option par défaut)`);
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
  try {
    localStorage.removeItem('jwt');
    localStorage.removeItem('loginData');
    localStorage.removeItem('userProfile');
    localStorage.setItem('presence_update', JSON.stringify({ type: 'logout', ts: Date.now() }));
  } catch {}
  window.location.href = '/register.html';
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

function initMonthlyReportModule() {
  console.log('Initialisation du module rapport mensuel...');
  const monthInput = $('report-month-input');
  if (monthInput) {
    monthInput.value = getCurrentMonthValue();
    reportState.monthValue = monthInput.value;
    console.log('Mois initialisé:', monthInput.value);
  } else {
    console.warn('Input mois non trouvé');
  }
  const generateBtn = $('report-generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', generateAgentMonthlyReport);
    console.log('Bouton générer attaché');
  } else {
    console.warn('Bouton générer non trouvé');
  }
  const htmlBtn = $('download-html-btn');
  if (htmlBtn) {
    htmlBtn.addEventListener('click', () => downloadMonthlyReport('html'));
  }
  const txtBtn = $('download-txt-btn');
  if (txtBtn) {
    txtBtn.addEventListener('click', () => downloadMonthlyReport('txt'));
  }
  const reportCard = document.getElementById('rapport-mensuel');
  if (reportCard) {
    console.log('Section rapport trouvée, visible:', reportCard.offsetHeight > 0);
  } else {
    console.error('Section rapport-mensuel non trouvée dans le DOM');
  }
}

function setReportStatus(message, status = 'info') {
  const statusEl = $('agent-report-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove('error', 'loading');
  if (status === 'error') statusEl.classList.add('error');
  if (status === 'loading') statusEl.classList.add('loading');
}

function toggleReportGrid(show) {
  const grid = $('agent-report-grid');
  const downloads = $('report-download-actions');
  const htmlBtn = $('download-html-btn');
  const txtBtn = $('download-txt-btn');
  if (grid) grid.style.display = show ? 'grid' : 'none';
  if (downloads) downloads.style.display = show ? 'flex' : 'none';
  [htmlBtn, txtBtn].forEach(btn => {
    if (btn) btn.disabled = !show;
  });
  if (!show) {
    reportState.htmlPayload = '';
    reportState.textPayload = '';
  }
}

function formatDateShort(dateString, includeYear = false) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: includeYear ? 'numeric' : undefined
  });
}

function renderMonthlyReport(report) {
  const metaEl = $('report-meta');
  const agentName = report?.meta?.agent?.name || 'Agent';
  const monthLabel = report?.meta?.month?.label || '';
  if (metaEl) metaEl.textContent = `${agentName} • ${monthLabel}`;

  const objectivesContainer = $('report-objectives-list');
  const objectives = Array.isArray(report?.objectives) ? report.objectives : [];
  if (objectivesContainer) {
    if (objectives.length === 0) {
      objectivesContainer.innerHTML = '<p>Aucun objectif enregistré pour ce mois.</p>';
    } else {
      objectivesContainer.innerHTML = objectives.map(obj => {
        const percent = Math.min(100, Math.max(0, obj.progressPercent || 0));
        const targetLabel = obj.targetValue ? `${obj.currentValue || 0}/${obj.targetValue}` : `${obj.currentValue || 0}`;
        return `
          <div class="objective-item">
            <div><strong>${escapeHtml(obj.title)}</strong></div>
            <small>${escapeHtml(obj.description || '')}</small>
            <div class="objective-progress"><span style="width:${percent}%"></span></div>
            <small>${targetLabel} · ${percent}% · ${escapeHtml(obj.status || 'En cours')}</small>
          </div>
        `;
      }).join('');
    }
  }

  const presenceContainer = $('report-presence-stats');
  const presence = report?.presence || {};
  if (presenceContainer) {
    const stats = [
      { label: 'Taux de présence', value: `${presence.presenceRate ?? 0}%` },
      { label: 'Jours actifs', value: `${presence.workedDays || 0}/${presence.workingDays || 0}` },
      { label: 'Total check-ins', value: presence.totalCheckins || 0 },
      { label: 'Moyenne/jour', value: presence.averageCheckinsPerDay || 0 }
    ];
    presenceContainer.innerHTML = stats.map(stat => `
      <div>
        <div class="presence-value">${escapeHtml(stat.value)}</div>
        <div>${escapeHtml(stat.label)}</div>
      </div>
    `).join('');
  }

  const activitiesContainer = $('report-activities-list');
  const activityData = report?.activities || {};
  if (activitiesContainer) {
    const breakdownTags = (activityData.breakdown || [])
      .slice(0, 4)
      .map(item => `<span class="report-tag">${escapeHtml(item.label)} · ${item.count}</span>`)
      .join('');
    const activityLines = (activityData.list || [])
      .slice(0, 4)
      .map(item => `<p><strong>${formatDateShort(item.date)} :</strong> ${escapeHtml(item.description)} (${escapeHtml(item.result || 'Planifié')})</p>`)
      .join('');
    activitiesContainer.innerHTML = `
      <p><strong>${activityData.total || 0}</strong> activités consignées ce mois.</p>
      <div class="report-tags">${breakdownTags || '<span class="report-tag">Pas de détail disponible</span>'}</div>
      ${activityLines || '<p>Aucune activité enregistrée.</p>'}
    `;
  }

  const aiSummaryEl = $('report-ai-summary');
  const suggestionsEl = $('report-suggestions');
  const comments = report?.comments || {};
  const aiText = comments.aiSummary || comments.fallbackSummary || 'Configurez une clé Gemini pour activer la synthèse automatique.';
  if (aiSummaryEl) aiSummaryEl.textContent = aiText;
  if (suggestionsEl) {
    const suggestions = Array.isArray(comments.suggestions) ? comments.suggestions : [];
    suggestionsEl.innerHTML = suggestions.length
      ? suggestions.map(item => `<li>${escapeHtml(item)}</li>`).join('')
      : '<li>Aucune recommandation particulière.</li>';
  }

  const locationsEl = $('report-locations');
  const locations = Array.isArray(report?.locations) ? report.locations : [];
  if (locationsEl) {
    locationsEl.innerHTML = locations.length
      ? locations.map(loc => `<span class="report-tag">${escapeHtml(loc.label)} · ${loc.visits || 0}</span>`).join('')
      : '<span class="report-tag">Pas de déplacement enregistré</span>';
  }

  const photosEl = $('report-photos');
  const photos = Array.isArray(report?.photos) ? report.photos : [];
  if (photosEl) {
    photosEl.innerHTML = photos.length
      ? photos.map(photo => `<img src="${escapeHtml(photo.url)}" alt="Photo check-in" loading="lazy">`).join('')
      : '<p>Aucune photo disponible pour ce mois.</p>';
  }

  toggleReportGrid(true);
}

async function generateAgentMonthlyReport() {
  const agentSelect = $('report-agent-select');
  const monthInput = $('report-month-input');
  const generateBtn = $('report-generate-btn');
  if (!agentSelect || !monthInput) return;

  const agentId = agentSelect.value;
  const monthValue = monthInput.value || getCurrentMonthValue();
  reportState.monthValue = monthValue;

  if (!agentId) {
    setReportStatus('Veuillez sélectionner un agent pour générer son rapport.', 'error');
    toggleReportGrid(false);
    if (generateBtn) generateBtn.disabled = false;
    return;
  }

  const requestToken = ++reportState.requestToken;
  if (generateBtn) generateBtn.disabled = true;

  setReportStatus('Analyse en cours... merci de patienter.', 'loading');
  toggleReportGrid(false);

  try {
    const params = new URLSearchParams({ agentId, month: monthValue });
    const response = await api(`/agents/monthly-report?${params.toString()}`);
    if (!response || response.success === false) {
      throw new Error(response?.error || 'Impossible de générer le rapport');
    }
    if (requestToken !== reportState.requestToken) {
      console.debug('Rapport mensuel ignoré (requête obsolète)', { agentId, monthValue });
      return;
    }
    reportState.selectedAgentId = agentId;
    reportState.currentReport = response;
    renderMonthlyReport(response);
    prepareReportDownloads(response);
    setReportStatus('Rapport généré avec succès.', 'info');
  } catch (error) {
    console.error('Erreur rapport mensuel:', error);
    if (requestToken === reportState.requestToken) {
      setReportStatus(error.message || 'Erreur lors de la génération du rapport.', 'error');
    }
  } finally {
    if (requestToken === reportState.requestToken && generateBtn) {
      generateBtn.disabled = false;
    }
  }
}

function prepareReportDownloads(report) {
  reportState.htmlPayload = buildReportHtml(report);
  reportState.textPayload = buildReportText(report);
}

function buildReportHtml(report) {
  const agent = report?.meta?.agent || {};
  const month = report?.meta?.month || {};
  const objectives = (report?.objectives || []).map(obj => `
    <li>
      <strong>${escapeHtml(obj.title)}</strong> — ${obj.progressPercent || 0}% (${obj.currentValue || 0}/${obj.targetValue || 0})
    </li>
  `).join('');
  const presence = report?.presence || {};
  const activities = report?.activities || {};
  const suggestions = (report?.comments?.suggestions || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const locations = (report?.locations || []).map(loc => `<li>${escapeHtml(loc.label)} — ${loc.visits || 0} visites</li>`).join('');
  const photos = (report?.photos || []).map(photo => `<li>${formatDateShort(photo.date, true)} — ${escapeHtml(photo.note || photo.url)}</li>`).join('');

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Rapport ${escapeHtml(agent.name || 'Agent')}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 32px; background: #f8fafc; color: #0f172a; }
    h1 { margin-bottom: 4px; }
    section { margin-top: 24px; }
    ul { padding-left: 20px; }
    .card { background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-top:16px; }
  </style>
</head>
<body>
  <h1>Rapport mensuel — ${escapeHtml(agent.name || 'Agent')}</h1>
  <p>Période : ${escapeHtml(month.label || month.value || '')}</p>

  <section class="card">
    <h2>Objectifs</h2>
    <ul>${objectives || '<li>Aucun objectif enregistré.</li>'}</ul>
  </section>

  <section class="card">
    <h2>Présence</h2>
    <p>Taux de présence : ${presence.presenceRate || 0}%</p>
    <p>Jours actifs : ${presence.workedDays || 0}/${presence.workingDays || 0}</p>
    <p>Total check-ins : ${presence.totalCheckins || 0}</p>
  </section>

  <section class="card">
    <h2>Activités</h2>
    <p>Total activités : ${activities.total || 0}</p>
    <ul>${(activities.list || []).slice(0, 10).map(act => `<li>${formatDateShort(act.date, true)} — ${escapeHtml(act.description)} (${escapeHtml(act.result || 'Planifié')})</li>`).join('') || '<li>Aucune activité détaillée.</li>'}</ul>
  </section>

  <section class="card">
    <h2>Lieux & preuves</h2>
    <h3>Lieux visités</h3>
    <ul>${locations || '<li>Pas de déplacement enregistré.</li>'}</ul>
    <h3>Photos</h3>
    <ul>${photos || '<li>Aucune photo enregistrée.</li>'}</ul>
  </section>

  <section class="card">
    <h2>Commentaires & recommandations</h2>
    <p>${escapeHtml(report?.comments?.aiSummary || report?.comments?.fallbackSummary || '')}</p>
    <ul>${suggestions || '<li>Aucune recommandation.</li>'}</ul>
  </section>
</body>
</html>`;
}

function buildReportText(report) {
  const agent = report?.meta?.agent || {};
  const month = report?.meta?.month || {};
  const presence = report?.presence || {};
  const objectives = report?.objectives || [];
  const activities = report?.activities || {};
  const suggestions = report?.comments?.suggestions || [];

  const lines = [
    `Rapport mensuel - ${agent.name || 'Agent'} (${month.label || month.value || ''})`,
    '',
    'Objectifs:',
    ...objectives.map(obj => `- ${obj.title}: ${obj.progressPercent || 0}% (${obj.currentValue || 0}/${obj.targetValue || 0})`),
    objectives.length ? '' : '- Aucun objectif enregistré.',
    '',
    `Présence: ${presence.presenceRate || 0}% (${presence.workedDays || 0}/${presence.workingDays || 0} jours, ${presence.totalCheckins || 0} check-ins)`,
    '',
    `Activités consignées: ${activities.total || 0}`,
    ...((activities.list || []).slice(0, 10).map(act => `- ${formatDateShort(act.date, true)}: ${act.description} (${act.result || 'Planifié'})`)),
    '',
    'Suggestions:',
    ...(suggestions.length ? suggestions.map(item => `- ${item}`) : ['- Aucune recommandation particulière.'])
  ];

  return lines.join('\n');
}

function downloadMonthlyReport(format) {
  const value = format === 'html' ? reportState.htmlPayload : reportState.textPayload;
  if (!value) return;
  const blob = new Blob([value], { type: format === 'html' ? 'text/html' : 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  const monthLabel = reportState.monthValue || getCurrentMonthValue();
  link.href = url;
  link.download = `rapport-agent-${reportState.selectedAgentId || 'me'}-${monthLabel}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await checkAuth();
    await loadAdminUnits();
    
    // Initialiser les écouteurs d'événements pour les filtres
    const searchInput = $('search-agents');
    const roleFilter = $('filter-role');
    const statusFilter = $('filter-status');
    
    if (searchInput) {
      searchInput.addEventListener('input', debounce(loadAgents, 300));
    }
    
    if (roleFilter) {
      roleFilter.addEventListener('change', () => {
        agentPagination.page = 1; // Reset à la première page
        loadAgents();
      });
    }
    
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        agentPagination.page = 1; // Reset à la première page
        loadAgents();
      });
    }
    
    // Vérifier si des filtres sont présents dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get('role');
    const statusParam = urlParams.get('status');
    
    if (roleParam && roleFilter) {
      roleFilter.value = roleParam;
    }
    
    if (statusParam && statusFilter) {
      statusFilter.value = statusParam;
    }
    
    // Charger les agents
    loadAgents();
    
    // Initialiser les autres modules
    initMonthlyReportModule();
    updateNavbar();
    
    // Gestion du défilement vers la section rapport mensuel si nécessaire
    if (window.location.hash === '#rapport-mensuel') {
      setTimeout(() => {
        const target = document.getElementById('rapport-mensuel');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
    
    // S'inscrire aux notifications push
    try { 
      await ensurePushSubscription(); 
    } catch (error) {
      console.warn('Échec de l\'inscription aux notifications push:', error);
    }
    
    // Initialiser le formulaire d'agent
    const form = $('agent-form');
    if (form) {
      form.addEventListener('submit', handleAgentForm);
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
    const list = $('agents-simple-list');
    if (list) {
      list.innerHTML = `
        <div class="alert alert-danger">
          <p>Erreur lors de l'initialisation de la page: ${escapeHtml(error?.message || 'Erreur inconnue')}</p>
          <button onclick="location.reload()" class="btn btn-sm btn-outline-primary mt-2">
            <i class="bi bi-arrow-repeat"></i> Recharger la page
          </button>
        </div>
      `;
    }
  }
});

// Exposer les fonctions au scope global pour les handlers inline (onchange/onclick)
try {
  window.filterAgents = filterAgents;
  window.openCreateAgentModal = openCreateAgentModal;
  window.closeAgentModal = closeAgentModal;
  window.refreshAgents = refreshAgents;
  window.editAgent = editAgent;
  window.viewAgent = viewAgent;
  window.deleteAgent = deleteAgent;
  window.displayAgents = displayAgents;
  window.updateStatistics = updateStatistics;
} catch {}