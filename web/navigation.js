// ===== SYSTÈME DE NAVIGATION UNIFIÉ =====
class NavigationManager {
    constructor() {
        this.currentPage = 'dashboard';
        this.isMobile = window.innerWidth <= 768;
        this.mobileMenuOpen = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateNavbar();
        this.handleResponsive();
    }

    setupEventListeners() {
        // Toggle mobile menu
        const mobileToggle = document.querySelector('.navbar-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => this.toggleMobileMenu());
        }

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.mobileMenuOpen && !e.target.closest('.navbar')) {
                this.closeMobileMenu();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => this.handleResponsive());

        // Handle navigation links
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-page]')) {
                e.preventDefault();
                this.navigateTo(e.target.dataset.page);
            }
        });
    }

    handleResponsive() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;
        
        if (wasMobile !== this.isMobile) {
            this.updateNavbar();
            if (!this.isMobile) {
                this.closeMobileMenu();
            }
        }
    }

    toggleMobileMenu() {
        this.mobileMenuOpen = !this.mobileMenuOpen;
        const menu = document.querySelector('.navbar-menu');
        const toggle = document.querySelector('.navbar-toggle');
        
        if (menu) {
            menu.classList.toggle('mobile-open', this.mobileMenuOpen);
        }
        
        if (toggle) {
            toggle.innerHTML = this.mobileMenuOpen ? '✕' : '☰';
        }
    }

    closeMobileMenu() {
        this.mobileMenuOpen = false;
        const menu = document.querySelector('.navbar-menu');
        const toggle = document.querySelector('.navbar-toggle');
        
        if (menu) {
            menu.classList.remove('mobile-open');
        }
        
        if (toggle) {
            toggle.innerHTML = '☰';
        }
    }

    navigateTo(page) {
        this.currentPage = page;
        this.closeMobileMenu();
        this.updateActiveLink();
        this.loadPage(page);
    }

    updateActiveLink() {
        // Remove active class from all links
        document.querySelectorAll('.navbar-link').forEach(link => {
            link.classList.remove('navbar-link-active');
        });

        // Add active class to current page link
        const activeLink = document.querySelector(`[data-page="${this.currentPage}"]`);
        if (activeLink) {
            activeLink.classList.add('navbar-link-active');
        }
    }

    loadPage(page) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        
        // Show target page
        const targetPage = document.getElementById(`${page}-page`);
        if (targetPage) {
            targetPage.style.display = 'block';
            this.animatePageIn(targetPage);
        }

        // Load page-specific data
        this.loadPageData(page);
    }

    animatePageIn(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        
        requestAnimationFrame(() => {
            element.style.transition = 'all 0.3s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
    }

    loadPageData(page) {
        switch(page) {
            case 'dashboard':
                if (window.loadDashboard) window.loadDashboard();
                break;
            case 'profile':
                if (window.loadProfile) window.loadProfile();
                break;
            case 'agents':
                if (window.loadAgents) window.loadAgents();
                break;
            case 'reports':
                if (window.loadReports) window.loadReports();
                break;
            case 'admin':
                if (window.loadAdmin) window.loadAdmin();
                break;
        }
    }

    updateNavbar() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        // Get user profile
        const profile = this.getUserProfile();
        
        if (profile) {
            this.updateUserInfo(profile);
            this.updateMenuForUser(profile);
        } else {
            this.showLoginMenu();
        }
    }

    // Méthode pour la compatibilité avec app.js
    async updateForUser(profile) {
        if (profile) {
            this.currentUser = profile;
            this.updateUserInfo(profile);
            this.updateMenuForUser(profile);
        } else {
            this.currentUser = null;
            this.showLoginMenu();
        }
    }

    getUserProfile() {
        try {
            const profileData = localStorage.getItem('userProfile');
            return profileData ? JSON.parse(profileData) : null;
        } catch {
            return null;
        }
    }

    updateUserInfo(profile) {
        const userInfo = document.querySelector('.navbar-user-info');
        if (userInfo) {
            userInfo.textContent = `${profile.first_name} ${profile.last_name}`;
        }
    }

    updateMenuForUser(profile) {
        const menu = document.querySelector('.navbar-menu');
        if (!menu) return;

        // Clear existing menu
        menu.innerHTML = '';

        // Add navigation links based on user role
        const links = this.getMenuLinks(profile.role);
        
        links.forEach(link => {
            const linkElement = document.createElement('a');
            linkElement.href = '#';
            linkElement.className = 'navbar-link';
            linkElement.dataset.page = link.page;
            linkElement.innerHTML = `
                <span class="navbar-icon">${link.icon}</span>
                ${link.text}
            `;
            menu.appendChild(linkElement);
        });

        // Add user dropdown
        this.addUserDropdown(menu, profile);
    }

    getMenuLinks(role) {
        const baseLinks = [
            { page: 'dashboard', text: 'Tableau de bord', icon: '🏠' },
            { page: 'profile', text: 'Profil', icon: '👤' }
        ];

        switch(role) {
            case 'admin':
                return [
                    ...baseLinks,
                    { page: 'agents', text: 'Agents', icon: '👥' },
                    { page: 'reports', text: 'Rapports', icon: '📊' },
                    { page: 'admin', text: 'Administration', icon: '⚙️' }
                ];
            case 'supervisor':
                return [
                    ...baseLinks,
                    { page: 'agents', text: 'Agents', icon: '👥' },
                    { page: 'reports', text: 'Rapports', icon: '📊' }
                ];
            case 'agent':
            default:
                return baseLinks;
        }
    }

    addUserDropdown(menu, profile) {
        const dropdown = document.createElement('div');
        dropdown.className = 'navbar-dropdown';
        dropdown.innerHTML = `
            <button class="navbar-dropdown-toggle">
                <span class="navbar-icon">👤</span>
                ${profile.first_name} ${profile.last_name}
                <span class="navbar-arrow">▼</span>
            </button>
            <div class="navbar-dropdown-menu">
                <button class="navbar-dropdown-item" data-page="profile">
                    <span class="navbar-icon">👤</span>
                    Mon Profil
                </button>
                <button class="navbar-dropdown-item" onclick="navigation.logout()">
                    <span class="navbar-icon">🚪</span>
                    Déconnexion
                </button>
            </div>
        `;
        menu.appendChild(dropdown);
    }

    showLoginMenu() {
        const menu = document.querySelector('.navbar-menu');
        if (!menu) return;

        menu.innerHTML = `
            <a href="register.html" class="navbar-link">
                <span class="navbar-icon">📝</span>
                S'inscrire
            </a>
            <a href="index.html" class="navbar-link">
                <span class="navbar-icon">🔑</span>
                Connexion
            </a>
        `;
    }

    logout() {
        // Clear user data
        localStorage.removeItem('jwt');
        localStorage.removeItem('userProfile');
        localStorage.removeItem('loginData');
        
        // Redirect to login
        window.location.href = 'index.html';
    }
}

// Initialize navigation
const navigation = new NavigationManager();

// Export for global access
window.navigation = navigation;