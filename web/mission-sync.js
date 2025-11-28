/**
 * Module de synchronisation des missions en attente
 * Gère le stockage et la synchronisation des missions (démarrage et fin) quand l'agent est hors ligne
 */

class MissionSync {
  constructor() {
    this.dbName = 'CCRB_Offline';
    this.dbVersion = 1;
    this.db = null;
  }

  async init() {
    if (!this.db) {
      await this.openDB();
    }
  }

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('pendingMissions')) {
          const store = db.createObjectStore('pendingMissions', { keyPath: 'id', autoIncrement: true });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Stocker une mission en attente (démarrage ou fin)
   * @param {string} type - 'start' ou 'end'
   * @param {object} data - Données de la mission
   */
  async storePendingMission(type, data) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingMissions'], 'readwrite');
      const store = transaction.objectStore('pendingMissions');
      
      const missionData = {
        type: type, // 'start' ou 'end'
        data: data,
        timestamp: new Date().toISOString(),
        synced: false,
        createdAt: Date.now()
      };
      
      const request = store.add(missionData);
      
      request.onsuccess = () => {
        console.log(`✅ Mission ${type} stockée en attente (ID: ${request.result})`);
        this.updateSyncButton();
        resolve(request.result);
      };
      
      request.onerror = () => {
        console.error(`❌ Erreur stockage mission ${type}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Récupérer toutes les missions en attente
   */
  async getPendingMissions() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingMissions'], 'readonly');
      const store = transaction.objectStore('pendingMissions');
      const index = store.index('synced');
      
      const request = index.getAll(false); // false = non synchronisées
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Marquer une mission comme synchronisée
   */
  async markAsSynced(missionId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingMissions'], 'readwrite');
      const store = transaction.objectStore('pendingMissions');
      
      const getRequest = store.get(missionId);
      
      getRequest.onsuccess = () => {
        const mission = getRequest.result;
        if (mission) {
          mission.synced = true;
          mission.syncedAt = new Date().toISOString();
          
          const updateRequest = store.put(mission);
          
          updateRequest.onsuccess = () => {
            resolve();
          };
          
          updateRequest.onerror = () => {
            reject(updateRequest.error);
          };
        } else {
          resolve();
        }
      };
      
      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  /**
   * Supprimer une mission synchronisée
   */
  async deleteSyncedMission(missionId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingMissions'], 'readwrite');
      const store = transaction.objectStore('pendingMissions');
      
      const request = store.delete(missionId);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Synchroniser toutes les missions en attente
   */
  async syncPendingMissions() {
    const token = localStorage.getItem('jwt');
    if (!token) {
      throw new Error('Token JWT manquant');
    }

    const pendingMissions = await this.getPendingMissions();
    
    if (pendingMissions.length === 0) {
      return { success: true, synced: 0, message: 'Aucune mission à synchroniser' };
    }

    console.log(`🔄 Synchronisation de ${pendingMissions.length} mission(s) en attente...`);

    const results = {
      success: true,
      synced: 0,
      failed: 0,
      errors: []
    };

    // Préparer les missions pour l'endpoint de synchronisation
    const missionsToSync = pendingMissions.map(mission => ({
      id: mission.id,
      type: mission.type,
      data: {
        ...mission.data,
        // Pour les missions de fin, s'assurer que mission_id est présent
        mission_id: mission.type === 'end' && !mission.data.mission_id
          ? (localStorage.getItem('activeMissionId') || localStorage.getItem('currentMissionId'))
          : mission.data.mission_id
      }
    }));

    try {
      const response = await fetch('/api/sync/pending-missions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ missions: missionsToSync })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Marquer toutes les missions synchronisées comme synced
        for (const syncedMission of result.syncedMissions || []) {
          const mission = pendingMissions.find(m => m.id === syncedMission.id);
          if (mission) {
            await this.markAsSynced(mission.id);
            await this.deleteSyncedMission(mission.id);
            
            // Si c'est un démarrage, sauvegarder l'ID de la mission
            if (mission.type === 'start' && syncedMission.missionId) {
              localStorage.setItem('activeMissionId', syncedMission.missionId);
              localStorage.setItem('currentMissionId', syncedMission.missionId);
              localStorage.removeItem('hasActiveMissionOffline');
            }
            
            // Si c'est une fin, nettoyer
            if (mission.type === 'end') {
              localStorage.removeItem('activeMissionId');
              localStorage.removeItem('currentMissionId');
              localStorage.removeItem('mission_in_progress');
              localStorage.removeItem('mission_start_at');
            }
          }
        }
        
        results.synced = result.synced || 0;
        results.failed = result.errors ? result.errors.length : 0;
        results.errors = result.errors || [];
        
        console.log(`✅ ${results.synced} mission(s) synchronisée(s)`);
      } else {
        throw new Error(result.message || result.error || 'Erreur inconnue');
      }
    } catch (error) {
      console.error(`❌ Erreur synchronisation missions:`, error);
      results.success = false;
      results.errors.push({ error: error.message });
    }

    // Mettre à jour le bouton de synchronisation
    this.updateSyncButton();

    return results;
  }

  /**
   * Mettre à jour l'affichage du bouton de synchronisation
   */
  async updateSyncButton() {
    const pendingMissions = await this.getPendingMissions();
    const syncButton = document.getElementById('sync-missions-btn');
    const syncBadge = document.getElementById('sync-missions-badge');
    const syncCard = document.getElementById('sync-missions-card');
    
    if (pendingMissions.length > 0) {
      // Afficher la carte et le bouton
      if (syncCard) {
        syncCard.style.display = 'block';
      }
      if (syncButton) {
        syncButton.disabled = false;
      }
      if (syncBadge) {
        syncBadge.textContent = pendingMissions.length;
        syncBadge.style.display = 'inline-block';
      }
    } else {
      // Masquer la carte et le bouton
      if (syncCard) {
        syncCard.style.display = 'none';
      }
      if (syncBadge) {
        syncBadge.style.display = 'none';
      }
    }
  }

  /**
   * Vérifier s'il y a des missions en attente
   */
  async hasPendingMissions() {
    const pending = await this.getPendingMissions();
    return pending.length > 0;
  }
}

// Instance globale
const missionSync = new MissionSync();

// Initialiser au chargement
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', async () => {
    await missionSync.init();
    await missionSync.updateSyncButton();
    
    // Vérifier périodiquement
    setInterval(async () => {
      await missionSync.updateSyncButton();
    }, 5000);
  });
}

// Exporter pour utilisation globale
if (typeof window !== 'undefined') {
  window.missionSync = missionSync;
}

