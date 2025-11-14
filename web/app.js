// Configuration de l'API — toujours passer par notre proxy /api pour éviter les blocages CSP
const apiBase = '/api';
let jwt = localStorage.getItem('jwt') || '';
let currentMissionId = null;
let currentCalendarDate = new Date();
let presenceData = {};
let appSettings = null;
let isLoadingProfile = false; // Protection contre les appels répétés

// Cache pour éviter les appels répétitifs
let userProfileCache = null;
let lastProfileCall = 0;
const PROFILE_CACHE_DURATION = 30000; // 30 secondes

// Cache des check-ins par mission (évite les requêtes répétées dans l'historique)
const missionCheckinCache = new Map();

async function getMissionCheckinsCached(missionId) {
  if (!missionId && missionId !== 0) return [];
  const key = Number(missionId);
  if (missionCheckinCache.has(key)) {
    return missionCheckinCache.get(key);
  }
  try {
    const resp = await api(`/missions/${key}/checkins`);
    const rows = Array.isArray(resp)
      ? resp
      : resp?.checkins || resp?.items || resp?.data?.items || resp?.data?.checkins || [];
    missionCheckinCache.set(key, rows || []);
    return rows || [];
  } catch (error) {
    console.warn(`⚠️ Impossible de récupérer les check-ins de la mission ${missionId}:`, error);
    missionCheckinCache.set(key, []);
    return [];
  }
}

function invalidateMissionCheckins(missionId) {
  if (!missionId && missionId !== 0) return;
  missionCheckinCache.delete(Number(missionId));
}

function invalidateAllMissionCheckins() {
  missionCheckinCache.clear();
}

// Fonction optimisée pour récupérer le profil avec cache
async function getCachedProfile(email) {
  const now = Date.now();
  
  // Si le cache est valide et récent, le retourner
  if (userProfileCache && (now - lastProfileCall) < PROFILE_CACHE_DURATION) {
    console.log('📦 Utilisation du cache du profil utilisateur');
    return userProfileCache;
  }
  
  // Sinon, faire l'appel API et mettre en cache
  try {
    console.log('🔄 Chargement du profil depuis l\'API...');
    const profile = await api(`/profile?email=${encodeURIComponent(email)}`);
    userProfileCache = normalizeProfileResponse(profile);
    lastProfileCall = now;
    return userProfileCache;
  } catch (error) {
    console.error('Erreur lors du chargement du profil:', error);
    return null;
  }
}

// Initialisation des nouveaux systèmes
let offlineManager = null;
let notificationManager = null;
let gpsTracker = null;
let messagingSystem = null;
let emergencySystem = null;
let enrichedReports = null;
let smartPlanning = null;
let agentDashboard = null;
let integratedHelp = null;
let analyticsInsights = null;

// Configuration des heures de présence sur le terrain
const WORK_HOURS = {
  start: { hour: 6, minute: 30 }, // 06h30
  end: { hour: 18, minute: 30 }   // 18h30
};

// Protection contre les boucles de connexion
let loginAttempts = 0;
const MAX_LOGIN_ATTEMPTS = 3;
let isLoginInProgress = false;

function clearCachedUserData() {
  try {
    localStorage.removeItem('loginData');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('lastGPS');
    localStorage.removeItem('vercelLoginAttempts');
    localStorage.removeItem('lastLoginAttempt');
    console.log('🧹 Cache utilisateur nettoyé (jwt conservé)');
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

// Fonction pour valider les heures de présence sur le terrain
function isWithinWorkHours(date = new Date()) {
  const currentHour = date.getHours();
  const currentMinute = date.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  
  const startTimeInMinutes = WORK_HOURS.start.hour * 60 + WORK_HOURS.start.minute;
  const endTimeInMinutes = WORK_HOURS.end.hour * 60 + WORK_HOURS.end.minute;
  
  return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
}

// Fonction pour formater les heures de travail
function formatWorkHours() {
  const startTime = `${WORK_HOURS.start.hour.toString().padStart(2, '0')}h${WORK_HOURS.start.minute.toString().padStart(2, '0')}`;
  const endTime = `${WORK_HOURS.end.hour.toString().padStart(2, '0')}h${WORK_HOURS.end.minute.toString().padStart(2, '0')}`;
  return `${startTime} - ${endTime}`;
}

// Fonction pour obtenir le temps restant avant/après les heures de travail
function getWorkHoursStatus() {
  const now = new Date();
  const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
  const startTimeInMinutes = WORK_HOURS.start.hour * 60 + WORK_HOURS.start.minute;
  const endTimeInMinutes = WORK_HOURS.end.hour * 60 + WORK_HOURS.end.minute;
  
  if (currentTimeInMinutes < startTimeInMinutes) {
    const minutesUntilStart = startTimeInMinutes - currentTimeInMinutes;
    const hours = Math.floor(minutesUntilStart / 60);
    const minutes = minutesUntilStart % 60;
    return {
      status: 'before',
      message: `Les heures de présence commencent dans ${hours}h${minutes.toString().padStart(2, '0')}`
    };
  } else if (currentTimeInMinutes > endTimeInMinutes) {
    const minutesSinceEnd = currentTimeInMinutes - endTimeInMinutes;
    const hours = Math.floor(minutesSinceEnd / 60);
    const minutes = minutesSinceEnd % 60;
    return {
      status: 'after',
      message: `Les heures de présence sont terminées depuis ${hours}h${minutes.toString().padStart(2, '0')}`
    };
  } else {
    const minutesUntilEnd = endTimeInMinutes - currentTimeInMinutes;
    const hours = Math.floor(minutesUntilEnd / 60);
    const minutes = minutesUntilEnd % 60;
    return {
      status: 'during',
      message: `Temps restant: ${hours}h${minutes.toString().padStart(2, '0')}`
    };
  }
}

// Fonction pour mettre à jour l'affichage du statut des heures de travail
function updateWorkHoursDisplay() {
  const statusEl = $('work-hours-status');
  if (!statusEl) return;
  
  const workStatus = getWorkHoursStatus();
  const now = new Date();
  const currentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  
  let statusText = '';
  let statusColor = '';
  
  switch (workStatus.status) {
    case 'before':
      statusText = `🕐 ${currentTime} - ${workStatus.message}`;
      statusColor = '#ff9800'; // Orange
      break;
    case 'during':
      statusText = `✅ ${currentTime} - Présence autorisée - ${workStatus.message}`;
      statusColor = '#4caf50'; // Vert
      break;
    case 'after':
      statusText = `🕘 ${currentTime} - ${workStatus.message}`;
      statusColor = '#f44336'; // Rouge
      break;
  }
  
  statusEl.textContent = statusText;
  statusEl.style.color = statusColor;
  
  // Désactiver/activer les boutons selon les heures
  const startBtn = $('start-mission');
  const endBtn = $('end-mission');
  
  if (workStatus.status !== 'during') {
    if (startBtn && !startBtn.disabled) {
      startBtn.style.opacity = '0.6';
      startBtn.title = `Présence autorisée uniquement de ${formatWorkHours()}`;
    }
    if (endBtn && !endBtn.disabled) {
      endBtn.style.opacity = '0.6';
      endBtn.title = `Présence autorisée uniquement de ${formatWorkHours()}`;
    }
  } else {
    if (startBtn) {
      startBtn.style.opacity = '1';
      startBtn.title = '';
    }
    if (endBtn) {
      endBtn.style.opacity = '1';
      endBtn.title = '';
    }
  }
}

function $(id) { return document.getElementById(id); }
function show(el) { 
  if (el && el.classList) {
    el.classList.remove('hidden'); 
    el.classList.add('block');
  }
}
function hide(el) { 
  if (el && el.classList) {
    el.classList.add('hidden'); 
    el.classList.remove('block');
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

// Assurer un binding explicite des liens navbar (certains navigateurs bloquent la délégation globale)
function bindNavbarLinks() {
  try {
    document.querySelectorAll('a.navbar-link').forEach((a) => {
      if (a._navBound) return; a._navBound = true;
      a.addEventListener('click', (ev) => {
        const href = a.getAttribute('href');
        if (href && !href.startsWith('#')) { ev.preventDefault(); window.location.href = href; }
      });
    });
    document.querySelectorAll('.navbar-logout, [data-action="logout"]').forEach((btn) => {
      if (btn._logoutBound) return; btn._logoutBound = true;
      btn.addEventListener('click', (ev) => { ev.preventDefault(); try { window.logout && window.logout(); } catch {} });
    });
    // IDs fallback
    const idToUrl = {
      'home-link': '/',
      'presence-link': '/',
      'planning-link': '/planning.html',
      'map-link': '/map.html',
      'help-link': '/help.html',
      'profile-link': '/profile.html',
      'dashboard-link': '/dashboard.html',
      'agents-link': '/admin-agents.html',
      'reports-link': '/reports.html',
      'admin-link': '/admin.html'
    };
    Object.keys(idToUrl).forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el._idNavBound) {
        el._idNavBound = true;
        el.addEventListener('click', (ev) => { ev.preventDefault(); window.location.href = idToUrl[id]; });
      }
    });
  } catch (e) { console.warn('bindNavbarLinks failed', e); }
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
      try {
        // Fallback vers une image par défaut si disponible
        heroImage.src = '/Media/default-hero.png';
        heroImage.classList.add('loaded');
      } catch {}
    };
    img.src = heroImage.src;
  }
}

// Assurer la navigation des liens de la navbar même si des handlers bloquent le comportement par défaut
document.addEventListener('click', (ev) => {
  try {
    const link = ev.target && ev.target.closest && ev.target.closest('.navbar a, .navbar-link');
    if (link && link.getAttribute) {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('#')) {
        ev.preventDefault();
        window.location.href = href;
      }
    }
    // Click sur le logo/icone: retourner à l'accueil
    const logo = ev.target && ev.target.closest && ev.target.closest('.navbar-logo, .navbar-brand-link, .org-logo, #site-logo');
    if (logo && !(logo.tagName && logo.tagName.toLowerCase() === 'a')) {
      ev.preventDefault();
      window.location.href = '/home.html';
      return;
    }
    // Logout buttons
    const logoutBtn = ev.target && ev.target.closest && ev.target.closest('.navbar-logout, [data-action="logout"]');
    if (logoutBtn) {
      ev.preventDefault();
      ev.stopPropagation();
      try { window.logout && window.logout(); } catch {}
      return;
    }
  } catch {}
});

// Bind navbar dès que le DOM est prêt (renforce la délégation globale)
document.addEventListener('DOMContentLoaded', bindNavbarLinks);
window.addEventListener('load', bindNavbarLinks);

// Gestion centralisée de l'affichage des actions circulaires avec logique des rôles
function updateCircleActionsVisibility() {
  try {
    const token = localStorage.getItem('jwt') || '';
    const actions = document.getElementById('circle-actions');
    if (!actions) return;
    
    if (token) {
      actions.style.display = 'grid';
      updateActionsBasedOnRole();
    } else {
      actions.style.display = 'none';
    }
  } catch (error) {
    console.error('Erreur mise à jour actions:', error);
  }
}

// Mettre à jour les actions selon le rôle de l'utilisateur
async function updateActionsBasedOnRole() {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    
    const role = user.role || 'agent';
    
    // Masquer tous les boutons spécifiques aux rôles
    document.querySelectorAll('.agent-only, .supervisor-only, .admin-only').forEach(btn => {
      btn.style.display = 'none';
    });
    
    // Afficher les boutons selon le rôle
    switch (role.toLowerCase()) {
      case 'admin':
        document.querySelectorAll('.admin-only').forEach(btn => {
          btn.style.display = 'flex';
        });
        // Les admins voient aussi les actions superviseur
        document.querySelectorAll('.supervisor-only').forEach(btn => {
          btn.style.display = 'flex';
        });
        break;
        
      case 'supervisor':
        document.querySelectorAll('.supervisor-only').forEach(btn => {
          btn.style.display = 'flex';
        });
        break;
        
      case 'agent':
      default:
        document.querySelectorAll('.agent-only').forEach(btn => {
          btn.style.display = 'flex';
        });
        break;
    }
    
    console.log(`🔐 Actions mises à jour pour le rôle: ${role}`);
  } catch (error) {
    console.error('Erreur mise à jour rôles:', error);
  }
}

document.addEventListener('DOMContentLoaded', updateCircleActionsVisibility);
window.addEventListener('storage', (e) => {
  if (e && e.key === 'jwt') updateCircleActionsVisibility();
});

// Bouton retour générique
function attachBackButtons() {
  try {
    document.querySelectorAll('[data-back]')?.forEach((b)=>{
      if (b._backBound) return; b._backBound = true;
      b.addEventListener('click', (e)=>{ e.preventDefault(); history.length > 1 ? history.back() : (window.location.href = '/'); });
    });
  } catch {}
}
document.addEventListener('DOMContentLoaded', attachBackButtons);
window.addEventListener('load', attachBackButtons);

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
    // Ne pas supprimer le token automatiquement ni rediriger.
    console.warn('401 détecté: accès non autorisé');
    try {
      let banner = document.getElementById('global-auth-banner');
      const container = document.querySelector('.main-content') || document.querySelector('.container') || document.body;
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'global-auth-banner';
        banner.style.cssText = 'margin:12px 0;padding:12px 16px;border-radius:8px;background:#fff3cd;color:#664d03;border:1px solid #ffe69c;';
        banner.textContent = '🔒 Session requise. Ouvrez la page d\'accueil pour vous connecter, puis revenez.';
        container.prepend(banner);
      }
    } catch {}
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
  // Protection contre les boucles
  if (isLoginInProgress) {
    console.log('⚠️ Connexion déjà en cours, ignorée');
    return;
  }
  
  if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    console.log('❌ Trop de tentatives de connexion, arrêt');
    return;
  }
  
  isLoginInProgress = true;
  loginAttempts++;
  
  try {
    console.log('🔐 Tentative de connexion automatique...', loginAttempts);
    
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
      
      // Réinitialiser les compteurs
      loginAttempts = 0;
      isLoginInProgress = false;
      
      // Mettre à jour l'interface sans recharger la page
      await loadAgentProfile();
      await updateNavbar();
      
      // Afficher la section principale
      const authSection = $('auth-section');
      const appSection = $('app-section');
      if (authSection) authSection.classList.add('hidden');
      if (appSection) appSection.classList.remove('hidden');
    } else {
      throw new Error(response.message || 'Échec de la connexion');
    }
  } catch (e) {
    console.error('❌ Erreur de connexion automatique:', e);
    isLoginInProgress = false;
    
    // Si c'est une erreur 429 (Too Many Requests), arrêter complètement
    if (e.message && e.message.includes('429')) {
      console.log('❌ Trop de requêtes, arrêt des tentatives');
      loginAttempts = MAX_LOGIN_ATTEMPTS;
    }
    
    // Attendre avant la prochaine tentative
    if (loginAttempts < MAX_LOGIN_ATTEMPTS) {
      setTimeout(() => {
        isLoginInProgress = false;
      }, 5000); // Attendre 5 secondes
    }
    
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
  
  // Assurer que navigation.js est chargé avant de l'utiliser
  if (!window.navigation || typeof window.navigation.updateForUser !== 'function') {
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {}
  }
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
    
    // Vérifier si on a déjà tenté cette connexion récemment
    const lastAttempt = localStorage.getItem('lastLoginAttempt');
    const now = Date.now();
    if (lastAttempt && (now - parseInt(lastAttempt)) < 30000) { // 30 secondes sur Vercel
      console.log('⚠️ Tentative de connexion trop récente, ignorée');
      return;
    }
    
    // Sur Vercel, limiter les tentatives de connexion automatique
    if (window.location.hostname.includes('vercel.app')) {
      const vercelAttempts = parseInt(localStorage.getItem('vercelLoginAttempts') || '0');
      if (vercelAttempts >= 3) {
        console.log('⚠️ Trop de tentatives de connexion sur Vercel, arrêt');
        return;
      }
      localStorage.setItem('vercelLoginAttempts', (vercelAttempts + 1).toString());
    }
    
    // Marquer cette tentative
    localStorage.setItem('lastLoginAttempt', now.toString());
    
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
  try { await updateNavbar(); } catch {}
  
  const authSection = $('auth-section');
  const appSection = $('app-section');
  if (jwt) { 
    // Vérifier d'abord la validité du token
    try {
      const testResponse = await api('/profile');
      if (!testResponse || testResponse.error) {
        console.warn('⚠️ Token possiblement invalide; poursuivre sans déconnecter');
      }
    } catch (error) {
      console.warn('⚠️ Erreur de validation du token; poursuivre sans déconnecter:', error.message);
    }

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
        // Ne plus rediriger automatiquement. Afficher une notification et mettre en avant le lien Profil.
        try {
          showNotification('Complétez votre profil depuis le menu « Mon Profil »', 'warning', 6000);
          const profileNav = document.querySelector('a[href="/profile.html"]');
          if (profileNav) {
            profileNav.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.6)';
            profileNav.style.transform = 'scale(1.02)';
            setTimeout(() => {
              profileNav.style.boxShadow = '';
              profileNav.style.transform = '';
            }, 3000);
          }
        } catch {}
        // Continuer sans forcer la navigation
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

  const loginFormEl = document.getElementById('login-form');
  if (loginFormEl && typeof loginFormEl.addEventListener === 'function') loginFormEl.addEventListener('submit', async (ev) => {
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
          // Ne plus rediriger automatiquement. Informer l'utilisateur.
          try {
            showNotification('Profil incomplet: cliquez sur « Mon Profil » pour terminer', 'warning', 6000);
            const profileNav = document.querySelector('a[href="/profile.html"]');
            if (profileNav) {
              profileNav.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.6)';
              profileNav.style.transform = 'scale(1.02)';
              setTimeout(() => {
                profileNav.style.boxShadow = '';
                profileNav.style.transform = '';
              }, 3000);
            }
          } catch {}
          // Ne pas interrompre le flux de la page d'accueil
        }
      } catch {}

      await loadAgentProfile();
      
  // Charger les données après connexion en parallèle pour améliorer les performances
  await Promise.all([
    loadPresenceData(),
    loadDashboardMetrics()
  ]);
  
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
      // Rendre immédiatement les actions circulaires
      try { updateCircleActionsVisibility(); } catch {}
    } catch (e) { 
      console.error('Erreur de connexion:', e);
      
      // Gestion intelligente des erreurs de connexion
      let errorMessage = 'Erreur de connexion.';
      let suggestions = [];
      
      if (e.message && e.message.includes('401')) {
        errorMessage = 'Identifiants incorrects.';
        suggestions = [
          'Vérifiez votre email et mot de passe',
          'Si vous avez oublié votre mot de passe, cliquez sur "Mot de passe oublié"',
          'Si vous n\'avez pas encore de compte, cliquez sur "Inscription Agent"'
        ];
      } else if (e.message && e.message.includes('404')) {
        errorMessage = 'Compte non trouvé.';
        suggestions = [
          'Vérifiez votre adresse email',
          'Si vous n\'avez pas encore de compte, cliquez sur "Inscription Agent"',
          'Contactez votre administrateur si vous pensez que c\'est une erreur'
        ];
      } else if (e.message && e.message.includes('429')) {
        errorMessage = 'Trop de tentatives de connexion.';
        suggestions = [
          'Attendez quelques minutes avant de réessayer',
          'Si le problème persiste, contactez votre administrateur'
        ];
      } else {
        suggestions = [
          'Vérifiez votre connexion internet',
          'Réessayez dans quelques instants',
          'Contactez votre administrateur si le problème persiste'
        ];
      }
      
      showEnhancedErrorMessage(errorMessage, suggestions);
    }
  });

  // Variables pour la récupération de mot de passe
  let recoveryEmail = '';
  
  // Fonctions pour la récupération de mot de passe
  function showForgotPasswordForm() {
    const loginContainer = $('login-form-container');
    const registerContainer = $('register-form-container');
    const forgotContainer = $('forgot-password-container');
    const resetContainer = $('reset-password-container');
    
    if (loginContainer) loginContainer.style.display = 'none';
    if (registerContainer) registerContainer.style.display = 'none';
    if (forgotContainer) forgotContainer.style.display = 'block';
    if (resetContainer) resetContainer.style.display = 'none';
    
    // Masquer les onglets
    document.querySelectorAll('.auth-tab').forEach(tab => tab.style.display = 'none');
  }
  
  function showResetPasswordForm() {
    const loginContainer = $('login-form-container');
    const registerContainer = $('register-form-container');
    const forgotContainer = $('forgot-password-container');
    const resetContainer = $('reset-password-container');
    
    if (loginContainer) loginContainer.style.display = 'none';
    if (registerContainer) registerContainer.style.display = 'none';
    if (forgotContainer) forgotContainer.style.display = 'none';
    if (resetContainer) resetContainer.style.display = 'block';
    
    // Masquer les onglets
    document.querySelectorAll('.auth-tab').forEach(tab => tab.style.display = 'none');
  }

  // Gestion des onglets d'authentification
  function showLoginForm() {
    const loginContainer = $('login-form-container');
    const registerContainer = $('register-form-container');
    const forgotContainer = $('forgot-password-container');
    const resetContainer = $('reset-password-container');
    
    if (loginContainer) {
      loginContainer.style.display = 'block';
    }
    if (registerContainer) {
      registerContainer.style.display = 'none';
    }
    if (forgotContainer) {
      forgotContainer.style.display = 'none';
    }
    if (resetContainer) {
      resetContainer.style.display = 'none';
    }
    
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
    if (loginTab) {
      loginTab.classList.add('active');
    }
  }
  // Expose globally for navbar buttons without inline JS (guarded)
  if (typeof window !== 'undefined') {
    window.showLoginForm = showLoginForm;
    try { window.showForgotPasswordForm = showForgotPasswordForm; } catch {}
    try { window.showResetPasswordForm = showResetPasswordForm; } catch {}
  }

  window.showRegisterForm = () => {
    $('login-form-container').classList.add('hidden');
    $('login-form-container').classList.remove('block');
    $('register-form-container').classList.remove('hidden');
    $('register-form-container').classList.add('block');
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('.auth-tab[data-tab="register"]')?.classList.add('active');
  };

  // Gestion du formulaire d'inscription
  const registerForm = $('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = $('name').value.trim();
    const email = $('email').value.trim();
    const password = $('password').value.trim();
    const confirmPassword = $('confirmPassword').value.trim();
    
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
        // Afficher le formulaire de connexion après inscription
        window.showLoginForm();
      } else {
        alert(data.message || 'Erreur lors de l\'inscription');
      }
      await loadAgentProfile();
    try { await updateNavbar(); } catch {}
    } catch (e) { 
      alert('Échec de la création du compte: ' + (e.message || 'Erreur inconnue'));
    }
    });
  }

  // Bouton simple: débuter la mission
  const startBtnEl = $('start-mission');
  const endBtnEl = $('end-mission');
  if (startBtnEl && !startBtnEl._bound) {
    startBtnEl.addEventListener('click', async () => {
      const status = $('status');
      await startMission(startBtnEl, status);
    });
    startBtnEl._bound = true;
  }

  // Bouton pour forcer l'envoi des présences en file (offline)
  const flushBtn = $('flush-queue');
  if (flushBtn && !flushBtn._bound) {
    flushBtn.addEventListener('click', async () => {
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          const mc = new MessageChannel();
          const promise = new Promise((resolve) => {
            mc.port1.onmessage = () => resolve(true);
            setTimeout(() => resolve(false), 5000);
          });
          navigator.serviceWorker.controller.postMessage({ type: 'flush-queue' }, [mc.port2]);
          const ok = await promise;
          showNotification(ok ? 'Présences envoyées au serveur' : 'File traitée (vérifiez le réseau)', ok ? 'success' : 'info');
          try { await refreshCheckins(); } catch {}
          try { await loadPresenceData(); } catch {}
        } else {
          showNotification('Service Worker non actif', 'warning');
        }
      } catch {
        showNotification("Impossible d'envoyer maintenant", 'warning');
      }
    });
    flushBtn._bound = true;
  }

  if (endBtnEl && !endBtnEl._bound) {
    endBtnEl.addEventListener('click', async () => {
      const status = $('status');
      await endMission(currentMissionId, endBtnEl, status);
    });
    endBtnEl._bound = true;
    try { endBtnEl.textContent = 'Finir mission'; } catch {}
  }

  // Si une mission a été démarrée en offline, activer le bouton de fin et le flush
  try {
    const offlineActive = localStorage.getItem('hasActiveMissionOffline') === 'true';
    if (offlineActive) {
      const endBtn = $('end-mission');
      if (endBtn) endBtn.disabled = false;
      const startBtn = $('start-mission');
      if (startBtn) startBtn.disabled = true;
      const flushBtn2 = $('flush-queue');
      if (flushBtn2) flushBtn2.disabled = false;
    }
  } catch {}

  // Fonction pour commencer une mission
  async function startMission(button, status) {
    try {
      // Exiger une photo avant démarrage
      const photoInput = $('photo');
      const selectedPhoto = photoInput && photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
      if (!selectedPhoto) {
        // Notification plus visible et explicite
        showNotification('📸 Photo obligatoire ! Veuillez prendre une photo avant de débuter la mission.', 'error');
        
        // Animation du bouton pour attirer l'attention
        if (button) {
          button.style.animation = 'shake 0.5s ease-in-out';
          setTimeout(() => {
            if (button) button.style.animation = '';
          }, 500);
        }
        
        // Ouvrir automatiquement le sélecteur de photo
        try { 
          if (photoInput && photoInput.click) {
            photoInput.click();
          }
        } catch {}
        
        return;
      }
      
      // Vérifier les heures de présence avant de commencer
      if (!isWithinWorkHours()) {
        const workStatus = getWorkHoursStatus();
        removeLoadingState(button);
        status.textContent = `❌ ${workStatus.message}`;
        status.style.color = '#dc3545';
        showNotification(`Présence autorisée uniquement de ${formatWorkHours()}. ${workStatus.message}`, 'warning');
        return;
      }
      
      createRippleEffect({ currentTarget: button, clientX: 0, clientY: 0 });
      addLoadingState(button, 'Récupération GPS...');
      
      let coords = await getCurrentLocationWithValidation();
      // Sauvegarder immédiatement la position trouvée (si valide) et notifier
      if (coords && isFinite(coords.latitude) && isFinite(coords.longitude)) {
        try {
          localStorage.setItem('lastGPS', JSON.stringify({
            lat: Number(coords.latitude),
            lon: Number(coords.longitude),
            accuracy: Number(coords.accuracy || 0),
            timestamp: Date.now()
          }));
        } catch {}
        try { showNotification(`Position sauvegardée: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (~${Math.round(coords.accuracy||0)}m)`, 'success'); } catch {}
      }
      // Fallback: si coords invalides ou précision extrême, utiliser le dernier GPS stocké
      if (!coords || !isFinite(coords.latitude) || !isFinite(coords.longitude) || coords.accuracy > 10000) {
        try {
          const last = JSON.parse(localStorage.getItem('lastGPS') || '{}');
          if (isFinite(last.lat) && isFinite(last.lon)) {
            coords = { latitude: Number(last.lat), longitude: Number(last.lon), accuracy: Number(last.accuracy || 9999) };
            console.log('📍 Utilisation du GPS en cache:', coords);
          }
        } catch {}
      }
      
      // Validation plus permissive pour Vercel
      if (!coords || !isFinite(coords.latitude) || !isFinite(coords.longitude)) {
        // Détecter si on est sur Vercel
        const isVercel = false; // désactivé pour build APK basé Render
        
        if (isVercel) {
          // Sur Vercel, utiliser des coordonnées fixes du Bénin
          coords = {
            latitude: 9.3077,
            longitude: 2.3158,
            accuracy: 1000
          };
          console.log('📍 Vercel détecté - Utilisation coordonnées fixes Bénin:', coords);
        } else {
          // Essayer de générer des coordonnées par défaut pour le Bénin
          const beninCoords = {
            latitude: 9.3077 + (Math.random() - 0.5) * 0.1, // Latitude du Bénin avec variation
            longitude: 2.3158 + (Math.random() - 0.5) * 0.1, // Longitude du Bénin avec variation
            accuracy: 10000
          };
          coords = beninCoords;
          console.log('📍 Utilisation des coordonnées par défaut du Bénin:', coords);
        }
      }
      
      // Vérifier la précision et demander confirmation si faible
      let lowPrecision = false;
      if (coords.accuracy > 500) {
        const proceed = confirm(`Précision GPS faible (~${Math.round(coords.accuracy)} m). Voulez-vous enregistrer quand même ?`);
        if (!proceed) {
          status.textContent = 'Précision insuffisante';
          showNotification('Enregistrement annulé. Améliorez le signal et réessayez.', 'warning');
          return;
        }
        lowPrecision = true;
      }
      const fd = new FormData();
      
      fd.append('lat', String(coords.latitude));
      fd.append('lon', String(coords.longitude));
      fd.append('departement', $('departement').value);
      fd.append('commune', $('commune').value);
      fd.append('arrondissement', $('arrondissement').value);
      fd.append('village', $('village').value);
      if (typeof coords.accuracy !== 'undefined') fd.append('accuracy', String(Math.round(coords.accuracy)));
      // Ajouter l'horodatage de la capture
      fd.append('captured_at', new Date().toISOString());
      const baseNote = $('note').value || 'Début de mission';
      if (lowPrecision) {
        fd.append('note', `${baseNote} (faible précision ~${Math.round(coords.accuracy)}m)`);
      } else {
        fd.append('note', baseNote);
      }
      
      const photo = selectedPhoto;
      if (photo) fd.append('photo', photo);

      status.textContent = 'Envoi...';
      
      const data = await api('/presence/start', { method: 'POST', body: fd });
      // Tenter de récupérer l'ID de mission créé et activer les actions liées
      const missionIdFromResp = (data && (data.mission_id || (data.mission && data.mission.id)))
        || (data && data.data && (data.data.mission_id || (data.data.mission && data.data.mission.id)));
      if (missionIdFromResp) {
        currentMissionId = missionIdFromResp;
        try { localStorage.setItem('currentMissionId', String(currentMissionId)); } catch {}
        invalidateMissionCheckins(currentMissionId);
      } else {
        try {
          const missionsResponse = await api('/me/missions');
          const missions = Array.isArray(missionsResponse)
            ? missionsResponse
            : (missionsResponse.missions || (missionsResponse.data && missionsResponse.data.missions) || []);
          const active = missions.find(m => m.status === 'active');
          if (active) { 
            currentMissionId = active.id; 
            try { localStorage.setItem('currentMissionId', String(currentMissionId)); } catch {}
            invalidateMissionCheckins(currentMissionId);
          }
        } catch {}
      }
      
      status.textContent = 'Position signalée - Mission démarrée';
      animateElement(status, 'bounce');
      showNotification('Position journalière signalée - Mission démarrée !', 'success');
      // Persister l'état de mission en local
      try {
        localStorage.setItem('mission_in_progress', 'true');
        localStorage.setItem('mission_start_at', String(Date.now()));
      } catch {}
      
      await refreshCheckins();
      await loadPresenceData();
      try { await computeAndStoreDailyDistance(currentMissionId); } catch {}
      try { markTodayPresentOnCalendar(); } catch {}
      try { notifyPresenceUpdate('start'); } catch {}
      
      // Activer le bouton Finir position et désactiver début
      const endBtn = $('end-mission');
      if (endBtn) endBtn.disabled = false;
      if (button) button.disabled = true;
      const checkinBtn = $('checkin-btn');
      if (checkinBtn) checkinBtn.disabled = false;
      
    } catch (e) {
      // Pas d'erreur bloquante: mettre en file et notifier doucement
      console.warn('Début mission offline ou erreur réseau, mise en file:', e?.message || e);
      status.textContent = 'Présence en file (offline)';
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
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('jwt') || '') },
            payload
          });
        }
      } catch {}
      try { showNotification('Hors ligne: présence mise en file. Elle sera envoyée dès retour réseau.', 'info'); } catch {}
      // Considérer la mission comme active côté UI pour permettre la fin même offline
      try {
        localStorage.setItem('hasActiveMissionOffline', 'true');
        localStorage.setItem('mission_in_progress', 'true');
        if (!localStorage.getItem('mission_start_at')) {
          localStorage.setItem('mission_start_at', String(Date.now()));
        }
      } catch {}
      const endBtn = $('end-mission');
      if (endBtn) endBtn.disabled = false;
      if (button) button.disabled = true;
      const flushBtn3 = $('flush-queue');
      if (flushBtn3) flushBtn3.disabled = false;
    } finally {
      removeLoadingState(button);
    }
  }

  // Désactiver le bouton démarrer tant qu'aucune photo n'est fournie
  try {
    const startBtnGuard = $('start-mission');
    const photoInputEl = $('photo');
    if (startBtnGuard && photoInputEl) {
      startBtnGuard.disabled = !(photoInputEl.files && photoInputEl.files[0]);
      if (!photoInputEl._boundEnableOnChange) {
        photoInputEl.addEventListener('change', () => {
          startBtnGuard.disabled = !(photoInputEl.files && photoInputEl.files[0]);
        });
        photoInputEl._boundEnableOnChange = true;
      }
    }
  } catch {}

  // Fonction pour finir une mission
  async function endMission(missionId, button, status) {
    try {
      // Vérifier les heures de présence avant de finir
      if (!isWithinWorkHours()) {
        const workStatus = getWorkHoursStatus();
        removeLoadingState(button);
        status.textContent = `❌ ${workStatus.message}`;
        status.style.color = '#dc3545';
        showNotification(`Présence autorisée uniquement de ${formatWorkHours()}. ${workStatus.message}`, 'warning');
        return;
      }
      
      createRippleEffect({ currentTarget: button, clientX: 0, clientY: 0 });
      addLoadingState(button, 'Récupération GPS...');
      
      let coords = await getCurrentLocationWithValidation();
      // Sauvegarder immédiatement la position trouvée (si valide) et notifier
      if (coords && isFinite(coords.latitude) && isFinite(coords.longitude)) {
        try {
          localStorage.setItem('lastGPS', JSON.stringify({
            lat: Number(coords.latitude),
            lon: Number(coords.longitude),
            accuracy: Number(coords.accuracy || 0),
            timestamp: Date.now()
          }));
        } catch {}
        try { showNotification(`Position sauvegardée: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (~${Math.round(coords.accuracy||0)}m)`, 'success'); } catch {}
      }
      if (!coords || !isFinite(coords.latitude) || !isFinite(coords.longitude) || coords.accuracy > 10000) {
        try {
          const last = JSON.parse(localStorage.getItem('lastGPS') || '{}');
          if (isFinite(last.lat) && isFinite(last.lon)) {
            coords = { latitude: Number(last.lat), longitude: Number(last.lon), accuracy: Number(last.accuracy || 9999) };
          }
        } catch {}
      }
      let lowPrecision = false;
      if (!coords || !isFinite(coords.latitude) || !isFinite(coords.longitude)) {
        status.textContent = 'Erreur GPS';
        showNotification('GPS invalide. Activez la localisation et réessayez.', 'error');
        return;
      }
      if (coords.accuracy > 500) {
        const proceed = confirm(`Précision GPS faible (~${Math.round(coords.accuracy)} m). Voulez-vous enregistrer quand même ?`);
        if (!proceed) {
          status.textContent = 'Précision insuffisante';
          showNotification('Enregistrement annulé. Améliorez le signal et réessayez.', 'warning');
          return;
        }
        lowPrecision = true;
      }
      // (déduplication)
      const fd = new FormData();
      
      if (missionId) {
        fd.append('mission_id', String(missionId));
      }
      fd.append('lat', String(coords.latitude));
      fd.append('lon', String(coords.longitude));
      fd.append('note', $('note').value || 'Fin de mission');
      if (typeof coords.accuracy !== 'undefined') fd.append('accuracy', String(Math.round(coords.accuracy)));
      
      const photo = $('photo').files[0];
      if (photo) fd.append('photo', photo);
      if (lowPrecision) {
        const baseNote = $('note').value || 'Fin de mission';
        fd.set('note', `${baseNote} (faible précision ~${Math.round(coords.accuracy)}m)`);
      }
      
      status.textContent = 'Envoi...';
      
      // Inclure mission_id si connu (éviter doublon)
      if (missionId && !fd.has('mission_id')) fd.append('mission_id', String(missionId));
      await api('/presence/end', { method: 'POST', body: fd });
      invalidateMissionCheckins(missionId);

      status.textContent = 'Position signalée - Mission terminée';
      animateElement(status, 'bounce');
      showNotification('Position journalière signalée - Mission terminée !', 'success');
      
      await refreshCheckins();
      await loadPresenceData();
      try { await computeAndStoreDailyDistance(missionId); } catch {}
      try { notifyPresenceUpdate('end'); } catch {}
      
      // Réactiver le bouton Débuter et désactiver Finir
      const startBtn = $('start-mission');
      if (startBtn) startBtn.disabled = false;
      if (button) button.disabled = true;
      // Garder le bouton check-in actif pour envoyer la présence finale
      const checkinBtn = $('checkin-btn');
      if (checkinBtn) checkinBtn.disabled = false;
      currentMissionId = null;
      try { localStorage.removeItem('currentMissionId'); } catch {}
      try {
        localStorage.removeItem('mission_in_progress');
        localStorage.removeItem('mission_start_at');
      } catch {}
      
      // Recharger l'historique des missions avec heures de début/fin fiables
      try {
        const missionsResponse = await api('/me/missions');
        const missions = Array.isArray(missionsResponse) ? missionsResponse : (missionsResponse.missions || []);
        await renderMissionHistory(missions);
      } catch {}
      
    } catch (e) {
      // Pas d'erreur bloquante: mettre en file et notifier doucement
      console.warn('Fin mission offline ou erreur réseau, mise en file:', e?.message || e);
      status.textContent = 'Fin en file (offline)';
      try {
        const payload = {
          mission_id: missionId,
          note: $('note').value || 'Fin de mission (offline)'
        };
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'queue-presence',
            endpoint: '/api/presence/end',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('jwt') || '') },
            payload
          });
        }
      } catch {}
      try { showNotification('Hors ligne: fin de mission mise en file. Elle sera envoyée dès retour réseau.', 'info'); } catch {}
      // Fin en offline: marquer la mission locale comme terminée
      try {
        localStorage.removeItem('hasActiveMissionOffline');
        localStorage.removeItem('mission_in_progress');
        localStorage.removeItem('mission_start_at');
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
        try { notifyPresenceUpdate('force-end'); } catch {}
        
        // Réactiver le bouton Débuter et désactiver Finir
        const startBtn = $('start-mission');
        if (startBtn) startBtn.disabled = false;
        if (button) button.disabled = true;
        const checkinBtn = $('checkin-btn');
      if (checkinBtn) checkinBtn.disabled = true;
      currentMissionId = null;
      try { localStorage.removeItem('currentMissionId'); } catch {}
        
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
    forceBtn.addEventListener('click', () => forceEndMission(missionId, forceBtn, status));
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

  const checkinBtn = $('checkin-btn');
  if (checkinBtn && !checkinBtn._bound) {
    checkinBtn.addEventListener('click', async () => {
      // Vérifier les heures de présence avant d'enregistrer
      if (!isWithinWorkHours()) {
        const workStatus = getWorkHoursStatus();
        const status = $('status');
        if (status) {
          status.textContent = `❌ ${workStatus.message}`;
          status.style.color = '#dc3545';
        }
        showNotification(`Présence autorisée uniquement de ${formatWorkHours()}. ${workStatus.message}`, 'warning');
        return;
      }
      
      // Enregistrer la mission de la journée: clôturer sans GPS
      // Restaurer mission active si manquante
    if (!currentMissionId) {
      try {
        const saved = localStorage.getItem('currentMissionId');
        if (saved) currentMissionId = Number(saved);
      } catch {}
      try {
          if (!currentMissionId) {
        const missionsResponse = await api('/me/missions');
        const missions = Array.isArray(missionsResponse) ? missionsResponse : (missionsResponse.missions || []);
        const active = missions.find(m => m.status === 'active');
        if (active) { currentMissionId = active.id; try { localStorage.setItem('currentMissionId', String(currentMissionId)); } catch {} }
          }
      } catch {}
      if (!currentMissionId) {
        const status = $('status');
          status.textContent = 'Aucune mission active';
          showNotification('Aucune mission active à enregistrer.', 'warning');
          return;
        }
      }
      const status = $('status');
      const btn = $('checkin-btn');
      createRippleEffect({ currentTarget: btn, clientX: 0, clientY: 0 });
      addLoadingState(btn, 'Enregistrement...');
      try {
        await api(`/missions/${currentMissionId}/complete`, { method: 'POST', body: { note: $('note').value || '' } });
        invalidateMissionCheckins(currentMissionId);
        status.textContent = 'Mission enregistrée';
          animateElement(status, 'bounce');
        showNotification('Mission de la journée enregistrée et clôturée.', 'success');
        const startBtn = $('start-mission'); if (startBtn) startBtn.disabled = false;
        const endBtn = $('end-mission'); if (endBtn) endBtn.disabled = true;
        try { await computeAndStoreDailyDistance(currentMissionId); } catch {}
        currentMissionId = null; try { localStorage.removeItem('currentMissionId'); } catch {}
          await refreshCheckins();
        await loadPresenceData();
        // Rafraîchir l'historique des missions pour voir le statut "completed"
        try {
          const missionsResponse = await api('/me/missions');
          const missions = Array.isArray(missionsResponse) ? missionsResponse : (missionsResponse.missions || []);
          await renderMissionHistory(missions);
        } catch {}
        try { notifyPresenceUpdate('complete'); } catch {}
        } catch (e) {
        status.textContent = 'Erreur enregistrement';
        showNotification("Erreur lors de l'enregistrement de la mission.", 'error');
      } finally {
        removeLoadingState(btn);
      }
    });
    checkinBtn._bound = true;
  }

  // Helper: rendu de l'historique avec calcul des heures si manquantes
  async function renderMissionHistory(missions) {
    const historyEl = $('missions-history');
    if (!historyEl) return;
    historyEl.innerHTML = '';
    // Rendre en parallèle pour rapidité
    const items = await Promise.all((missions || []).map(async (m) => {
      let startStr = '-';
      let endStr = '-';
      let distanceStr = null;
      let startMs = null;
      let endMs = null;
      try {
        // Vérifier les deux formats possibles : start_time/end_time ou date_start/date_end
        const startTime = m.start_time || m.date_start;
        const endTime = m.end_time || m.date_end;
        
        if (startTime) {
          const d = new Date(startTime);
          if (!isNaN(d.getTime())) {
            startStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            startMs = d.getTime();
          }
        }
        
        if (endTime) {
          const d = new Date(endTime);
          if (!isNaN(d.getTime())) {
            endStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            endMs = d.getTime();
          }
        }
        // Distance: depuis mission si présent, sinon depuis cache, sinon calcul
        if (typeof m.total_distance_m !== 'undefined' && m.total_distance_m !== null) {
          const d = Number(m.total_distance_m);
          if (Number.isFinite(d)) distanceStr = `${Math.round(d)} m`;
        }
        if (!distanceStr) {
          try {
            const cached = localStorage.getItem(`mission:${m.id}:total_distance_m`);
            if (cached && Number.isFinite(Number(cached))) distanceStr = `${Math.round(Number(cached))} m`;
          } catch {}
        }

        const checkinRows = await getMissionCheckinsCached(m.id);
        if (checkinRows && checkinRows.length) {
          const normalized = checkinRows
            .map(row => {
              const ts = row.timestamp || row.created_at || row.date || row.checked_at;
              return { row, ts };
            })
            .filter(entry => entry.ts && !isNaN(new Date(entry.ts).getTime()))
            .sort((a, b) => new Date(a.ts) - new Date(b.ts));

          if (normalized.length) {
            const firstDate = new Date(normalized[0].ts);
            if (!isNaN(firstDate.getTime())) {
              startMs = firstDate.getTime();
              startStr = firstDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            }

            const lastDate = new Date(normalized[normalized.length - 1].ts);
            const missionCompleted = String(m.status || '').toLowerCase() === 'completed';
            if (missionCompleted && !isNaN(lastDate.getTime())) {
              endMs = lastDate.getTime();
              endStr = lastDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            }

            if (!distanceStr) {
              const points = normalized
                .map(({ row, ts }) => ({
                  lat: Number(row.lat),
                  lon: Number(row.lon),
                  ts: new Date(ts).getTime()
                }))
                .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.ts));

              if (points.length >= 2) {
                const toRad = (v) => (v * Math.PI) / 180;
                const R = 6371000;
                let total = 0;
                for (let i = 1; i < points.length; i++) {
                  const a = points[i - 1];
                  const b = points[i];
                  const dLat = toRad(b.lat - a.lat);
                  const dLon = toRad(b.lon - a.lon);
                  const lat1 = toRad(a.lat);
                  const lat2 = toRad(b.lat);
                  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
                  const c = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
                  total += R * c;
                }
                const totalMeters = Math.round(total);
                distanceStr = `${totalMeters} m`;
                try { localStorage.setItem(`mission:${m.id}:total_distance_m`, String(totalMeters)); } catch {}
              }
            }
          }
        }
      } catch {}
      const li = document.createElement('li');
      const depName = getDepartementNameById(m.departement);
      // Préférer champs manuels si lookups manquent
      const manualCommune = m.commune && !isFinite(Number(m.commune)) ? m.commune : null;
      const manualArr = m.arrondissement && !isFinite(Number(m.arrondissement)) ? m.arrondissement : null;
      const manualVil = m.village && !isFinite(Number(m.village)) ? m.village : null;
      const comName = manualCommune || getCommuneNameById(m.departement, m.commune);
      const arrText = manualArr || '';
      const vilText = manualVil || '';
      // Durée passée sur le terrain (si heure de début disponible)
      let durationStr = '';
      try {
        if (startMs) {
          const effectiveEnd = endMs || Date.now();
          const diff = Math.max(0, effectiveEnd - startMs);
          const h = Math.floor(diff / 3600000);
          const mns = Math.floor((diff % 3600000) / 60000);
          durationStr = h > 0 ? `${h}h ${mns}min` : `${mns}min`;
          if (!endMs && String(m.status || '').toLowerCase() !== 'completed') durationStr += ' (en cours)';
        }
      } catch {}
      
      // Formater l'affichage : "Heure début - Heure fin (durée)"
      let timeDisplay = '';
      if (startStr !== '-' && endStr !== '-') {
        timeDisplay = `${startStr} - ${endStr}${durationStr ? ` (${durationStr})` : ''}`;
      } else if (startStr !== '-') {
        timeDisplay = `Début: ${startStr}${durationStr ? ` (${durationStr})` : ''}`;
      } else if (endStr !== '-') {
        timeDisplay = `Fin: ${endStr}`;
      } else {
        timeDisplay = 'Heure non disponible';
      }
      
      li.innerHTML = `
        <div class="list-item">
          <div><strong>Mission #${m.id}</strong> — ${m.status}</div>
          <div><strong>${timeDisplay}</strong></div>
          <div>Département: ${depName || '-'} • Commune: ${comName || '-'}</div>
          ${arrText ? `<div>Arrondissement: ${arrText}</div>` : ''}
          ${vilText ? `<div>Village: ${vilText}</div>` : ''}
          <div>Start GPS: ${m.start_lat ?? '-'}, ${m.start_lon ?? '-'} | End GPS: ${m.end_lat ?? '-'}, ${m.end_lon ?? '-'}</div>
          ${distanceStr ? `<div>Distance totale: ${distanceStr}</div>` : ''}
        </div>
      `;
      return li;
    }));
    items.forEach(li => historyEl.appendChild(li));
  }

  // Calculer distance totale parcourue pour la mission du jour et stocker côté serveur si dispo
  async function computeAndStoreDailyDistance(missionId) {
    try {
      if (!missionId) return;
      const resp = await api(`/missions/${missionId}/checkins`);
      const rows = Array.isArray(resp) ? resp : (resp.items || resp.checkins || (resp.data && (resp.data.items || resp.data.checkins)) || []);
      missionCheckinCache.set(Number(missionId), rows || []);
      if (!rows || rows.length < 2) return; // besoin d'au moins deux points
      const points = rows
        .filter(r => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)))
        .map(r => ({ lat: Number(r.lat), lon: Number(r.lon), t: new Date(r.timestamp).getTime() }))
        .sort((a,b)=> a.t - b.t);
      if (points.length < 2) return;
      const toRad = (v) => (v * Math.PI) / 180;
      const R = 6371000;
      let total = 0;
      for (let i = 1; i < points.length; i++) {
        const a = points[i-1];
        const b = points[i];
        const dLat = toRad(b.lat - a.lat);
        const dLon = toRad(b.lon - a.lon);
        const lat1 = toRad(a.lat);
        const lat2 = toRad(b.lat);
        const hav = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2)**2;
        const c = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
        total += R * c;
      }
      const totalMeters = Math.round(total);
      try { localStorage.setItem(`mission:${missionId}:total_distance_m`, String(totalMeters)); } catch {}
      // Si un endpoint existe pour stocker, l'appeler (fallback silencieux si 404)
      try { await api(`/missions/${missionId}/distance`, { method: 'POST', body: { total_distance_m: totalMeters } }); } catch {}
      } catch {}
  }

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
    // Render missions history list (avec heures fiables)
    await renderMissionHistory(missions);
  } catch {}

  // Initialiser l'affichage des heures de travail
  updateWorkHoursDisplay();
  // Mettre à jour toutes les minutes
  setInterval(updateWorkHoursDisplay, 60000);

  // Load geo cascade
  await loadDepartements();
  const depSel = $('departement');
  const comSel = $('commune');
  const arrSel = $('arrondissement');
  const vilSel = $('village');
  if (comSel) { comSel.innerHTML = '<option value="">Sélectionner une commune</option>'; comSel.disabled = true; }
  if (arrSel) { arrSel.innerHTML = '<option value="">Sélectionner un arrondissement</option>'; arrSel.disabled = true; }
  if (vilSel) { vilSel.innerHTML = '<option value="">Sélectionner un village</option>'; vilSel.disabled = true; }

  if (depSel) depSel.onchange = async () => {
    const id = Number(depSel.value);
    if (comSel) { comSel.innerHTML = '<option value="">Sélectionner une commune</option>'; comSel.disabled = true; }
    if (arrSel) { arrSel.innerHTML = '<option value="">Sélectionner un arrondissement</option>'; arrSel.disabled = true; }
    if (vilSel) { vilSel.innerHTML = '<option value="">Sélectionner un village</option>'; vilSel.disabled = true; }
    await loadCommunes(id);
  };
  if (comSel) comSel.onchange = async () => {
    const id = Number(comSel.value);
    if (arrSel) { arrSel.innerHTML = '<option value="">Sélectionner un arrondissement</option>'; arrSel.disabled = true; }
    if (vilSel) { vilSel.innerHTML = '<option value="">Sélectionner un village</option>'; vilSel.disabled = true; }
    await loadArrondissements(id);
  };
  if (arrSel) arrSel.onchange = async () => {
    const id = Number(arrSel.value);
    if (vilSel) { vilSel.innerHTML = '<option value="">Sélectionner un village</option>'; vilSel.disabled = true; }
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
  
  // Ajouter les effets ripple aux boutons (éviter multiples bindings)
  document.querySelectorAll('button, .btn-primary, .btn-secondary').forEach(btn => {
    if (!btn._rippleBound) {
    btn.addEventListener('click', createRippleEffect);
      btn._rippleBound = true;
    }
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
  const items = Array.isArray(response)
    ? response
    : response?.checkins || response?.items || response?.data?.items || response?.data?.checkins || [];
  missionCheckinCache.set(Number(currentMissionId), items || []);
  
  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    const li = document.createElement('li');
    li.className = 'list-item';
    li.style.animationDelay = `${i * 0.1}s`;
    
    const when = new Date(c.timestamp + 'Z').toLocaleString();
    // Durée jusqu'au prochain check-in (ou en cours)
    let durationStr = '';
    try {
      const curTs = new Date(c.timestamp).getTime();
      const nextTs = (i < items.length - 1) ? new Date(items[i+1].timestamp).getTime() : NaN;
      let endTs = Number.isFinite(nextTs) ? nextTs : NaN;
      if (!Number.isFinite(endTs)) {
        // si pas de prochain point, utiliser maintenant (mission en cours)
        endTs = Date.now();
      }
      const diff = Math.max(0, endTs - curTs);
      const h = Math.floor(diff / 3600000);
      const mns = Math.floor((diff % 3600000) / 60000);
      durationStr = h > 0 ? `${h}h ${mns}min` : `${mns}min`;
    } catch {}
    li.innerHTML = `
      <div class="checkin-item">
        <div class="checkin-time">${when}</div>
        <div class="checkin-coords">(${c.lat.toFixed(5)}, ${c.lon.toFixed(5)})</div>
        ${durationStr ? `<div class="checkin-duration">Durée jusqu'au suivant: ${durationStr}</div>` : ''}
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
  // Protection contre les appels répétés
  if (isLoadingProfile) {
    console.log('🔄 loadAgentProfile déjà en cours, ignoré');
    return;
  }
  
  isLoadingProfile = true;
  
  try {
    // Récupérer l'email depuis l'URL ou le localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email') || localStorage.getItem('userEmail');
    if (!email) { return; }
    const profile = await getCachedProfile(email);
    if (!profile) {
      console.warn('⚠️ Impossible de charger le profil');
      return;
    }
    
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
    
    console.log('✅ Profil agent chargé:', profile);
  } catch (e) {
    console.error('Error loading agent profile:', e);
  } finally {
    isLoadingProfile = false; // Réinitialiser le flag
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
    let response;
    try {
      response = await api(`/presence/stats?year=${year}&month=${month}&email=${encodeURIComponent(email)}`);
    } catch (err) {
      // tolerate 404 or HTML error bodies
      console.warn('Presence stats request failed, using defaults:', err && err.message);
      response = { success: false };
    }

    if (response && response.success) {
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
    
    // Si on est après 18h30 et qu'aucune présence n'a été marquée aujourd'hui
    if (hour >= 18 || (hour === 18 && today.getMinutes() >= 30)) {
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
  try {
    localStorage.removeItem('jwt');
    localStorage.removeItem('loginData');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('lastUserEmail');
    localStorage.removeItem('vercelLoginAttempts');
    localStorage.setItem('presence_update', JSON.stringify({ type: 'logout', ts: Date.now() }));
  } catch {}
  jwt = '';
  try { showNotification('Déconnexion réussie', 'success', 1500); } catch {}
  setTimeout(() => { window.location.href = '/'; }, 150);
}

// Exposer la fonction logout globalement
window.logout = logout;
window.addEventListener('load', () => { window.logout = logout; });

// Fonction pour afficher des messages d'erreur avec suggestions
function showEnhancedErrorMessage(message, suggestions = [], type = 'error') {
  // Supprimer les anciens messages d'erreur
  const existingError = document.getElementById('enhanced-error-message');
  if (existingError) {
    existingError.remove();
  }
  
  // Créer le conteneur d'erreur
  const errorContainer = document.createElement('div');
  errorContainer.id = 'enhanced-error-message';
  errorContainer.className = 'enhanced-error-message';
  
  // Styles selon le type
  if (type === 'success') {
    errorContainer.style.cssText = `
      background: #efe;
      border: 1px solid #cfc;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
      color: #363;
      font-size: 14px;
      line-height: 1.5;
    `;
  } else {
    errorContainer.style.cssText = `
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
      color: #c33;
      font-size: 14px;
      line-height: 1.5;
    `;
  }
  
  // Message principal
  const mainMessage = document.createElement('div');
  mainMessage.style.cssText = 'font-weight: bold; margin-bottom: 12px; font-size: 16px;';
  const icon = type === 'success' ? '✅' : '❌';
  mainMessage.textContent = `${icon} ${message}`;
  errorContainer.appendChild(mainMessage);
  
  // Suggestions
  if (suggestions.length > 0) {
    const suggestionsTitle = document.createElement('div');
    suggestionsTitle.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #666;';
    suggestionsTitle.textContent = '💡 Que faire :';
    errorContainer.appendChild(suggestionsTitle);
    
    const suggestionsList = document.createElement('ul');
    suggestionsList.style.cssText = 'margin: 0; padding-left: 20px; color: #666;';
    
    suggestions.forEach(suggestion => {
      const li = document.createElement('li');
      li.textContent = suggestion;
      li.style.marginBottom = '4px';
      suggestionsList.appendChild(li);
    });
    
    errorContainer.appendChild(suggestionsList);
  }
  
  // Bouton de fermeture
  const closeButton = document.createElement('button');
  closeButton.textContent = '✕';
  closeButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: #999;
    padding: 4px;
  `;
  closeButton.onclick = () => errorContainer.remove();
  errorContainer.style.position = 'relative';
  errorContainer.appendChild(closeButton);
  
  // Insérer le message d'erreur
  const authSection = document.getElementById('auth-section');
  if (authSection) {
    authSection.insertBefore(errorContainer, authSection.firstChild);
  }
  
  // Auto-suppression après 10 secondes
  setTimeout(() => {
    if (errorContainer.parentNode) {
      errorContainer.remove();
    }
  }, 10000);
}

// Fonction pour nettoyer complètement le cache (utile pour les bases vierges)
function clearAllCache() {
  if (confirm('Voulez-vous nettoyer complètement le cache local ? Cela vous déconnectera et supprimera toutes les données temporaires.')) {
    try {
      localStorage.clear();
      sessionStorage.clear();
      console.log('🧹 Cache complètement nettoyé');
      location.reload();
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
    }
  }
}

// Exposer les fonctions globalement
if (typeof window !== 'undefined') {
  window.logout = logout;
  window.clearAllCache = clearAllCache;
  window.clearCachedUserData = clearCachedUserData;
  // Guard assignments in case functions are not defined yet
  try { window.showLoginForm = showLoginForm; } catch {}
  try { window.showRegisterForm = showRegisterForm; } catch {}
}

// Attacher les handlers de déconnexion sans inline (CSP-compatible)
function bindLogoutButtons() {
  try {
    document.querySelectorAll('.navbar-logout').forEach(btn => {
      if (!btn._logoutBound) {
        btn.addEventListener('click', (ev) => { ev.preventDefault(); try { window.logout(); } catch {} });
        btn._logoutBound = true;
      }
    });
  } catch {}
}

// Attacher tous les gestionnaires d'événements pour les boutons
function bindAllButtons() {
  try {
    // Boutons d'authentification
    document.querySelectorAll('[data-tab="login"]').forEach(btn => {
      if (!btn._loginTabBound) {
        btn.addEventListener('click', (ev) => { ev.preventDefault(); window.showLoginForm(); });
        btn._loginTabBound = true;
      }
    });
    
    document.querySelectorAll('[data-tab="register"]').forEach(btn => {
      if (!btn._registerTabBound) {
        btn.addEventListener('click', (ev) => { ev.preventDefault(); window.showRegisterForm(); });
        btn._registerTabBound = true;
      }
    });
    
    // Boutons d'inscription dans les cartes
    document.querySelectorAll('.btn-register, .btn-inscription, [data-action="register"]').forEach(btn => {
      if (!btn._registerBound) {
        btn.addEventListener('click', (ev) => { 
          ev.preventDefault(); 
          // Rediriger vers la page d'inscription dédiée
          window.location.href = '/register.html';
        });
        btn._registerBound = true;
      }
    });
    
    // Boutons de connexion dans les cartes
    document.querySelectorAll('.btn-login, .btn-connexion, [data-action="login"]').forEach(btn => {
      if (!btn._loginBound) {
        btn.addEventListener('click', (ev) => { ev.preventDefault(); window.showLoginForm(); });
        btn._loginBound = true;
      }
    });
    
    // Boutons de navigation
    document.querySelectorAll('[data-action="navigate"]').forEach(btn => {
      if (!btn._navigateBound) {
        btn.addEventListener('click', (ev) => { 
          ev.preventDefault(); 
          const url = btn.getAttribute('data-url');
          if (url) window.location.href = url;
        });
        btn._navigateBound = true;
      }
    });
    
    // Bouton de déconnexion
    document.querySelectorAll('[data-action="logout"]').forEach(btn => {
      if (!btn._logoutBound) {
        btn.addEventListener('click', (ev) => { ev.preventDefault(); window.logout(); });
        btn._logoutBound = true;
      }
    });
    
    // Bouton menu mobile
    document.querySelectorAll('[data-action="toggle-mobile-menu"]').forEach(btn => {
      if (!btn._menuBound) {
        btn.addEventListener('click', (ev) => { 
          ev.preventDefault(); 
          if (window.navigation && window.navigation.toggleMobileMenu) {
            window.navigation.toggleMobileMenu();
          }
        });
        btn._menuBound = true;
      }
    });
    
    console.log('🔗 Gestionnaires d\'événements attachés');
  } catch (error) {
    console.error('Erreur lors de l\'attachement des gestionnaires:', error);
  }
}

// ===== FONCTIONS DU CALENDRIER =====

async function initializeCalendar() {
  const prevBtn = $('prev-month');
  const nextBtn = $('next-month');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderCalendar();
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      renderCalendar();
    });
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
        // Contraste fort demandé: vert pur en fond et texte noir
        dayElement.style.backgroundColor = '#00ff00';
        dayElement.style.color = '#000';
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
  dayElement.addEventListener('click', () => handleDayClick(day, isOtherMonth));
  
  return dayElement;
}

// Marquer le jour courant comme présent en vert
function markTodayPresentOnCalendar() {
  const calendarGrid = $('calendar-grid');
  const monthYearHeader = $('current-month-year');
  if (!calendarGrid || !monthYearHeader) return;
  const today = new Date();
  const displayed = new Date(monthYearHeader.dataset.year || today.getFullYear(), monthYearHeader.dataset.month || today.getMonth(), 1);
  const isSameMonth = (displayed.getMonth() === today.getMonth() && displayed.getFullYear() === today.getFullYear());
  if (!isSameMonth) return;
  // les 7 premières cellules sont les en-têtes
  const cells = Array.from(calendarGrid.children).slice(7);
  for (const cell of cells) {
    if (cell.classList.contains('calendar-day') && Number(cell.textContent) === today.getDate()) {
      cell.classList.add('present');
      cell.style.background = '#dcfce7';
      cell.style.borderColor = '#16a34a';
      break;
    }
  }
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
    
    if (!jwt) return;
    
    // Période du mois affiché
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

    // Charger missions, check-ins, planifications et validations
    const [missionsResponse, checkinsResponse, plansResponse, validationsResponse] = await Promise.all([
      api('/me/missions').catch(() => ({ missions: [] })),
      api('/checkins/mine').catch(() => ({ items: [] })),
      api(`/planifications?from=${from}&to=${to}`).catch(() => ({ items: [] })),
      api(`/validations/mine?from=${from}&to=${to}`).catch(() => ({ items: [] }))
    ]);
    
    const missions = Array.isArray(missionsResponse) ? missionsResponse : (missionsResponse.missions || []);
    const checkins = checkinsResponse?.items || checkinsResponse?.data?.items || [];
    const plans = plansResponse?.items || [];
    const validations = validationsResponse?.items || [];
    
    // Traiter les données de présence
    presenceData = {};
    
    // 1) Marquer les jours avec des missions
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
    
    // 2) Marquer aussi les jours avec des check-ins (même sans mission complète)
    checkins.forEach(checkin => {
      if (checkin.timestamp) {
        const checkinDate = new Date(checkin.timestamp);
        const dateKey = formatDateKey(checkinDate.getFullYear(), checkinDate.getMonth(), checkinDate.getDate());
        
        // Si pas déjà marqué par une mission, marquer comme présent
        if (!presenceData[dateKey]) {
          presenceData[dateKey] = {
            status: 'present',
            startTime: checkinDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            endTime: null,
            note: checkin.note || '',
            location: checkin.commune || checkin.village || ''
          };
        }
      }
    });

    // 3) Appliquer statut orange (partial) si hors-zone (pour superviseurs) ou mission en cours non terminée
    const partialDates = new Set();
    // a) validations hors tolérance (within_tolerance === false) — uniquement pour les superviseurs
    try {
      const cachedProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      const roleLower = String(cachedProfile.role || '').toLowerCase();
      const isSupervisor = roleLower === 'superviseur' || roleLower === 'supervisor';
      if (isSupervisor) {
        validations.forEach(v => {
          const d = new Date(v.created_at || v.date || v.ts);
          if (!d || isNaN(d.getTime())) return;
          const key = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
          if (v.within_tolerance === false) partialDates.add(key);
        });
      }
    } catch {}
    // b) mission démarrée sans fin ce jour-là
    missions.forEach(m => {
      if (!m.start_time) return;
      const sd = new Date(m.start_time);
      const key = formatDateKey(sd.getFullYear(), sd.getMonth(), sd.getDate());
      const hasEndSameDay = m.end_time && (new Date(m.end_time)).toDateString() === sd.toDateString();
      if (!hasEndSameDay) partialDates.add(key);
    });
    partialDates.forEach(key => {
      if (!presenceData[key]) {
        presenceData[key] = { status: 'partial' };
      } else {
        presenceData[key].status = 'partial';
      }
    });

    // 4) Marquer en rouge (absent) les jours planifiés sans présence après 18h30
    const now = new Date();
    const todayKey = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
    plans.forEach(p => {
      const key = String(p.date).slice(0,10);
      if (!key) return;
      const d = new Date(key + 'T00:00:00');
      const isPastDay = d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const isTodayAfter18 = key === todayKey && now.getHours() >= 18;
      const isPlanned = Boolean(p.planned_start_time || p.planned_end_time || p.description_activite);
      if (!isPlanned) return;
      if (!presenceData[key] && (isPastDay || isTodayAfter18)) {
        presenceData[key] = { status: 'absent' };
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

    // Rappel d'absence à 18h30: si aucune présence, notifier
    const hour = 18; const minute = 30;
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

      notification.addEventListener('click', () => {
        window.focus();
        notification.close();
        // Scroll vers le formulaire de présence
        const presenceCard = document.querySelector('.card h2');
        if (presenceCard && presenceCard.textContent.includes('Présence terrain')) {
          presenceCard.scrollIntoView({ behavior: 'smooth' });
        }
      });

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
    // Désactiver temporairement le détecteur mobile GPS pour éviter les conflits
    // if (window.mobileGPSDetector && window.mobileGPSDetector.isMobile) {
    //   try {
    //     console.log('📱 Utilisation du détecteur mobile GPS');
    //     return await window.mobileGPSDetector.getValidatedPosition();
    //   } catch (mobileError) {
    //     console.warn('⚠️ Erreur détecteur mobile GPS, fallback:', mobileError);
    //     // Continuer avec la méthode normale
    //   }
    // }
    
    // Utiliser le GPS Manager amélioré si disponible, avec repli natif si échec/coordonnées invalides
    if (window.gpsManager) {
      try {
        const pos = await getCurrentLocationWithNotifications();
        if (pos && Number.isFinite(pos.latitude) && Number.isFinite(pos.longitude)) {
          return pos;
        }
        console.warn('gpsManager a renvoyé des coordonnées invalides, recours au navigateur');
      } catch (gmErr) {
        console.warn('gpsManager échec, recours au navigateur:', gmErr);
        // Continuer avec la méthode navigateur ci-dessous
      }
    }

    // Fallback vers l'ancienne méthode
    // Vérifier la permission de géolocalisation si disponible
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') {
          showNotification('Accès GPS refusé', 'Veuillez autoriser la localisation dans votre navigateur (Paramètres > Site > Localisation).');
          throw new Error('Accès GPS refusé');
        }
      }
    } catch {}

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
    
    // Déterminer la précision maximale souhaitée via l'UI
    const gpsPrecision = document.getElementById('gps-precision')?.value || 'medium';
    let targetAccuracy = 500; // fallback
    switch (gpsPrecision) {
      case 'high': targetAccuracy = 50; break;
      case 'medium': targetAccuracy = 150; break;
      case 'low': targetAccuracy = 500; break;
      case 'any': targetAccuracy = Infinity; break;
    }

    // Lecture multi-essais pour améliorer la précision
    const getOnce = () => new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Géolocalisation non supportée'));
      navigator.geolocation.getCurrentPosition((p)=>{
        try {
          const { latitude, longitude, accuracy } = p && p.coords ? p.coords : {};
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return reject(new Error('Coordonnées GPS invalides'));
          }
          resolve(p);
        } catch (e) {
          reject(e);
        }
      }, (err)=>{
        reject(err);
      }, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      });
    });

    const startTs = Date.now();
    const maxWaitMs = 15000;
    let best = null;
    let attempts = 0;
    while (Date.now() - startTs < maxWaitMs && attempts < 4) {
      attempts++;
      try {
        const pos = await getOnce();
        const { latitude, longitude, accuracy } = pos.coords || {};
        if (Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(accuracy)) {
          if (!best || accuracy < best.accuracy) best = { latitude, longitude, accuracy };
          if (accuracy <= targetAccuracy) break;
        }
      } catch (e) {
        // Continuer si timeout, sinon stopper
        if (!(e && String(e.message || e).toLowerCase().includes('timeout'))) {
          throw e;
        }
      }
    }
    if (!best) throw new Error('GPS indisponible');
    const coords = best;
    
    // Vérifier la précision GPS selon le paramètre choisi
    let maxAccuracy = 1000; // Par défaut pour l'avertissement
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
    if (!jwt) return;

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Profil utilisateur
    let me = null;
    try { const res = await api('/me'); me = res?.data?.user || res?.user || null; } catch {}
    const userId = me?.id;

    // Supabase config
    const metaUrl = document.querySelector('meta[name="supabase-url"]')?.content || localStorage.getItem('SUPABASE_URL') || window.SUPABASE_URL || '';
    const metaKey = document.querySelector('meta[name="supabase-anon-key"]')?.content || localStorage.getItem('SUPABASE_ANON_KEY') || window.SUPABASE_ANON_KEY || '';
    const sbUrl = (metaUrl || '').trim().replace(/\/+$/,'');
    const sbKey = (metaKey || '').trim();
    const disableSb = String(localStorage.getItem('DISABLE_SB_DIRECT') || '').trim() === '1';

    const fallbackMetrics = async () => {
      const missionsResponse = await api('/me/missions');
      const missions = Array.isArray(missionsResponse) ? missionsResponse : (missionsResponse.missions || []);
      const metrics = calculateMetrics(missions, now.getMonth(), now.getFullYear());
      displayMetrics(metrics);
      await updateCurrentLocation();
    };

    if (disableSb || !sbUrl || !sbKey || !userId) { await fallbackMetrics(); return; }

    // 1) Référence et rayon depuis Supabase
    let refLat = null, refLon = null, tol = 500, expectedDays = null;
    try {
      const p = new URLSearchParams();
      p.set('select', 'id,reference_lat,reference_lon,tolerance_radius_meters,expected_days_per_month');
      p.set('id', 'eq.' + Number(userId));
      const res = await fetch(`${sbUrl}/rest/v1/users?${p.toString()}`, { headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey } });
      if (res.ok) {
        const arr = await res.json().catch(() => []);
        const u = Array.isArray(arr) ? arr[0] : null;
        if (u) {
          if (u.reference_lat != null) refLat = Number(u.reference_lat);
          if (u.reference_lon != null) refLon = Number(u.reference_lon);
          if (u.tolerance_radius_meters != null) tol = Number(u.tolerance_radius_meters);
          if (u.expected_days_per_month != null) expectedDays = Number(u.expected_days_per_month);
        }
      }
    } catch {}

    // 2) Check-ins utilisateur (mois courant)
    let checkins = [];
    try {
      const fromIso = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0,0,0).toISOString();
      const toIso = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23,59,59).toISOString();

      // Tentative 1: colonne created_at
      const s1 = new URLSearchParams();
      s1.set('select', 'id,user_id,lat,lon,created_at,timestamp');
      s1.set('user_id', 'eq.' + Number(userId));
      s1.set('created_at', 'gte.' + fromIso);
      s1.set('created_at', 'lte.' + toIso);
      s1.set('order', 'created_at.desc');
      let res = await fetch(`${sbUrl}/rest/v1/checkins?${s1.toString()}`, { headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey } });
      if (!res.ok) {
        // Tentative 2: colonne timestamp
        const s2 = new URLSearchParams();
        s2.set('select', 'id,user_id,lat,lon,timestamp,created_at');
        s2.set('user_id', 'eq.' + Number(userId));
        s2.set('timestamp', 'gte.' + fromIso);
        s2.set('timestamp', 'lte.' + toIso);
        s2.set('order', 'timestamp.desc');
        res = await fetch(`${sbUrl}/rest/v1/checkins?${s2.toString()}`, { headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey } });
        if (!res.ok) {
          // Tentative 3: sans filtre de date (limite + tri), on filtrera côté client
          const s3 = new URLSearchParams();
          s3.set('select', 'id,user_id,lat,lon,created_at,timestamp,date');
          s3.set('user_id', 'eq.' + Number(userId));
          s3.set('order', 'id.desc');
          s3.set('limit', '1000');
          res = await fetch(`${sbUrl}/rest/v1/checkins?${s3.toString()}`, { headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey } });
        }
      }
      if (res.ok) checkins = await res.json().catch(() => []);
    } catch {}

    // 3) Calcul distance min/jour
    const toIsoDate = d => d.toISOString().split('T')[0];
    const computeDistanceMeters = (lat1, lon1, lat2, lon2) => {
      try { const toRad = v => (Number(v)*Math.PI)/180; const R=6371000; const dLat=toRad(lat2-lat1); const dLon=toRad(lon2-lon1); const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2; const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); return Math.round(R*c);} catch { return null; }
    };
    const perDay = new Map();
    const isInRange = (d) => {
      try { const x = new Date(d).getTime(); return x >= new Date(from).getTime() && x <= new Date(to).getTime(); } catch { return false; }
    };
    for (const c of checkins) {
      const raw = c.created_at || c.timestamp || c.date;
      if (!raw) continue;
      const dt = new Date(raw);
      if (isNaN(dt.getTime())) continue;
      if (!isInRange(dt)) continue;
      const day = toIsoDate(dt);
      let d = null;
      if (refLat != null && refLon != null && c.lat != null && c.lon != null) d = computeDistanceMeters(Number(refLat), Number(refLon), Number(c.lat), Number(c.lon));
      const prev = perDay.get(day) || { minDist: null, any: false };
      const minDist = (prev.minDist == null) ? d : (d == null ? prev.minDist : Math.min(prev.minDist, d));
      perDay.set(day, { minDist, any: true });
    }

    // 3b) Planifications (jours/ heures planifiées)
    let plannedDaysSet = new Set();
    let plannedHoursTotal = 0;
    try {
      const p = new URLSearchParams();
      p.set('select', 'agent_id,date,planned_start_time,planned_end_time');
      p.set('agent_id', 'eq.' + Number(userId));
      p.set('date', 'gte.' + toIsoDate(from));
      p.append('date', 'lte.' + toIsoDate(to));
      const resPlan = await fetch(`${sbUrl}/rest/v1/planifications?${p.toString()}`, { headers: { apikey: sbKey, Authorization: 'Bearer ' + sbKey } });
      if (resPlan.ok) {
        const plans = await resPlan.json().catch(() => []);
        for (const pl of plans) {
          const day = (pl.date || '').toString().slice(0,10);
          if (day) plannedDaysSet.add(day);
          if (pl.planned_start_time && pl.planned_end_time) {
            try {
              const start = new Date(`${day}T${pl.planned_start_time}`);
              const end = new Date(`${day}T${pl.planned_end_time}`);
              const hours = Math.max(0, (end - start) / (1000*60*60));
              plannedHoursTotal += hours;
            } catch {}
          }
        }
      }
    } catch {}

    const presentDays = new Set();
    perDay.forEach((v, day) => { if (v.minDist != null ? v.minDist <= tol : v.any) presentDays.add(day); });

    const daysWorked = presentDays.size;
    const plannedDays = plannedDaysSet.size;
    const plannedHours = Math.round(plannedHoursTotal * 10) / 10;
    const denom = (expectedDays && expectedDays > 0) ? expectedDays : (plannedDays > 0 ? plannedDays : to.getDate());
    const attendanceRate = Math.min(100, Math.round((daysWorked / denom) * 100));

    // Afficher
    const daysEl = $('days-worked'); if (daysEl) daysEl.textContent = String(daysWorked);
    const hoursEl = $('hours-worked'); if (hoursEl) hoursEl.textContent = '—';
    const rateEl = $('attendance-rate'); if (rateEl) rateEl.textContent = `${attendanceRate}%`;
    // valeurs planifiées si des placeholders existent
    try {
      const plannedDaysEl = document.getElementById('planned-days');
      if (plannedDaysEl) plannedDaysEl.textContent = String(plannedDays);
      const plannedHoursEl = document.getElementById('planned-hours');
      if (plannedHoursEl) plannedHoursEl.textContent = `${plannedHours}h`;
    } catch {}

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
  const daysEl = $('days-worked');
  const hoursEl = $('hours-worked');
  const rateEl = $('attendance-rate');
  if (daysEl) daysEl.textContent = metrics.daysWorked;
  if (hoursEl) hoursEl.textContent = `${metrics.hoursWorked}h`;
  if (rateEl) rateEl.textContent = `${metrics.attendanceRate}%`;
  
  // Ajouter des couleurs selon les performances
  const attendanceRateElement = $('attendance-rate');
  if (attendanceRateElement) {
    if (metrics.attendanceRate >= 90) {
      attendanceRateElement.style.color = '#10b981';
    } else if (metrics.attendanceRate >= 70) {
      attendanceRateElement.style.color = '#f59e0b';
    } else {
      attendanceRateElement.style.color = '#ef4444';
    }
  }
}

async function updateCurrentLocation() {
  try {
    const coords = await geoPromise();
    const location = await getLocationName(coords.latitude, coords.longitude);
    const el = $('current-location');
    if (el) el.textContent = location || 'Position inconnue';
  } catch (error) {
    const el = $('current-location');
    if (el) el.textContent = 'Non disponible';
  }
}

async function getLocationName(lat, lon) {
  // Respect CSP: ne pas appeler des domaines externes
  return `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
}

// Mettre à jour la navbar selon l'état de connexion et le rôle
async function updateNavbar() {
  try {
    if (!jwt) {
      // Utilisateur non connecté
    if (window.navigation && typeof window.navigation.updateForUser === 'function') {
      await window.navigation.updateForUser(null);
      }
      return;
    }

    // Utilisateur connecté - récupérer les infos
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
        profile = JSON.parse(localStorage.getItem('loginData') || '{}');
      }
    }
    
    // Utiliser le nouveau système de navigation
  if (window.navigation && typeof window.navigation.updateForUser === 'function') {
    await window.navigation.updateForUser(profile);
  }
    
    // Ajouter un bouton Paramètres Admin si absent (pour les admins)
    if (profile && profile.role === 'admin') {
      const adminLink = $('admin-link');
      if (adminLink) {
        // Ajouter un bouton Paramètres Admin si absent
        let settingsLink = document.getElementById('admin-settings-link');
        if (!settingsLink) {
          settingsLink = document.createElement('a');
          settingsLink.id = 'admin-settings-link';
          settingsLink.href = '/help.html';
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
        const settingsLink = document.getElementById('admin-settings-link');
        if (settingsLink) settingsLink.style.display = 'none';
      }
    }
    
  } catch (e) {
    console.error('Error updating navbar:', e);
    // En cas d'erreur, masquer les éléments sensibles
    if (window.navigation && typeof window.navigation.updateForUser === 'function') {
      await window.navigation.updateForUser(null);
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
    
    // Utiliser uniquement les données locales (plus fiables)
    if (window.geoData && window.geoData.departements) {
      window.geoData.departements.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name;
        deptSelect.appendChild(opt);
      });
      deptSelect.dataset.loaded = '1';
      deptSelect.disabled = false;
      console.log('✅ Départements chargés depuis les données locales:', window.geoData.departements.length);
    } else {
      console.error('❌ Aucune source de données géographiques disponible');
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
    
    // Utiliser uniquement les données locales (plus fiables)
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
    
    // Utiliser uniquement les données locales (plus fiables)
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
    
    // Utiliser uniquement les données locales (plus fiables)
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

        // 4) Fallback supplémentaire: certaines données lient les villages à la commune (pas à l'arrondissement)
        if (villages.length === 0) {
          try {
            // Retrouver la communeId qui contient cet arrondissement
            let communeIdForArr = null;
            const entries = Object.entries(window.geoData.arrondissements || {});
            for (const [communeKey, arrList] of entries) {
              if ((arrList || []).some(a => String(a.id) === String(arrondissementId))) {
                communeIdForArr = communeKey; // peut être string id ou nom
                break;
              }
            }
            if (communeIdForArr) {
              // Essayer villages indexés par communeId directement
              if (window.geoData.villages[communeIdForArr]) {
                villages = window.geoData.villages[communeIdForArr] || [];
              }
              // Ou par nom de commune
              if (villages.length === 0) {
                // Trouver le nom de commune
                let communeName = null;
                try {
                  // communeKey peut être un id: retrouver son nom
                  const allCommunesGroups = Object.values(window.geoData.communes || {});
                  for (const grp of allCommunesGroups) {
                    const found = (grp || []).find(c => String(c.id) === String(communeIdForArr));
                    if (found) { communeName = found.name; break; }
                  }
                } catch {}
                if (!communeName && typeof communeIdForArr === 'string' && isNaN(Number(communeIdForArr))) {
                  communeName = communeIdForArr;
                }
                if (communeName && window.geoData.villages[communeName]) {
                  villages = window.geoData.villages[communeName] || [];
                }
              }

              // Filtrer par arrondissement sélectionné pour respecter la cascade
              try {
                if (Array.isArray(villages) && arrondissement && arrondissement.name) {
                  const normalize = (s) => String(s || '')
                    .normalize('NFD')
                    .replace(/\p{Diacritic}+/gu, '')
                    .replace(/[\s-]+/g, '_')
                    .toLowerCase();
                  const arrNameNorm = normalize(arrondissement.name);
                  villages = villages.filter(v => {
                    const vn = normalize(v.name);
                    return vn.endsWith('_' + arrNameNorm) || vn.includes(arrNameNorm);
                  });
                  // Si rien ne correspond à l'arrondissement, essayer un filtrage plus large par nom de commune
                  if (villages.length === 0 && communeIdForArr) {
                    let communeName = null;
                    try {
                      const allCommunesGroups = Object.values(window.geoData.communes || {});
                      for (const grp of allCommunesGroups) {
                        const found = (grp || []).find(c => String(c.id) === String(communeIdForArr));
                        if (found) { communeName = found.name; break; }
                      }
                    } catch {}
                    if (communeName) {
                      const cn = normalize(communeName);
                      const base = window.geoData.villages[communeIdForArr] || window.geoData.villages[communeName] || [];
                      villages = base.filter(v => normalize(v.name).includes(cn));
                    }
                  }
                  // En dernier recours: afficher les villages de la commune sans filtrage (mieux que vide)
                  if (villages.length === 0) {
                    const base = window.geoData.villages[communeIdForArr] || (communeName ? window.geoData.villages[communeName] : []) || [];
                    if (Array.isArray(base) && base.length > 0) {
                      villages = base;
                    }
                  }
                }
              } catch {}
            }
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

// Initialiser les systèmes avancés
async function initializeAdvancedSystems() {
  try {
    console.log('🔧 Initialisation des systèmes avancés...');
    
    // Charger seulement les scripts essentiels en parallèle
    const essentialScripts = [
      '/offline-manager.js',
      '/notification-manager.js',
      '/gps-tracker.js'
    ];
    
    await Promise.all(essentialScripts.map(script => loadScript(script)));
    
    // Charger les autres scripts en arrière-plan sans bloquer l'interface
    setTimeout(async () => {
      try {
        const optionalScripts = [
          '/messaging-system.js',
          '/emergency-system.js',
          '/enriched-reports.js',
          '/smart-planning.js',
          '/agent-dashboard.js',
          '/integrated-help.js',
          '/analytics-insights.js'
        ];
        
        await Promise.all(optionalScripts.map(script => loadScript(script)));
      } catch (error) {
        console.warn('⚠️ Erreur lors du chargement des systèmes optionnels:', error);
      }
    }, 1000); // Délai de 1 seconde pour ne pas bloquer l'interface
    
    // Initialiser les gestionnaires
    if (window.offlineManager) {
      offlineManager = window.offlineManager;
      console.log('✅ Gestionnaire hors-ligne initialisé');
    }
    
    if (window.notificationManager) {
      notificationManager = window.notificationManager;
      console.log('✅ Gestionnaire de notifications initialisé');
    }
    
    if (window.gpsTracker) {
      gpsTracker = window.gpsTracker;
      console.log('✅ Tracker GPS initialisé');
    }
    
    if (window.messagingSystem) {
      messagingSystem = window.messagingSystem;
      console.log('✅ Système de messagerie initialisé');
    }
    
    if (window.emergencySystem) {
      emergencySystem = window.emergencySystem;
      console.log('✅ Système d\'urgence initialisé');
    }
    
    if (window.enrichedReports) {
      enrichedReports = window.enrichedReports;
      console.log('✅ Système de rapports enrichis initialisé');
    }
    
    if (window.smartPlanning) {
      smartPlanning = window.smartPlanning;
      console.log('✅ Système de planification intelligente initialisé');
    }
    
    if (window.agentDashboard) {
      agentDashboard = window.agentDashboard;
      console.log('✅ Tableau de bord agent initialisé');
    }
    
    if (window.integratedHelp) {
      integratedHelp = window.integratedHelp;
      console.log('✅ Système d\'aide intégrée initialisé');
    }
    
    if (window.analyticsInsights) {
      analyticsInsights = window.analyticsInsights;
      console.log('✅ Système d\'analytics et insights initialisé');
    }
    
    // Configurer les événements
    setupAdvancedSystemEvents();
    
    console.log('🎉 Tous les systèmes avancés initialisés');
    
  } catch (error) {
    console.error('❌ Erreur initialisation systèmes avancés:', error);
  }
}

// Charger un script dynamiquement
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Configurer les événements des systèmes avancés
function setupAdvancedSystemEvents() {
  // Événements GPS
  document.addEventListener('gpsPositionUpdate', (event) => {
    const position = event.detail.position;
    console.log('📍 Position GPS mise à jour:', position);
    
    // Mettre à jour l'affichage de la position actuelle
    updateCurrentLocationDisplay(position);
  });
  
  document.addEventListener('gpsError', (event) => {
    console.warn('⚠️ Erreur GPS:', event.detail.message);
    showGPSWarning(event.detail.message);
  });
  
  // Événements de messagerie
  document.addEventListener('newMessage', (event) => {
    const message = event.detail.message;
    console.log('💬 Nouveau message reçu:', message);
    
    // Afficher notification
    if (notificationManager) {
      notificationManager.sendNotification('💬 Nouveau Message', {
        body: message.content,
        tag: 'new-message'
      });
    }
  });
  
  // Événements d'urgence
  document.addEventListener('emergencyActivated', (event) => {
    console.log('🚨 MODE URGENCE ACTIVÉ');
    showEmergencyMode(true);
  });
  
  document.addEventListener('emergencyDeactivated', () => {
    console.log('✅ MODE URGENCE DÉSACTIVÉ');
    showEmergencyMode(false);
  });
  
  // Événements de connexion
  document.addEventListener('messagingConnectionChange', (event) => {
    const isConnected = event.detail.isConnected;
    updateConnectionStatus(isConnected);
  });
}

// Mettre à jour l'affichage de la position actuelle
function updateCurrentLocationDisplay(position) {
  const locationElement = document.getElementById('current-location');
  if (locationElement && position) {
    locationElement.textContent = `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`;
  }
}

// Afficher un avertissement GPS
function showGPSWarning(message) {
  const warningElement = document.getElementById('gps-warning');
  if (warningElement) {
    warningElement.textContent = message;
    warningElement.style.display = 'block';
    
    // Masquer après 5 secondes
    setTimeout(() => {
      warningElement.style.display = 'none';
    }, 5000);
  }
}

// Afficher le mode urgence
function showEmergencyMode(isActive) {
  const emergencyIndicator = document.getElementById('emergency-indicator');
  if (emergencyIndicator) {
    if (isActive) {
      emergencyIndicator.innerHTML = '🚨 URGENCE';
      emergencyIndicator.className = 'emergency-indicator active';
    } else {
      emergencyIndicator.innerHTML = '';
      emergencyIndicator.className = 'emergency-indicator';
    }
  }
}

// Mettre à jour le statut de connexion
function updateConnectionStatus(isConnected) {
  const statusElement = document.getElementById('connection-status');
  if (statusElement) {
    if (isConnected) {
      statusElement.innerHTML = '<span class="text-success">🟢 Connecté</span>';
    } else {
      statusElement.innerHTML = '<span class="text-warning">🟡 Hors-ligne</span>';
    }
  }
}

// Initialiser la saisie manuelle au chargement
document.addEventListener('DOMContentLoaded', async () => {
  // Ne pas effacer la console sur Vercel pour éviter les boucles
  if (true) {
    console.clear();
    console.log('🚀 Application chargée - Console effacée');
  } else {
    console.log('🚀 Application chargée sur Vercel');
  }
  
  // Initialiser les nouveaux systèmes
  await initializeAdvancedSystems();
  
  // Vérifier le token au chargement
  const jwt = localStorage.getItem('jwt');
  if (jwt && jwt.length < 20) {
    console.warn('⚠️ Ancien token détecté au chargement (longueur:', jwt.length, '). Suppression du token.');
    localStorage.removeItem('jwt');
    localStorage.removeItem('loginData');
    localStorage.removeItem('userProfile');
    // Ne pas forcer la reconnexion, laisser l'utilisateur naviguer normalement
  }
  
  // Nettoyer les tokens potentiellement corrompus
  if (jwt && (jwt.includes('undefined') || jwt.includes('null') || jwt === 'null' || jwt === 'undefined')) {
    console.warn('⚠️ Token corrompu détecté, nettoyage automatique');
    localStorage.removeItem('jwt');
    localStorage.removeItem('loginData');
    localStorage.removeItem('userProfile');
  }
  
  // Vérifier si la base de données est vierge et nettoyer le cache si nécessaire
  try {
    const response = await api('/settings');
    if (response && response.success && response.settings) {
      // Base de données accessible, vérifier s'il y a des utilisateurs
      const hasUsers = localStorage.getItem('hasUsers') === 'true';
      if (!hasUsers) {
        console.log('🔍 Vérification de la base de données...');
        // Nettoyer le cache pour forcer une reconnexion propre
        clearCachedUserData();
        localStorage.setItem('hasUsers', 'false');
      }
    }
  } catch (error) {
    console.log('⚠️ Impossible de vérifier la base de données, nettoyage du cache');
    clearCachedUserData();
  }
  
  // Gestionnaires pour la récupération de mot de passe
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  if (forgotPasswordBtn) {
    const forgotHandler = (typeof showForgotPasswordForm === 'function') 
      ? showForgotPasswordForm 
      : (() => { try { if (window.showForgotPasswordForm) window.showForgotPasswordForm(); } catch {} });
    forgotPasswordBtn.addEventListener('click', forgotHandler);
  }
  
  const backToLoginBtn = document.getElementById('back-to-login-btn');
  if (backToLoginBtn) {
    const loginHandler = (typeof showLoginForm === 'function')
      ? showLoginForm
      : (() => { try { if (window.showLoginForm) window.showLoginForm(); } catch {} });
    backToLoginBtn.addEventListener('click', loginHandler);
  }
  
  const backToForgotBtn = document.getElementById('back-to-forgot-btn');
  if (backToForgotBtn) {
    const forgotHandler2 = (typeof showForgotPasswordForm === 'function') 
      ? showForgotPasswordForm 
      : (() => { try { if (window.showForgotPasswordForm) window.showForgotPasswordForm(); } catch {} });
    backToForgotBtn.addEventListener('click', forgotHandler2);
  }
  
  // Formulaire de demande de récupération
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('forgot-email').value.trim();
      if (!email) {
        showEnhancedErrorMessage('Veuillez entrer votre adresse email.', [
          'Vérifiez que l\'email est correct',
          'Assurez-vous d\'avoir un compte sur cette plateforme'
        ]);
        return;
      }
      
      try {
        const response = await api('/forgot-password', {
          method: 'POST',
          body: { email }
        });
        
        if (response.success) {
          recoveryEmail = email;
          showResetPasswordForm();
          showEnhancedErrorMessage('Code envoyé !', [
            'Vérifiez votre boîte email',
            'Entrez le code à 6 chiffres reçu',
            'Le code est valide pendant 15 minutes'
          ], 'success');
          try { alert('Code de récupération envoyé avec succès à ' + email); } catch {}
        } else {
          showEnhancedErrorMessage(response.message || 'Erreur lors de l\'envoi du code.', [
            'Vérifiez que l\'email est correct',
            'Assurez-vous d\'avoir un compte sur cette plateforme',
            'Réessayez dans quelques instants'
          ]);
          try { alert('Échec de l\'envoi du mail de récupération'); } catch {}
        }
      } catch (error) {
        console.error('Erreur récupération mot de passe:', error);
        showEnhancedErrorMessage('Erreur lors de l\'envoi du code de récupération.', [
          'Vérifiez votre connexion internet',
          'Réessayez dans quelques instants',
          'Contactez votre administrateur si le problème persiste'
        ]);
        try { alert('Échec de l\'envoi du mail de récupération'); } catch {}
      }
    });
  }
  
  // Formulaire de réinitialisation du mot de passe
  const resetPasswordForm = document.getElementById('reset-password-form');
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const code = document.getElementById('reset-code').value.trim();
      const password = document.getElementById('reset-password').value;
      const confirmPassword = document.getElementById('reset-confirm-password').value;
      
      // Validations
      if (!code || code.length !== 6) {
        showEnhancedErrorMessage('Code invalide.', [
          'Le code doit contenir exactement 6 chiffres',
          'Vérifiez votre boîte email'
        ]);
        return;
      }
      
      if (password.length < 6) {
        showEnhancedErrorMessage('Mot de passe trop court.', [
          'Le mot de passe doit contenir au moins 6 caractères'
        ]);
        return;
      }
      
      if (password !== confirmPassword) {
        showEnhancedErrorMessage('Les mots de passe ne correspondent pas.', [
          'Vérifiez que les deux mots de passe sont identiques'
        ]);
        return;
      }
      
      try {
        const response = await api('/reset-password', {
          method: 'POST',
          body: { 
            email: recoveryEmail,
            code: code,
            password: password
          }
        });
        
        if (response.success) {
          showEnhancedErrorMessage('Mot de passe réinitialisé avec succès !', [
            'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe'
          ], 'success');
          
          // Retourner au formulaire de connexion après 3 secondes
          setTimeout(() => {
            showLoginForm();
            // Pré-remplir l'email
            const emailInput = document.getElementById('email');
            if (emailInput) {
              emailInput.value = recoveryEmail;
            }
            recoveryEmail = '';
          }, 3000);
        } else {
          showEnhancedErrorMessage(response.message || 'Erreur lors de la réinitialisation.', [
            'Vérifiez que le code est correct',
            'Le code peut avoir expiré (15 minutes)',
            'Demandez un nouveau code si nécessaire'
          ]);
        }
      } catch (error) {
        console.error('Erreur réinitialisation mot de passe:', error);
        showEnhancedErrorMessage('Erreur lors de la réinitialisation du mot de passe.', [
          'Vérifiez votre connexion internet',
          'Vérifiez que le code est correct',
          'Réessayez ou demandez un nouveau code'
        ]);
      }
    });
  }

  // Attacher tous les gestionnaires d'événements
  setTimeout(() => {
    bindAllButtons();
    bindLogoutButtons();
  }, 500);
  
  // Initialiser le détecteur mobile GPS
  setTimeout(() => {
    try {
      if (window.mobileGPSDetector) {
        mobileGPSDetector = window.mobileGPSDetector;
        console.log('📱 Détecteur mobile GPS initialisé');
      } else {
        console.log('⚠️ Détecteur mobile GPS non disponible');
      }
      setupManualGeoInputs();
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation:', error);
    }
  }, 1000);

  // Restaurer l'état de mission (boutons) au chargement
  try {
    const startBtn = $('start-mission');
    const endBtn = $('end-mission');
    const inProgress = localStorage.getItem('mission_in_progress') === 'true';
    if (inProgress) {
      if (startBtn) startBtn.disabled = true;
      if (endBtn) endBtn.disabled = false;
    } else {
      if (startBtn) startBtn.disabled = false;
      if (endBtn) endBtn.disabled = true;
    }
  } catch {}
});

// Exposer les fonctions globalement
window.getGeoValue = getGeoValue;
window.validateGeoFields = validateGeoFields;
window.setupManualGeoInputs = setupManualGeoInputs;


