// Configuration de l'API - utiliser Render en production sur Vercel
const onVercel = /\.vercel\.app$/.test(window.location.hostname) || window.location.hostname.includes('vercel.app');
const apiBase = onVercel
    ? 'https://presence-ccrb-v2.onrender.com/api'
    : '/api';
let jwt = localStorage.getItem('jwt') || '';
let currentMissionId = null;
let currentCalendarDate = new Date();
let presenceData = {};
let appSettings = null;

function clearCachedUserData() {
  try {
    localStorage.removeItem('loginData');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('lastGPS');
  } catch {}
  try { presenceData = {}; } catch {}
}

function isProfileComplete(profile) {
  if (!profile) return false;
  const requiredFields = [
    'phone',
    'project_name',
    'planning_start_date',
    'planning_end_date',
    'expected_days_per_month',
    'expected_hours_per_month'
  ];
  for (const key of requiredFields) {
    if (profile[key] === undefined || profile[key] === null || String(profile[key]).trim() === '') {
      return false;
    }
  }
  return true;
}

function $(id) { return document.getElementById(id); }
function show(el) { 
  if (el && el.classList) {
    el.classList.remove('hidden'); 
  }
}
function hide(el) { 
  if (el && el.classList) {
    el.classList.add('hidden'); 
  }
}

// Fonctions d'animation et d'effets visuels
function addLoadingState(element, text = 'Chargement...') {
  if (!element) return;
  
  element.classList.add('btn-loading');
  element.disabled = true;
  element.setAttribute('data-original-text', element.textContent);
  element.textContent = text;
}

function removeLoadingState(element) {
  if (!element) return;
  
  element.classList.remove('btn-loading');
  element.disabled = false;
  const originalText = element.getAttribute('data-original-text');
  if (originalText) {
    element.textContent = originalText;
    element.removeAttribute('data-original-text');
  }
}

// Fonction pour afficher des notifications toast
function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideInRight 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

function createRippleEffect(event) {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  
  const ripple = document.createElement('span');
  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    transform: scale(0);
    animation: ripple 0.6s linear;
    pointer-events: none;
  `;
  
  button.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

function animateElement(element, animation, duration = 300) {
  element.style.animation = `${animation} ${duration}ms ease-out`;
  setTimeout(() => {
    element.style.animation = '';
  }, duration);
}

function addScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'fadeIn 0.6s ease-out';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.card, .form-group, .list-item').forEach(el => {
    observer.observe(el);
  });
}

// Bootstrap: appliquer des classes aux éléments existants sans casser le markup
function applyBootstrapEnhancements() {
  try {
    const main = document.querySelector('.main-content');
    if (main) main.classList.add('container', 'py-3');
    const nav = document.querySelector('nav.navbar');
    if (nav) {
      nav.classList.add('navbar', 'navbar-expand-lg', 'bg-light', 'border-bottom');
      const nb = nav.querySelector('.navbar-brand');
      if (nb) nb.classList.add('d-flex', 'align-items-center', 'gap-2');
    }
    document.querySelectorAll('.admin-actions, .actions, .btn-group-inline').forEach(el => el.classList.add('d-flex', 'gap-2', 'flex-wrap', 'mb-3'));
    document.querySelectorAll('.btn-primary').forEach(b => b.classList.add('btn', 'btn-primary'));
    document.querySelectorAll('.btn-secondary').forEach(b => b.classList.add('btn', 'btn-outline-secondary'));
    document.querySelectorAll('.btn-danger').forEach(b => b.classList.add('btn', 'btn-danger'));
    document.querySelectorAll('table').forEach(t => t.classList.add('table', 'table-striped', 'table-hover'));
    document.querySelectorAll('.card').forEach(c => c.classList.add('card', 'shadow-sm'));
    document.querySelectorAll('.card h2, .card h3').forEach(h => h.classList.add('card-title'));
    // Form inputs
    document.querySelectorAll('input, select, textarea').forEach(i => {
      if (!['checkbox', 'radio', 'file'].includes(i.type)) i.classList.add('form-control');
    });
    document.querySelectorAll('label').forEach(l => l.classList.add('form-label'));
  } catch (e) { console.warn('Bootstrap enhance failed:', e); }
}

// Fonction pour initialiser l'image hero
function initHeroImage() {
  console.log('🖼️ Initialisation de l\'image hero...');
  
  const heroImage = document.querySelector('.hero-image');
  if (heroImage) {
    // Précharger l'image
    const img = new Image();
    img.onload = () => {
      console.log('✅ Image hero chargée avec succès');
      heroImage.classList.add('loaded');
    };
    img.onerror = () => {
      console.warn('❌ Erreur de chargement de l\'image hero');
    };
    img.src = heroImage.src;
  }
}

async function api(path, opts={}) {
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
  
  if (res.status === 401) {
    // Ne pas supprimer le token automatiquement pour éviter les blocages cross-page
    console.warn('401 détecté: accès non autorisé');
    throw new Error(JSON.stringify({ success:false, unauthorized:true, message: "Accès non autorisé" }));
  }
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

function geoPromise() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      p => resolve(p.coords), 
      e => {
        console.warn('Erreur GPS:', e);
        // En cas d'erreur, essayer avec des paramètres plus permissifs
        navigator.geolocation.getCurrentPosition(
          p => resolve(p.coords),
          e2 => reject(new Error(`GPS indisponible: ${e2.message}`)),
          { 
            enableHighAccuracy: false,
            timeout: 60000, // 60 secondes
            maximumAge: 300000 // 5 minutes de cache
          }
        );
      }, 
      { 
        enableHighAccuracy: true, // Essayer d'abord avec haute précision
        timeout: 45000, // 45 secondes
        maximumAge: 300000 // 5 minutes de cache
      }
    );
  });
}

async function autoLogin(email, password) {
  try {
    console.log('🔐 Tentative de connexion automatique...');
    
    const response = await api('/login', {
      method: 'POST',
      body: { email, password }
    });
    
    console.log('Réponse de l\'API:', response);
    
    if (response.success && response.token) {
      // Stocker le token et les données de connexion
      localStorage.setItem('jwt', response.token);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('loginData', JSON.stringify({
        email: email,
        name: response.user?.name || email,
        role: response.user?.role || 'agent'
      }));
      localStorage.setItem('lastUserEmail', email);
      
      // Mettre à jour le JWT global
      jwt = response.token;
      
      console.log('✅ Connexion automatique réussie');
      
      // Recharger la page pour appliquer les changements
      window.location.reload();
    } else {
      throw new Error(response.message || 'Échec de la connexion');
    }
  } catch (e) {
    console.error('❌ Erreur de connexion automatique:', e);
    throw e;
  }
}

function normalizeProfileResponse(resp) {
  if (!resp) return resp;
  if (resp.user) return { ...resp.user };
  if (resp.success && resp.data && resp.data.user) return { ...resp.data.user };
  return resp;
}

async function init() {
  try {
    const s = await api('/settings');
    if (s && s.success) appSettings = s.settings || null;
  } catch {}
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/service-worker.js'); } catch {}
  }
  
  // Vérifier la connexion automatique via les paramètres URL
  const urlParams = new URLSearchParams(window.location.search);
  // Auth via token propagé dans l'URL (depuis navbar)
  const urlToken = urlParams.get('token');
  if (urlToken && urlToken.length > 20) {
    try {
      localStorage.setItem('jwt', urlToken);
      jwt = urlToken;
      console.log('🔐 Token restauré depuis l\'URL');
    } catch {}
  }
  const email = urlParams.get('email');
  const password = urlParams.get('password');
  
  if (email && password) {
    console.log('🔐 Tentative de connexion automatique avec:', { email, password: '***' });
    // Si l'email a changé, nettoyer le cache local (évite stats d'un autre utilisateur)
    try {
      const lastEmail = localStorage.getItem('lastUserEmail');
      if (lastEmail && lastEmail.toLowerCase() !== email.toLowerCase()) {
        clearCachedUserData();
      }
    } catch {}
    try {
      await autoLogin(email, password);
    } catch (e) {
      console.error('❌ Échec de la connexion automatique:', e);
    }
  }
  
  // Initialiser les notifications
  await initializeNotifications();
  
  // Gérer la navbar selon l'état de connexion
  await updateNavbar();
  
  const authSection = $('auth-section');
  const appSection = $('app-section');
  if (jwt) { 
    // Charger le profil et vérifier l'onboarding (une seule fois)
    try {
      const emailForProfile = (new URLSearchParams(window.location.search)).get('email') || localStorage.getItem('userEmail');
      let profileData = null;
      if (emailForProfile) {
        profileData = normalizeProfileResponse(await api(`/profile?email=${encodeURIComponent(emailForProfile)}`));
        // Sauvegarder pour d'autres fonctions (notifications)
        try { localStorage.setItem('userProfile', JSON.stringify(profileData || {})); } catch {}
      }
      const alreadyPrompted = localStorage.getItem('onboardingPrompted') === '1';
      if (!isProfileComplete(profileData) && !alreadyPrompted) {
        localStorage.setItem('onboardingPrompted', '1');
        if (!location.pathname.includes('profile.html')) {
          window.location.href = '/profile.html?onboard=1';
        }
        return;
      }
    } catch {}

    hide(authSection);
    show(appSection);
    await loadAgentProfile();
    
    // Initialiser les sélecteurs géographiques
    setTimeout(() => {
      console.log('🌍 Initialisation des sélecteurs géographiques après connexion...');
      initGeoSelectorsLocal();
    }, 100);
  } else { 
    show(authSection); 
    hide(appSection); 
    // Si le dashboard est ouvert sans token, afficher juste un message non bloquant
    const path = window.location.pathname || '';
    if (path.includes('dashboard') || path.includes('admin')) {
      console.warn('Page admin/dashboard ouverte sans token');
    }
  }

  $('login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const email = $('email').value.trim();
      const password = $('password').value.trim();
      
      console.log('Tentative de connexion avec:', { email, password: password ? '***' : 'missing' });
      
      const data = await api('/login', { method: 'POST', body: { email, password } });
      
      console.log('Réponse de l\'API:', data);
      
      jwt = data.token; 
      localStorage.setItem('jwt', jwt);
      localStorage.setItem('loginData', JSON.stringify(data.user));
      localStorage.setItem('userProfile', JSON.stringify(data.user));
      localStorage.setItem('userEmail', data.user.email || email);
      localStorage.setItem('lastUserEmail', data.user.email || email);
      
      hide(authSection); show(appSection);
      // Vérifier l'onboarding immédiatement après connexion
      try {
        const prof = normalizeProfileResponse(await api(`/profile?email=${encodeURIComponent(data.user.email || email)}`));
        if (!isProfileComplete(prof)) {
          if (!location.pathname.includes('profile.html')) {
            window.location.href = '/profile.html?onboard=1';
          }
          return;
        }
      } catch {}

      await loadAgentProfile();
      
  // Charger les données après connexion
  await loadPresenceData();
  await loadDashboardMetrics();
  
  // Bouton unique: rien à mettre à jour dynamiquement
  
  // Forcer le rendu du calendrier
  renderCalendar();
      
      // Initialiser les sélecteurs géographiques après connexion
      setTimeout(() => {
        if (typeof initGeoSelectors === 'function') {
          console.log('🌍 Initialisation des sélecteurs géographiques après connexion...');
          initGeoSelectors();
        } else {
          console.error('❌ initGeoSelectors non disponible');
        }
      }, 100);
      
      await updateNavbar(); // Mettre à jour la navbar après connexion
    } catch (e) { 
      console.error('Erreur de connexion:', e);
      alert('Connexion échouée: ' + e.message); 
    }
  });

  // Gestion des onglets d'authentification
  window.showLoginForm = () => {
    $('login-form-container').style.display = 'block';
    $('register-form-container').style.display = 'none';
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('.auth-tab[onclick="showLoginForm()"]').classList.add('active');
  };

  // Fonction showRegisterForm supprimée - redirection directe vers /register.html

  // Gestion du formulaire d'inscription
  const registerForm = $('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = $('reg-name').value.trim();
    const email = $('reg-email').value.trim();
    const password = $('reg-password').value.trim();
    const confirmPassword = $('reg-confirm-password').value.trim();
    
    if (password !== confirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (password.length < 6) {
      alert('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    try {
      const data = await api('/register', { method: 'POST', body: { name, email, password, role: 'agent' } });
      
      if (data.success) {
        alert('Code de validation envoyé par email. Veuillez vérifier votre boîte mail et utiliser le code pour activer votre compte.');
        // Rediriger vers la page de validation
        window.location.href = '/register.html';
      } else {
        alert(data.message || 'Erreur lors de l\'inscription');
      }
      await loadAgentProfile();
      await updateNavbar();
    } catch (e) { 
      alert('Échec de la création du compte: ' + (e.message || 'Erreur inconnue'));
    }
    });
  }

  // Bouton simple: débuter la mission
  const startBtnEl = $('start-mission');
  const endBtnEl = $('end-mission');
  if (startBtnEl) {
    startBtnEl.onclick = async () => {
    const status = $('status');
      await startMission(startBtnEl, status);
    };
  }

  if (endBtnEl) {
    endBtnEl.onclick = async () => {
      const status = $('status');
      await endMission(currentMissionId, endBtnEl, status);
    };
  }

  // Fonction pour commencer une mission
  async function startMission(button, status) {
    try {
      createRippleEffect({ currentTarget: button, clientX: 0, clientY: 0 });
      addLoadingState(button, 'Récupération GPS...');
      
      const coords = await getCurrentLocationWithValidation();
      const fd = new FormData();
      
      fd.append('lat', String(coords.latitude));
      fd.append('lon', String(coords.longitude));
      fd.append('departement', $('departement').value);
      fd.append('commune', $('commune').value);
      fd.append('arrondissement', $('arrondissement').value);
      fd.append('village', $('village').value);
      fd.append('note', $('note').value || 'Début de mission');
      
      const photo = $('photo').files[0];
      if (photo) fd.append('photo', photo);

      status.textContent = 'Envoi...';
      
      const data = await api('/presence/start', { method: 'POST', body: fd });
      // Tenter de récupérer l'ID de mission créé et activer les actions liées
      if (data && (data.mission_id || (data.mission && data.mission.id))) {
        currentMissionId = data.mission_id || data.mission.id;
      }
      
      status.textContent = 'Position signalée - Mission démarrée';
      animateElement(status, 'bounce');
      showNotification('Position journalière signalée - Mission démarrée !', 'success');
      
      await refreshCheckins();
      await loadPresenceData();
      
      // Activer le bouton Finir position et désactiver début
      const endBtn = $('end-mission');
      if (endBtn) endBtn.disabled = false;
      if (button) button.disabled = true;
      const checkinBtn = $('checkin-btn');
      if (checkinBtn) checkinBtn.disabled = false;
      
    } catch (e) {
      console.error('Erreur début mission:', e);
      status.textContent = 'Erreur début mission';
      showNotification('Hors ligne: mission en file et sera envoyée dès retour réseau', 'warning');
      try {
        const payload = {
          lat: Number(fd.get('lat')),
          lon: Number(fd.get('lon')),
          note: fd.get('note') || 'Début de mission (offline)'
        };
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'queue-presence',
            endpoint: '/api/presence/start',
            method: 'POST',
            payload
          });
        }
      } catch {}
    } finally {
      removeLoadingState(button);
    }
  }

  // Fonction pour finir une mission
  async function endMission(missionId, button, status) {
    try {
      createRippleEffect({ currentTarget: button, clientX: 0, clientY: 0 });
      addLoadingState(button, 'Récupération GPS...');
      
      const coords = await getCurrentLocationWithValidation();
      const fd = new FormData();
      
      if (missionId) {
        fd.append('mission_id', String(missionId));
      }
      fd.append('lat', String(coords.latitude));
      fd.append('lon', String(coords.longitude));
      fd.append('note', $('note').value || 'Fin de mission');
      
      const photo = $('photo').files[0];
      if (photo) fd.append('photo', photo);
      
      status.textContent = 'Envoi...';
      
      // Inclure mission_id si connu
      if (missionId) fd.append('mission_id', String(missionId));
      await api('/presence/end', { method: 'POST', body: fd });

      status.textContent = 'Position signalée - Mission terminée';
      animateElement(status, 'bounce');
      showNotification('Position journalière signalée - Mission terminée !', 'success');
      
      await refreshCheckins();
      await loadPresenceData();
      
      // Réactiver le bouton Débuter et désactiver Finir
      const startBtn = $('start-mission');
      if (startBtn) startBtn.disabled = false;
      if (button) button.disabled = true;
      const checkinBtn = $('checkin-btn');
      if (checkinBtn) checkinBtn.disabled = true;
      currentMissionId = null;
      
    } catch (e) {
      console.error('Erreur fin mission:', e);
      status.textContent = 'Erreur GPS - Utilisez le bouton de secours';
      
      // Afficher le bouton de secours si pas déjà affiché
      showForceEndButton(missionId, status);
      
      showNotification('Erreur GPS. Utilisez le bouton "Finir sans GPS" ci-dessous', 'warning');
      
      // Essayer de sauvegarder en mode offline
      try {
        const fd = new FormData();
        if (missionId) fd.append('mission_id', String(missionId));
        fd.append('note', $('note').value || 'Fin de mission (offline)');
        
        const payload = {
          mission_id: missionId,
          note: fd.get('note') || 'Fin de mission (offline)'
        };
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'queue-presence',
            endpoint: '/api/presence/end',
            method: 'POST',
            payload
          });
        }
      } catch {}
    } finally {
      removeLoadingState(button);
    }
  }

  // Fonction pour forcer la fin de mission sans GPS
  async function forceEndMission(missionId, button, status) {
    try {
      createRippleEffect({ currentTarget: button, clientX: 0, clientY: 0 });
      addLoadingState(button, 'Fin forcée...');
      
      status.textContent = 'Fin forcée en cours...';
      
      const response = await api('/presence/force-end', {
        method: 'POST',
        body: JSON.stringify({
          mission_id: missionId,
          note: $('note').value || 'Fin de mission (sans GPS)'
        })
      });

      if (response.success) {
        status.textContent = 'Mission terminée (sans GPS)';
        animateElement(status, 'bounce');
        showNotification('Mission terminée avec succès (sans position GPS)', 'success');
        
        await refreshCheckins();
        await loadPresenceData();
        
        // Réactiver le bouton Débuter et désactiver Finir
        const startBtn = $('start-mission');
        if (startBtn) startBtn.disabled = false;
        if (button) button.disabled = true;
        const checkinBtn = $('checkin-btn');
        if (checkinBtn) checkinBtn.disabled = true;
        currentMissionId = null;
        
        // Masquer le bouton de secours
        hideForceEndButton();
      } else {
        throw new Error(response.message || 'Erreur lors de la fin forcée');
      }
      
    } catch (e) {
      console.error('Erreur fin forcée mission:', e);
      status.textContent = 'Erreur fin forcée';
      showNotification('Erreur lors de la fin forcée: ' + e.message, 'error');
    } finally {
      removeLoadingState(button);
    }
  }

  // Fonction pour afficher le bouton de secours
  function showForceEndButton(missionId, status) {
    // Vérifier si le bouton existe déjà
    let forceBtn = $('force-end-mission');
    if (!forceBtn) {
      // Créer le bouton de secours
      forceBtn = document.createElement('button');
      forceBtn.id = 'force-end-mission';
      forceBtn.className = 'btn btn-warning mt-2';
      forceBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Finir sans GPS (Secours)';
      forceBtn.style.display = 'block';
      
      // Ajouter le bouton après le bouton de fin normal
      const endBtn = $('end-mission');
      if (endBtn && endBtn.parentNode) {
        endBtn.parentNode.insertBefore(forceBtn, endBtn.nextSibling);
      }
    }
    
    // Configurer l'événement
    forceBtn.onclick = () => forceEndMission(missionId, forceBtn, status);
    forceBtn.style.display = 'block';
  }

  // Fonction pour masquer le bouton de secours
  function hideForceEndButton() {
    const forceBtn = $('force-end-mission');
    if (forceBtn) {
      forceBtn.style.display = 'none';
    }
  }

  // Ancien bouton start-mission supprimé

  // Ancien bouton end-mission supprimé

  $('checkin-btn').onclick = async () => {
    if (!currentMissionId) { 
      showNotification('Démarrer une mission d\'abord', 'error');
      return; 
    }
    
    const status = $('status');
    const checkinBtn = $('checkin-btn');
    
    // Ajouter l'effet ripple
    createRippleEffect({ currentTarget: checkinBtn, clientX: 0, clientY: 0 });
    addLoadingState(checkinBtn, 'Récupération GPS...');
    
    try {
      status.textContent = 'Récupération GPS...';
      const coords = await getCurrentLocationWithValidation();
      const fd = new FormData();
      fd.set('mission_id', String(currentMissionId));
      fd.set('lat', String(coords.latitude));
      fd.set('lon', String(coords.longitude));
      fd.set('note', $('note').value || '');
      const file = $('photo').files[0];
      if (file) fd.set('photo', file);
      
      status.textContent = 'Envoi...';
      addLoadingState(checkinBtn, 'Envoi...');
      await api('/mission/checkin', { method: 'POST', body: fd });
      
      status.textContent = 'Check-in envoyé';
      animateElement(status, 'bounce');
      showNotification('Check-in enregistré avec succès !', 'success');
      
      await refreshCheckins();
    } catch (e) { 
      status.textContent = 'Erreur check-in';
      showNotification('Hors ligne: check-in en file et sera envoyé au retour réseau', 'warning');
      try {
        const payload = {
          mission_id: Number(fd.get('mission_id')),
          lat: Number(fd.get('lat')),
          lon: Number(fd.get('lon')),
          note: fd.get('note') || ''
        };
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'queue-presence',
            endpoint: '/api/mission/checkin',
            method: 'POST',
            payload
          });
        }
      } catch {}
    } finally {
      removeLoadingState(checkinBtn);
    }
  };

  // Restore current mission (uniquement si connecté)
  try {
    if (!jwt) throw new Error('not-authenticated');
    const missionsResponse = await api('/me/missions');
    const missions = Array.isArray(missionsResponse) ? missionsResponse : (missionsResponse.missions || []);
    const active = missions.find(m => m.status === 'active');
    if (active) {
      currentMissionId = active.id;
      $('end-mission').disabled = false;
      $('checkin-btn').disabled = false;
      await refreshCheckins();
    }
    // Render missions history list
    const historyEl = $('missions-history');
    if (historyEl) {
      historyEl.innerHTML = '';
      missions.forEach(m => {
        const li = document.createElement('li');
        const start = m.start_time ? new Date(m.start_time).toLocaleString() : '-';
        const end = m.end_time ? new Date(m.end_time).toLocaleString() : '-';
        const depName = getDepartementNameById(m.departement);
        const comName = getCommuneNameById(m.departement, m.commune);
        li.innerHTML = `
          <div class="list-item">
            <div><strong>Mission #${m.id}</strong> — ${m.status}</div>
            <div>Début: ${start} • Fin: ${end}</div>
            <div>Département: ${depName || '-'} • Commune: ${comName || '-'}</div>
            <div>Start GPS: ${m.start_lat ?? '-'}, ${m.start_lon ?? '-'} | End GPS: ${m.end_lat ?? '-'}, ${m.end_lon ?? '-'}</div>
          </div>
        `;
        historyEl.appendChild(li);
      });
    }
  } catch {}

  // Load geo cascade
  await loadDepartements();
  $('departement').onchange = async () => {
    const id = Number($('departement').value);
    await loadCommunes(id);
  };
  $('commune').onchange = async () => {
    const id = Number($('commune').value);
    await loadArrondissements(id);
  };
  $('arrondissement').onchange = async () => {
    const id = Number($('arrondissement').value);
    await loadVillages(id);
  };

  // Initialize calendar
  await initializeCalendar();
  
  // Ne charger les données que si l'utilisateur est connecté
  if (jwt && jwt.length > 20) {
    await loadPresenceData();
  await loadDashboardMetrics();
  }
  
  // Initialiser les animations de scroll
  addScrollAnimations();
  
  // Ajouter les effets ripple aux boutons
  document.querySelectorAll('button, .btn-primary, .btn-secondary').forEach(btn => {
    btn.addEventListener('click', createRippleEffect);
  });
  
  // Charger les statistiques mensuelles
  try { await calculateMonthlyStats(); } catch {}
  
  // Vérifier les absences quotidiennes
  try { await checkDailyAbsences(); } catch {}
  
  // Initialiser l'image hero
  setTimeout(() => {
    initHeroImage();
  }, 100);

  // Appliquer Bootstrap
  try { applyBootstrapEnhancements(); } catch {}
}

async function refreshCheckins() {
  if (!currentMissionId) return;
  const list = $('checkins');
  list.innerHTML = '';
  const response = await api(`/missions/${currentMissionId}/checkins`);
  const items = response.checkins || [];
  
  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    const li = document.createElement('li');
    li.className = 'list-item';
    li.style.animationDelay = `${i * 0.1}s`;
    
    const when = new Date(c.timestamp + 'Z').toLocaleString();
    li.innerHTML = `
      <div class="checkin-item">
        <div class="checkin-time">${when}</div>
        <div class="checkin-coords">(${c.lat.toFixed(5)}, ${c.lon.toFixed(5)})</div>
        <div class="checkin-note">${c.note || ''}</div>
      </div>
    `;
    
    if (c.photo_path) {
      const img = document.createElement('img');
      img.src = c.photo_path; 
      img.style.cssText = 'max-width: 120px; display: block; margin-top: 8px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
      li.appendChild(img);
    }
    
    list.appendChild(li);
  }
  
  // Mettre à jour le calendrier après avoir chargé les check-ins
  await loadPresenceData();
}

init();

async function loadAgentProfile() {
  try {
    // Récupérer l'email depuis l'URL ou le localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email') || localStorage.getItem('userEmail');
    if (!email) { return; }
    const profile = normalizeProfileResponse(await api(`/profile?email=${encodeURIComponent(email)}`));
    if (profile) {
      // Si le profil correspond à un autre utilisateur que précédemment, nettoyer les stats locales
      try {
        const lastEmail = localStorage.getItem('lastUserEmail');
        if (profile.email && lastEmail && profile.email.toLowerCase() !== lastEmail.toLowerCase()) {
          clearCachedUserData();
          localStorage.setItem('lastUserEmail', profile.email);
        }
      } catch {}
      $('agent-name').textContent = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.name;
      $('agent-phone').textContent = profile.phone || '-';
      $('agent-role').textContent = profile.role || '-';
      $('agent-project').textContent = profile.project_name || '-';
      $('agent-planning').textContent = profile.planning_start_date && profile.planning_end_date 
        ? `${profile.planning_start_date} - ${profile.planning_end_date}` 
        : '-';
      $('agent-zone').textContent = profile.zone_name || '-';
      $('agent-expected-days').textContent = profile.expected_days_per_month || '-';
      
      if (profile.photo_path) {
        $('agent-avatar').src = profile.photo_path;
      }
      
      $('agent-profile').classList.remove('hidden');
      
      // Mettre à jour la navbar après chargement du profil
      await updateNavbar();
    }
  } catch (e) {
    console.error('Error loading agent profile:', e);
  }
}

// Fonction pour calculer les statistiques de présence mensuelles
async function calculateMonthlyStats() {
  try {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    // Récupérer les données de présence du mois
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email') || localStorage.getItem('userEmail');
    if (!email) return;
    const response = await api(`/presence/stats?year=${year}&month=${month}&email=${encodeURIComponent(email)}`);
    
    if (response.success) {
      const stats = response.stats;
      
      // Calculer les jours travaillés
      const daysWorked = stats.days_worked || 0;
      
      // Calculer les heures travaillées (approximation basée sur les check-ins)
      const hoursWorked = stats.hours_worked || 0;
      
      // Calculer le taux de présence
      let expectedDays = stats.expected_days || 22;
      if (!stats.expected_days && appSettings && appSettings['presence.expected_days_per_month']) {
        expectedDays = Number(appSettings['presence.expected_days_per_month']) || expectedDays;
      }
      const presenceRate = expectedDays > 0 ? Math.round((daysWorked / expectedDays) * 100) : 0;
      
      // Mettre à jour l'interface (inclure hebdomadaire si disponible)
      updateDashboardStats({
        daysWorked,
        hoursWorked,
        presenceRate,
        currentPosition: stats.current_position || 'Non disponible',
        weekly: Array.isArray(stats.weekly) ? stats.weekly : []
      });
      
      return stats;
    }
  } catch (e) {
    console.warn('⚠️ APIs de statistiques non disponibles, utilisation de données par défaut');
    // Utiliser des données par défaut si les APIs ne fonctionnent pas
    updateDashboardStats({
      daysWorked: 0,
      hoursWorked: 0,
      presenceRate: 0,
      currentPosition: 'Non disponible'
    });
  }
}

// Fonction pour mettre à jour les statistiques du dashboard
function updateDashboardStats(stats) {
  const daysElement = document.querySelector('.stat-days .stat-value');
  const hoursElement = document.querySelector('.stat-hours .stat-value');
  const rateElement = document.querySelector('.stat-rate .stat-value');
  const positionElement = document.querySelector('.stat-position .stat-value');
  const weeklyList = document.getElementById('weekly-stats');
  
  if (daysElement) daysElement.textContent = stats.daysWorked;
  if (hoursElement) hoursElement.textContent = `${stats.hoursWorked}h`;
  if (rateElement) {
    rateElement.textContent = `${stats.presenceRate}%`;
    // Colorer selon le taux
    if (stats.presenceRate >= 80) {
      rateElement.style.color = '#10b981'; // Vert
    } else if (stats.presenceRate >= 60) {
      rateElement.style.color = '#f59e0b'; // Orange
    } else {
      rateElement.style.color = '#ef4444'; // Rouge
    }
  }
  if (positionElement) positionElement.textContent = stats.currentPosition;

  // Liste hebdomadaire optionnelle
  if (weeklyList && Array.isArray(stats.weekly)) {
    weeklyList.innerHTML = '';
    stats.weekly.forEach(w => {
      const li = document.createElement('li');
      const start = new Date(w.week_start);
      const end = new Date(w.week_end);
      const pad = (n) => String(n).padStart(2,'0');
      const range = `${pad(start.getDate())}/${pad(start.getMonth()+1)} - ${pad(end.getDate())}/${pad(end.getMonth()+1)}`;
      li.textContent = `${range}: ${w.days_worked} j • ${w.hours_worked} h`;
      weeklyList.appendChild(li);
    });
  }
}

// Fonction pour vérifier les absences quotidiennes
async function checkDailyAbsences() {
  try {
    const today = new Date();
    const hour = today.getHours();
    
    // Si on est après 18h et qu'aucune présence n'a été marquée aujourd'hui
    if (hour >= 18) {
      const urlParams = new URLSearchParams(window.location.search);
      const email = urlParams.get('email') || localStorage.getItem('userEmail') || 'admin@ccrb.local';
      const response = await api(`/presence/check-today?email=${encodeURIComponent(email)}`);
      
      if (response.success && !response.has_presence) {
        // Marquer comme absent pour aujourd'hui
        await api(`/presence/mark-absent?email=${encodeURIComponent(email)}`, {
          method: 'POST',
          body: { date: today.toISOString().split('T')[0] }
        });
        
        // Afficher une notification
        showNotification('Absence enregistrée', 'Vous n\'avez pas marqué votre présence aujourd\'hui', 'warning');
      }
    }
  } catch (e) {
    console.warn('⚠️ Système de vérification des absences non disponible');
    // Ne pas afficher d'erreur, juste un avertissement silencieux
  }
}

// Fonction pour mettre à jour le bouton de position journalière
// Plus de bouton dynamique; on garde uniquement le début de mission

// Les fonctions de chargement géographique sont maintenant dans geo-data.js

// Fonction de déconnexion
function logout() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    localStorage.removeItem('jwt');
    jwt = '';
    location.reload();
  }
}

// Exposer la fonction de déconnexion
if (typeof window !== 'undefined') {
  window.logout = logout;
}

// ===== FONCTIONS DU CALENDRIER =====

async function initializeCalendar() {
  const prevBtn = $('prev-month');
  const nextBtn = $('next-month');
  
  if (prevBtn) {
    prevBtn.onclick = () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderCalendar();
    };
  }
  
  if (nextBtn) {
    nextBtn.onclick = () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      renderCalendar();
    };
  }
  
  renderCalendar();
}

function renderCalendar() {
  const calendarGrid = $('calendar-grid');
  const monthYearHeader = $('current-month-year');
  
  if (!calendarGrid || !monthYearHeader) return;
  
  // Mettre à jour l'en-tête
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  
  monthYearHeader.textContent = `${monthNames[currentCalendarDate.getMonth()]} ${currentCalendarDate.getFullYear()}`;
  
  // Vider la grille
  calendarGrid.innerHTML = '';
  
  // Ajouter les en-têtes des jours
  const dayHeaders = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  dayHeaders.forEach(day => {
    const dayHeader = document.createElement('div');
    dayHeader.className = 'calendar-day-header';
    dayHeader.textContent = day;
    calendarGrid.appendChild(dayHeader);
  });
  
  // Obtenir le premier jour du mois et le nombre de jours
  const firstDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), 1);
  const lastDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  // Ajouter les jours du mois précédent
  const prevMonth = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 0);
  const daysInPrevMonth = prevMonth.getDate();
  
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayElement = createDayElement(daysInPrevMonth - i, true);
    calendarGrid.appendChild(dayElement);
  }
  
  // Ajouter les jours du mois actuel
  for (let day = 1; day <= daysInMonth; day++) {
    const dayElement = createDayElement(day, false);
    calendarGrid.appendChild(dayElement);
  }
  
  // Ajouter les jours du mois suivant pour compléter la grille
  const totalCells = calendarGrid.children.length - 7; // -7 pour les en-têtes
  const remainingCells = 42 - totalCells; // 6 semaines * 7 jours = 42 cellules
  
  for (let day = 1; day <= remainingCells; day++) {
    const dayElement = createDayElement(day, true);
    calendarGrid.appendChild(dayElement);
  }
}

function createDayElement(day, isOtherMonth) {
  const dayElement = document.createElement('div');
  dayElement.className = 'calendar-day';
  dayElement.textContent = day;
  
  if (isOtherMonth) {
    dayElement.classList.add('other-month');
    return dayElement;
  }
  
  // Vérifier si c'est aujourd'hui
  const today = new Date();
  const isToday = currentCalendarDate.getFullYear() === today.getFullYear() &&
                  currentCalendarDate.getMonth() === today.getMonth() &&
                  day === today.getDate();
  
  if (isToday) {
    dayElement.classList.add('today');
  }
  
  // Vérifier le statut de présence
  const dateKey = formatDateKey(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day);
  const presenceStatus = presenceData[dateKey];
  
  if (presenceStatus) {
    switch (presenceStatus.status) {
      case 'present':
        dayElement.classList.add('present');
        break;
      case 'absent':
        dayElement.classList.add('absent');
        break;
      case 'partial':
        dayElement.classList.add('partial');
        break;
    }
  }
  
  // Ajouter l'événement de clic
  dayElement.onclick = () => handleDayClick(day, isOtherMonth);
  
  return dayElement;
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function handleDayClick(day, isOtherMonth) {
  if (isOtherMonth) return;
  
  const today = new Date();
  const clickedDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day);
  
  // Vérifier si la date est dans le futur
  if (clickedDate > today) {
    alert('Vous ne pouvez pas marquer votre présence pour une date future.');
    return;
  }
  
  // Vérifier si c'est aujourd'hui et qu'il n'y a pas de mission active
  if (clickedDate.getTime() === today.setHours(0, 0, 0, 0) && !currentMissionId) {
    alert('Pour marquer votre présence aujourd\'hui, utilisez le bouton "Marquer présence (début)" ci-dessous.');
    return;
  }
  
  // Afficher les détails de présence pour cette date
  showPresenceDetails(clickedDate);
}

function showPresenceDetails(date) {
  const dateKey = formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
  const presenceInfo = presenceData[dateKey];
  
  let message = `Détails de présence pour le ${date.toLocaleDateString('fr-FR')}:\n\n`;
  
  if (presenceInfo) {
    message += `Statut: ${presenceInfo.status}\n`;
    message += `Heure de début: ${presenceInfo.startTime || 'Non définie'}\n`;
    message += `Heure de fin: ${presenceInfo.endTime || 'Non définie'}\n`;
    message += `Note: ${presenceInfo.note || 'Aucune note'}\n`;
    message += `Lieu: ${presenceInfo.location || 'Non défini'}`;
  } else {
    message += 'Aucune donnée de présence pour cette date.';
  }
  
  alert(message);
}

async function loadPresenceData() {
  try {
    // Charger les données de présence pour le mois actuel
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth() + 1;
    
    // Simuler des données de présence (à remplacer par un appel API réel)
    // Pour l'instant, on va charger les missions existantes (si connecté)
    if (!jwt) return;
    const missionsResponse = await api('/me/missions');
    const missions = Array.isArray(missionsResponse) ? missionsResponse : (missionsResponse.missions || []);
    
    // Traiter les données de présence
    presenceData = {};
    
    missions.forEach(mission => {
      if ((mission.status === 'completed' || mission.status === 'active') && mission.start_time) {
        const startDate = new Date(mission.start_time);
        const dateKey = formatDateKey(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        
        presenceData[dateKey] = {
          status: 'present',
          startTime: mission.start_time ? new Date(mission.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null,
          endTime: mission.end_time ? new Date(mission.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null,
          note: mission.notes || '',
          location: mission.location || ''
        };
      }
    });
    
    // Re-rendre le calendrier avec les nouvelles données
    renderCalendar();
    
  } catch (error) {
    console.error('Erreur lors du chargement des données de présence:', error);
  }
}

// ===== SYSTÈME DE NOTIFICATIONS =====

async function initializeNotifications() {
  // Vérifier si les notifications sont supportées
  if (!('Notification' in window)) {
    console.log('Ce navigateur ne supporte pas les notifications');
    return;
  }

  // Demander la permission pour les notifications
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permission de notification refusée');
      return;
    }
  }

  // Programmer les rappels de présence
  schedulePresenceReminders();
}

function schedulePresenceReminders() {
  try {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const planStart = profile.planning_start_date ? new Date(profile.planning_start_date) : null;
    const planEnd = profile.planning_end_date ? new Date(profile.planning_end_date) : null;
    const now = new Date();
    const inPlannedWindow = planStart && planEnd ? (now >= planStart && now <= planEnd) : true;

    // Rappel matinal (8h00)
    if (inPlannedWindow) scheduleReminder(8, 0, 'Rappel de présence', 'Marquez votre présence si vous êtes sur le terrain.');

    // Rappel de check-in (12h00)
    if (inPlannedWindow) scheduleReminder(12, 0, 'Check-in', 'Faites un check-in si votre mission est en cours.');

    // Rappel de fin de journée (17h00)
    if (inPlannedWindow) scheduleReminder(17, 0, 'Fin de journée', 'Pensez à marquer la fin de votre présence.');

    // Rappel d’absence à 18h: si aucune présence, notifier
    const hour = 18; const minute = 0;
    const title = 'Rappel présence: fin de journée';
    const message = 'Aucune présence détectée aujourd\'hui. Marquez votre présence sinon la journée sera comptée absente.';
    const now2 = new Date();
    const reminderTime = new Date(); reminderTime.setHours(hour, minute, 0, 0);
    if (reminderTime <= now2) reminderTime.setDate(reminderTime.getDate() + 1);
    const ms = reminderTime.getTime() - now2.getTime();
    setTimeout(async () => {
      try {
        const email = (new URLSearchParams(window.location.search)).get('email') || localStorage.getItem('userEmail');
        const resp = await api(`/presence/check-today?email=${encodeURIComponent(email || '')}`);
        if (resp && resp.success && !resp.has_presence) {
          showSystemNotification(title, message);
        }
      } catch {}
      schedulePresenceReminders();
    }, ms);
  } catch {}
}

function scheduleReminder(hour, minute, title, message) {
  const now = new Date();
  const reminderTime = new Date();
  reminderTime.setHours(hour, minute, 0, 0);
  
  // Si l'heure est déjà passée aujourd'hui, programmer pour demain
  if (reminderTime <= now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }
  
  const timeUntilReminder = reminderTime.getTime() - now.getTime();
  
  setTimeout(() => {
    showSystemNotification(title, message);
    // Reprogrammer pour le lendemain
    scheduleReminder(hour, minute, title, message);
  }, timeUntilReminder);
}

function showSystemNotification(title, message) {
  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body: message,
        icon: '/Media/default-avatar.png',
        tag: 'presence-reminder'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        // Scroll vers le formulaire de présence
        const presenceCard = document.querySelector('.card h2');
        if (presenceCard && presenceCard.textContent.includes('Présence terrain')) {
          presenceCard.scrollIntoView({ behavior: 'smooth' });
        }
      };

      // Auto-fermer après 5 secondes
      setTimeout(() => {
        if (notification && notification.close) {
          notification.close();
        }
      }, 5000);
    } catch (error) {
      console.warn('Erreur notification:', error);
      // Fallback: afficher une alerte simple
      alert(`${title}: ${message}`);
    }
  } else {
    // Fallback: afficher une alerte simple
    alert(`${title}: ${message}`);
  }
}

// ===== AMÉLIORATION DE LA GÉOLOCALISATION =====

async function getCurrentLocationWithValidation() {
  try {
    // Vérifier d'abord que le serveur répond
    try {
      const healthCheck = await fetch(apiBase + '/health', { 
        method: 'GET',
        timeout: 5000 
      });
      if (!healthCheck.ok) {
        throw new Error('Serveur indisponible');
      }
    } catch (serverError) {
      console.warn('Serveur non accessible:', serverError);
      // Continuer quand même pour le GPS local
    }
    
    const coords = await geoPromise();
    
    // Vérifier la précision GPS selon le paramètre choisi
    const gpsPrecision = document.getElementById('gps-precision')?.value || 'medium';
    let maxAccuracy = 1000; // Par défaut
    
    switch (gpsPrecision) {
      case 'high': maxAccuracy = 100; break;
      case 'medium': maxAccuracy = 500; break;
      case 'low': maxAccuracy = 1000; break;
      case 'any': maxAccuracy = Infinity; break;
    }
    
    if (coords.accuracy > maxAccuracy) {
      // Afficher un avertissement mais permettre la présence
      console.warn(`Précision GPS faible: ${Math.round(coords.accuracy)}m`);
      showNotification('Avertissement GPS', `Précision faible (${Math.round(coords.accuracy)}m). La présence sera enregistrée.`);
    }
    
    // Afficher les informations de localisation
    showLocationInfo(coords);
    
    // Stocker les coordonnées localement en cas de problème serveur
    localStorage.setItem('lastGPS', JSON.stringify({
      lat: coords.latitude,
      lon: coords.longitude,
      accuracy: coords.accuracy,
      timestamp: Date.now()
    }));
    
    return coords;
  } catch (error) {
    console.error('Erreur de géolocalisation:', error);
    
    // Messages d'erreur plus clairs
    let errorMessage = 'Erreur de géolocalisation';
    if (error.message.includes('timeout')) {
      errorMessage = 'Timeout GPS: Veuillez vous déplacer vers un endroit plus ouvert et réessayer';
    } else if (error.message.includes('denied')) {
      errorMessage = 'Accès GPS refusé: Veuillez autoriser la géolocalisation dans les paramètres du navigateur';
    } else if (error.message.includes('unavailable')) {
      errorMessage = 'GPS indisponible: Vérifiez que la géolocalisation est activée sur votre appareil';
    }
    
    throw new Error(errorMessage);
  }
}

function showLocationInfo(coords) {
  const status = $('status');
  const accuracy = coords.accuracy < 10 ? 'Excellente' : 
                   coords.accuracy < 50 ? 'Bonne' : 
                   coords.accuracy < 100 ? 'Moyenne' : 'Faible';
  
  status.innerHTML = `
    <div style="background: #e8f5e8; padding: 12px; border-radius: 8px; margin: 8px 0;">
      <strong>📍 Position détectée</strong><br>
      Précision: ${accuracy} (${Math.round(coords.accuracy)}m)<br>
      Coordonnées: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}
    </div>
  `;
}

// ===== TABLEAU DE BORD ET MÉTRIQUES =====

async function loadDashboardMetrics() {
  try {
    // Charger les données de présence pour le mois actuel (si connecté)
    if (!jwt) return;
    const missionsResponse = await api('/me/missions');
    const missions = Array.isArray(missionsResponse) ? missionsResponse : (missionsResponse.missions || []);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Calculer les métriques
    const metrics = calculateMetrics(missions, currentMonth, currentYear);
    
    // Afficher les métriques avec animation
    displayMetrics(metrics);
    
    // Mettre à jour la position actuelle
    await updateCurrentLocation();
    
  } catch (error) {
    console.error('Erreur lors du chargement des métriques:', error);
  }
}

function calculateMetrics(missions, month, year) {
  const currentMonthMissions = missions.filter(mission => {
    if (!mission.start_time) return false;
    const missionDate = new Date(mission.start_time);
    return missionDate.getMonth() === month && missionDate.getFullYear() === year;
  });
  
  // Calculer les jours travaillés
  const uniqueDays = new Set();
  currentMonthMissions.forEach(mission => {
    if (mission.start_time) {
      const date = new Date(mission.start_time);
      uniqueDays.add(date.toDateString());
    }
  });
  
  // Calculer les heures travaillées
  let totalHours = 0;
  currentMonthMissions.forEach(mission => {
    if (mission.start_time && mission.end_time) {
      const start = new Date(mission.start_time);
      const end = new Date(mission.end_time);
      const hours = (end - start) / (1000 * 60 * 60);
      totalHours += Math.max(0, hours);
    }
  });
  
  // Calculer le taux de présence
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const attendanceRate = Math.round((uniqueDays.size / daysInMonth) * 100);
  
  return {
    daysWorked: uniqueDays.size,
    hoursWorked: Math.round(totalHours * 10) / 10,
    attendanceRate: Math.min(attendanceRate, 100)
  };
}

function displayMetrics(metrics) {
  // Animer l'affichage des métriques
  const cards = document.querySelectorAll('.metric-card');
  cards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('animate');
    }, index * 200);
  });
  
  // Afficher les valeurs
  $('days-worked').textContent = metrics.daysWorked;
  $('hours-worked').textContent = `${metrics.hoursWorked}h`;
  $('attendance-rate').textContent = `${metrics.attendanceRate}%`;
  
  // Ajouter des couleurs selon les performances
  const attendanceRateElement = $('attendance-rate');
  if (metrics.attendanceRate >= 90) {
    attendanceRateElement.style.color = '#10b981';
  } else if (metrics.attendanceRate >= 70) {
    attendanceRateElement.style.color = '#f59e0b';
  } else {
    attendanceRateElement.style.color = '#ef4444';
  }
}

async function updateCurrentLocation() {
  try {
    const coords = await geoPromise();
    const location = await getLocationName(coords.latitude, coords.longitude);
    $('current-location').textContent = location || 'Position inconnue';
  } catch (error) {
    $('current-location').textContent = 'Non disponible';
  }
}

async function getLocationName(lat, lon) {
  try {
    // Utiliser l'API de géocodage inverse (vous pouvez remplacer par votre propre service)
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`);
    const data = await response.json();
    return data.locality || data.city || 'Position détectée';
  } catch (error) {
    return `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
  }
}

// Mettre à jour la navbar selon l'état de connexion et le rôle
async function updateNavbar() {
  const profileLink = $('profile-link');
  const mapLink = $('map-link');
  const dashboardLink = $('dashboard-link');
  const agentsLink = $('agents-link');
  const reportsLink = $('reports-link');
  const adminLink = $('admin-link');
  const adminSettingsBtnId = 'admin-settings-link';
  const navbarUser = $('navbar-user');
  const userInfo = $('user-info');
  
  if (jwt) {
    try {
      // Récupérer le profil utilisateur depuis le localStorage ou l'API
      let profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      
      // Si pas de profil en cache, essayer l'API
      if (!profile.id) {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const email = urlParams.get('email') || localStorage.getItem('userEmail') || 'admin@ccrb.local';
          profile = await api(`/profile?email=${encodeURIComponent(email)}`);
          localStorage.setItem('userProfile', JSON.stringify(profile));
        } catch (e) {
          console.log('API profile non disponible, utilisation des données de connexion');
          // Utiliser les données de connexion stockées
          profile = JSON.parse(localStorage.getItem('loginData') || '{}');
        }
      }
      
      // Afficher le profil et la carte pour tous les utilisateurs connectés
      if (profileLink) profileLink.style.display = 'flex';
      if (mapLink) mapLink.style.display = 'flex';
      
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
      const isAdmin = profile && profile.role === 'admin';
      if (isAdmin) {
        if (adminLink) adminLink.style.display = 'flex';
        // Ajouter un bouton Paramètres Admin si absent
        let settingsLink = document.getElementById(adminSettingsBtnId);
        if (!settingsLink) {
          settingsLink = document.createElement('a');
          settingsLink.id = adminSettingsBtnId;
          settingsLink.href = '/admin-settings.html';
          settingsLink.className = 'navbar-link';
          settingsLink.style.display = 'flex';
          settingsLink.innerHTML = '<span class="navbar-icon">🛠️</span><span>Paramètres</span>';
          const navbar = adminLink.closest('.navbar-menu') || document.querySelector('.navbar .navbar-menu') || document.querySelector('.navbar');
          if (navbar) navbar.insertBefore(settingsLink, document.getElementById('navbar-user'));
        } else {
          settingsLink.style.display = 'flex';
        }
      } else {
        if (adminLink) adminLink.style.display = 'none';
        const settingsLink = document.getElementById(adminSettingsBtnId);
        if (settingsLink) settingsLink.style.display = 'none';
      }
      
      // Ne plus propager le token dans l'URL pour le dashboard
      
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
      
      // Cacher le bouton d'inscription pour les utilisateurs connectés
      const registerLink = $('register-link');
      if (registerLink) {
        registerLink.style.display = 'none';
      }
      
      // Afficher les boutons d'accès rapide
      const quickAccess = $('quick-access');
      if (quickAccess) {
        quickAccess.style.display = 'flex';
      }
      
      // Masquer les informations d'accueil
      const welcomeInfo = $('welcome-info');
      if (welcomeInfo) {
        welcomeInfo.style.display = 'none';
      }
    } catch (e) {
      console.error('Error updating navbar:', e);
      // En cas d'erreur, cacher les éléments
      if (dashboardLink) dashboardLink.style.display = 'none';
      if (navbarUser) navbarUser.style.display = 'none';
    }
  } else {
    // Utilisateur non connecté
    if (dashboardLink) dashboardLink.style.display = 'none';
    if (navbarUser) navbarUser.style.display = 'none';
    
    // Afficher le bouton d'inscription
    const registerLink = $('register-link');
    if (registerLink) {
      registerLink.style.display = 'flex';
    }
    
    // Masquer les boutons d'accès rapide
    const quickAccess = $('quick-access');
    if (quickAccess) {
      quickAccess.style.display = 'none';
    }
    
    // Afficher les informations d'accueil
    const welcomeInfo = $('welcome-info');
    if (welcomeInfo) {
      welcomeInfo.style.display = 'block';
    }
  }
}

// Fonctions pour la saisie manuelle des unités géographiques
function setupManualGeoInputs() {
  console.log('🔧 Configuration de la saisie manuelle des unités géographiques...');
  
  // Configuration des boutons de basculement
  const geoFields = ['departement', 'commune', 'arrondissement', 'village'];
  
  geoFields.forEach(field => {
    const select = $(field);
    const manualInput = $(`${field}-manual`);
    const toggleBtn = $(`toggle-${field}`);
    
    if (select && manualInput && toggleBtn) {
      // Gestionnaire pour le bouton de basculement
      toggleBtn.addEventListener('click', () => {
        const isManual = manualInput.style.display !== 'none';
        
        if (isManual) {
          // Passer en mode sélection
          select.style.display = 'block';
          manualInput.style.display = 'none';
          toggleBtn.textContent = '✏️';
          toggleBtn.classList.remove('active');
          select.disabled = false;
        } else {
          // Passer en mode saisie manuelle
          select.style.display = 'none';
          manualInput.style.display = 'block';
          toggleBtn.textContent = '📋';
          toggleBtn.classList.add('active');
          select.disabled = true;
          manualInput.focus();
        }
      });
      
      // Synchroniser les valeurs entre select et input manuel
      select.addEventListener('change', () => {
        if (manualInput.style.display === 'none') {
          manualInput.value = select.options[select.selectedIndex]?.text || '';
        }
      });
      
      manualInput.addEventListener('input', () => {
        if (select.style.display === 'none') {
          // Trouver l'option correspondante dans le select
          const options = Array.from(select.options);
          const matchingOption = options.find(option => 
            option.text.toLowerCase().includes(manualInput.value.toLowerCase())
          );
          
          if (matchingOption) {
            select.value = matchingOption.value;
          }
        }
      });
    }
  });
}

// Fonction pour obtenir la valeur géographique (select ou manuel)
function getGeoValue(field) {
  const select = $(field);
  const manualInput = $(`${field}-manual`);
  
  if (manualInput && manualInput.style.display !== 'none' && manualInput.value.trim()) {
    return manualInput.value.trim();
  } else if (select && select.value) {
    return select.options[select.selectedIndex]?.text || select.value;
  }
  
  return '';
}

// Fonctions de chargement des données géographiques
async function loadDepartements() {
  try {
    const deptSelect = $('departement');
    if (!deptSelect) return;
    
    // Éviter la duplication en cas d'appels concurrents
    if (deptSelect.dataset.loading === '1') return;
    if (deptSelect.options && deptSelect.options.length > 1 && deptSelect.dataset.loaded === '1') return;
    deptSelect.dataset.loading = '1';
    
    deptSelect.innerHTML = '<option value="">Sélectionner un département</option>';
    // Assurer qu'il est activé pour interaction
    deptSelect.disabled = false;
    
    // Attendre que les données géographiques soient chargées
    if (window.loadGeoData) {
      await window.loadGeoData();
    }
    
    // Utiliser les données locales qui fonctionnent
    if (window.geoData && window.geoData.departements) {
      window.geoData.departements.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name; // Utiliser 'name' au lieu de 'nom'
        deptSelect.appendChild(opt);
      });
      deptSelect.dataset.loaded = '1';
      deptSelect.disabled = false;
      console.log('✅ Départements chargés depuis les données locales:', window.geoData.departements.length);
    } else {
      console.error('❌ Données géographiques locales non disponibles');
    }
    deptSelect.dataset.loading = '0';
  } catch (error) {
    console.error('Erreur chargement départements:', error);
    try { const deptSelect = $('departement'); if (deptSelect) deptSelect.dataset.loading = '0'; } catch {}
  }
}

async function loadCommunes(departementId) {
  try {
    console.log('🔍 loadCommunes appelée avec departementId:', departementId);
    const communeSelect = $('commune');
    if (!communeSelect) {
      console.error('❌ Élément commune non trouvé');
      return;
    }
    
    communeSelect.innerHTML = '<option value="">Sélectionner une commune</option>';
    communeSelect.disabled = true;
    
    // Attendre que les données géographiques soient chargées
    if (window.loadGeoData) {
      await window.loadGeoData();
    }
    
    console.log('🔍 Vérification de window.geoData:', !!window.geoData);
    if (window.geoData) {
      console.log('🔍 window.geoData.communes:', !!window.geoData.communes);
      console.log('🔍 Clés disponibles dans communes:', Object.keys(window.geoData.communes || {}));
      console.log('🔍 Communes pour departementId', departementId, ':', window.geoData.communes[departementId]);
    }
    
    // Utiliser les données de geo-data.js qui utilisent des IDs numériques
    if (window.geoData && window.geoData.communes && window.geoData.communes[departementId]) {
      const communes = window.geoData.communes[departementId];
      communes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        communeSelect.appendChild(opt);
      });
      communeSelect.disabled = false;
      console.log('✅ Communes chargées depuis geo-data.js:', communes.length, 'pour département ID:', departementId);
    } else {
      console.error('❌ Communes non disponibles pour le département ID:', departementId);
      console.log('Données disponibles:', window.geoData ? Object.keys(window.geoData.communes || {}) : 'geoData non disponible');
    }
    
    // Réinitialiser les niveaux suivants
    const arrSel = $('arrondissement');
    const vilSel = $('village');
    if (arrSel) { arrSel.innerHTML = '<option value="">Sélectionner un arrondissement</option>'; arrSel.disabled = true; }
    if (vilSel) { vilSel.innerHTML = '<option value="">Sélectionner un village</option>'; vilSel.disabled = true; }
  } catch (error) {
    console.error('Erreur chargement communes:', error);
  }
}

async function loadArrondissements(communeId) {
  try {
    const arrSelect = $('arrondissement');
    const vilSelect = $('village');
    if (!arrSelect) return;
    
    arrSelect.innerHTML = '<option value="">Sélectionner un arrondissement</option>';
    if (vilSelect) vilSelect.innerHTML = '<option value="">Sélectionner un village</option>';
    arrSelect.disabled = true;
    if (vilSelect) vilSelect.disabled = true;
    
    // Sélectionner par différentes stratégies selon la structure des données
    let arrondissements = [];
    if (window.geoData && window.geoData.arrondissements) {
      // 1) Direct: clé numérique par communeId
      if (window.geoData.arrondissements[communeId]) {
        arrondissements = window.geoData.arrondissements[communeId] || [];
      }
      
      // 2) Par nom de commune en clé
      if (arrondissements.length === 0) {
        // Retrouver l'objet commune pour obtenir son nom
        let commune = null;
        try {
          for (const communes of Object.values(window.geoData.communes || {})) {
            const found = (communes || []).find(c => String(c.id) === String(communeId));
            if (found) { commune = found; break; }
          }
        } catch {}
        if (commune && window.geoData.arrondissements[commune.name]) {
          arrondissements = window.geoData.arrondissements[commune.name] || [];
        }
        
        // 3) Fallback: parcourir toutes les listes et filtrer par suffixe de nom "..._Commune"
        if (arrondissements.length === 0 && commune && commune.name) {
          try {
            const all = Object.values(window.geoData.arrondissements)
              .flat()
              .filter(a => {
                const parts = String(a.name || '').split('_');
                return parts.length > 1 && parts[parts.length - 1] === commune.name;
              });
            arrondissements = all;
          } catch {}
        }
      }
    }
    
    // Peupler le select
    if (arrondissements.length > 0) {
      arrondissements.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name;
        arrSelect.appendChild(opt);
      });
      arrSelect.disabled = false;
      if (vilSelect) vilSelect.disabled = true;
      console.log('✅ Arrondissements chargés:', arrondissements.length, 'pour commune ID:', communeId);
    } else {
      arrSelect.disabled = true;
      if (vilSelect) vilSelect.disabled = true;
      console.error('❌ Aucun arrondissement trouvé pour la commune ID:', communeId);
    }
  } catch (error) {
    console.error('Erreur chargement arrondissements:', error);
  }
}

async function loadVillages(arrondissementId) {
  try {
    const villageSelect = $('village');
    if (!villageSelect) return;
    
      villageSelect.innerHTML = '<option value="">Sélectionner un village</option>';
      villageSelect.disabled = true;
    
    // S'assurer que les données géographiques asynchrones sont chargées
    if (window.loadGeoData) {
      try { await window.loadGeoData(); } catch {}
    }
    
    let villages = [];
    if (window.geoData && window.geoData.villages) {
      // 1) Direct: clé numérique par arrondissementId
      if (window.geoData.villages[arrondissementId]) {
        villages = window.geoData.villages[arrondissementId] || [];
      }
      
      // 2) Par nom d'arrondissement en clé
      if (villages.length === 0) {
        let arrondissement = null;
        try {
          const allArr = Object.values(window.geoData.arrondissements || {}).flat();
          arrondissement = allArr.find(a => String(a.id) === String(arrondissementId)) || null;
        } catch {}
        if (arrondissement && window.geoData.villages[arrondissement.name]) {
          villages = window.geoData.villages[arrondissement.name] || [];
        }
        // 3) Fallback: recherche tolérante par nom (sans accents, insensible à la casse)
        if (villages.length === 0 && arrondissement && arrondissement.name) {
          try {
            const normalize = (s) => String(s || '')
              .normalize('NFD')
              .replace(/\p{Diacritic}+/gu, '')
              .replace(/[\s-]+/g, '_')
              .toLowerCase();
            const arrNameNorm = normalize(arrondissement.name);
            const all = Object.values(window.geoData.villages)
              .flat()
              .filter(v => {
                const vn = normalize(v.name);
                // accepter suffixe exact après '_' ou simple inclusion
                return vn.endsWith('_' + arrNameNorm) || vn.includes(arrNameNorm);
              });
            villages = all;
          } catch {}
        }
      }
    }
    
    if (villages.length > 0) {
      villages.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        villageSelect.appendChild(opt);
      });
      villageSelect.disabled = false;
      console.log('✅ Villages chargés:', villages.length, 'pour arrondissement ID:', arrondissementId);
    } else {
      villageSelect.disabled = true;
      console.error('❌ Aucun village trouvé pour l\'arrondissement ID:', arrondissementId);
    }
  } catch (error) {
    console.error('Erreur chargement villages:', error);
  }
}

// Fonction pour valider les champs géographiques requis
function validateGeoFields() {
  const departement = getGeoValue('departement');
  const commune = getGeoValue('commune');
  
  if (!departement.trim()) {
    alert('❌ Veuillez sélectionner ou saisir un département');
    return false;
  }
  
  if (!commune.trim()) {
    alert('❌ Veuillez sélectionner ou saisir une commune');
    return false;
  }
  
  return true;
}

// Fonction d'initialisation locale des sélecteurs géographiques
function initGeoSelectorsLocal() {
  console.log('🌍 Initialisation locale des sélecteurs géographiques...');
  
  // Charger les départements
  loadDepartements();
  
  // Ajouter les événements
  const departementSelect = $('departement');
  const communeSelect = $('commune');
  const arrondissementSelect = $('arrondissement');
  
  if (departementSelect) {
    departementSelect.addEventListener('change', function() {
      loadCommunes(this.value);
    });
  }
  
  if (communeSelect) {
    communeSelect.addEventListener('change', function() {
      loadArrondissements(this.value);
    });
  }
  
  if (arrondissementSelect) {
    arrondissementSelect.addEventListener('change', function() {
      loadVillages(this.value);
    });
  }
  
  console.log('✅ Sélecteurs géographiques initialisés localement');
}

// Utilitaires: retrouver noms par ID à partir de geoData
function getDepartementNameById(departementId) {
  if (!window.geoData || !Array.isArray(window.geoData.departements)) return String(departementId || '');
  const d = window.geoData.departements.find(x => String(x.id) === String(departementId));
  return d ? d.name : String(departementId || '');
}

function getCommuneNameById(departementId, communeId) {
  if (!window.geoData || !window.geoData.communes) return String(communeId || '');
  const communes = window.geoData.communes[String(departementId)] || window.geoData.communes[departementId] || [];
  const c = communes.find(x => String(x.id) === String(communeId));
  return c ? c.name : String(communeId || '');
}

// Initialiser la saisie manuelle au chargement
document.addEventListener('DOMContentLoaded', () => {
  // Effacer la console au chargement
  console.clear();
  console.log('🚀 Application chargée - Console effacée');
  
  // Vérifier le token au chargement
  const jwt = localStorage.getItem('jwt');
  if (jwt && jwt.length < 20) {
    console.warn('⚠️ Ancien token détecté au chargement (longueur:', jwt.length, '). Suppression du token.');
    localStorage.removeItem('jwt');
    localStorage.removeItem('loginData');
    localStorage.removeItem('userProfile');
    // Ne pas forcer la reconnexion, laisser l'utilisateur naviguer normalement
  }
  
  setTimeout(() => {
    setupManualGeoInputs();
  }, 1000);
});

// Exposer les fonctions globalement
window.getGeoValue = getGeoValue;
window.validateGeoFields = validateGeoFields;
window.setupManualGeoInputs = setupManualGeoInputs;


