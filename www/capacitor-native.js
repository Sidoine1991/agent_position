// Module pour gérer les APIs natives Capacitor
class CapacitorNative {
  constructor() {
    this.isNative = this.checkIfNative();
    this.init();
  }

  checkIfNative() {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  }

  async init() {
    if (this.isNative) {
      console.log('📱 Mode natif détecté - Initialisation des plugins Capacitor');
      await this.initializePlugins();
    } else {
      console.log('🌐 Mode web détecté - Utilisation des APIs web standard');
    }
  }

  async initializePlugins() {
    try {
      // Initialiser la barre de statut
      const { StatusBar } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: 'dark' });
      await StatusBar.setBackgroundColor({ color: '#0b1220' });

      // Initialiser l'écran de démarrage
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide();

      console.log('✅ Plugins Capacitor initialisés');
    } catch (error) {
      console.warn('⚠️ Erreur lors de l\'initialisation des plugins:', error);
    }
  }

  // === GÉOLOCALISATION NATIVE ===
  async getCurrentPosition(options = {}) {
    if (!this.isNative) {
      // Fallback vers l'API web standard
      return this.getWebPosition(options);
    }

    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      
      // Vérifier les permissions
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          throw new Error('Permission de géolocalisation refusée');
        }
      }

      // Obtenir la position avec haute précision
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        ...options
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp
      };
    } catch (error) {
      console.error('Erreur géolocalisation native:', error);
      throw error;
    }
  }

  // === GÉOLOCALISATION WEB (FALLBACK) ===
  async getWebPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Géolocalisation non supportée'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          });
        },
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
          ...options
        }
      );
    });
  }

  // === CAMÉRA NATIVE ===
  async takePicture(options = {}) {
    if (!this.isNative) {
      // Fallback vers l'input file web
      return this.getWebPicture();
    }

    try {
      const { Camera } = await import('@capacitor/camera');
      
      // Vérifier les permissions
      const permissions = await Camera.checkPermissions();
      if (permissions.camera !== 'granted') {
        const request = await Camera.requestPermissions();
        if (request.camera !== 'granted') {
          throw new Error('Permission caméra refusée');
        }
      }

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: 'uri',
        source: 'camera',
        ...options
      });

      return {
        webPath: image.webPath,
        format: image.format,
        saved: false
      };
    } catch (error) {
      console.error('Erreur caméra native:', error);
      throw error;
    }
  }

  // === CAMÉRA WEB (FALLBACK) ===
  async getWebPicture() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment'; // Caméra arrière sur mobile
      
      input.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              webPath: e.target.result,
              format: file.type,
              saved: false,
              file: file
            });
          };
          reader.readAsDataURL(file);
        } else {
          reject(new Error('Aucune image sélectionnée'));
        }
      };
      
      input.click();
    });
  }

  // === RÉSEAU ===
  async getNetworkStatus() {
    if (!this.isNative) {
      return {
        connected: navigator.onLine,
        connectionType: 'unknown'
      };
    }

    try {
      const { Network } = await import('@capacitor/network');
      const status = await Network.getStatus();
      return status;
    } catch (error) {
      console.error('Erreur réseau:', error);
      return { connected: false, connectionType: 'unknown' };
    }
  }

  // === FICHIERS ===
  async saveFile(data, filename) {
    if (!this.isNative) {
      // Fallback web - téléchargement
      this.downloadWebFile(data, filename);
      return;
    }

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      
      const result = await Filesystem.writeFile({
        path: filename,
        data: data,
        directory: Directory.Documents
      });
      
      return result.uri;
    } catch (error) {
      console.error('Erreur sauvegarde fichier:', error);
      throw error;
    }
  }

  downloadWebFile(data, filename) {
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // === UTILITAIRES ===
  async showToast(message, duration = 3000) {
    if (this.isNative) {
      try {
        const { Toast } = await import('@capacitor/toast');
        await Toast.show({
          text: message,
          duration: duration
        });
      } catch (error) {
        console.warn('Toast non disponible:', error);
        alert(message);
      }
    } else {
      // Fallback web
      if (window.showNotification) {
        window.showNotification(message, 'info');
      } else {
        alert(message);
      }
    }
  }

  // === DÉTECTION DE PLATEFORME ===
  getPlatform() {
    if (this.isNative) {
      return Capacitor.getPlatform();
    }
    return 'web';
  }

  isAndroid() {
    return this.getPlatform() === 'android';
  }

  isIOS() {
    return this.getPlatform() === 'ios';
  }

  isWeb() {
    return this.getPlatform() === 'web';
  }
}

// Instance globale
const capacitorNative = new CapacitorNative();

// Exporter pour utilisation globale
window.CapacitorNative = CapacitorNative;
window.capacitorNative = capacitorNative;

// Fonction de compatibilité pour le code existant
window.getCurrentLocationWithValidation = async function() {
  try {
    // Essayer plusieurs fois pour améliorer la précision
    const attempts = 3;
    let bestPosition = null;
    
    for (let i = 0; i < attempts; i++) {
      try {
        const position = await capacitorNative.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
        
        if (!bestPosition || position.accuracy < bestPosition.accuracy) {
          bestPosition = position;
        }
        
        // Si précision excellente, arrêter
        if (position.accuracy <= 50) {
          break;
        }
        
        // Attendre un peu avant le prochain essai
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.warn(`Tentative ${i + 1} échouée:`, error.message);
        if (i === attempts - 1) throw error;
      }
    }
    
    if (!bestPosition) {
      throw new Error('Impossible d\'obtenir la position GPS');
    }
    
    // Afficher les informations de localisation
    if (window.showLocationInfo) {
      window.showLocationInfo(bestPosition);
    }
    
    // Stocker les coordonnées localement
    localStorage.setItem('lastGPS', JSON.stringify({
      lat: bestPosition.latitude,
      lon: bestPosition.longitude,
      accuracy: bestPosition.accuracy,
      timestamp: Date.now()
    }));
    
    return bestPosition;
  } catch (error) {
    console.error('Erreur de géolocalisation:', error);
    
    // Messages d'erreur plus clairs
    let errorMessage = 'Erreur de géolocalisation';
    if (error.message.includes('timeout')) {
      errorMessage = 'Timeout GPS: Veuillez vous déplacer vers un endroit plus ouvert et réessayer';
    } else if (error.message.includes('denied') || error.message.includes('Permission')) {
      errorMessage = 'Accès GPS refusé: Veuillez autoriser la géolocalisation dans les paramètres';
    } else if (error.message.includes('unavailable')) {
      errorMessage = 'GPS indisponible: Vérifiez que la géolocalisation est activée';
    }
    
    throw new Error(errorMessage);
  }
};

console.log('📱 Module Capacitor Native chargé');
