// Script pour la page de profil
let jwt = localStorage.getItem('jwt') || '';

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
    // Ne pas supprimer le token ni rediriger ici
    throw new Error(errorText || res.statusText);
  }
  
  const ct = res.headers.get('content-type') || '';
  const result = ct.includes('application/json') ? await res.json() : await res.text();
  console.log('API result:', result);
  return result;
}

// Vérifier l'authentification
async function checkAuth() {
  // Mode souple: tenter avec jwt; pas de redirection forcée
  if (!jwt) return true;
  try {
    const email = (new URLSearchParams(window.location.search)).get('email') || localStorage.getItem('userEmail');
    if (email) {
      await api('/profile?email=' + encodeURIComponent(email));
    } else {
      await api('/profile');
    }
    return true;
  } catch (error) {
    console.warn('checkAuth: profil non disponible, continuer en mode limité');
    return true;
  }
}

// Charger les informations du profil
async function loadProfile() {
  try {
    const email = (new URLSearchParams(window.location.search)).get('email') || localStorage.getItem('userEmail');
    const profile = email ? await api('/profile?email=' + encodeURIComponent(email)) : await api('/profile');
    
    // Afficher les informations
    $('profile-name').textContent = profile.name || 'Non défini';
    $('profile-email').textContent = profile.email || 'Non défini';
    $('profile-role').textContent = getRoleText(profile.role);
    $('profile-role').className = `role-badge role-${profile.role}`;
    
    // Date de création (simulée)
    $('profile-created').textContent = new Date().toLocaleDateString('fr-FR');
    
    // Charger les statistiques
    await loadStatistics();
    
  } catch (error) {
    console.error('Erreur lors du chargement du profil:', error);
    // Afficher un message non bloquant
    const nameEl = $('profile-name');
    if (nameEl) nameEl.textContent = 'Profil indisponible';
  }
}

// Charger les statistiques
async function loadStatistics() {
  try {
    // Simuler des statistiques (à remplacer par de vraies données API)
    const stats = {
      totalDays: Math.floor(Math.random() * 30) + 1,
      totalHours: Math.floor(Math.random() * 200) + 50,
      attendanceRate: Math.floor(Math.random() * 30) + 70,
      currentMission: Math.random() > 0.5 ? 'Mission active' : 'Aucune mission'
    };
    
    $('total-days').textContent = stats.totalDays;
    $('total-hours').textContent = stats.totalHours + 'h';
    $('attendance-rate').textContent = stats.attendanceRate + '%';
    $('current-mission').textContent = stats.currentMission;
    
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error);
  }
}

// Obtenir le texte du rôle
function getRoleText(role) {
  const roleTexts = {
    'admin': 'Administrateur',
    'supervisor': 'Superviseur',
    'agent': 'Agent'
  };
  return roleTexts[role] || role;
}

// Changer la photo de profil
function changeAvatar() {
  alert('Fonctionnalité de changement de photo à implémenter');
}

// Changer le mot de passe
async function changePassword() {
  const currentPassword = $('current-password').value;
  const newPassword = $('new-password').value;
  const confirmPassword = $('confirm-password').value;
  
  if (newPassword !== confirmPassword) {
    alert('Les nouveaux mots de passe ne correspondent pas');
    return;
  }
  
  if (newPassword.length < 6) {
    alert('Le nouveau mot de passe doit contenir au moins 6 caractères');
    return;
  }
  
  try {
    // À implémenter : API pour changer le mot de passe
    alert('Fonctionnalité de changement de mot de passe à implémenter');
    
    // Réinitialiser le formulaire
    $('password-form').reset();
    
  } catch (error) {
    alert('Erreur lors du changement du mot de passe: ' + error.message);
  }
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
  
  if (jwt) {
    try {
      const profile = await api('/profile');
      
      // Afficher le profil pour tous les utilisateurs connectés
      if (profileLink) profileLink.style.display = 'flex';
      
      // Navigation pour Admin et Superviseur
      if (profile && (profile.role === 'admin' || profile.role === 'superviseur')) {
        if (dashboardLink) dashboardLink.style.display = 'flex';
        if (agentsLink) agentsLink.style.display = 'flex';
        if (reportsLink) reportsLink.style.display = 'flex';
      } else {
        if (dashboardLink) dashboardLink.style.display = 'none';
        if (agentsLink) agentsLink.style.display = 'none';
        if (reportsLink) reportsLink.style.display = 'none';
      }
      
      // Navigation pour Admin uniquement
      if (profile && profile.role === 'admin') {
        if (adminLink) adminLink.style.display = 'flex';
      } else {
        if (adminLink) adminLink.style.display = 'none';
      }
      
      // Afficher les informations utilisateur
      if (navbarUser) navbarUser.style.display = 'flex';
      if (userInfo && profile) {
        const roleText = {
          'admin': 'Administrateur',
          'superviseur': 'Superviseur',
          'agent': 'Agent'
        };
        userInfo.textContent = `${profile.name} (${roleText[profile.role] || profile.role})`;
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la navbar:', error);
    }
  }
}

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await checkAuth();
  if (isAuthenticated) {
    await loadProfile();
    await updateNavbar();
    
    // Gestion du formulaire de changement de mot de passe
    $('password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await changePassword();
    });
  }
});
