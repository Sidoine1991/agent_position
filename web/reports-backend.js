// Script pour la page de rapports - Version Backend uniquement
let jwt = localStorage.getItem('jwt') || '';
let currentUser = null;
let presenceLineChart = null;
let rolePieChart = null;
const apiBase = '/api';

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || '';
}

function getEmailHint() {
  return getQueryParam('email') ||
         localStorage.getItem('email') ||
         localStorage.getItem('user_email') ||
         localStorage.getItem('userEmail') ||
         '';
}

function $(id) {
  return document.getElementById(id);
}

/**
 * Génère les en-têtes d'authentification pour les requêtes API
 */
async function authHeaders() {
  const token = localStorage.getItem('jwt') || '';
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Effectue une requête API
 */
async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (jwt) {
    headers['Authorization'] = 'Bearer ' + jwt;
  }
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

/**
 * Vérifie l'authentification et les permissions
 */
async function checkAuth() {
  const emailHint = getEmailHint();
  if (!emailHint) {
    console.warn('Aucun email trouvé, mode lecture seule');
    return false;
  }
  try {
    const result = await api('/profile?email=' + encodeURIComponent(emailHint));
    if (result && result.user) {
      currentUser = result.user;
      console.log('Utilisateur connecté:', currentUser.name, currentUser.role);
      return true;
    }
  } catch (error) {
    console.warn('Impossible de vérifier l\'authentification:', error.message);
  }
  return false;
}

/**
 * Récupère les dates de la période sélectionnée
 */
function getRangeDatesFromUI() {
  const range = document.getElementById('date-range')?.value || 'month';
  const fmt = d => d.toISOString().split('T')[0];
  const today = new Date();
  const precise = (document.getElementById('date-filter')?.value || '').trim();
  if (precise) return { start: precise, end: precise };
  if (range === 'today') return { start: fmt(today), end: fmt(today) };
  if (range === 'week') {
    const s = new Date(today);
    s.setDate(today.getDate() - 6);
    return { start: fmt(s), end: fmt(today) };
  }
  if (range === 'month') {
    const s = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: fmt(s), end: fmt(today) };
  }
  if (range === 'custom') {
    const s = document.getElementById('start-date')?.value || null;
    const e = document.getElementById('end-date')?.value || null;
    return { start: s, end: e };
  }
  return { start: null, end: null };
}

/**
 * Convertit une période en format ISO
 */
function periodToISO(start, end) {
  const fromISO = start ? new Date(start + 'T00:00:00Z').toISOString() : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const toISO = end ? new Date(end + 'T23:59:59Z').toISOString() : new Date().toISOString();
  return { fromISO, toISO };
}

/**
 * Met à jour les champs de date personnalisés
 */
window.updateDateInputs = function() {
  const g1 = document.getElementById('custom-date-group');
  const g2 = document.getElementById('custom-date-group-end');
  if (!g1 || !g2) return;
  const show = (document.getElementById('date-range')?.value === 'custom');
  g1.style.display = show ? 'block' : 'none';
  g2.style.display = show ? 'block' : 'none';
  if (show) {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    document.getElementById('end-date').value = today.toISOString().split('T')[0];
    document.getElementById('start-date').value = lastMonth.toISOString().split('T')[0];
  }
};

/**
 * Récupère les rapports depuis le backend avec tous les filtres
 */
async function fetchReportsFromBackend() {
  const { start, end } = getRangeDatesFromUI();
  const { fromISO, toISO } = periodToISO(start, end);
  const params = new URLSearchParams();
  params.set('from', fromISO);
  params.set('to', toISO);
  
  // Appliquer les filtres
  const agentId = document.getElementById('agent-filter')?.value;
  const supervisorId = document.getElementById('supervisor-filter')?.value;
  const projectName = document.getElementById('project-filter')?.value;
  const departmentId = document.getElementById('department-filter')?.value;
  const communeId = document.getElementById('commune-filter')?.value;
  
  if (agentId && agentId !== 'all') {
    params.set('agent_id', agentId);
  }
  
  try {
    const result = await api('/reports?' + params.toString());
    let rows = result.success ? (result.data || []) : [];
    
    // Appliquer les filtres côté client
    if (projectName && projectName !== 'all') {
      rows = rows.filter(r => {
        // Vérifier plusieurs champs possibles pour le projet
        const projectField = r.projet || r.project_name || r.project || '';
        return String(projectField).trim() === projectName;
      });
    }
    
    if (supervisorId && supervisorId !== 'all') {
      // Filtrer par superviseur (nécessite une jointure avec la table users)
      // Pour l'instant, on filtre côté client si les données utilisateur sont disponibles
      rows = rows.filter(r => {
        // Si les données utilisateur sont enrichies dans la réponse
        if (r.user && r.user.supervisor_id) {
          return String(r.user.supervisor_id) === supervisorId;
        }
        // Fallback: essayer de récupérer les données utilisateur
        return true; // Pour l'instant, on garde tous les résultats
      });
    }
    
    if (departmentId && departmentId !== 'all') {
      // Filtrer par département (colonne departement de la table users)
      rows = rows.filter(r => {
        if (r.user && r.user.departement) {
          return String(r.user.departement) === departmentId;
        }
        return true; // Pour l'instant, on garde tous les résultats
      });
    }
    
    if (communeId && communeId !== 'all') {
      // Filtrer par commune (colonne commune de la table users)
      rows = rows.filter(r => {
        if (r.user && r.user.commune) {
          return String(r.user.commune) === communeId;
        }
        return true; // Pour l'instant, on garde tous les résultats
      });
    }
    
    
    // Appliquer le filtre de date précise
    const precise = (document.getElementById('date-filter')?.value || '').trim();
    if (precise) {
      rows = rows.filter(r => dateMatchesPrecise(precise, r.ts || r.date || r.created_at));
    }
    
    console.log(`${rows.length} rapports filtrés sur ${result.data?.length || 0} total`);
    return rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des rapports:', error);
    return [];
  }
}

/**
 * Vérifie si une planification existe pour un agent à une date donnée
 */
async function checkPlanningForAgent(agentId, date) {
  if (!agentId || !date) return false;
  try {
    const headers = await authHeaders();
    const response = await fetch(`${apiBase}/planifications?agent_id=${agentId}&date=${date}`, { headers });
    if (!response.ok) return false;
    const result = await response.json();
    return result && result.items && result.items.length > 0;
  } catch (error) {
    console.error('Erreur lors de la vérification de la planification:', error);
    return false;
  }
}

/**
 * Télécharge le rapport de validation au format PDF
 */
function downloadValidationReport(validationId) {
  if (!validationId) return;
  const link = document.createElement('a');
  link.href = `${apiBase}/validations/${validationId}/report`;
  link.download = `rapport-validation-${validationId}.pdf`;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Affiche les validations dans le tableau
 */
async function renderValidations(rows) {
  const tbody = document.getElementById('validations-body');
  if (!tbody) return;
  const cell = v => (v == null || v === '') ? '—' : v;
  const fmt = d => new Date(d).toLocaleString('fr-FR');
  const sortedRows = [...(rows || [])].sort((a, b) => {
    const dateA = a.ts ? new Date(a.ts) : new Date(0);
    const dateB = b.ts ? new Date(b.ts) : new Date(0);
    return dateA - dateB;
  });
  const uniqueAgentDays = new Map();
  const filteredRows = [];
  for (const row of sortedRows) {
    if (!row.agent_id || !row.ts) continue;
    const date = new Date(row.ts);
    const dateKey = date.toISOString().split('T')[0];
    const agentDayKey = `${row.agent_id}:${dateKey}`;
    if (uniqueAgentDays.has(agentDayKey)) continue;
    uniqueAgentDays.set(agentDayKey, true);
    filteredRows.push(row);
  }
  const thead = document.querySelector('#validations-table thead');
  if (thead) {
    thead.innerHTML = `
      <tr>
        <th>Agent</th>
        <th>Projet</th>
        <th>Localisation</th>
        <th>Rayon (m)</th>
        <th>Référence GPS</th>
        <th>Position actuelle</th>
        <th>Date/Heure</th>
        <th>Distance (m)</th>
        <th>Statut</th>
        <th>Planification</th>
        <th>Actions</th>
      </tr>
    `;
  }
  tbody.innerHTML = await Promise.all(filteredRows.map(async it => {
    const date = new Date(it.ts).toISOString().split('T')[0];
    const hasPlanning = await checkPlanningForAgent(it.agent_id, date);
    return `
      <tr>
        <td>${cell(it.agent)}</td>
        <td>${cell(it.projet)}</td>
        <td>${cell(it.localisation)}</td>
        <td>${cell(it.rayon_m)}</td>
        <td>${(it.ref_lat != null && it.ref_lon != null) ? `${it.ref_lat}, ${it.ref_lon}` : '—'}</td>
        <td>${(it.lat != null && it.lon != null) ? `${it.lat}, ${it.lon}` : '—'}</td>
        <td>${it.ts ? fmt(it.ts) : '—'}</td>
        <td>${cell(it.distance_m)}</td>
        <td>${cell(it.statut)}</td>
        <td class="text-center">${hasPlanning ? '✅ Oui' : '❌ Non'}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary" onclick="downloadValidationReport('${it.id}')" title="Télécharger le rapport">
            <i class="bi bi-download"></i>
          </button>
        </td>
      </tr>
    `;
  })).then(rows => rows.join('') || `<tr><td colspan="11">Aucune donnée</td></tr>`);
  window.__lastRows = rows;
  window.__filteredRows = filteredRows;
}

/**
 * Charge les utilisateurs et leurs planifications pour la date sélectionnée
 */
async function loadUsersPlanning() {
  try {
    let date = '';
    const dateInput = document.getElementById('date') || document.getElementById('date-filter');
    if (dateInput && dateInput.value) {
      date = dateInput.value;
    } else {
      const today = new Date();
      date = today.toISOString().split('T')[0];
      if (dateInput) dateInput.value = date;
    }
    console.log('Date utilisée pour le filtre:', date);
    const headers = await authHeaders();
    const tbody = document.getElementById('users-planning-body');
    if (!tbody) {
      console.error('ERREUR: L\'élément avec l\'ID users-planning-body est introuvable dans le DOM');
      return;
    }
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Chargement des données...</td></tr>';
    let allUsers = [];
    let users = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;
    try {
      while (hasMore) {
        const url = `${apiBase}/users?page=${page}&limit=${limit}`;
        const usersRes = await fetch(url, { headers });
        if (!usersRes.ok) {
          const errorText = await usersRes.text();
          console.error('Erreur lors du chargement des utilisateurs:', usersRes.status, errorText);
          throw new Error(`Erreur ${usersRes.status} lors du chargement des utilisateurs`);
        }
        const response = await usersRes.json();
        let usersData = [];
        if (response && response.items && Array.isArray(response.items)) {
          usersData = response.items;
        } else if (Array.isArray(response)) {
          usersData = response;
        } else if (response && response.data && Array.isArray(response.data)) {
          usersData = response.data;
        } else if (response && response.success && response.items) {
          usersData = response.items || [];
        } else {
          usersData = Object.values(response).find(Array.isArray) || [];
        }
        allUsers = [...allUsers, ...usersData];
        if (usersData.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      }
      users = allUsers.filter(user => {
        if (!user) return false;
        const userRole = (user.role || '').toLowerCase().trim();
        return userRole !== 'admin' && userRole !== '';
      });
    } catch (error) {
      console.error('Erreur lors du parsing des utilisateurs:', error);
      users = [];
    }
    let planningItems = [];
    try {
      const from = `${date}T00:00:00.000Z`;
      const to = `${date}T23:59:59.999Z`;
      const planningRes = await fetch(`${apiBase}/planifications?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers });
      if (!planningRes.ok) {
        const errorText = await planningRes.text();
        console.error('Erreur lors du chargement des planifications:', planningRes.status, errorText);
      } else {
        const planningData = await planningRes.json();
        if (planningData && planningData.items && Array.isArray(planningData.items)) {
          planningItems = planningData.items;
        } else if (Array.isArray(planningData)) {
          planningItems = planningData;
        } else if (planningData && planningData.data && Array.isArray(planningData.data)) {
          planningItems = planningData.data;
        } else {
          planningItems = [];
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des planifications:', error);
    }
    const usersWithPlanning = new Set(planningItems.map(p => p.user_id));
    let withPlanning = 0;
    let withoutPlanning = 0;
    tbody.innerHTML = '';
    const rows = [];
    await Promise.all(users.map(async (user, index) => {
      const hasPlanning = await checkPlanningForAgent(user.id, date);
      if (hasPlanning) {
        withPlanning++;
      } else {
        withoutPlanning++;
      }
      const planningCell = hasPlanning ? 'Oui' : 'Non';
      const planningClass = hasPlanning ? 'text-success' : 'text-danger';
      // Construire le nom d'affichage selon la structure de la table users
      let displayName = '';
      if (user.name && user.name.trim()) {
        displayName = user.name.trim();
      } else if (user.first_name || user.last_name) {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        displayName = `${firstName} ${lastName}`.trim();
      } else {
        displayName = user.email || 'Non renseigné';
      }
      const row = `
        <tr>
          <td>${index + 1}</td>
          <td>${displayName}</td>
          <td>${user.email || '—'}</td>
          <td>${user.role || '—'}</td>
          <td class="${planningClass} text-center">${planningCell}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-info" onclick="viewPlanningDetails('${user.id}', '${date}')">
              <i class="bi bi-eye"></i> Voir
            </button>
          </td>
        </tr>
      `;
      rows.push(row);
    }));
    tbody.innerHTML = rows.join('') || '<tr><td colspan="6" class="text-center">Aucun utilisateur trouvé</td></tr>';
    const countElement = document.getElementById('planning-count');
    if (countElement) {
      countElement.innerHTML = `
        <span class="text-success">${withPlanning} avec</span> /
        <span class="text-danger">${withoutPlanning} sans</span>
      `;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des planifications:', error);
    const tbody = document.getElementById('users-planning-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-danger">
            Erreur lors du chargement des données: ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Affiche les détails de la planification d'un utilisateur
 */
async function viewPlanningDetails(userId, date) {
  try {
    const dateInput = document.getElementById('date') || document.getElementById('date-filter');
    date = dateInput?.value || new Date().toISOString().split('T')[0];
    let userName = 'Non renseigné';
    try {
      const userResponse = await fetch(`${apiBase}/users/${userId}`, { headers: await authHeaders() });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        userName = userData.name || `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email || 'Utilisateur inconnu';
      }
    } catch (userError) {
      console.error('Erreur lors de la récupération des informations utilisateur:', userError);
    }
    const headers = await authHeaders();
    const response = await fetch(`${apiBase}/planifications?user_id=${userId}&date=${date}`, { headers });
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des détails de la planification');
    }
    const planification = await response.json();
    let modalContent = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Détails de la planification</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
          </div>
          <div class="modal-body">
            <p><strong>Date :</strong> ${new Date(date).toLocaleDateString('fr-FR')}</p>
    `;
    if (planification && planification.items && planification.items.length > 0) {
      const plan = planification.items[0];
      modalContent += `
        <div class="table-responsive">
          <table class="table table-bordered">
            <tr><th>Utilisateur</th><td>${plan.user_name || 'Non spécifié'}</td></tr>
            <tr><th>Projet</th><td>${plan.projet || 'Non spécifié'}</td></tr>
            <tr><th>Localisation</th><td>${plan.localisation || 'Non spécifiée'}</td></tr>
            <tr><th>Heure de début</th><td>${plan.heure_debut || 'Non spécifiée'}</td></tr>
            <tr><th>Heure de fin</th><td>${plan.heure_fin || 'Non spécifiée'}</td></tr>
            <tr><th>Statut</th><td><span class="badge bg-success">Planifié</span></td></tr>
          </table>
        </div>
      `;
    } else {
      modalContent += `
        <div class="alert alert-warning">
          Aucune planification trouvée pour cette date.
        </div>
      `;
    }
    modalContent += `
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
          </div>
        </div>
      </div>
    `;
    let modal = document.getElementById('planningDetailsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'planningDetailsModal';
      modal.className = 'modal fade';
      modal.tabIndex = -1;
      modal.setAttribute('aria-hidden', 'true');
      document.body.appendChild(modal);
    }
    modal.innerHTML = modalContent;
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
  } catch (error) {
    console.error('Erreur dans viewPlanningDetails:', error);
    alert('Une erreur est survenue lors du chargement des détails de la planification');
  }
}

/**
 * Génère le rapport de présence
 */
window.loadValidations = async function() {
  const rows = await fetchReportsFromBackend();
  renderValidations(rows);
};

/**
 * Génère le rapport et affiche les statistiques
 */
window.generateReport = async function() {
  await window.loadValidations();
  const filteredRows = window.__filteredRows || [];
  const total = filteredRows.length;
  const presents = filteredRows.filter(r => !(r.statut || '').toLowerCase().includes('hors')).length;
  const absent = total - presents;
  const rate = total ? Math.round((presents / total) * 100) : 0;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };
  set('total-agents', total);
  set('present-agents', presents);
  set('absent-agents', absent);
  set('attendance-rate', rate + '%');
  const rr = document.getElementById('report-results');
  if (rr) rr.style.display = 'block';
  try { renderCharts(filteredRows); } catch (e) { console.warn('Charts render failed:', e?.message || e); }
};

/**
 * Exporte le rapport en CSV
 */
window.printReport = function() {
  window.print();
};

window.exportReport = function() {
  const rows = window.__lastRows || [];
  const cols = ['Agent', 'Projet', 'Localisation', 'Rayon (m)', 'Ref (lat, lon)', 'Actuel (lat, lon)', 'Date', 'Distance (m)', 'Statut'];
  const fmt = d => new Date(d).toLocaleString('fr-FR');
  const esc = s => String(s ?? '').replace(/[\n\r;,]/g, ' ').trim();
  const lines = [cols.join(';')].concat(rows.map(r => {
    return [
      esc(r.agent),
      esc(r.projet),
      esc(r.localisation),
      esc(r.rayon_m),
      (r.ref_lat != null && r.ref_lon != null) ? `${r.ref_lat}, ${r.ref_lon}` : '—',
      (r.lat != null && r.lon != null) ? `${r.lat}, ${r.lon}` : '—',
      r.ts ? fmt(r.ts) : '—',
      esc(r.distance_m),
      esc(r.statut)
    ].join(';');
  }));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport_presence_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Exporte le rapport en image
 */
function loadHtml2Canvas() {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) {
      return resolve(window.html2canvas);
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.integrity = 'sha512-DtPgXY9o0X7dJQeVD3+BTaV3VH6f3WbbVwY6JyvRkU6pqfT4WkV95F6w5VwJQJZt+2Q1RCT3v5F7V0k58ygg==';
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = (error) => {
      console.error('Erreur lors du chargement de html2canvas:', error);
      reject(new Error('Impossible de charger la bibliothèque html2canvas'));
    };
    document.head.appendChild(script);
  });
}

// Fonction pour exporter le rapport en HTML
window.exportAsHtml = async function() {
  try {
    // Créer et afficher l'indicateur de chargement
    const loading = document.createElement('div');
    loading.id = 'export-loading';
    loading.style.position = 'fixed';
    loading.style.top = '50%';
    loading.style.left = '50%';
    loading.style.transform = 'translate(-50%, -50%)';
    loading.style.padding = '20px';
    loading.style.backgroundColor = 'rgba(0,0,0,0.8)';
    loading.style.color = 'white';
    loading.style.borderRadius = '5px';
    loading.style.zIndex = '10000';
    loading.style.textAlign = 'center';
    loading.innerHTML = 'Préparation de l\'export HTML...<br><small>Cette opération peut prendre quelques secondes</small>';
    document.body.appendChild(loading);

    // Donner le temps à l'UI de se mettre à jour
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Récupérer les conteneurs des tableaux
    const reportsContainer = document.getElementById('report-results');
    const validationsSection = document.querySelector('.card:has(#validations-table)');
    
    if (!reportsContainer && !validationsSection) {
      throw new Error('Aucune donnée à exporter. Veuillez générer un rapport d\'abord.');
    }
    
    // Récupérer les informations de date filtrée
    const getReportPeriod = () => {
      try {
        const dateRange = document.getElementById('date-range');
        const dateFilter = document.getElementById('date-filter');
        
        if (!dateRange || !dateFilter) return 'Période non spécifiée';
        
        const dateValue = dateFilter.value;
        const rangeValue = dateRange.value;
        
        if (rangeValue === 'today') {
          return `Aujourd'hui (${new Date(dateValue).toLocaleDateString('fr-FR')})`;
        } else if (rangeValue === 'yesterday') {
          return `Hier (${new Date(dateValue).toLocaleDateString('fr-FR')})`;
        } else if (rangeValue === 'this_week') {
          return 'Cette semaine';
        } else if (rangeValue === 'last_week') {
          return 'La semaine dernière';
        } else if (rangeValue === 'this_month') {
          return 'Ce mois-ci';
        } else if (rangeValue === 'last_month') {
          return 'Le mois dernier';
        } else if (rangeValue === 'custom' && dateValue) {
          return `Période personnalisée: ${new Date(dateValue).toLocaleDateString('fr-FR')}`;
        } else if (dateValue) {
          return new Date(dateValue).toLocaleDateString('fr-FR');
        }
        
        return 'Période non spécifiée';
      } catch (e) {
        console.error('Erreur lors de la récupération de la période:', e);
        return 'Période non spécifiée';
      }
    };
    
    const reportPeriod = getReportPeriod();
    
    // Créer un conteneur pour l'export
    const exportContainer = document.createElement('div');
    
    // Ajouter le rapport principal s'il existe
    if (reportsContainer && reportsContainer.textContent.trim() !== '') {
      const reportsClone = reportsContainer.cloneNode(true);
      
      // Nettoyer les éléments interactifs du rapport principal
      const buttons = reportsClone.querySelectorAll('button, .btn, .no-print, #reload-validations');
      buttons.forEach(btn => btn.remove());
      
      // Désactiver les liens dans le rapport principal
      const links = reportsClone.querySelectorAll('a');
      links.forEach(link => {
        link.style.pointerEvents = 'none';
        link.style.textDecoration = 'none';
        link.style.color = 'inherit';
      });
      
      // Récupérer les données des graphiques avant de cloner
      const metricsGrid = reportsClone.querySelector('.metrics-grid');
      const chartsContainer = reportsClone.querySelector('.report-charts');
      
      // Si les graphiques existent, les convertir en images
      if (chartsContainer) {
        const charts = chartsContainer.querySelectorAll('canvas');
        charts.forEach((chart, index) => {
          try {
            const imageUrl = chart.toDataURL('image/png');
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.marginTop = '20px';
            img.style.border = '1px solid #eee';
            img.style.borderRadius = '8px';
            img.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
            
            // Remplacer le canvas par l'image
            const container = chart.closest('.chart-container');
            if (container) {
              container.innerHTML = '';
              container.appendChild(img);
            }
          } catch (e) {
            console.error('Erreur lors de la conversion du graphique en image:', e);
          }
        });
      }
      
      exportContainer.appendChild(reportsClone);
      
      // S'assurer que la grille de métriques est correctement formatée
      if (metricsGrid) {
        metricsGrid.style.display = 'grid';
        metricsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(150px, 1fr))';
        metricsGrid.style.gap = '15px';
        metricsGrid.style.margin = '20px 0';
        metricsGrid.style.padding = '0 15px';
      }
    }
    
    // Ajouter la section des validations si elle existe
    if (validationsSection && validationsSection.textContent.trim() !== '') {
      const validationsClone = validationsSection.cloneNode(true);
      
      // Nettoyer les éléments interactifs de la section des validations
      const validationButtons = validationsClone.querySelectorAll('button, .btn, .no-print');
      validationButtons.forEach(btn => btn.remove());
      
      // Ajouter un espacement avant la section des validations
      if (exportContainer.children.length > 0) {
        const spacer = document.createElement('div');
        spacer.style.marginTop = '40px';
        exportContainer.appendChild(spacer);
      }
      
      // S'assurer que le tableau de validation est bien formaté
      const validationTable = validationsClone.querySelector('table');
      if (validationTable) {
        validationTable.style.width = '100%';
        validationTable.style.marginBottom = '1.5rem';
        validationTable.style.borderCollapse = 'collapse';
      }
      
      exportContainer.appendChild(validationsClone);
    }
    // Créer le contenu HTML complet
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rapport de Présence - ${new Date().toLocaleDateString('fr-FR')}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          padding: 20px; 
          color: #333;
          line-height: 1.5;
        }
        .report-header { 
          text-align: center; 
          margin-bottom: 30px; 
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e9ecef;
          page-break-inside: avoid;
        }
        .report-title { 
          font-size: 28px; 
          font-weight: 600; 
          margin-bottom: 10px;
          color: #0d6efd;
        }
        .report-period {
          color: #495057;
          font-size: 16px;
          margin: 10px 0;
          font-weight: 500;
        }
        .report-date { 
          color: #6c757d; 
          font-size: 14px;
          margin-top: 5px;
        }
        .section { 
          margin-bottom: 40px; 
        }
        .section-title { 
          font-size: 20px; 
          font-weight: 600; 
          margin: 30px 0 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid #0d6efd;
          color: #2c3e50;
        }
        .table { 
          width: 100%; 
          margin-bottom: 1.5rem; 
          color: #212529; 
          border-collapse: collapse;
          font-size: 14px;
          box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
          page-break-inside: auto;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin: 20px 0;
          padding: 0 15px;
        }
        
        .metric-card {
          background: white;
          border-radius: 10px;
          padding: 15px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          gap: 12px;
          page-break-inside: avoid;
        }
        
        .metric-icon {
          font-size: 24px;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #f0f4ff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .metric-content {
          flex: 1;
        }
        
        .metric-value {
          font-size: 20px;
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 2px;
        }
        
        .metric-label {
          font-size: 13px;
          color: #7f8c8d;
          font-weight: 500;
        }
        
        .report-charts {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 30px 0;
          page-break-inside: avoid;
        }
        
        .chart-container {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .chart-container h4 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #2c3e50;
          font-size: 16px;
        }
        .table th { 
          background-color: #f8f9fa;
          font-weight: 600;
          text-align: left;
        }
        .table th, 
        .table td { 
          padding: 0.75rem; 
          vertical-align: middle; 
          border: 1px solid #dee2e6; 
        }
        .table thead th { 
          vertical-align: bottom; 
          border-bottom: 2px solid #dee2e6;
          background-color: #f1f3f5;
        }
        .table tbody tr:nth-child(odd) {
          background-color: rgba(0, 0, 0, 0.02);
        }
        .table tbody tr:hover {
          background-color: rgba(13, 110, 253, 0.05);
        }
        .badge {
          display: inline-block;
          padding: 0.35em 0.65em;
          font-size: 0.75em;
          font-weight: 700;
          line-height: 1;
          text-align: center;
          white-space: nowrap;
          vertical-align: baseline;
          border-radius: 0.25rem;
        }
        .badge-success {
          color: #fff;
          background-color: #198754;
        }
        .badge-warning {
          color: #000;
          background-color: #ffc107;
        }
        .badge-danger {
          color: #fff;
          background-color: #dc3545;
        }
        .no-print { 
          display: none; 
        }
        .text-center {
          text-align: center !important;
        }
        .text-end {
          text-align: right !important;
        }
        .mt-4 {
          margin-top: 1.5rem !important;
        }
        .mb-3 {
          margin-bottom: 1rem !important;
        }
        .alert {
          position: relative;
          padding: 1rem 1rem;
          margin-bottom: 1rem;
          border: 1px solid transparent;
          border-radius: 0.25rem;
        }
        .alert-info {
          color: #055160;
          background-color: #cff4fc;
          border-color: #b6effb;
        }
        .bi {
          display: inline-block;
          vertical-align: -0.125em;
        }
        @media print {
          body { 
            padding: 10px !important; 
            font-size: 12px;
            background: white;
            -webkit-print-color-adjust: exact;
          }
          .no-print { 
            display: none !important; 
          }
          .page-break { 
            page-break-before: always;
          }
          .table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead { 
            display: table-header-group;
          }
          tfoot { 
            display: table-footer-group;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="report-header">
          <h1 class="report-title">Rapport de Présence et Validations</h1>
          <div class="report-period">
            <strong>Période :</strong> ${reportPeriod}
          </div>
          <div class="report-date">
            <strong>Date du rapport :</strong> ${new Date().toLocaleDateString('fr-FR')}
          </div>
          <div class="report-date">
            Généré le ${new Date().toLocaleString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </div>
        </div>
        ${exportContainer.innerHTML}
        <div class="mt-4 text-muted small text-center">
          <p>Rapport généré par Presence CCRB - ${new Date().getFullYear()}</p>
        </div>
      </div>
      <script>
        // Script pour gérer l'impression automatique si nécessaire
        window.onload = function() {
          // Délai pour s'assurer que tout est chargé avant l'impression
          setTimeout(() => {
            // Désactiver l'impression automatique pour permettre à l'utilisateur de prévisualiser
            // window.print();
            
            // Afficher un message d'aide pour l'impression
            const printHelp = document.createElement('div');
            printHelp.style.position = 'fixed';
            printHelp.style.bottom = '20px';
            printHelp.style.left = '0';
            printHelp.style.right = '0';
            printHelp.style.textAlign = 'center';
            printHelp.style.padding = '10px';
            printHelp.style.backgroundColor = 'rgba(0,0,0,0.8)';
            printHelp.style.color = 'white';
            printHelp.style.zIndex = '10000';
            printHelp.innerHTML = 'Appuyez sur Ctrl+P pour imprimer ou faites un clic droit et sélectionnez "Enregistrer sous" pour sauvegarder le rapport';
            document.body.appendChild(printHelp);
            
            // Supprimer le message après 10 secondes
            setTimeout(() => {
              if (printHelp.parentNode) {
                printHelp.style.transition = 'opacity 1s';
                printHelp.style.opacity = '0';
                setTimeout(() => {
                  if (printHelp.parentNode) {
                    document.body.removeChild(printHelp);
                  }
                }, 1000);
              }
            }, 10000);
          }, 1000);
        };
      </script>
    </body>
    </html>
    `;

    // Créer un blob avec le contenu HTML
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    
    // Créer un lien de téléchargement
    const link = document.createElement('a');
    link.href = url;
    const fileName = `rapport-presence-${new Date().toISOString().slice(0, 10)}.html`;
    link.setAttribute('download', fileName);
    
    // Ajouter le lien au DOM, le cliquer et le supprimer
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Libérer la mémoire
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 100);
    
    // Afficher un message de confirmation
    loading.innerHTML = 'Téléchargement démarré !<br><small>Vérifiez votre dossier de téléchargement</small>';
    setTimeout(() => {
      if (loading.parentNode) {
        document.body.removeChild(loading);
      }
    }, 2000);
    
  } catch (error) {
    console.error('Erreur lors de l\'export HTML:', error);
    
    // Afficher un message d'erreur plus détaillé
    const errorMsg = `Erreur lors de l'export HTML : ${error.message || 'Erreur inconnue'}\n\nVeuillez réessayer ou contacter le support si le problème persiste.`;
    
    // Mettre à jour le message de chargement avec l'erreur
    const loading = document.getElementById('export-loading');
    if (loading) {
      loading.innerHTML = `
        <div style="color: #ff6b6b; margin-bottom: 10px;">
          <i class="bi bi-exclamation-triangle-fill"></i> Erreur
        </div>
        <div style="margin-bottom: 15px;">${error.message || 'Erreur inconnue'}</div>
        <button onclick="this.parentNode.parentNode.remove()" class="btn btn-sm btn-outline-light">Fermer</button>
      `;
    } else {
      alert(errorMsg);
    }
    
    // Afficher l'erreur dans la console pour le débogage
    console.error('Détails de l\'erreur:', error);
  }
};

// Fonction pour exporter en image
window.exportAsImage = async function() {
  const loading = document.createElement('div');
  loading.style.position = 'fixed';
  loading.style.top = '50%';
  loading.style.left = '50%';
  loading.style.transform = 'translate(-50%, -50%)';
  loading.style.padding = '20px';
  loading.style.backgroundColor = 'rgba(0,0,0,0.8)';
  loading.style.color = 'white';
  loading.style.borderRadius = '5px';
  loading.style.zIndex = '1000';
  loading.style.textAlign = 'center';
  loading.innerHTML = 'Préparation de l\'export image...<br><small>Veuillez patienter</small>';
  document.body.appendChild(loading);
  try {
    await loadHtml2Canvas();
    loading.innerHTML = 'Génération de l\'image...<br><small>Veuillez patienter</small>';
    await new Promise(resolve => setTimeout(resolve, 500));
    const element = document.getElementById('reports-container');
    if (!element) {
      throw new Error('Élément à exporter non trouvé');
    }
    const clone = element.cloneNode(true);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '1000px';
    container.style.padding = '20px';
    container.style.backgroundColor = 'white';
    container.style.boxSizing = 'border-box';
    container.appendChild(clone);
    document.body.appendChild(container);
    const cleanElement = (el) => {
      if (!el) return;
      const buttons = el.querySelectorAll('button, .btn, .no-print');
      buttons.forEach(btn => btn.remove());
      const links = el.querySelectorAll('a[onclick]');
      links.forEach(link => {
        link.style.pointerEvents = 'none';
        link.style.textDecoration = 'none';
        link.style.color = 'inherit';
      });
      el.style.overflow = 'visible';
      el.style.boxShadow = 'none';
      el.style.border = '1px solid #eee';
      el.style.marginBottom = '20px';
      const canvases = el.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
      });
    };
    cleanElement(clone);
    const style = document.createElement('style');
    style.textContent = `
      body { background: white !important; padding: 20px !important; }
      .card { border: 1px solid #dee2e6 !important; border-radius: 0.5rem !important; margin-bottom: 1rem !important; }
      .card-body { padding: 1.25rem !important; }
      .table { width: 100% !important; margin-bottom: 1rem !important; color: #212529 !important; border-collapse: collapse !important; }
      .table th, .table td { padding: 0.75rem !important; vertical-align: top !important; border: 1px solid #dee2e6 !important; }
      .table thead th { vertical-align: bottom !important; border-bottom: 2px solid #dee2e6 !important; }
      .badge { font-size: 90% !important; padding: 0.35em 0.65em !important; }
      .stats-grid { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important; gap: 15px !important; margin: 20px 0 !important; }
      .stat-card { background: #f8f9fa !important; border-radius: 8px !important; padding: 15px !important; text-align: center !important; }
      canvas { max-width: 100% !important; height: auto !important; display: block !important; }
    `;
    container.prepend(style);
    await new Promise(resolve => setTimeout(resolve, 500));
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    });
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.download = `rapport-${date}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Erreur lors de la génération de l\'image:', error);
    alert('Une erreur est survenue lors de l\'export en image : ' + (error.message || 'Erreur inconnue'));
  } finally {
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
    if (loading && loading.parentNode) {
      document.body.removeChild(loading);
    }
  }
};

/**
 * Charge les agents pour le filtre (uniquement les utilisateurs avec role "agent")
 */
async function loadAgentsForFilter() {
  try {
    const result = await api('/users');
    const users = result.items || result.data || result || [];
    
    // Filtrer uniquement les utilisateurs avec le rôle "agent"
    const agents = users.filter(user => {
      const role = (user.role || '').toLowerCase().trim();
      return role === 'agent';
    });
    
    const select = document.getElementById('agent-filter');
    if (!select) return;
    
    // Sauvegarder la valeur actuelle
    const currentValue = select.value;
    
    // Vider et réinitialiser le sélecteur
    select.innerHTML = '<option value="all">Tous les agents</option>';
    
    // Ajouter chaque agent comme option
    agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.id;
      
      // Construire le nom d'affichage selon la structure de la table users
      let displayName = '';
      if (agent.name && agent.name.trim()) {
        displayName = agent.name.trim();
      } else if (agent.first_name || agent.last_name) {
        const firstName = agent.first_name || '';
        const lastName = agent.last_name || '';
        displayName = `${firstName} ${lastName}`.trim();
      } else {
        displayName = agent.email || `Agent ${agent.id}`;
      }
      
      option.textContent = displayName;
      select.appendChild(option);
    });
    
    // Restaurer la valeur précédente si elle existe toujours
    if (currentValue && currentValue !== 'all') {
      const agentExists = agents.some(agent => String(agent.id) === currentValue);
      if (agentExists) {
        select.value = currentValue;
      }
    }
    
    console.log(`${agents.length} agents chargés pour le filtre (rôle: agent uniquement)`);
    console.log('Agents trouvés:', agents.map(a => ({ 
      id: a.id, 
      name: a.name, 
      first_name: a.first_name, 
      last_name: a.last_name, 
      email: a.email, 
      role: a.role 
    })));
  } catch (error) {
    console.error('Erreur lors du chargement des agents:', error);
  }
}

/**
 * Charge les superviseurs pour le filtre (uniquement les utilisateurs avec role "superviseur")
 */
async function loadSupervisorsForFilter() {
  try {
    const result = await api('/users');
    const users = result.items || result.data || result || [];
    
    // Filtrer uniquement les utilisateurs avec le rôle "superviseur" (exclure les admins)
    const supervisors = users.filter(user => {
      const role = (user.role || '').toLowerCase().trim();
      return role === 'superviseur';
    });
    
    const select = document.getElementById('supervisor-filter');
    if (!select) return;
    
    // Sauvegarder la valeur actuelle
    const currentValue = select.value;
    
    // Vider et réinitialiser le sélecteur
    select.innerHTML = '<option value="all">Tous les superviseurs</option>';
    
    // Ajouter chaque superviseur comme option
    supervisors.forEach(supervisor => {
      const option = document.createElement('option');
      option.value = supervisor.id;
      
      // Construire le nom d'affichage selon la structure de la table users
      let displayName = '';
      if (supervisor.name && supervisor.name.trim()) {
        displayName = supervisor.name.trim();
      } else if (supervisor.first_name || supervisor.last_name) {
        const firstName = supervisor.first_name || '';
        const lastName = supervisor.last_name || '';
        displayName = `${firstName} ${lastName}`.trim();
      } else {
        displayName = supervisor.email || `Superviseur ${supervisor.id}`;
      }
      
      option.textContent = displayName;
      select.appendChild(option);
    });
    
    // Restaurer la valeur précédente si elle existe toujours
    if (currentValue && currentValue !== 'all') {
      const supervisorExists = supervisors.some(supervisor => String(supervisor.id) === currentValue);
      if (supervisorExists) {
        select.value = currentValue;
      }
    }
    
    console.log(`${supervisors.length} superviseurs chargés pour le filtre (rôle: superviseur uniquement)`);
    console.log('Superviseurs trouvés:', supervisors.map(s => ({ 
      id: s.id, 
      name: s.name, 
      first_name: s.first_name, 
      last_name: s.last_name, 
      email: s.email, 
      role: s.role 
    })));
  } catch (error) {
    console.error('Erreur lors du chargement des superviseurs:', error);
  }
}

/**
 * Charge les départements pour le filtre
 */
async function loadDepartmentsForFilter() {
  try {
    // Données géographiques intégrées pour le Bénin
    const departments = [
      { id: 1, name: "Atlantique" },
      { id: 2, name: "Borgou" },
      { id: 3, name: "Collines" },
      { id: 4, name: "Couffo" },
      { id: 5, name: "Donga" },
      { id: 6, name: "Littoral" },
      { id: 7, name: "Mono" },
      { id: 8, name: "Ouémé" },
      { id: 9, name: "Plateau" },
      { id: 10, name: "Zou" }
    ];
    
    const select = document.getElementById('department-filter');
    if (!select) return;
    
    // Sauvegarder la valeur actuelle
    const currentValue = select.value;
    
    // Vider et réinitialiser le sélecteur
    select.innerHTML = '<option value="all">Tous les départements</option>';
    
    // Ajouter chaque département comme option
    departments.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = dept.name;
      select.appendChild(option);
    });
    
    // Restaurer la valeur précédente si elle existe toujours
    if (currentValue && currentValue !== 'all') {
      const deptExists = departments.some(dept => String(dept.id) === currentValue);
      if (deptExists) {
        select.value = currentValue;
      }
    }
    
    console.log(`${departments.length} départements chargés pour le filtre`);
  } catch (error) {
    console.error('Erreur lors du chargement des départements:', error);
  }
}

/**
 * Charge les communes pour un département donné
 */
async function loadCommunesForFilter(departmentId) {
  try {
    // Données géographiques intégrées pour le Bénin
    const communesData = {
      "1": [
        { id: 1, name: "Abomey-Calavi" },
        { id: 2, name: "Allada" },
        { id: 3, name: "Kpomassè" },
        { id: 4, name: "Ouidah" },
        { id: 5, name: "Sô-Ava" },
        { id: 6, name: "Toffo" },
        { id: 7, name: "Tori-Bossito" },
        { id: 8, name: "Zè" }
      ],
      "2": [
        { id: 9, name: "Bembèrèkè" },
        { id: 10, name: "Kalalé" },
        { id: 11, name: "N'Dali" },
        { id: 12, name: "Nikki" },
        { id: 13, name: "Parakou" },
        { id: 14, name: "Pèrèrè" },
        { id: 15, name: "Sinendé" },
        { id: 16, name: "Tchaourou" }
      ],
      "3": [
        { id: 17, name: "Bantè" },
        { id: 18, name: "Dassa-Zoumè" },
        { id: 19, name: "Glazoué" },
        { id: 20, name: "Ouèssè" },
        { id: 21, name: "Savalou" },
        { id: 22, name: "Savé" }
      ],
      "4": [
        { id: 23, name: "Aplahoué" },
        { id: 24, name: "Djakotomey" },
        { id: 25, name: "Klouékanmè" },
        { id: 26, name: "Lalo" },
        { id: 27, name: "Toviklin" }
      ],
      "5": [
        { id: 28, name: "Bassila" },
        { id: 29, name: "Copargo" },
        { id: 30, name: "Djougou" },
        { id: 31, name: "Ouaké" }
      ],
      "6": [
        { id: 32, name: "Cotonou" },
        { id: 33, name: "Porto-Novo" }
      ],
      "7": [
        { id: 34, name: "Athiémè" },
        { id: 35, name: "Bopa" },
        { id: 36, name: "Comè" },
        { id: 37, name: "Grand-Popo" },
        { id: 38, name: "Houéyogbé" },
        { id: 39, name: "Lokossa" }
      ],
      "8": [
        { id: 40, name: "Adjarra" },
        { id: 41, name: "Adjohoun" },
        { id: 42, name: "Aguégués" },
        { id: 43, name: "Akpro-Missérété" },
        { id: 44, name: "Avrankou" },
        { id: 45, name: "Bonou" },
        { id: 46, name: "Dangbo" },
        { id: 47, name: "Porto-Novo" },
        { id: 48, name: "Sèmè-Kpodji" }
      ],
      "9": [
        { id: 49, name: "Ifangni" },
        { id: 50, name: "Adja-Ouèrè" },
        { id: 51, name: "Kétou" },
        { id: 52, name: "Pobè" },
        { id: 53, name: "Sakété" }
      ],
      "10": [
        { id: 54, name: "Abomey" },
        { id: 55, name: "Agbangnizoun" },
        { id: 56, name: "Bohicon" },
        { id: 57, name: "Covè" },
        { id: 58, name: "Djidja" },
        { id: 59, name: "Ouinhi" },
        { id: 60, name: "Za-Kpota" },
        { id: 61, name: "Zangnanado" },
        { id: 62, name: "Zogbodomey" }
      ]
    };
    
    const select = document.getElementById('commune-filter');
    if (!select) return;
    
    // Sauvegarder la valeur actuelle
    const currentValue = select.value;
    
    if (!departmentId || departmentId === 'all') {
      // Vider et désactiver le sélecteur
      select.innerHTML = '<option value="all">Sélectionnez d\'abord un département</option>';
      select.disabled = true;
    } else {
      // Activer le sélecteur et charger les communes
      select.disabled = false;
      const communes = communesData[departmentId] || [];
      
      // Vider et réinitialiser le sélecteur
      select.innerHTML = '<option value="all">Toutes les communes</option>';
      
      // Ajouter chaque commune comme option
      communes.forEach(commune => {
        const option = document.createElement('option');
        option.value = commune.id;
        option.textContent = commune.name;
        select.appendChild(option);
      });
      
      // Restaurer la valeur précédente si elle existe toujours
      if (currentValue && currentValue !== 'all') {
        const communeExists = communes.some(commune => String(commune.id) === currentValue);
        if (communeExists) {
          select.value = currentValue;
        }
      }
      
      console.log(`${communes.length} communes chargées pour le département ${departmentId}`);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des communes:', error);
  }
}

/**
 * Charge les projets pour le filtre depuis la colonne project_name de la table users
 */
async function loadProjectsForFilter() {
  try {
    const result = await api('/users');
    const users = result.items || result.data || result || [];
    const projects = new Set();
    
    // Extraire les projets uniques depuis la colonne project_name de la table users
    users.forEach(user => {
      if (user.project_name && user.project_name.trim()) {
        projects.add(user.project_name.trim());
      }
    });
    
    const select = document.getElementById('project-filter');
    if (!select) return;
    
    // Sauvegarder la valeur actuelle
    const currentValue = select.value;
    
    // Vider et réinitialiser le sélecteur
    select.innerHTML = '<option value="all">Tous les projets</option>';
    
    // Ajouter chaque projet comme option
    Array.from(projects).sort().forEach(project => {
      const option = document.createElement('option');
      option.value = project;
      option.textContent = project;
      select.appendChild(option);
    });
    
    // Restaurer la valeur précédente si elle existe toujours
    if (currentValue && currentValue !== 'all' && projects.has(currentValue)) {
      select.value = currentValue;
    }
    
    console.log(`${projects.size} projets chargés depuis la colonne project_name de la table users:`, Array.from(projects));
  } catch (error) {
    console.error('Erreur lors du chargement des projets:', error);
  }
}

/**
 * Vérifie si une date correspond à une date précise
 */
function dateMatchesPrecise(preciseYmd, value) {
  try {
    if (!value) return false;
    let d;
    if (typeof value === 'number') {
      d = new Date(value);
    } else if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
      d = new Date(value);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(String(value))) {
      const [dd, mm, yyyy] = String(value).split(/[\s/]/);
      d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    } else {
      d = new Date(value);
    }
    if (!d || isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const localDate = `${y}-${m}-${day}`;
    const isoDate = d.toISOString().slice(0, 10);
    return localDate === preciseYmd || isoDate === preciseYmd;
  } catch {
    return false;
  }
}

/**
 * Affiche les graphiques de présence
 */
function renderCharts(rows) {
  const byDate = new Map();
  const fmtYMD = d => {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  };
  (rows || []).forEach(r => {
    if (!r.ts) return;
    const key = fmtYMD(r.ts);
    const rec = byDate.get(key) || { present: 0, total: 0 };
    rec.total++;
    if (!String(r.statut || '').toLowerCase().includes('hors')) rec.present++;
    byDate.set(key, rec);
  });
  const labels = Array.from(byDate.keys()).sort();
  const presentValues = labels.map(k => byDate.get(k).present);
  try { if (presenceLineChart) { presenceLineChart.destroy(); presenceLineChart = null; } } catch (e) { console.error(e); }
  try { if (rolePieChart) { rolePieChart.destroy(); rolePieChart = null; } } catch (e) { console.error(e); }
  const lineCanvas = document.getElementById('presence-line-chart');
  if (lineCanvas && typeof Chart !== 'undefined') {
    presenceLineChart = new Chart(lineCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Présents par jour',
          data: presentValues,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.2)',
          tension: 0.25,
          fill: true,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }
  let present = 0, absent = 0;
  const agentsSet = new Map();
  (rows || []).forEach(r => {
    const key = r.agent_id || r.agent || Math.random();
    const isPresent = !String(r.statut || '').toLowerCase().includes('hors');
    if (!agentsSet.has(key)) {
      agentsSet.set(key, isPresent);
    } else {
      agentsSet.set(key, agentsSet.get(key) || isPresent);
    }
  });
  Array.from(agentsSet.values()).forEach(v => v ? present++ : absent++);
  const pieCanvas = document.getElementById('role-pie-chart');
  if (pieCanvas && typeof Chart !== 'undefined') {
    rolePieChart = new Chart(pieCanvas.getContext('2d'), {
      type: 'pie',
      data: {
        labels: ['Présents', 'Absents'],
        datasets: [{
          data: [present, absent],
          backgroundColor: ['#10b981', '#ef4444']
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

// Initialisation
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Initialisation de reports.js (version backend)');
  await checkAuth();
  
  // Charger tous les filtres
  await Promise.all([
    loadAgentsForFilter(),
    loadSupervisorsForFilter(),
    loadProjectsForFilter(),
    loadDepartmentsForFilter()
  ]);
  
  // Gestionnaires d'événements pour les filtres
  const dateRangeSelect = document.getElementById('date-range');
  if (dateRangeSelect) {
    dateRangeSelect.addEventListener('change', window.updateDateInputs);
  }
  
  const generateBtn = document.getElementById('generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', window.generateReport);
  }
  
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', window.exportReport);
  }
  
  const printBtn = document.getElementById('print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', window.printReport);
  }
  
  const loadBtn = document.getElementById('load-btn');
  if (loadBtn) {
    loadBtn.addEventListener('click', window.loadValidations);
  }
  
  const applyBtn = document.getElementById('apply-filters-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => { 
      try { 
        await window.generateReport(); 
      } catch (e) { 
        console.error(e); 
      } 
    });
  }
  
  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      try {
        const dr = document.getElementById('date-range'); if (dr) dr.value = 'month';
        const df = document.getElementById('date-filter'); if (df) df.value = '';
        const ag = document.getElementById('agent-filter'); if (ag) ag.value = 'all';
        const sup = document.getElementById('supervisor-filter'); if (sup) sup.value = 'all';
        const pj = document.getElementById('project-filter'); if (pj) pj.value = 'all';
        const dept = document.getElementById('department-filter'); if (dept) dept.value = 'all';
        const comm = document.getElementById('commune-filter'); if (comm) comm.value = 'all';
        const rr = document.getElementById('report-results'); if (rr) rr.style.display = 'none';
        
        // Réinitialiser les communes
        loadCommunesForFilter('all');
      } catch (e) { 
        console.error(e); 
      }
    });
  }
  
  // Gestionnaire pour le changement de département
  const departmentSelect = document.getElementById('department-filter');
  if (departmentSelect) {
    departmentSelect.addEventListener('change', (e) => {
      const departmentId = e.target.value;
      loadCommunesForFilter(departmentId);
    });
  }
  
  // Gestionnaires pour les autres filtres
  const filterSelects = [
    'agent-filter',
    'supervisor-filter', 
    'project-filter',
    'commune-filter'
  ];
  
  filterSelects.forEach(filterId => {
    const select = document.getElementById(filterId);
    if (select) {
      select.addEventListener('change', () => {
        // Optionnel: recharger automatiquement les données quand un filtre change
        // window.generateReport();
      });
    }
  });
  
  window.updateDateInputs();
  const dateInput = document.getElementById('date');
  if (dateInput) {
    dateInput.addEventListener('change', loadUsersPlanning);
  }
  
  try {
    await loadUsersPlanning();
    await window.generateReport();
  } catch (error) {
    console.error('Erreur lors du chargement initial:', error);
  }
  console.log('✅ Reports.js initialisé avec succès');
});
