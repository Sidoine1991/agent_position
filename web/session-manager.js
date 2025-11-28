/**
 * Gestionnaire de session optimisé
 * Gère la persistance de session et optimise le chargement
 */

class SessionManager {
  constructor() {
    this.SESSION_KEY = 'ccrb_session';
    this.SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 jours
    this.isInitialized = false;
  }

  /**
   * Initialiser la session au chargement de la page
   */
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Vérifier si une session existe
    const session = this.getSession();
    if (session && session.token) {
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
        return true;
      } else {
        // Session expirée, la supprimer
        this.clearSession();
      }
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
      console.log('✅ Session effacée');
    } catch (e) {
      console.warn('⚠️ Erreur effacement session:', e);
    }
  }

  /**
   * Vérifier périodiquement la validité de la session
   */
  startSessionWatcher() {
    // Vérifier toutes les 5 minutes
    setInterval(() => {
      const session = this.getSession();
      if (session) {
        if (!this.isSessionValid(session)) {
          // Session expirée, déconnecter
          this.clearSession();
          localStorage.removeItem('jwt');
          // Rediriger vers la page de connexion seulement si nécessaire
          const currentPage = window.location.pathname;
          if (currentPage !== '/index.html' && currentPage !== '/') {
            window.location.href = '/index.html';
          }
        } else {
          // Mettre à jour le timestamp pour prolonger la session
          this.updateSession();
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
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
  
  // Démarrer le watcher après le chargement complet
  window.addEventListener('DOMContentLoaded', () => {
    sessionManager.startSessionWatcher();
  });
}

// Exporter pour utilisation globale
if (typeof window !== 'undefined') {
  window.sessionManager = sessionManager;
}

