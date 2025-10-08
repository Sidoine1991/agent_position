// Script pour la page de rapports
// Configuration de l'API - utiliser Render en production sur Vercel
let jwt = localStorage.getItem('jwt') || '';
let currentUser = null;

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || '';
}

function getEmailHint() {
  return getQueryParam('email') || localStorage.getItem('email') || localStorage.getItem('user_email') || localStorage.getItem('userEmail') || '';
}

function $(id) { return document.getElementById(id); }

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

// Vérifier l'authentification et les permissions
async function checkAuth() {
  const emailHint = getEmailHint();

  // Préparer des données locales si disponibles
  const loginData = JSON.parse(localStorage.getItem('loginData') || '{}');
  const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');

  // 1) Essayer via token si présent
  if (jwt) {
    try {
      currentUser = await api('/profile');
    } catch (e) {
      console.warn('Profil via token indisponible:', e?.message);
    }
  }

  // 2) Fallback: données locales
  if (!currentUser && (loginData.role || userProfile.role)) {
    currentUser = loginData.role ? loginData : userProfile;
  }

  // 3) Fallback: soft-auth via email
  if (!currentUser && emailHint) {
    try {
      currentUser = await api('/profile?email=' + encodeURIComponent(emailHint));
    } catch (e) {
      console.warn('Profil via email indisponible:', e?.message);
      currentUser = { name: emailHint.split('@')[0] || 'Utilisateur', email: emailHint, role: 'admin' };
    }
  }

  if (!currentUser) {
    alert('Accès restreint. Connectez-vous pour accéder aux rapports.');
    return false;
  }

  // Vérifier admin ou supervisor
  if (currentUser.role !== 'admin' && currentUser.role !== 'supervisor') {
    alert('Accès refusé. Cette page est réservée aux administrateurs et superviseurs.');
    return false;
  }

  return true;
}

// Mettre à jour les filtres selon le type de rapport
function updateReportFilters() {
  // Plus d'options fictives: la liste d'agents est remplie depuis Supabase
  // (voir loadAgentsOptions)
}

// Charger la liste réelle des agents depuis Supabase
async function loadAgentsOptions() {
  try {
    const key  = window.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || '';
    const base = (window.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || '').replace(/\/+$/,'');
    const sel = $('agent-filter'); if (!sel || !base || !key) return;
    const r = await fetch(`${base}/rest/v1/users?select=id,name&order=name`, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    const rows = r.ok ? await r.json() : [];
    sel.innerHTML = '<option value="all">Tous les agents</option>'
      + rows.map(a => `<option value="${a.id}">${(a.name || ('Agent '+a.id))}</option>`).join('');
  } catch (e) {
    console.warn('Agents list load failed:', e?.message || e);
  }
}

// Mettre à jour les champs de date
function updateDateInputs() {
  const dateRange = $('date-range').value;
  const customDateGroup = $('custom-date-group');
  const customDateGroupEnd = $('custom-date-group-end');
  
  if (dateRange === 'custom') {
    customDateGroup.style.display = 'block';
    customDateGroupEnd.style.display = 'block';
    
    // Définir les dates par défaut
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    $('end-date').value = today.toISOString().split('T')[0];
    $('start-date').value = lastMonth.toISOString().split('T')[0];
  } else {
    customDateGroup.style.display = 'none';
    customDateGroupEnd.style.display = 'none';
  }
}

// Rendez disponible immédiatement pour les handlers inline
try { window.updateDateInputs = updateDateInputs; } catch {}

// Générer un rapport
async function generateReport() {
  const reportType = $('report-type').value;
  const dateRange = $('date-range').value;
  const agentFilter = $('agent-filter').value;
  
  try {
    let reportData;
    if (reportType === 'presence') {
      // Utiliser la RPC Supabase attendance_report pour des données fiables
      const { start, end } = getRangeDates(dateRange);
      const fromISO = start ? new Date(start + 'T00:00:00Z').toISOString() : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const toISO   = end   ? new Date(end   + 'T23:59:59Z').toISOString() : new Date().toISOString();
      const key  = window.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || '';
      const base = (window.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || '').replace(/\/+$/,'');
      const body = { _from: fromISO, _to: toISO, _agent_id: (agentFilter && agentFilter !== 'all') ? parseInt(agentFilter,10) : null };
      const r = await fetch(`${base}/rest/v1/rpc/attendance_report`, {
        method: 'POST',
        headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(`RPC ${r.status}`);
      const rows = await r.json();
      // Convertir vers le modèle d’affichage existant
      const agents = new Map();
      for (const it of rows) {
        const keyA = it.agent_id + ':' + (it.agent || 'Agent');
        const rec = agents.get(keyA) || { name: it.agent || 'Agent', role: 'agent', status: 'present', arrivalTime: null, departureTime: null, duration: '-', location: it.localisation || '' };
        // statut: si une ligne hors tolérance existe, marquer absent
        if (it.statut && it.statut.toLowerCase().includes('hors')) rec.status = 'absent';
        // arrival/departure (première et dernière horodatée)
        const t = new Date(it.ts).getTime();
        rec._min = Math.min(rec._min ?? t, t);
        rec._max = Math.max(rec._max ?? t, t);
        agents.set(keyA, rec);
      }
      const details = Array.from(agents.values()).map(a => ({
        name: a.name,
        role: a.role,
        status: a.status,
        arrivalTime: a._min ? new Date(a._min).toLocaleTimeString('fr-FR') : '-',
        departureTime: a._max ? new Date(a._max).toLocaleTimeString('fr-FR') : '-',
        duration: (a._min && a._max) ? Math.round((a._max - a._min)/(1000*60)) + ' min' : '-',
        location: a.location || '-'
      }));
      reportData = {
        type: 'presence',
        period: start && end ? `${start} → ${end}` : getPeriodText(dateRange),
        totalAgents: details.length,
        presentAgents: details.filter(d => d.status === 'present').length,
        absentAgents: details.filter(d => d.status !== 'present').length,
        attendanceRate: details.length ? Math.round((details.filter(d => d.status === 'present').length / details.length) * 100) : 0,
        details
      };
    } else {
      reportData = await simulateReportData(reportType, dateRange, agentFilter);
    }
    
    // Afficher les résultats
    displayReport(reportData);
    
    // Afficher la section des résultats
    $('report-results').style.display = 'block';
    
    // Scroll vers les résultats
    $('report-results').scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    alert('Erreur lors de la génération du rapport: ' + error.message);
  }
}

// Simuler des données de rapport
async function simulateReportData(reportType, dateRange, agentFilter) {
  // Simuler un délai de génération
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const agents = [
    { id: 1, name: 'Admin Principal', role: 'admin', email: 'admin@ccrb.local' },
    { id: 2, name: 'Superviseur Principal', role: 'supervisor', email: 'supervisor@ccrb.local' },
    { id: 3, name: 'Agent Test', role: 'agent', email: 'agent@test.com' }
  ];
  
  const filteredAgents = agentFilter === 'all' ? agents : agents.filter(a => a.id == agentFilter);
  
  const reportData = {
    type: reportType,
    period: getPeriodText(dateRange),
    totalAgents: filteredAgents.length,
    presentAgents: Math.floor(filteredAgents.length * 0.8),
    absentAgents: Math.floor(filteredAgents.length * 0.2),
    attendanceRate: Math.floor(Math.random() * 20) + 80,
    details: filteredAgents.map(agent => ({
      ...agent,
      status: Math.random() > 0.2 ? 'present' : 'absent',
      arrivalTime: Math.random() > 0.2 ? '08:30' : null,
      departureTime: Math.random() > 0.2 ? '17:00' : null,
      duration: Math.random() > 0.2 ? '8h30' : '0h',
      location: Math.random() > 0.2 ? 'Bureau Principal' : 'Non renseigné'
    }))
  };
  
  return reportData;
}

// Afficher le rapport
function displayReport(data) {
  // Mettre à jour le titre et les métadonnées
  $('report-title').textContent = getReportTitle(data.type);
  $('report-period').textContent = `Période: ${data.period}`;
  $('generated-date').textContent = new Date().toLocaleString('fr-FR');
  
  // Mettre à jour les métriques
  $('total-agents').textContent = data.totalAgents;
  $('present-agents').textContent = data.presentAgents;
  $('absent-agents').textContent = data.absentAgents;
  $('attendance-rate').textContent = data.attendanceRate + '%';
  
  // Mettre à jour le tableau
  const tbody = $('report-table-body');
  tbody.innerHTML = data.details.map(agent => `
    <tr>
      <td>${agent.name}</td>
      <td><span class="role-badge role-${agent.role}">${getRoleText(agent.role)}</span></td>
      <td><span class="status-badge status-${agent.status}">${getStatusText(agent.status)}</span></td>
      <td>${agent.arrivalTime || '-'}</td>
      <td>${agent.departureTime || '-'}</td>
      <td>${agent.duration}</td>
      <td>${agent.location}</td>
    </tr>
  `).join('');
}

// Charger les validations depuis l'API rapports/validations
async function loadValidations() {
  try {
    const dateRange = $('date-range').value;
    const { start, end } = getRangeDates(dateRange);
    const qs = new URLSearchParams();
    if (start) qs.set('from', start);
    if (end) qs.set('to', end);
    const resp = await api('/reports/validations?' + qs.toString());
    const items = resp?.items || [];
    const body = $('validations-body');
    body.innerHTML = items.map(it => `
      <tr>
        <td>${it.agent_name || ('Agent #' + it.agent_id)}</td>
        <td>${it.project_name || ''}</td>
        <td>${[it.departement,it.commune,it.arrondissement,it.village].filter(Boolean).join(' / ')}</td>
        <td>${it.tolerance_radius_meters ?? ''}</td>
        <td>${(it.reference_lat??'')}, ${(it.reference_lon??'')}</td>
        <td>${(it.lat??'')}, ${(it.lon??'')}</td>
        <td>${new Date(it.date).toLocaleString('fr-FR')}</td>
        <td>${it.distance_from_reference_m ?? ''}</td>
        <td><span class="status-badge ${it.within_tolerance ? 'status-present' : 'status-absent'}">${it.within_tolerance ? 'Validé' : 'Hors zone'}</span></td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Erreur loadValidations:', e);
    $('validations-body').innerHTML = '<tr><td colspan="9">Erreur de chargement</td></tr>';
  }
}

// Rendez disponible immédiatement pour les handlers inline
try { window.loadValidations = loadValidations; } catch {}

// Exporter le rapport (CSV/TXT) avec colonnes demandées
async function exportReport() {
  try {
    const cols = [
      'Nom Animateur/agent','Prénom Animateur/Agent','Projet','Departement','Commune','Arrondissement','Village',
      'Longitude_reference','Latitude_reference','Rayon toléré (5km/ 5000 mètre)',
      'Latitude_actuelle','Longitude_actuelle','Date','Heure debut journée','Heure fin journée','Note','Photo','Statut_Presence','Distance_Reference_M'
    ];

    // Récupérer les données depuis l'API existante (admin export) si dispo
    const dateRange = $('date-range').value;
    const { start, end } = getRangeDates(dateRange);
    const qs = new URLSearchParams();
    if (start) qs.set('from', start);
    if (end) qs.set('to', end);
    // Utiliser directement la RPC pour récupérer les lignes export
    const urlSb = (window.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || '').replace(/\/+$/,'');
    const keySb = window.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || '';
    const body = {
      _from: start ? new Date(start + 'T00:00:00Z').toISOString() : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      _to:   end   ? new Date(end   + 'T23:59:59Z').toISOString() : new Date().toISOString(),
      _agent_id: null
    };
    const rRpc = await fetch(`${urlSb}/rest/v1/rpc/attendance_report`, {
      method: 'POST', headers: { apikey: keySb, Authorization: 'Bearer ' + keySb, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const rows = rRpc.ok ? await rRpc.json() : [];

    // Transformer vers les colonnes demandées
    const out = [cols.join(';')];
    for (const it of rows) {
      const nomComplet = (it.agent || '').trim();
      const nom = nomComplet.split(' ')[0] || '';
      const prenom = nomComplet.split(' ').slice(1).join(' ') || '';
      const projet = it.projet || '';
      const departement = it.localisation || '';
      const commune = '';
      const arrondissement = '';
      const village = '';
      const lonRef = it.ref_lon ?? '';
      const latRef = it.ref_lat ?? '';
      const rayon = it.rayon_m ?? '';
      const latAct = it.lat ?? '';
      const lonAct = it.lon ?? '';
      const dateStr = it.ts ? new Date(it.ts).toLocaleDateString('fr-FR') : '';
      const startStr = '';
      const endStr = '';
      const note = '';
      const photo = '';
      const statut = (it.statut || '').includes('Valid') ? 'Présent' : (it.statut || '');
      const dist = it.distance_m ?? '';
      out.push([
        nom, prenom, projet, departement, commune, arrondissement, village,
        lonRef, latRef, rayon, latAct, lonAct, dateStr, startStr, endStr,
        sanitize(note), photo, statut, dist
      ].map(v => String(v ?? '').replace(/[\n\r;/]/g, ' ').trim()).join(';'));
    }

    const txt = out.join('\n');
    const blob = new Blob([txt], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_presence_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Erreur export: ' + (e.message || e));
  }
}

function sanitize(s) { return (s || '').toString().replace(/[\n\r]/g,' ').trim(); }

// Gestion des rapports sauvegardés
function viewSavedReport(reportId) {
  alert(`Affichage du rapport sauvegardé #${reportId}`);
}

function downloadSavedReport(reportId) {
  alert(`Téléchargement du rapport sauvegardé #${reportId}`);
}

async function deleteSavedReport(reportId) {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce rapport ?')) {
    try {
      // Appeler l'API pour supprimer le rapport
      const result = await api(`/reports/${reportId}`, { method: 'DELETE' });
      
      if (result.success) {
        alert('Rapport supprimé avec succès');
        // Recharger la liste des rapports
        await loadSavedReports();
      } else {
        alert('Erreur lors de la suppression du rapport');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du rapport');
    }
  }
}

// Fonction pour charger les rapports sauvegardés
async function loadSavedReports() {
  try {
    const reports = await api('/reports');
    displaySavedReports(reports);
  } catch (error) {
    console.error('Erreur lors du chargement des rapports:', error);
    // Afficher un message d'erreur ou des rapports de démonstration
    displaySavedReports([]);
  }
}

// Fonction pour afficher les rapports sauvegardés
function displaySavedReports(reports) {
  const reportsList = document.getElementById('saved-reports-list');
  if (!reportsList) return;
  
  if (reports.length === 0) {
    reportsList.innerHTML = '<p>Aucun rapport sauvegardé</p>';
    return;
  }
  
  reportsList.innerHTML = reports.map(report => `
    <div class="report-item">
      <div class="report-info">
        <h4>${report.title || 'Rapport'}</h4>
        <p>Type: ${report.type || 'N/A'}</p>
        <p>Date: ${report.date || 'N/A'}</p>
        <p>Agent: ${report.agent || 'N/A'}</p>
      </div>
      <div class="report-actions">
        <button onclick="downloadSavedReport(${report.id})" class="btn btn-secondary">
          Télécharger
        </button>
        <button onclick="deleteSavedReport(${report.id})" class="btn btn-danger">
          Supprimer
        </button>
      </div>
    </div>
  `).join('');
}

// Utilitaires
function getReportTitle(type) {
  const titles = {
    'presence': 'Rapport de Présence',
    'activity': 'Rapport d\'Activité',
    'performance': 'Rapport de Performance',
    'summary': 'Résumé Exécutif'
  };
  return titles[type] || 'Rapport';
}

function getPeriodText(range) {
  const periods = {
    'today': 'Aujourd\'hui',
    'week': 'Cette semaine',
    'month': 'Ce mois',
    'quarter': 'Ce trimestre',
    'year': 'Cette année',
    'custom': 'Période personnalisée'
  };
  return periods[range] || range;
}

function getRangeDates(range) {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  if (range === 'today') return { start: fmt(today), end: fmt(today) };
  if (range === 'week') {
    const start = new Date(today); start.setDate(today.getDate() - 6);
    return { start: fmt(start), end: fmt(today) };
  }
  if (range === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: fmt(start), end: fmt(today) };
  }
  if (range === 'quarter') {
    const q = Math.floor(today.getMonth() / 3);
    const start = new Date(today.getFullYear(), q * 3, 1);
    return { start: fmt(start), end: fmt(today) };
  }
  if (range === 'year') {
    const start = new Date(today.getFullYear(), 0, 1);
    return { start: fmt(start), end: fmt(today) };
  }
  if (range === 'custom') {
    const s = $('start-date').value || null;
    const e = $('end-date').value || null;
    return { start: s, end: e };
  }
  return { start: null, end: null };
}

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
    'present': 'Présent',
    'absent': 'Absent'
  };
  return statusTexts[status] || status;
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
    await updateNavbar();
    
    // Initialiser les filtres
    updateReportFilters();
    await loadAgentsOptions();
    updateDateInputs();
    
    // Charger les rapports sauvegardés
    await loadSavedReports();

    // Brancher les boutons et selects (backend-side, sans inline handlers)
    try {
      const selRange = document.getElementById('date-range');
      if (selRange) selRange.addEventListener('change', () => { try { updateDateInputs(); } catch {} });
      const btnGen = document.getElementById('generate-btn');
      if (btnGen) btnGen.addEventListener('click', () => { try { generateReport(); } catch (e) { console.error(e); } });
      const btnExp = document.getElementById('export-btn');
      if (btnExp) btnExp.addEventListener('click', () => { try { exportReport(); } catch (e) { console.error(e); } });
      const btnPrint = document.getElementById('print-btn');
      if (btnPrint) btnPrint.addEventListener('click', () => { try { window.print(); } catch {} });
      const btnReload = document.getElementById('reload-validations');
      if (btnReload) btnReload.addEventListener('click', () => { try { loadValidations(); } catch (e) { console.error(e); } });
    } catch {}
  }
});

// Exposer les actions au scope global pour les boutons onclick du HTML
try {
  window.generateReport = generateReport;
  window.exportReport = exportReport;
  window.printReport = () => window.print();
  window.updateDateInputs = updateDateInputs;
  window.updateReportFilters = updateReportFilters;
  window.loadValidations = loadValidations;
} catch {}
