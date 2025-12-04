// Composant de navigation circulaire réutilisable
class CircularNav extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  getCurrentPage() {
    const path = window.location.pathname;
    return path.split('/').pop() || 'index.html';
  }

  isActive(href) {
    const currentPage = this.getCurrentPage();
    return href === currentPage || 
           (currentPage === 'index.html' && href === '/') ||
           (currentPage === '' && href === '/index.html');
  }

  getNavigationItems() {
    return [
      // Accueil et présence
      { 
        href: '/index.html', 
        icon: '🏠', 
        label: 'Accueil',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/index.html', 
        icon: '📍', 
        label: 'Présence',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      
      // Tableaux de bord
      { 
        href: '/agent-dashboard.html', 
        icon: '📊', 
        label: 'Mon Tableau de Bord',
        roles: ['AGENT']
      },
      { 
        href: '/agent-dashboard.html', 
        icon: '📄', 
        label: 'Rapport Agent',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/dashboard.html', 
        icon: '📈', 
        label: 'Tableau de Bord',
        roles: ['SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/synthese-globale.html', 
        icon: '🌍', 
        label: 'Synthèse Globale',
        roles: ['SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      
      // Planification et suivi
      { 
        href: '/planning.html', 
        icon: '🗓️', 
        label: 'Planning',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/agent-activity-tracking.html', 
        icon: '📝', 
        label: 'Suivi Activité',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      
      // Gestion et administration
      { 
        href: '/agents.html', 
        icon: '👥', 
        label: 'Équipe',
        roles: ['SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/reports.html', 
        icon: '📑', 
        label: 'Rapports',
        roles: ['SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      
      // Administration avancée
      { 
        href: '/admin.html', 
        icon: '⚙️', 
        label: 'Admin',
        roles: ['ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/admin/dashboard.html', 
        icon: '👑', 
        label: 'Super Admin',
        roles: ['SUPERADMIN']
      },
      
      // Communication et aide
      { 
        href: '/messages.html', 
        icon: '💬', 
        label: 'Messages',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/permissions.html', 
        icon: '📋', 
        label: 'Permissions',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/help.html', 
        icon: '❓', 
        label: 'Aide',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      }
    ];
  }

  async getUserRole() {
    try {
      // Essayer de récupérer le JWT depuis le stockage local
      const token = localStorage.getItem('jwt');
      if (token) {
        try {
          // Décoder le token JWT pour obtenir le payload
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload && payload.role) {
            return payload.role.toUpperCase();
          }
        } catch (e) {
          console.error('Erreur lors du décodage du token:', e);
        }
      }
      
      // Essayer de récupérer depuis l'ancien format (pour rétrocompatibilité)
      const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user && user.role) {
            return user.role.toUpperCase();
          }
        } catch (e) {
          console.error('Erreur lors du parsing des données utilisateur:', e);
        }
      }
      
      console.warn('Rôle utilisateur non trouvé, utilisation du rôle par défaut (AGENT)');
      return 'AGENT';
    } catch (error) {
      console.error('Erreur lors de la récupération du rôle utilisateur:', error);
      return 'AGENT'; // Retourner 'AGENT' comme valeur par défaut en cas d'erreur
    }
  }

  async render() {
    const userRole = await this.getUserRole();
    const navItems = this.getNavigationItems();
    
    this.innerHTML = `
      <style>
        .nav-container {
          display: flex;
          align-items: center;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 10px 20px;
        }
        
        .logo-container {
          display: flex;
          align-items: center;
          margin-right: 20px;
          text-decoration: none;
          padding: 8px;
          border-radius: 12px;
          transition: all 0.3s ease;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .logo-container:hover {
          background: rgba(255, 255, 255, 0.2);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transform: translateY(-2px);
        }
        
        .logo-container img {
          height: 45px;
          width: auto;
          border-radius: 8px;
          transition: transform 0.3s ease;
          margin-right: 10px;
          object-fit: contain;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        }
        
        .logo-text {
          color: #333;
          font-weight: bold;
          font-size: 1.1rem;
          white-space: nowrap;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
        }
        
        .logo-container img:hover {
          transform: scale(1.1);
          cursor: pointer;
        }
        
        @media (max-width: 768px) {
          .logo-container {
            padding: 6px;
            margin-right: 10px;
          }
          
          .logo-container img {
            height: 35px;
            margin-right: 6px;
          }
          
          .logo-text {
            font-size: 0.9rem;
          }
        }
        
        .circle-actions {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: wrap !important;
          gap: 16px;
          justify-content: center;
          align-items: center;
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          backdrop-filter: blur(10px);
          flex-grow: 1;
        }
        
        .circle-action {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          color: white;
          text-decoration: none;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          position: relative;
          overflow: hidden;
        }
        
        .circle-action:hover {
          transform: translateY(-5px) scale(1.1);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
          color: white;
          text-decoration: none;
        }
        
        .circle-action.active {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%) !important;
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(245, 87, 108, 0.4);
        }
        
        .circle-action .icon {
          font-size: 24px;
          margin-bottom: 4px;
        }
        
        .circle-action .label {
          font-size: 10px;
          font-weight: 600;
          text-align: center;
          line-height: 1.2;
        }
        
        @media (max-width: 768px) {
          .circle-action {
            width: 70px;
            height: 70px;
          }
          .circle-action .icon {
            font-size: 20px;
          }
          .circle-action .label {
            font-size: 9px;
          }
          
          .circle-actions {
            gap: 12px;
            padding: 15px;
          }
        }
        
        @media (max-width: 480px) {
          .circle-actions {
            gap: 8px;
            padding: 10px;
          }
          
          .circle-action {
            width: 60px;
            height: 60px;
          }
          
          .circle-action .icon {
            font-size: 18px;
            margin-bottom: 2px;
          }
          
          .circle-action .label {
            font-size: 8px;
          }
        }
      </style>
      <div class="nav-container">
        <a href="/index.html" class="logo-container" title="Retour à l'accueil - Presence CCR-B">
          <img src="/Media/logo-ccrb.png" alt="Logo CCR-B" title="CCR-B - Conseil de Concertation des Riziculteurs du Bénin">
          <span class="logo-text">Presence CCR-B</span>
        </a>
        <nav class="circle-actions">
          ${navItems.filter(item => item.roles.includes(userRole)).map(item => `
            <a href="${item.href}" class="circle-action ${this.isActive(item.href) ? 'active' : ''}" title="${item.label}">
              <div class="icon">${item.icon}</div>
              <div class="label">${item.label}</div>
            </a>
          `).join('')}
        </nav>
        <div class="navbar-user" style="margin-left: auto; display: flex; align-items: center; gap: 12px;">
          <button type="button" class="navbar-logout" onclick="window.logout && window.logout();" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.3); color: #dc3545; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
            <span style="margin-right: 6px;">🚪</span>
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    `;
    
    // S'assurer que la fonction logout est disponible
    if (typeof window.logout !== 'function') {
      // Attendre que app.js soit chargé
      setTimeout(() => {
        if (typeof window.logout === 'function') {
          const logoutBtn = this.querySelector('.navbar-logout');
          if (logoutBtn) {
            logoutBtn.onclick = () => {
              window.logout();
            };
          }
        }
      }, 500);
    }
  }
}

// Enregistrer le composant personnalisé
if (!customElements.get('circular-nav')) {
  customElements.define('circular-nav', CircularNav);
}
