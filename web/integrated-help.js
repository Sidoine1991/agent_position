/**
 * Système de formation et documentation intégrée pour l'application CCRB
 * Fournit de l'aide contextuelle, des tutoriels et de la documentation
 */

class IntegratedHelp {
  constructor() {
    this.currentPage = null;
    this.userRole = null;
    this.helpContent = {};
    this.tutorials = [];
    this.faqs = [];
    this.userProgress = {};
    
    this.init();
  }

  async init() {
    await this.loadHelpContent();
    await this.loadUserProgress();
    this.setupEventListeners();
    this.initializeHelpSystem();
  }

  async loadHelpContent() {
    try {
      // Charger le contenu d'aide depuis l'API
      const response = await fetch('/api/help/content');
      if (response.ok) {
        const data = await response.json();
        this.helpContent = data.content || {};
        this.tutorials = data.tutorials || [];
        this.faqs = data.faqs || [];
      } else {
        // Contenu d'aide par défaut
        this.loadDefaultHelpContent();
      }
    } catch (error) {
      console.warn('Impossible de charger le contenu d\'aide, utilisation du contenu par défaut');
      this.loadDefaultHelpContent();
    }
  }

  loadDefaultHelpContent() {
    this.helpContent = {
      'index.html': {
        title: 'Page d\'Accueil',
        description: 'Tableau de bord principal avec vue d\'ensemble des activités',
        tips: [
          'Utilisez le calendrier pour voir votre historique de présence',
          'Les couleurs indiquent votre statut : vert (présent), rouge (absent), orange (hors zone)',
          'Cliquez sur une date pour voir les détails de votre présence'
        ],
        shortcuts: [
          { key: 'Ctrl + P', action: 'Marquer sa présence' },
          { key: 'Ctrl + M', action: 'Voir les missions' },
          { key: 'Ctrl + C', action: 'Voir le calendrier' }
        ]
      },
      'planning.html': {
        title: 'Planification',
        description: 'Gérez votre planning et vos missions',
        tips: [
          'Sélectionnez une semaine pour voir votre planning',
          'Utilisez les filtres pour afficher des agents ou projets spécifiques',
          'Cliquez sur une mission pour voir les détails'
        ],
        shortcuts: [
          { key: 'Ctrl + N', action: 'Nouvelle planification' },
          { key: 'Ctrl + F', action: 'Filtrer les données' },
          { key: 'Ctrl + S', action: 'Sauvegarder les modifications' }
        ]
      },
      'reports.html': {
        title: 'Rapports',
        description: 'Générez et consultez les rapports d\'activité',
        tips: [
          'Utilisez les filtres pour personnaliser vos rapports',
          'Exportez vos rapports en PDF pour les partager',
          'Les graphiques montrent l\'évolution de vos performances'
        ],
        shortcuts: [
          { key: 'Ctrl + G', action: 'Générer un rapport' },
          { key: 'Ctrl + E', action: 'Exporter en PDF' },
          { key: 'Ctrl + R', action: 'Actualiser les données' }
        ]
      }
    };

    this.tutorials = [
      {
        id: 1,
        title: 'Premiers pas avec l\'application',
        description: 'Apprenez les bases de l\'application CCRB',
        duration: '5 minutes',
        difficulty: 'Débutant',
        steps: [
          {
            title: 'Connexion',
            content: 'Connectez-vous avec vos identifiants fournis par votre superviseur',
            image: '/help/images/login.png'
          },
          {
            title: 'Marquer sa présence',
            content: 'Cliquez sur le bouton "Marquer ma présence" et confirmez votre localisation',
            image: '/help/images/presence.png'
          },
          {
            title: 'Consulter ses missions',
            content: 'Accédez à l\'onglet "Missions" pour voir vos tâches assignées',
            image: '/help/images/missions.png'
          }
        ]
      },
      {
        id: 2,
        title: 'Utilisation du GPS et géolocalisation',
        description: 'Maîtrisez les fonctionnalités de géolocalisation',
        duration: '8 minutes',
        difficulty: 'Intermédiaire',
        steps: [
          {
            title: 'Activer le GPS',
            content: 'Autorisez l\'accès à votre localisation dans les paramètres du navigateur',
            image: '/help/images/gps-activation.png'
          },
          {
            title: 'Vérifier la précision',
            content: 'Assurez-vous que votre position est précise avant de marquer votre présence',
            image: '/help/images/gps-accuracy.png'
          },
          {
            title: 'Gérer les zones',
            content: 'Comprenez les zones autorisées et les alertes de sortie de zone',
            image: '/help/images/zones.png'
          }
        ]
      },
      {
        id: 3,
        title: 'Création de rapports enrichis',
        description: 'Créez des rapports détaillés avec photos et audio',
        duration: '12 minutes',
        difficulty: 'Avancé',
        steps: [
          {
            title: 'Accéder aux rapports enrichis',
            content: 'Naviguez vers la page "Rapports Enrichis" depuis le menu principal',
            image: '/help/images/enriched-reports.png'
          },
          {
            title: 'Capturer des photos',
            content: 'Utilisez le bouton "Photo" pour prendre des photos de vos activités',
            image: '/help/images/photo-capture.png'
          },
          {
            title: 'Enregistrer de l\'audio',
            content: 'Cliquez sur "Audio" pour enregistrer des commentaires vocaux',
            image: '/help/images/audio-recording.png'
          },
          {
            title: 'Ajouter une signature',
            content: 'Utilisez la fonction signature pour valider vos rapports',
            image: '/help/images/signature.png'
          }
        ]
      }
    ];

    this.faqs = [
      {
        id: 1,
        question: 'Comment marquer ma présence ?',
        answer: 'Cliquez sur le bouton "Marquer ma présence" sur la page d\'accueil. Assurez-vous que votre GPS est activé et que vous êtes dans une zone autorisée.',
        category: 'Présence',
        tags: ['présence', 'GPS', 'localisation']
      },
      {
        id: 2,
        question: 'Que faire si je ne peux pas me connecter ?',
        answer: 'Vérifiez votre connexion internet et vos identifiants. Si le problème persiste, contactez votre superviseur ou l\'administrateur système.',
        category: 'Connexion',
        tags: ['connexion', 'problème', 'dépannage']
      },
      {
        id: 3,
        question: 'Comment voir mes missions ?',
        answer: 'Accédez à l\'onglet "Missions" ou "Planification" pour voir vos tâches assignées. Vous pouvez filtrer par date, projet ou statut.',
        category: 'Missions',
        tags: ['missions', 'planification', 'tâches']
      },
      {
        id: 4,
        question: 'Que signifie la couleur orange sur le calendrier ?',
        answer: 'La couleur orange indique que vous avez marqué votre présence mais que vous étiez hors de la zone autorisée. Cela peut affecter votre évaluation.',
        category: 'Calendrier',
        tags: ['calendrier', 'couleurs', 'zones']
      },
      {
        id: 5,
        question: 'Comment utiliser le mode hors-ligne ?',
        answer: 'L\'application fonctionne automatiquement en mode hors-ligne. Vos données sont synchronisées dès que vous retrouvez une connexion internet.',
        category: 'Hors-ligne',
        tags: ['hors-ligne', 'synchronisation', 'données']
      }
    ];
  }

  async loadUserProgress() {
    try {
      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      const progressData = localStorage.getItem(`help_progress_${userProfile.id}`);
      if (progressData) {
        this.userProgress = JSON.parse(progressData);
      } else {
        this.userProgress = {
          completedTutorials: [],
          viewedHelp: [],
          lastHelpView: null,
          helpRating: null
        };
      }
    } catch (error) {
      console.error('Erreur chargement progression aide:', error);
      this.userProgress = {
        completedTutorials: [],
        viewedHelp: [],
        lastHelpView: null,
        helpRating: null
      };
    }
  }

  setupEventListeners() {
    // Détecter les changements de page
    window.addEventListener('popstate', () => {
      this.updateCurrentPage();
    });

    // Écouter les clics sur les éléments d'aide
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('help-trigger')) {
        this.showContextualHelp(e.target.dataset.helpId);
      }
    });

    // Écouter les raccourcis clavier
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        this.toggleHelpPanel();
      }
    });
  }

  initializeHelpSystem() {
    this.updateCurrentPage();
    this.createHelpButton();
    this.createHelpPanel();
    this.showWelcomeMessage();
  }

  updateCurrentPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    this.currentPage = page;
    
    // Mettre à jour le contenu d'aide contextuel
    this.updateContextualHelp();
  }

  createHelpButton() {
    const helpButton = document.createElement('button');
    helpButton.id = 'help-button';
    helpButton.className = 'help-button';
    helpButton.innerHTML = '❓';
    helpButton.title = 'Aide (Ctrl+H)';
    
    helpButton.addEventListener('click', () => {
      this.toggleHelpPanel();
    });

    document.body.appendChild(helpButton);

    // Styles CSS
    const style = document.createElement('style');
    style.textContent = `
      .help-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #007bff, #0056b3);
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
        z-index: 1000;
        transition: all 0.3s ease;
      }
      
      .help-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(0, 123, 255, 0.4);
      }
      
      .help-button.active {
        background: linear-gradient(135deg, #28a745, #1e7e34);
      }
    `;
    document.head.appendChild(style);
  }

  createHelpPanel() {
    const helpPanel = document.createElement('div');
    helpPanel.id = 'help-panel';
    helpPanel.className = 'help-panel';
    helpPanel.style.display = 'none';

    helpPanel.innerHTML = `
      <div class="help-panel-header">
        <h4>🆘 Centre d'Aide</h4>
        <button class="help-close-btn">&times;</button>
      </div>
      <div class="help-panel-content">
        <div class="help-tabs">
          <button class="help-tab active" data-tab="contextual">Aide Contextuelle</button>
          <button class="help-tab" data-tab="tutorials">Tutoriels</button>
          <button class="help-tab" data-tab="faq">FAQ</button>
          <button class="help-tab" data-tab="search">Recherche</button>
        </div>
        <div class="help-tab-content">
          <div id="contextual-help" class="help-tab-pane active">
            <!-- Contenu d'aide contextuelle -->
          </div>
          <div id="tutorials-help" class="help-tab-pane">
            <!-- Liste des tutoriels -->
          </div>
          <div id="faq-help" class="help-tab-pane">
            <!-- FAQ -->
          </div>
          <div id="search-help" class="help-tab-pane">
            <!-- Recherche -->
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(helpPanel);

    // Styles CSS
    const style = document.createElement('style');
    style.textContent = `
      .help-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 800px;
        max-height: 80vh;
        background: white;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 1001;
        overflow: hidden;
      }
      
      .help-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        background: linear-gradient(135deg, #007bff, #0056b3);
        color: white;
      }
      
      .help-close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
      }
      
      .help-panel-content {
        padding: 20px;
        max-height: 60vh;
        overflow-y: auto;
      }
      
      .help-tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        border-bottom: 2px solid #e9ecef;
      }
      
      .help-tab {
        padding: 10px 20px;
        border: none;
        background: none;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.3s ease;
      }
      
      .help-tab.active {
        border-bottom-color: #007bff;
        color: #007bff;
        font-weight: 600;
      }
      
      .help-tab-pane {
        display: none;
      }
      
      .help-tab-pane.active {
        display: block;
      }
      
      .help-item {
        background: #f8f9fa;
        border-radius: 10px;
        padding: 15px;
        margin-bottom: 15px;
        border-left: 4px solid #007bff;
      }
      
      .help-item h5 {
        margin: 0 0 10px 0;
        color: #333;
      }
      
      .help-item p {
        margin: 0;
        color: #666;
      }
      
      .help-shortcuts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
        margin-top: 15px;
      }
      
      .help-shortcut {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: #e9ecef;
        border-radius: 5px;
        font-size: 14px;
      }
      
      .help-shortcut-key {
        background: #007bff;
        color: white;
        padding: 2px 8px;
        border-radius: 3px;
        font-family: monospace;
      }
    `;
    document.head.appendChild(style);

    // Événements
    const closeBtn = helpPanel.querySelector('.help-close-btn');
    closeBtn.addEventListener('click', () => {
      this.hideHelpPanel();
    });

    const tabs = helpPanel.querySelectorAll('.help-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchHelpTab(tab.dataset.tab);
      });
    });
  }

  updateContextualHelp() {
    const contextualPane = document.getElementById('contextual-help');
    if (!contextualPane) return;

    const helpData = this.helpContent[this.currentPage];
    if (!helpData) {
      contextualPane.innerHTML = `
        <div class="help-item">
          <h5>Page non reconnue</h5>
          <p>Aucune aide spécifique disponible pour cette page.</p>
        </div>
      `;
      return;
    }

    contextualPane.innerHTML = `
      <div class="help-item">
        <h5>${helpData.title}</h5>
        <p>${helpData.description}</p>
      </div>
      
      ${helpData.tips ? `
        <div class="help-item">
          <h5>💡 Conseils</h5>
          <ul>
            ${helpData.tips.map(tip => `<li>${tip}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${helpData.shortcuts ? `
        <div class="help-item">
          <h5>⌨️ Raccourcis Clavier</h5>
          <div class="help-shortcuts">
            ${helpData.shortcuts.map(shortcut => `
              <div class="help-shortcut">
                <span>${shortcut.action}</span>
                <span class="help-shortcut-key">${shortcut.key}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // Marquer comme consulté
    this.markHelpAsViewed(this.currentPage);
  }

  switchHelpTab(tabName) {
    // Mettre à jour les onglets
    const tabs = document.querySelectorAll('.help-tab');
    tabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      }
    });

    // Mettre à jour le contenu
    const panes = document.querySelectorAll('.help-tab-pane');
    panes.forEach(pane => {
      pane.classList.remove('active');
    });

    const activePane = document.getElementById(`${tabName}-help`);
    if (activePane) {
      activePane.classList.add('active');
    }

    // Charger le contenu spécifique
    switch (tabName) {
      case 'tutorials':
        this.loadTutorialsContent();
        break;
      case 'faq':
        this.loadFAQContent();
        break;
      case 'search':
        this.loadSearchContent();
        break;
    }
  }

  loadTutorialsContent() {
    const tutorialsPane = document.getElementById('tutorials-help');
    if (!tutorialsPane) return;

    tutorialsPane.innerHTML = `
      <div class="tutorials-list">
        ${this.tutorials.map(tutorial => `
          <div class="tutorial-item">
            <div class="tutorial-header">
              <h5>${tutorial.title}</h5>
              <div class="tutorial-meta">
                <span class="tutorial-duration">⏱️ ${tutorial.duration}</span>
                <span class="tutorial-difficulty">📊 ${tutorial.difficulty}</span>
                ${this.userProgress.completedTutorials.includes(tutorial.id) ? 
                  '<span class="tutorial-completed">✅ Terminé</span>' : 
                  '<button class="btn btn-primary btn-sm start-tutorial" data-tutorial-id="${tutorial.id}">Commencer</button>'
                }
              </div>
            </div>
            <p>${tutorial.description}</p>
          </div>
        `).join('')}
      </div>
    `;

    // Événements pour les tutoriels
    const startButtons = tutorialsPane.querySelectorAll('.start-tutorial');
    startButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tutorialId = parseInt(btn.dataset.tutorialId);
        this.startTutorial(tutorialId);
      });
    });
  }

  loadFAQContent() {
    const faqPane = document.getElementById('faq-help');
    if (!faqPane) return;

    faqPane.innerHTML = `
      <div class="faq-list">
        ${this.faqs.map(faq => `
          <div class="faq-item">
            <div class="faq-question" data-faq-id="${faq.id}">
              <h5>${faq.question}</h5>
              <span class="faq-toggle">+</span>
            </div>
            <div class="faq-answer" style="display: none;">
              <p>${faq.answer}</p>
              <div class="faq-meta">
                <span class="faq-category">📁 ${faq.category}</span>
                <div class="faq-tags">
                  ${faq.tags.map(tag => `<span class="faq-tag">${tag}</span>`).join('')}
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Événements pour les FAQ
    const questions = faqPane.querySelectorAll('.faq-question');
    questions.forEach(question => {
      question.addEventListener('click', () => {
        const answer = question.nextElementSibling;
        const toggle = question.querySelector('.faq-toggle');
        
        if (answer.style.display === 'none') {
          answer.style.display = 'block';
          toggle.textContent = '-';
        } else {
          answer.style.display = 'none';
          toggle.textContent = '+';
        }
      });
    });
  }

  loadSearchContent() {
    const searchPane = document.getElementById('search-help');
    if (!searchPane) return;

    searchPane.innerHTML = `
      <div class="help-search">
        <div class="search-input-group">
          <input type="text" id="help-search-input" placeholder="Rechercher dans l'aide..." class="form-control">
          <button id="help-search-btn" class="btn btn-primary">Rechercher</button>
        </div>
        <div id="help-search-results" class="search-results">
          <p class="text-muted">Tapez votre recherche ci-dessus</p>
        </div>
      </div>
    `;

    // Événements de recherche
    const searchInput = searchPane.querySelector('#help-search-input');
    const searchBtn = searchPane.querySelector('#help-search-btn');
    const resultsDiv = searchPane.querySelector('#help-search-results');

    const performSearch = () => {
      const query = searchInput.value.toLowerCase().trim();
      if (!query) {
        resultsDiv.innerHTML = '<p class="text-muted">Tapez votre recherche ci-dessus</p>';
        return;
      }

      const results = this.searchHelpContent(query);
      if (results.length === 0) {
        resultsDiv.innerHTML = '<p class="text-muted">Aucun résultat trouvé</p>';
        return;
      }

      resultsDiv.innerHTML = results.map(result => `
        <div class="search-result-item">
          <h6>${result.title}</h6>
          <p>${result.content}</p>
          <small class="text-muted">${result.type} • ${result.source}</small>
        </div>
      `).join('');
    };

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });

    searchBtn.addEventListener('click', performSearch);
  }

  searchHelpContent(query) {
    const results = [];

    // Rechercher dans le contenu d'aide contextuelle
    for (const [page, content] of Object.entries(this.helpContent)) {
      if (content.title.toLowerCase().includes(query) || 
          content.description.toLowerCase().includes(query)) {
        results.push({
          title: content.title,
          content: content.description,
          type: 'Aide Contextuelle',
          source: page
        });
      }
    }

    // Rechercher dans les tutoriels
    this.tutorials.forEach(tutorial => {
      if (tutorial.title.toLowerCase().includes(query) || 
          tutorial.description.toLowerCase().includes(query)) {
        results.push({
          title: tutorial.title,
          content: tutorial.description,
          type: 'Tutoriel',
          source: `Tutoriel ${tutorial.id}`
        });
      }
    });

    // Rechercher dans les FAQ
    this.faqs.forEach(faq => {
      if (faq.question.toLowerCase().includes(query) || 
          faq.answer.toLowerCase().includes(query)) {
        results.push({
          title: faq.question,
          content: faq.answer,
          type: 'FAQ',
          source: faq.category
        });
      }
    });

    return results;
  }

  startTutorial(tutorialId) {
    const tutorial = this.tutorials.find(t => t.id === tutorialId);
    if (!tutorial) return;

    this.showTutorialModal(tutorial);
  }

  showTutorialModal(tutorial) {
    const modal = document.createElement('div');
    modal.className = 'tutorial-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h5>📚 ${tutorial.title}</h5>
            <button class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <div class="tutorial-progress">
              <div class="progress">
                <div class="progress-bar" style="width: 0%"></div>
              </div>
              <span class="progress-text">Étape 1 sur ${tutorial.steps.length}</span>
            </div>
            <div class="tutorial-content">
              <div class="tutorial-step">
                <!-- Le contenu de l'étape sera chargé ici -->
              </div>
            </div>
            <div class="tutorial-actions">
              <button class="btn btn-secondary" id="tutorial-prev">Précédent</button>
              <button class="btn btn-primary" id="tutorial-next">Suivant</button>
              <button class="btn btn-success" id="tutorial-complete" style="display: none;">Terminer</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let currentStep = 0;
    const totalSteps = tutorial.steps.length;

    const updateTutorialStep = () => {
      const step = tutorial.steps[currentStep];
      const stepContent = modal.querySelector('.tutorial-step');
      const progressBar = modal.querySelector('.progress-bar');
      const progressText = modal.querySelector('.progress-text');
      const prevBtn = modal.querySelector('#tutorial-prev');
      const nextBtn = modal.querySelector('#tutorial-next');
      const completeBtn = modal.querySelector('#tutorial-complete');

      stepContent.innerHTML = `
        <h6>${step.title}</h6>
        <p>${step.content}</p>
        ${step.image ? `<img src="${step.image}" alt="${step.title}" class="tutorial-image">` : ''}
      `;

      const progress = ((currentStep + 1) / totalSteps) * 100;
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `Étape ${currentStep + 1} sur ${totalSteps}`;

      prevBtn.style.display = currentStep === 0 ? 'none' : 'inline-block';
      nextBtn.style.display = currentStep === totalSteps - 1 ? 'none' : 'inline-block';
      completeBtn.style.display = currentStep === totalSteps - 1 ? 'inline-block' : 'none';
    };

    // Événements
    modal.querySelector('.close-btn').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.querySelector('#tutorial-prev').addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        updateTutorialStep();
      }
    });

    modal.querySelector('#tutorial-next').addEventListener('click', () => {
      if (currentStep < totalSteps - 1) {
        currentStep++;
        updateTutorialStep();
      }
    });

    modal.querySelector('#tutorial-complete').addEventListener('click', () => {
      this.completeTutorial(tutorial.id);
      document.body.removeChild(modal);
    });

    updateTutorialStep();
  }

  completeTutorial(tutorialId) {
    if (!this.userProgress.completedTutorials.includes(tutorialId)) {
      this.userProgress.completedTutorials.push(tutorialId);
      this.saveUserProgress();
      
      // Afficher une notification
      if (window.notificationManager) {
        window.notificationManager.sendNotification('🎓 Tutoriel Terminé!', {
          body: 'Félicitations! Vous avez terminé un tutoriel.',
          tag: 'tutorial-completed'
        });
      }
    }
  }

  showContextualHelp(helpId) {
    // Afficher l'aide contextuelle pour un élément spécifique
    console.log('Aide contextuelle pour:', helpId);
  }

  showWelcomeMessage() {
    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const lastHelpView = this.userProgress.lastHelpView;
    const now = new Date();
    
    // Afficher un message de bienvenue si c'est la première fois ou si ça fait plus de 7 jours
    if (!lastHelpView || (now - new Date(lastHelpView)) > 7 * 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        if (window.notificationManager) {
          window.notificationManager.sendNotification('👋 Bienvenue!', {
            body: 'Besoin d\'aide? Appuyez sur Ctrl+H ou cliquez sur le bouton d\'aide.',
            tag: 'welcome-help',
            requireInteraction: true
          });
        }
      }, 3000);
    }
  }

  toggleHelpPanel() {
    const helpPanel = document.getElementById('help-panel');
    const helpButton = document.getElementById('help-button');
    
    if (helpPanel.style.display === 'none') {
      this.showHelpPanel();
    } else {
      this.hideHelpPanel();
    }
  }

  showHelpPanel() {
    const helpPanel = document.getElementById('help-panel');
    const helpButton = document.getElementById('help-button');
    
    helpPanel.style.display = 'block';
    helpButton.classList.add('active');
    
    // Mettre à jour le contenu contextuel
    this.updateContextualHelp();
  }

  hideHelpPanel() {
    const helpPanel = document.getElementById('help-panel');
    const helpButton = document.getElementById('help-button');
    
    helpPanel.style.display = 'none';
    helpButton.classList.remove('active');
  }

  markHelpAsViewed(page) {
    if (!this.userProgress.viewedHelp.includes(page)) {
      this.userProgress.viewedHelp.push(page);
    }
    this.userProgress.lastHelpView = new Date().toISOString();
    this.saveUserProgress();
  }

  saveUserProgress() {
    try {
      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      localStorage.setItem(`help_progress_${userProfile.id}`, JSON.stringify(this.userProgress));
    } catch (error) {
      console.error('Erreur sauvegarde progression aide:', error);
    }
  }

  // Méthodes publiques
  getHelpContent() {
    return this.helpContent;
  }

  getTutorials() {
    return this.tutorials;
  }

  getFAQs() {
    return this.faqs;
  }

  getUserProgress() {
    return this.userProgress;
  }
}

// Initialiser le système d'aide intégrée
window.integratedHelp = new IntegratedHelp();

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IntegratedHelp;
}
