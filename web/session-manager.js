/**
 * Gestionnaire de session optimisé
 * Gère la persistance de session et optimise le chargement
 */
class SessionManager {
  constructor() {
    this.SESSION_KEY = 'ccrb_session';
    this.SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 jours
    this.REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
    this.isInitialized = false;
    this.refreshTimer = null;
    console.log('🔧 Session Manager initialisé');
  }

  /**
   * Initialiser la session au chargement de la page
   */
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    console.log('🔍 Initialisation de la session...');

    // Vérifier si une session existe
    const session = this.getSession();
    if (session && session.token) {
      console.log('🔍 Session trouvée, vérification de la validité...');
      // Vérifier si la session est toujours valide
      if (this.isSessionValid(session)) {
        // Restaurer la session
        localStorage.setItem('jwt', session.token);
        if (session.userEmail) {
          localStorage.setItem('userEmail', session.userEmail);
        }
        if (session.userProfile) {
          localStorage.setItem('userProfile', JSON.stringify(session.userProfile));
        }
        console.log('✅ Session restaurée automatiquement');
        this.startAutoRefresh();
        return true;
      } else {
        console.log('⚠️ Session expirée, nettoyage...');
        // Session expirée, la supprimer
        this.clearSession();
      }
    } else {
      console.log('ℹ️ Aucune session trouvée');
    }
    return false;
  }

  /**
   * Sauvegarder la session après connexion
   */
  saveSession(token, userEmail, userProfile = null) {
    const session = {
      token,
      userEmail,
      userProfile,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      console.log('✅ Session sauvegardée');
    } catch (e) {
      console.warn('⚠️ Impossible de sauvegarder la session:', e);
    }
  }

  /**
   * Récupérer la session sauvegardée
   */
  getSession() {
    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY);
      if (sessionData) {
        return JSON.parse(sessionData);
      }
    } catch (e) {
      console.warn('⚠️ Erreur lecture session:', e);
    }
    return null;
  }

  /**
   * Vérifier si la session est valide
   */
  isSessionValid(session) {
    if (!session || !session.timestamp) return false;
    
    const now = Date.now();
    const age = now - session.timestamp;
    
    // Vérifier si la session n'est pas expirée
    if (age > this.SESSION_DURATION) {
      return false;
    }
    
    // Vérifier si le token JWT est toujours valide
    if (session.token) {
      try {
        const payload = JSON.parse(atob(session.token.split('.')[1]));
        const exp = payload.exp * 1000; // Convertir en millisecondes
        if (now >= exp) {
          return false; // Token expiré
        }
      } catch (e) {
        return false; // Token invalide
      }
    }
    
    return true;
  }

  /**
   * Mettre à jour la session (prolonger la durée)
   */
  updateSession() {
    const session = this.getSession();
    if (session) {
      session.timestamp = Date.now();
      try {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      } catch (e) {
        console.warn('⚠️ Impossible de mettre à jour la session:', e);
      }
    }
  }

  /**
   * Effacer la session (déconnexion)
   */
  clearSession() {
    try {
      localStorage.removeItem(this.SESSION_KEY);
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
      console.log('✅ Session effacée');
    } catch (e) {
      console.warn('⚠️ Erreur effacement session:', e);
    }
  }

  /**
   * Démarrer le rafraîchissement automatique du token
   */
  startAutoRefresh() {
    // Arrêter le timer existant s'il y en a un
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    console.log('🔄 Démarrage du rafraîchissement automatique du token...');
    
    // Démarrer un nouveau timer
    this.refreshTimer = setInterval(async () => {
      console.log('🔄 Vérification du rafraîchissement du token...');
      const session = this.getSession();
      if (session && session.token) {
        try {
          // Rafraîchir le token
          const newToken = await window.refreshTokenIfNeeded(session.token);
          if (newToken && newToken !== session.token) {
            console.log('🔄 Token rafraîchi avec succès');
            // Mettre à jour la session avec le nouveau token
            this.saveSession(newToken, session.userEmail, session.userProfile);
          } else {
            console.log('ℹ️ Aucun rafraîchissement nécessaire');
          }
        } catch (error) {
          console.error('❌ Erreur lors du rafraîchissement automatique:', error);
        }
      }
    }, this.REFRESH_INTERVAL);
  }
}

// Instance globale
const sessionManager = new SessionManager();

// Initialiser au chargement
if (typeof window !== 'undefined') {
  // Initialiser immédiatement pour restaurer la session avant le chargement complet
  sessionManager.init().then(restored => {
    if (restored) {
      // Session restaurée, déclencher un événement pour que les autres scripts le sachent
      window.dispatchEvent(new CustomEvent('sessionRestored'));
    }
  });
  
  // Démarrer le rafraîchissement automatique après le chargement complet
  window.addEventListener('DOMContentLoaded', () => {
    const session = sessionManager.getSession();
    if (session && session.token) {
      sessionManager.startAutoRefresh();
    }
  });
}

// Exporter pour utilisation globale
if (typeof window !== 'undefined') {
  window.sessionManager = sessionManager;
}

