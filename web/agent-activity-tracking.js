(function() {
  const apiBase = '/api';
  let activities = [];
  let projects = [];
  let agents = [];
  let currentDate = new Date().toISOString().split('T')[0];
  let currentActivityId = null;
  let isAdmin = false;
  let currentUserId = null;

  // Initialisation
  document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
  });

  function initializePage() {
    // Vérifier l'authentification d'abord
    const token = findToken();
    if (!token) {
      showAuthError();
      return;
    }
    
    // Définir la date d'aujourd'hui par défaut
    document.getElementById('date-select').value = currentDate;
    
    // Charger les données utilisateur et agents
    loadUserInfo();
  }

  function setupEventListeners() {
    // Date selector
    document.getElementById('date-select').addEventListener('change', (e) => {
      currentDate = e.target.value;
      loadActivities();
    });

    // Load activities button
    document.getElementById('load-activities').addEventListener('click', () => {
      loadActivities();
    });

    // Agent selector
    document.getElementById('agent-select').addEventListener('change', () => {
      loadActivities();
    });

    // Project filter
    document.getElementById('project-filter').addEventListener('change', () => {
      filterActivities();
    });

    // Status filter
    document.getElementById('status-filter').addEventListener('change', () => {
      filterActivities();
    });

    // Add activity row button
    document.getElementById('add-activity-row').addEventListener('click', () => {
      addNewActivityRow();
    });

    // Save all activities button
    document.getElementById('save-all-activities').addEventListener('click', () => {
      saveAllActivities();
    });

    // Download activity image button
    document.getElementById('download-activity-image').addEventListener('click', () => {
      downloadActivityImage();
    });

    // Track changes in table inputs
    document.addEventListener('change', (e) => {
      if (e.target.closest('#activities-table')) {
        const row = e.target.closest('tr[data-activity-id]');
        if (row && !row.classList.contains('activity-row-new')) {
          row.classList.remove('activity-row-saved');
          row.classList.add('activity-row-modified');
        }
      }
    });
  }

  // Charger les informations utilisateur et déterminer le rôle
  async function loadUserInfo() {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/profile`, { headers });
      if (res.ok) {
        const data = await res.json();
        const user = data.user;
        
        currentUserId = user.id;
        isAdmin = user.role === 'admin' || user.role === 'super_admin';
        
        // Afficher le nom de l'utilisateur
        displayUserName(user);
        
        console.log('Utilisateur:', user.email, 'Rôle:', user.role, 'Admin:', isAdmin);
        
        // Charger les agents si c'est un admin
        if (isAdmin) {
          await loadAgents();
          showAgentFilter();
        } else {
          hideAgentFilter();
        }
        
        // Charger le projet de l'agent
        await loadAgentProject(user);
        
        // Charger les activités
        loadActivities();
      } else {
        throw new Error('Erreur lors du chargement du profil');
      }
    } catch (error) {
      console.error('Erreur chargement info utilisateur:', error);
      showAuthError();
    }
  }

  // Charger la liste des agents (pour les admins)
  async function loadAgents() {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/users`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.users) {
          agents = data.users.filter(user => user.role === 'agent');
          populateAgentSelect();
        }
      }
    } catch (error) {
      console.error('Erreur chargement agents:', error);
    }
  }

  // Peupler le sélecteur d'agents
  function populateAgentSelect() {
    const agentSelect = document.getElementById('agent-select');
    agentSelect.innerHTML = '<option value="">Tous les agents</option>';
    
    agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.id;
      option.textContent = `${agent.first_name || ''} ${agent.last_name || ''} (${agent.email})`.trim();
      agentSelect.appendChild(option);
    });
  }

  // Afficher le filtre par agent
  function showAgentFilter() {
    const container = document.getElementById('agent-filter-container');
    if (container) {
      container.style.display = 'block';
    }
  }

  // Masquer le filtre par agent
  function hideAgentFilter() {
    const container = document.getElementById('agent-filter-container');
    if (container) {
      container.style.display = 'none';
    }
  }

  // Afficher le nom de l'utilisateur
  function displayUserName(user) {
    const displayElement = document.getElementById('user-display-name');
    if (displayElement) {
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      const name = user.name || '';
      
      let displayName = '';
      if (firstName && lastName) {
        displayName = `${firstName} ${lastName}`;
      } else if (name) {
        displayName = name;
      } else {
        displayName = user.email;
      }
      
      displayElement.textContent = displayName;
    }
  }

  // Charger le projet de l'agent depuis son profil
  async function loadAgentProject(user) {
    try {
      // Récupérer le projet de l'agent depuis son profil
      const agentProject = user.project_name || user.project || 'Projet non spécifié';
      
      // Créer une liste avec le projet de l'agent
      projects = [
        { id: 1, name: agentProject, status: 'active' },
        { id: 2, name: 'Projet Riz', status: 'active' },
        { id: 3, name: 'Projet Maïs', status: 'active' },
        { id: 4, name: 'Projet Formation', status: 'active' },
        { id: 5, name: 'Projet Suivi', status: 'active' }
      ];
      
      updateProjectFilter();
      console.log('Projet de l\'agent:', agentProject);
    } catch (error) {
      console.error('Erreur chargement projet agent:', error);
      // Utiliser des projets par défaut en cas d'erreur
      projects = [
        { id: 1, name: 'Projet Riz', status: 'active' },
        { id: 2, name: 'Projet Maïs', status: 'active' },
        { id: 3, name: 'Projet Formation', status: 'active' },
        { id: 4, name: 'Projet Suivi', status: 'active' }
      ];
      updateProjectFilter();
    }
  }

  function updateProjectFilter() {
    const select = document.getElementById('project-filter');
    select.innerHTML = '<option value="">Tous les projets</option>';
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      select.appendChild(option);
    });
  }

  // Charger les activités pour une date donnée
  async function loadActivities() {
    try {
      const tbody = document.getElementById('activities-tbody');
      if (!tbody) {
        console.error('Element activities-tbody not found');
        return;
      }
      
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted py-4">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Chargement des activités...
          </td>
        </tr>
      `;

      const headers = await authHeaders();
      
      // Construire l'URL avec le filtre par agent si applicable
      let url = `${apiBase}/planifications?from=${currentDate}&to=${currentDate}`;
      const selectedAgentId = document.getElementById('agent-select').value;
      
      if (isAdmin && selectedAgentId) {
        url += `&agent_id=${selectedAgentId}`;
      } else if (!isAdmin) {
        // Pour les agents non-admin, filtrer par leur propre ID
        url += `&agent_id=${currentUserId}`;
      }
      
      const res = await fetch(url, { headers });
      
      if (res.status === 401) {
        showAuthError();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        activities = data.items || [];
        displayActivities();
        updateStatistics();
      } else {
        throw new Error('Erreur lors du chargement des activités');
      }
    } catch (error) {
      console.error('Erreur chargement activités:', error);
      const tbody = document.getElementById('activities-tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-4">
              <div class="alert alert-danger mb-0">
          <h6>Erreur de chargement</h6>
                <p class="mb-0">Impossible de charger les activités. Vérifiez votre connexion.</p>
        </div>
            </td>
          </tr>
      `;
      }
    }
  }

  // Afficher les activités dans le tableau
  function displayActivities() {
    const tbody = document.getElementById('activities-tbody');
    
    if (activities.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted py-4">
            <div class="alert alert-info mb-0">
          <h6>Aucune activité planifiée</h6>
              <p class="mb-0">Aucune activité n'est planifiée pour cette date. Cliquez sur "Ajouter une activité" pour en créer une.</p>
        </div>
          </td>
        </tr>
      `;
      return;
    }

    const filteredActivities = filterActivities();
    
    tbody.innerHTML = filteredActivities.map(activity => createActivityRow(activity)).join('');
  }

  // Créer une ligne d'activité dans le tableau
  function createActivityRow(activity) {
    const projectName = activity.projects?.name || activity.project_name || '';
    const startTime = activity.planned_start_time || '';
    const endTime = activity.planned_end_time || '';
    const description = activity.description_activite || '';
    const resultat = activity.resultat_journee || '';
    const observations = activity.observations || '';

    return `
      <tr data-activity-id="${activity.id}" class="activity-row">
        <td>
          <input type="date" class="form-control" value="${activity.date}" data-field="date">
        </td>
        <td>
          <input type="time" class="form-control" value="${startTime}" data-field="planned_start_time">
        </td>
        <td>
          <input type="time" class="form-control" value="${endTime}" data-field="planned_end_time">
        </td>
        <td>
          <select class="form-control" data-field="project_name">
            <option value="">Sélectionner un projet</option>
            ${projects && projects.length > 0 ? projects.map(project => {
              const isSelected = activity.project_name === project.name || 
                                (activity.project_id == project.id) ||
                                (activity.isNew && project.id === 1); // Sélectionner le projet de l'agent par défaut pour les nouvelles activités
              return `<option value="${project.name}" ${isSelected ? 'selected' : ''}>${project.name}</option>`;
            }).join('') : ''}
            ${activity.project_name && !projects.some(p => p.name === activity.project_name) ? 
              `<option value="${activity.project_name}" selected>${activity.project_name}</option>` : ''}
          </select>
        </td>
        <td>
          <textarea class="form-control observations-textarea" data-field="description_activite" placeholder="Description de l'activité">${description}</textarea>
        </td>
        <td>
          <select class="form-control status-select" data-field="resultat_journee">
            <option value="">Non évalué</option>
            <option value="realise" ${resultat === 'realise' ? 'selected' : ''}>Réalisé</option>
            <option value="partiellement_realise" ${resultat === 'partiellement_realise' ? 'selected' : ''}>Partiellement réalisé</option>
            <option value="non_realise" ${resultat === 'non_realise' ? 'selected' : ''}>Non réalisé</option>
            <option value="en_cours" ${resultat === 'en_cours' ? 'selected' : ''}>En cours</option>
          </select>
        </td>
        <td>
          <textarea class="form-control observations-textarea" data-field="observations" placeholder="Observations et motifs...">${observations}</textarea>
        </td>
        <td>
          <div class="btn-group-vertical btn-group-sm">
            <button type="button" class="btn btn-success btn-sm" onclick="saveActivityRow(${activity.id})" title="Enregistrer">
              <i class="fas fa-save"></i>
            </button>
            <button type="button" class="btn btn-danger btn-sm" onclick="deleteActivityRow(${activity.id})" title="Supprimer">
              <i class="fas fa-trash"></i>
            </button>
              </div>
        </td>
      </tr>
    `;
  }

  // Ajouter une nouvelle ligne d'activité
  function addNewActivityRow() {
    const newActivity = {
      id: 'new_' + Date.now(),
      date: currentDate,
      planned_start_time: '',
      planned_end_time: '',
      project_name: projects[0]?.name || '', // Pré-remplir avec le projet de l'agent
      description_activite: '',
      resultat_journee: '',
      observations: '',
      isNew: true
    };
    
    activities.push(newActivity);
    displayActivities();
    
    // Marquer la ligne comme nouvelle
    const newRow = document.querySelector(`tr[data-activity-id="${newActivity.id}"]`);
    if (newRow) {
      newRow.classList.add('activity-row-new');
    }
  }

  // Sauvegarder une ligne d'activité
  async function saveActivityRow(activityId) {
    try {
      const row = document.querySelector(`tr[data-activity-id="${activityId}"]`);
      if (!row) return;

      const activityData = {};
      const inputs = row.querySelectorAll('input, select, textarea');
      
      inputs.forEach(input => {
        const field = input.getAttribute('data-field');
        if (field) {
          activityData[field] = input.value;
        }
      });

      const activity = activities.find(a => a.id == activityId);
      if (!activity) return;

      // Mettre à jour l'activité locale
      Object.assign(activity, activityData);

      const headers = await authHeaders();
      
      if (activity.isNew) {
        // Créer une nouvelle activité
        const res = await fetch(`${apiBase}/planifications`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...activityData,
            project_name: activityData.project_name || projects[0]?.name || 'Projet non spécifié'
          })
        });

        if (res.ok) {
          const result = await res.json();
          activity.id = result.data?.id || activityId;
          activity.isNew = false;
          row.setAttribute('data-activity-id', activity.id);
          row.classList.remove('activity-row-new');
          row.classList.add('activity-row-saved');
          showSuccessMessage('Activité créée avec succès');
        } else {
          throw new Error('Erreur lors de la création');
        }
      } else {
        // Mettre à jour une activité existante
      const res = await fetch(`${apiBase}/planifications/result`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            date: activityData.date,
            resultat_journee: activityData.resultat_journee,
            observations: activityData.observations
        })
      });

      if (res.ok) {
          row.classList.remove('activity-row-modified');
          row.classList.add('activity-row-saved');
          showSuccessMessage('Activité mise à jour avec succès');
      } else {
        throw new Error('Erreur lors de la mise à jour');
      }
      }
      
      updateStatistics();
    } catch (error) {
      console.error('Erreur sauvegarde activité:', error);
      showErrorMessage('Erreur lors de la sauvegarde');
    }
  }

  // Supprimer une ligne d'activité
  async function deleteActivityRow(activityId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette activité ?')) {
      return;
    }

    try {
      const activity = activities.find(a => a.id == activityId);
      if (!activity) return;

      if (!activity.isNew) {
        // Supprimer de la base de données
      const headers = await authHeaders();
        const res = await fetch(`${apiBase}/planifications/${activityId}`, {
          method: 'DELETE',
          headers
        });

        if (!res.ok) {
          throw new Error('Erreur lors de la suppression');
        }
      }

      // Supprimer de la liste locale
      activities = activities.filter(a => a.id != activityId);
        displayActivities();
        updateStatistics();
      showSuccessMessage('Activité supprimée avec succès');
    } catch (error) {
      console.error('Erreur suppression activité:', error);
      showErrorMessage('Erreur lors de la suppression');
    }
  }

  // Sauvegarder toutes les activités
  async function saveAllActivities() {
    const rows = document.querySelectorAll('tr[data-activity-id]');
    let savedCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      const activityId = row.getAttribute('data-activity-id');
      try {
        await saveActivityRow(activityId);
        savedCount++;
    } catch (error) {
        errorCount++;
      }
    }

    if (errorCount === 0) {
      showSuccessMessage(`${savedCount} activités sauvegardées avec succès`);
    } else {
      showErrorMessage(`${savedCount} sauvegardées, ${errorCount} erreurs`);
    }
  }



  // Filtrer les activités
  function filterActivities() {
    const projectFilter = document.getElementById('project-filter').value;
    const statusFilter = document.getElementById('status-filter').value;

    let filtered = activities;

    if (projectFilter) {
      filtered = filtered.filter(activity => activity.project_id == projectFilter);
    }

    if (statusFilter) {
      if (statusFilter === 'sans_resultat') {
        filtered = filtered.filter(activity => !activity.resultat_journee);
      } else {
        filtered = filtered.filter(activity => activity.resultat_journee === statusFilter);
      }
    }

    return filtered;
  }

  // Mettre à jour les statistiques
  function updateStatistics() {
    const stats = {
      realise: activities.filter(a => a.resultat_journee === 'realise').length,
      partiellement_realise: activities.filter(a => a.resultat_journee === 'partiellement_realise').length,
      non_realise: activities.filter(a => a.resultat_journee === 'non_realise').length,
      en_cours: activities.filter(a => a.resultat_journee === 'en_cours').length,
      sans_resultat: activities.filter(a => !a.resultat_journee).length,
      total: activities.length
    };

    // Mettre à jour les nombres
    document.getElementById('count-realise').textContent = stats.realise;
    document.getElementById('count-partiellement').textContent = stats.partiellement_realise;
    document.getElementById('count-non-realise').textContent = stats.non_realise;
    document.getElementById('count-en-cours').textContent = stats.en_cours;
    document.getElementById('count-sans-resultat').textContent = stats.sans_resultat;
    document.getElementById('count-total').textContent = stats.total;

    // Calculer les pourcentages
    const total = stats.total || 1; // Éviter la division par zéro
    const percentages = {
      realise: Math.round((stats.realise / total) * 100),
      partiellement: Math.round((stats.partiellement_realise / total) * 100),
      non_realise: Math.round((stats.non_realise / total) * 100),
      en_cours: Math.round((stats.en_cours / total) * 100),
      sans_resultat: Math.round((stats.sans_resultat / total) * 100)
    };

    // Mettre à jour les pourcentages
    document.getElementById('percent-realise').textContent = percentages.realise + '%';
    document.getElementById('percent-partiellement').textContent = percentages.partiellement + '%';
    document.getElementById('percent-non-realise').textContent = percentages.non_realise + '%';
    document.getElementById('percent-en-cours').textContent = percentages.en_cours + '%';
    document.getElementById('percent-sans-resultat').textContent = percentages.sans_resultat + '%';

    // Calculer la progression globale (réalisé + partiellement réalisé)
    const completed = stats.realise + stats.partiellement_realise;
    const globalProgress = Math.round((completed / total) * 100);
    
    // Mettre à jour la barre de progression
    const progressBar = document.getElementById('global-progress-bar');
    const progressText = document.getElementById('global-progress-text');
    
    if (progressBar) {
      progressBar.style.width = globalProgress + '%';
      progressBar.setAttribute('aria-valuenow', globalProgress);
    }
    
    if (progressText) {
      progressText.textContent = globalProgress + '% complété';
    }

    // Mettre à jour la date actuelle
    const dateBadge = document.getElementById('current-date-badge');
    if (dateBadge) {
      const today = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      dateBadge.textContent = today;
    }
  }

  // Utilitaires
  function getStatusClass(status) {
    const classes = {
      'realise': 'bg-success',
      'partiellement_realise': 'bg-primary',
      'non_realise': 'bg-danger',
      'en_cours': 'bg-warning'
    };
    return classes[status] || 'bg-secondary';
  }

  function getStatusText(status) {
    const texts = {
      'realise': 'Réalisé',
      'partiellement_realise': 'Partiellement réalisé',
      'non_realise': 'Non réalisé',
      'en_cours': 'En cours'
    };
    return texts[status] || 'Sans statut';
  }

  function showSuccessMessage(message) {
    // Créer une notification de succès
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
    alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alert);
    
    // Supprimer automatiquement après 3 secondes
    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 3000);
  }

  function showErrorMessage(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show position-fixed';
    alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alert);
    
    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }

  function showAuthError() {
    const tbody = document.getElementById('activities-tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4">
            <div class="alert alert-warning mb-0">
        <h6>Session requise</h6>
              <p class="mb-2">Veuillez vous connecter pour accéder au suivi d'activité.</p>
              <a href="/index.html" class="btn btn-primary btn-sm">Se connecter</a>
      </div>
          </td>
        </tr>
    `;
    }
  }

  // Fonctions d'authentification (reprises de planning.js)
  function findToken() {
    const candidates = ['jwt','access_token','token','sb-access-token','sb:token'];
    for (const k of candidates) {
      const v = (localStorage.getItem(k) || '').trim();
      if (v && v.split('.').length >= 3) return v;
    }
    if (typeof window !== 'undefined' && typeof (window).jwt === 'string' && (window).jwt.split('.').length >= 3) {
      return (window).jwt;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const v = localStorage.getItem(key) || '';
      if (typeof v === 'string' && v.split('.').length >= 3 && v.length > 60) return v;
    }
    return '';
  }

  async function authHeaders() {
    const token = findToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
  }

  // Télécharger la page de suivi d'activité en image
  async function downloadActivityImage() {
    try {
      // Afficher un message de chargement
      const button = document.getElementById('download-activity-image');
      const originalText = button.innerHTML;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Génération...';
      button.disabled = true;

      // Attendre un peu pour que tous les éléments soient rendus
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capturer la zone principale (sans la navbar)
      const mainContent = document.querySelector('.container');
      
      // Forcer le rendu des éléments avant la capture
      const statsSection = mainContent.querySelector('.stats-horizontal');
      const tableSection = mainContent.querySelector('.table-editable');
      
      if (statsSection) {
        statsSection.style.transform = 'translateZ(0)';
        statsSection.style.willChange = 'transform';
      }
      
      if (tableSection) {
        tableSection.style.transform = 'translateZ(0)';
        tableSection.style.willChange = 'transform';
      }
      
      // Calculer les dimensions A3 (en pixels à 300 DPI)
      const A3_WIDTH = 3508; // Largeur A3 en pixels
      const A3_HEIGHT = 4961; // Hauteur A3 en pixels
      
      // Capturer tout le contenu avec dimensions A3
      const canvas = await html2canvas(mainContent, {
        backgroundColor: '#ffffff',
        scale: 2, // Scale réduit pour éviter les problèmes de mémoire
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        width: A3_WIDTH,
        height: A3_HEIGHT,
        logging: false,
        removeContainer: true,
        foreignObjectRendering: true,
        imageTimeout: 30000, // Timeout augmenté pour les grandes images
        onclone: function(clonedDoc) {
          // Améliorer la qualité des éléments clonés
          const clonedMain = clonedDoc.querySelector('.container');
          if (clonedMain) {
            // Forcer les dimensions A3
            clonedMain.style.width = A3_WIDTH + 'px';
            clonedMain.style.minHeight = A3_HEIGHT + 'px';
            clonedMain.style.overflow = 'visible';
            
            // Forcer le rendu des éléments flottants
            const statsSection = clonedMain.querySelector('.stats-horizontal');
            if (statsSection) {
              statsSection.style.position = 'relative';
              statsSection.style.zIndex = '10';
              statsSection.style.width = '100%';
            }
            
            // Améliorer la qualité du tableau
            const table = clonedMain.querySelector('.table-editable');
            if (table) {
              table.style.position = 'relative';
              table.style.zIndex = '10';
              table.style.backgroundColor = '#ffffff';
              table.style.width = '100%';
            }
            
            // Forcer le rendu des cartes
            const cards = clonedMain.querySelectorAll('.card');
            cards.forEach(card => {
              card.style.position = 'relative';
              card.style.zIndex = '5';
              card.style.backgroundColor = '#ffffff';
              card.style.width = '100%';
              card.style.marginBottom = '20px';
            });
            
            // Ajuster les colonnes pour le format A3
            const rows = clonedMain.querySelectorAll('.row');
            rows.forEach(row => {
              row.style.width = '100%';
              row.style.marginBottom = '15px';
            });
            
            // Ajuster le tableau pour qu'il s'étende sur toute la largeur
            const tableContainer = clonedMain.querySelector('.table-responsive');
            if (tableContainer) {
              tableContainer.style.width = '100%';
              tableContainer.style.overflow = 'visible';
            }
          }
        }
      });

      // Créer le lien de téléchargement
      const link = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      const filename = `suivi-activite-${today}.png`;
      
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      
      // Déclencher le téléchargement
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Restaurer le bouton
      button.innerHTML = originalText;
      button.disabled = false;

      showSuccessMessage('Image téléchargée avec succès');
    } catch (error) {
      console.error('Erreur téléchargement image:', error);
      showErrorMessage('Erreur lors du téléchargement de l\'image');
      
      // Restaurer le bouton en cas d'erreur
      const button = document.getElementById('download-activity-image');
      button.innerHTML = '<i class="fas fa-download"></i> Télécharger en image';
      button.disabled = false;
    }
  }

  // Fonctions globales pour les boutons du tableau
  window.saveActivityRow = saveActivityRow;
  window.deleteActivityRow = deleteActivityRow;

})();
