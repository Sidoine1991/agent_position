// Script pour la page de rapports
let jwt = localStorage.getItem('jwt') || '';
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
    // Simuler la génération de données
    const reportData = await simulateReportData(reportType, dateRange, agentFilter);
    
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

function deleteSavedReport(reportId) {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce rapport ?')) {
    alert(`Suppression du rapport #${reportId}`);
    // Ici on supprimerait le rapport de la base de données
  }
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
  }
});
