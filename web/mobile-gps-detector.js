// Mobile GPS Detector - Détection automatique mobile et demande GPS
class MobileGPSDetector {
  constructor() {
    this.isMobile = this.detectMobile();
    this.gpsPermissionGranted = false;
    this.gpsPermissionRequested = false;
    
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  // Détection d'appareil mobile
  detectMobile() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const isMobileDevice = mobileRegex.test(userAgent);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    
    return isMobileDevice || (isTouchDevice && isSmallScreen);
  }

  // Initialisation
  init() {
    if (this.isMobile) {
      console.log('📱 Appareil mobile détecté - Configuration GPS automatique activée');
      this.setupMobileGPS();
    } else {
      console.log('💻 Appareil desktop détecté - GPS manuel');
    }
  }

  // Configuration GPS pour mobile
  setupMobileGPS() {
    // Ajouter des styles pour les notifications GPS
    this.addGPSStyles();
    
    // Détecter les actions de mission
    this.setupMissionListeners();
    
    // Demander la permission GPS au chargement
    this.requestGPSPermissionOnLoad();
  }

  // Ajouter les styles pour les notifications GPS
  addGPSStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .gps-notification {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #0ea5e9, #0284c7);
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(14, 165, 233, 0.3);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        max-width: 90%;
        text-align: center;
        animation: slideDown 0.3s ease-out;
      }
      
      .gps-notification.error {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        box-shadow: 0 4px 20px rgba(239, 68, 68, 0.3);
      }
      
      .gps-notification.success {
        background: linear-gradient(135deg, #10b981, #059669);
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
      }
      
      .gps-notification.warning {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);
      }
      
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      
      .gps-permission-banner {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: white;
        border: 2px solid #0ea5e9;
        border-radius: 12px;
        padding: 15px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .gps-permission-banner h4 {
        margin: 0 0 10px 0;
        color: #0ea5e9;
        font-size: 16px;
        font-weight: 600;
      }
      
      .gps-permission-banner p {
        margin: 0 0 15px 0;
        color: #374151;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .gps-permission-banner .buttons {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      
      .gps-permission-banner button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .gps-permission-banner .btn-primary {
        background: #0ea5e9;
        color: white;
      }
      
      .gps-permission-banner .btn-primary:hover {
        background: #0284c7;
      }
      
      .gps-permission-banner .btn-secondary {
        background: #f3f4f6;
        color: #374151;
      }
      
      .gps-permission-banner .btn-secondary:hover {
        background: #e5e7eb;
      }
    `;
    document.head.appendChild(style);
  }

  // Configuration des écouteurs de mission
  setupMissionListeners() {
    // Écouter les clics sur les boutons de mission
    document.addEventListener('click', (e) => {
      const target = e.target;
      
      // Détecter les boutons de début/fin de mission
      if (target.matches('button[onclick*="startMission"]') || 
          target.matches('button[onclick*="endMission"]') ||
          target.matches('button[onclick*="markPresence"]') ||
          target.matches('button[onclick*="checkIn"]') ||
          target.matches('button[onclick*="checkOut"]')) {
        
        console.log('🎯 Action de mission détectée sur mobile');
        this.handleMissionAction();
      }
    });
  }

  // Gestion des actions de mission
  async handleMissionAction() {
    if (!this.gpsPermissionGranted) {
      console.log('📱 Demande de permission GPS pour action de mission');
      await this.requestGPSPermission('mission');
    } else {
      console.log('✅ Permission GPS déjà accordée');
    }
  }

  // Demander la permission GPS au chargement
  async requestGPSPermissionOnLoad() {
    // Attendre un peu que la page se charge
    setTimeout(async () => {
      if (!this.gpsPermissionRequested) {
        console.log('📱 Demande de permission GPS au chargement');
        await this.requestGPSPermission('load');
      }
    }, 2000);
  }

  // Demander la permission GPS
  async requestGPSPermission(context = 'general') {
    if (this.gpsPermissionRequested) {
      return this.gpsPermissionGranted;
    }

    this.gpsPermissionRequested = true;

    try {
      // Vérifier si la géolocalisation est supportée
      if (!navigator.geolocation) {
        this.showNotification('❌ Géolocalisation non supportée sur cet appareil', 'error');
        return false;
      }

      // Vérifier les permissions existantes
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'granted') {
          this.gpsPermissionGranted = true;
          this.showNotification('✅ GPS activé avec succès', 'success');
          return true;
        } else if (permission.state === 'denied') {
          this.showNotification('❌ Permission GPS refusée. Activez-la dans les paramètres', 'error');
          this.showPermissionBanner();
          return false;
        }
      }

      // Demander la permission avec un message contextuel
      const message = this.getContextualMessage(context);
      this.showPermissionBanner(message);

      // Attendre la réponse de l'utilisateur
      return new Promise((resolve) => {
        window.mobileGPSResponse = (granted) => {
          this.gpsPermissionGranted = granted;
          if (granted) {
            this.showNotification('✅ GPS activé avec succès', 'success');
            this.hidePermissionBanner();
          } else {
            this.showNotification('❌ Permission GPS refusée', 'error');
          }
          resolve(granted);
        };
      });

    } catch (error) {
      console.error('Erreur demande permission GPS:', error);
      this.showNotification('❌ Erreur lors de la demande GPS', 'error');
      return false;
    }
  }

  // Obtenir le message contextuel
  getContextualMessage(context) {
    const messages = {
      load: {
        title: '📍 Activation GPS Requise',
        text: 'Pour utiliser l\'application de présence, nous avons besoin d\'accéder à votre position GPS. Cela nous permet de valider vos déplacements et marquer votre présence avec précision.',
        button: 'Activer GPS'
      },
      mission: {
        title: '🎯 GPS Nécessaire pour la Mission',
        text: 'Pour commencer ou terminer une mission, nous devons connaître votre position exacte. Activez le GPS pour continuer.',
        button: 'Autoriser GPS'
      },
      general: {
        title: '📍 Permission GPS',
        text: 'Cette application nécessite l\'accès à votre position GPS pour fonctionner correctement.',
        button: 'Autoriser'
      }
    };

    return messages[context] || messages.general;
  }

  // Afficher la bannière de permission
  showPermissionBanner(message = null) {
    if (document.getElementById('gps-permission-banner')) {
      return; // Déjà affichée
    }

    const defaultMessage = {
      title: '📍 Activation GPS Requise',
      text: 'Pour utiliser l\'application de présence, nous avons besoin d\'accéder à votre position GPS.',
      button: 'Activer GPS'
    };

    const msg = message || defaultMessage;

    const banner = document.createElement('div');
    banner.id = 'gps-permission-banner';
    banner.className = 'gps-permission-banner';
    banner.innerHTML = `
      <h4>${msg.title}</h4>
      <p>${msg.text}</p>
      <div class="buttons">
        <button class="btn-secondary" onclick="window.mobileGPSResponse && window.mobileGPSResponse(false)">
          Plus tard
        </button>
        <button class="btn-primary" onclick="this.requestGPSLocation()">
          ${msg.button}
        </button>
      </div>
    `;

    // Ajouter la méthode requestGPSLocation au bouton
    banner.querySelector('.btn-primary').requestGPSLocation = async () => {
      try {
        const position = await this.getCurrentPosition();
        if (position) {
          this.gpsPermissionGranted = true;
          this.showNotification('✅ GPS activé avec succès', 'success');
          this.hidePermissionBanner();
          window.mobileGPSResponse && window.mobileGPSResponse(true);
        }
      } catch (error) {
        console.error('Erreur GPS:', error);
        this.showNotification('❌ Impossible d\'obtenir la position GPS', 'error');
      }
    };

    document.body.appendChild(banner);
  }

  // Masquer la bannière de permission
  hidePermissionBanner() {
    const banner = document.getElementById('gps-permission-banner');
    if (banner) {
      banner.remove();
    }
  }

  // Obtenir la position actuelle
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ Position GPS obtenue:', position.coords);
          resolve(position);
        },
        (error) => {
          console.error('❌ Erreur GPS:', error);
          this.handleGPSError(error);
          reject(error);
        },
        options
      );
    });
  }

  // Gérer les erreurs GPS
  handleGPSError(error) {
    const messages = {
      1: '❌ Permission GPS refusée. Activez-la dans les paramètres du navigateur.',
      2: '❌ Position GPS indisponible. Vérifiez votre connexion.',
      3: '❌ Délai d\'attente GPS dépassé. Réessayez.'
    };

    const message = messages[error.code] || '❌ Erreur GPS inconnue';
    this.showNotification(message, 'error');
  }

  // Afficher une notification
  showNotification(message, type = 'info') {
    // Supprimer les notifications existantes
    const existing = document.querySelectorAll('.gps-notification');
    existing.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `gps-notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Supprimer après 4 secondes
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 4000);
  }

  // Vérifier si GPS est disponible
  isGPSAvailable() {
    return this.gpsPermissionGranted && navigator.geolocation;
  }

  // Obtenir la position avec validation
  async getValidatedPosition() {
    if (!this.isGPSAvailable()) {
      throw new Error('GPS non disponible');
    }

    try {
      const position = await this.getCurrentPosition();
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
    } catch (error) {
      throw new Error('Impossible d\'obtenir la position GPS');
    }
  }
}

// Initialiser le détecteur mobile GPS
window.mobileGPSDetector = new MobileGPSDetector();

// Exporter pour utilisation globale
window.MobileGPSDetector = MobileGPSDetector;
