/**
 * Système de messagerie interne pour l'application CCRB
 */

class MessagingSystem {
  constructor() {
    this.messages = [];
    this.contacts = [];
    this.currentChat = null;
    this.isConnected = false;
    this.socket = null;
    this.unreadCount = 0;
    
    this.init();
  }

  async init() {
    await this.loadContacts();
    await this.loadMessages();
    this.setupEventListeners();
    this.connectWebSocket();
  }

  async loadContacts() {
    try {
      const response = await fetch('/api/contacts');
      if (response.ok) {
        this.contacts = await response.json();
      }
    } catch (error) {
      console.warn('Impossible de charger les contacts:', error);
    }
  }

  async loadMessages() {
    try {
      const response = await fetch('/api/messages');
      if (response.ok) {
        this.messages = await response.json();
        this.updateUnreadCount();
      }
    } catch (error) {
      console.warn('Impossible de charger les messages:', error);
    }
  }

  /**
   * Établit une connexion WebSocket sécurisée avec authentification JWT
   * Gère les reconnexions automatiques avec délai exponentiel
   */
  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = this.getJwtToken(); // Récupérer le token JWT
    
    if (!token) {
      console.error('❌ Aucun token JWT trouvé pour la connexion WebSocket');
      this.scheduleReconnection();
      return;
    }
    
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
    
    try {
      this.socket = new WebSocket(wsUrl);
      this.reconnectAttempts = this.reconnectAttempts || 0;
      this.maxReconnectAttempts = 10;
      this.reconnectDelay = 1000; // 1 seconde de délai initial
      
      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0; // Réinitialiser le compteur de reconnexions
        console.log('🔗 Connexion WebSocket établie');
        this.notifyConnectionChange(true);
      };
      
      this.socket.onclose = (event) => {
        this.isConnected = false;
        console.log(`🔌 Connexion WebSocket fermée (code: ${event.code}, raison: ${event.reason || 'inconnue'})`);
        this.notifyConnectionChange(false);
        
        // Ne pas essayer de se reconnecter en cas d'erreur d'authentification
        if (event.code === 4001 || event.code === 4002 || event.code === 4003) {
          console.error('Erreur d\'authentification WebSocket, reconnexion désactivée');
          this.notifyConnectionChange('auth_error');
          return;
        }
        
        this.scheduleReconnection();
      };
      
      this.socket.onerror = (error) => {
        console.error('Erreur WebSocket:', error);
        this.notifyConnectionChange('error');
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (error) {
          console.error('Erreur de traitement du message WebSocket:', error);
        }
      };
      
    } catch (error) {
      console.error('Erreur lors de la création de la connexion WebSocket:', error);
      this.notifyConnectionChange('error');
      this.scheduleReconnection();
    }
  }
  
  /**
   * Planifie une tentative de reconnexion avec délai exponentiel
   */
  scheduleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 secondes
      console.log(`⏳ Tentative de reconnexion dans ${delay/1000} secondes...`);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connectWebSocket();
      }, delay);
    } else {
      console.error('❌ Nombre maximum de tentatives de reconnexion atteint');
      this.notifyConnectionChange('failed');
    }
  }
  
  /**
   * Récupère le token JWT depuis le stockage local
   * @returns {string|null} Le token JWT ou null si non trouvé
   */
  getJwtToken() {
    // Essayer de récupérer le token depuis localStorage
    return localStorage.getItem('jwt_token') || 
           localStorage.getItem('token') || 
           (window.userSession && window.userSession.token) ||
           null;
  }

  handleIncomingMessage(data) {
    switch (data.type) {
      case 'MESSAGE':
        this.addMessage(data.message);
        break;
      case 'MESSAGE_READ':
        this.markMessageAsRead(data.messageId);
        break;
      case 'TYPING':
        this.handleTypingIndicator(data);
        break;
    }
  }

  addMessage(message) {
    this.messages.push(message);
    this.updateUnreadCount();
    this.notifyNewMessage(message);
    
    // Sauvegarder en local
    this.saveMessageLocally(message);
  }

  async sendMessage(recipientId, content, type = 'text') {
    const message = {
      id: Date.now(),
      senderId: this.getCurrentUserId(),
      recipientId,
      content,
      type,
      timestamp: new Date().toISOString(),
      status: 'sending'
    };
    
    // Ajouter immédiatement à l'interface
    this.addMessage(message);
    
    try {
      if (this.isConnected && this.socket) {
        this.socket.send(JSON.stringify({
          type: 'SEND_MESSAGE',
          message
        }));
      } else {
        // Sauvegarder pour envoi ultérieur
        await this.queueMessageForSending(message);
      }
      
      message.status = 'sent';
    } catch (error) {
      console.error('Erreur envoi message:', error);
      message.status = 'failed';
    }
    
    this.notifyMessageStatusChange(message);
  }

  async sendVoiceMessage(recipientId, audioBlob) {
    const audioUrl = URL.createObjectURL(audioBlob);
    const message = {
      id: Date.now(),
      senderId: this.getCurrentUserId(),
      recipientId,
      content: audioUrl,
      type: 'voice',
      timestamp: new Date().toISOString(),
      status: 'sending'
    };
    
    this.addMessage(message);
    
    try {
      // Upload du fichier audio
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('message', JSON.stringify(message));
      
      const response = await fetch('/api/messages/voice', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        message.status = 'sent';
      } else {
        message.status = 'failed';
      }
    } catch (error) {
      console.error('Erreur envoi message vocal:', error);
      message.status = 'failed';
    }
    
    this.notifyMessageStatusChange(message);
  }

  async sendPhoto(recipientId, photoBlob, caption = '') {
    const photoUrl = URL.createObjectURL(photoBlob);
    const message = {
      id: Date.now(),
      senderId: this.getCurrentUserId(),
      recipientId,
      content: photoUrl,
      caption,
      type: 'photo',
      timestamp: new Date().toISOString(),
      status: 'sending'
    };
    
    this.addMessage(message);
    
    try {
      const formData = new FormData();
      formData.append('photo', photoBlob);
      formData.append('message', JSON.stringify(message));
      
      const response = await fetch('/api/messages/photo', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        message.status = 'sent';
      } else {
        message.status = 'failed';
      }
    } catch (error) {
      console.error('Erreur envoi photo:', error);
      message.status = 'failed';
    }
    
    this.notifyMessageStatusChange(message);
  }

  markMessageAsRead(messageId) {
    const message = this.messages.find(m => m.id === messageId);
    if (message) {
      message.read = true;
      this.updateUnreadCount();
      this.notifyMessageRead(message);
    }
  }

  markChatAsRead(contactId) {
    this.messages
      .filter(m => m.senderId === contactId && !m.read)
      .forEach(m => {
        m.read = true;
        this.sendReadReceipt(m.id);
      });
    
    this.updateUnreadCount();
  }

  sendReadReceipt(messageId) {
    if (this.isConnected && this.socket) {
      this.socket.send(JSON.stringify({
        type: 'MESSAGE_READ',
        messageId
      }));
    }
  }

  sendTypingIndicator(recipientId, isTyping) {
    if (this.isConnected && this.socket) {
      this.socket.send(JSON.stringify({
        type: 'TYPING',
        recipientId,
        isTyping
      }));
    }
  }

  updateUnreadCount() {
    this.unreadCount = this.messages.filter(m => 
      m.recipientId === this.getCurrentUserId() && !m.read
    ).length;
    
    this.notifyUnreadCountChange();
  }

  getMessagesWithContact(contactId) {
    return this.messages.filter(m => 
      (m.senderId === contactId && m.recipientId === this.getCurrentUserId()) ||
      (m.senderId === this.getCurrentUserId() && m.recipientId === contactId)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  getContactById(contactId) {
    return this.contacts.find(c => c.id === contactId);
  }

  getCurrentUserId() {
    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    return userProfile.id;
  }

  // Méthodes de notification
  notifyNewMessage(message) {
    const event = new CustomEvent('newMessage', {
      detail: { message }
    });
    document.dispatchEvent(event);
  }

  notifyMessageStatusChange(message) {
    const event = new CustomEvent('messageStatusChange', {
      detail: { message }
    });
    document.dispatchEvent(event);
  }

  notifyMessageRead(message) {
    const event = new CustomEvent('messageRead', {
      detail: { message }
    });
    document.dispatchEvent(event);
  }

  notifyUnreadCountChange() {
    const event = new CustomEvent('unreadCountChange', {
      detail: { count: this.unreadCount }
    });
    document.dispatchEvent(event);
  }

  // Méthodes utilitaires
  async saveMessageLocally(message) {
    try {
      const messages = JSON.parse(localStorage.getItem('localMessages') || '[]');
      messages.push(message);
      localStorage.setItem('localMessages', JSON.stringify(messages));
    } catch (error) {
      console.error('Erreur sauvegarde locale:', error);
    }
  }

  async queueMessageForSending(message) {
    try {
      const queue = JSON.parse(localStorage.getItem('messageQueue') || '[]');
      queue.push(message);
      localStorage.setItem('messageQueue', JSON.stringify(queue));
    } catch (error) {
      console.error('Erreur queue message:', error);
    }
  }

  setupEventListeners() {
    // Écouter les changements de connexion
    document.addEventListener('messagingConnectionChange', (event) => {
      if (event.detail.isConnected) {
        this.processQueuedMessages();
      }
    });
  }

  async processQueuedMessages() {
    try {
      const queue = JSON.parse(localStorage.getItem('messageQueue') || '[]');
      
      for (const message of queue) {
        await this.sendMessage(message.recipientId, message.content, message.type);
      }
      
      localStorage.removeItem('messageQueue');
    } catch (error) {
      console.error('Erreur traitement queue:', error);
    }
  }
}

// Initialiser le système de messagerie
const messagingSystem = new MessagingSystem();

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MessagingSystem;
} else {
  window.messagingSystem = messagingSystem;
}
