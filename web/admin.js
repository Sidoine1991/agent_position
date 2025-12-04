// Script pour la page d'administration
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

// Configuration de l'API - utiliser Render en production sur Vercel
const onVercel = /\.vercel\.app$/.test(window.location.hostname) || window.location.hostname.includes('vercel.app');
const apiBase = '/api';
// Harmoniser la déconnexion
if (typeof window !== 'undefined' && typeof window.logout !== 'function') {
  window.logout = function() {
    try {
      localStorage.removeItem('jwt');
      localStorage.removeItem('loginData');
      localStorage.removeItem('userProfile');
      localStorage.setItem('presence_update', JSON.stringify({ type: 'logout', ts: Date.now() }));
    } catch {}
    window.location.href = '/register.html';
  };
}

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
    
    // Si erreur 403 avec message "réservé au superadmin", déconnecter et rediriger
    if (res.status === 403) {
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && (errorJson.error.includes('superadmin') || errorJson.error.includes('réservé') || errorJson.error.includes('administrateur requis'))) {
          console.log('❌ Accès refusé (superadmin requis) - Déconnexion et redirection');
          localStorage.removeItem('jwt');
          localStorage.removeItem('userProfile');
          localStorage.removeItem('userEmail');
          localStorage.setItem('logout_flag', 'true');
          if (window.sessionManager) {
            window.sessionManager.clearSession();
          }
          window.location.replace('/index.html');
          return;
        }
      } catch (e) {
        // Si ce n'est pas du JSON, vérifier le texte brut
        if (errorText.includes('superadmin') || errorText.includes('réservé') || errorText.includes('administrateur requis')) {
          console.log('❌ Accès refusé (superadmin requis) - Déconnexion et redirection');
          localStorage.removeItem('jwt');
          localStorage.removeItem('userProfile');
          localStorage.removeItem('userEmail');
          localStorage.setItem('logout_flag', 'true');
          if (window.sessionManager) {
            window.sessionManager.clearSession();
          }
          window.location.replace('/index.html');
          return;
        }
      }
    }
    
    throw new Error(errorText || res.statusText);
  }
  
  const ct = res.headers.get('content-type') || '';
  const result = ct.includes('application/json') ? await res.json() : await res.text();
  console.log('API result:', result);
  return result;
}

// Vérifier l'authentification et les permissions
// Version simplifiée : pas de reconnexion automatique, juste vérifier et déconnecter si nécessaire
async function checkAuth() {
  // Pas de token = déconnexion immédiate
  if (!jwt) {
    console.log('❌ Pas de token - Déconnexion immédiate');
    localStorage.clear();
    if (window.sessionManager) {
      window.sessionManager.clearSession();
    }
    window.location.replace('/index.html');
    return false;
  }

  // Vérifier le token une seule fois
    try {
      const result = await api('/profile');
      currentUser = result?.user || result || null;
    
    if (!currentUser) {
      // Pas d'utilisateur trouvé = déconnexion immédiate
      console.log('❌ Utilisateur non trouvé - Déconnexion immédiate');
      localStorage.clear();
      if (window.sessionManager) {
        window.sessionManager.clearSession();
      }
      window.location.replace('/index.html');
    return false;
  }

    // Vérifier rôle admin ou superadmin
    const role = (currentUser.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'superadmin') {
      // Déconnexion immédiate sans tentative de reconnexion
      console.log('❌ Accès refusé à /admin.html - Déconnexion immédiate');
      localStorage.clear();
      if (window.sessionManager) {
        window.sessionManager.clearSession();
      }
      window.location.replace('/index.html');
    return false;
  }

  return true;
  } catch (e) {
    // Erreur = déconnexion immédiate
    console.error('❌ Erreur vérification auth:', e);
    localStorage.clear();
    if (window.sessionManager) {
      window.sessionManager.clearSession();
    }
    window.location.replace('/index.html');
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

// Réinitialiser toutes les données
async function resetAllData() {
  const confirmMessage = `⚠️ ATTENTION ⚠️

Cette action va supprimer TOUTES les données :
• Tous les utilisateurs (sauf le super admin)
• Toutes les missions
• Tous les check-ins
• Toutes les absences
• Tous les rapports
• Tous les codes de vérification

Les tables seront conservées mais vides.

Êtes-vous ABSOLUMENT SÛR de vouloir continuer ?`;

  if (!confirm(confirmMessage)) {
    return;
  }

  // Double confirmation
  if (!confirm('Dernière chance ! Cette action est IRRÉVERSIBLE. Continuer ?')) {
    return;
  }

  try {
    const response = await api('/admin/reset-all-data', { method: 'POST' });
    
    if (response.success) {
      alert(`✅ Réinitialisation réussie !

Données supprimées :
• ${response.affected.users} utilisateurs
• ${response.affected.missions} missions  
• ${response.affected.checkins} check-ins
• ${response.affected.absences} absences
• ${response.affected.reports} rapports
• ${response.affected.verification_codes} codes de vérification

La base de données a été réinitialisée. Vous devez vous reconnecter.`);

      // Déconnexion et redirection
      localStorage.clear();
      window.location.href = '/register.html';
    } else {
      alert('❌ Erreur lors de la réinitialisation : ' + (response.message || 'Erreur inconnue'));
    }
  } catch (error) {
    console.error('Erreur resetAllData:', error);
    alert('❌ Erreur lors de la réinitialisation : ' + error.message);
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
  localStorage.setItem('logout_flag', 'true');
  if (window.sessionManager) {
    window.sessionManager.clearSession();
  }
  window.location.replace('/index.html');
}

// ===== GESTION DES FILTRES POUR SAUVEGARDE/SUPPRESSION =====

let allProjects = [];
let allAgents = [];

// Charger les projets pour les filtres
async function loadFilterProjects() {
  try {
    const response = await api('/api/users?role=agent');
    let users = [];
    if (Array.isArray(response)) {
      users = response;
    } else if (response.items && Array.isArray(response.items)) {
      users = response.items;
    } else if (response.users && Array.isArray(response.users)) {
      users = response.users;
    }
    
    const projectsSet = new Set();
    users.forEach(user => {
      if (user.project_name && user.project_name.trim()) {
        projectsSet.add(user.project_name.trim());
      }
    });
    
    allProjects = Array.from(projectsSet).sort();
    const select = $('filter-project-select');
    if (select) {
      select.innerHTML = '<option value="">Tous les projets</option>';
      allProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Erreur chargement projets:', error);
  }
}

// Charger les agents pour les filtres
async function loadFilterAgents() {
  try {
    const response = await api('/api/users?role=agent');
    let users = [];
    if (Array.isArray(response)) {
      users = response;
    } else if (response.items && Array.isArray(response.items)) {
      users = response.items;
    } else if (response.users && Array.isArray(response.users)) {
      users = response.users;
    }
    
    allAgents = users.sort((a, b) => {
      const nameA = (a.name || a.email || '').toLowerCase();
      const nameB = (b.name || b.email || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    const select = $('filter-agents-select');
    if (select) {
      select.innerHTML = '<option value="">Tous les agents</option>';
      allAgents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        const displayName = agent.name || 
                          `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || 
                          agent.email || `Agent ${agent.id}`;
        option.textContent = displayName;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Erreur chargement agents:', error);
  }
}

// Ouvrir le modal de filtres
window.openFilteredDataModal = function() {
  const modal = $('filtered-data-modal');
  if (modal) {
    modal.classList.remove('hidden');
    // Réinitialiser les filtres
    $('filter-start-date').value = '';
    $('filter-end-date').value = '';
    $('filter-project-select').selectedIndex = -1;
    $('filter-agents-select').selectedIndex = -1;
    // Cocher tous les types par défaut
    ['checkins', 'missions', 'presences', 'permissions', 'activities', 'reports'].forEach(type => {
      const checkbox = $(`filter-${type}`);
      if (checkbox) checkbox.checked = true;
    });
    $('filter-preview').style.display = 'none';
  }
}

// Fermer le modal de filtres
window.closeFilteredDataModal = function() {
  const modal = $('filtered-data-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Obtenir les filtres sélectionnés
function getSelectedFilters() {
  const startDate = $('filter-start-date').value || null;
  const endDate = $('filter-end-date').value || null;
  
  const projectSelect = $('filter-project-select');
  const selectedProjects = Array.from(projectSelect.selectedOptions)
    .map(opt => opt.value)
    .filter(v => v);
  
  const agentsSelect = $('filter-agents-select');
  const selectedAgents = Array.from(agentsSelect.selectedOptions)
    .map(opt => opt.value)
    .filter(v => v)
    .map(id => parseInt(id, 10));
  
  const dataTypes = [];
  ['checkins', 'missions', 'presences', 'permissions', 'activities', 'reports'].forEach(type => {
    const checkbox = $(`filter-${type}`);
    if (checkbox && checkbox.checked) {
      dataTypes.push(type);
    }
  });
  
  return {
    startDate,
    endDate,
    projects: selectedProjects.length > 0 ? selectedProjects : null,
    agentIds: selectedAgents.length > 0 ? selectedAgents : null,
    dataTypes: dataTypes.length > 0 ? dataTypes : ['checkins', 'missions', 'presences', 'permissions', 'activities', 'reports']
  };
}

// Aperçu des données filtrées
window.previewFilteredData = async function() {
  const filters = getSelectedFilters();
  const previewDiv = $('filter-preview');
  const previewText = $('filter-preview-text');
  
  if (!previewDiv || !previewText) return;
  
  previewDiv.style.display = 'block';
  previewText.textContent = 'Chargement de l\'aperçu...';
  
  try {
    const response = await api('/api/admin/filtered-data/preview', {
      method: 'POST',
      body: filters
    });
    
    if (response.success) {
      const counts = response.counts || {};
      let preview = 'Aperçu des données qui seront affectées:\n\n';
      
      Object.keys(counts).forEach(type => {
        const count = counts[type] || 0;
        preview += `• ${type}: ${count} enregistrement(s)\n`;
      });
      
      previewText.textContent = preview;
    } else {
      previewText.textContent = 'Erreur lors de l\'aperçu: ' + (response.error || 'Erreur inconnue');
    }
  } catch (error) {
    console.error('Erreur aperçu:', error);
    previewText.textContent = 'Erreur lors de l\'aperçu: ' + error.message;
  }
}

// Exporter les données filtrées
window.exportFilteredData = async function() {
  const filters = getSelectedFilters();
  
  if (!confirm(`Voulez-vous exporter les données selon les critères sélectionnés ?\n\nTypes: ${filters.dataTypes.join(', ')}\n${filters.startDate ? `Période: ${filters.startDate} à ${filters.endDate || 'aujourd\'hui'}` : 'Période: Toutes'}\n${filters.projects ? `Projets: ${filters.projects.join(', ')}` : 'Projets: Tous'}\n${filters.agentIds ? `Agents: ${filters.agentIds.length} sélectionné(s)` : 'Agents: Tous'}`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/admin/filtered-data/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + jwt
      },
      body: JSON.stringify(filters)
    });
    
    if (!response.ok) {
      throw new Error('Erreur lors de l\'export');
    }
    
    // Télécharger le fichier
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_donnees_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    alert('✅ Export réussi ! Le fichier a été téléchargé.');
    closeFilteredDataModal();
  } catch (error) {
    console.error('Erreur export:', error);
    alert('❌ Erreur lors de l\'export: ' + error.message);
  }
}

// Supprimer les données filtrées
window.deleteFilteredData = async function() {
  const filters = getSelectedFilters();
  
  // Aperçu avant suppression
  try {
    const previewResponse = await api('/api/admin/filtered-data/preview', {
      method: 'POST',
      body: filters
    });
    
    if (previewResponse.success) {
      const counts = previewResponse.counts || {};
      let totalCount = 0;
      let details = '';
      
      Object.keys(counts).forEach(type => {
        const count = counts[type] || 0;
        totalCount += count;
        if (count > 0) {
          details += `\n• ${type}: ${count} enregistrement(s)`;
        }
      });
      
      if (totalCount === 0) {
        alert('Aucune donnée ne correspond aux critères sélectionnés.');
        return;
      }
      
      const confirmMessage = `⚠️ ATTENTION ⚠️\n\nVous êtes sur le point de supprimer ${totalCount} enregistrement(s) :${details}\n\nCette action est IRRÉVERSIBLE !\n\nÊtes-vous ABSOLUMENT SÛR de vouloir continuer ?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // Double confirmation
      if (!confirm('Dernière chance ! Cette suppression est définitive. Continuer ?')) {
        return;
      }
    }
  } catch (error) {
    console.error('Erreur aperçu avant suppression:', error);
    if (!confirm('Impossible de prévisualiser les données. Voulez-vous quand même procéder à la suppression ?\n\n⚠️ Cette action est IRRÉVERSIBLE !')) {
      return;
    }
  }
  
  try {
    const response = await api('/api/admin/filtered-data/delete', {
      method: 'POST',
      body: filters
    });
    
    if (response.success) {
      const deleted = response.deleted || {};
      let message = '✅ Suppression réussie !\n\nDonnées supprimées :\n';
      
      Object.keys(deleted).forEach(type => {
        const count = deleted[type] || 0;
        if (count > 0) {
          message += `• ${type}: ${count} enregistrement(s)\n`;
        }
      });
      
      alert(message);
      closeFilteredDataModal();
      
      // Recharger les stats
      await loadAdminStats();
    } else {
      alert('❌ Erreur lors de la suppression: ' + (response.error || 'Erreur inconnue'));
    }
  } catch (error) {
    console.error('Erreur suppression:', error);
    alert('❌ Erreur lors de la suppression: ' + error.message);
  }
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
// Version simplifiée : pas de tentatives multiples, juste une vérification
document.addEventListener('DOMContentLoaded', async () => {
  // Désactiver toute restauration automatique de session sur cette page
  if (window.sessionManager) {
    // Arrêter le rafraîchissement automatique s'il est en cours
    if (window.sessionManager.refreshTimer) {
      clearInterval(window.sessionManager.refreshTimer);
      window.sessionManager.refreshTimer = null;
      console.log('🔒 Page admin - Rafraîchissement automatique arrêté');
    }
    // Ne pas initier de restauration automatique
    console.log('🔒 Page admin - Restauration automatique désactivée');
  }
  
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    // checkAuth() a déjà géré la déconnexion et redirection
    return;
  }
  
  // Si authentifié, charger les données une seule fois
  try {
    await Promise.all([
      loadAdminStats(),
      updateNavbar(),
      loadFilterProjects(),
      loadFilterAgents()
    ]);
    
    // Gestion du formulaire d'unité
    const unitForm = $('unit-form');
    if (unitForm) {
      unitForm.addEventListener('submit', handleUnitForm);
    }
  } catch (error) {
    console.error('Erreur initialisation admin:', error);
    // En cas d'erreur, déconnecter pour éviter les boucles
    localStorage.clear();
    if (window.sessionManager) {
      window.sessionManager.clearSession();
    }
    window.location.replace('/index.html');
  }
});
