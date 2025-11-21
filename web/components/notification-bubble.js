/**
 * Composant de bulle de notification en temps réel
 * Similaire aux réseaux sociaux (Facebook, WhatsApp, etc.)
 */

class NotificationBubble {
  constructor() {
    this.notifications = [];
    this.isVisible = false;
    this.soundEnabled = true;
    this.vibrationEnabled = true;
    this.maxNotifications = 5;
    this.autoHideDelay = 5000; // 5 secondes
    
    this.init();
  }

  init() {
    this.createBubbleContainer();
    this.setupEventListeners();
    this.loadSettings();
  }

  createBubbleContainer() {
    // Créer le conteneur principal
    const container = document.createElement('div');
    container.id = 'notification-bubble-container';
    container.className = 'notification-bubble-container';
    
    // Styles CSS
    const styles = `
      .notification-bubble-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 350px;
        pointer-events: none;
      }
      
      .notification-bubble {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        margin-bottom: 10px;
        border-radius: 15px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        transform: translateX(400px);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        pointer-events: auto;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        touch-action: pan-y; /* Permettre le swipe vertical */
        user-select: none;
      }
      
      .notification-bubble.swiping {
        transition: transform 0.1s ease-out, opacity 0.1s ease-out;
      }
      
      .notification-bubble.swipe-dismiss {
        transform: translateY(100px) rotateZ(5deg);
        opacity: 0;
      }
      
      .notification-bubble.forum {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }
      
      .notification-bubble.forum::after {
        content: '🗨️';
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 12px;
        opacity: 0.7;
      }
      
      .notification-bubble.show {
        transform: translateX(0);
        opacity: 1;
      }
      
      .notification-bubble.hide {
        transform: translateX(400px);
        opacity: 0;
      }
      
      .notification-bubble::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 100%);
        pointer-events: none;
      }
      
      .notification-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .notification-avatar {
        width: 35px;
        height: 35px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;
        font-size: 16px;
        font-weight: bold;
      }
      
      .notification-info {
        flex: 1;
      }
      
      .notification-sender {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 2px;
      }
      
      .notification-time {
        font-size: 11px;
        opacity: 0.8;
      }
      
      .notification-content {
        font-size: 13px;
        line-height: 1.4;
        margin-bottom: 8px;
        max-height: 60px;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      }
      
      .notification-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }
      
      .notification-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
        backdrop-filter: blur(10px);
      }
      
      .notification-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
      }
      
      .notification-close {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        transition: all 0.2s;
      }
      
      .notification-close:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
      }
      
      .notification-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ff4757;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      
      .notification-bubble.message {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      }
      
      .notification-bubble.system {
        background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
      }
      
      .notification-bubble.urgent {
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
        animation: urgentPulse 1s infinite;
      }
      
      @keyframes urgentPulse {
        0% { box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3); }
        50% { box-shadow: 0 8px 25px rgba(255, 107, 107, 0.6); }
        100% { box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3); }
      }
    `;
    
    // Ajouter les styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    
    // Ajouter le conteneur au DOM
    document.body.appendChild(container);
  }

  setupEventListeners() {
    // Écouter les nouveaux messages
    document.addEventListener('newMessage', (event) => {
      this.handleNewMessage(event.detail.message);
    });
    
    // Écouter les événements système
    document.addEventListener('systemNotification', (event) => {
      this.showSystemNotification(event.detail);
    });
    
    // Écouter les changements de visibilité de la page
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.enableSoundNotifications();
      } else {
        this.disableSoundNotifications();
      }
    });
  }

  loadSettings() {
    // Charger les paramètres depuis localStorage
    const settings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
    this.soundEnabled = settings.soundEnabled !== false;
    this.vibrationEnabled = settings.vibrationEnabled !== false;
    this.autoHideDelay = settings.autoHideDelay || 5000;
  }

  saveSettings() {
    const settings = {
      soundEnabled: this.soundEnabled,
      vibrationEnabled: this.vibrationEnabled,
      autoHideDelay: this.autoHideDelay
    };
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
  }

  handleNewMessage(message) {
    if (!message) return;
    
    // Vérifier si l'utilisateur est sur la page de messagerie
    const isOnMessagesPage = window.location.pathname.includes('messages');
    
    // Ne pas afficher la notification si l'utilisateur est déjà sur la page de messagerie
    if (isOnMessagesPage && !document.hidden) {
      return;
    }
    
    // Créer la notification
    const notification = {
      id: Date.now() + Math.random(),
      type: 'message',
      sender: message.sender?.name || 'Utilisateur',
      content: message.content || '',
      timestamp: new Date(),
      avatar: message.sender?.avatar || this.getDefaultAvatar(message.sender?.name),
      chatId: message.chat_id,
      urgent: message.urgent || false
    };
    
    this.showNotification(notification);
  }

  showSystemNotification(data) {
    const notification = {
      id: Date.now() + Math.random(),
      type: 'system',
      sender: data.sender || 'Système',
      content: data.message || '',
      timestamp: new Date(),
      avatar: data.avatar || '🔔',
      urgent: data.urgent || false
    };
    
    this.showNotification(notification);
  }

  showForumNotification(data) {
    const notification = {
      id: Date.now() + Math.random(),
      type: 'message',
      forum: true,
      forumId: data.forumId || data.category_id,
      threadId: data.threadId || data.thread_id,
      sender: data.sender?.name || data.author || 'Utilisateur forum',
      content: data.content || data.message || '',
      timestamp: new Date(),
      avatar: data.sender?.avatar || data.author_avatar || '🗨️',
      urgent: data.urgent || false
    };
    
    this.showNotification(notification);
  }

  showNotification(notification) {
    // Limiter le nombre de notifications
    if (this.notifications.length >= this.maxNotifications) {
      this.removeOldestNotification();
    }
    
    // Ajouter à la liste
    this.notifications.push(notification);
    
    // Créer l'élément DOM
    this.createNotificationElement(notification);
    
    // Jouer le son si activé
    if (this.soundEnabled) {
      this.playNotificationSound(notification.type);
    }
    
    // Vibrer si activé et supporté
    if (this.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
    
    // Auto-masquer après le délai
    setTimeout(() => {
      this.hideNotification(notification.id);
    }, this.autoHideDelay);
  }

  createNotificationElement(notification) {
    const container = document.getElementById('notification-bubble-container');
    const element = document.createElement('div');
    element.className = `notification-bubble ${notification.type} ${notification.urgent ? 'urgent' : ''} ${notification.forum ? 'forum' : ''}`;
    element.dataset.notificationId = notification.id;
    
    // Variables pour le swipe
    let startY = 0;
    let currentY = 0;
    let isSwiping = false;
    let swipeThreshold = 80; // Seuil pour supprimer (80px)
    
    // Contenu de la notification
    element.innerHTML = `
      <button class="notification-close" onclick="notificationBubble.hideNotification('${notification.id}')">×</button>
      <div class="notification-header">
        <div class="notification-avatar">${notification.avatar}</div>
        <div class="notification-info">
          <div class="notification-sender">${notification.sender}</div>
          <div class="notification-time">${this.formatTime(notification.timestamp)}</div>
        </div>
        ${notification.urgent ? '<div class="notification-badge">!</div>' : ''}
      </div>
      <div class="notification-content">${this.truncateText(notification.content, 100)}</div>
      <div class="notification-actions">
        ${notification.forum ? 
          `<button class="notification-btn" onclick="notificationBubble.openForum('${notification.forumId}', '${notification.threadId}')">
            Voir la discussion
          </button>` :
          `<button class="notification-btn" onclick="notificationBubble.openChat('${notification.chatId}')">
            Répondre
          </button>`
        }
        <button class="notification-btn" onclick="notificationBubble.markAsRead('${notification.id}')">
          Marquer lu
        </button>
      </div>
    `;
    
    // Gestion du swipe pour supprimer (mobile et desktop)
    const handleStart = (e) => {
      if (e.target.classList.contains('notification-close') || 
          e.target.classList.contains('notification-btn')) return;
      
      isSwiping = true;
      startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      element.classList.add('swiping');
      element.style.transition = 'none';
    };
    
    const handleMove = (e) => {
      if (!isSwiping) return;
      
      e.preventDefault();
      currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      // Limiter le mouvement vers le bas
      if (deltaY > 0) {
        element.style.transform = `translateY(${deltaY}px) rotateZ(${deltaY * 0.05}deg)`;
        element.style.opacity = 1 - (deltaY / swipeThreshold);
      }
    };
    
    const handleEnd = () => {
      if (!isSwiping) return;
      
      isSwiping = false;
      element.classList.remove('swiping');
      element.style.transition = '';
      
      const deltaY = currentY - startY;
      
      if (deltaY > swipeThreshold) {
        // Supprimer la notification avec animation
        element.classList.add('swipe-dismiss');
        setTimeout(() => {
          this.hideNotification(notification.id);
        }, 200);
      } else {
        // Revenir à la position normale
        element.style.transform = '';
        element.style.opacity = '';
      }
      
      startY = 0;
      currentY = 0;
    };
    
    // Événements pour le touch (mobile)
    element.addEventListener('touchstart', handleStart, { passive: false });
    element.addEventListener('touchmove', handleMove, { passive: false });
    element.addEventListener('touchend', handleEnd);
    
    // Événements pour la souris (desktop)
    element.addEventListener('mousedown', handleStart);
    element.addEventListener('mousemove', handleMove);
    element.addEventListener('mouseup', handleEnd);
    element.addEventListener('mouseleave', handleEnd);
    
    // Ajouter l'événement de clic normal
    element.addEventListener('click', (e) => {
      if (!e.target.classList.contains('notification-close') && 
          !e.target.classList.contains('notification-btn') &&
          !isSwiping) {
        if (notification.forum) {
          this.openForum(notification.forumId, notification.threadId);
        } else {
          this.openChat(notification.chatId);
        }
      }
    });
    
    container.appendChild(element);
    
    // Animation d'entrée
    setTimeout(() => {
      element.classList.add('show');
    }, 100);
  }

  hideNotification(notificationId) {
    const element = document.querySelector(`[data-notification-id="${notificationId}"]`);
    if (element) {
      element.classList.add('hide');
      setTimeout(() => {
        element.remove();
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
      }, 400);
    }
  }

  removeOldestNotification() {
    const oldest = this.notifications[0];
    if (oldest) {
      this.hideNotification(oldest.id);
    }
  }

  openChat(chatId) {
    // Rediriger vers la page de messagerie avec le chat spécifique
    if (chatId) {
      window.location.href = `/messages.html?chat=${chatId}`;
    } else {
      window.location.href = '/messages.html';
    }
  }

  openForum(forumId, threadId) {
    // Rediriger vers la page de messagerie avec le forum spécifique
    let url = '/messages.html?mode=forum';
    if (forumId) {
      url += `&category=${forumId}`;
    }
    if (threadId) {
      url += `&thread=${threadId}`;
    }
    window.location.href = url;
  }

  markAsRead(notificationId) {
    // Marquer comme lu (logique métier)
    console.log('Notification marquée comme lue:', notificationId);
    this.hideNotification(notificationId);
  }

  playNotificationSound(type) {
    const audio = new Audio();
    
    switch (type) {
      case 'message':
        audio.src = '/sounds/message-notification.mp3';
        break;
      case 'system':
        audio.src = '/sounds/system-notification.mp3';
        break;
      default:
        audio.src = '/sounds/default-notification.mp3';
    }
    
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Impossible de jouer le son:', e));
  }

  getDefaultAvatar(name) {
    if (!name) return '👤';
    return name.charAt(0).toUpperCase();
  }

  formatTime(timestamp) {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes}min`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  enableSoundNotifications() {
    this.soundEnabled = true;
    this.saveSettings();
  }

  disableSoundNotifications() {
    this.soundEnabled = false;
    this.saveSettings();
  }

  // Méthodes publiques pour la configuration
  setAutoHideDelay(delay) {
    this.autoHideDelay = delay;
    this.saveSettings();
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this.saveSettings();
    return this.soundEnabled;
  }

  toggleVibration() {
    this.vibrationEnabled = !this.vibrationEnabled;
    this.saveSettings();
    return this.vibrationEnabled;
  }

  clearAllNotifications() {
    this.notifications.forEach(notification => {
      this.hideNotification(notification.id);
    });
  }
}

// Initialiser le système de notifications
let notificationBubble;

document.addEventListener('DOMContentLoaded', () => {
  notificationBubble = new NotificationBubble();
  
  // Exposer globalement pour les boutons
  window.notificationBubble = notificationBubble;
});

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationBubble;
}
