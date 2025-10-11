(function() {
  const apiBase = '/api';
  let activities = [];
  let projects = [];
  let currentDate = new Date().toISOString().split('T')[0];
  let currentActivityId = null;

  // Initialisation
  document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
  });

  function initializePage() {
    // Définir la date d'aujourd'hui par défaut
    document.getElementById('date-select').value = currentDate;
    
    // Charger les projets et les activités
    loadProjects();
    loadActivities();
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

    // Project filter
    document.getElementById('project-filter').addEventListener('change', () => {
      filterActivities();
    });

    // Status filter
    document.getElementById('status-filter').addEventListener('change', () => {
      filterActivities();
    });

    // Save observations
    document.getElementById('save-observations').addEventListener('click', () => {
      saveObservations();
    });
  }

  // Charger les projets
  async function loadProjects() {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/projects`, { headers });
      if (res.ok) {
        const data = await res.json();
        projects = data.items || [];
        updateProjectFilter();
      }
    } catch (error) {
      console.error('Erreur chargement projets:', error);
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
      const container = document.getElementById('activities-container');
      container.innerHTML = `
        <div class="text-center text-muted py-5">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Chargement...</span>
          </div>
          <div class="mt-2">Chargement des activités...</div>
        </div>
      `;

      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/planifications?from=${currentDate}&to=${currentDate}`, { headers });
      
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
      document.getElementById('activities-container').innerHTML = `
        <div class="alert alert-danger">
          <h6>Erreur de chargement</h6>
          <p>Impossible de charger les activités. Vérifiez votre connexion.</p>
        </div>
      `;
    }
  }

  // Afficher les activités
  function displayActivities() {
    const container = document.getElementById('activities-container');
    
    if (activities.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <h6>Aucune activité planifiée</h6>
          <p>Aucune activité n'est planifiée pour cette date. Consultez la page de planification pour ajouter des activités.</p>
        </div>
      `;
      return;
    }

    const filteredActivities = filterActivities();
    
    container.innerHTML = filteredActivities.map(activity => createActivityCard(activity)).join('');
  }

  // Créer une carte d'activité
  function createActivityCard(activity) {
    const projectName = activity.projects?.name || 'Projet non spécifié';
    const startTime = activity.planned_start_time || 'Non défini';
    const endTime = activity.planned_end_time || 'Non défini';
    const description = activity.description_activite || 'Aucune description';
    const resultat = activity.resultat_journee;
    const observations = activity.observations || '';

    const statusClass = getStatusClass(resultat);
    const statusText = getStatusText(resultat);

    return `
      <div class="card activity-card mb-3" data-activity-id="${activity.id}">
        <div class="card-body">
          <div class="row align-items-center">
            <div class="col-md-8">
              <div class="d-flex align-items-center gap-2 mb-2">
                <h6 class="card-title mb-0">${activity.date}</h6>
                <span class="badge project-badge bg-info">${projectName}</span>
                <span class="badge project-badge ${statusClass}">${statusText}</span>
              </div>
              <div class="mb-2">
                <small class="text-muted">Heures:</small>
                <strong>${startTime} - ${endTime}</strong>
              </div>
              <div class="mb-2">
                <small class="text-muted">Description:</small>
                <div class="small">${description}</div>
              </div>
              ${observations ? `
                <div class="mb-2">
                  <small class="text-muted">Observations:</small>
                  <div class="small text-muted">${observations}</div>
                </div>
              ` : ''}
            </div>
            <div class="col-md-4 text-center">
              <div class="mb-3">
                <small class="text-muted d-block mb-2">Statut d'exécution:</small>
                <div class="d-flex justify-content-center gap-2 flex-wrap">
                  ${createStatusButtons(activity.id, resultat)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Créer les boutons de statut
  function createStatusButtons(activityId, currentStatus) {
    const statuses = [
      { key: 'realise', label: 'Réalisé', icon: '✓' },
      { key: 'partiellement_realise', label: 'Partiellement', icon: '◐' },
      { key: 'non_realise', label: 'Non réalisé', icon: '✗' },
      { key: 'en_cours', label: 'En cours', icon: '⏳' }
    ];

    return statuses.map(status => {
      const isSelected = currentStatus === status.key;
      return `
        <div class="status-button status-${status.key.replace('_', '-')} ${isSelected ? 'selected' : ''}" 
             data-activity-id="${activityId}" 
             data-status="${status.key}"
             title="${status.label}">
          <div>
            <div style="font-size: 16px;">${status.icon}</div>
            <div style="font-size: 10px;">${status.label}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Gérer les clics sur les boutons de statut
  document.addEventListener('click', async (e) => {
    if (e.target.closest('.status-button')) {
      const button = e.target.closest('.status-button');
      const activityId = button.getAttribute('data-activity-id');
      const status = button.getAttribute('data-status');
      
      await updateActivityStatus(activityId, status);
    }
  });

  // Mettre à jour le statut d'une activité
  async function updateActivityStatus(activityId, status) {
    try {
      const activity = activities.find(a => a.id == activityId);
      if (!activity) return;

      const headers = await authHeaders();
      
      // Si le statut est "non_realise", ouvrir le modal pour les observations
      if (status === 'non_realise') {
        currentActivityId = activityId;
        document.getElementById('observations-text').value = activity.observations || '';
        const modal = new bootstrap.Modal(document.getElementById('observationsModal'));
        modal.show();
        return;
      }

      // Mettre à jour directement pour les autres statuts
      const res = await fetch(`${apiBase}/planifications/result`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          date: activity.date,
          resultat_journee: status,
          observations: activity.observations
        })
      });

      if (res.ok) {
        // Mettre à jour l'activité locale
        activity.resultat_journee = status;
        displayActivities();
        updateStatistics();
        showSuccessMessage('Statut mis à jour avec succès');
      } else {
        throw new Error('Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      showErrorMessage('Erreur lors de la mise à jour du statut');
    }
  }

  // Sauvegarder les observations
  async function saveObservations() {
    try {
      const observations = document.getElementById('observations-text').value;
      const activity = activities.find(a => a.id == currentActivityId);
      if (!activity) return;

      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/planifications/result`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          date: activity.date,
          resultat_journee: 'non_realise',
          observations: observations
        })
      });

      if (res.ok) {
        // Mettre à jour l'activité locale
        activity.resultat_journee = 'non_realise';
        activity.observations = observations;
        
        // Fermer le modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('observationsModal'));
        modal.hide();
        
        displayActivities();
        updateStatistics();
        showSuccessMessage('Observations enregistrées avec succès');
      } else {
        throw new Error('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur sauvegarde observations:', error);
      showErrorMessage('Erreur lors de la sauvegarde des observations');
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

    document.getElementById('count-realise').textContent = stats.realise;
    document.getElementById('count-partiellement').textContent = stats.partiellement_realise;
    document.getElementById('count-non-realise').textContent = stats.non_realise;
    document.getElementById('count-en-cours').textContent = stats.en_cours;
    document.getElementById('count-sans-resultat').textContent = stats.sans_resultat;
    document.getElementById('count-total').textContent = stats.total;
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
    document.getElementById('activities-container').innerHTML = `
      <div class="alert alert-warning">
        <h6>Session requise</h6>
        <p>Veuillez vous connecter pour accéder au suivi d'activité.</p>
        <a href="/index.html" class="btn btn-primary">Se connecter</a>
      </div>
    `;
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

})();
