/**
 * Système de messagerie en temps réel avec WebSocket
 * Gère les connexions, la synchronisation et les notifications
 */

class RealtimeMessaging {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.messageQueue = [];
    this.subscribers = new Map();
    
    this.init();
  }

  init() {
    this.connect();
    this.setupHeartbeat();
  }

  connect() {
    try {
      // Utiliser WebSocket ou fallback vers Server-Sent Events
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/messaging`;
      
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        console.log('🔌 Connexion WebSocket établie');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.processMessageQueue();
        this.notifySubscribers('connection', { status: 'connected' });
      };
      
      this.socket.onmessage = (event) => {
        this.handleMessage(event);
      };
      
      this.socket.onclose = () => {
        console.log('🔌 Connexion WebSocket fermée');
        this.isConnected = false;
        this.notifySubscribers('connection', { status: 'disconnected' });
        this.scheduleReconnect();
      };
      
      this.socket.onerror = (error) => {
        console.error('❌ Erreur WebSocket:', error);
        this.notifySubscribers('error', { error });
      };
      
    } catch (error) {
      console.error('❌ Impossible de créer la connexion WebSocket:', error);
      this.fallbackToPolling();
    }
  }

  fallbackToPolling() {
    console.log('🔄 Fallback vers polling pour les messages');
    this.startPolling();
  }

  startPolling() {
    // Polling toutes les 3 secondes si WebSocket n'est pas disponible
    setInterval(async () => {
      if (!this.isConnected) {
        await this.checkForNewMessages();
      }
    }, 3000);
  }

  async checkForNewMessages() {
    try {
      const response = await fetch('/api/messages/realtime', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach(message => {
            this.handleRealtimeMessage(message);
          });
        }
      }
    } catch (error) {
      console.error('Erreur polling messages:', error);
    }
  }

  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'message':
          this.handleRealtimeMessage(data.payload);
          break;
        case 'typing':
          this.handleTypingIndicator(data.payload);
          break;
        case 'presence':
          this.handlePresenceUpdate(data.payload);
          break;
        case 'heartbeat':
          this.handleHeartbeat();
          break;
        default:
          console.log('Type de message non reconnu:', data.type);
      }
    } catch (error) {
      console.error('Erreur traitement message WebSocket:', error);
    }
  }

  handleRealtimeMessage(message) {
    // Vérifier si le message est nouveau
    const messageId = message.id || message.message_id;
    if (this.isMessageProcessed(messageId)) {
      return;
    }
    
    // Marquer comme traité
    this.markMessageAsProcessed(messageId);
    
    // Notifier les abonnés
    this.notifySubscribers('newMessage', message);
    
    // Déclencher l'événement global
    document.dispatchEvent(new CustomEvent('newMessage', {
      detail: { message }
    }));
  }

  handleTypingIndicator(data) {
    this.notifySubscribers('typing', data);
  }

  handlePresenceUpdate(data) {
    this.notifySubscribers('presence', data);
  }

  handleHeartbeat() {
    // Réinitialiser le timer de heartbeat
    this.resetHeartbeat();
  }

  setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.socket) {
        this.send({
          type: 'ping',
          timestamp: Date.now()
        });
      }
    }, 30000); // Ping toutes les 30 secondes
  }

  resetHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.setupHeartbeat();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${delay}ms`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.log('❌ Nombre maximum de tentatives de reconnexion atteint');
      this.fallbackToPolling();
    }
  }

  send(data) {
    if (this.isConnected && this.socket) {
      try {
        this.socket.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('Erreur envoi message WebSocket:', error);
        this.queueMessage(data);
        return false;
      }
    } else {
      this.queueMessage(data);
      return false;
    }
  }

  queueMessage(data) {
    this.messageQueue.push({
      ...data,
      timestamp: Date.now()
    });
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event).push(callback);
    
    // Retourner une fonction de désabonnement
    return () => {
      const callbacks = this.subscribers.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  notifySubscribers(event, data) {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Erreur callback:', error);
        }
      });
    }
  }

  isMessageProcessed(messageId) {
    const processed = JSON.parse(sessionStorage.getItem('processedMessages') || '[]');
    return processed.includes(messageId);
  }

  markMessageAsProcessed(messageId) {
    const processed = JSON.parse(sessionStorage.getItem('processedMessages') || '[]');
    processed.push(messageId);
    
    // Garder seulement les 100 derniers messages
    if (processed.length > 100) {
      processed.splice(0, processed.length - 100);
    }
    
    sessionStorage.setItem('processedMessages', JSON.stringify(processed));
  }

  // Méthodes publiques
  sendMessage(content, recipientId, type = 'text') {
    return this.send({
      type: 'message',
      payload: {
        content,
        recipient_id: recipientId,
        message_type: type,
        timestamp: Date.now()
      }
    });
  }

  sendTypingIndicator(chatId, isTyping = true) {
    return this.send({
      type: 'typing',
      payload: {
        chat_id: chatId,
        is_typing: isTyping,
        timestamp: Date.now()
      }
    });
  }

  updatePresence(status) {
    return this.send({
      type: 'presence',
      payload: {
        status,
        timestamp: Date.now()
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.isConnected = false;
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length
    };
  }
}

// Initialiser le système de messagerie temps réel
let realtimeMessaging;

document.addEventListener('DOMContentLoaded', () => {
  realtimeMessaging = new RealtimeMessaging();
  
  // Exposer globalement
  window.realtimeMessaging = realtimeMessaging;
});

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RealtimeMessaging;
}
