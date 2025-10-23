/**
 * Gestionnaire centralisé des notifications
 * Coordonne tous les types de notifications (bulles, sons, vibrations, etc.)
 */

class NotificationManager {
  constructor() {
    this.permissions = {
      notification: 'default',
      sound: true,
      vibration: true
    };
    
    this.settings = {
      enableBubbles: true,
      enableSounds: true,
      enableVibration: true,
      enableDesktop: true,
      bubbleDuration: 5000,
      soundVolume: 0.3,
      maxBubbles: 5
    };
    
    this.notificationCount = 0;
    this.unreadMessages = new Map();
    this.activeNotifications = new Map();
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.requestPermissions();
    this.setupEventListeners();
    this.updateBadgeCount();
  }

  async loadSettings() {
    try {
      const saved = localStorage.getItem('notificationSettings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Erreur chargement paramètres notifications:', error);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Erreur sauvegarde paramètres notifications:', error);
    }
  }

  async requestPermissions() {
    // Demander la permission pour les notifications desktop
    if ('Notification' in window) {
      this.permissions.notification = Notification.permission;
      
      if (this.permissions.notification === 'default') {
        this.permissions.notification = await Notification.requestPermission();
      }
    }
    
    // Vérifier le support de la vibration
    this.permissions.vibration = 'vibrate' in navigator;
    
    // Vérifier le support audio
    this.permissions.sound = typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';
  }

  setupEventListeners() {
    // Écouter les nouveaux messages
    document.addEventListener('newMessage', (event) => {
      this.handleNewMessage(event.detail.message);
    });
    
    // Écouter les changements de visibilité
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });
    
    // Écouter les événements de connexion
    document.addEventListener('messagingConnectionChange', (event) => {
      this.handleConnectionChange(event.detail);
    });
  }

  handleNewMessage(message) {
    if (!message) return;
    
    // Incrémenter le compteur
    this.notificationCount++;
    
    // Ajouter aux messages non lus
    const chatId = message.chat_id || message.conversation_id;
    if (chatId) {
      const current = this.unreadMessages.get(chatId) || 0;
      this.unreadMessages.set(chatId, current + 1);
    }
    
    // Mettre à jour le badge
    this.updateBadgeCount();
    
    // Afficher la notification selon les paramètres
    this.showNotification(message);
  }

  showNotification(message) {
    const notification = {
      id: message.id || Date.now(),
      type: message.urgent ? 'urgent' : 'message',
      title: this.getNotificationTitle(message),
      body: this.getNotificationBody(message),
      icon: this.getNotificationIcon(message),
      data: message
    };
    
    // Notification desktop
    if (this.settings.enableDesktop && this.permissions.notification === 'granted') {
      this.showDesktopNotification(notification);
    }
    
    // Bulle de notification
    if (this.settings.enableBubbles) {
      this.showBubbleNotification(notification);
    }
    
    // Son de notification
    if (this.settings.enableSounds && this.permissions.sound) {
      this.playNotificationSound(notification.type);
    }
    
    // Vibration
    if (this.settings.enableVibration && this.permissions.vibration) {
      this.vibrate(notification.type);
    }
  }

  showDesktopNotification(notification) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    
    const desktopNotification = new Notification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      tag: 'ccrb-message',
      requireInteraction: notification.type === 'urgent',
      data: notification.data
    });
    
    // Auto-fermer après 5 secondes (sauf si urgent)
    if (notification.type !== 'urgent') {
      setTimeout(() => {
        desktopNotification.close();
      }, 5000);
    }
    
    // Gérer le clic
    desktopNotification.onclick = () => {
      this.handleNotificationClick(notification);
      desktopNotification.close();
    };
  }

  showBubbleNotification(notification) {
    // Déclencher l'événement pour la bulle de notification
    document.dispatchEvent(new CustomEvent('showBubbleNotification', {
      detail: notification
    }));
  }

  playNotificationSound(type) {
    // Déclencher l'événement pour le son
    document.dispatchEvent(new CustomEvent('playNotificationSound', {
      detail: { type }
    }));
  }

  vibrate(type) {
    if (!this.permissions.vibration) return;
    
    const patterns = {
      message: [200],
      urgent: [200, 100, 200, 100, 200],
      system: [300]
    };
    
    const pattern = patterns[type] || patterns.message;
    navigator.vibrate(pattern);
  }

  getNotificationTitle(message) {
    const sender = message.sender?.name || 'Utilisateur';
    return `Nouveau message de ${sender}`;
  }

  getNotificationBody(message) {
    const content = message.content || '';
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }

  getNotificationIcon(message) {
    return message.sender?.avatar || '/Media/logo-ccrb.png';
  }

  handleNotificationClick(notification) {
    // Rediriger vers la page de messagerie
    const chatId = notification.data.chat_id || notification.data.conversation_id;
    if (chatId) {
      window.location.href = `/messages.html?chat=${chatId}`;
    } else {
      window.location.href = '/messages.html';
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      // Page cachée - activer toutes les notifications
      this.enableAllNotifications();
    } else {
      // Page visible - réduire les notifications
      this.disableDesktopNotifications();
    }
  }

  handleConnectionChange(connectionData) {
    if (connectionData.isConnected) {
      this.showSystemNotification('Connexion établie', 'Vous êtes maintenant connecté');
    } else {
      this.showSystemNotification('Connexion perdue', 'Tentative de reconnexion...');
    }
  }

  showSystemNotification(title, message, type = 'info') {
    const notification = {
      id: Date.now(),
      type: 'system',
      title,
      body: message,
      icon: '/Media/logo-ccrb.png',
      urgent: type === 'error'
    };
    
    this.showNotification(notification);
  }

  updateBadgeCount() {
    // Mettre à jour le badge dans la navigation
    const badge = document.querySelector('.notification-badge');
    if (badge) {
      badge.textContent = this.notificationCount > 99 ? '99+' : this.notificationCount;
      badge.style.display = this.notificationCount > 0 ? 'block' : 'none';
    }
    
    // Mettre à jour le titre de la page
    if (this.notificationCount > 0) {
      document.title = `(${this.notificationCount}) Messages - Presence CCRB`;
    } else {
      document.title = 'Messages - Presence CCRB';
    }
  }

  markAsRead(chatId) {
    if (chatId) {
      this.unreadMessages.delete(chatId);
    } else {
      this.unreadMessages.clear();
    }
    
    this.notificationCount = Array.from(this.unreadMessages.values()).reduce((sum, count) => sum + count, 0);
    this.updateBadgeCount();
  }

  clearAllNotifications() {
    this.notificationCount = 0;
    this.unreadMessages.clear();
    this.activeNotifications.clear();
    this.updateBadgeCount();
    
    // Fermer toutes les notifications desktop
    if ('Notification' in window) {
      // Note: Il n'y a pas de méthode pour fermer toutes les notifications
      // Elles se fermeront automatiquement
    }
  }

  // Méthodes de configuration
  setSetting(key, value) {
    this.settings[key] = value;
    this.saveSettings();
  }

  getSetting(key) {
    return this.settings[key];
  }

  enableAllNotifications() {
    this.settings.enableDesktop = true;
    this.settings.enableBubbles = true;
    this.settings.enableSounds = true;
    this.saveSettings();
  }

  disableDesktopNotifications() {
    this.settings.enableDesktop = false;
    this.saveSettings();
  }

  toggleSound() {
    this.settings.enableSounds = !this.settings.enableSounds;
    this.saveSettings();
    return this.settings.enableSounds;
  }

  toggleVibration() {
    this.settings.enableVibration = !this.settings.enableVibration;
    this.saveSettings();
    return this.settings.enableVibration;
  }

  toggleBubbles() {
    this.settings.enableBubbles = !this.settings.enableBubbles;
    this.saveSettings();
    return this.settings.enableBubbles;
  }

  // Méthodes utilitaires
  getUnreadCount(chatId = null) {
    if (chatId) {
      return this.unreadMessages.get(chatId) || 0;
    }
    return this.notificationCount;
  }

  getPermissions() {
    return { ...this.permissions };
  }

  getSettings() {
    return { ...this.settings };
  }

  // Méthode pour tester les notifications
  testNotification(type = 'message') {
    const testMessage = {
      id: Date.now(),
      content: 'Ceci est un message de test',
      sender: { name: 'Test User' },
      chat_id: 'test',
      urgent: type === 'urgent'
    };
    
    this.handleNewMessage(testMessage);
  }
}

// Initialiser le gestionnaire de notifications
let notificationManager;

document.addEventListener('DOMContentLoaded', () => {
  notificationManager = new NotificationManager();
  
  // Exposer globalement
  window.notificationManager = notificationManager;
});

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationManager;
}
