/**
 * =============================================
 * CLASSE APICLIENT ET CONFIGURATION
 * =============================================
 */
class ApiClient {
  constructor(baseUrl = CONFIG.API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.setupInterceptors();
  }

  // Configure les intercepteurs pour les requêtes et réponses
  setupInterceptors() {
    // Intercepteur pour les requêtes sortantes
    this.requestInterceptor = (config) => {
      const token = this.getToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    };

    // Intercepteur pour les réponses entrantes
    this.responseInterceptor = async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Erreur HTTP: ${response.status}`);
      }
      return response;
    };
  }

  // Méthode pour effectuer des requêtes HTTP
  async request(endpoint, options = {}) {
    // Préparation de l'URL et des en-têtes
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Application des intercepteurs
    const config = { ...options, headers };
    const interceptedConfig = this.requestInterceptor(config) || config;

    try {
      const response = await fetch(url, interceptedConfig);
      return await (this.responseInterceptor ? this.responseInterceptor(response) : response);
    } catch (error) {
      console.error('Erreur lors de la requête:', error);
      throw error;
    }
  }

  // Méthode pour valider un token JWT
  validateToken(token, key, source) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Vérification de la longueur minimale
    if (token.length < CONFIG.MIN_TOKEN_LENGTH) {
      console.warn(`⚠️ Token trop court (${token.length} caractères) pour la clé: ${key} dans ${source}`);
      return false;
    }

    // Vérification du format JWT (3 parties séparées par des points)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn(`⚠️ Format de token JWT invalide (${parts.length} parties) pour la clé: ${key} dans ${source}`);
      return false;
    }

    // Vérification du format base64url
    const isBase64Url = (str) => /^[A-Za-z0-9-_]+$/.test(str);
    if (!parts.every(part => isBase64Url(part))) {
      console.warn(`⚠️ Token JWT contient des caractères invalides pour la clé: ${key} dans ${source}`);
      return false;
    }

    // Vérification du payload
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload.exp) {
        console.warn(`⚠️ Token JWT invalide: champ 'exp' manquant pour la clé: ${key} dans ${source}`);
        return false;
      }
      return true;
    } catch (e) {
      console.error(`❌ Erreur lors du décodage du payload JWT pour la clé ${key} dans ${source}:`, e);
      return false;
    }
  }

  getToken() {
    try {
      // 1. Vérifier dans le localStorage et sessionStorage
      for (const key of CONFIG.TOKEN_KEYS) {
        // Essayer d'abord le localStorage
        let token = localStorage.getItem(key);
        let source = 'localStorage';

        // Si pas trouvé dans localStorage, essayer sessionStorage
        if (!token) {
          token = sessionStorage.getItem(key);
          source = 'sessionStorage';
        }

        // Valider le token s'il existe
        if (token && this.validateToken(token, key, source)) {
          console.log(`✅ Token JWT valide trouvé dans ${source} avec la clé: ${key}`);
          return token;
        }
      }

      // 2. Vérifier dans les paramètres d'URL
      const urlParams = new URLSearchParams(window.location.search);
      for (const key of CONFIG.TOKEN_KEYS) {
        const token = urlParams.get(key);
        if (token && this.validateToken(token, key, 'URL parameters')) {
          return token;
        }
      }

      // 3. Vérifier dans window.jwt pour rétrocompatibilité
      if (typeof window.jwt === 'string') {
        const jwtToken = window.jwt.trim();
        if (this.validateToken(jwtToken, 'window.jwt', 'window object')) {
          return jwtToken;
        }
      }

      return '';
    } catch (error) {
      console.error('Erreur lors de la résolution du token:', error);
      return '';
    }
  }

  // Static method to resolve token - version simplifiée
  static resolveToken() {
    const client = new ApiClient();
    return client.getToken();
  }

  // Vérifie si l'authentification doit être attachée à l'URL
  static shouldAttachAuth(targetUrl) {
    try {
      if (!targetUrl) return false;
      const absolute = new URL(targetUrl, window.location.origin);
      return absolute.origin === window.location.origin && absolute.pathname.startsWith('/api');
    } catch (error) {
      console.warn('Erreur lors de la vérification de l\'URL:', error);
      return false;
    }
  }
}

// Configuration pour ApiClient
const CONFIG = {
  API_BASE_URL: '/api',
  WORK_HOURS: {
    start: { hour: 6, minute: 30 },
    end: { hour: 18, minute: 30 }
  },
  CACHE: {
    PROFILE_DURATION: 30000, // 30 secondes
    MISSION_CHECKINS: 'mission_checkins_'
  },
  TOKEN_KEYS: ['jwt', 'access_token', 'token', 'sb-access-token', 'sb:token'],
  MIN_TOKEN_LENGTH: 30 // Longueur minimale attendue pour un token JWT
};

// Initialisation de l'instance ApiClient
const apiClient = new ApiClient();

// Configuration de l'API — toujours passer par notre proxy /api pour éviter les blocages CSP
const apiBase = '/api';
let jwt = localStorage.getItem('jwt') || '';

// Authenticated fetch interceptor (ensures every /api call sends the JWT)
(function ensureAuthFetchInterceptor() {
  if (typeof window === 'undefined' || window.__authFetchPatched) return;
  window.__authFetchPatched = true;
  const TOKEN_KEYS = ['jwt', 'access_token', 'token', 'sb-access-token', 'sb:token'];
  const originalFetch = window.fetch;

  const resolveToken = () => {
    for (const key of TOKEN_KEYS) {
      const value = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (value && value.length > 20) return value.trim();
    }
    if (typeof window.jwt === 'string' && window.jwt.length > 20) return window.jwt.trim();
    return '';
  };

  const shouldAttachAuth = (targetUrl) => {
    try {
      const absolute = new URL(targetUrl, window.location.origin);
      return absolute.origin === window.location.origin && absolute.pathname.startsWith('/api');
    } catch {
      return false;
    }
  };

  window.fetch = function patchedFetch(input, init = {}) {
    try {
      const requestUrl = typeof input === 'string' ? input : input?.url;
      if (requestUrl && shouldAttachAuth(requestUrl)) {
        const token = resolveToken();
        if (token) {
          const baseHeaders =
            init.headers ||
            (input instanceof Request ? input.headers : undefined) ||
            {};
          const headers = new Headers(baseHeaders);
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }
          init = { ...init, headers };
        }
      }
    } catch (error) {
      console.warn('Auth fetch interceptor error:', error);
    }
    return originalFetch.call(this, input, init);
  };
})();
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
  } catch { }
  try { presenceData = {}; } catch { }
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
      btn.addEventListener('click', (ev) => { ev.preventDefault(); try { window.logout && window.logout(); } catch { } });
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
      } catch { }
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
      try { window.logout && window.logout(); } catch { }
      return;
    }
  } catch { }
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
    document.querySelectorAll('[data-back]')?.forEach((b) => {
      if (b._backBound) return; b._backBound = true;
      b.addEventListener('click', (e) => { e.preventDefault(); history.length > 1 ? history.back() : (window.location.href = '/'); });
    });
  } catch { }
}
document.addEventListener('DOMContentLoaded', attachBackButtons);
window.addEventListener('load', attachBackButtons);

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
    } catch { }
    throw new Error(JSON.stringify({ success: false, unauthorized: true, message: "Accès non autorisé" }));
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

      // Sauvegarder la session pour persistance
      if (window.sessionManager) {
        window.sessionManager.saveSession(
          response.token,
          email,
          response.user || null
        );
      }

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
  // Optimisation: Vérifier la session d'abord pour éviter les requêtes inutiles
  if (window.sessionManager) {
    const restored = await window.sessionManager.init();
    if (restored) {
      // Session restaurée, mettre à jour jwt immédiatement
      const session = window.sessionManager.getSession();
      if (session && session.token) {
        jwt = session.token;
        localStorage.setItem('jwt', session.token);
        if (session.userEmail) {
          localStorage.setItem('userEmail', session.userEmail);
        }
        console.log('✅ Session restaurée, connexion rapide');
      }
    }
  }

  try {
    // Charger les settings en arrière-plan (non bloquant)
    api('/settings').then(s => {
      if (s && s.success) appSettings = s.settings || null;
    }).catch(() => { });
  } catch { }

  // Assurer que navigation.js est chargé avant de l'utiliser (non bloquant)
  if (!window.navigation || typeof window.navigation.updateForUser !== 'function') {
    try {
      await new Promise((resolve) => setTimeout(resolve, 50)); // Réduit de 100ms à 50ms
    } catch { }
  }
  if ('serviceWorker' in navigator) {
    // Enregistrer le service worker en arrière-plan (non bloquant)
    navigator.serviceWorker.register('/service-worker.js').catch(() => { });
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
    } catch { }
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
    } catch { }
    try {
      await autoLogin(email, password);
    } catch (e) {
      console.error('❌ Échec de la connexion automatique:', e);
    }
  }

  // Initialiser les notifications en arrière-plan (non bloquant)
  initializeNotifications().catch(() => { });

  // Gérer la navbar selon l'état de connexion (non bloquant)
  updateNavbar().catch(() => { });

  const authSection = $('auth-section');
  const appSection = $('app-section');
  if (jwt) {
    // Afficher l'application immédiatement si on a un token (optimisation)
    hide(authSection);
    show(appSection);

    // Vérifier la validité du token en arrière-plan (non bloquant)
    setTimeout(async () => {
      try {
        const testResponse = await api('/profile');
        if (!testResponse || testResponse.error) {
          console.warn('⚠️ Token possiblement invalide; poursuivre sans déconnecter');
        }
      } catch (error) {
        console.warn('⚠️ Erreur de validation du token; poursuivre sans déconnecter:', error.message);
      }
    }, 100);

    // Charger le profil en arrière-plan (non bloquant pour l'affichage)
    setTimeout(async () => {
      try {
        const emailForProfile = (new URLSearchParams(window.location.search)).get('email') || localStorage.getItem('userEmail');
        let profileData = null;
        if (emailForProfile) {
          profileData = normalizeProfileResponse(await api(`/profile?email=${encodeURIComponent(emailForProfile)}`));
          // Sauvegarder pour d'autres fonctions (notifications)
          try { localStorage.setItem('userProfile', JSON.stringify(profileData || {})); } catch { }
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
          } catch { }
          // Continuer sans forcer la navigation
        }
      } catch { }
    }, 300); // Charger après l'affichage initial

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

    // Afficher un indicateur de chargement rapide
    const loginBtn = $('login-btn');
    const originalText = loginBtn.textContent;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Connexion...';

    try {
      const email = $('email').value.trim();
      const password = $('password').value.trim();

      console.log('🔐 Tentative de connexion rapide avec:', { email, password: password ? '***' : 'missing' });

      // Timeout plus court pour la connexion (5 secondes au lieu de 30)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const data = await api('/login', {
          method: 'POST',
          body: { email, password },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        console.log('✅ Connexion réussie, stockage des données...');

        // Stocker les infos utilisateur immédiatement
        jwt = data.token;
        localStorage.setItem('jwt', jwt);
        localStorage.setItem('loginData', JSON.stringify(data.user));
        localStorage.setItem('userProfile', JSON.stringify(data.user));
        localStorage.setItem('userEmail', data.user.email || email);
        localStorage.setItem('lastUserEmail', data.user.email || email);

        // Sauvegarder la session pour persistance (30 jours)
        if (window.sessionManager) {
          window.sessionManager.saveSession(
            data.token,
            data.user.email || email,
            data.user || null
          );
        }

        // Afficher l'application immédiatement
        hide(authSection);
        show(appSection);

        // Afficher message de succès rapide
        showNotification('Connexion réussie !', 'success', 2000);

        // Charger les données lourdes en arrière-plan après l'affichage (non bloquant)
        setTimeout(async () => {
          try {
            // Vérifier l'onboarding en arrière-plan
            const prof = normalizeProfileResponse(await api(`/profile?email=${encodeURIComponent(data.user.email || email)}`));
            if (!isProfileComplete(prof)) {
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
            }
          } catch (profileError) {
            console.warn('⚠️ Erreur vérification profil (non critique):', profileError);
          }
        }, 500);

        // Charger les données essentielles en arrière-plan (non bloquant)
        loadAgentProfile().catch(() => { });

        // Forcer le rendu du calendrier immédiatement (non bloquant)
        setTimeout(() => {
          try { renderCalendar(); } catch { }
        }, 100);

        // Initialiser les sélecteurs géographiques rapidement (non bloquant)
        setTimeout(() => {
          if (typeof initGeoSelectors === 'function') {
            console.log('🌍 Initialisation des sélecteurs géographiques...');
            try { initGeoSelectors(); } catch { }
          }
        }, 200);

        // Mettre à jour la navbar (non bloquant)
        updateNavbar().catch(() => { });

        // Rendre les actions circulaires
        try { updateCircleActionsVisibility(); } catch { }

        // Charger les données de présence et métriques en arrière-plan (non bloquant)
        setTimeout(async () => {
          try {
            await Promise.all([
              loadPresenceData(),
              loadDashboardMetrics()
            ]);
            console.log('📊 Données de présence et métriques chargées');
          } catch (dataError) {
            console.warn('⚠️ Erreur chargement données (non critique):', dataError);
          }
        }, 1000);

      } catch (apiError) {
        clearTimeout(timeoutId);

        if (apiError.name === 'AbortError') {
          throw new Error('Timeout de connexion (5s). Vérifiez votre connexion.');
        } else {
          throw apiError;
        }
      }

    } catch (e) {
      console.error('❌ Erreur de connexion:', e);

      // Gestion intelligente des erreurs avec suggestions hors connexion
      let errorMessage = 'Erreur de connexion.';
      let suggestions = [];

      if (e.message && e.message.includes('timeout')) {
        errorMessage = 'Connexion trop lente ou impossible.';
        suggestions.push('Vérifiez votre connexion Internet');
        suggestions.push('Essayez de vous rapprocher du WiFi');
      } else if (e.message && e.message.includes('network') || e.message && e.message.includes('fetch')) {
        errorMessage = 'Pas de connexion Internet.';
        suggestions.push('Vérifiez votre WiFi ou données mobiles');
        suggestions.push('Utilisez le mode hors connexion si disponible');
      } else if (e.status === 401) {
        errorMessage = 'Email ou mot de passe incorrect.';
        suggestions.push('Vérifiez votre email et mot de passe');
        suggestions.push('Réinitialisez votre mot de passe si nécessaire');
      } else if (e.status === 500) {
        errorMessage = 'Erreur serveur temporaire.';
        suggestions.push('Réessayez dans quelques instants');
        suggestions.push('Contactez l\'administrateur si le problème persiste');
      }

      const fullMessage = suggestions.length > 0
        ? `${errorMessage}\n\nSuggestions:\n${suggestions.map(s => `• ${s}`).join('\n')}`
        : errorMessage;

      alert(fullMessage);

      // Ajouter le bouton de mode hors connexion si erreur de réseau
      if (e.message && (e.message.includes('network') || e.message.includes('fetch') || e.message.includes('timeout'))) {
        addOfflineModeButton();
      }

    } finally {
      // Réactiver le bouton
      loginBtn.disabled = false;
      loginBtn.textContent = originalText;
    }
  });

  // Fonction de connexion hors connexion (mode dégradé)
  async function tryOfflineLogin(email, password) {
    try {
      console.log('📱 Tentative de connexion hors connexion...');

      // Vérifier si on a des données locales pour cet email
      const storedEmail = localStorage.getItem('userEmail');
      const storedProfile = localStorage.getItem('userProfile');

      if (storedEmail === email && storedProfile) {
        const profile = JSON.parse(storedProfile);

        // Vérifier si le mot de passe correspond (hash simple pour offline)
        const hashedPassword = btoa(password + 'salt'); // Simple hash pour démo
        const storedHash = localStorage.getItem('passwordHash');

        if (!storedHash || storedHash === hashedPassword) {
          // Créer un token temporaire pour offline
          const tempToken = 'offline_' + Date.now() + '_' + btoa(email);

          // Stocker les infos
          jwt = tempToken;
          localStorage.setItem('jwt', tempToken);
          localStorage.setItem('loginData', JSON.stringify(profile));
          localStorage.setItem('userProfile', JSON.stringify(profile));
          localStorage.setItem('userEmail', email);
          localStorage.setItem('lastUserEmail', email);
          localStorage.setItem('passwordHash', hashedPassword);

          console.log('✅ Connexion hors connexion réussie');
          return { user: profile, token: tempToken, offline: true };
        }
      }

      return null;
    } catch (error) {
      console.warn('⚠️ Erreur connexion hors connexion:', error);
      return null;
    }
  }

  // Ajouter un bouton de mode hors connexion si la connexion échoue
  function addOfflineModeButton() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm || document.getElementById('offline-mode-btn')) return;

    const offlineBtn = document.createElement('button');
    offlineBtn.id = 'offline-mode-btn';
    offlineBtn.type = 'button';
    offlineBtn.className = 'btn-secondary';
    offlineBtn.style.marginTop = '10px';
    offlineBtn.innerHTML = '<i class="fas fa-wifi-slash me-2"></i>Mode hors connexion';
    offlineBtn.onclick = async () => {
      const email = $('email').value.trim();
      const password = $('password').value.trim();

      if (!email || !password) {
        alert('Veuillez entrer votre email et mot de passe');
        return;
      }

      const result = await tryOfflineLogin(email, password);
      if (result) {
        // Afficher l'application en mode hors connexion
        hide(authSection);
        show(appSection);
        showNotification('Mode hors connexion - Fonctionnalités limitées', 'warning', 3000);

        // Charger les données essentielles
        await loadAgentProfile();
        renderCalendar();
        await updateNavbar();
        try { updateCircleActionsVisibility(); } catch { }

        // Afficher un avertissement
        const warningDiv = document.createElement('div');
        warningDiv.className = 'alert alert-warning';
        warningDiv.style.marginTop = '10px';
        warningDiv.innerHTML = `
          <i class="fas fa-exclamation-triangle me-2"></i>
          <strong>Mode hors connexion</strong><br>
          <small>Vous utilisez l'application sans connexion Internet. 
          Certaines fonctionnalités seront limitées.</small>
        `;

        const appSection = document.getElementById('app-section');
        if (appSection) {
          appSection.insertBefore(warningDiv, appSection.firstChild);

          // Masquer l'avertissement après 5 secondes
          setTimeout(() => {
            if (warningDiv.parentNode) {
              warningDiv.parentNode.removeChild(warningDiv);
            }
          }, 5000);
        }

      } else {
        alert('Impossible de se connecter en mode hors connexion. \n\nVérifiez que vous vous êtes déjà connecté auparavant avec cet appareil.');
      }
    };

    loginForm.appendChild(offlineBtn);
  }

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
    try { window.showForgotPasswordForm = showForgotPasswordForm; } catch { }
    try { window.showResetPasswordForm = showResetPasswordForm; } catch { }
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
        try { await updateNavbar(); } catch { }
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
          try { await refreshCheckins(); } catch { }
          try { await loadPresenceData(); } catch { }
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
    try { endBtnEl.textContent = 'Finir mission'; } catch { }
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
  } catch { }

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
        } catch { }

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
        } catch { }
        try { showNotification(`Position sauvegardée: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (~${Math.round(coords.accuracy || 0)}m)`, 'success'); } catch { }
      }
      // Fallback: si coords invalides ou précision extrême, utiliser le dernier GPS stocké
      if (!coords || !isFinite(coords.latitude) || !isFinite(coords.longitude) || coords.accuracy > 10000) {
        try {
          const last = JSON.parse(localStorage.getItem('lastGPS') || '{}');
          if (isFinite(last.lat) && isFinite(last.lon)) {
            coords = { latitude: Number(last.lat), longitude: Number(last.lon), accuracy: Number(last.accuracy || 9999) };
            console.log('📍 Utilisation du GPS en cache:', coords);
          }
        } catch { }
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
        try { localStorage.setItem('currentMissionId', String(currentMissionId)); } catch { }
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
            try { localStorage.setItem('currentMissionId', String(currentMissionId)); } catch { }
            invalidateMissionCheckins(currentMissionId);
          }
        } catch { }
      }

      status.textContent = 'Position signalée - Mission démarrée';
      animateElement(status, 'bounce');
      showNotification('Position journalière signalée - Mission démarrée !', 'success');
      // Persister l'état de mission en local
      try {
        localStorage.setItem('mission_in_progress', 'true');
        localStorage.setItem('mission_start_at', String(Date.now()));
      } catch { }

      await refreshCheckins();
      await loadPresenceData();
      try { await computeAndStoreDailyDistance(currentMissionId); } catch { }
      try { markTodayPresentOnCalendar(); } catch { }
      try { notifyPresenceUpdate('start'); } catch { }

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

      // Stocker la mission en attente dans IndexedDB
      try {
        const missionData = {
          lat: Number(coords.latitude),
          lon: Number(coords.longitude),
          accuracy: coords.accuracy ? Number(coords.accuracy) : null,
          note: $('note').value || 'Début de mission (offline)',
          departement: $('departement').value || null,
          commune: $('commune').value || null,
          arrondissement: $('arrondissement').value || null,
          village: $('village').value || null,
          captured_at: new Date().toISOString()
        };

        // Stocker dans IndexedDB via missionSync
        if (window.missionSync) {
          await window.missionSync.storePendingMission('start', missionData);
          console.log('✅ Mission de démarrage stockée en attente');
        }
      } catch (syncError) {
        console.error('Erreur stockage mission en attente:', syncError);
      }

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
      } catch { }
      try { showNotification('Hors ligne: mission mise en attente. Utilisez le bouton de synchronisation une fois connecté.', 'info'); } catch { }
      // Considérer la mission comme active côté UI pour permettre la fin même offline
      try {
        localStorage.setItem('hasActiveMissionOffline', 'true');
        localStorage.setItem('mission_in_progress', 'true');
        if (!localStorage.getItem('mission_start_at')) {
          localStorage.setItem('mission_start_at', String(Date.now()));
        }
      } catch { }
      const endBtn = $('end-mission');
      if (endBtn) endBtn.disabled = false;
      if (button) button.disabled = true;

      // Afficher le bouton de synchronisation
      if (window.missionSync) {
        await window.missionSync.updateSyncButton();
        const syncCard = document.getElementById('sync-missions-card');
        if (syncCard) syncCard.style.display = 'block';
      }
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
  } catch { }

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
        } catch { }
        try { showNotification(`Position sauvegardée: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (~${Math.round(coords.accuracy || 0)}m)`, 'success'); } catch { }
      }
      if (!coords || !isFinite(coords.latitude) || !isFinite(coords.longitude) || coords.accuracy > 10000) {
        try {
          const last = JSON.parse(localStorage.getItem('lastGPS') || '{}');
          if (isFinite(last.lat) && isFinite(last.lon)) {
            coords = { latitude: Number(last.lat), longitude: Number(last.lon), accuracy: Number(last.accuracy || 9999) };
          }
        } catch { }
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
      try { await computeAndStoreDailyDistance(missionId); } catch { }
      try { notifyPresenceUpdate('end'); } catch { }

      // Réactiver le bouton Débuter et désactiver Finir
      const startBtn = $('start-mission');
      if (startBtn) startBtn.disabled = false;
      if (button) button.disabled = true;
      // Garder le bouton check-in actif pour envoyer la présence finale
      const checkinBtn = $('checkin-btn');
      if (checkinBtn) checkinBtn.disabled = false;
      currentMissionId = null;
      try { localStorage.removeItem('currentMissionId'); } catch { }
      try {
        localStorage.removeItem('mission_in_progress');
        localStorage.removeItem('mission_start_at');
      } catch { }

      // Recharger l'historique des missions avec heures de début/fin fiables
      try {
        const missionsResponse = await api('/me/missions');
        const missions = Array.isArray(missionsResponse) ? missionsResponse : (missionsResponse.missions || []);
        await renderMissionHistory(missions);
      } catch { }

    } catch (e) {
      // Pas d'erreur bloquante: mettre en file et notifier doucement
      console.warn('Fin mission offline ou erreur réseau, mise en file:', e?.message || e);
      status.textContent = 'Fin en file (offline)';

      // Stocker la fin de mission en attente dans IndexedDB
      try {
        const missionData = {
          mission_id: missionId || localStorage.getItem('activeMissionId') || localStorage.getItem('currentMissionId'),
          lat: Number(coords.latitude),
          lon: Number(coords.longitude),
          accuracy: coords.accuracy ? Number(coords.accuracy) : null,
          note: $('note').value || 'Fin de mission (offline)'
        };

        // Stocker dans IndexedDB via missionSync
        if (window.missionSync) {
          await window.missionSync.storePendingMission('end', missionData);
          console.log('✅ Fin de mission stockée en attente');
        }
      } catch (syncError) {
        console.error('Erreur stockage fin de mission en attente:', syncError);
      }

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
      } catch { }
      try { showNotification('Hors ligne: fin de mission mise en attente. Utilisez le bouton de synchronisation une fois connecté.', 'info'); } catch { }

      // Afficher le bouton de synchronisation
      if (window.missionSync) {
        await window.missionSync.updateSyncButton();
        const syncCard = document.getElementById('sync-missions-card');
        if (syncCard) syncCard.style.display = 'block';
      }

      // Fin en offline: marquer la mission locale comme terminée
      try {
        localStorage.removeItem('hasActiveMissionOffline');
        localStorage.removeItem('mission_in_progress');
        localStorage.removeItem('mission_start_at');
      } catch { }
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
        try { notifyPresenceUpdate('force-end'); } catch { }

        // Réactiver le bouton Débuter et désactiver Finir
        const startBtn = $('start-mission');
        if (startBtn) startBtn.disabled = false;
        if (button) button.disabled = true;
        const checkinBtn = $('checkin-btn');
        if (checkinBtn) checkinBtn.disabled = true;
        currentMissionId = null;
        try { localStorage.removeItem('currentMissionId'); } catch { }

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
        } catch { }
        try {
          if (!currentMissionId) {
            const missionsResponse = await api('/me/missions');
            const missions = Array.isArray(missionsResponse) ? missionsResponse : (missionsResponse.missions || []);
            const active = missions.find(m => m.status === 'active');
            if (active) { currentMissionId = active.id; try { localStorage.setItem('currentMissionId', String(currentMissionId)); } catch { } }
          }
        } catch { }
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
        try { await computeAndStoreDailyDistance(currentMissionId); } catch { }
        currentMissionId = null; try { localStorage.removeItem('currentMissionId'); } catch { }
        await refreshCheckins();
        await loadPresenceData();
        // Rafraîchir l'historique des missions pour voir le statut "completed"
        try {
          const missionsResponse = await api('/me/missions');
          const missions = Array.isArray(missionsResponse) ? missionsResponse : (missionsResponse.missions || []);
          await renderMissionHistory(missions);
        } catch { }
        try { notifyPresenceUpdate('complete'); } catch { }
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
      let startTimestamp = null;
      let endTimestamp = null;

      try {
        // Vérifier les deux formats possibles : start_time/end_time ou date_start/date_end
        const startTime = m.start_time || m.date_start;
        const endTime = m.end_time || m.date_end;

        if (startTime) {
          const d = new Date(startTime);
          if (!isNaN(d.getTime())) {
            startStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            startMs = d.getTime();
            startTimestamp = startTime;
          }
        }

        if (endTime) {
          const d = new Date(endTime);
          if (!isNaN(d.getTime())) {
            endStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            endMs = d.getTime();
            endTimestamp = endTime;
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
          } catch { }
        }

        // Récupérer les checkins pour obtenir les heures système du téléphone
        const checkinRows = await getMissionCheckinsCached(m.id);
        if (checkinRows && checkinRows.length) {
          console.log(`📍 Mission #${m.id}: ${checkinRows.length} checkins trouvés`);

          const normalized = checkinRows
            .map(row => {
              // Prioriser l'heure système du téléphone (local time) quand GPS capturé
              // Utiliser l'heure locale du téléphone au lieu du timestamp GPS/serveur
              let phoneTime = null;

              // Si on a une heure système locale enregistrée lors du GPS
              if (row.local_time || row.phone_time || row.device_time) {
                phoneTime = row.local_time || row.phone_time || row.device_time;
              }
              // Sinon, convertir le timestamp serveur/GPS en heure locale du téléphone
              else if (row.checked_at || row.created_at || row.date || row.timestamp) {
                const serverTimestamp = row.checked_at || row.created_at || row.date || row.timestamp;
                const serverDate = new Date(serverTimestamp);
                if (!isNaN(serverDate.getTime())) {
                  // Convertir en heure locale du téléphone (navigateur)
                  phoneTime = serverDate.toLocaleString('fr-FR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });
                }
              }

              return { row, ts: phoneTime };
            })
            .filter(entry => entry.ts && !isNaN(new Date(entry.ts).getTime()))
            .sort((a, b) => new Date(a.ts) - new Date(b.ts));

          if (normalized.length) {
            // Utiliser le premier checkin comme heure de début (heure téléphone)
            const firstDate = new Date(normalized[0].ts);
            if (!isNaN(firstDate.getTime())) {
              startMs = firstDate.getTime();
              startStr = firstDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              startTimestamp = normalized[0].ts;

              // Afficher aussi la date si c'est un jour différent
              const today = new Date();
              const checkinDate = new Date(firstDate);
              if (checkinDate.toDateString() !== today.toDateString()) {
                startStr = checkinDate.toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });
              }

              console.log(`📱 Heure de début téléphone: ${startStr} (timestamp: ${normalized[0].ts})`);
            }

            // Utiliser le dernier checkin comme heure de fin si mission complétée
            const missionCompleted = String(m.status || '').toLowerCase() === 'completed';
            if (missionCompleted && normalized.length > 1) {
              const lastDate = new Date(normalized[normalized.length - 1].ts);
              if (!isNaN(lastDate.getTime())) {
                endMs = lastDate.getTime();
                endStr = lastDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                endTimestamp = normalized[normalized.length - 1].ts;

                // Afficher aussi la date si c'est un jour différent
                const today = new Date();
                const checkinDate = new Date(lastDate);
                if (checkinDate.toDateString() !== today.toDateString()) {
                  endStr = checkinDate.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                }

                console.log(`📱 Heure de fin téléphone: ${endStr} (timestamp: ${normalized[normalized.length - 1].ts})`);
              }
            }

            // Calculer la distance si non disponible
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
                try { localStorage.setItem(`mission:${m.id}:total_distance_m`, String(totalMeters)); } catch { }
              }
            }
          }
        } else {
          console.log(`⚠️ Mission #${m.id}: Aucun checkin trouvé`);
        }
      } catch (error) {
        console.error(`❌ Erreur traitement mission #${m.id}:`, error);
      }

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
      } catch { }

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

      // Afficher les timestamps du téléphone pour information
      const phoneInfo = startTimestamp && endTimestamp ?
        `<div class="text-muted small">Téléphone: ${new Date(startTimestamp).toLocaleString('fr-FR')} → ${new Date(endTimestamp).toLocaleString('fr-FR')}</div>` :
        (startTimestamp ? `<div class="text-muted small">Téléphone: ${new Date(startTimestamp).toLocaleString('fr-FR')}</div>` : '');

      li.innerHTML = `
        <div class="list-item">
          <div><strong>Mission #${m.id}</strong> — ${m.status}</div>
          <div><strong>${timeDisplay}</strong></div>
          <div>Département: ${depName || '-'} • Commune: ${comName || '-'}</div>
          ${arrText ? `<div>Arrondissement: ${arrText}</div>` : ''}
          ${vilText ? `<div>Village: ${vilText}</div>` : ''}
          <div>Start GPS: ${m.start_lat ?? '-'}, ${m.start_lon ?? '-'} | End GPS: ${m.end_lat ?? '-'}, ${m.end_lon ?? '-'}</div>
          ${distanceStr ? `<div>Distance totale: ${distanceStr}</div>` : ''}
          ${phoneInfo}
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
        .map(r => ({ lat: Number(r.lat), lon: Number(r.lon), t: new Date(r.created_at).getTime() }))
        .sort((a, b) => a.t - b.t);
      if (points.length < 2) return;
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
        const c = 2 * Math.atan2(Math.sqrt(a
