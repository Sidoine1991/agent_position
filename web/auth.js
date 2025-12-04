/**
 * Gestion de l'authentification, des rôles et de la navigation
 */

const ROLES = {
  AGENT: 'agent',
  SUPERVISEUR: 'superviseur',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin'
};

const PAGE_ACCESS = {
  // Pages pour Agents
  '/messages.html': [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN],
  '/agent-dashboard.html': [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN],
  '/planning.html': [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN],
  '/profile.html': [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN],
  '/permissions.html': [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN],
  
  // Pages pour Superviseurs (et plus)
  '/dashboard.html': [ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN], // Dashboard superviseur
  '/team-management.html': [ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN], // A créer

  // Pages pour Admins (et plus)
  '/admin-agents.html': [ROLES.ADMIN, ROLES.SUPERADMIN],
  '/reports.html': [ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN],
  '/synthese-globale.html': [ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN],

  // Page Admin (Admin et Superadmin)
  '/admin.html': [ROLES.ADMIN, ROLES.SUPERADMIN],

  // Pages publiques
  '/index.html': 'public',
  '/help.html': 'public',
  '/register.html': 'public',
  
  // Redirection après connexion
  '/presence.html': [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN]
};

// Durée de validité du token (24 heures)
const TOKEN_EXPIRY_HOURS = 24;

/**
 * Rafraîchir le token JWT si nécessaire
 * @param {string} token - Le token actuel
 * @returns {Promise<string>} Le token actuel ou un nouveau token rafraîchi
 */
async function refreshTokenIfNeeded(token) {
  if (!token) {
    console.warn('❌ Aucun token fourni pour le rafraîchissement');
    return null;
  }
  
  try {
    // Vérifier d'abord si le token est expiré
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Date.now() / 1000; // en secondes
    
    // Si le token est toujours valide pendant plus de 30 minutes, pas besoin de rafraîchir
    if (payload.exp && (payload.exp - now) > 1800) {
      console.log('ℹ️ Token toujours valide, pas besoin de rafraîchissement');
      return token;
    }
    
    console.log('🔄 Tentative de rafraîchissement du token...');
    
    // Vérifier si le token est expiré depuis trop longtemps (plus de 7 jours)
    const maxRefreshTime = 7 * 24 * 60 * 60; // 7 jours en secondes
    if (payload.exp && (now - payload.exp) > maxRefreshTime) {
      console.warn('⚠️ Impossible de rafraîchir le token : délai de rafraîchissement dépassé');
      return null;
    }
    
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include',
      timeout: 10000 // 10 secondes de timeout
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.token) {
        console.log('✅ Token rafraîchi avec succès');
        
        // Mettre à jour le token dans le localStorage
        localStorage.setItem('jwt', data.token);
        
        // Mettre à jour le gestionnaire de session si disponible
        if (window.sessionManager) {
          const session = window.sessionManager.getSession();
          if (session) {
            await window.sessionManager.saveSession(
              data.token, 
              session.userEmail, 
              session.userProfile
            );
          }
        }
        
        return data.token;
      } else {
        console.warn('⚠️ Réponse de rafraîchissement invalide:', data);
      }
    } else {
      const errorText = await response.text();
      console.warn(`❌ Échec du rafraîchissement du token (${response.status}):`, errorText);
    }
  } catch (error) {
    console.error('❌ Erreur lors du rafraîchissement du token:', error);
  }
  
  return token; // En cas d'échec, on retourne l'ancien token
}

/**
 * Vérifier si un token JWT est valide avec une gestion d'erreur améliorée
 * @param {string} token - Le token à vérifier
 * @returns {Promise<boolean>} true si le token est valide, false sinon
 */
async function isTokenValid(token) {
  if (!token) {
    console.log('🔍 Aucun token fourni pour la validation');
    return false;
  }
  
  // Vérification basique de la longueur du token
  if (token.length < 30) {
    console.warn('⚠️ Token trop court pour être valide');
    return false;
  }
  
  // Vérification du format JWT (doit avoir 3 parties séparées par des points)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.warn('❌ Format de token JWT invalide (doit avoir 3 parties)');
    return false;
  }
  
  try {
    // Décodage sécurisé du payload
    let payload;
    try {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = atob(payloadBase64);
      payload = JSON.parse(payloadJson);
      
      if (!payload) {
        console.warn('❌ Impossible de décoder le payload du token');
        return false;
      }
    } catch (e) {
      console.error('❌ Erreur lors du décodage du payload JWT:', e);
      return false;
    }
    
    const now = Math.floor(Date.now() / 1000); // en secondes, arrondi à l'entier inférieur
    
    // Vérification de la présence du champ exp
    if (typeof payload.exp !== 'number') {
      console.warn('❌ Token invalide: champ exp manquant ou invalide');
      return false;
    }
    
    // Vérification si le token est expiré
    if (now >= payload.exp) {
      console.log(`ℹ️ Token expiré le ${new Date(payload.exp * 1000).toISOString()}, tentative de rafraîchissement...`);
      
      try {
        const newToken = await refreshTokenIfNeeded(token);
        
        if (!newToken || newToken === token) {
          console.warn('⚠️ Impossible de rafraîchir le token expiré');
          return false;
        }
        
        console.log('✅ Token rafraîchi avec succès');
        
        // Mettre à jour le token dans le stockage
        const tokenKey = findTokenStorageKey();
        if (tokenKey) {
          const storage = getTokenStorage(tokenKey);
          if (storage) {
            storage.setItem(tokenKey, newToken);
            console.log('🔑 Token mis à jour dans le stockage');
          }
        }
        
        return true;
      } catch (refreshError) {
        console.error('❌ Erreur lors du rafraîchissement du token:', refreshError);
        return false;
      }
    }
    
    // Vérification si le token expire bientôt (moins de 30 minutes)
    const expiresIn = payload.exp - now;
    const thirtyMinutes = 30 * 60; // 30 minutes en secondes
    
    if (expiresIn < thirtyMinutes) {
      console.log(`ℹ️ Token expire dans ${Math.floor(expiresIn / 60)} minutes, rafraîchissement anticipé...`);
      
      // Rafraîchissement en arrière-plan sans attendre
      refreshTokenIfNeeded(token)
        .then(newToken => {
          if (newToken && newToken !== token) {
            console.log('✅ Token rafraîchi avec succès (en arrière-plan)');
            const tokenKey = findTokenStorageKey();
            if (tokenKey) {
              const storage = getTokenStorage(tokenKey);
              if (storage) {
                storage.setItem(tokenKey, newToken);
              }
            }
          }
        })
        .catch(e => {
          console.error('⚠️ Échec du rafraîchissement en arrière-plan:', e);
        });
    } else {
      console.log(`✅ Token valide, expire dans ${Math.ceil(expiresIn / 60)} minutes`);
    }
    
    return true;
    
  } catch (e) {
    console.error('❌ Erreur critique lors de la validation du token:', e);
    return false;
  }
}

/**
 * Trouve la clé sous laquelle le token est stocké
 * @returns {string|null} La clé du token ou null si non trouvée
 */
function findTokenStorageKey() {
  const TOKEN_KEYS = ['jwt', 'access_token', 'token', 'sb-access-token', 'sb:token'];
  for (const key of TOKEN_KEYS) {
    if (localStorage.getItem(key) || sessionStorage.getItem(key)) {
      return key;
    }
  }
  return null;
}

/**
 * Récupère le stockage (localStorage ou sessionStorage) qui contient le token
 * @param {string} key - La clé du token
 * @returns {Storage|null} Le stockage contenant le token ou null si non trouvé
 */
function getTokenStorage(key) {
  if (!key) return null;
  
  try {
    if (localStorage.getItem(key)) return localStorage;
    if (sessionStorage.getItem(key)) return sessionStorage;
  } catch (e) {
    console.error('Erreur lors de l\'accès au stockage:', e);
  }
  
  return null;
}

async function getUserRole() {
  const token = localStorage.getItem('jwt');
  if (!(await isTokenValid(token))) {
    // Si le token est invalide, on le supprime
    localStorage.removeItem('jwt');
    return null;
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || null;
  } catch (e) {
    return null;
  }
}

function checkAccess(page, role) {
  const allowedRoles = PAGE_ACCESS[page];
  if (!allowedRoles) return false; // Page non définie, accès refusé par défaut
  if (allowedRoles === 'public') return true;
  if (!role) return false; // Rôle non trouvé pour une page non publique

  return allowedRoles.includes(role);
}

// Flag pour éviter les vérifications répétées sur admin.html
let adminPageChecked = false;

async function protectPage() {
  const currentPage = window.location.pathname;
  
  // Pour la page admin, vérification unique pour éviter les boucles
  if (currentPage === '/admin.html') {
    // Si déjà vérifié, ne pas revérifier (évite les boucles)
    if (adminPageChecked) {
      console.log('🔒 Page admin déjà vérifiée - Pas de revérification');
      return;
    }
    adminPageChecked = true;
    
    // Ne pas restaurer de session automatiquement sur admin.html
    // Vérifier directement le token sans restaurer
    const token = localStorage.getItem('jwt');
    if (!token) {
      // Pas de token, rediriger immédiatement
      window.location.replace('/index.html');
      return;
    }
    
    // Vérifier le rôle directement sans restaurer la session
    try {
      const userRole = await getUserRole();
      const role = (userRole || '').toLowerCase();
      
      if (role !== 'admin' && role !== 'superadmin') {
        // Déconnexion immédiate sans tentative de reconnexion
        console.log('❌ Accès refusé à /admin.html - Déconnexion immédiate');
        localStorage.clear();
        if (window.sessionManager) {
          window.sessionManager.clearSession();
        }
        window.location.replace('/index.html');
        return;
      }
      
      // Si l'utilisateur est admin, permettre la navigation normale
      // Ne pas forcer à rester sur admin.html - permettre de quitter librement
      console.log('✅ Accès admin autorisé - Navigation libre autorisée');
      return;
    } catch (error) {
      // En cas d'erreur, déconnecter et rediriger
      console.error('Erreur vérification admin:', error);
      localStorage.clear();
      if (window.sessionManager) {
        window.sessionManager.clearSession();
      }
      window.location.replace('/index.html');
      return;
    }
  } else {
    // Réinitialiser le flag si on quitte admin.html
    adminPageChecked = false;
  }
  
  // Vérifier d'abord si on a un token dans l'URL (pour les liens de connexion par email)
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');
  
  if (urlToken && urlToken.length > 20) {
    localStorage.setItem('jwt', urlToken);
    // Nettoyer l'URL pour éviter de laisser le token dans l'historique
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  // Si la page est publique, ne rien faire
  if (PAGE_ACCESS[currentPage] === 'public') {
    // Vérifier si une déconnexion explicite a été effectuée
    const logoutFlag = localStorage.getItem('logout_flag');
    if (logoutFlag === 'true') {
      // Nettoyer le flag et s'assurer qu'on reste sur la page publique
      localStorage.removeItem('logout_flag');
      // Nettoyer aussi le token s'il existe encore
      localStorage.removeItem('jwt');
      if (window.sessionManager) {
        window.sessionManager.clearSession();
      }
      return;
    }
    
    // Vérifier si l'utilisateur est déjà connecté
    const token = localStorage.getItem('jwt');
    if (token && await isTokenValid(token) && (currentPage === '/index.html' || currentPage === '/')) {
      // Ne pas rediriger depuis la page d'accueil si déjà connecté
      // pour permettre l'accès à la page de connexion/d'inscription
      return;
    }
    return;
  }

  try {
    const userRole = await getUserRole();
    
    console.log('🔍 Debug auth - Rôle détecté:', userRole, 'Page actuelle:', currentPage);
    
    // Si l'utilisateur n'est pas connecté, le rediriger vers la page de connexion
    if (!userRole) {
      // Sauvegarder l'URL actuelle pour redirection après connexion
      if (currentPage !== '/index.html' && currentPage !== '/') {
        try {
          sessionStorage.setItem('redirectAfterLogin', window.location.href);
        } catch (e) {
          console.warn('⚠️ Tracking Prevention bloqué l\'accès à sessionStorage:', e);
        }
      }
      window.location.href = '/index.html';
      return;
    }

    // Vérifier si l'utilisateur a le bon rôle
    const hasAccess = checkAccess(currentPage, userRole);
    console.log('🔍 Debug auth - Accès à la page:', hasAccess);
    
    if (!hasAccess) {
      // Si l'utilisateur essaie d'accéder à /admin.html sans être admin/superadmin, déconnecter complètement
      if (currentPage === '/admin.html') {
        const role = (userRole || '').toLowerCase();
        if (role !== 'admin' && role !== 'superadmin') {
          console.log('❌ Tentative d\'accès à /admin.html sans autorisation - Déconnexion complète');
          // Déconnexion complète
          localStorage.removeItem('jwt');
          localStorage.removeItem('userProfile');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('loginData');
          localStorage.setItem('logout_flag', 'true');
          if (window.sessionManager) {
            window.sessionManager.clearSession();
          }
          // Rediriger vers index.html et empêcher le retour
          window.location.replace('/index.html');
          return;
        }
      }
      
      // Si l'utilisateur n'a pas accès, on le redirige vers une page appropriée
      // MAIS ne JAMAIS forcer les admins à rester sur admin.html
      // Permettre la navigation libre entre les pages autorisées
      let redirectUrl = '/index.html';
      
      // Vérifier si l'utilisateur est déjà sur une page autorisée pour son rôle
      const allowedPagesForRole = [];
      if (userRole === ROLES.AGENT) {
        allowedPagesForRole.push('/agent-dashboard.html', '/permissions.html', '/index.html');
        redirectUrl = '/agent-dashboard.html';
      } else if (userRole === ROLES.SUPERVISEUR || userRole === 'supervisor') {
        allowedPagesForRole.push('/dashboard.html', '/permissions.html', '/index.html');
        redirectUrl = '/dashboard.html';
      } else if (userRole === ROLES.ADMIN || userRole === ROLES.SUPERADMIN) {
        // Les admins peuvent accéder à plusieurs pages
        allowedPagesForRole.push('/admin.html', '/dashboard.html', '/permissions.html', '/agent-dashboard.html', '/index.html');
        // Ne rediriger vers admin.html QUE si l'utilisateur essaie d'accéder à une page vraiment non autorisée
        // Sinon, laisser naviguer librement
        redirectUrl = '/admin.html';
      }
      
      // Si l'utilisateur est déjà sur une page autorisée, NE PAS rediriger
      if (allowedPagesForRole.includes(currentPage)) {
        console.log('✅ Utilisateur déjà sur une page autorisée:', currentPage);
        return; // Permettre de rester sur la page actuelle
      }
      
      // Seulement rediriger si vraiment nécessaire
      console.log('🔍 Debug auth - Redirection vers:', redirectUrl, 'pour rôle:', userRole, 'depuis:', currentPage);
      window.location.href = redirectUrl;
    }
  } catch (error) {
    console.error('Erreur lors de la protection de la page:', error);
    // En cas d'erreur, on déconnecte l'utilisateur pour des raisons de sécurité
    localStorage.removeItem('jwt');
    window.location.href = '/index.html';
  }
}

// Appeler la protection sur chaque chargement de page
// Optimisation: vérifier la session d'abord pour éviter les redirections inutiles
document.addEventListener('DOMContentLoaded', async () => {
  // Pour admin.html, ne pas restaurer de session automatiquement
  const currentPage = window.location.pathname;
  if (currentPage !== '/admin.html') {
    // Vérifier d'abord si une déconnexion explicite a été effectuée
    const logoutFlag = localStorage.getItem('logout_flag');
    if (logoutFlag === 'true') {
      // Ne pas restaurer la session si déconnexion explicite
      console.log('🚪 Déconnexion détectée, pas de restauration automatique');
      if (window.sessionManager) {
        window.sessionManager.clearSession();
      }
      localStorage.removeItem('logout_flag');
      // Nettoyer aussi le token s'il existe encore
      localStorage.removeItem('jwt');
    } else {
      // Si une session existe, restaurer rapidement avant la protection (sauf pour admin.html)
      if (window.sessionManager) {
        const restored = await window.sessionManager.init();
        if (restored) {
          // Session restaurée, déclencher l'événement pour que les autres scripts le sachent
          window.dispatchEvent(new CustomEvent('sessionRestored'));
        }
      }
    }
  } else {
    // Pour admin.html, ne jamais restaurer automatiquement
    console.log('🔒 Page admin détectée - Pas de restauration automatique de session');
  }
  
  await protectPage();
  await renderNavbar();
  // Initialiser l'affichage global des messages (bulle) sur toutes les pages
  initGlobalMessagingUI();
});

async function renderNavbar() {
  const navPlaceholder = document.getElementById('navbar-placeholder');
  if (!navPlaceholder) return;

  const userRole = await getUserRole();
  const currentPage = window.location.pathname;

  const allLinks = [
    // Liens principaux
    { name: 'Objectifs', href: '/agent-dashboard.html', icon: '🎯', roles: [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN] },
    { name: 'Permissions', href: '/permissions.html', icon: '📋', roles: [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN] },
    { name: 'Aide', href: '/help.html', icon: '❓', roles: 'public' },
    { name: 'Administration', href: '/admin.html', icon: '⚙️', roles: [ROLES.ADMIN, ROLES.SUPERADMIN] }
  ];

  // Filtrer les liens en fonction du rôle de l'utilisateur
  const accessibleLinks = allLinks.filter(link => {
    if (link.roles === 'public') return true;
    return userRole && Array.isArray(link.roles) && link.roles.includes(userRole);
  });

  // Créer la barre de navigation
  let navbarHtml = `
    <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm py-2">
      <div class="container">
        <a class="navbar-brand" href="/">
          <img src="/Media/PP CCRB.png" alt="Logo" height="40" class="d-inline-block align-text-top">
        </a>
        
        <!-- Menu déroulant pour les petits écrans -->
        <button class="navbar-toggler d-lg-none" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        
        <div class="collapse navbar-collapse" id="navbarNav">
          <!-- Barre de navigation circulaire pour les grands écrans -->
          <div class="d-none d-lg-flex align-items-center justify-content-center w-100">
  `;

  // Ajouter les boutons de navigation circulaires
  accessibleLinks.forEach(link => {
    if (link.roles !== 'public' || !userRole) {
      const isActive = currentPage === link.href || 
                      (currentPage === '/' && link.href === '/index.html');
      // Pour le lien admin, ajouter un gestionnaire d'événement pour vérifier les permissions
      const onClickHandler = link.href === '/admin.html' ? 'onclick="return checkAdminAccess(event)"' : '';
      navbarHtml += `
        <a href="${link.href}" class="nav-circle-container ${isActive ? 'active' : ''}" title="${link.name}" ${onClickHandler}>
          <div class="nav-circle">${link.icon}</div>
          <span class="nav-label">${link.name.split(' ').pop()}</span>
        </a>
      `;
    }
  });

  navbarHtml += `
          </div>
          
          <!-- Menu déroulant pour les petits écrans -->
          <ul class="navbar-nav d-lg-none">
  `;

  // Ajouter les liens de navigation pour mobile
  accessibleLinks.forEach(link => {
    if (link.roles !== 'public' || !userRole) {
      const isActive = currentPage === link.href || 
                      (currentPage === '/' && link.href === '/index.html');
      // Pour le lien admin, ajouter un gestionnaire d'événement pour vérifier les permissions
      const onClickHandler = link.href === '/admin.html' ? 'onclick="return checkAdminAccess(event)"' : '';
      navbarHtml += `
        <li class="nav-item">
          <a class="nav-link ${isActive ? 'active' : ''}" href="${link.href}" ${onClickHandler}>
            <span class="me-2">${link.icon}</span> ${link.name}
          </a>
        </li>
      `;
    }
  });

  // Ajouter le bouton de connexion/déconnexion
  navbarHtml += `
          </ul>
          <div class="d-flex">
  `;

  if (userRole) {
    // Utilisateur connecté - Afficher uniquement le bouton de déconnexion
    navbarHtml += `
      <div class="d-flex align-items-center">
        <a href="#" class="btn btn-outline-danger" id="logoutBtn">
          <i class="bi bi-box-arrow-right me-1"></i> Déconnexion
        </a>
      </div>
    `;
  } else {
    // Utilisateur non connecté
    navbarHtml += `
      <a href="/index.html" class="btn btn-outline-primary me-2">
        <i class="bi bi-box-arrow-in-right me-1"></i> Connexion
      </a>
      <a href="/register.html" class="btn btn-primary">
        <i class="bi bi-person-plus me-1"></i> S'inscrire
      </a>
    `;
  }

  navbarHtml += `
          </div>
        </div>
      </div>
    </nav>
  `;

  // Injecter la barre de navigation
  navPlaceholder.innerHTML = navbarHtml;

  // Ajouter l'écouteur d'événement pour la déconnexion
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
}

async function isLoggedIn() {
  const token = localStorage.getItem('jwt');
  if (!token) return false;
  
  // Vérifier la validité du token
  return await isTokenValid(token);
}

/**
 * Fonction de déconnexion complète
 * Nettoie le localStorage et redirige vers la page de connexion
 */
function logout() {
  try {
    // Appeler la fonction de déconnexion globale si elle existe
    if (typeof window.logout === 'function') {
      window.logout();
    } else {
      // Nettoyage de base si la fonction globale n'existe pas
      localStorage.removeItem('jwt');
      localStorage.removeItem('userProfile');
      localStorage.removeItem('userEmail');
      
      // Nettoyer la session via le gestionnaire de session s'il existe
      if (window.sessionManager) {
        window.sessionManager.clearSession();
      }
      
      // Marquer la déconnexion explicite
      localStorage.setItem('logout_flag', 'true');
      
      // Rediriger vers la page de connexion
      window.location.replace('/index.html');
    }
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    // Forcer la redirection en cas d'erreur
    window.location.href = '/index.html';
  }
}

// Fonction pour vérifier l'accès admin avant de naviguer
window.checkAdminAccess = async function(event) {
  try {
    const userRole = await getUserRole();
    const role = (userRole || '').toLowerCase();
    
    if (role !== 'admin' && role !== 'superadmin') {
      event.preventDefault();
      console.log('❌ Accès refusé à /admin.html - Déconnexion complète');
      // Déconnexion complète
      localStorage.removeItem('jwt');
      localStorage.removeItem('userProfile');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('loginData');
      localStorage.setItem('logout_flag', 'true');
      if (window.sessionManager) {
        window.sessionManager.clearSession();
      }
      // Rediriger vers index.html
      window.location.replace('/index.html');
      return false;
    }
    return true;
  } catch (error) {
    console.error('Erreur vérification accès admin:', error);
    event.preventDefault();
    window.location.replace('/index.html');
    return false;
  }
};

// Injection légère des scripts temps réel + bulle si non présents
function initGlobalMessagingUI() {
  try {
    const ensureScript = (src) => {
      if (![...document.scripts].some(s => (s.getAttribute('src') || '').includes(src))) {
        const tag = document.createElement('script');
        tag.src = src;
        document.head.appendChild(tag);
      }
    };

    // Charger les composants nécessaires
    ensureScript('/components/realtime-messaging.js');
    ensureScript('/components/notification-bubble.js');

    // Si déjà chargés, rien à faire; sinon, attendre l'init et tester
    const readyCheck = () => {
      const hasRealtime = typeof window.realtimeMessaging !== 'undefined';
      const hasBubble = typeof window.notificationBubble !== 'undefined';
      if (!hasRealtime || !hasBubble) {
        setTimeout(readyCheck, 300);
        return;
      }
      // Rien d'autre: la bulle écoute l'événement 'newMessage' et s'auto-cache sur messages.html
    };
    readyCheck();
  } catch (e) {
    console.warn('Init global messaging UI failed:', e);
  }
}

