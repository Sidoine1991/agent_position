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
  
  // Pages pour Superviseurs (et plus)
  '/dashboard.html': [ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN], // Dashboard superviseur
  '/team-management.html': [ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN], // A créer

  // Pages pour Admins (et plus)
  '/admin-agents.html': [ROLES.ADMIN, ROLES.SUPERADMIN],
  '/reports.html': [ROLES.ADMIN, ROLES.SUPERADMIN],

  // Page Superadmin
  '/admin.html': [ROLES.SUPERADMIN],

  // Pages publiques
  '/index.html': 'public',
  '/help.html': 'public',
  '/register.html': 'public'
};

// Durée de validité du token (24 heures)
const TOKEN_EXPIRY_HOURS = 24;

async function refreshTokenIfNeeded(token) {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Important pour les cookies de session
    });

    if (response.ok) {
      const data = await response.json();
      if (data.token) {
        localStorage.setItem('jwt', data.token);
        return data.token;
      }
    }
    return token; // Retourne l'ancien token si le rafraîchissement échoue
  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error);
    return token;
  }
}

async function isTokenValid(token) {
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Date.now() / 1000; // en secondes
    
    // Si le token expire dans moins de 30 minutes, on le rafraîchit
    if (payload.exp && (payload.exp - now) < 1800) {
      const newToken = await refreshTokenIfNeeded(token);
      if (newToken !== token) {
        return true; // Le token a été rafraîchi
      }
    }
    
    // Vérifier si le token est expiré
    if (payload.exp && now >= payload.exp) {
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Erreur de validation du token:', e);
    return false;
  }
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

async function protectPage() {
  const currentPage = window.location.pathname;
  
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
    // Vérifier si l'utilisateur est déjà connecté
    const token = localStorage.getItem('jwt');
    if (token && await isTokenValid(token)) {
      // Rediriger vers le tableau de bord si déjà connecté
      window.location.href = '/dashboard.html';
    }
    return;
  }

  try {
    const userRole = await getUserRole();
    
    // Si l'utilisateur n'est pas connecté, le rediriger vers la page de connexion
    if (!userRole) {
      // Sauvegarder l'URL actuelle pour redirection après connexion
      if (currentPage !== '/index.html' && currentPage !== '/') {
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
      }
      window.location.href = '/index.html';
      return;
    }

    // Vérifier si l'utilisateur a le bon rôle
    if (!checkAccess(currentPage, userRole)) {
      // Si l'utilisateur n'a pas accès, on le redirige vers une page appropriée
      if (userRole === ROLES.AGENT) {
        window.location.href = '/agent-dashboard.html';
      } else if (userRole === ROLES.SUPERVISEUR) {
        window.location.href = '/dashboard.html';
      } else if (userRole === ROLES.ADMIN || userRole === ROLES.SUPERADMIN) {
        window.location.href = '/admin.html';
      } else {
        window.location.href = '/index.html';
      }
    }
  } catch (error) {
    console.error('Erreur lors de la protection de la page:', error);
    // En cas d'erreur, on déconnecte l'utilisateur pour des raisons de sécurité
    localStorage.removeItem('jwt');
    window.location.href = '/index.html';
  }
}

// Appeler la protection sur chaque chargement de page
document.addEventListener('DOMContentLoaded', async () => {
  await protectPage();
  await renderNavbar();
});

async function renderNavbar() {
  const navPlaceholder = document.getElementById('navbar-placeholder');
  if (!navPlaceholder) return;

  const userRole = await getUserRole();
  const currentPage = window.location.pathname;

  const allLinks = [
    { name: 'Présence', href: '/index.html', icon: '📍', roles: [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN] },
    { name: 'Messages', href: '/messages.html', icon: '💬', roles: [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN] },
    { name: 'Mon Tableau de Bord', href: '/agent-dashboard.html', icon: '📊', roles: [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN] },
    { name: 'Planification', href: '/planning.html', icon: '🗓️', roles: [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN] },
    { name: 'Profil', href: '/profile.html', icon: '👤', roles: [ROLES.AGENT, ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN] },
    { name: 'Dashboard Superviseur', href: '/dashboard.html', icon: '📈', roles: [ROLES.SUPERVISEUR, ROLES.ADMIN, ROLES.SUPERADMIN] },
    { name: 'Gestion Agents', href: '/admin-agents.html', icon: '👥', roles: [ROLES.ADMIN, ROLES.SUPERADMIN] },
    { name: 'Rapports', href: '/reports.html', icon: '📄', roles: [ROLES.ADMIN, ROLES.SUPERADMIN] },
    { name: 'Administration', href: '/admin.html', icon: '⚙️', roles: [ROLES.SUPERADMIN] },
    { name: 'Aide', href: '/help.html', icon: '❓', roles: 'public' }
  ];

  // Filtrer les liens en fonction du rôle de l'utilisateur
  const accessibleLinks = allLinks.filter(link => {
    if (link.roles === 'public') return true;
    return userRole && Array.isArray(link.roles) && link.roles.includes(userRole);
  });

  // Créer la barre de navigation
  let navbarHtml = `
    <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm mb-4 py-2">
      <div class="container">
        <a class="navbar-brand" href="/">
          <img src="/Media/PP CCRB.png" alt="Logo" height="40" class="d-inline-block align-text-top">
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
  `;

  // Ajouter les liens de navigation
  accessibleLinks.forEach(link => {
    if (link.roles !== 'public' || !userRole) { // Ne pas afficher les liens publics si l'utilisateur est connecté
      const isActive = currentPage === link.href || 
                      (currentPage === '/' && link.href === '/index.html');
      navbarHtml += `
        <li class="nav-item">
          <a class="nav-link ${isActive ? 'active' : ''}" href="${link.href}">
            <span class="me-1">${link.icon}</span> ${link.name}
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
    // Utilisateur connecté
    navbarHtml += `
      <div class="dropdown">
        <button class="btn btn-outline-secondary dropdown-toggle" type="button" id="userDropdown" data-bs-toggle="dropdown">
          <i class="bi bi-person-circle me-1"></i> Mon compte
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><a class="dropdown-item" href="/profile.html"><i class="bi bi-person me-2"></i>Profil</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="#" id="logoutBtn"><i class="bi bi-box-arrow-right me-2"></i>Déconnexion</a></li>
        </ul>
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

function logout() {
  localStorage.removeItem('jwt');
  localStorage.removeItem('userProfile');
  window.location.href = '/index.html';
}

