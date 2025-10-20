// Composant de navigation circulaire
class CircularNav extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  async render() {
    const userRole = await this.getUserRole();
    const currentPage = window.location.pathname;

    const navItems = [
      { 
        name: 'Tableau de bord', 
        href: '/dashboard.html', 
        icon: '📊',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        name: 'Présence', 
        href: '/index.html', 
        icon: '📍',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        name: 'Planning', 
        href: '/planning.html', 
        icon: '📅',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        name: 'Messages', 
        href: '/messages.html', 
        icon: '💬',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        name: 'Équipe', 
        href: '/team-management.html', 
        icon: '👥',
        roles: ['SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      },
      { 
        name: 'Administration', 
        href: '/admin.html', 
        icon: '⚙️',
        roles: ['ADMIN', 'SUPERADMIN']
      },
      { 
        name: 'Aide', 
        href: '/help.html', 
        icon: '❓',
        roles: ['AGENT', 'SUPERVISEUR', 'ADMIN', 'SUPERADMIN']
      }
    ];

    // Filtrer les éléments en fonction du rôle de l'utilisateur
    const filteredItems = navItems.filter(item => 
      item.roles.includes(userRole) || userRole === 'SUPERADMIN'
    );

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          margin: 10px 0;
        }
        .circular-navbar {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 30px;
          margin: 0 auto;
          max-width: 95%;
          box-shadow: 0 2px 15px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 0, 0, 0.05);
        }
        .nav-circle-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-decoration: none;
          color: var(--text, #333);
          transition: all 0.2s ease;
          width: 70px;
          margin: 2px;
          padding: 8px 5px;
          border-radius: 15px;
          position: relative;
        }
        .nav-circle {
          width: 50px;
          height: 50px;
          border-radius: 16px;
          background: linear-gradient(135deg, var(--primary, #2563eb) 0%, var(--primary-dark, #1d4ed8) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          color: white;
          margin-bottom: 6px;
          transition: all 0.2s ease;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
        }
        .nav-label {
          font-size: 11px;
          text-align: center;
          color: var(--text-muted, #666);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .nav-circle-container:hover {
          background: rgba(var(--primary-rgb, 37, 99, 235), 0.1);
          transform: translateY(-2px);
        }
        .nav-circle-container:hover .nav-circle {
          transform: translateY(-3px) scale(1.1);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
        }
        .nav-circle-container:hover .nav-label {
          color: var(--primary, #2563eb);
          font-weight: 600;
        }
        .nav-circle-container.active {
          background: rgba(var(--primary-rgb, 37, 99, 235), 0.1);
        }
        .nav-circle-container.active .nav-circle {
          background: linear-gradient(135deg, var(--primary, #2563eb) 0%, var(--primary-dark, #1d4ed8) 100%);
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(var(--primary-rgb, 37, 99, 235), 0.3);
        }
        .nav-circle-container.active .nav-label {
          color: var(--primary, #2563eb);
          font-weight: 600;
        }
        @media (max-width: 768px) {
          .circular-navbar {
            overflow-x: auto;
            justify-content: flex-start;
            padding: 8px 10px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .circular-navbar::-webkit-scrollbar {
            display: none;
          }
          .nav-circle-container {
            min-width: 60px;
            flex-shrink: 0;
          }
          .nav-circle {
            width: 45px;
            height: 45px;
            font-size: 18px;
          }
          .nav-label {
            font-size: 10px;
          }
        }
      </style>
      <nav class="circular-navbar">
        ${filteredItems.map(item => {
          const isActive = currentPage === item.href || 
                         (currentPage === '/' && item.href === '/index.html');
          return `
            <a href="${item.href}" class="nav-circle-container ${isActive ? 'active' : ''}" 
               title="${item.name}">
              <div class="nav-circle">${item.icon}</div>
              <span class="nav-label">${item.name}</span>
            </a>
          `;
        }).join('')}
      </nav>
    `;
  }

  async getUserRole() {
    try {
      const token = localStorage.getItem('jwt');
      if (!token) return null;
      
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.role || null;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  }
}

// Définir le custom element
if (!customElements.get('circular-nav')) {
  customElements.define('circular-nav', CircularNav);
}
