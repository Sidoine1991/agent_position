// Script pour la page d'administration
let jwt = localStorage.getItem('jwt') || '';
let currentUser = null;

function $(id) { return document.getElementById(id); }

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
  
  console.log('API call:', '/api' + path, { method: opts.method || 'GET', headers, body: opts.body });
  
  const res = await fetch('/api' + path, {
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
  if (!jwt) {
    alert('Veuillez vous connecter pour accéder à cette page');
    window.location.href = window.location.origin + '/';
    return false;
  }
  
  try {
    currentUser = await api('/profile');
    
    // Vérifier que l'utilisateur est admin
    if (currentUser.role !== 'admin') {
      alert('Accès refusé. Cette page est réservée aux administrateurs.');
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

// Charger les statistiques d'administration
async function loadAdminStats() {
  try {
    // Simuler des statistiques
    $('total-users').textContent = '3';
    $('total-units').textContent = '2';
    $('system-uptime').textContent = '99.9%';
    $('storage-used').textContent = '45%';
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error);
  }
}

// Gestion des unités administratives
function openUnitModal() {
  $('unit-modal-title').textContent = 'Nouvelle Unité Administrative';
  $('unit-form').reset();
  $('unit-modal').classList.remove('hidden');
}

function closeUnitModal() {
  $('unit-modal').classList.add('hidden');
}

function editUnit(unitId) {
  // Simuler l'édition d'une unité
  alert(`Édition de l'unité #${unitId} - Fonctionnalité à implémenter`);
}

function viewUnitDetails(unitId) {
  // Simuler l'affichage des détails
  alert(`Détails de l'unité #${unitId} - Fonctionnalité à implémenter`);
}

function deleteUnit(unitId) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette unité administrative ?')) {
    alert(`Suppression de l'unité #${unitId} - Fonctionnalité à implémenter`);
  }
}

function refreshUnits() {
  alert('Actualisation des unités administratives - Fonctionnalité à implémenter');
}

// Gestion du formulaire d'unité
async function handleUnitForm(e) {
  e.preventDefault();
  
  const formData = {
    name: $('unit-name').value.trim(),
    code: $('unit-code').value.trim(),
    description: $('unit-description').value.trim(),
    manager: $('unit-manager').value
  };
  
  try {
    // À implémenter : API pour créer/modifier une unité
    alert('Unité administrative créée avec succès !');
    closeUnitModal();
    
    // Recharger la liste des unités
    refreshUnits();
    
  } catch (error) {
    alert('Erreur lors de la création de l\'unité: ' + error.message);
  }
}

// Configuration système
function saveConfig() {
  const config = {
    orgName: $('org-name').value,
    timezone: $('timezone').value,
    workStart: $('work-start').value,
    workEnd: $('work-end').value,
    toleranceMinutes: $('tolerance-minutes').value,
    autoCheckout: $('auto-checkout').checked,
    geolocationRequired: $('geolocation-required').checked,
    emailNotifications: $('email-notifications').checked,
    pushNotifications: $('push-notifications').checked,
    reminderTime: $('reminder-time').value
  };
  
  try {
    // À implémenter : API pour sauvegarder la configuration
    alert('Configuration sauvegardée avec succès !');
  } catch (error) {
    alert('Erreur lors de la sauvegarde: ' + error.message);
  }
}

function resetConfig() {
  if (confirm('Êtes-vous sûr de vouloir réinitialiser la configuration aux valeurs par défaut ?')) {
    // Réinitialiser les valeurs par défaut
    $('org-name').value = 'CCRB';
    $('timezone').value = 'Africa/Porto-Novo';
    $('work-start').value = '08:00';
    $('work-end').value = '17:00';
    $('tolerance-minutes').value = '15';
    $('auto-checkout').checked = true;
    $('geolocation-required').checked = true;
    $('email-notifications').checked = true;
    $('push-notifications').checked = true;
    $('reminder-time').value = '08:30';
    
    alert('Configuration réinitialisée');
  }
}

// Maintenance système
function backupDatabase() {
  if (confirm('Lancer une sauvegarde de la base de données ?')) {
    alert('Sauvegarde de la base de données en cours...\n\nCette opération peut prendre quelques minutes.');
    // À implémenter : API pour la sauvegarde
  }
}

function optimizeDatabase() {
  if (confirm('Optimiser la base de données ?')) {
    alert('Optimisation de la base de données en cours...');
    // À implémenter : API pour l'optimisation
  }
}

function viewLogs() {
  alert('Affichage des logs système - Fonctionnalité à implémenter');
}

function clearLogs() {
  if (confirm('Supprimer tous les logs système ?')) {
    alert('Nettoyage des logs en cours...');
    // À implémenter : API pour nettoyer les logs
  }
}

function auditSecurity() {
  alert('Audit de sécurité en cours...\n\nVérification des permissions, sessions et accès.');
  // À implémenter : API pour l'audit de sécurité
}

function manageSessions() {
  alert('Gestion des sessions actives - Fonctionnalité à implémenter');
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
    if (currentUser.role === 'admin' || currentUser.role === 'superviseur') {
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
          'superviseur': 'Superviseur',
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
    await loadAdminStats();
    await updateNavbar();
    
    // Gestion du formulaire d'unité
    $('unit-form').addEventListener('submit', handleUnitForm);
  }
});
