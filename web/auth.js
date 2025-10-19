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

function getUserRole() {
  const token = localStorage.getItem('jwt');
  if (!token) return null;
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

function protectPage() {
  const currentPage = window.location.pathname;
  const userRole = getUserRole();

  // Si la page est publique, ne rien faire
  if (PAGE_ACCESS[currentPage] === 'public') {
    return;
  }

  // Si l'utilisateur n'est pas connecté, le rediriger vers la page de connexion
  if (!userRole) {
    window.location.href = '/index.html';
    return;
  }

  // Vérifier si l'utilisateur a le bon rôle
  if (!checkAccess(currentPage, userRole)) {
    alert('Accès refusé. Vous n\'avez pas les permissions nécessaires pour voir cette page.');
    // Rediriger vers une page par défaut ou la page de connexion
    window.location.href = '/index.html'; 
  }
}

// Appeler la protection sur chaque chargement de page
document.addEventListener('DOMContentLoaded', () => {
  protectPage();
  renderNavbar();
});

function renderNavbar() {
  const userRole = getUserRole();
  const navPlaceholder = document.getElementById('navbar-placeholder');
  if (!navPlaceholder) return;

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

  let accessibleLinks = [];
  if (userRole) {
    accessibleLinks = allLinks.filter(link => link.roles === 'public' || (Array.isArray(link.roles) && link.roles.includes(userRole)));
  } else {
    accessibleLinks = allLinks.filter(link => link.roles === 'public');
  }

  const currentPage = window.location.pathname;

  const linksHtml = accessibleLinks.map(link => `
    <a href="${link.href}" class="circle-action ${currentPage === link.href ? 'circle-action-active' : ''}" title="${link.name}">
      <div class="icon">${link.icon}</div>
      <div class="label">${link.name}</div>
    </a>
  `).join('');

  const navbarHtml = `
  <nav class="navbar">
    <div class="navbar-brand">
      <a href="/index.html?stay=true" class="navbar-brand-link" style="display:flex;align-items:center;text-decoration:none;color:inherit">
        <img src="/Media/logo-ccrb.png" alt="CCRB Logo" class="navbar-logo">
        <div class="navbar-title">
          <h1>Presence CCRB</h1>
        </div>
      </a>
    </div>
    <div class="navbar-menu">
      ${linksHtml}
      <div class="navbar-user" id="navbar-user">
        ${userRole ? `<span class="navbar-user-info" id="user-info">${userRole}</span><button onclick="logout()" class="navbar-logout"><span class="navbar-icon">🚪</span><span>Déconnexion</span></button>` : '<a href="/index.html">Se connecter</a>'}
      </div>
    </div>
  </nav>
  `;

  navPlaceholder.innerHTML = navbarHtml;
}

function logout() {
  localStorage.removeItem('jwt');
  localStorage.removeItem('userProfile');
  window.location.href = '/index.html';
}

