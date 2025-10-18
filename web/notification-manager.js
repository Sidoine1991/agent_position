/**
 * Gestionnaire de notifications push pour l'application CCRB
 */

class NotificationManager {
  constructor() {
    this.permission = Notification.permission;
    this.serviceWorker = null;
    this.init();
  }

  async init() {
    await this.registerServiceWorker();
    this.setupEventListeners();
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        this.serviceWorker = registration;
        console.log('Service Worker enregistré:', registration);
      } catch (error) {
        console.error('Erreur enregistrement Service Worker:', error);
      }
    }
  }

  async requestPermission() {
    if (this.permission === 'granted') return true;
    
    this.permission = await Notification.requestPermission();
    return this.permission === 'granted';
  }

  async sendNotification(title, options = {}) {
    if (!await this.requestPermission()) {
      console.warn('Notifications non autorisées');
      return;
    }

    const defaultOptions = {
      icon: '/Media/logo-ccrb.png',
      badge: '/Media/logo-ccrb.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      ...options
    };

    if (this.serviceWorker) {
      this.serviceWorker.showNotification(title, defaultOptions);
    } else {
      new Notification(title, defaultOptions);
    }
  }

  setupEventListeners() {
    // Écouter les messages du service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event.data);
      });
    }
  }

  handleServiceWorkerMessage(data) {
    switch (data.type) {
      case 'NOTIFICATION_CLICK':
        this.handleNotificationClick(data.payload);
        break;
      case 'SYNC_COMPLETE':
        this.showSyncNotification();
        break;
    }
  }

  handleNotificationClick(payload) {
    // Rediriger vers la page appropriée
    if (payload.url) {
      window.location.href = payload.url;
    }
  }

  // Notifications spécifiques
  async notifyNewMission(mission) {
    await this.sendNotification('🎯 Nouvelle Mission', {
      body: `Mission: ${mission.title || 'Nouvelle mission assignée'}`,
      tag: 'new-mission',
      data: { url: '/index.html?mission=' + mission.id }
    });
  }

  async notifyPresenceReminder() {
    await this.sendNotification('⏰ Rappel de Présence', {
      body: 'N\'oubliez pas de marquer votre présence',
      tag: 'presence-reminder',
      data: { url: '/index.html' }
    });
  }

  async notifySupervisorMessage(message) {
    await this.sendNotification('💬 Message du Superviseur', {
      body: message.content,
      tag: 'supervisor-message',
      data: { url: '/messages.html' }
    });
  }

  async notifyValidationResult(result) {
    const status = result.valid ? '✅' : '❌';
    await this.sendNotification(`${status} Validation de Présence`, {
      body: result.message,
      tag: 'validation-result'
    });
  }

  showSyncNotification() {
    this.sendNotification('🔄 Synchronisation Terminée', {
      body: 'Vos données ont été synchronisées avec succès',
      tag: 'sync-complete'
    });
  }
}

window.notificationManager = new NotificationManager();
