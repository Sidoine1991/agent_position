/**
 * Gestionnaire GPS amélioré avec géofencing et suivi continu
 */

class GPSTracker {
  constructor() {
    this.watchId = null;
    this.currentPosition = null;
    this.workZones = [];
    this.isTracking = false;
    this.lastKnownPosition = null;
    this.positionHistory = [];
    this.geofenceCallbacks = [];
    
    this.init();
  }

  async init() {
    await this.loadWorkZones();
    this.setupEventListeners();
  }

  async loadWorkZones() {
    try {
      // Utiliser la même logique de récupération du token que dans app.js et auth.js
      const token = localStorage.getItem('jwt') || 
                   localStorage.getItem('jwt_token') || 
                   localStorage.getItem('token') || 
                   (window.userSession && window.userSession.token);
      
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('🔑 Token JWT trouvé et ajouté aux en-têtes');
      } else {
        console.warn('⚠️ Aucun token JWT trouvé dans le stockage local');
      }
      
      console.log('🔍 Envoi de la requête à /api/work-zones avec les en-têtes:', headers);
      const response = await fetch('/api/work-zones', { headers });
      
      if (response.ok) {
        this.workZones = await response.json();
        console.log('✅ Zones de travail chargées avec succès');
      } else {
        console.error('❌ Erreur lors du chargement des zones de travail:', response.status, response.statusText);
        // Afficher plus de détails sur l'erreur
        try {
          const errorData = await response.json();
          console.error('Détails de l\'erreur:', errorData);
        } catch (e) {
          console.error('Impossible de parser la réponse d\'erreur:', e);
        }
      }
    } catch (error) {
      console.warn('Impossible de charger les zones de travail:', error);
    }
  }

  setupEventListeners() {
    // Écouter les changements de visibilité de la page
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseTracking();
      } else {
        this.resumeTracking();
      }
    });
  }

  async startTracking(options = {}) {
    if (this.isTracking) return;
    
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    };
    
    const trackingOptions = { ...defaultOptions, ...options };
    
    try {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handlePositionUpdate(position),
        (error) => this.handlePositionError(error),
        trackingOptions
      );
      
      this.isTracking = true;
      console.log('📍 Suivi GPS démarré');
      
      // Notifier le changement d'état
      this.notifyTrackingStateChange(true);
      
    } catch (error) {
      console.error('Erreur démarrage suivi GPS:', error);
    }
  }

  stopTracking() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    
    this.isTracking = false;
    console.log('📍 Suivi GPS arrêté');
    
    this.notifyTrackingStateChange(false);
  }

  pauseTracking() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  resumeTracking() {
    if (this.isTracking && !this.watchId) {
      this.startTracking();
    }
  }

  handlePositionUpdate(position) {
    this.currentPosition = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    };
    
    // Ajouter à l'historique
    this.positionHistory.push({
      ...this.currentPosition,
      timestamp: Date.now()
    });
    
    // Garder seulement les 100 dernières positions
    if (this.positionHistory.length > 100) {
      this.positionHistory = this.positionHistory.slice(-100);
    }
    
    // Vérifier les géofences
    this.checkGeofences();
    
    // Notifier les observateurs
    this.notifyPositionUpdate(this.currentPosition);
  }

  handlePositionError(error) {
    console.error('Erreur GPS:', error);
    
    let message = 'Erreur de géolocalisation';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Permission de géolocalisation refusée';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Position indisponible';
        break;
      case error.TIMEOUT:
        message = 'Timeout de géolocalisation';
        break;
    }
    
    this.notifyPositionError(message);
  }

  checkGeofences() {
    if (!this.currentPosition) return;
    
    for (const zone of this.workZones) {
      const distance = this.calculateDistance(
        this.currentPosition.latitude,
        this.currentPosition.longitude,
        zone.latitude,
        zone.longitude
      );
      
      const isInside = distance <= zone.radius;
      const wasInside = zone.lastStatus === 'inside';
      
      if (isInside !== wasInside) {
        zone.lastStatus = isInside ? 'inside' : 'outside';
        
        this.notifyGeofenceChange(zone, isInside);
        
        // Déclencher les callbacks
        this.geofenceCallbacks.forEach(callback => {
          callback(zone, isInside);
        });
      }
    }
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  addGeofenceCallback(callback) {
    this.geofenceCallbacks.push(callback);
  }

  removeGeofenceCallback(callback) {
    const index = this.geofenceCallbacks.indexOf(callback);
    if (index > -1) {
      this.geofenceCallbacks.splice(index, 1);
    }
  }

  // Méthodes de notification
  notifyPositionUpdate(position) {
    const event = new CustomEvent('gpsPositionUpdate', {
      detail: { position }
    });
    document.dispatchEvent(event);
  }

  notifyPositionError(message) {
    const event = new CustomEvent('gpsError', {
      detail: { message }
    });
    document.dispatchEvent(event);
  }

  notifyTrackingStateChange(isTracking) {
    const event = new CustomEvent('gpsTrackingStateChange', {
      detail: { isTracking }
    });
    document.dispatchEvent(event);
  }

  notifyGeofenceChange(zone, isInside) {
    const event = new CustomEvent('geofenceChange', {
      detail: { zone, isInside }
    });
    document.dispatchEvent(event);
  }

  // Méthodes utilitaires
  getCurrentPosition() {
    return this.currentPosition;
  }

  getPositionHistory() {
    return this.positionHistory;
  }

  isInWorkZone() {
    if (!this.currentPosition) return false;
    
    return this.workZones.some(zone => {
      const distance = this.calculateDistance(
        this.currentPosition.latitude,
        this.currentPosition.longitude,
        zone.latitude,
        zone.longitude
      );
      return distance <= zone.radius;
    });
  }

  getDistanceToWorkZone() {
    if (!this.currentPosition || this.workZones.length === 0) return null;
    
    let minDistance = Infinity;
    for (const zone of this.workZones) {
      const distance = this.calculateDistance(
        this.currentPosition.latitude,
        this.currentPosition.longitude,
        zone.latitude,
        zone.longitude
      );
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
  }
}

// Initialiser le tracker GPS
window.gpsTracker = new GPSTracker();

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GPSTracker;
}
