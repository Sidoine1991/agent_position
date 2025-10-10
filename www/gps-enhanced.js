// GPS Enhanced - Gestion améliorée de la géolocalisation
class GPSManager {
  constructor() {
    this.isRequesting = false;
    this.lastPosition = null;
    this.watchId = null;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  // Demander la permission GPS avec notification
  async requestGPSPermission() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        this.showNotification('GPS Non Supporté', 'Votre navigateur ne supporte pas la géolocalisation.', 'error');
        reject(new Error('Géolocalisation non supportée'));
        return;
      }

      // Vérifier les permissions
      if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then(permission => {
          if (permission.state === 'denied') {
            this.showNotification(
              'Permission GPS Refusée', 
              'Veuillez autoriser la localisation dans les paramètres de votre navigateur.', 
              'error'
            );
            reject(new Error('Permission refusée'));
            return;
          }
          resolve(permission.state);
        });
      } else {
        resolve('granted');
      }
    });
  }

  // Obtenir la position GPS avec notifications
  async getCurrentPosition(options = {}) {
    if (this.isRequesting) {
      this.showNotification('GPS en cours...', 'Une demande de localisation est déjà en cours.', 'info');
      return this.lastPosition;
    }

    this.isRequesting = true;
    this.showNotification('GPS', 'Demande d\'accès à votre position...', 'info');

    try {
      // Demander la permission
      await this.requestGPSPermission();

      const position = await this.getPositionWithRetry(options);
      
      this.lastPosition = position;
      this.retryCount = 0;
      // Sauvegarder la dernière position pour usage offline
      try {
        localStorage.setItem('lastGPS', JSON.stringify({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        }));
      } catch {}
      
      this.showNotification(
        'Position Trouvée', 
        `Latitude: ${position.coords.latitude.toFixed(6)}, Longitude: ${position.coords.longitude.toFixed(6)}, Précision: ${Math.round(position.coords.accuracy)}m`, 
        'success'
      );

      return position;

    } catch (error) {
      this.handleGPSError(error);
      throw error;
    } finally {
      this.isRequesting = false;
    }
  }

  // Obtenir la position avec retry
  async getPositionWithRetry(options = {}) {
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    const finalOptions = { ...defaultOptions, ...options };

    return new Promise((resolve, reject) => {
      const attemptGetPosition = () => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // Vérifier la validité des coordonnées
            if (this.isValidPosition(position)) {
              resolve(position);
            } else {
              this.handleInvalidPosition(position);
              reject(new Error('Coordonnées GPS invalides'));
            }
          },
          (error) => {
            this.retryCount++;
            if (this.retryCount < this.maxRetries) {
              this.showNotification(
                'GPS', 
                `Tentative ${this.retryCount}/${this.maxRetries} - Nouvelle tentative...`, 
                'warning'
              );
              setTimeout(attemptGetPosition, 2000);
            } else {
              reject(error);
            }
          },
          finalOptions
        );
      };

      attemptGetPosition();
    });
  }

  // Vérifier la validité des coordonnées
  isValidPosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Vérifier que les coordonnées sont des nombres valides
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return false;
    }

    // Vérifier que les coordonnées sont dans des plages valides
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return false;
    }

    // Vérifier la précision (optionnel)
    if (accuracy && accuracy > 10000) { // Plus de 10km de précision
      return false;
    }

    return true;
  }

  // Gérer les positions invalides
  handleInvalidPosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    
    this.showNotification(
      'GPS Invalide', 
      `Coordonnées invalides: Lat=${latitude}, Lon=${longitude}, Précision=${accuracy}m. Rapprochez-vous d'une zone ouverte.`, 
      'error'
    );
  }

  // Gérer les erreurs GPS
  handleGPSError(error) {
    let message = 'Erreur de géolocalisation';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Permission GPS refusée. Activez la localisation dans les paramètres.';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Position indisponible. Vérifiez que le GPS est activé.';
        break;
      case error.TIMEOUT:
        message = 'Délai d\'attente dépassé. Rapprochez-vous d\'une zone ouverte.';
        break;
      default:
        message = error.message || 'Erreur GPS inconnue';
    }

    this.showNotification('Erreur GPS', message, 'error');
  }

  // Démarrer le suivi GPS continu
  startWatching(callback, options = {}) {
    if (this.watchId) {
      this.stopWatching();
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    };

    const finalOptions = { ...defaultOptions, ...options };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (this.isValidPosition(position)) {
          this.lastPosition = position;
          if (callback) callback(position);
        }
      },
      (error) => {
        this.handleGPSError(error);
      },
      finalOptions
    );

    this.showNotification('GPS', 'Suivi GPS démarré', 'success');
  }

  // Arrêter le suivi GPS
  stopWatching() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.showNotification('GPS', 'Suivi GPS arrêté', 'info');
    }
  }

  // Afficher les notifications
  showNotification(title, message, type = 'info') {
    // Créer l'élément de notification
    const notification = document.createElement('div');
    notification.className = `gps-notification gps-notification-${type}`;
    notification.innerHTML = `
      <div class="gps-notification-content">
        <div class="gps-notification-title">${title}</div>
        <div class="gps-notification-message">${message}</div>
      </div>
      <button class="gps-notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    // Ajouter les styles si pas déjà présents
    if (!document.getElementById('gps-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'gps-notification-styles';
      styles.textContent = `
        .gps-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 16px;
          max-width: 350px;
          z-index: 10000;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          animation: slideIn 0.3s ease-out;
        }
        
        .gps-notification-success {
          border-left: 4px solid #10b981;
        }
        
        .gps-notification-error {
          border-left: 4px solid #ef4444;
        }
        
        .gps-notification-warning {
          border-left: 4px solid #f59e0b;
        }
        
        .gps-notification-info {
          border-left: 4px solid #3b82f6;
        }
        
        .gps-notification-content {
          flex: 1;
        }
        
        .gps-notification-title {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
        }
        
        .gps-notification-message {
          color: #6b7280;
          font-size: 14px;
          line-height: 1.4;
        }
        
        .gps-notification-close {
          background: none;
          border: none;
          font-size: 20px;
          color: #9ca3af;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(styles);
    }

    // Ajouter la notification au DOM
    document.body.appendChild(notification);

    // Supprimer automatiquement après 5 secondes
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  // Obtenir la dernière position connue
  getLastPosition() {
    return this.lastPosition;
  }

  // Vérifier si le GPS est disponible
  isGPSAvailable() {
    return 'geolocation' in navigator;
  }
}

// Instance globale
window.gpsManager = new GPSManager();

// Fonction d'initialisation GPS améliorée
async function initEnhancedGPS() {
  console.log('🔧 Initialisation GPS améliorée...');
  
  // Vérifier la disponibilité
  if (!window.gpsManager.isGPSAvailable()) {
    window.gpsManager.showNotification(
      'GPS Non Supporté', 
      'Votre navigateur ne supporte pas la géolocalisation.', 
      'error'
    );
    return false;
  }

  // Afficher les instructions
  window.gpsManager.showNotification(
    'GPS', 
    'Cliquez sur "DÉBUTER LA MISSION" pour activer le GPS', 
    'info'
  );

  return true;
}

// Fonction pour obtenir la position avec notifications
async function getCurrentLocationWithNotifications() {
  try {
    const position = await window.gpsManager.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    });
    
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    };
  } catch (error) {
    console.error('Erreur GPS:', error);
    throw error;
  }
}

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  initEnhancedGPS();
});

console.log('✅ GPS Enhanced chargé');
