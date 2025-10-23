/**
 * Gestionnaire de sons de notification
 * Génère des sons programmatiquement pour éviter les fichiers audio
 */

class NotificationSounds {
  constructor() {
    this.audioContext = null;
    this.sounds = {
      message: this.createMessageSound.bind(this),
      system: this.createSystemSound.bind(this),
      urgent: this.createUrgentSound.bind(this),
      typing: this.createTypingSound.bind(this)
    };
    
    this.init();
  }

  init() {
    // Initialiser l'AudioContext
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('AudioContext non supporté:', error);
    }
  }

  play(soundType, volume = 0.3) {
    if (!this.audioContext) {
      console.warn('AudioContext non disponible');
      return;
    }

    const soundFunction = this.sounds[soundType];
    if (soundFunction) {
      soundFunction(volume);
    }
  }

  createMessageSound(volume = 0.3) {
    // Son doux pour les messages normaux
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 0.2);
    
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }

  createSystemSound(volume = 0.3) {
    // Son plus distinctif pour les notifications système
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime + 0.2);
    
    oscillator.type = 'triangle';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.4);
  }

  createUrgentSound(volume = 0.5) {
    // Son d'urgence plus fort et répétitif
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Fréquence qui monte et descend rapidement
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime + 0.05);
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime + 0.15);
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.2);
    
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.25);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.25);
  }

  createTypingSound(volume = 0.2) {
    // Son discret pour l'indicateur de frappe
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(2000, this.audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  // Méthodes utilitaires
  testSound(soundType = 'message') {
    this.play(soundType);
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  // Créer un son personnalisé
  createCustomSound(frequencies, duration = 0.3, volume = 0.3) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Appliquer les fréquences
    frequencies.forEach((freq, index) => {
      const time = this.audioContext.currentTime + (index * 0.1);
      oscillator.frequency.setValueAtTime(freq, time);
    });
    
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }
}

// Initialiser le système de sons
let notificationSounds;

document.addEventListener('DOMContentLoaded', () => {
  notificationSounds = new NotificationSounds();
  
  // Exposer globalement
  window.notificationSounds = notificationSounds;
});

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationSounds;
}
