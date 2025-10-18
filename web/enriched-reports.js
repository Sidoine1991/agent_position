/**
 * Système de rapports enrichis pour l'application CCRB
 * Gère les photos, enregistrements audio, formulaires dynamiques et signatures
 */

class EnrichedReports {
  constructor() {
    this.currentReport = null;
    this.mediaFiles = [];
    this.formData = {};
    this.signatureCanvas = null;
    this.audioRecorder = null;
    this.isRecording = false;
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.initializeMediaCapture();
  }

  setupEventListeners() {
    // Événements de capture média
    document.addEventListener('click', (e) => {
      if (e.target.id === 'capture-photo-btn') {
        this.capturePhoto();
      } else if (e.target.id === 'record-audio-btn') {
        this.toggleAudioRecording();
      } else if (e.target.id === 'add-signature-btn') {
        this.showSignatureModal();
      }
    });

    // Événements de formulaire
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('dynamic-form-input')) {
        this.updateFormData(e.target);
      }
    });
  }

  async initializeMediaCapture() {
    // Ne pas demander les permissions automatiquement
    // Les permissions seront demandées uniquement quand l'utilisateur clique sur les boutons
    console.log('📱 Système de capture média initialisé - permissions sur demande');
  }

  // Capture de photos
  async capturePhoto() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'environment' // Caméra arrière par défaut
        } 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      // Créer un modal pour la capture
      const modal = this.createPhotoCaptureModal(video, stream);
      document.body.appendChild(modal);
      
    } catch (error) {
      console.error('Erreur capture photo:', error);
      this.showError('Impossible d\'accéder à la caméra');
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
            <video id="camera-preview" autoplay muted></video>
            <div class="capture-controls">
              <button id="take-photo-btn" class="btn btn-primary">
                <i class="bi bi-camera"></i> Prendre la photo
              </button>
              <button id="switch-camera-btn" class="btn btn-secondary">
                <i class="bi bi-arrow-repeat"></i> Changer de caméra
              </button>
            </div>
            <div id="photo-preview" class="photo-preview" style="display: none;">
              <img id="captured-image" />
              <div class="photo-actions">
                <button id="retake-photo-btn" class="btn btn-warning">Reprendre</button>
                <button id="save-photo-btn" class="btn btn-success">Sauvegarder</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Styles CSS
    const style = document.createElement('style');
    style.textContent = `
      .photo-capture-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
      }
      .modal-overlay {
        background: rgba(0, 0, 0, 0.8);
        width: 100%;
        height: 100%;
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
      #camera-preview {
        width: 100%;
        max-width: 500px;
        height: auto;
        border-radius: 10px;
      }
      .capture-controls {
        display: flex;
        gap: 10px;
        margin-top: 15px;
        justify-content: center;
      }
      .photo-preview {
        margin-top: 15px;
        text-align: center;
      }
      .photo-preview img {
        max-width: 100%;
        max-height: 300px;
        border-radius: 10px;
      }
      .photo-actions {
        margin-top: 15px;
        display: flex;
        gap: 10px;
        justify-content: center;
      }
    `;
    document.head.appendChild(style);

    // Événements
    const closeBtn = modal.querySelector('.close-btn');
    const takePhotoBtn = modal.querySelector('#take-photo-btn');
    const switchCameraBtn = modal.querySelector('#switch-camera-btn');
    const retakePhotoBtn = modal.querySelector('#retake-photo-btn');
    const savePhotoBtn = modal.querySelector('#save-photo-btn');

    closeBtn.addEventListener('click', () => {
      stream.getTracks().forEach(track => track.stop());
      document.body.removeChild(modal);
    });

    takePhotoBtn.addEventListener('click', () => {
      this.takePhoto(video, modal);
    });

    switchCameraBtn.addEventListener('click', () => {
      this.switchCamera(video, stream);
    });

    retakePhotoBtn.addEventListener('click', () => {
      modal.querySelector('#photo-preview').style.display = 'none';
      modal.querySelector('#camera-preview').style.display = 'block';
    });

    savePhotoBtn.addEventListener('click', () => {
      this.savePhoto(modal);
    });

    return modal;
  }

  takePhoto(video, modal) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Afficher la prévisualisation
    const preview = modal.querySelector('#photo-preview');
    const capturedImage = modal.querySelector('#captured-image');
    
    capturedImage.src = imageData;
    preview.style.display = 'block';
    modal.querySelector('#camera-preview').style.display = 'none';
    
    // Stocker temporairement
    this.currentPhoto = imageData;
  }

  async switchCamera(video, currentStream) {
    try {
      currentStream.getTracks().forEach(track => track.stop());
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user' // Caméra frontale
        }
      });
      
      video.srcObject = newStream;
    } catch (error) {
      console.error('Erreur changement caméra:', error);
    }
  }

  savePhoto(modal) {
    if (this.currentPhoto) {
      const photoData = {
        id: Date.now(),
        type: 'photo',
        data: this.currentPhoto,
        timestamp: new Date().toISOString(),
        location: this.getCurrentLocation()
      };
      
      this.mediaFiles.push(photoData);
      this.displayMediaFile(photoData);
      
      // Fermer le modal
      modal.querySelector('.close-btn').click();
      
      this.showSuccess('Photo sauvegardée avec succès');
    }
  }

  // Enregistrement audio
  async toggleAudioRecording() {
    if (this.isRecording) {
      this.stopAudioRecording();
    } else {
      await this.startAudioRecording();
    }
  }

  async startAudioRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioRecorder = new MediaRecorder(stream);
      const audioChunks = [];
      
      this.audioRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      this.audioRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        this.saveAudioRecording(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      this.audioRecorder.start();
      this.isRecording = true;
      
      this.updateRecordingUI(true);
      
    } catch (error) {
      console.error('Erreur enregistrement audio:', error);
      this.showError('Impossible d\'accéder au microphone');
    }
  }

  stopAudioRecording() {
    if (this.audioRecorder && this.isRecording) {
      this.audioRecorder.stop();
      this.isRecording = false;
      this.updateRecordingUI(false);
    }
  }

  updateRecordingUI(isRecording) {
    const recordBtn = document.getElementById('record-audio-btn');
    if (recordBtn) {
      if (isRecording) {
        recordBtn.innerHTML = '<i class="bi bi-stop-circle"></i> Arrêter';
        recordBtn.className = 'btn btn-danger';
        recordBtn.style.animation = 'pulse 1s infinite';
      } else {
        recordBtn.innerHTML = '<i class="bi bi-mic"></i> Enregistrer';
        recordBtn.className = 'btn btn-primary';
        recordBtn.style.animation = 'none';
      }
    }
  }

  saveAudioRecording(audioBlob) {
    const reader = new FileReader();
    reader.onload = () => {
      const audioData = {
        id: Date.now(),
        type: 'audio',
        data: reader.result,
        timestamp: new Date().toISOString(),
        location: this.getCurrentLocation(),
        duration: this.getAudioDuration(audioBlob)
      };
      
      this.mediaFiles.push(audioData);
      this.displayMediaFile(audioData);
      
      this.showSuccess('Enregistrement audio sauvegardé');
    };
    reader.readAsDataURL(audioBlob);
  }

  getAudioDuration(audioBlob) {
    // Estimation basique de la durée
    return Math.round(audioBlob.size / 16000); // Approximation
  }

  // Signatures électroniques
  showSignatureModal() {
    const modal = document.createElement('div');
    modal.className = 'signature-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h5>✍️ Signature Électronique</h5>
            <button class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <canvas id="signature-canvas" width="400" height="200"></canvas>
            <div class="signature-actions">
              <button id="clear-signature-btn" class="btn btn-warning">Effacer</button>
              <button id="save-signature-btn" class="btn btn-success">Sauvegarder</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Styles CSS
    const style = document.createElement('style');
    style.textContent = `
      .signature-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
      }
      #signature-canvas {
        border: 2px solid #dee2e6;
        border-radius: 10px;
        cursor: crosshair;
        background: white;
      }
      .signature-actions {
        margin-top: 15px;
        display: flex;
        gap: 10px;
        justify-content: center;
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(modal);
    
    // Initialiser le canvas de signature
    this.initializeSignatureCanvas(modal);
    
    // Événements
    const closeBtn = modal.querySelector('.close-btn');
    const clearBtn = modal.querySelector('#clear-signature-btn');
    const saveBtn = modal.querySelector('#save-signature-btn');

    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    clearBtn.addEventListener('click', () => {
      this.clearSignature();
    });

    saveBtn.addEventListener('click', () => {
      this.saveSignature(modal);
    });
  }

  initializeSignatureCanvas(modal) {
    const canvas = modal.querySelector('#signature-canvas');
    this.signatureCanvas = canvas;
    const context = canvas.getContext('2d');
    
    let isDrawing = false;
    
    canvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      context.beginPath();
      context.moveTo(x, y);
    });
    
    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      context.lineTo(x, y);
      context.stroke();
    });
    
    canvas.addEventListener('mouseup', () => {
      isDrawing = false;
    });
    
    // Support tactile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      context.beginPath();
      context.moveTo(x, y);
    });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!isDrawing) return;
      
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      context.lineTo(x, y);
      context.stroke();
    });
    
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      isDrawing = false;
    });
    
    // Configuration du style
    context.strokeStyle = '#000';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }

  clearSignature() {
    if (this.signatureCanvas) {
      const context = this.signatureCanvas.getContext('2d');
      context.clearRect(0, 0, this.signatureCanvas.width, this.signatureCanvas.height);
    }
  }

  saveSignature(modal) {
    if (this.signatureCanvas) {
      const signatureData = this.signatureCanvas.toDataURL('image/png');
      
      const signature = {
        id: Date.now(),
        type: 'signature',
        data: signatureData,
        timestamp: new Date().toISOString(),
        location: this.getCurrentLocation()
      };
      
      this.mediaFiles.push(signature);
      this.displayMediaFile(signature);
      
      // Fermer le modal
      modal.querySelector('.close-btn').click();
      
      this.showSuccess('Signature sauvegardée');
    }
  }

  // Formulaires dynamiques
  createDynamicForm(formConfig) {
    const formContainer = document.getElementById('dynamic-form-container');
    if (!formContainer) return;

    formContainer.innerHTML = '';

    for (const field of formConfig.fields) {
      const fieldElement = this.createFormField(field);
      formContainer.appendChild(fieldElement);
    }

    // Bouton de soumission
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary mt-3';
    submitBtn.textContent = 'Sauvegarder le formulaire';
    submitBtn.addEventListener('click', () => this.submitForm());
    formContainer.appendChild(submitBtn);
  }

  createFormField(field) {
    const div = document.createElement('div');
    div.className = 'form-group mb-3';

    const label = document.createElement('label');
    label.textContent = field.label;
    label.className = 'form-label';
    if (field.required) label.innerHTML += ' <span class="text-danger">*</span>';

    let input;
    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
        input = document.createElement('input');
        input.type = field.type;
        input.className = 'form-control dynamic-form-input';
        break;
      case 'textarea':
        input = document.createElement('textarea');
        input.className = 'form-control dynamic-form-input';
        input.rows = 3;
        break;
      case 'select':
        input = document.createElement('select');
        input.className = 'form-select dynamic-form-input';
        for (const option of field.options) {
          const optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.label;
          input.appendChild(optionElement);
        }
        break;
      case 'checkbox':
        input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'form-check-input dynamic-form-input';
        break;
      case 'radio':
        input = document.createElement('div');
        for (const option of field.options) {
          const radioDiv = document.createElement('div');
          radioDiv.className = 'form-check';
          const radioInput = document.createElement('input');
          radioInput.type = 'radio';
          radioInput.name = field.name;
          radioInput.value = option.value;
          radioInput.className = 'form-check-input dynamic-form-input';
          const radioLabel = document.createElement('label');
          radioLabel.className = 'form-check-label';
          radioLabel.textContent = option.label;
          radioDiv.appendChild(radioInput);
          radioDiv.appendChild(radioLabel);
          input.appendChild(radioDiv);
        }
        break;
    }

    if (input && field.type !== 'radio') {
      input.name = field.name;
      input.required = field.required;
      input.placeholder = field.placeholder;
    }

    div.appendChild(label);
    div.appendChild(input);

    return div;
  }

  updateFormData(input) {
    const name = input.name;
    const value = input.type === 'checkbox' ? input.checked : input.value;
    this.formData[name] = value;
  }

  submitForm() {
    const formData = {
      id: Date.now(),
      type: 'form',
      data: this.formData,
      timestamp: new Date().toISOString(),
      location: this.getCurrentLocation()
    };

    this.mediaFiles.push(formData);
    this.displayMediaFile(formData);
    
    this.showSuccess('Formulaire sauvegardé');
  }

  // Affichage des fichiers média
  displayMediaFile(mediaFile) {
    const container = document.getElementById('media-files-container');
    if (!container) return;

    const mediaElement = document.createElement('div');
    mediaElement.className = 'media-file-item';
    mediaElement.dataset.id = mediaFile.id;

    let content = '';
    switch (mediaFile.type) {
      case 'photo':
        content = `
          <div class="media-preview">
            <img src="${mediaFile.data}" class="img-thumbnail" style="max-width: 100px; max-height: 100px;">
            <div class="media-info">
              <small class="text-muted">📸 Photo</small>
              <small class="text-muted d-block">${new Date(mediaFile.timestamp).toLocaleString()}</small>
            </div>
          </div>
        `;
        break;
      case 'audio':
        content = `
          <div class="media-preview">
            <audio controls class="audio-player">
              <source src="${mediaFile.data}" type="audio/wav">
            </audio>
            <div class="media-info">
              <small class="text-muted">🎵 Audio (${mediaFile.duration}s)</small>
              <small class="text-muted d-block">${new Date(mediaFile.timestamp).toLocaleString()}</small>
            </div>
          </div>
        `;
        break;
      case 'signature':
        content = `
          <div class="media-preview">
            <img src="${mediaFile.data}" class="img-thumbnail" style="max-width: 100px; max-height: 50px;">
            <div class="media-info">
              <small class="text-muted">✍️ Signature</small>
              <small class="text-muted d-block">${new Date(mediaFile.timestamp).toLocaleString()}</small>
            </div>
          </div>
        `;
        break;
      case 'form':
        content = `
          <div class="media-preview">
            <div class="form-summary">
              <small class="text-muted">📋 Formulaire</small>
              <small class="text-muted d-block">${new Date(mediaFile.timestamp).toLocaleString()}</small>
              <div class="form-data-preview">
                ${Object.entries(mediaFile.data).map(([key, value]) => 
                  `<small class="d-block"><strong>${key}:</strong> ${value}</small>`
                ).join('')}
              </div>
            </div>
          </div>
        `;
        break;
    }

    mediaElement.innerHTML = `
      <div class="d-flex align-items-center justify-content-between">
        ${content}
        <button class="btn btn-sm btn-outline-danger" onclick="enrichedReports.removeMediaFile(${mediaFile.id})">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;

    container.appendChild(mediaElement);
  }

  removeMediaFile(id) {
    this.mediaFiles = this.mediaFiles.filter(file => file.id !== id);
    const element = document.querySelector(`[data-id="${id}"]`);
    if (element) {
      element.remove();
    }
  }

  // Utilitaires
  getCurrentLocation() {
    if (window.gpsTracker) {
      return window.gpsTracker.getCurrentPosition();
    }
    return null;
  }

  showSuccess(message) {
    // Utiliser le système de notifications existant
    if (window.notificationManager) {
      window.notificationManager.sendNotification('✅ Succès', {
        body: message,
        tag: 'success'
      });
    } else {
      alert(message);
    }
  }

  showError(message) {
    if (window.notificationManager) {
      window.notificationManager.sendNotification('❌ Erreur', {
        body: message,
        tag: 'error'
      });
    } else {
      alert(message);
    }
  }

  // Sauvegarde du rapport enrichi
  async saveEnrichedReport() {
    const report = {
      id: Date.now(),
      type: 'enriched_report',
      timestamp: new Date().toISOString(),
      location: this.getCurrentLocation(),
      mediaFiles: this.mediaFiles,
      formData: this.formData
    };

    try {
      // Sauvegarder en local
      if (window.offlineManager) {
        await window.offlineManager.saveOfflineData('reports', report);
      }

      // Envoyer au serveur si en ligne
      if (navigator.onLine) {
        const response = await fetch('/api/reports/enriched', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('jwt')}`
          },
          body: JSON.stringify(report)
        });

        if (response.ok) {
          this.showSuccess('Rapport enrichi sauvegardé avec succès');
          this.clearReport();
        } else {
          throw new Error('Erreur sauvegarde serveur');
        }
      } else {
        this.showSuccess('Rapport sauvegardé en local (synchronisation à la reconnexion)');
      }

    } catch (error) {
      console.error('Erreur sauvegarde rapport:', error);
      this.showError('Erreur lors de la sauvegarde du rapport');
    }
  }

  clearReport() {
    this.mediaFiles = [];
    this.formData = {};
    this.currentReport = null;
    
    const container = document.getElementById('media-files-container');
    if (container) {
      container.innerHTML = '';
    }
    
    const formContainer = document.getElementById('dynamic-form-container');
    if (formContainer) {
      formContainer.innerHTML = '';
    }
  }
}

// Initialiser le système de rapports enrichis
window.enrichedReports = new EnrichedReports();

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnrichedReports;
}
