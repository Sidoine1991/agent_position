// Offline Manager - Gestion améliorée du mode hors ligne
class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.queuedActions = [];
    this.syncInProgress = false;
    this.init();
  }

  init() {
    // Écouter les changements de statut réseau
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Vérifier le statut au chargement
    this.updateOnlineStatus();
    
    // Démarrer la synchronisation périodique
    setInterval(() => this.syncIfOnline(), 30000); // Toutes les 30 secondes
  }

  handleOnline() {
    this.isOnline = true;
    this.updateOnlineStatus();
    this.showNotification('Connexion Restaurée', 'Vous êtes de nouveau en ligne. Synchronisation en cours...', 'success');
    
    // Synchroniser les actions en file
    this.syncQueuedActions();
  }

  handleOffline() {
    this.isOnline = false;
    this.updateOnlineStatus();
    this.showNotification('Mode Hors Ligne', 'Vous êtes hors ligne. Vos actions seront synchronisées dès la reconnexion.', 'warning');
  }

  updateOnlineStatus() {
    const statusElement = document.getElementById('online-status');
    if (statusElement) {
      if (this.isOnline) {
        statusElement.innerHTML = '🟢 En ligne';
        statusElement.className = 'online-status online';
      } else {
        statusElement.innerHTML = '🔴 Hors ligne';
        statusElement.className = 'online-status offline';
      }
    }

    // Mettre à jour l'interface
    this.updateUIForOfflineStatus();
  }

  updateUIForOfflineStatus() {
    // Masquer/afficher les éléments selon le statut
    const offlineElements = document.querySelectorAll('.offline-only');
    const onlineElements = document.querySelectorAll('.online-only');
    
    offlineElements.forEach(el => {
      el.style.display = this.isOnline ? 'none' : 'block';
    });
    
    onlineElements.forEach(el => {
      el.style.display = this.isOnline ? 'block' : 'none';
    });
  }

  // Ajouter une action à la file d'attente
  queueAction(action) {
    const actionWithId = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      ...action
    };
    
    this.queuedActions.push(actionWithId);
    this.saveQueuedActions();
    
    this.showNotification(
      'Action En File', 
      'Votre action sera synchronisée dès la reconnexion.', 
      'info'
    );
  }

  // Sauvegarder les actions en file
  saveQueuedActions() {
    try {
      localStorage.setItem('queuedActions', JSON.stringify(this.queuedActions));
    } catch (error) {
      console.error('Erreur sauvegarde file:', error);
    }
  }

  // Charger les actions en file
  loadQueuedActions() {
    try {
      const saved = localStorage.getItem('queuedActions');
      if (saved) {
        this.queuedActions = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Erreur chargement file:', error);
      this.queuedActions = [];
    }
  }

  // Synchroniser les actions en file
  async syncQueuedActions() {
    if (this.syncInProgress || !this.isOnline || this.queuedActions.length === 0) {
      return;
    }

    this.syncInProgress = true;
    this.showNotification('Synchronisation', 'Synchronisation des actions en file...', 'info');

    const actionsToSync = [...this.queuedActions];
    const successfulActions = [];
    const failedActions = [];

    for (const action of actionsToSync) {
      try {
        await this.executeAction(action);
        successfulActions.push(action);
      } catch (error) {
        console.error('Erreur sync action:', error);
        failedActions.push(action);
      }
    }

    // Mettre à jour la file
    this.queuedActions = failedActions;
    this.saveQueuedActions();

    if (successfulActions.length > 0) {
      this.showNotification(
        'Synchronisation Réussie', 
        `${successfulActions.length} action(s) synchronisée(s)`, 
        'success'
      );
    }

    this.syncInProgress = false;
  }

  // Exécuter une action
  async executeAction(action) {
    const { type, data, url, method = 'POST' } = action;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Vérifier et synchroniser si en ligne
  async syncIfOnline() {
    if (this.isOnline && this.queuedActions.length > 0) {
      await this.syncQueuedActions();
    }
  }

  // Obtenir le statut de connexion
  getConnectionStatus() {
    return {
      isOnline: this.isOnline,
      queuedActions: this.queuedActions.length,
      syncInProgress: this.syncInProgress
    };
  }

  // Afficher les notifications
  showNotification(title, message, type = 'info') {
    // Utiliser le système de notification GPS si disponible
    if (window.gpsManager && window.gpsManager.showNotification) {
      window.gpsManager.showNotification(title, message, type);
      return;
    }

    // Fallback vers le système de notification existant
    if (typeof showNotification === 'function') {
      showNotification(title, message);
    } else {
      console.log(`${title}: ${message}`);
    }
  }

  // Forcer la synchronisation
  async forceSync() {
    if (!this.isOnline) {
      this.showNotification('Erreur', 'Impossible de synchroniser hors ligne', 'error');
      return false;
    }

    await this.syncQueuedActions();
    return true;
  }
}

// Instance globale
window.offlineManager = new OfflineManager();

// Fonction pour ajouter une action à la file
function queueActionForSync(action) {
  if (window.offlineManager) {
    window.offlineManager.queueAction(action);
  }
}

// Fonction pour vérifier le statut
function getConnectionStatus() {
  if (window.offlineManager) {
    return window.offlineManager.getConnectionStatus();
  }
  return { isOnline: navigator.onLine, queuedActions: 0, syncInProgress: false };
}

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
  // Charger les actions en file
  if (window.offlineManager) {
    window.offlineManager.loadQueuedActions();
  }
});

console.log('✅ Offline Manager chargé');
