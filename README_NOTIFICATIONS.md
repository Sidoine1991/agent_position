# Système de Notifications en Temps Réel

## 🎯 Fonctionnalités Implémentées

### 1. **Bulles de Notification Flottantes**
- **Apparence** : Bulles modernes avec dégradés et animations
- **Position** : Coin supérieur droit de l'écran
- **Types** : Messages normaux, urgents, système
- **Actions** : Répondre, marquer comme lu, fermer
- **Auto-masquage** : Configurable (3s, 5s, 10s, ou permanent)

### 2. **Sons de Notification Programmatiques**
- **Génération** : Sons créés avec Web Audio API (pas de fichiers audio)
- **Types** :
  - `message` : Son doux pour messages normaux
  - `system` : Son distinctif pour notifications système
  - `urgent` : Son répétitif pour messages urgents
  - `typing` : Son discret pour indicateur de frappe
- **Volume** : Configurable (0-1)

### 3. **Vibrations**
- **Support** : Vérification de la compatibilité
- **Patterns** :
  - Messages normaux : 1 vibration
  - Messages urgents : 3 vibrations
  - Système : 1 vibration longue

### 4. **Notifications Desktop**
- **Permissions** : Demande automatique
- **Persistance** : Messages urgents restent visibles
- **Clic** : Redirection vers la conversation

### 5. **WebSocket en Temps Réel**
- **Connexion** : WebSocket avec fallback vers polling
- **Reconnexion** : Automatique avec backoff exponentiel
- **Événements** : Messages, frappe, présence
- **Queue** : Messages mis en file d'attente si déconnecté

## 📁 Fichiers Créés

### Composants Principaux
- `web/components/notification-bubble.js` - Bulles flottantes
- `web/components/realtime-messaging.js` - WebSocket temps réel
- `web/components/notification-sounds.js` - Sons programmatiques
- `web/components/notification-manager.js` - Gestionnaire centralisé
- `web/components/notification-settings.html` - Interface de configuration

### Intégration
- `web/messages.html` - Page de messagerie mise à jour
- `README_NOTIFICATIONS.md` - Documentation

## 🚀 Utilisation

### 1. **Activation Automatique**
Les notifications s'activent automatiquement au chargement de la page de messagerie.

### 2. **Configuration**
Cliquer sur le bouton "Notifications" en haut à droite pour :
- Activer/désactiver les types de notifications
- Configurer la durée d'affichage des bulles
- Ajuster le volume des sons
- Tester les notifications

### 3. **Types de Notifications**

#### Messages Normaux
```javascript
// Déclencher une notification de message
document.dispatchEvent(new CustomEvent('newMessage', {
  detail: {
    message: {
      id: 123,
      content: 'Bonjour !',
      sender: { name: 'Jean Dupont' },
      chat_id: 'chat_456',
      urgent: false
    }
  }
}));
```

#### Messages Urgents
```javascript
// Message urgent avec son et vibration renforcés
document.dispatchEvent(new CustomEvent('newMessage', {
  detail: {
    message: {
      id: 124,
      content: 'URGENT: Réunion annulée',
      sender: { name: 'Admin' },
      chat_id: 'chat_456',
      urgent: true
    }
  }
}));
```

#### Notifications Système
```javascript
// Notification système
document.dispatchEvent(new CustomEvent('systemNotification', {
  detail: {
    sender: 'Système',
    message: 'Connexion établie',
    urgent: false
  }
}));
```

## ⚙️ Configuration

### Paramètres Disponibles
```javascript
// Accéder au gestionnaire
const manager = window.notificationManager;

// Modifier les paramètres
manager.setSetting('enableBubbles', true);
manager.setSetting('enableSounds', true);
manager.setSetting('bubbleDuration', 5000);
manager.setSetting('soundVolume', 0.3);

// Tester les notifications
manager.testNotification('message');
manager.testNotification('urgent');
manager.testNotification('system');
```

### API Publique
```javascript
// Gestionnaire de notifications
window.notificationManager
  - getSettings()
  - setSetting(key, value)
  - testNotification(type)
  - clearAllNotifications()

// Bulles de notification
window.notificationBubble
  - showNotification(notification)
  - hideNotification(id)
  - clearAllNotifications()

// Sons de notification
window.notificationSounds
  - play(type, volume)
  - testSound(type)

// Messagerie temps réel
window.realtimeMessaging
  - sendMessage(content, recipientId)
  - sendTypingIndicator(chatId, isTyping)
  - updatePresence(status)
```

## 🎨 Personnalisation

### Styles CSS
Les bulles utilisent des classes CSS personnalisables :
- `.notification-bubble` - Bulle principale
- `.notification-bubble.message` - Messages normaux
- `.notification-bubble.urgent` - Messages urgents
- `.notification-bubble.system` - Notifications système

### Animations
- **Entrée** : Translation depuis la droite avec effet de rebond
- **Sortie** : Translation vers la droite avec fondu
- **Urgent** : Pulsation de l'ombre
- **Hover** : Élévation et agrandissement

## 🔧 Maintenance

### Vérification du Statut
```javascript
// Vérifier la connexion
const status = window.realtimeMessaging.getConnectionStatus();
console.log('Connecté:', status.connected);
console.log('Messages en file:', status.queuedMessages);

// Vérifier les permissions
const permissions = window.notificationManager.getPermissions();
console.log('Notifications desktop:', permissions.notification);
console.log('Audio supporté:', permissions.sound);
console.log('Vibration supportée:', permissions.vibration);
```

### Debug
```javascript
// Activer les logs détaillés
localStorage.setItem('debugNotifications', 'true');

// Tester tous les types
window.notificationManager.testNotification('message');
window.notificationManager.testNotification('urgent');
window.notificationManager.testNotification('system');
```

## 📱 Compatibilité

### Navigateurs Supportés
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 11+
- ✅ Edge 79+

### Fonctionnalités par Navigateur
- **WebSocket** : Tous les navigateurs modernes
- **Notifications Desktop** : Chrome, Firefox, Safari, Edge
- **Vibration** : Chrome, Firefox (mobile)
- **Web Audio API** : Tous les navigateurs modernes

## 🚨 Notes Importantes

1. **Permissions** : Les notifications desktop nécessitent une permission utilisateur
2. **HTTPS** : Requis pour les notifications desktop en production
3. **Performance** : Les sons programmatiques sont plus légers que les fichiers audio
4. **Fallback** : Le système utilise le polling si WebSocket n'est pas disponible
5. **Mobile** : Les vibrations fonctionnent uniquement sur les appareils mobiles

## 🔄 Mise à Jour

Pour ajouter de nouveaux types de notifications :

1. **Ajouter le type dans `notification-manager.js`**
2. **Créer le son correspondant dans `notification-sounds.js`**
3. **Ajouter le style CSS dans `notification-bubble.js`**
4. **Mettre à jour l'interface de configuration**

Le système est entièrement modulaire et extensible ! 🎉
