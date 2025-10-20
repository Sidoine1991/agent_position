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
      { 
        href: '/index.html', 
        icon: '📍', 
        label: 'Présence',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/messages.html', 
        icon: '💬', 
        label: 'Messages',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/agent-dashboard.html', 
        icon: '📊', 
        label: 'Mon Tableau de Bord',
        roles: ['AGENT']
      },
      { 
        href: '/dashboard.html', 
        icon: '📈', 
        label: 'Tableau de Bord',
        roles: ['SUPERVISEUR', 'ADMIN']
      },
      { 
        href: '/planning.html', 
        icon: '🗓️', 
        label: 'Planification',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/agent-activity-tracking.html', 
        icon: '📝', 
        label: 'Suivi Activité',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/agents.html', 
        icon: '👥', 
        label: 'Gestion Agents',
        roles: ['ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/reports.html', 
        icon: '📄', 
        label: 'Rapports',
        roles: ['ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/agent-dashboard.html', 
        icon: '🎯', 
        label: 'Mes Objectifs',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/help.html', 
        icon: '❓', 
        label: 'Aide',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        href: '/admin/dashboard.html', 
        icon: '👑', 
        label: 'Super Admin',
        roles: ['SUPERADMIN']
      },
      { 
        href: '/admin.html', 
        icon: '⚙️', 
        label: 'Admin',
        roles: ['ADMIN']
      }
    ];
  }

  async getUserRole() {
    // Cette fonction devrait être implémentée pour récupérer le rôle de l'utilisateur connecté
    // Pour l'instant, on retourne un rôle par défaut
    return 'AGENT';
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
        }
        
        .logo-container img {
          height: 50px;
          width: auto;
          border-radius: 8px;
          transition: transform 0.3s ease;
          margin-right: 10px;
        }
        
        .logo-text {
          color: #333;
          font-weight: bold;
          font-size: 1.2rem;
          white-space: nowrap;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
        }
        
        .logo-container img:hover {
          transform: scale(1.05);
          cursor: pointer;
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
        <a href="/home.html" class="logo-container">
          <img src="/Media/logo-ccrb.png" alt="Presence CCR-B" title="Accueil">
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
      </div>
    `;
  }
}

// Enregistrer le composant personnalisé
if (!customElements.get('circular-nav')) {
  customElements.define('circular-nav', CircularNav);
}
