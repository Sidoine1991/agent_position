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
// Harmoniser la déconnexion pour cette page
// Exposer un handler de déconnexion unique et global
if (typeof window !== 'undefined') {
  window.logout = function() {
    try {
      localStorage.removeItem('jwt');
      localStorage.removeItem('loginData');
      localStorage.removeItem('userProfile');
      localStorage.setItem('presence_update', JSON.stringify({ type: 'logout', ts: Date.now() }));
    } catch {}
    // Toujours rester cohérent: retour à l'accueil sans vider tout le storage
    window.location.href = '/';
  };
}

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
                 '';
    let profile = email ? await api('/profile?email=' + encodeURIComponent(email)) : await api('/profile');
    // Fusionner les champs imbriqués user.profile au premier niveau si présents
    try { if (profile && profile.profile && typeof profile.profile === 'object') { profile = { ...profile, ...profile.profile }; } } catch {}
    // Fallback depuis le cache local si certains champs manquent
    // Mode strict: ne pas fusionner avec le cache; n'afficher que ce que renvoie l'API
    try { localStorage.setItem('userProfile', JSON.stringify(profile)); } catch {}
    
    // Afficher les informations personnelles
    $('profile-name').textContent = profile.name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Non défini';
    $('profile-email').textContent = profile.email || 'Non défini';
    $('profile-role').textContent = getRoleText(profile.role);
    $('profile-role').className = `role-badge role-${profile.role}`;
    $('profile-phone').textContent = profile.phone || '—';
    
    // Afficher les informations professionnelles
    $('profile-departement').textContent = profile.departement || '—';
    $('profile-commune').textContent = profile.commune || '—';
    $('profile-arrondissement').textContent = profile.arrondissement || '—';
    $('profile-village').textContent = profile.village || '—';
    $('profile-project').textContent = profile.project_name || '—';
    
    // Afficher les informations contractuelles
    $('profile-contract-start').textContent = profile.contract_start_date ? new Date(profile.contract_start_date).toLocaleDateString('fr-FR') : '—';
    $('profile-contract-end').textContent = profile.contract_end_date ? new Date(profile.contract_end_date).toLocaleDateString('fr-FR') : '—';
    $('profile-years-service').textContent = profile.years_of_service ? `${profile.years_of_service} ans` : '—';
    
    // Afficher les paramètres de planification
    $('profile-expected-days').textContent = profile.expected_days_per_month ? `${profile.expected_days_per_month} jours` : '—';
    $('profile-expected-hours').textContent = profile.expected_hours_per_month ? `${profile.expected_hours_per_month} heures` : '—';
    $('profile-planning-start').textContent = profile.planning_start_date ? new Date(profile.planning_start_date).toLocaleDateString('fr-FR') : '—';
    $('profile-planning-end').textContent = profile.planning_end_date ? new Date(profile.planning_end_date).toLocaleDateString('fr-FR') : '—';
    
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
      if (profile.reference_lat) $('edit-lat').value = profile.reference_lat;
      if (profile.reference_lon) $('edit-lon').value = profile.reference_lon;
      if (profile.tolerance_radius_meters) $('edit-tolerance').value = profile.tolerance_radius_meters;
      if (profile.planning_start_date) $('edit-plan-start').value = profile.planning_start_date;
      if (profile.planning_end_date) $('edit-plan-end').value = profile.planning_end_date;
      if (profile.expected_days_per_month) $('edit-exp-days').value = profile.expected_days_per_month;
      if (profile.expected_hours_per_month) $('edit-exp-hours').value = profile.expected_hours_per_month;
    } catch {}
    
    // Date d'inscription (depuis la table users)
    try {
      const created = profile.created_at || profile.createdAt || profile.created || null;
      if (created) {
        const d = new Date(created);
        $('profile-created').textContent = isNaN(d.getTime()) ? String(created) : d.toLocaleDateString('fr-FR');
      }
    } catch {}
    
    // Charger les statistiques
    await loadStatistics();

    // Calculer la complétion du profil sur la base des colonnes de la table users
    try {
      const fields = {
        // Informations personnelles (obligatoires)
        first_name: !!profile.first_name,
        last_name: !!profile.last_name,
        phone: !!profile.phone,
        
        // Localisation (optionnelles)
        departement: !!profile.departement,
        commune: !!profile.commune,
        arrondissement: !!profile.arrondissement,
        village: !!profile.village,
        
        // Projet et contrat (optionnelles)
        project_name: !!profile.project_name,
        contract_start_date: !!profile.contract_start_date,
        contract_end_date: !!profile.contract_end_date,
        years_of_service: profile.years_of_service !== null && profile.years_of_service !== undefined && profile.years_of_service > 0,
        
        // Paramètres GPS (optionnelles)
        reference_lat: profile.reference_lat !== null && profile.reference_lat !== undefined,
        reference_lon: profile.reference_lon !== null && profile.reference_lon !== undefined,
        tolerance_radius_meters: profile.tolerance_radius_meters !== null && profile.tolerance_radius_meters !== undefined,
        
        // Planification (optionnelles)
        expected_days_per_month: profile.expected_days_per_month !== null && profile.expected_days_per_month !== undefined,
        expected_hours_per_month: profile.expected_hours_per_month !== null && profile.expected_hours_per_month !== undefined,
        planning_start_date: !!profile.planning_start_date,
        planning_end_date: !!profile.planning_end_date
      };
      const total = Object.keys(fields).length;
      const filled = Object.values(fields).filter(Boolean).length;
      const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
      const bar = document.getElementById('profile-completion-bar');
      const label = document.getElementById('profile-completion-label');
      if (bar) {
        bar.style.width = pct + '%';
        bar.setAttribute('aria-valuenow', String(pct));
        bar.classList.toggle('bg-success', pct >= 80);
        bar.classList.toggle('bg-warning', pct >= 40 && pct < 80);
        bar.classList.toggle('bg-danger', pct < 40);
      }
      if (label) label.textContent = pct + '%';
    } catch {}
    
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
    console.log('📊 Chargement des statistiques...');
    
    // Stats réelles via API
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const email = (new URLSearchParams(window.location.search)).get('email') || localStorage.getItem('userEmail') || localStorage.getItem('email');
    
    console.log(`📅 Période: ${year}-${month.toString().padStart(2, '0')}, Email: ${email}`);
    
    let response = null;
    try {
      response = await api(`/presence/stats?year=${year}&month=${month}&email=${encodeURIComponent(email || '')}`);
      console.log('📊 Réponse API:', response);
    } catch (apiError) {
      console.error('❌ Erreur API stats:', apiError);
    }
    
    const apiStats = response && response.success ? (response.stats || {}) : {};
    const totalDays = Number(apiStats.days_worked) || 0;
    const totalHours = Number(apiStats.hours_worked) || 0;
    const expectedDays = Number(apiStats.expected_days) || 22;
    const attendanceRate = expectedDays > 0 ? Math.min(100, Math.round((totalDays / expectedDays) * 100)) : 0;
    const currentMission = apiStats.current_position || 'Aucune mission';

    // Mettre à jour l'affichage
    const totalDaysEl = $('total-days');
    const totalHoursEl = $('total-hours');
    const attendanceRateEl = $('attendance-rate');
    const currentMissionEl = $('current-mission');

    if (totalDaysEl) totalDaysEl.textContent = totalDays;
    if (totalHoursEl) totalHoursEl.textContent = totalHours + 'h';
    if (attendanceRateEl) attendanceRateEl.textContent = attendanceRate + '%';
    if (currentMissionEl) currentMissionEl.textContent = currentMission;
    
    console.log(`✅ Statistiques chargées: ${totalDays} jours, ${totalHours}h, ${attendanceRate}% présence`);
    
  } catch (error) {
    console.error('❌ Erreur lors du chargement des statistiques:', error);
    // Fallback: afficher 0 partout pour les nouveaux agents
    const totalDaysEl = $('total-days');
    const totalHoursEl = $('total-hours');
    const attendanceRateEl = $('attendance-rate');
    const currentMissionEl = $('current-mission');

    if (totalDaysEl) totalDaysEl.textContent = 0;
    if (totalHoursEl) totalHoursEl.textContent = '0h';
    if (attendanceRateEl) attendanceRateEl.textContent = '0%';
    if (currentMissionEl) currentMissionEl.textContent = 'Aucune mission';
  }
}

// Fonction pour configurer l'édition inline d'un champ
function setupInlineEdit(fieldName, displayId, inputId, editBtnId, saveBtnId, cancelBtnId) {
  const btnEdit = document.getElementById(editBtnId);
  const btnSave = document.getElementById(saveBtnId);
  const btnCancel = document.getElementById(cancelBtnId);
  const input = document.getElementById(inputId);
  const display = document.getElementById(displayId);
  
  if (!btnEdit || !btnSave || !btnCancel || !input || !display) {
    console.warn(`⚠️ Éléments manquants pour l'édition inline de ${fieldName}`);
    return;
  }
  
  btnEdit.addEventListener('click', () => {
    input.style.display = 'inline-block';
    btnSave.style.display = 'inline-block';
    btnCancel.style.display = 'inline-block';
    btnEdit.style.display = 'none';
    input.value = display.textContent === '—' ? '' : display.textContent;
    input.focus();
  });
  
  btnCancel.addEventListener('click', () => {
    input.style.display = 'none';
    btnSave.style.display = 'none';
    btnCancel.style.display = 'none';
    btnEdit.style.display = 'inline-block';
  });
  
  btnSave.addEventListener('click', async () => {
    const value = input.value.trim();
    try {
      await api('/me/profile', { method: 'POST', body: { [fieldName]: value || null } });
      display.textContent = value || '—';
      btnCancel.click();
      updateProfileCompletion();
    } catch (e) {
      alert(`Erreur mise à jour ${fieldName}: ` + (e.message || ''));
    }
  });
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
// (supprimé) Définition redondante de logout()

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
    
    // Gestion du bouton de changement de photo
    const changeAvatarBtn = document.getElementById('change-avatar-btn');
    if (changeAvatarBtn) {
      changeAvatarBtn.addEventListener('click', changeAvatar);
    }
    
    // Gestion du formulaire de changement de mot de passe
    $('password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await changePassword();
    });

    // Edition inline: Nom complet
    const btnEditIdentity = document.getElementById('btn-edit-identity');
    const btnSaveIdentity = document.getElementById('btn-save-identity');
    const btnCancelIdentity = document.getElementById('btn-cancel-identity');
    const editFullName = document.getElementById('edit-full-name');
    if (btnEditIdentity && btnSaveIdentity && btnCancelIdentity && editFullName) {
      btnEditIdentity.addEventListener('click', () => {
        editFullName.style.display = 'inline-block';
        btnSaveIdentity.style.display = 'inline-block';
        btnCancelIdentity.style.display = 'inline-block';
        btnEditIdentity.style.display = 'none';
        try {
          const current = document.getElementById('profile-name')?.textContent || '';
          editFullName.value = current.trim();
        } catch {}
      });
      btnCancelIdentity.addEventListener('click', () => {
        editFullName.style.display = 'none';
        btnSaveIdentity.style.display = 'none';
        btnCancelIdentity.style.display = 'none';
        btnEditIdentity.style.display = 'inline-block';
      });
      btnSaveIdentity.addEventListener('click', async () => {
        const val = (editFullName.value || '').trim();
        if (!val) { alert('Nom complet requis'); return; }
        const [first, ...rest] = val.split(' ');
        const payload = { first_name: first, last_name: rest.join(' ').trim() || null };
        try {
          await api('/me/profile', { method: 'POST', body: payload });
          document.getElementById('profile-name').textContent = val;
          btnCancelIdentity.click();
          updateProfileCompletion();
        } catch (e) {
          alert('Erreur mise à jour nom: ' + (e.message || ''));
        }
      });
    }

    // Edition inline: Téléphone
    const btnEditPhone = document.getElementById('btn-edit-phone');
    const btnSavePhone = document.getElementById('btn-save-phone');
    const btnCancelPhone = document.getElementById('btn-cancel-phone');
    const editPhoneInline = document.getElementById('edit-phone-inline');
    if (btnEditPhone && btnSavePhone && btnCancelPhone && editPhoneInline) {
      btnEditPhone.addEventListener('click', () => {
        editPhoneInline.style.display = 'inline-block';
        btnSavePhone.style.display = 'inline-block';
        btnCancelPhone.style.display = 'inline-block';
        btnEditPhone.style.display = 'none';
        try {
          editPhoneInline.value = (document.getElementById('profile-phone')?.textContent || '').trim();
        } catch {}
      });
      btnCancelPhone.addEventListener('click', () => {
        editPhoneInline.style.display = 'none';
        btnSavePhone.style.display = 'none';
        btnCancelPhone.style.display = 'none';
        btnEditPhone.style.display = 'inline-block';
      });
      btnSavePhone.addEventListener('click', async () => {
        const phone = (editPhoneInline.value || '').trim();
        if (!phone) { alert('Téléphone requis'); return; }
        try {
          await api('/me/profile', { method: 'POST', body: { phone } });
          document.getElementById('profile-phone').textContent = phone;
          btnCancelPhone.click();
          updateProfileCompletion();
        } catch (e) {
          alert('Erreur mise à jour téléphone: ' + (e.message || ''));
        }
      });
    }

    // Sauvegarde dédiée Paramètres GPS
    const btnSaveGps = document.getElementById('btn-save-gps');
    const btnCancelGps = document.getElementById('btn-cancel-gps');
    if (btnSaveGps) {
      btnSaveGps.addEventListener('click', async () => {
        const latStr = $('edit-lat')?.value;
        const lonStr = $('edit-lon')?.value;
        const tolStr = $('edit-tolerance')?.value;
        const lat = latStr ? Number(latStr) : NaN;
        const lon = lonStr ? Number(lonStr) : NaN;
        const tol = tolStr ? Number(tolStr) : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(tol)) {
          alert('Veuillez renseigner une latitude, une longitude et un rayon valides.');
          return;
        }
        try {
          await api('/me/profile', { method: 'POST', body: { reference_lat: lat, reference_lon: lon, tolerance_radius_meters: tol } });
          alert('Paramètres GPS enregistrés');
          updateProfileCompletion();
        } catch (e) {
          alert('Erreur enregistrement GPS: ' + (e.message || ''));
        }
      });
    }
    if (btnCancelGps) {
      btnCancelGps.addEventListener('click', async () => { await loadProfile(); });
    }

    // Gestionnaires pour les nouveaux champs d'édition inline
    setupInlineEdit('departement', 'profile-departement', 'edit-departement-inline', 'btn-edit-departement', 'btn-save-departement', 'btn-cancel-departement');
    setupInlineEdit('commune', 'profile-commune', 'edit-commune-inline', 'btn-edit-commune', 'btn-save-commune', 'btn-cancel-commune');
    setupInlineEdit('arrondissement', 'profile-arrondissement', 'edit-arrondissement-inline', 'btn-edit-arrondissement', 'btn-save-arrondissement', 'btn-cancel-arrondissement');
    setupInlineEdit('village', 'profile-village', 'edit-village-inline', 'btn-edit-village', 'btn-save-village', 'btn-cancel-village');
    setupInlineEdit('project_name', 'profile-project', 'edit-project-inline', 'btn-edit-project', 'btn-save-project', 'btn-cancel-project');

    // Gestionnaires pour les sections contractuelles et de planification
    const btnSaveContract = document.getElementById('btn-save-contract');
    const btnCancelContract = document.getElementById('btn-cancel-contract');
    if (btnSaveContract) {
      btnSaveContract.addEventListener('click', async () => {
        try {
          const payload = {
            contract_start_date: $('edit-contract-start')?.value || null,
            contract_end_date: $('edit-contract-end')?.value || null,
            years_of_service: $('edit-years-service')?.value ? Number($('edit-years-service').value) : null
          };
          await api('/me/profile', { method: 'POST', body: payload });
          alert('Informations contractuelles enregistrées');
          await loadProfile();
          updateProfileCompletion();
        } catch (e) {
          alert('Erreur enregistrement contrat: ' + (e.message || ''));
        }
      });
    }
    if (btnCancelContract) {
      btnCancelContract.addEventListener('click', async () => { await loadProfile(); });
    }

    const btnSavePlanning = document.getElementById('btn-save-planning');
    const btnCancelPlanning = document.getElementById('btn-cancel-planning');
    if (btnSavePlanning) {
      btnSavePlanning.addEventListener('click', async () => {
        try {
          const payload = {
            expected_days_per_month: $('edit-exp-days')?.value ? Number($('edit-exp-days').value) : null,
            expected_hours_per_month: $('edit-exp-hours')?.value ? Number($('edit-exp-hours').value) : null,
            planning_start_date: $('edit-plan-start')?.value || null,
            planning_end_date: $('edit-plan-end')?.value || null
          };
          await api('/me/profile', { method: 'POST', body: payload });
          alert('Paramètres de planification enregistrés');
          await loadProfile();
          updateProfileCompletion();
        } catch (e) {
          alert('Erreur enregistrement planification: ' + (e.message || ''));
        }
      });
    }
    if (btnCancelPlanning) {
      btnCancelPlanning.addEventListener('click', async () => { await loadProfile(); });
    }

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
            reference_lat: $('edit-lat')?.value ? Number($('edit-lat').value) : null,
            reference_lon: $('edit-lon')?.value ? Number($('edit-lon').value) : null,
            tolerance_radius_meters: $('edit-tolerance')?.value ? Number($('edit-tolerance').value) : null,
            contract_start_date: $('edit-contract-start')?.value || null,
            contract_end_date: $('edit-contract-end')?.value || null,
            years_of_service: $('edit-years-service')?.value ? Number($('edit-years-service').value) : null,
            expected_days_per_month: $('edit-exp-days')?.value ? Number($('edit-exp-days').value) : null,
            expected_hours_per_month: $('edit-exp-hours')?.value ? Number($('edit-exp-hours').value) : null
          };
          // Validation obligatoire: référence et rayon
          const latOk = typeof payload.reference_lat === 'number' && !Number.isNaN(payload.reference_lat);
          const lonOk = typeof payload.reference_lon === 'number' && !Number.isNaN(payload.reference_lon);
          const tolOk = typeof payload.tolerance_radius_meters === 'number' && !Number.isNaN(payload.tolerance_radius_meters);
          if (!latOk || !lonOk || !tolOk) {
            alert('Latitude, longitude de référence et rayon de tolérance sont requis.');
            return;
          }
          // Nettoyer payload (supprimer null/undefined)
          Object.keys(payload).forEach(k => (payload[k] === null || payload[k] === undefined) && delete payload[k]);
          if (Object.keys(payload).length === 0) {
            alert('Aucun changement à enregistrer');
            return;
          }
          await api('/me/profile', { method: 'POST', body: payload });
          try { localStorage.setItem('onboardingPrompted', '1'); } catch {}
          alert('Profil mis à jour');
          await loadProfile();
          // Recalculer le pourcentage de complétion après la mise à jour
          updateProfileCompletion();
          // Rafraîchir les statistiques
          await loadStatistics();
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
    
    // Ajouter des événements pour recalculer la complétion en temps réel
    const formFields = [
      'edit-first-name', 'edit-last-name', 'edit-phone',
      'edit-departement', 'edit-commune', 'edit-arrondissement', 'edit-village',
      'edit-project', 'edit-contract-start', 'edit-contract-end', 'edit-years-service',
      'edit-lat', 'edit-lon', 'edit-tolerance',
      'edit-exp-days', 'edit-exp-hours', 'edit-plan-start', 'edit-plan-end',
      'edit-departement-inline', 'edit-commune-inline', 'edit-arrondissement-inline', 
      'edit-village-inline', 'edit-project-inline'
    ];
    
    formFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('input', updateProfileCompletion);
        field.addEventListener('change', updateProfileCompletion);
      }
    });
  }
});

// Fonction pour recalculer le pourcentage de complétion du profil
function updateProfileCompletion() {
  try {
    // Récupérer les valeurs actuelles des champs de formulaire
    const fields = {
      // Informations personnelles (obligatoires)
      first_name: !!($('edit-first-name')?.value?.trim()),
      last_name: !!($('edit-last-name')?.value?.trim()),
      phone: !!($('edit-phone')?.value?.trim()),
      
      // Localisation (optionnelles)
      departement: !!($('edit-departement')?.value?.trim()) || !!($('edit-departement-inline')?.value?.trim()),
      commune: !!($('edit-commune')?.value?.trim()) || !!($('edit-commune-inline')?.value?.trim()),
      arrondissement: !!($('edit-arrondissement')?.value?.trim()) || !!($('edit-arrondissement-inline')?.value?.trim()),
      village: !!($('edit-village')?.value?.trim()) || !!($('edit-village-inline')?.value?.trim()),
      
      // Projet et contrat (optionnelles)
      project_name: !!($('edit-project')?.value?.trim()) || !!($('edit-project-inline')?.value?.trim()),
      contract_start_date: !!($('edit-contract-start')?.value),
      contract_end_date: !!($('edit-contract-end')?.value),
      years_of_service: !!($('edit-years-service')?.value) && Number($('edit-years-service').value) > 0,
      
      // Paramètres GPS (optionnelles)
      reference_lat: !!($('edit-lat')?.value) && !isNaN(Number($('edit-lat').value)),
      reference_lon: !!($('edit-lon')?.value) && !isNaN(Number($('edit-lon').value)),
      tolerance_radius_meters: !!($('edit-tolerance')?.value) && !isNaN(Number($('edit-tolerance').value)),
      
      // Planification (optionnelles)
      expected_days_per_month: !!($('edit-exp-days')?.value) && !isNaN(Number($('edit-exp-days').value)),
      expected_hours_per_month: !!($('edit-exp-hours')?.value) && !isNaN(Number($('edit-exp-hours').value))
    };
    
    const total = Object.keys(fields).length;
    const filled = Object.values(fields).filter(Boolean).length;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    
    // Mettre à jour l'affichage
    const bar = document.getElementById('profile-completion-bar');
    const label = document.getElementById('profile-completion-label');
    
    if (bar) {
      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', String(pct));
      bar.classList.toggle('bg-success', pct >= 80);
      bar.classList.toggle('bg-warning', pct >= 40 && pct < 80);
      bar.classList.toggle('bg-danger', pct < 40);
    }
    
    if (label) {
      label.textContent = pct + '%';
    }
    
    console.log(`📊 Complétion du profil mise à jour: ${pct}% (${filled}/${total} champs remplis)`);
    
  } catch (error) {
    console.error('Erreur lors du calcul de complétion:', error);
  }
}
