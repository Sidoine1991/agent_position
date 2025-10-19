// Gestionnaire d'erreurs global
class ErrorHandler {
  constructor() {
    this.ignoredEndpoints = [
      '/api/work-zones',
      '/api/contacts',
      '/api/emergency-contacts',
      // Ajoutez d'autres endpoints à ignorer ici
    ];
    
    this.setupGlobalErrorHandling();
  }
  
  // Configurer la gestion des erreurs globales
  setupGlobalErrorHandling() {
    // Intercepter les erreurs de fetch
    const originalFetch = window.fetch;
    window.fetch = async (url, options = {}) => {
      try {
        const response = await originalFetch(url, options);
        
        // Vérifier si l'URL est dans la liste des endpoints ignorés
        const shouldIgnore = this.ignoredEndpoints.some(endpoint => 
          url.toString().includes(endpoint)
        );
        
        if (!response.ok && !shouldIgnore) {
          this.handleHttpError(response, url);
        }
        
        return response;
      } catch (error) {
        this.handleError(error, url);
        throw error;
      }
    };
    
    // Gérer les erreurs non attrapées
    window.addEventListener('error', (event) => {
      this.handleError(event.error || event.message);
    });
    
    // Gérer les promesses non attrapées
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason);
    });
  }
  
  // Gérer les erreurs HTTP
  handleHttpError(response, url) {
    const errorInfo = {
      status: response.status,
      statusText: response.statusText,
      url: url,
      timestamp: new Date().toISOString()
    };
    
    console.error('Erreur HTTP:', errorInfo);
    
    // Vous pouvez personnaliser la gestion des erreurs en fonction du code d'état
    switch (response.status) {
      case 401:
        this.handleUnauthorized();
        break;
      case 403:
        this.handleForbidden();
        break;
      case 404:
        this.handleNotFound(url);
        break;
      case 500:
        this.handleServerError();
        break;
      default:
        this.showErrorNotification(`Erreur ${response.status}: ${response.statusText}`);
    }
    
    return errorInfo;
  }
  
  // Gérer les erreurs générales
  handleError(error, context) {
    console.error('Erreur:', {
      error: error,
      context: context,
      timestamp: new Date().toISOString()
    });
    
    // Afficher une notification à l'utilisateur
    this.showErrorNotification('Une erreur est survenue. Veuillez réessayer.');
    
    // Vous pouvez également envoyer l'erreur à un service de suivi ici
    // this.logErrorToService(error, context);
  }
  
  // Gérer l'erreur 401 (Non autorisé)
  handleUnauthorized() {
    // Rediriger vers la page de connexion ou afficher une modale de connexion
    console.warn('Accès non autorisé. Redirection vers la page de connexion...');
    // window.location.href = '/login';
  }
  
  // Gérer l'erreur 403 (Accès refusé)
  handleForbidden() {
    this.showErrorNotification('Vous n\'avez pas les permissions nécessaires pour effectuer cette action.');
  }
  
  // Gérer l'erreur 404 (Non trouvé)
  handleNotFound(url) {
    // Ne pas afficher d'erreur pour les endpoints connus comme manquants
    const isIgnored = this.ignoredEndpoints.some(endpoint => 
      url.toString().includes(endpoint)
    );
    
    if (!isIgnored) {
      console.warn(`Ressource non trouvée: ${url}`);
      this.showErrorNotification('La ressource demandée est introuvable.');
    }
  }
  
  // Gérer l'erreur 500 (Erreur serveur)
  handleServerError() {
    this.showErrorNotification('Une erreur est survenue sur le serveur. Veuillez réessayer plus tard.');
  }
  
  // Afficher une notification d'erreur
  showErrorNotification(message) {
    // Utilisez votre système de notification préféré ici
    if (window.toastr) {
      toastr.error(message);
    } else if (window.alert) {
      alert(message);
    }
  }
  
  // Journaliser les erreurs dans un service externe (optionnel)
  logErrorToService(error, context) {
    // Implémentez l'envoi des erreurs à un service comme Sentry, LogRocket, etc.
    console.log('Journalisation de l\'erreur:', { error, context });
  }
}

// Initialiser le gestionnaire d'erreurs
const errorHandler = new ErrorHandler();

export { errorHandler };
