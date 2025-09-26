// Script pour la page de profil
let jwt = localStorage.getItem('jwt') || '';

function $(id) { return document.getElementById(id); }

function setAvatarFromCache() {
  try {
    const img = $('profile-avatar');
    if (!img) return;
    const cachedProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const cachedLogin = JSON.parse(localStorage.getItem('loginData') || '{}');
    const url = cachedProfile.photo_url || cachedProfile.photo_path || cachedLogin.photo_url || '';
    if (url && typeof url === 'string') {
      const busted = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
      img.src = busted;
    }
  } catch {}
}

// Configuration de l'API - utiliser Render en production sur Vercel
const onVercel = /\.vercel\.app$/.test(window.location.hostname) || window.location.hostname.includes('vercel.app');
const apiBase = '/api';

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
  
  console.log('API call:', apiBase + path, { method: opts.method || 'GET', headers, body: opts.body });
  
  let res = await fetch(apiBase + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body instanceof FormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  
  console.log('API response:', res.status, res.statusText);
  
  if (!res.ok) {
    // Retry logique pour /profile sans token: fallback via email si disponible
    if ((res.status === 401 || res.status === 404) && path === '/profile') {
      try {
        const email = (new URLSearchParams(window.location.search)).get('email') || localStorage.getItem('userEmail');
        if (email) {
          res = await fetch(apiBase + '/profile?email=' + encodeURIComponent(email));
          console.log('API response (retry via email):', res.status, res.statusText);
        }
      } catch {}
    }
    if (!res.ok) {
      const errorText = await res.text();
      console.error('API error:', errorText);
      throw new Error(errorText || res.statusText);
    }
  }
  
  const ct = res.headers.get('content-type') || '';
  const result = ct.includes('application/json') ? await res.json() : await res.text();
  console.log('API result:', result);
  // Normaliser les réponses { user: {...} }
  if (result && typeof result === 'object' && 'user' in result) {
    return result.user;
  }
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
    const email = (new URLSearchParams(window.location.search)).get('email') || 
                  localStorage.getItem('userEmail') || 
                  localStorage.getItem('lastUserEmail') ||
                  'ntchaostelle4@gmail.com'; // Email par défaut pour le test
    let profile = email ? await api('/profile?email=' + encodeURIComponent(email)) : await api('/profile');
    // Fallback depuis le cache local si certains champs manquent
    try {
      const cached = JSON.parse(localStorage.getItem('loginData') || '{}');
      const cachedProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      if (profile && typeof profile === 'object') {
        if (!profile.name) {
          const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
          profile.name = fullName || cached.name || profile.name || 'Utilisateur';
        }
        if (!profile.email) profile.email = cached.email || email || profile.email;
        if (!profile.role) profile.role = cached.role || profile.role || 'agent';
        if (!profile.photo_url && !profile.photo_path) {
          profile.photo_url = cachedProfile.photo_url || cachedProfile.photo_path || '';
        }
      }
    } catch {}
    
    // Afficher les informations
    $('profile-name').textContent = profile.name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Non défini';
    $('profile-email').textContent = profile.email || 'Non défini';
    $('profile-role').textContent = getRoleText(profile.role);
    $('profile-role').className = `role-badge role-${profile.role}`;
    if (profile.photo_url || profile.photo_path) {
      const img = $('profile-avatar');
      if (img) img.src = (profile.photo_url || profile.photo_path) + ((profile.photo_url || profile.photo_path).includes('?') ? '&' : '?') + 'v=' + Date.now();
    }

    // Préremplir le formulaire d'édition
    try {
      $('edit-first-name').value = profile.first_name || '';
      $('edit-last-name').value = profile.last_name || '';
      $('edit-phone').value = profile.phone || '';
      $('edit-project').value = profile.project_name || profile.adminUnit || '';
      $('edit-departement').value = profile.departement || '';
      $('edit-commune').value = profile.commune || '';
      $('edit-arrondissement').value = profile.arrondissement || '';
      $('edit-village').value = profile.village || '';
      if (profile.reference_lat) $('edit-ref-lat').value = profile.reference_lat;
      if (profile.reference_lon) $('edit-ref-lon').value = profile.reference_lon;
      if (profile.tolerance_radius_meters) $('edit-tolerance').value = profile.tolerance_radius_meters;
      if (profile.planning_start_date) $('edit-plan-start').value = profile.planning_start_date;
      if (profile.planning_end_date) $('edit-plan-end').value = profile.planning_end_date;
      if (profile.expected_days_per_month) $('edit-exp-days').value = profile.expected_days_per_month;
      if (profile.expected_hours_per_month) $('edit-exp-hours').value = profile.expected_hours_per_month;
    } catch {}
    
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
    // Stats réelles via API; par défaut: 0 pour un nouvel agent
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const email = (new URLSearchParams(window.location.search)).get('email') || localStorage.getItem('userEmail');
    let response = null;
    try {
      response = await api(`/presence/stats?year=${year}&month=${month}&email=${encodeURIComponent(email || '')}`);
    } catch {}
    const apiStats = response && response.success ? (response.stats || {}) : {};
    const totalDays = Number(apiStats.days_worked) || 0;
    const totalHours = Number(apiStats.hours_worked) || 0;
    const expectedDays = Number(apiStats.expected_days) || 22;
    const attendanceRate = expectedDays > 0 ? Math.min(100, Math.round((totalDays / expectedDays) * 100)) : 0;
    const currentMission = apiStats.current_position ? 'Mission active' : 'Aucune mission';

    $('total-days').textContent = totalDays;
    $('total-hours').textContent = totalHours + 'h';
    $('attendance-rate').textContent = attendanceRate + '%';
    $('current-mission').textContent = currentMission;
    
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error);
    // Fallback: afficher 0 partout pour les nouveaux agents
    $('total-days').textContent = 0;
    $('total-hours').textContent = '0h';
    $('attendance-rate').textContent = '0%';
    $('current-mission').textContent = 'Aucune mission';
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
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result;
          const base64 = (dataUrl || '').toString().split(',')[1];
          const resp = await api('/profile/photo', { method: 'POST', body: { photo_base64: base64 } });
          if (resp && resp.photo_url) {
            // Précharger et mettre à jour l'avatar avec cache-busting pour éviter le cache
            const img = $('profile-avatar');
            const newUrl = `${resp.photo_url}${resp.photo_url.includes('?') ? '&' : '?'}v=${Date.now()}`;
            if (img) {
              img.style.visibility = 'hidden';
              const pre = new Image();
              pre.onload = () => {
                img.src = newUrl;
                img.style.visibility = 'visible';
              };
              pre.onerror = () => {
                img.src = newUrl;
                img.style.visibility = 'visible';
              };
              pre.src = newUrl;
            }
            // Mettre aussi à jour l'avatar du tableau de bord si présent
            try {
              const dashImg = document.getElementById('agent-avatar');
              if (dashImg) {
                const dashUrl = `${resp.photo_url}${resp.photo_url.includes('?') ? '&' : '?'}v=${Date.now()}`;
                dashImg.src = dashUrl;
              }
            } catch {}
            // Sauvegarder dans userProfile cache
            try {
              const cachedProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
              cachedProfile.photo_url = resp.photo_url;
              cachedProfile.photo_path = resp.photo_url;
              localStorage.setItem('userProfile', JSON.stringify(cachedProfile));
            } catch {}
            // Mettre à jour le profil côté serveur (si dispo)
            try { await api('/me/profile', { method: 'POST', body: { photo_path: resp.photo_url } }); } catch {}
            alert('Photo de profil mise à jour');
          }
        } catch (err) {
          alert('Erreur lors de l\'envoi de la photo: ' + (err.message || ''));
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Erreur: ' + (err.message || ''));
    }
  };
  input.click();
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
  // Afficher immédiatement l'avatar depuis le cache si disponible
  setAvatarFromCache();
  const isAuthenticated = await checkAuth();
  if (isAuthenticated) {
    await loadProfile();
    try { await updateNavbar(); } catch {}
    
    // Gestion du formulaire de changement de mot de passe
    $('password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await changePassword();
    });

    // Gestion de l'enregistrement du profil (auto-service)
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const payload = {
            first_name: $('edit-first-name')?.value?.trim() || null,
            last_name: $('edit-last-name')?.value?.trim() || null,
            phone: $('edit-phone')?.value?.trim() || null,
            project_name: $('edit-project')?.value?.trim() || null,
            departement: $('edit-departement')?.value?.trim() || null,
            commune: $('edit-commune')?.value?.trim() || null,
            arrondissement: $('edit-arrondissement')?.value?.trim() || null,
            village: $('edit-village')?.value?.trim() || null,
            reference_lat: $('edit-ref-lat')?.value ? Number($('edit-ref-lat').value) : null,
            reference_lon: $('edit-ref-lon')?.value ? Number($('edit-ref-lon').value) : null,
            tolerance_radius_meters: $('edit-tolerance')?.value ? Number($('edit-tolerance').value) : null,
            planning_start_date: $('edit-plan-start')?.value || null,
            planning_end_date: $('edit-plan-end')?.value || null,
            expected_days_per_month: $('edit-exp-days')?.value ? Number($('edit-exp-days').value) : null,
            expected_hours_per_month: $('edit-exp-hours')?.value ? Number($('edit-exp-hours').value) : null
          };
          // Nettoyer payload (supprimer null/undefined)
          Object.keys(payload).forEach(k => (payload[k] === null || payload[k] === undefined) && delete payload[k]);
          if (Object.keys(payload).length === 0) {
            alert('Aucun changement à enregistrer');
            return;
          }
          await api('/me/profile', { method: 'POST', body: payload });
          try { localStorage.setItem('onboardingPrompted', '1'); } catch {}
          alert('Profil mis à jour');
          setTimeout(() => { window.location.href = '/'; }, 300);
        } catch (err) {
          alert('Erreur lors de la mise à jour: ' + (err.message || ''));
        }
      });
    }
    const cancelBtn = document.getElementById('cancel-profile-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        await loadProfile();
      });
    }
  }
});
