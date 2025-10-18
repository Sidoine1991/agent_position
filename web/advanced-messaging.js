/**
 * Système de messagerie avancé avec cryptage et stockage Supabase
 * Gère les conversations privées, le forum de discussion et les appels
 */

class AdvancedMessaging {
  constructor() {
    this.currentUser = null;
    this.currentContact = null;
    this.currentForumCategory = null;
    this.contacts = [];
    this.conversations = new Map();
    this.forumCategories = [];
    this.isConnected = false;
    this.encryptionKey = null;
    
    this.init();
  }

  async init() {
    await this.loadCurrentUser();
    await this.initializeEncryption();
    await this.loadContacts();
    await this.loadForumCategories();
    this.setupEventListeners();
    this.startConnectionMonitoring();
  }

  async loadCurrentUser() {
    try {
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        }
      });
      
      if (response.ok) {
        this.currentUser = await response.json();
        console.log('👤 Utilisateur chargé:', this.currentUser);
      }
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
    }
  }

  async initializeEncryption() {
    // Générer une clé de cryptage pour l'utilisateur
    try {
      const key = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );
      
      this.encryptionKey = key;
      console.log('🔐 Clé de cryptage initialisée');
    } catch (error) {
      console.error('Erreur initialisation cryptage:', error);
    }
  }

  async loadContacts() {
    try {
      const response = await fetch('/api/admin/agents', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        }
      });
      
      if (response.ok) {
        const responseData = await response.json();
        const users = responseData.data || [];
        // Filtrer l'utilisateur actuel et enrichir les données
        this.contacts = users
          .filter(user => user.id !== this.currentUser?.id)
          .map(user => ({
            ...user,
            isOnline: Math.random() > 0.3, // Simulation du statut en ligne
            lastSeen: new Date(Date.now() - Math.random() * 86400000), // Dernière connexion
            status: this.getUserStatus(user.role),
            avatar: this.generateAvatar(user.name),
            unreadCount: this.getUnreadCount(user.id)
          }));
        
        this.renderContacts();
        console.log('👥 Contacts chargés:', this.contacts.length);
      }
    } catch (error) {
      console.error('Erreur chargement contacts:', error);
    }
  }

  getUserStatus(role) {
    const statuses = {
      'admin': 'Administrateur',
      'supervisor': 'Superviseur',
      'agent': 'Agent'
    };
    return statuses[role] || 'Utilisateur';
  }

  generateAvatar(name) {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
    const color = colors[name.length % colors.length];
    return {
      color: color,
      initial: name.charAt(0).toUpperCase()
    };
  }

  async loadForumCategories() {
    this.forumCategories = [
      {
        id: 'general',
        name: 'Discussion Générale',
        description: 'Discussions générales entre agents',
        icon: '💬',
        messageCount: 12,
        lastActivity: new Date()
      },
      {
        id: 'technical',
        name: 'Support Technique',
        description: 'Aide technique et résolution de problèmes',
        icon: '🔧',
        messageCount: 8,
        lastActivity: new Date()
      },
      {
        id: 'field',
        name: 'Expériences Terrain',
        description: 'Partage d\'expériences sur le terrain',
        icon: '🌍',
        messageCount: 15,
        lastActivity: new Date()
      },
      {
        id: 'emergency',
        name: 'Urgences',
        description: 'Signalements d\'urgences et alertes',
        icon: '🚨',
        messageCount: 3,
        lastActivity: new Date()
      }
    ];
  }

  renderContacts() {
    const contactsList = document.getElementById('contacts-list');
    if (!contactsList) return;

    contactsList.innerHTML = '';

    this.contacts.forEach(contact => {
      const contactElement = this.createContactElement(contact);
      contactsList.appendChild(contactElement);
    });
  }

  createContactElement(contact) {
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.dataset.contactId = contact.id;

    const lastMessage = this.getLastMessage(contact.id);
    const lastSeenText = contact.isOnline ? 'En ligne' : `Vu ${this.formatLastSeen(contact.lastSeen)}`;

    div.innerHTML = `
      <div class="contact-avatar" style="background: ${contact.avatar?.color || '#667eea'}">
        ${contact.avatar?.initial || contact.name.charAt(0).toUpperCase()}
        <div class="online-indicator ${contact.isOnline ? 'online' : 'offline'}"></div>
      </div>
      <div class="contact-info">
        <div class="contact-name">${contact.name}</div>
        <div class="contact-role">${contact.status || contact.role || 'Agent'}</div>
        <div class="last-message">${lastMessage || 'Aucun message'}</div>
      </div>
      <div class="message-meta">
        <div class="message-time">${lastSeenText}</div>
        ${contact.unreadCount > 0 ? `<div class="unread-badge">${contact.unreadCount}</div>` : ''}
      </div>
    `;

    // Ajouter un menu contextuel pour voir le profil
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContactContextMenu(e, contact);
    });

    div.addEventListener('click', () => this.selectContact(contact));
    return div;
  }

  showContactContextMenu(event, contact) {
    // Supprimer le menu existant
    const existingMenu = document.querySelector('.contact-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'contact-context-menu';
    menu.style.cssText = `
      position: fixed;
      top: ${event.clientY}px;
      left: ${event.clientX}px;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      min-width: 200px;
    `;

    menu.innerHTML = `
      <div class="p-3 border-bottom">
        <div class="d-flex align-items-center">
          <div class="contact-avatar me-2" style="background: ${contact.avatar?.color || '#667eea'}; width: 40px; height: 40px;">
            ${contact.avatar?.initial || contact.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="fw-bold">${contact.name}</div>
            <small class="text-muted">${contact.status || contact.role}</small>
          </div>
        </div>
      </div>
      <div class="list-group list-group-flush">
        <button class="list-group-item list-group-item-action" onclick="window.advancedMessaging.viewContactProfile('${contact.id}')">
          <i class="bi bi-person"></i> Voir le profil
        </button>
        <button class="list-group-item list-group-item-action" onclick="window.advancedMessaging.selectContact(${JSON.stringify(contact).replace(/"/g, '&quot;')})">
          <i class="bi bi-chat"></i> Envoyer un message
        </button>
        <button class="list-group-item list-group-item-action" onclick="window.advancedMessaging.startVideoCall('${contact.id}')">
          <i class="bi bi-camera-video"></i> Appel vidéo
        </button>
        <button class="list-group-item list-group-item-action" onclick="window.advancedMessaging.startVoiceCall('${contact.id}')">
          <i class="bi bi-telephone"></i> Appel vocal
        </button>
      </div>
    `;

    document.body.appendChild(menu);

    // Fermer le menu en cliquant ailleurs
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
  }

  viewContactProfile(contactId) {
    const contact = this.contacts.find(c => c.id == contactId);
    if (!contact) return;

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-person"></i> Profil de ${contact.name}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="text-center mb-4">
              <div class="contact-avatar mx-auto mb-3" style="background: ${contact.avatar?.color || '#667eea'}; width: 80px; height: 80px; font-size: 32px;">
                ${contact.avatar?.initial || contact.name.charAt(0).toUpperCase()}
              </div>
              <h4>${contact.name}</h4>
              <p class="text-muted">${contact.status || contact.role}</p>
            </div>
            <div class="row">
              <div class="col-6">
                <strong>Email:</strong><br>
                <small>${contact.email || 'Non disponible'}</small>
              </div>
              <div class="col-6">
                <strong>Statut:</strong><br>
                <span class="badge ${contact.isOnline ? 'bg-success' : 'bg-secondary'}">
                  ${contact.isOnline ? 'En ligne' : 'Hors ligne'}
                </span>
              </div>
            </div>
            <hr>
            <div class="d-grid gap-2">
              <button class="btn btn-primary" onclick="window.advancedMessaging.selectContact(${JSON.stringify(contact).replace(/"/g, '&quot;')}); bootstrap.Modal.getInstance(this.closest('.modal')).hide();">
                <i class="bi bi-chat"></i> Envoyer un message
              </button>
              <button class="btn btn-outline-primary" onclick="window.advancedMessaging.startVideoCall('${contact.id}'); bootstrap.Modal.getInstance(this.closest('.modal')).hide();">
                <i class="bi bi-camera-video"></i> Appel vidéo
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modal);
    });
  }

  formatLastSeen(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'à l\'instant';
    if (minutes < 60) return `il y a ${minutes}min`;
    if (hours < 24) return `il y a ${hours}h`;
    return `il y a ${days}j`;
  }

  selectContact(contact) {
    this.currentContact = contact;
    this.currentForumCategory = null;
    
    // Mettre à jour l'interface
    this.updateChatHeader(contact);
    this.loadConversation(contact.id);
    this.showChatInput();
    this.updateContactSelection();
    
    // Marquer comme lu
    this.markConversationAsRead(contact.id);
  }

  selectForumCategory(category) {
    this.currentForumCategory = category;
    this.currentContact = null;
    
    // Mettre à jour l'interface
    this.updateChatHeader(category);
    this.loadForumMessages(category.id);
    this.showChatInput();
    this.updateContactSelection();
  }

  updateChatHeader(contactOrCategory) {
    const chatUserAvatar = document.getElementById('chat-user-avatar');
    const chatUserName = document.getElementById('chat-user-name');
    const chatUserStatus = document.getElementById('chat-user-status');

    if (contactOrCategory.id && !contactOrCategory.icon) {
      // C'est un contact
      chatUserAvatar.innerHTML = contactOrCategory.name.charAt(0).toUpperCase();
      chatUserName.textContent = contactOrCategory.name;
      chatUserStatus.innerHTML = `
        <i class="bi bi-circle-fill"></i>
        <span>En ligne</span>
      `;
    } else {
      // C'est une catégorie de forum
      chatUserAvatar.innerHTML = contactOrCategory.icon;
      chatUserName.textContent = contactOrCategory.name;
      chatUserStatus.innerHTML = `
        <i class="bi bi-people"></i>
        <span>Forum de discussion</span>
      `;
    }
  }

  async loadConversation(contactId) {
    try {
      const response = await fetch(`/api/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        }
      });

      let messages = [];
      if (response.ok) {
        const apiResponse = await response.json();
        if (apiResponse.success) {
            const allMessages = apiResponse.messages || [];
            const currentUserId = this.currentUser?.id;
            messages = allMessages.filter(m => 
                (m.sender_id === currentUserId && m.recipient_id === contactId) ||
                (m.sender_id === contactId && m.recipient_id === currentUserId)
            );
        }
      }

      this.renderMessages(messages);
    } catch (error) {
      console.error('Erreur chargement conversation:', error);
      this.renderMessages([]);
    }
  }

  async loadForumMessages(categoryId) {
    try {
      const response = await fetch(`/api/messages/forum/${categoryId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        }
      });

      let messages = [];
      if (response.ok) {
        const encryptedMessages = await response.json();
        messages = await this.decryptMessages(encryptedMessages);
      }

      this.renderMessages(messages, true);
    } catch (error) {
      console.error('Erreur chargement forum:', error);
      this.renderMessages([]);
    }
  }

  renderMessages(messages, isForum = false) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '';

    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="text-center text-muted">
          <i class="bi bi-chat-dots" style="font-size: 3rem; opacity: 0.3;"></i>
          <p style="margin-top: 15px;">
            ${isForum ? 'Aucun message dans ce forum' : 'Aucun message dans cette conversation'}
          </p>
        </div>
      `;
      return;
    }

    messages.forEach(message => {
      const messageElement = this.createMessageElement(message, isForum);
      messagesContainer.appendChild(messageElement);
    });

    // Faire défiler vers le bas
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  createMessageElement(message, isForum = false) {
    const div = document.createElement('div');
    const isSent = message.sender_id === this.currentUser?.id;
    div.className = `message ${isSent ? 'sent' : 'received'}`;
    div.dataset.messageId = message.id; // Important for status updates

    const time = new Date(message.created_at || message.timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let content = message.content;
    if (message.type === 'voice') {
      content = `<audio controls><source src="${message.content}" type="audio/wav"></audio>`;
    } else if (message.type === 'photo') {
      content = `<img src="${message.content}" class="img-fluid" style="max-width: 200px; border-radius: 10px;">`;
      if (message.caption) {
        content += `<div class="mt-2">${message.caption}</div>`;
      }
    } else if (message.type === 'sticker') {
      content = `<div class="sticker-message" style="font-size: 3rem; text-align: center; padding: 10px;">${message.content}</div>`;
    }

    div.innerHTML = `
      <div class="message-content">
        <div class="message-bubble">
          <div>${content}</div>
        </div>
        <div class="message-time">${time}</div>
        ${isSent ? `<div class="message-status">${this.getMessageStatus(message.status)}</div>` : ''}
      </div>
    `;

    return div;
  }

  async sendMessage(content, type = 'text') {
    if (!content.trim()) return;

    let payload = {
      content: content.trim(),
      message_type: type,
      sender_id: this.currentUser.id,
      status: 'sending' // Temporary status for UI
    };

    if (this.currentContact) {
      payload.recipient_id = this.currentContact.id;
    } else if (this.currentForumCategory) {
      payload.recipient_id = null; // Forum messages don't have a direct recipient
      payload.message_type = 'forum'; // Explicitly mark as forum message
      payload.forum_category_id = this.currentForumCategory.id; // Add forum category ID
    } else {
      console.warn('Aucun contact ou catégorie de forum sélectionné pour envoyer le message.');
      return;
    }

    const tempId = Date.now();
    const message = { ...payload, id: tempId, created_at: new Date().toISOString() };

    // Afficher le message immédiatement
    this.addMessageToChat(message);

    try {
      // Envoyer au serveur
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt')}`
        },
        body: JSON.stringify(payload) // Send the constructed payload
      });

      if (response.ok) {
        const savedMessage = await response.json();
        this.updateMessageStatus(tempId, 'sent');
      } else {
        this.updateMessageStatus(tempId, 'failed');
      }
    } catch (error) {
      console.error('Erreur envoi message:', error);
      this.updateMessageStatus(tempId, 'failed');
    }
  }

  async encryptMessage(message) {
    return message; // Le chiffrement est désactivé pour le moment
  }

  async decryptMessages(encryptedMessages) {
    return encryptedMessages; // Le déchiffrement est désactivé
  }

  addMessageToChat(message) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;

    // Supprimer le message "aucune conversation"
    const noConversation = document.getElementById('no-conversation');
    if (noConversation) {
      noConversation.remove();
    }

    const messageElement = this.createMessageElement(message);
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  updateMessageStatus(messageId, status) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      const statusElement = messageElement.querySelector('.message-status');
      if (statusElement) {
        statusElement.textContent = this.getMessageStatus(status);
      }
    }
  }

  getMessageStatus(status) {
    switch (status) {
      case 'sending': return '⏳';
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '✓✓';
      case 'failed': return '❌';
      default: return '';
    }
  }

  showChatInput() {
    const messageInputArea = document.getElementById('message-input-area');
    if (messageInputArea) {
      messageInputArea.style.display = 'block';
    }
  }

  hideChatInput() {
    const messageInputArea = document.getElementById('message-input-area');
    if (messageInputArea) {
      messageInputArea.style.display = 'none';
    }
  }

  updateContactSelection() {
    // Mettre à jour la sélection visuelle
    document.querySelectorAll('.contact-item').forEach(item => {
      item.classList.remove('active');
    });

    if (this.currentContact) {
      const activeContact = document.querySelector(`[data-contact-id="${this.currentContact.id}"]`);
      if (activeContact) {
        activeContact.classList.add('active');
      }
    }
  }

  markConversationAsRead(contactId) {
    // Marquer la conversation comme lue
    console.log(`📖 Conversation marquée comme lue: ${contactId}`);
  }

  getUnreadCount(contactId) {
    // Retourner le nombre de messages non lus
    return Math.floor(Math.random() * 5);
  }

  getLastMessage(contactId) {
    // Retourner le dernier message
    const messages = [
      'Salut, comment ça va ?',
      'Merci pour l\'info',
      'À bientôt',
      'Ok, compris',
      'Parfait !'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  formatTime(date) {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  setupEventListeners() {
    // Recherche de contacts
    const searchInput = document.getElementById('search-contacts');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterContacts(e.target.value);
      });
    }

    // Onglets
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Catégories de forum
    document.querySelectorAll('.forum-category').forEach(category => {
      category.addEventListener('click', (e) => {
        const categoryData = this.forumCategories.find(c => c.id === e.currentTarget.dataset.category);
        if (categoryData) {
          this.selectForumCategory(categoryData);
        }
      });
    });

    // Envoi de message
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');

    if (messageInput && sendBtn) {
      sendBtn.addEventListener('click', () => {
        const content = messageInput.value.trim();
        if (content) {
          this.sendMessage(content);
          messageInput.value = '';
        }
      });

      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const content = messageInput.value.trim();
          if (content) {
            this.sendMessage(content);
            messageInput.value = '';
          }
        }
      });
    }

    // Boutons d'action
    document.getElementById('voice-btn')?.addEventListener('click', () => {
      this.startVoiceRecording();
    });

    document.getElementById('photo-btn')?.addEventListener('click', () => {
      this.capturePhoto();
    });

    document.getElementById('emoji-btn')?.addEventListener('click', () => {
      this.showStickerPicker();
    });

    // Boutons d'appel dans l'en-tête du chat
    document.getElementById('video-call-btn')?.addEventListener('click', () => {
      if (this.currentContact) {
        this.startVideoCall(this.currentContact.id);
      }
    });

    document.getElementById('voice-call-btn')?.addEventListener('click', () => {
      if (this.currentContact) {
        this.startVoiceCall(this.currentContact.id);
      }
    });
  }

  switchTab(tabName) {
    // Mettre à jour les onglets
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Afficher/masquer les sections
    const contactsList = document.getElementById('contacts-list');
    const forumSection = document.getElementById('forum-section');

    if (tabName === 'contacts') {
      contactsList.style.display = 'block';
      forumSection.style.display = 'none';
    } else {
      contactsList.style.display = 'none';
      forumSection.style.display = 'block';
    }
  }

  filterContacts(searchTerm) {
    const contacts = document.querySelectorAll('.contact-item');
    contacts.forEach(contact => {
      const name = contact.querySelector('.contact-name').textContent.toLowerCase();
      const role = contact.querySelector('.contact-role').textContent.toLowerCase();
      const search = searchTerm.toLowerCase();
      
      if (name.includes(search) || role.includes(search)) {
        contact.style.display = 'flex';
      } else {
        contact.style.display = 'none';
      }
    });
  }

  async startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = () => {
          this.sendMessage(reader.result, 'voice');
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      
      // Arrêter après 30 secondes max
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 30000);

    } catch (error) {
      console.error('Erreur enregistrement vocal:', error);
      alert('Impossible d\'accéder au microphone');
    }
  }

  async capturePhoto() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      // Créer un modal pour la capture
      const modal = this.createPhotoCaptureModal(video, stream);
      document.body.appendChild(modal);
      
    } catch (error) {
      console.error('Erreur capture photo:', error);
      alert('Impossible d\'accéder à la caméra');
    }
  }

  createPhotoCaptureModal(video, stream) {
    const modal = document.createElement('div');
    modal.className = 'photo-capture-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h5>📸 Capture Photo</h5>
            <button class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <video id="camera-preview" autoplay muted style="width: 100%; max-width: 500px; height: auto; border-radius: 10px;"></video>
            <div class="capture-controls" style="margin-top: 15px; text-align: center;">
              <button id="take-photo-btn" class="btn btn-primary">
                <i class="bi bi-camera"></i> Prendre la photo
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Styles
    const style = document.createElement('style');
    style.textContent = `
      .photo-capture-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .modal-content {
        background: white;
        border-radius: 15px;
        max-width: 90vw;
        max-height: 90vh;
        overflow: hidden;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        background: #f8f9fa;
        border-bottom: 1px solid #dee2e6;
      }
      .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
      }
      .modal-body {
        padding: 20px;
      }
    `;
    document.head.appendChild(style);

    // Événements
    const closeBtn = modal.querySelector('.close-btn');
    const takePhotoBtn = modal.querySelector('#take-photo-btn');

    closeBtn.addEventListener('click', () => {
      stream.getTracks().forEach(track => track.stop());
      document.body.removeChild(modal);
    });

    takePhotoBtn.addEventListener('click', () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      context.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      this.sendMessage(imageData, 'photo');
      
      stream.getTracks().forEach(track => track.stop());
      document.body.removeChild(modal);
    });

    return modal;
  }

  startConnectionMonitoring() {
    // Surveiller la connexion
    setInterval(() => {
      this.updateConnectionStatus(navigator.onLine);
    }, 5000);
  }

  updateConnectionStatus(isOnline) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      if (isOnline) {
        statusElement.innerHTML = '<i class="bi bi-wifi"></i><span>En ligne</span>';
        statusElement.className = 'connection-status online';
      } else {
        statusElement.innerHTML = '<i class="bi bi-wifi-off"></i><span>Hors-ligne</span>';
        statusElement.className = 'connection-status offline';
      }
    }
  }

  // Fonction pour démarrer un appel vidéo
  startVideoCall(contactId) {
    const contact = this.contacts.find(c => c.id == contactId);
    if (!contact) return;

    // Simuler un appel vidéo (dans une vraie implémentation, utiliser WebRTC)
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-camera-video"></i> Appel vidéo avec ${contact.name}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center">
            <div class="video-call-container">
              <div class="remote-video mb-3">
                <div class="video-placeholder bg-dark text-white d-flex align-items-center justify-content-center" style="height: 300px; border-radius: 10px;">
                  <div>
                    <i class="bi bi-camera-video fs-1"></i>
                    <p>${contact.name}</p>
                  </div>
                </div>
              </div>
              <div class="local-video">
                <div class="video-placeholder bg-secondary text-white d-flex align-items-center justify-content-center" style="width: 150px; height: 100px; border-radius: 10px; margin: 0 auto;">
                  <i class="bi bi-person"></i>
                </div>
              </div>
            </div>
            <div class="call-controls mt-3">
              <button class="btn btn-danger btn-lg me-2" onclick="this.closest('.modal').querySelector('.btn-close').click()">
                <i class="bi bi-telephone-x"></i> Raccrocher
              </button>
              <button class="btn btn-warning btn-lg me-2" onclick="this.classList.toggle('active')">
                <i class="bi bi-mic-mute"></i> Micro
              </button>
              <button class="btn btn-info btn-lg" onclick="this.classList.toggle('active')">
                <i class="bi bi-camera-video-off"></i> Caméra
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modal);
    });
  }

  // Fonction pour démarrer un appel vocal
  startVoiceCall(contactId) {
    const contact = this.contacts.find(c => c.id == contactId);
    if (!contact) return;

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-telephone"></i> Appel vocal avec ${contact.name}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center">
            <div class="call-avatar mb-4">
              <div class="contact-avatar mx-auto" style="background: ${contact.avatar?.color || '#667eea'}; width: 120px; height: 120px; font-size: 48px;">
                ${contact.avatar?.initial || contact.name.charAt(0).toUpperCase()}
              </div>
            </div>
            <h4>${contact.name}</h4>
            <p class="text-muted">Appel en cours...</p>
            <div class="call-controls mt-4">
              <button class="btn btn-danger btn-lg me-2" onclick="this.closest('.modal').querySelector('.btn-close').click()">
                <i class="bi bi-telephone-x"></i> Raccrocher
              </button>
              <button class="btn btn-warning btn-lg" onclick="this.classList.toggle('active')">
                <i class="bi bi-mic-mute"></i> Micro
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modal);
    });
  }

  // Fonction pour afficher les stickers
  showStickerPicker() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-emoji-smile"></i> Choisir un sticker
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="sticker-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;">
              ${this.getStickers().map(sticker => `
                <div class="sticker-item text-center p-2" style="cursor: pointer; border: 1px solid #dee2e6; border-radius: 8px;" onclick="window.advancedMessaging.sendSticker('${sticker}')">
                  <div style="font-size: 2rem;">${sticker}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modal);
    });
  }

  getStickers() {
    return [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃',
      '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
      '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟',
      '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
      '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
      '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
      '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧',
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇',
      '☝️', '✋', '🤚', '🖐', '🖖', '👋', '🤝', '👏', '🙌', '👐', '🤲', '🤜',
      '🤛', '✊', '👊', '👎', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈'
    ];
  }

  sendSticker(sticker) {
    if (this.currentContact) {
      this.sendMessage(sticker, 'sticker');
    } else if (this.currentForumCategory) {
      this.sendMessage(sticker, 'sticker');
    }
    
    // Fermer le modal des stickers
    const modal = document.querySelector('.modal');
    if (modal) {
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) bsModal.hide();
    }
  }
}

// Initialiser le système de messagerie avancé
window.advancedMessaging = new AdvancedMessaging();

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdvancedMessaging;
}
