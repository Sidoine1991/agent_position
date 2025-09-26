// Navigation unifiée pour toutes les pages
class NavigationManager {
  constructor() {
    this.currentPage = this.getCurrentPage();
    this.init();
  }

  getCurrentPage() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return 'home';
    if (path.includes('profile')) return 'profile';
    if (path.includes('dashboard')) return 'dashboard';
    if (path.includes('agents')) return 'agents';
    if (path.includes('reports')) return 'reports';
    if (path.includes('admin')) return 'admin';
    if (path.includes('map')) return 'map';
    if (path.includes('register')) return 'register';
    return 'home';
  }

  init() {
    this.setupNavbar();
    this.setupMobileMenu();
    this.updateActiveLinks();
  }

  setupNavbar() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    // Ajouter le bouton mobile si pas présent
    if (!document.querySelector('.navbar-toggle')) {
      const toggle = document.createElement('button');
      toggle.className = 'navbar-toggle';
      toggle.innerHTML = '☰';
      toggle.onclick = () => this.toggleMobileMenu();
      navbar.appendChild(toggle);
    }
  }

  setupMobileMenu() {
    const style = document.createElement('style');
    style.textContent = `
      .navbar-toggle {
        display: none;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.5rem;
        color: #333;
      }
      
      @media (max-width: 768px) {
        .navbar-toggle {
          display: block;
        }
        
        .navbar-menu {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 1000;
          flex-direction: column;
          padding: 1rem;
        }
        
        .navbar-menu.mobile-open {
          display: flex;
        }
        
        .navbar-link {
          margin: 0.5rem 0;
          padding: 0.75rem;
          border-radius: 8px;
        }
        
        .navbar-user {
          flex-direction: column;
          align-items: stretch;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #eee;
        }
      }
    `;
    document.head.appendChild(style);
  }

  toggleMobileMenu() {
    const menu = document.querySelector('.navbar-menu');
    if (menu) {
      menu.classList.toggle('mobile-open');
    }
  }

  updateActiveLinks() {
    // Retirer toutes les classes actives
    document.querySelectorAll('.navbar-link').forEach(link => {
      link.classList.remove('navbar-link-active');
    });

    // Ajouter la classe active à la page courante
    const activeSelectors = {
      'home': ['a[href="/"]', 'a[href="/index.html"]'],
      'profile': 'a[href*="profile"]',
      'dashboard': 'a[href*="dashboard"]',
      'agents': 'a[href*="agents"]',
      'reports': 'a[href*="reports"]',
      'admin': 'a[href*="admin"]',
      'map': 'a[href*="map"]',
      'register': 'a[href*="register"]'
    };

    const selectors = activeSelectors[this.currentPage];
    if (selectors) {
      const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
      selectorArray.forEach(selector => {
        const link = document.querySelector(selector);
        if (link) {
          link.classList.add('navbar-link-active');
        }
      });
    }
  }

  // Méthode pour mettre à jour la navbar selon le rôle utilisateur
  async updateForUser(user) {
    const links = {
      'profile-link': true, // Tous les utilisateurs connectés
      'map-link': true,
      'dashboard-link': ['admin', 'supervisor'].includes(user?.role),
      'agents-link': ['admin', 'supervisor'].includes(user?.role),
      'reports-link': ['admin', 'supervisor'].includes(user?.role),
      'admin-link': user?.role === 'admin',
      'register-link': user?.role === 'admin'
    };

    Object.entries(links).forEach(([linkId, shouldShow]) => {
      const link = document.getElementById(linkId);
      if (link) {
        link.style.display = shouldShow ? 'flex' : 'none';
      }
    });

    // Afficher les infos utilisateur
    const userInfo = document.getElementById('user-info');
    const navbarUser = document.getElementById('navbar-user');
    if (user && userInfo) {
      userInfo.textContent = `${user.name || user.email}`;
    }
    if (navbarUser) {
      navbarUser.style.display = user ? 'flex' : 'none';
    }
  }

  // Méthode pour fermer le menu mobile lors de la navigation
  closeMobileMenu() {
    const menu = document.querySelector('.navbar-menu');
    if (menu) {
      menu.classList.remove('mobile-open');
    }
  }
}

// Initialiser la navigation
const navigation = new NavigationManager();

// Fermer le menu mobile lors des clics sur les liens
document.addEventListener('click', (e) => {
  if (e.target.closest('.navbar-link')) {
    navigation.closeMobileMenu();
  }
});

// Exporter pour utilisation globale
window.NavigationManager = NavigationManager;
window.navigation = navigation;
