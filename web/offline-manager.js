/**
 * Gestionnaire de mode hors-ligne pour l'application CCRB
 * Gère le cache local, la synchronisation et les actions en attente
 */

class OfflineManager {
  constructor() {
    this.dbName = 'CCRB_Offline';
    this.dbVersion = 1;
    this.db = null;
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.syncInProgress = false;
    
    this.init();
  }

  async init() {
    await this.initDB();
    this.setupEventListeners();
    this.startPeriodicSync();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Store pour les données de présence
        if (!db.objectStoreNames.contains('presence')) {
          const presenceStore = db.createObjectStore('presence', { keyPath: 'id', autoIncrement: true });
          presenceStore.createIndex('timestamp', 'timestamp', { unique: false });
          presenceStore.createIndex('user_id', 'user_id', { unique: false });
          presenceStore.createIndex('synced', 'synced', { unique: false });
        }
        
        // Store pour les missions
        if (!db.objectStoreNames.contains('missions')) {
          const missionsStore = db.createObjectStore('missions', { keyPath: 'id', autoIncrement: true });
          missionsStore.createIndex('user_id', 'user_id', { unique: false });
          missionsStore.createIndex('synced', 'synced', { unique: false });
        }
        
        // Store pour les check-ins
        if (!db.objectStoreNames.contains('checkins')) {
          const checkinsStore = db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true });
          checkinsStore.createIndex('timestamp', 'timestamp', { unique: false });
          checkinsStore.createIndex('user_id', 'user_id', { unique: false });
          checkinsStore.createIndex('synced', 'synced', { unique: false });
        }
        
        // Store pour les actions en attente
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  setupEventListeners() {
    // Écouter les changements de statut de connexion
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateConnectionStatus();
      this.syncPendingData();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateConnectionStatus();
    });
    
    // Écouter les erreurs de réseau
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && event.reason.name === 'NetworkError') {
        this.handleNetworkError(event.reason);
      }
    });
  }

  updateConnectionStatus() {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      if (this.isOnline) {
        statusElement.innerHTML = '<span class="text-success">🟢 En ligne</span>';
        statusElement.className = 'connection-status online';
      } else {
        statusElement.innerHTML = '<span class="text-warning">🟡 Hors-ligne</span>';
        statusElement.className = 'connection-status offline';
      }
    }
  }

  async saveOfflineData(storeName, data) {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const request = store.add({
        ...data,
        synced: false,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getOfflineData(storeName, filters = {}) {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        let data = request.result;
        
        // Appliquer les filtres
        if (filters.user_id) {
          data = data.filter(item => item.user_id === filters.user_id);
        }
        if (filters.synced !== undefined) {
          data = data.filter(item => item.synced === filters.synced);
        }
        
        resolve(data);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async queueSyncAction(action) {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      const request = store.add({
        ...action,
        timestamp: Date.now(),
        attempts: 0
      });
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async syncPendingData() {
    if (this.syncInProgress || !this.isOnline) return;
    
    this.syncInProgress = true;
    console.log('🔄 Début de la synchronisation...');
    
    try {
      // Synchroniser les données hors-ligne
      await this.syncOfflineData();
      
      // Traiter la queue de synchronisation
      await this.processSyncQueue();
      
      console.log('✅ Synchronisation terminée');
    } catch (error) {
      console.error('❌ Erreur de synchronisation:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncOfflineData() {
    const stores = ['presence', 'missions', 'checkins'];
    
    for (const storeName of stores) {
      const unsyncedData = await this.getOfflineData(storeName, { synced: false });
      
      for (const item of unsyncedData) {
        try {
          await this.syncItem(storeName, item);
          await this.markAsSynced(storeName, item.id);
        } catch (error) {
          console.error(`Erreur sync ${storeName}:`, error);
        }
      }
    }
  }

  async syncItem(storeName, item) {
    const apiEndpoint = this.getApiEndpoint(storeName);
    const method = item.id ? 'PUT' : 'POST';
    
    const response = await fetch(apiEndpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jwt')}`
      },
      body: JSON.stringify(item)
    });
    
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    return response.json();
  }

  getApiEndpoint(storeName) {
    const endpoints = {
      'presence': '/api/presence',
      'missions': '/api/missions',
      'checkins': '/api/checkins'
    };
    return endpoints[storeName] || '/api/data';
  }

  async markAsSynced(storeName, id) {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      
      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.synced = true;
          store.put(item);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async processSyncQueue() {
    const queueItems = await this.getOfflineData('syncQueue');
    
    for (const item of queueItems) {
      try {
        await this.executeSyncAction(item);
        await this.removeSyncQueueItem(item.id);
      } catch (error) {
        console.error('Erreur traitement queue:', error);
        await this.incrementSyncAttempts(item.id);
      }
    }
  }

  async executeSyncAction(action) {
    const response = await fetch(action.url, {
      method: action.method,
      headers: action.headers,
      body: action.body
    });
    
    if (!response.ok) {
      throw new Error(`Erreur sync action: ${response.status}`);
    }
    
    return response.json();
  }

  async removeSyncQueueItem(id) {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async incrementSyncAttempts(id) {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.get(id);
      
      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.attempts = (item.attempts || 0) + 1;
          if (item.attempts < 5) { // Max 5 tentatives
            store.put(item);
          } else {
            store.delete(id); // Supprimer après 5 échecs
          }
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  startPeriodicSync() {
    // Synchroniser toutes les 30 secondes si en ligne
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncPendingData();
      }
    }, 30000);
  }

  handleNetworkError(error) {
    console.warn('Erreur réseau détectée, passage en mode hors-ligne');
    this.isOnline = false;
    this.updateConnectionStatus();
  }

  // Méthodes utilitaires pour l'application
  async savePresenceOffline(presenceData) {
    return this.saveOfflineData('presence', presenceData);
  }

  async saveMissionOffline(missionData) {
    return this.saveOfflineData('missions', missionData);
  }

  async saveCheckinOffline(checkinData) {
    return this.saveOfflineData('checkins', checkinData);
  }

  async getOfflinePresence(userId) {
    return this.getOfflineData('presence', { user_id: userId });
  }

  async getOfflineMissions(userId) {
    return this.getOfflineData('missions', { user_id: userId });
  }

  async getOfflineCheckins(userId) {
    return this.getOfflineData('checkins', { user_id: userId });
  }
}

// Initialiser le gestionnaire hors-ligne
window.offlineManager = new OfflineManager();

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfflineManager;
}