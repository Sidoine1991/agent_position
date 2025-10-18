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

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      this.isConnected = true;
      console.log('🔗 Connexion WebSocket établie');
      this.notifyConnectionChange(true);
    };
    
    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleIncomingMessage(data);
    };
    
    this.socket.onclose = () => {
      this.isConnected = false;
      console.log('🔌 Connexion WebSocket fermée');
      this.notifyConnectionChange(false);
      
      // Reconnexion automatique après 5 secondes
      setTimeout(() => this.connectWebSocket(), 5000);
    };
    
    this.socket.onerror = (error) => {
      console.error('Erreur WebSocket:', error);
    };
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

  notifyConnectionChange(isConnected) {
    const event = new CustomEvent('messagingConnectionChange', {
      detail: { isConnected }
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
window.messagingSystem = new MessagingSystem();

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MessagingSystem;
}
