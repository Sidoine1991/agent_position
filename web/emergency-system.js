/**
 * Système d'urgence pour l'application CCRB
 */

class EmergencySystem {
  constructor() {
    this.isEmergencyMode = false;
    this.emergencyContacts = [];
    this.emergencyData = null;
    this.emergencyTimer = null;
    this.gpsTracker = null;
    
    this.init();
  }

  async init() {
    await this.loadEmergencyContacts();
    this.setupEventListeners();
    this.setupEmergencyButton();
  }

  async loadEmergencyContacts() {
    try {
      const response = await fetch('/api/emergency-contacts');
      if (response.ok) {
        this.emergencyContacts = await response.json();
      } else {
        // Contacts par défaut
        this.emergencyContacts = [
          { name: 'Superviseur Principal', phone: '+22912345678', role: 'supervisor' },
          { name: 'Sécurité CCRB', phone: '+22987654321', role: 'security' }
        ];
      }
    } catch (error) {
      console.warn('Impossible de charger les contacts d\'urgence:', error);
    }
  }

  setupEventListeners() {
    // Écouter les événements GPS
    document.addEventListener('gpsPositionUpdate', (event) => {
      if (this.isEmergencyMode) {
        this.updateEmergencyLocation(event.detail.position);
      }
    });

    // Écouter les changements de visibilité
    document.addEventListener('visibilitychange', () => {
      if (this.isEmergencyMode && document.hidden) {
        this.handleEmergencyVisibilityChange();
      }
    });

    // Écouter les événements de batterie
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        battery.addEventListener('levelchange', () => {
          if (battery.level < 0.1 && this.isEmergencyMode) {
            this.handleLowBatteryEmergency();
          }
        });
      });
    }
  }

  setupEmergencyButton() {
    // Créer le bouton d'urgence flottant
    const emergencyButton = document.createElement('button');
    emergencyButton.id = 'emergency-button';
    emergencyButton.innerHTML = '🚨 SOS';
    emergencyButton.className = 'emergency-button';
    emergencyButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ff4757, #ff3838);
      color: white;
      border: none;
      font-size: 16px;
      font-weight: bold;
      box-shadow: 0 4px 20px rgba(255, 71, 87, 0.4);
      z-index: 9999;
      cursor: pointer;
      transition: all 0.3s ease;
      animation: pulse 2s infinite;
    `;

    // Ajouter l'animation CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      .emergency-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 25px rgba(255, 71, 87, 0.6);
      }
      .emergency-button.activated {
        background: linear-gradient(135deg, #ff6b6b, #ff5252);
        animation: none;
        transform: scale(1.2);
      }
    `;
    document.head.appendChild(style);

    emergencyButton.addEventListener('click', () => {
      this.activateEmergency();
    });

    // Long press pour désactiver
    let longPressTimer;
    emergencyButton.addEventListener('mousedown', () => {
      longPressTimer = setTimeout(() => {
        this.deactivateEmergency();
      }, 3000);
    });

    emergencyButton.addEventListener('mouseup', () => {
      clearTimeout(longPressTimer);
    });

    emergencyButton.addEventListener('mouseleave', () => {
      clearTimeout(longPressTimer);
    });

    document.body.appendChild(emergencyButton);
  }

  async activateEmergency() {
    if (this.isEmergencyMode) return;

    this.isEmergencyMode = true;
    console.log('🚨 MODE URGENCE ACTIVÉ');

    // Collecter les données d'urgence
    this.emergencyData = await this.collectEmergencyData();

    // Envoyer l'alerte d'urgence
    await this.sendEmergencyAlert();

    // Démarrer le suivi d'urgence
    this.startEmergencyTracking();

    // Notifier l'interface
    this.notifyEmergencyActivated();

    // Vibrer si supporté
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }

    // Notification
    if (window.notificationManager) {
      await window.notificationManager.sendNotification('🚨 URGENCE ACTIVÉE', {
        body: 'Votre position est partagée avec les contacts d\'urgence',
        tag: 'emergency-activated',
        requireInteraction: true
      });
    }
  }

  async deactivateEmergency() {
    if (!this.isEmergencyMode) return;

    this.isEmergencyMode = false;
    console.log('✅ MODE URGENCE DÉSACTIVÉ');

    // Arrêter le suivi d'urgence
    this.stopEmergencyTracking();

    // Envoyer notification de désactivation
    await this.sendEmergencyDeactivation();

    // Notifier l'interface
    this.notifyEmergencyDeactivated();

    // Notification
    if (window.notificationManager) {
      await window.notificationManager.sendNotification('✅ URGENCE DÉSACTIVÉE', {
        body: 'Le mode urgence a été désactivé',
        tag: 'emergency-deactivated'
      });
    }
  }

  async collectEmergencyData() {
    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const currentPosition = window.gpsTracker?.getCurrentPosition();
    
    return {
      userId: userProfile.id,
      userName: userProfile.name || userProfile.email,
      timestamp: new Date().toISOString(),
      position: currentPosition,
      batteryLevel: await this.getBatteryLevel(),
      networkStatus: navigator.onLine ? 'online' : 'offline',
      userAgent: navigator.userAgent,
      appVersion: '1.0.0'
    };
  }

  async sendEmergencyAlert() {
    const alertData = {
      type: 'EMERGENCY_ALERT',
      data: this.emergencyData,
      contacts: this.emergencyContacts
    };

    try {
      // Envoyer via API
      const response = await fetch('/api/emergency/alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        },
        body: JSON.stringify(alertData)
      });

      if (!response.ok) {
        throw new Error('Erreur envoi alerte API');
      }

      console.log('✅ Alerte d\'urgence envoyée via API');

    } catch (error) {
      console.error('❌ Erreur envoi alerte API:', error);
      
      // Fallback: envoyer via SMS/Email
      await this.sendEmergencyFallback();
    }

    // Notifier les contacts d'urgence
    await this.notifyEmergencyContacts();
  }

  async sendEmergencyFallback() {
    // Envoyer des SMS/emails aux contacts d'urgence
    for (const contact of this.emergencyContacts) {
      try {
        await this.sendEmergencySMS(contact);
        await this.sendEmergencyEmail(contact);
      } catch (error) {
        console.error(`Erreur notification ${contact.name}:`, error);
      }
    }
  }

  async sendEmergencySMS(contact) {
    // Utiliser l'API SMS du navigateur si disponible
    if ('sms' in navigator) {
      const message = `URGENCE CCRB: ${this.emergencyData.userName} a activé le mode urgence. Position: ${this.emergencyData.position?.latitude}, ${this.emergencyData.position?.longitude}`;
      
      await navigator.sms.send({
        number: contact.phone,
        body: message
      });
    }
  }

  async sendEmergencyEmail(contact) {
    const subject = 'URGENCE CCRB - Alerte Agent';
    const body = `
      URGENCE DÉCLARÉE
      
      Agent: ${this.emergencyData.userName}
      Heure: ${new Date(this.emergencyData.timestamp).toLocaleString()}
      Position: ${this.emergencyData.position?.latitude}, ${this.emergencyData.position?.longitude}
      Batterie: ${this.emergencyData.batteryLevel}%
      Statut réseau: ${this.emergencyData.networkStatus}
      
      Veuillez contacter l'agent immédiatement.
    `;

    const mailtoLink = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
  }

  async notifyEmergencyContacts() {
    // Envoyer des notifications push aux superviseurs
    if (window.notificationManager) {
      for (const contact of this.emergencyContacts) {
        if (contact.role === 'supervisor') {
          await window.notificationManager.sendNotification('🚨 URGENCE AGENT', {
            body: `${this.emergencyData.userName} a activé le mode urgence`,
            tag: 'emergency-agent',
            requireInteraction: true
          });
        }
      }
    }
  }

  startEmergencyTracking() {
    // Envoyer la position toutes les 30 secondes
    this.emergencyTimer = setInterval(async () => {
      if (this.isEmergencyMode) {
        await this.sendEmergencyLocationUpdate();
      }
    }, 30000);
  }

  stopEmergencyTracking() {
    if (this.emergencyTimer) {
      clearInterval(this.emergencyTimer);
      this.emergencyTimer = null;
    }
  }

  async sendEmergencyLocationUpdate() {
    const currentPosition = window.gpsTracker?.getCurrentPosition();
    if (!currentPosition) return;

    try {
      await fetch('/api/emergency/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        },
        body: JSON.stringify({
          userId: this.emergencyData.userId,
          position: currentPosition,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Erreur mise à jour position urgence:', error);
    }
  }

  updateEmergencyLocation(position) {
    if (this.isEmergencyMode) {
      this.emergencyData.position = position;
    }
  }

  handleEmergencyVisibilityChange() {
    if (this.isEmergencyMode) {
      // Envoyer une alerte si l'utilisateur ferme l'application en mode urgence
      this.sendEmergencyVisibilityAlert();
    }
  }

  async sendEmergencyVisibilityAlert() {
    try {
      await fetch('/api/emergency/visibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        },
        body: JSON.stringify({
          userId: this.emergencyData.userId,
          action: 'app_hidden',
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Erreur alerte visibilité:', error);
    }
  }

  async handleLowBatteryEmergency() {
    if (this.isEmergencyMode) {
      await this.sendEmergencyAlert();
    }
  }

  async getBatteryLevel() {
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        return Math.round(battery.level * 100);
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  async sendEmergencyDeactivation() {
    try {
      await fetch('/api/emergency/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        },
        body: JSON.stringify({
          userId: this.emergencyData.userId,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Erreur désactivation urgence:', error);
    }
  }

  // Méthodes de notification
  notifyEmergencyActivated() {
    const event = new CustomEvent('emergencyActivated', {
      detail: { data: this.emergencyData }
    });
    document.dispatchEvent(event);
  }

  notifyEmergencyDeactivated() {
    const event = new CustomEvent('emergencyDeactivated');
    document.dispatchEvent(event);
  }

  // Méthodes utilitaires
  isInEmergencyMode() {
    return this.isEmergencyMode;
  }

  getEmergencyData() {
    return this.emergencyData;
  }
}

// Initialiser le système d'urgence
window.emergencySystem = new EmergencySystem();

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmergencySystem;
}
