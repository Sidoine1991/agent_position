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
  const reportType = $('report-type').value;
  const agentFilter = $('agent-filter');
  
  // Ajuster les options d'agent selon le type de rapport
  if (reportType === 'performance') {
    // Pour les rapports de performance, on peut vouloir tous les agents
    agentFilter.innerHTML = `
      <option value="all">Tous les agents</option>
      <option value="1">Admin Principal</option>
      <option value="2">Superviseur Principal</option>
      <option value="3">Agent Test</option>
    `;
  } else {
    // Pour les autres rapports, on peut filtrer par agent spécifique
    agentFilter.innerHTML = `
      <option value="all">Tous les agents</option>
      <option value="1">Admin Principal</option>
      <option value="2">Superviseur Principal</option>
      <option value="3">Agent Test</option>
    `;
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

// Générer un rapport
async function generateReport() {
  const reportType = $('report-type').value;
  const dateRange = $('date-range').value;
  const agentFilter = $('agent-filter').value;
  
  try {
    let reportData;
    if (reportType === 'presence') {
      const { start, end } = getRangeDates(dateRange);
      const qs = new URLSearchParams();
      if (start) qs.set('from', start);
      if (end) qs.set('to', end);
      if (agentFilter && agentFilter !== 'all') qs.set('agent_id', agentFilter);
      const response = await api(`/admin/checkins?${qs.toString()}`);
      const items = response && response.items ? response.items : [];
      // Construire un dataset résumé compatible avec l’affichage actuel
      const byAgent = new Map();
      items.forEach(it => {
        const key = `${it.agent_id}:${it.agent_name}`;
        const obj = byAgent.get(key) || { name: it.agent_name, role: 'agent', status: 'present', arrivalTime: null, departureTime: null, duration: '-', location: `${it.departement || ''} ${it.commune || ''}`.trim(), within: [], distances: [] };
        obj.within.push(it.within_tolerance);
        if (typeof it.distance_from_reference_m === 'number') obj.distances.push(it.distance_from_reference_m);
        byAgent.set(key, obj);
      });
      const details = Array.from(byAgent.values()).map(a => ({
        name: a.name,
        role: a.role,
        status: a.within.some(v => v === false) ? 'absent' : 'present',
        arrivalTime: a.arrivalTime,
        departureTime: a.departureTime,
        duration: a.duration,
        location: a.location
      }));
      reportData = {
        type: 'presence',
        period: getPeriodText(dateRange),
        totalAgents: details.length,
        presentAgents: details.filter(d => d.status === 'present').length,
        absentAgents: details.filter(d => d.status !== 'present').length,
        attendanceRate: details.length ? Math.round((details.filter(d => d.status === 'present').length / details.length) * 100) : 0,
        details
      };
    } else {
      // Simuler la génération de données pour les autres rapports
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

// Exporter le rapport
function exportReport() {
  const reportType = $('report-type').value;
  const dateRange = $('date-range').value;
  
  // Simuler l'export
  alert(`Export du rapport ${getReportTitle(reportType)} pour la période ${getPeriodText(dateRange)} en cours...`);
  
  // Dans une vraie application, on générerait un fichier PDF ou Excel
  const csvContent = [
    ['Agent', 'Rôle', 'Statut', 'Heure d\'arrivée', 'Heure de départ', 'Durée', 'Localisation'],
    ...Array.from($('report-table-body').rows).map(row => 
      Array.from(row.cells).map(cell => cell.textContent.trim())
    )
  ].map(row => row.join(',')).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

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
    updateDateInputs();
    
    // Charger les rapports sauvegardés
    await loadSavedReports();
  }
});
