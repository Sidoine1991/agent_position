/**
 * Script de debug pour la messagerie
 * Aide à diagnostiquer les problèmes de notifications
 */

class MessagingDebugger {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.init();
  }

  init() {
    this.checkComponents();
    this.checkPermissions();
    this.checkAPIs();
    this.setupEventListeners();
  }

  checkComponents() {
    // Vérifier les composants de notification
    if (window.notificationBubble) {
      this.info.push('✅ NotificationBubble chargé');
    } else {
      this.errors.push('❌ NotificationBubble manquant');
    }

    if (window.notificationSounds) {
      this.info.push('✅ NotificationSounds chargé');
    } else {
      this.errors.push('❌ NotificationSounds manquant');
    }

    if (window.notificationManager) {
      this.info.push('✅ NotificationManager chargé');
    } else {
      this.errors.push('❌ NotificationManager manquant');
    }

    if (window.realtimeMessaging) {
      this.info.push('✅ RealtimeMessaging chargé');
    } else {
      this.warnings.push('⚠️ RealtimeMessaging manquant (optionnel)');
    }
  }

  checkPermissions() {
    // Vérifier les permissions
    if ('Notification' in window) {
      const permission = Notification.permission;
      switch (permission) {
        case 'granted':
          this.info.push('✅ Notifications desktop autorisées');
          break;
        case 'denied':
          this.errors.push('❌ Notifications desktop refusées');
          break;
        case 'default':
          this.warnings.push('⚠️ Permissions notifications non demandées');
          break;
      }
    } else {
      this.warnings.push('⚠️ Notifications desktop non supportées');
    }

    // Vérifier la vibration
    if ('vibrate' in navigator) {
      this.info.push('✅ Vibration supportée');
    } else {
      this.warnings.push('⚠️ Vibration non supportée');
    }

    // Vérifier l'audio
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
      this.info.push('✅ Audio supporté');
    } else {
      this.warnings.push('⚠️ Audio non supporté');
    }
  }

  async checkAPIs() {
    // Vérifier les endpoints API
    const endpoints = [
      '/api/users/online',
      '/api/forum/categories',
      '/api/messages'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('jwt')}`
          }
        });
        
        if (response.ok) {
          this.info.push(`✅ ${endpoint} accessible`);
        } else {
          this.errors.push(`❌ ${endpoint} erreur ${response.status}`);
        }
      } catch (error) {
        this.errors.push(`❌ ${endpoint} erreur: ${error.message}`);
      }
    }
  }

  setupEventListeners() {
    // Écouter les événements de notification
    document.addEventListener('newMessage', (event) => {
      this.info.push(`📨 Nouveau message reçu: ${event.detail?.message?.content?.substring(0, 50)}...`);
    });

    document.addEventListener('systemNotification', (event) => {
      this.info.push(`🔔 Notification système: ${event.detail?.message}`);
    });

    // Écouter les erreurs JavaScript
    window.addEventListener('error', (event) => {
      this.errors.push(`💥 Erreur JS: ${event.message} (${event.filename}:${event.lineno})`);
    });

    // Écouter les erreurs de promesses non capturées
    window.addEventListener('unhandledrejection', (event) => {
      this.errors.push(`💥 Promesse rejetée: ${event.reason}`);
    });
  }

  // Méthodes de test
  testNotification(type = 'message') {
    if (window.notificationManager) {
      window.notificationManager.testNotification(type);
      this.info.push(`🧪 Test notification ${type} déclenché`);
    } else {
      this.errors.push('❌ Impossible de tester - NotificationManager manquant');
    }
  }

  testSound() {
    if (window.notificationSounds) {
      window.notificationSounds.play('message');
      this.info.push('🔊 Test son déclenché');
    } else {
      this.errors.push('❌ Impossible de tester - NotificationSounds manquant');
    }
  }

  testVibration() {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
      this.info.push('📳 Test vibration déclenché');
    } else {
      this.warnings.push('⚠️ Vibration non supportée');
    }
  }

  // Générer un rapport
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      settings: this.getSettings()
    };

    return report;
  }

  getSettings() {
    if (window.notificationManager) {
      return window.notificationManager.getSettings();
    }
    return null;
  }

  // Afficher le rapport dans la console
  logReport() {
    console.group('🔍 Rapport de Debug Messagerie');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL:', window.location.href);
    
    if (this.errors.length > 0) {
      console.group('❌ Erreurs');
      this.errors.forEach(error => console.error(error));
      console.groupEnd();
    }
    
    if (this.warnings.length > 0) {
      console.group('⚠️ Avertissements');
      this.warnings.forEach(warning => console.warn(warning));
      console.groupEnd();
    }
    
    if (this.info.length > 0) {
      console.group('ℹ️ Informations');
      this.info.forEach(info => console.log(info));
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  // Exporter le rapport
  exportReport() {
    const report = this.generateReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `messaging-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Nettoyer les logs
  clear() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }
}

// Initialiser le debugger
let messagingDebugger;

document.addEventListener('DOMContentLoaded', () => {
  messagingDebugger = new MessagingDebugger();
  
  // Exposer globalement
  window.messagingDebugger = messagingDebugger;
  
  // Auto-log du rapport après 3 secondes
  setTimeout(() => {
    messagingDebugger.logReport();
  }, 3000);
});

// Fonctions utilitaires globales
window.debugMessaging = {
  testNotification: (type) => messagingDebugger?.testNotification(type),
  testSound: () => messagingDebugger?.testSound(),
  testVibration: () => messagingDebugger?.testVibration(),
  generateReport: () => messagingDebugger?.generateReport(),
  logReport: () => messagingDebugger?.logReport(),
  exportReport: () => messagingDebugger?.exportReport(),
  clear: () => messagingDebugger?.clear()
};

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MessagingDebugger;
}
