// Configuration des endpoints API
const API_CONFIG = {
  baseUrl: '/api',
  endpoints: {
    // Endpoints existants
    profile: '/me',
    planning: '/planning',
    validations: '/validations',
    
    // Endpoints manquants avec leurs statuts
    workZones: { path: '/work-zones', enabled: false },
    contacts: { path: '/contacts', enabled: false },
    messages: { path: '/messages', requiresAuth: true, enabled: true },
    emergencyContacts: { path: '/emergency-contacts', enabled: false },
    adminAgents: { path: '/admin/agents', requiresAuth: true, enabled: true },
    missions: { path: '/missions', enabled: false },
    locations: { path: '/locations', enabled: false },
    helpContent: { path: '/help/content', enabled: false },
    analytics: {
      presence: { path: '/analytics/presence', enabled: false },
      missions: { path: '/analytics/missions', enabled: false },
      performance: { path: '/analytics/performance', enabled: false }
    },
    agent: {
      achievements: { path: '/agent/achievements', enabled: false },
      leaderboard: { path: '/agent/leaderboard', enabled: false }
    },
    checkins: { path: '/checkins', enabled: false },
    goals: { path: '/goals', enabled: false },
    badges: { path: '/badges', enabled: false },
    presence: { 
      checkToday: { path: '/presence/check-today', enabled: true }
    }
  },
  
  // Récupérer l'URL complète d'un endpoint
  getEndpoint: function(endpointPath) {
    const parts = endpointPath.split('.');
    let current = this.endpoints;
    
    for (const part of parts) {
      if (current[part] === undefined) {
        console.warn(`Endpoint non trouvé: ${endpointPath}`);
        return null;
      }
      current = current[part];
    }
    
    if (!current.enabled) {
      console.warn(`Endpoint désactivé: ${endpointPath}`);
      return null;
    }
    
    if (current.requiresAuth && !this.isAuthenticated()) {
      console.warn(`Authentification requise pour: ${endpointPath}`);
      return null;
    }
    
    return this.baseUrl + current.path;
  },
  
  // Vérifier si l'utilisateur est authentifié
  isAuthenticated: function() {
    // Implémentez votre logique d'authentification ici
    return document.cookie.includes('auth_token=');
  }
};

// Gestionnaire d'API avec gestion des erreurs
const apiService = {
  // Méthode générique pour les requêtes API
  request: async function(endpoint, options = {}) {
    const url = API_CONFIG.getEndpoint(endpoint);
    if (!url) {
      return { success: false, error: 'Endpoint non disponible' };
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Erreur API (${endpoint}):`, error);
      return { 
        success: false, 
        error: error.message,
        endpoint: endpoint
      };
    }
  },

  // Exemples de méthodes spécifiques
  getProfile: function() {
    return this.request('profile');
  },
  
  getPlanning: function(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`planning?${query}`);
  },
  
  // Ajoutez d'autres méthodes d'API ici
};

// Exemple d'utilisation :
// apiService.getProfile().then(data => console.log(data));
// apiService.getPlanning({ from: '2025-10-01', to: '2025-10-31' });

export { API_CONFIG, apiService };
