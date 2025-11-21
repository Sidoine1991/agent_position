(function() {
  const apiBase = '/api';
  let activities = [];
  let projects = [];
  let agents = [];
  let supervisors = [];
  let currentDate = new Date().toISOString().split('T')[0];
  let currentActivityId = null;
  let isAdmin = false;
  let currentUserId = null;
  let cachedActivityData = null; // Cache pour les données d'activités
  
  // Constantes pour l'authentification (déclarées au début)
  const DEFAULT_TOKEN_CANDIDATES = ['jwt', 'access_token', 'token', 'sb-access-token', 'sb:token'];

  // Initialisation
  document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
    // Charger automatiquement le suivi des activités au chargement
    setTimeout(() => {
      loadActivityFollowUp();
    }, 1000);
  });

  /**
   * Recharge les activités du tableau d'évaluation et met à jour le suivi
   */
  async function reloadActivitiesAndFollowUp() {
    try {
      await loadActivities();
      displayActivityFollowUp(activities);
    } catch (error) {
      console.error('Erreur lors du rechargement:', error);
    }
  }

  /**
   * Charge le tableau de suivi des activités par agent (utilise les mêmes données que le tableau d'évaluation)
   */
  async function loadActivityFollowUp() {
    const tbody = document.getElementById('activity-follow-up-body');
    
    if (!tbody) {
      console.warn('Element activity-follow-up-body not found');
      return;
    }
    
    // Afficher le chargement
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Chargement...</span>
          </div>
        </td>
      </tr>
    `;
    
    try {
      // Utiliser les mêmes données que le tableau d'évaluation
      // Si les activités ne sont pas encore chargées, les charger d'abord
      if (activities.length === 0) {
        await loadActivities();
      }
      
      // Attendre un peu pour s'assurer que les activités sont chargées
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Afficher les données dans le tableau de suivi
      displayActivityFollowUp(activities);
      
    } catch (error) {
      console.error('Erreur lors du chargement du suivi des activités:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-4">
            <div class="alert alert-danger">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              Erreur lors du chargement: ${escapeHtml(error.message)}
            </div>
          </td>
        </tr>
      `;
    }
  }

  /**
   * Affiche les données de suivi des activités dans le tableau (utilise les données du tableau d'évaluation)
   */
  function displayActivityFollowUp(rawActivities) {
    const tbody = document.getElementById('activity-follow-up-body');
    const projectFilter = document.getElementById('activity-project-filter');
    
    if (!tbody) return;
    
    if (!rawActivities || rawActivities.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-4">
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              Aucune donnée trouvée pour la période sélectionnée
            </div>
          </td>
        </tr>
      `;
      return;
    }
    
    // Grouper les activités par agent et calculer les statistiques
    const agentsStats = new Map();
    
    rawActivities.forEach(activity => {
      // Récupérer le nom de l'agent
      let agentName = 'Agent inconnu';
      let agentRole = 'agent';
      let projectName = activity.project_name || 'Non spécifié';
      
      // Si l'activité a des informations sur l'agent enrichies
      if (activity.agent) {
        agentName = activity.agent.name || `${activity.agent.first_name || ''} ${activity.agent.last_name || ''}`.trim() || activity.agent.email || `Agent ${activity.agent_id}`;
        agentRole = activity.agent.role || 'agent';
        projectName = activity.agent.project_name || activity.project_name || 'Non spécifié';
      } else if (activity.user_id || activity.agent_id) {
        // Chercher dans la liste des agents chargés
        const agent = agents.find(a => a.id === (activity.user_id || activity.agent_id));
        if (agent) {
          agentName = agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email;
          agentRole = agent.role || 'agent';
          projectName = agent.project_name || activity.project_name || 'Non spécifié';
        }
      }
      
      // Créer une clé unique pour l'agent (nom + projet)
      const agentKey = `${agentName}|${projectName}`;
      
      // Initialiser les stats pour cet agent si nécessaire
      if (!agentsStats.has(agentKey)) {
        agentsStats.set(agentKey, {
          agent_name: agentName,
          role: agentRole,
          project_name: projectName,
          total_activities: 0,
          realized_activities: 0,
          not_realized_activities: 0,
          in_progress_activities: 0,
          partially_realized_activities: 0,
          not_realized_list: []
        });
      }
      
      const stats = agentsStats.get(agentKey);
      stats.total_activities++;
      
      // Compter par statut selon la logique spécifiée
      const statut = activity.resultat_journee;
      
      if (statut === 'realise') {
        stats.realized_activities++;
      } else if (statut === 'non_realise') {
        stats.not_realized_activities++;
        // Ajouter à la liste des non réalisés
        stats.not_realized_list.push({
          name: activity.description_activite || 'Activité non spécifiée',
          date: activity.date || 'Date non spécifiée',
          project: activity.project_name || projectName,
          id: activity.id
        });
      } else if (statut === 'en_cours') {
        stats.in_progress_activities++;
      } else if (statut === 'partiellement_realise') {
        stats.partially_realized_activities++;
      } else {
        // Si pas de statut ou statut vide/null → automatiquement non réalisé
        stats.not_realized_activities++;
        // Ajouter à la liste des non réalisés
        stats.not_realized_list.push({
          name: activity.description_activite || 'Activité non spécifiée',
          date: activity.date || 'Date non spécifiée',
          project: activity.project_name || projectName,
          id: activity.id
        });
      }
    });
    
    // Extraire les projets uniques pour le filtre
    const uniqueProjects = [...new Set(Array.from(agentsStats.values()).map(a => a.project_name).filter(p => p))];
    updateProjectFilter(uniqueProjects);
    
    // Filtrer par projet si un filtre est sélectionné
    let filteredStats = Array.from(agentsStats.values());
    if (projectFilter && projectFilter.value) {
      filteredStats = filteredStats.filter(a => a.project_name === projectFilter.value);
    }
    
    if (filteredStats.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-4">
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              Aucune donnée trouvée pour le projet sélectionné
            </div>
          </td>
        </tr>
      `;
      return;
    }
    
    // Trier par nom d'agent
    filteredStats.sort((a, b) => a.agent_name.localeCompare(b.agent_name));
    
    const rows = filteredStats.map(stats => {
      // Calculer le taux d'exécution de la planification (TEP)
      const executionRate = calculateExecutionRate(stats.realized_activities, stats.total_activities);
      
      // Déterminer la classe de couleur pour le taux
      const executionRateClass = executionRate >= 80 ? 'text-success' : executionRate >= 60 ? 'text-warning' : 'text-danger';
      
      // Vérification de la cohérence des données
      const sumCategories = stats.realized_activities + stats.not_realized_activities + stats.in_progress_activities + stats.partially_realized_activities;
      const isConsistent = sumCategories === stats.total_activities;
      
      return `
        <tr class="${!isConsistent ? 'table-warning' : ''}">
          <td>
            <div class="d-flex align-items-center">
              <div class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 32px; height: 32px; font-size: 12px;">
                ${(stats.agent_name || 'Agent').charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="fw-semibold">${escapeHtml(stats.agent_name || 'N/A')}</div>
                <small class="text-muted">${escapeHtml(stats.role || 'N/A')}</small>
                ${!isConsistent ? '<br><small class="text-warning">⚠️ Incohérence</small>' : ''}
              </div>
            </div>
          </td>
          <td>
            <span class="badge bg-info">${escapeHtml(stats.project_name || 'N/A')}</span>
          </td>
          <td class="text-center">
            <span class="fw-bold text-primary">${stats.total_activities || 0}</span>
            ${!isConsistent ? `<br><small class="text-warning">Σ=${sumCategories}</small>` : ''}
          </td>
          <td class="text-center">
            <span class="fw-bold text-success">${stats.realized_activities || 0}</span>
          </td>
          <td class="text-center">
            <span class="fw-bold text-danger">${stats.not_realized_activities || 0}</span>
          </td>
          <td class="text-center">
            <span class="fw-bold text-warning">${stats.in_progress_activities || 0}</span>
          </td>
          <td class="text-center">
            <span class="fw-bold text-info">${stats.partially_realized_activities || 0}</span>
          </td>
          <td class="text-center">
            <span class="fw-bold ${executionRateClass}">${executionRate.toFixed(1)}%</span>
            <div class="progress mt-1" style="height: 4px;">
              <div class="progress-bar ${executionRate >= 80 ? 'bg-success' : executionRate >= 60 ? 'bg-warning' : 'bg-danger'}" 
                   style="width: ${executionRate}%"></div>
            </div>
          </td>
          <td>
            <div class="small">
              ${stats.not_realized_activities > 0 ? 
                `<div class="mb-2">
                  <strong class="text-danger">📋 Activités non réalisées (${stats.not_realized_activities}):</strong>
                  ${stats.not_realized_list.map(item => 
                    `<div class="mb-1 ms-2">
                      <div class="text-danger">• ${escapeHtml(item.name || 'N/A')}</div>
                      <div class="text-muted ms-2">📅 ${escapeHtml(item.date || 'N/A')} | 🏢 ${escapeHtml(item.project || 'N/A')}</div>
                    </div>`
                  ).join('')}
                </div>` : ''
              }
              ${stats.partially_realized_activities > 0 ? 
                `<div class="text-warning">
                  <strong>⚠️ ${stats.partially_realized_activities} activité(s) partiellement réalisée(s)</strong>
                </div>` : ''
              }
              ${stats.not_realized_activities === 0 && stats.partially_realized_activities === 0 ? 
                '<span class="text-success">✅ Toutes activités réalisées</span>' : ''
              }
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    tbody.innerHTML = rows;
    
    // Ajouter la barre d'outils d'export pour le tableau principal
    addExportToolbar('activity-follow-up-body', filteredStats.length);
    
    // Ajouter le tableau récapitulatif avec classement TEP
    displayTEPRanking(filteredStats);
  }

  /**
   * Ajoute une barre d'outils d'export pour un tableau
   */
  function addExportToolbar(tableId, statsCount) {
    const table = document.querySelector(`#${tableId}`).closest('table');
    if (!table) return;
    
    // Vérifier si la barre d'outils existe déjà
    const existingToolbar = table.parentNode.querySelector('.export-toolbar');
    if (existingToolbar) return;
    
    // Créer la barre d'outils
    const toolbar = document.createElement('div');
    toolbar.className = 'export-toolbar mb-2';
    toolbar.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div class="text-muted small">
          <i class="fas fa-info-circle me-1"></i>
          Tableau de suivi des activités - ${statsCount || 0} agents affichés
        </div>
        <div class="btn-group" role="group">
          <button type="button" class="btn btn-outline-primary btn-sm" onclick="exportMainTableHTML()" title="Exporter ce tableau en HTML">
            <i class="fas fa-file-export me-1"></i>Exporter HTML
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm" onclick="exportAllTablesHTML()" title="Exporter tous les tableaux">
            <i class="fas fa-file-code me-1"></i>Tout exporter
          </button>
        </div>
      </div>
    `;
    
    // Insérer avant le tableau
    table.parentNode.insertBefore(toolbar, table);
  }

  /**
   * Affiche le tableau récapitulatif avec classement par TEP décroissant
   */
  function displayTEPRanking(stats) {
    // Trier par TEP décroissant
    const sortedByTEP = [...stats].sort((a, b) => {
      const tepA = calculateExecutionRate(a.realized_activities, a.total_activities);
      const tepB = calculateExecutionRate(b.realized_activities, b.total_activities);
      return tepB - tepA; // Décroissant
    });
    
    // Créer le HTML du tableau récapitulatif
    const rankingHTML = `
      <div class="card mt-5 border-0 shadow-lg">
        <div class="card-header bg-dark text-white">
          <div class="row align-items-center">
            <div class="col-md-8">
              <h5 class="mb-0">
                <i class="fas fa-trophy me-2 text-warning"></i>Classement des agents par Taux d'Exécution de la Planification (TEP)
              </h5>
            </div>
            <div class="col-md-4 text-end">
              <div class="btn-group" role="group">
                <button type="button" class="btn btn-outline-light btn-sm" onclick="exportTEPRankingHTML()" title="Exporter ce tableau">
                  <i class="fas fa-file-export me-1"></i>HTML
                </button>
                <button type="button" class="btn btn-outline-light btn-sm" onclick="exportAllTablesHTML()" title="Exporter tous les tableaux">
                  <i class="fas fa-file-code me-1"></i>Tout
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="card-body p-0">
          <!-- Filtre par projet pour le classement -->
          <div class="p-3 bg-light border-bottom">
            <div class="row align-items-center">
              <div class="col-md-4">
                <label for="ranking-project-filter" class="form-label fw-semibold mb-1">
                  <i class="fas fa-filter me-1"></i>Filtrer par projet
                </label>
                <select id="ranking-project-filter" class="form-select form-select-sm">
                  <option value="">Tous les projets</option>
                  ${[...new Set(stats.map(s => s.project_name))].filter(p => p).map(project => 
                    `<option value="${escapeHtml(project)}">${escapeHtml(project)}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="col-md-8">
                <div class="d-flex align-items-center justify-content-end h-100">
                  <small class="text-muted me-3">
                    <i class="fas fa-info-circle me-1"></i>
                    TEP = (Activités entièrement réalisées / Total planifié) × 100
                  </small>
                  <span id="ranking-count" class="badge bg-primary">
                    ${stats.length} agents
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-dark">
                <tr>
                  <th class="text-center" style="width: 60px;">#</th>
                  <th>Agent</th>
                  <th class="text-center">Rôle</th>
                  <th class="text-center">Projet</th>
                  <th class="text-center">Total planifié</th>
                  <th class="text-center">Entièrement réalisé</th>
                  <th class="text-center">TEP (%)</th>
                  <th class="text-center">Performance</th>
                </tr>
              </thead>
              <tbody id="ranking-tbody">
                ${sortedByTEP.map((stats, index) => {
                  const tep = calculateExecutionRate(stats.realized_activities, stats.total_activities);
                  const rank = index + 1;
                  const rankClass = rank <= 3 ? 'text-warning fw-bold' : '';
                  const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
                  
                  // Déterminer la performance
                  let performanceBadge = '';
                  let performanceClass = '';
                  if (tep >= 90) {
                    performanceBadge = '<span class="badge bg-success">Excellent</span>';
                    performanceClass = 'table-success';
                  } else if (tep >= 75) {
                    performanceBadge = '<span class="badge bg-info">Bon</span>';
                    performanceClass = 'table-info';
                  } else if (tep >= 60) {
                    performanceBadge = '<span class="badge bg-warning">Moyen</span>';
                    performanceClass = 'table-warning';
                  } else if (tep >= 40) {
                    performanceBadge = '<span class="badge bg-danger">Faible</span>';
                    performanceClass = 'table-danger';
                  } else {
                    performanceBadge = '<span class="badge bg-secondary">Très faible</span>';
                    performanceClass = 'table-secondary';
                  }
                  
                  return `
                    <tr class="${performanceClass}" data-project="${escapeHtml(stats.project_name)}">
                      <td class="text-center">
                        <span class="${rankClass}">${rankIcon} ${rank}</span>
                      </td>
                      <td>
                        <div class="d-flex align-items-center">
                          <div class="avatar-sm bg-dark text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 28px; height: 28px; font-size: 10px;">
                            ${(stats.agent_name || 'A').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div class="fw-semibold">${escapeHtml(stats.agent_name || 'N/A')}</div>
                          </div>
                        </div>
                      </td>
                      <td class="text-center">
                        <small class="badge bg-dark">${escapeHtml(stats.role || 'N/A')}</small>
                      </td>
                      <td class="text-center">
                        <small class="badge bg-secondary">${escapeHtml(stats.project_name || 'N/A')}</small>
                      </td>
                      <td class="text-center">
                        <span class="fw-bold text-primary">${stats.total_activities || 0}</span>
                      </td>
                      <td class="text-center">
                        <span class="fw-bold text-success">${stats.realized_activities || 0}</span>
                      </td>
                      <td class="text-center">
                        <span class="fw-bold ${tep >= 80 ? 'text-success' : tep >= 60 ? 'text-warning' : 'text-danger'}">${tep.toFixed(1)}%</span>
                        <div class="progress mt-1" style="height: 3px;">
                          <div class="progress-bar ${tep >= 80 ? 'bg-success' : tep >= 60 ? 'bg-warning' : 'bg-danger'}" 
                               style="width: ${tep}%"></div>
                        </div>
                      </td>
                      <td class="text-center">
                        ${performanceBadge}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card-footer bg-dark text-white py-2">
          <small class="mb-0">
            <i class="fas fa-chart-line me-1"></i>
            Classement automatique par performance décroissante | 
            <span id="ranking-summary">${stats.length} agents classés</span>
          </small>
        </div>
      </div>
    `;
    
    // Ajouter le tableau après le tableau principal
    const mainTable = document.querySelector('#activity-follow-up-body').closest('table');
    if (mainTable) {
      // Supprimer l'ancien tableau s'il existe
      const existingRanking = document.getElementById('tep-ranking-table');
      if (existingRanking) {
        existingRanking.remove();
      }
      
      // Créer un conteneur pour le tableau
      const rankingContainer = document.createElement('div');
      rankingContainer.id = 'tep-ranking-table';
      rankingContainer.innerHTML = rankingHTML;
      
      // Insérer après le tableau principal
      mainTable.parentNode.insertBefore(rankingContainer, mainTable.nextSibling);
      
      // Ajouter l'événement de filtrage pour le classement
      const rankingFilter = document.getElementById('ranking-project-filter');
      if (rankingFilter) {
        rankingFilter.addEventListener('change', () => {
          filterRankingTable(stats);
        });
      }
    }
  }

  /**
   * Filtre le tableau de classement par projet
   */
  function filterRankingTable(allStats) {
    const filter = document.getElementById('ranking-project-filter');
    const tbody = document.getElementById('ranking-tbody');
    const countBadge = document.getElementById('ranking-count');
    const summarySpan = document.getElementById('ranking-summary');
    
    if (!filter || !tbody) return;
    
    const selectedProject = filter.value;
    
    // Filtrer les stats
    const filteredStats = selectedProject ? 
      allStats.filter(s => s.project_name === selectedProject) : 
      allStats;
    
    // Retrier par TEP décroissant
    const sortedStats = [...filteredStats].sort((a, b) => {
      const tepA = calculateExecutionRate(a.realized_activities, a.total_activities);
      const tepB = calculateExecutionRate(b.realized_activities, b.total_activities);
      return tepB - tepA;
    });
    
    // Regénérer le tbody
    tbody.innerHTML = sortedStats.map((stats, index) => {
      const tep = calculateExecutionRate(stats.realized_activities, stats.total_activities);
      const rank = index + 1;
      const rankClass = rank <= 3 ? 'text-warning fw-bold' : '';
      const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
      
      // Déterminer la performance
      let performanceBadge = '';
      let performanceClass = '';
      if (tep >= 90) {
        performanceBadge = '<span class="badge bg-success">Excellent</span>';
        performanceClass = 'table-success';
      } else if (tep >= 75) {
        performanceBadge = '<span class="badge bg-info">Bon</span>';
        performanceClass = 'table-info';
      } else if (tep >= 60) {
        performanceBadge = '<span class="badge bg-warning">Moyen</span>';
        performanceClass = 'table-warning';
      } else if (tep >= 40) {
        performanceBadge = '<span class="badge bg-danger">Faible</span>';
        performanceClass = 'table-danger';
      } else {
        performanceBadge = '<span class="badge bg-secondary">Très faible</span>';
        performanceClass = 'table-secondary';
      }
      
      return `
        <tr class="${performanceClass}" data-project="${escapeHtml(stats.project_name)}">
          <td class="text-center">
            <span class="${rankClass}">${rankIcon} ${rank}</span>
          </td>
          <td>
            <div class="d-flex align-items-center">
              <div class="avatar-sm bg-dark text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 28px; height: 28px; font-size: 10px;">
                ${(stats.agent_name || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="fw-semibold">${escapeHtml(stats.agent_name || 'N/A')}</div>
              </div>
            </div>
          </td>
          <td class="text-center">
            <small class="badge bg-dark">${escapeHtml(stats.role || 'N/A')}</small>
          </td>
          <td class="text-center">
            <small class="badge bg-secondary">${escapeHtml(stats.project_name || 'N/A')}</small>
          </td>
          <td class="text-center">
            <span class="fw-bold text-primary">${stats.total_activities || 0}</span>
          </td>
          <td class="text-center">
            <span class="fw-bold text-success">${stats.realized_activities || 0}</span>
          </td>
          <td class="text-center">
            <span class="fw-bold ${tep >= 80 ? 'text-success' : tep >= 60 ? 'text-warning' : 'text-danger'}">${tep.toFixed(1)}%</span>
            <div class="progress mt-1" style="height: 3px;">
              <div class="progress-bar ${tep >= 80 ? 'bg-success' : tep >= 60 ? 'bg-warning' : 'bg-danger'}" 
                   style="width: ${tep}%"></div>
            </div>
          </td>
          <td class="text-center">
            ${performanceBadge}
          </td>
        </tr>
      `;
    }).join('');
    
    // Mettre à jour les compteurs
    if (countBadge) {
      countBadge.textContent = `${sortedStats.length} agents`;
    }
    if (summarySpan) {
      summarySpan.textContent = `${sortedStats.length} agents classés${selectedProject ? ` (projet: ${selectedProject})` : ''}`;
    }
  }

  /**
   * Exporte un tableau en HTML avec bonne résolution
   */
  function exportTableToHTML(tableElementOrSelector, title, filename) {
    try {
      console.log('Début export HTML pour:', title);
      
      let table;
      if (typeof tableElementOrSelector === 'string') {
        table = document.querySelector(tableElementOrSelector);
      } else {
        table = tableElementOrSelector;
      }
      
      if (!table) {
        console.error('Tableau non trouvé:', tableElementOrSelector);
        showErrorMessage('Tableau non trouvé');
        return;
      }
      
      console.log('Tableau trouvé, génération du HTML...');
      
      // Créer le contenu HTML
      const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        @media print {
            body { margin: 0.5cm; }
            .no-print { display: none !important; }
            .table { font-size: 12px; }
            .badge { font-size: 10px; }
        }
        @media screen {
            .container { max-width: 1400px; margin: 20px auto; }
            .table-responsive { max-height: 80vh; overflow-y: auto; }
        }
        .table th { background-color: #343a40; color: white; font-weight: bold; }
        .table td { vertical-align: middle; }
        .avatar-sm { width: 32px; height: 32px; font-size: 12px; }
        .progress { height: 4px; }
        .card { margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header-title { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 20px; 
            margin-bottom: 20px; 
            border-radius: 8px;
            text-align: center;
        }
        .footer-info { 
            background-color: #f8f9fa; 
            padding: 15px; 
            margin-top: 20px; 
            border-radius: 8px;
            font-size: 11px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-title">
            <h1><i class="fas fa-chart-line me-2"></i>${title}</h1>
            <p class="mb-0">Généré le ${new Date().toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}</p>
        </div>
        
        ${generateTableHTML(table, title)}
        
        <div class="footer-info">
            <div class="row">
                <div class="col-md-6">
                    <i class="fas fa-info-circle me-1"></i>
                    <strong>Source:</strong> Système de Suivi des Activités CCRB
                </div>
                <div class="col-md-6 text-end">
                    <i class="fas fa-calendar me-1"></i>
                    Période: ${getCurrentPeriod()}
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Auto-print option
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('print') === 'true') {
            window.onload = function() {
                setTimeout(() => window.print(), 500);
            };
        }
    </script>
</body>
</html>`;
      
      console.log('HTML généré, création du blob...');
      
      // Créer un blob et télécharger
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Export HTML réussi:', filename);
      showSuccessMessage(`Tableau "${title}" exporté avec succès`);
    } catch (error) {
      console.error('Erreur export HTML:', error);
      showErrorMessage('Erreur lors de l\'export HTML: ' + error.message);
    }
  }

  /**
   * Génère le HTML du tableau pour l'export
   */
  function generateTableHTML(tableElement, title) {
    try {
      console.log('Génération HTML du tableau:', title);
      
      let tableHTML = '';
      
      // Cloner le tableau pour le manipuler
      const clonedTable = tableElement.cloneNode(true);
      
      // Nettoyer et optimiser le tableau pour l'export
      const rows = clonedTable.querySelectorAll('tr');
      console.log('Nombre de lignes trouvées:', rows.length);
      
      rows.forEach(row => {
        // Supprimer les classes inutiles et les attributs d'événements
        row.removeAttribute('onclick');
        row.removeAttribute('onchange');
        
        // Nettoyer les cellules
        const cells = row.querySelectorAll('td, th');
        cells.forEach(cell => {
          // Supprimer les boutons et inputs
          const buttons = cell.querySelectorAll('button, input, select');
          buttons.forEach(btn => btn.remove());
          
          // Garder le texte important
          if (cell.textContent.trim() === '') {
            cell.innerHTML = '-';
          }
        });
      });
      
      // Créer la carte contenant le tableau
      tableHTML = `
      <div class="card">
        <div class="card-header bg-dark text-white">
          <h5 class="mb-0">${title}</h5>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            ${clonedTable.outerHTML}
          </div>
        </div>
      </div>
    `;
      
      console.log('HTML du tableau généré avec succès');
      return tableHTML;
    } catch (error) {
      console.error('Erreur dans generateTableHTML:', error);
      return `
      <div class="alert alert-danger">
        <h5>Erreur lors de la génération du tableau</h5>
        <p>Impossible de générer le HTML pour le tableau "${title}"</p>
        <p><strong>Erreur:</strong> ${error.message}</p>
      </div>
    `;
    }
  }

  /**
   * Obtient la période actuelle pour l'export
   */
  function getCurrentPeriod() {
    try {
      const monthSelect = document.getElementById('month-select');
      const yearSelect = document.getElementById('activity-year-selector');
      
      if (monthSelect && yearSelect) {
        const month = monthSelect.value;
        const year = yearSelect.value;
        if (month && year) {
          const date = new Date(year, month - 1);
          return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        }
      }
      
      return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    } catch (error) {
      console.error('Erreur dans getCurrentPeriod:', error);
      return 'Période inconnue';
    }
  }

  /**
   * Exporte le tableau principal de suivi des activités
   */
  function exportMainTableHTML() {
    // Trouver le tableau contenant activity-follow-up-body
    const followUpTable = document.querySelector('#activity-follow-up-body').closest('table');
    if (!followUpTable) {
      console.error('Tableau de suivi non trouvé');
      showErrorMessage('Tableau de suivi non trouvé');
      return;
    }
    
    exportTableToHTML(
      followUpTable,
      'Tableau de Suivi des Activités - Détail par Agent',
      `suivi-activites-detail-${new Date().toISOString().split('T')[0]}.html`
    );
  }

  /**
   * Exporte le tableau récapitulatif TEP
   */
  function exportTEPRankingHTML() {
    const rankingTable = document.getElementById('tep-ranking-table');
    if (!rankingTable) {
      showErrorMessage('Tableau de classement TEP non trouvé');
      return;
    }
    
    // Créer un HTML spécial pour le classement TEP
    const rankingContent = rankingTable.querySelector('table');
    exportTableToHTML(
      rankingContent,
      'Classement des Agents par Taux d\'Exécution de la Planification (TEP)',
      `classement-tep-${new Date().toISOString().split('T')[0]}.html`
    );
  }

  /**
   * Exporte tous les tableaux dans un seul fichier HTML
   */
  function exportAllTablesHTML() {
    try {
      const mainTable = document.querySelector('#activities-table');
      const rankingTable = document.getElementById('tep-ranking-table');
      
      if (!mainTable && !rankingTable) {
        showErrorMessage('Aucun tableau à exporter');
        return;
      }
      
      let allTablesHTML = '';
      
      // Ajouter le tableau principal
      if (mainTable) {
        allTablesHTML += generateTableHTML(mainTable, 'Tableau de Suivi des Activités - Détail par Agent');
      }
      
      // Ajouter le tableau de classement TEP
      if (rankingTable) {
        allTablesHTML += generateTableHTML(rankingTable.querySelector('table'), 'Classement des Agents par TEP');
      }
      
      // Créer le HTML complet
      const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport Complet de Suivi des Activités</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        @media print {
            body { margin: 0.5cm; }
            .no-print { display: none !important; }
            .table { font-size: 11px; page-break-inside: avoid; }
            .card { page-break-inside: avoid; margin-bottom: 20px; }
            .badge { font-size: 9px; }
        }
        @media screen {
            .container { max-width: 1400px; margin: 20px auto; }
        }
        .table th { background-color: #343a40; color: white; font-weight: bold; }
        .table td { vertical-align: middle; }
        .avatar-sm { width: 28px; height: 28px; font-size: 10px; }
        .progress { height: 3px; }
        .card { margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header-title { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            margin-bottom: 30px; 
            border-radius: 8px;
            text-align: center;
        }
        .section-title {
            background-color: #343a40;
            color: white;
            padding: 15px 20px;
            margin: 30px 0 20px 0;
            border-radius: 8px;
        }
        .footer-info { 
            background-color: #f8f9fa; 
            padding: 20px; 
            margin-top: 30px; 
            border-radius: 8px;
            font-size: 11px;
            color: #6c757d;
        }
        .page-break {
            page-break-before: always;
            height: 1px;
            margin: 0;
            padding: 0;
            border: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-title">
            <h1><i class="fas fa-chart-line me-2"></i>Rapport Complet de Suivi des Activités</h1>
            <p class="mb-0">CCRB - Système de Suivi des Activités</p>
            <p class="mb-0">Généré le ${new Date().toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}</p>
        </div>
        
        ${allTablesHTML}
        
        <div class="footer-info">
            <div class="row">
                <div class="col-md-4">
                    <i class="fas fa-info-circle me-1"></i>
                    <strong>Source:</strong> Système de Suivi CCRB
                </div>
                <div class="col-md-4 text-center">
                    <i class="fas fa-calendar me-1"></i>
                    Période: ${getCurrentPeriod()}
                </div>
                <div class="col-md-4 text-end">
                    <i class="fas fa-user me-1"></i>
                    Exporté par: ${document.getElementById('user-display-name')?.textContent || 'Utilisateur'}
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Auto-print option
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('print') === 'true') {
            window.onload = function() {
                setTimeout(() => window.print(), 500);
            };
        }
    </script>
</body>
</html>`;
      
      // Créer un blob et télécharger
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport-complet-suivi-activites-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showSuccessMessage('Rapport complet exporté avec succès');
    } catch (error) {
      console.error('Erreur export complet:', error);
      showErrorMessage('Erreur lors de l\'export du rapport complet');
    }
  }

  /**
   * Formate la liste des activités non réalisées
   */
  function formatActivityList(activities) {
    if (!activities || activities.length === 0) {
      return '<span class="text-muted">Aucune</span>';
    }
    
    const maxItems = 3; // Limiter l'affichage à 3 éléments
    const displayItems = activities.slice(0, maxItems);
    const remainingCount = activities.length - maxItems;
    
    const listHtml = displayItems.map(activity => {
      const activityName = activity.name || activity.title || activity.description || activity.description_activite || 'Activité sans nom';
      const activityDate = activity.date ? ` (${formatShortDate(activity.date)})` : '';
      return `<div class="small">• ${escapeHtml(activityName)}${activityDate}</div>`;
    }).join('');
    
    if (remainingCount > 0) {
      return `
        ${listHtml}
        <div class="small text-muted">... et ${remainingCount} autre(s) activité(s)</div>
      `;
    }
    
    return listHtml;
  }

  /**
   * Formate une date courte
   */
  function formatShortDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch (e) {
      return dateStr;
    }
  }

  /**
   * Échappe le HTML pour éviter les injections XSS
   */
  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Rendre les fonctions globales pour pouvoir les appeler depuis le HTML
  window.loadActivityFollowUp = loadActivityFollowUp;
  window.reloadActivitiesAndFollowUp = reloadActivitiesAndFollowUp;
  window.displayActivityFollowUp = displayActivityFollowUp;
  window.calculateExecutionRate = calculateExecutionRate;
  window.formatActivityList = formatActivityList;
  window.formatShortDate = formatShortDate;
  window.escapeHtml = escapeHtml;
  window.exportMainTableHTML = exportMainTableHTML;
  window.exportTEPRankingHTML = exportTEPRankingHTML;
  window.exportAllTablesHTML = exportAllTablesHTML;
  window.showSuccessMessage = showSuccessMessage;
  window.showErrorMessage = showErrorMessage;
  window.findToken = findToken;
  window.checkTodayPlanification = checkTodayPlanification;
  window.updatePresenceButtons = updatePresenceButtons;
  window.handlePresenceError = handlePresenceError;

  function initializePage() {
    // Vérifier si on est en mode reconnexion
    const isReauth = window.location.search.includes('reauth=true');
    
    // Débogage: afficher tous les tokens trouvés
    console.log('=== DÉBOGAGE AUTHENTIFICATION ===');
    console.log('localStorage keys:', Object.keys(localStorage));
    console.log('sessionStorage keys:', Object.keys(sessionStorage));
    
    // Vérifier l'authentification d'abord
    const token = findToken();
    console.log('Token trouvé:', token ? 'OUI' : 'NON');
    if (token) {
      console.log('Token length:', token.length);
      console.log('Token parts:', token.split('.').length);
      console.log('Token preview:', token.substring(0, 50) + '...');
    }
    
    if (!token) {
      console.warn('Aucun token trouvé - affichage du message d\'authentification');
      // Afficher le message d'erreur au lieu de rediriger immédiatement
      showAuthError();
      return;
    }
    
    if (isReauth) {
      console.log('Mode reconnexion: token trouvé, nettoyage de l\'URL...');
      // Nettoyer l'URL pour enlever le paramètre reauth
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      // Afficher un message de bienvenue
      showSuccessMessage('Reconnexion réussie ! Vous pouvez continuer à utiliser l\'application.');
    }
    
    console.log('Token trouvé, initialisation de la page...');
    
    // Définir la date d'aujourd'hui par défaut
    const dateInput = document.getElementById('date-select');
    if (dateInput) {
      dateInput.value = currentDate;
    }
    
    // Continuer l'initialisation
    loadUserInfo();
    loadAgents();
    setupEventListeners();
    
    // Vérifier la planification du jour et mettre à jour les boutons
    updatePresenceButtons();
    
    // Charger automatiquement le suivi des activités au chargement
    setTimeout(() => {
      loadActivityFollowUp();
    }, 1000);
  }

  function setupEventListeners() {
    // Date input removed from filters; keep currentDate default for internal use if needed

    // Month selector
    const monthSelect = document.getElementById('month-select');
    if (monthSelect) {
      // Initialiser au mois courant
      const now = new Date();
      const monthValue = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      monthSelect.value = monthValue;
      monthSelect.addEventListener('change', () => {
        loadActivities();
      });
    }

    // Activity follow-up month selector (utilise le même sélecteur que le tableau d'évaluation)
    const activityMonthSelector = document.getElementById('activity-month-selector');
    if (activityMonthSelector) {
      // Initialiser au mois courant
      activityMonthSelector.value = new Date().getMonth() + 1;
      activityMonthSelector.addEventListener('change', () => {
        // Recharger les activités du tableau d'évaluation, puis mettre à jour le suivi
        loadActivities().then(() => {
          displayActivityFollowUp(activities);
        });
      });
    }

    // Activity follow-up year selector (utilise le même sélecteur que le tableau d'évaluation)
    const activityYearSelector = document.getElementById('activity-year-selector');
    if (activityYearSelector) {
      // Initialiser à l'année courante
      activityYearSelector.value = new Date().getFullYear();
      activityYearSelector.addEventListener('change', () => {
        // Recharger les activités du tableau d'évaluation, puis mettre à jour le suivi
        loadActivities().then(() => {
          displayActivityFollowUp(activities);
        });
      });
    }

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
      updateStatistics();
      updateFilterIndicator();
    });

    // Status filter
    document.getElementById('status-filter').addEventListener('change', () => {
      filterActivities();
      updateStatistics();
      updateFilterIndicator();
    });

    // Supervisor filter (visible only for admins)
    const supervisorSelect = document.getElementById('supervisor-filter');
    if (supervisorSelect) {
      supervisorSelect.addEventListener('change', () => {
        filterActivities();
        updateStatistics();
        updateFilterIndicator();
      });
    }

    // Week-of-month filter
    const weekFilter = document.getElementById('week-filter');
    if (weekFilter) {
      weekFilter.addEventListener('change', () => {
        filterActivities();
        updateStatistics();
        updateFilterIndicator();
      });
    }

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

    // Clear filters button
    document.getElementById('clear-filters').addEventListener('click', () => {
      clearFilters();
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
        
        // Pour les agents non-admin, appliquer automatiquement le filtre de leur projet
        if (!isAdmin && user.project_name) {
          applyAgentProjectFilter(user.project_name);
        }
        
        // Charger les activités
        loadActivities();
      } else if (res.status === 401) {
        console.warn('Token expiré lors du chargement du profil');
        // Afficher un message d'erreur au lieu de rediriger immédiatement
        showAuthError();
        return;
      } else {
        throw new Error('Erreur lors du chargement du profil');
      }
    } catch (error) {
      console.error('Erreur chargement info utilisateur:', error);
      showAuthError();
    }
  }

  // Charger la liste des agents (admin/superviseur) ou restreindre à soi (agent)
  async function loadAgents() {
    try {
      const headers = await authHeaders();
      let loaded = false;
      // 1) Endpoint complet réservé admin/superviseur
      try {
        const res = await fetch(`${apiBase}/admin/agents`, { headers });
        if (res.ok) {
          const payload = await res.json();
          const list = payload?.data || payload?.agents || payload?.items || [];
          if (Array.isArray(list) && list.length) {
            // Charger TOUS les utilisateurs (agents ET superviseurs)
            agents = list; // Ne pas filtrer par rôle
            loaded = true;
            console.log(`Chargé ${agents.length} utilisateurs (agents + superviseurs)`);
          }
        }
      } catch (e) {
        console.warn('Endpoint admin/agents non accessible:', e.message);
      }
      // 2) Endpoint public avec rôle
      if (!loaded) {
        try {
          const res = await fetch(`${apiBase}/agents`, { headers });
          if (res.ok) {
            const payload = await res.json();
            const list = payload?.data || payload?.agents || payload?.items || [];
            if (Array.isArray(list) && list.length) {
              // Charger TOUS les utilisateurs (agents ET superviseurs)
              agents = list; // Ne pas filtrer par rôle
              loaded = true;
              console.log(`Chargé ${agents.length} utilisateurs via endpoint public`);
            }
          }
        } catch (e) {
          console.warn('Endpoint agents non accessible:', e.message);
        }
      }
      // 3) Endpoint users en fallback
      if (!loaded) {
        try {
          const res = await fetch(`${apiBase}/users`, { headers });
          if (res.ok) {
            const payload = await res.json();
            const list = payload?.data || payload?.users || payload?.items || [];
            if (Array.isArray(list) && list.length) {
              // Charger TOUS les utilisateurs (agents ET superviseurs)
              agents = list; // Ne pas filtrer par rôle
              loaded = true;
              console.log(`Chargé ${agents.length} utilisateurs via endpoint users`);
            }
          }
        } catch (e) {
          console.warn('Endpoint users non accessible:', e.message);
        }
      }
      if (!loaded) {
        console.warn('Aucun endpoint de chargement des utilisateurs n\'a répondu');
        agents = [];
      }
      console.log('Utilisateurs chargés:', agents.length);
    } catch (error) {
      console.error('Erreur lors du chargement des agents:', error);
      agents = [];
    }
  }

  // Remplir le filtre des superviseurs (admins uniquement)
  function populateSupervisorFilter() {
    try {
      const supervisorSelect = document.getElementById('supervisor-filter');
      if (!supervisorSelect) return;

      // Afficher le select pour les admins
      supervisorSelect.style.display = 'block';

      // Charger la liste des superviseurs depuis /users (role = 'superviseur')
      (async () => {
        const uniqueSupervisors = new Map();
        try {
          const headers = await authHeaders();
          const res = await fetch(`${apiBase}/admin/agents`, { headers });
          if (res.ok) {
            const data = await res.json();
            const list = data?.data || data?.agents || [];
            list.forEach(u => {
              const roleNorm = String(u.role || '').trim().toLowerCase();
              if (roleNorm === 'superviseur' || roleNorm === 'supervisor') {
                const key = u.id || u.email;
                if (key && !uniqueSupervisors.has(key)) {
                  uniqueSupervisors.set(key, {
                    id: u.id,
                    name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || (u.name || 'Superviseur'),
                    email: u.email || ''
                  });
                }
              }
            });
          }
        } catch {}

        supervisors = Array.from(uniqueSupervisors.values());

        // Peupler le select avec les NOMS (valeur = id)
        supervisorSelect.innerHTML = '<option value="">Tous les superviseurs</option>';
        supervisors.forEach(sup => {
          const opt = document.createElement('option');
          opt.value = sup.id;
          opt.textContent = sup.name;
          supervisorSelect.appendChild(opt);
        });
      })();
    } catch {}
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

  // Charger les projets disponibles depuis la base de données
  async function loadAgentProject(user) {
    try {
      if (isAdmin) {
        // Pour les admins, charger tous les projets
        const headers = await authHeaders();
        const res = await fetch(`${apiBase}/admin/agents`, { headers });
        
        if (res.ok) {
          const data = await res.json();
          const agents = data.data || data.agents || [];
          
          // Extraire les projets uniques depuis les agents
          const uniqueProjects = new Set();
          agents.forEach(agent => {
            if (agent.project_name && agent.project_name.trim() !== '') {
              uniqueProjects.add(agent.project_name.trim());
            }
          });
          
          // Créer la liste des projets
          projects = Array.from(uniqueProjects).map((projectName, index) => ({
            id: index + 1,
            name: projectName,
            status: 'active'
          }));
          
          console.log('Projets chargés depuis la base de données:', projects);
          updateProjectFilter();
        } else {
          console.error('Erreur lors du chargement des agents:', res.status);
          // Utiliser le projet de l'agent actuel en cas d'erreur
          const agentProject = user.project_name || user.project || 'Projet non spécifié';
          projects = [
            { id: 1, name: agentProject, status: 'active' }
          ];
          updateProjectFilter();
        }
      } else {
        // Pour les agents, utiliser uniquement leur projet
        const agentProject = user.project_name || user.project || 'Projet non spécifié';
        projects = [
          { id: 1, name: agentProject, status: 'active' }
        ];
        console.log('Projet de l\'agent:', agentProject);
        updateProjectFilter();
      }
    } catch (error) {
      console.error('Erreur chargement projets:', error);
      // Utiliser le projet de l'agent actuel en cas d'erreur
      const agentProject = user.project_name || user.project || 'Projet non spécifié';
      projects = [
        { id: 1, name: agentProject, status: 'active' }
      ];
      updateProjectFilter();
    }
  }

  function updateProjectFilter() {
    const select = document.getElementById('project-filter');
    select.innerHTML = '<option value="">Tous les projets</option>';
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.name; // Utiliser le nom du projet comme valeur pour la cohérence
      option.textContent = project.name;
      select.appendChild(option);
    });
  }

  // Appliquer automatiquement le filtre projet pour un agent
  function applyAgentProjectFilter(projectName) {
    const projectFilter = document.getElementById('project-filter');
    if (projectFilter && projectName) {
      projectFilter.value = projectName;
      
      // Masquer le filtre projet pour les agents (ils ne voient que leur projet)
      const projectFilterContainer = document.getElementById('project-filter').closest('.col-md-6');
      if (projectFilterContainer) {
        projectFilterContainer.style.display = 'none';
      }
      
      // Afficher le badge du projet de l'agent
      const agentProjectBadge = document.getElementById('agent-project-badge');
      const agentProjectName = document.getElementById('agent-project-name');
      if (agentProjectBadge && agentProjectName) {
        agentProjectName.textContent = projectName;
        agentProjectBadge.style.display = 'block';
      }
    }
  }

  // Mettre à jour le titre avec le nom de l'agent sélectionné
  function updateAgentTitle() {
    const agentSelect = document.getElementById('agent-select');
    const selectedOption = agentSelect.options[agentSelect.selectedIndex];
    const agentTitle = document.getElementById('agent-title');
    
    if (selectedOption.value) {
      const agentName = selectedOption.textContent;
      agentTitle.textContent = `Suivi d'Activité - ${agentName}`;
      agentTitle.style.display = 'block';
    } else {
      agentTitle.style.display = 'none';
    }
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
      
      // Construire la période: basé sur mois sélectionné (si présent), sinon semaine contenant currentDate
      const monthSelect = document.getElementById('month-select');
      let fromStr, toStr;
      if (monthSelect && monthSelect.value) {
        const [year, month] = monthSelect.value.split('-').map(Number);
        const fromDate = new Date(Date.UTC(year, month - 1, 1));
        const toDate = new Date(Date.UTC(year, month, 0)); // dernier jour du mois
        fromStr = fromDate.toISOString().slice(0, 10);
        toStr = toDate.toISOString().slice(0, 10);
      } else {
        const base = new Date(currentDate + 'T00:00:00');
        const day = base.getDay(); // 0=dimanche, 1=lundi
        const diffToMonday = ((day + 6) % 7); // nombre de jours depuis lundi
        const monday = new Date(base);
        monday.setDate(base.getDate() - diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        fromStr = monday.toISOString().slice(0,10);
        toStr = sunday.toISOString().slice(0,10);
      }

      // Construire l'URL pour la période hebdomadaire, avec filtre agent si applicable
      let url = `${apiBase}/planifications?from=${fromStr}&to=${toStr}`;
      const agentSelect = document.getElementById('agent-select');
      const selectedAgentId = agentSelect.value;
      const projectFilterValue = document.getElementById('project-filter').value;
      const supervisorFilterValue = (document.getElementById('supervisor-filter') || {}).value || '';
      
      // Toujours filtrer par l'agent sélectionné si un agent est sélectionné
      if (selectedAgentId && selectedAgentId !== 'null' && selectedAgentId !== '') {
        url += `&agent_id=${selectedAgentId}`;
      } else if (!isAdmin && currentUserId) {
        // Pour les agents non-admin, filtrer par leur propre ID si aucun agent n'est sélectionné
        url += `&agent_id=${currentUserId}`;
      }

      // Appliquer le filtre projet au niveau API si présent
      if (projectFilterValue) {
        url += `&project_name=${encodeURIComponent(projectFilterValue)}`;
      }
      
      const res = await fetch(url, { headers });
      
      if (res.status === 401) {
        console.warn('Token expiré ou invalide lors du chargement des activités');
        // Afficher un message d'erreur au lieu de rediriger immédiatement
        showAuthError();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        activities = data.items || [];

        // Enrichir les activités avec infos agent si disponibles (pour filtre superviseur)
        // (best-effort: si backend renvoie déjà l'agent/superviseur, on l'utilise)
        const agentMap = new Map();
        agents.forEach(a => agentMap.set(a.id, a));
        activities.forEach(a => {
          if (!a.agent && a.agent_id && agentMap.has(a.agent_id)) {
            a.agent = agentMap.get(a.agent_id);
          }
        });
        
        // Appliquer automatiquement le filtre projet si c'est un agent
        if (!isAdmin) {
          const projectFilter = document.getElementById('project-filter').value;
          if (projectFilter) {
            // Le filtre est déjà appliqué, on affiche directement les activités filtrées
            displayActivities();
            updateStatistics();
            updateFilterIndicator();
          } else {
            // Pas de filtre, afficher toutes les activités
            displayActivities();
            updateStatistics();
            updateFilterIndicator();
          }
        } else {
          // Pour les admins, afficher toutes les activités
          displayActivities();
          updateStatistics();
          updateFilterIndicator();
        }
        
        // Mettre à jour automatiquement le tableau de suivi des activités
        displayActivityFollowUp(activities);
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
    
    // Regrouper par date pour afficher toutes les journées planifiées de la semaine
    filteredActivities.sort((a,b) => String(a.date).localeCompare(String(b.date)));
    
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
    const supervisorFilter = (document.getElementById('supervisor-filter') || {}).value || '';
    const weekFilter = (document.getElementById('week-filter') || {}).value || '';

    let filtered = activities;

    if (projectFilter) {
      // Filtrer par nom de projet (cohérent avec updateProjectFilter)
      filtered = filtered.filter(activity => {
        const activityProjectName = activity.project_name || activity.projects?.name || '';
        return activityProjectName === projectFilter;
      });
    }

    if (statusFilter) {
      if (statusFilter === 'sans_resultat') {
        filtered = filtered.filter(activity => !activity.resultat_journee);
      } else {
        filtered = filtered.filter(activity => activity.resultat_journee === statusFilter);
      }
    }

    // Filtrer par superviseur (admins uniquement)
    if (isAdmin && supervisorFilter) {
      filtered = filtered.filter(activity => {
        const agent = activity.agent || {};
        const matchById = agent.supervisor_id && String(agent.supervisor_id) === String(supervisorFilter);
        const matchByActivity = activity.supervisor_id && String(activity.supervisor_id) === String(supervisorFilter);
        return matchById || matchByActivity;
      });
    }

    // Filtrer par semaine du mois (1..5) si sélectionnée
    if (weekFilter) {
      const targetWeek = parseInt(weekFilter, 10);
      filtered = filtered.filter(activity => {
        const d = new Date(String(activity.date) + 'T00:00:00');
        if (isNaN(d)) return false;
        // semaine du mois: 1 + floor((jour-1 + offset) / 7)
        const dayOfMonth = d.getUTCDate();
        const firstDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
        const offset = (firstDay.getUTCDay() + 6) % 7; // convertir dimanche=0 -> lundi=0
        const weekOfMonth = 1 + Math.floor((dayOfMonth - 1 + offset) / 7);
        return weekOfMonth === targetWeek;
      });
    }

    return filtered;
  }

  // Mettre à jour les statistiques
  function updateStatistics() {
    // Utiliser les activités filtrées pour les statistiques
    const filteredActivities = filterActivities();
    const stats = {
      realise: filteredActivities.filter(a => a.resultat_journee === 'realise').length,
      partiellement_realise: filteredActivities.filter(a => a.resultat_journee === 'partiellement_realise').length,
      non_realise: filteredActivities.filter(a => a.resultat_journee === 'non_realise').length,
      en_cours: filteredActivities.filter(a => a.resultat_journee === 'en_cours').length,
      sans_resultat: filteredActivities.filter(a => !a.resultat_journee).length,
      total: filteredActivities.length
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
    // Afficher un message d'erreur au lieu de rediriger immédiatement
    console.error('Erreur d\'authentification - token non trouvé ou invalide');
    
    // Afficher un message dans la page
    const activitiesTbody = document.getElementById('activities-tbody');
    const followUpTbody = document.getElementById('activity-follow-up-body');
    
    const errorMessage = `
      <div class="alert alert-warning">
        <h6>⚠️ Problème d'authentification</h6>
        <p class="mb-2">Votre session semble expirée. Veuillez vous reconnecter.</p>
        <div class="d-flex gap-2">
          <a href="/index.html" class="btn btn-primary btn-sm">Se reconnecter</a>
          <button class="btn btn-secondary btn-sm" onclick="location.reload()">Réessayer</button>
        </div>
      </div>
    `;
    
    if (activitiesTbody) {
      activitiesTbody.innerHTML = `<tr><td colspan="8" class="p-3">${errorMessage}</td></tr>`;
    }
    
    if (followUpTbody) {
      followUpTbody.innerHTML = `<tr><td colspan="9" class="p-3">${errorMessage}</td></tr>`;
    }
    
    // Ne plus rediriger automatiquement - laisser l'utilisateur choisir
  }

  /**
   * Vérifie si l'agent a une planification pour aujourd'hui
   */
  async function checkTodayPlanification() {
    try {
      const response = await fetch('/api/planifications/today/check', {
        headers: {
          'Authorization': `Bearer ${findToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.has_planification;
      } else {
        console.error('Erreur vérification planification:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Erreur vérification planification:', error);
      return false;
    }
  }

  /**
   * Intercepte les erreurs de présence et affiche des messages conviviaux
   */
  function handlePresenceError(error, action) {
    if (error.code === 'NO_PLANIFICATION_FOUND') {
      showErrorMessage(`
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle me-2"></i>
          <strong>Impossible de ${action} votre présence</strong><br>
          <small>Vous n'avez pas de planification enregistrée pour aujourd'hui.</small><br>
          <small>Veuillez d'abord <a href="/planning.html" class="alert-link">remplir votre planification quotidienne</a> avant de pouvoir marquer votre présence.</small>
        </div>
      `);
    } else {
      showErrorMessage(`Erreur lors de ${action} la présence: ${error.message || 'Erreur inconnue'}`);
    }
  }

  /**
   * Affiche/masque les boutons de présence selon la planification
   */
  async function updatePresenceButtons() {
    const hasPlanification = await checkTodayPlanification();
    
    // Sélectionner tous les boutons de présence
    const presenceButtons = document.querySelectorAll('.presence-start-btn, .presence-end-btn, .checkin-btn');
    
    presenceButtons.forEach(button => {
      if (hasPlanification) {
        // Afficher le bouton si planification existe
        button.style.display = '';
        button.disabled = false;
        
        // Ajouter une indication positive
        if (!button.querySelector('.planification-indicator')) {
          const indicator = document.createElement('span');
          indicator.className = 'planification-indicator badge bg-success ms-2';
          indicator.style.fontSize = '0.7em';
          indicator.textContent = '✓ Planifié';
          button.appendChild(indicator);
        }
      } else {
        // Masquer ou désactiver le bouton si pas de planification
        button.style.display = 'none';
        button.disabled = true;
        
        // Afficher un message d'information
        const parent = button.parentNode;
        if (parent && !parent.querySelector('.no-planification-message')) {
          const message = document.createElement('div');
          message.className = 'no-planification-message alert alert-warning mt-2';
          message.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Pas de planification aujourd'hui</strong><br>
            <small>Veuillez d'abord enregistrer votre planification quotidienne pour pouvoir marquer votre présence.</small>
          `;
          parent.appendChild(message);
        }
      }
    });
    
    console.log(`Planification aujourd'hui: ${hasPlanification ? 'Oui' : 'Non'}`);
  }

  /**
   * Calcule le taux d'exécution de la planification (TEP)
   * TEP = (nombre d'activités entièrement réalisées / nombre total planifié) * 100
   */
  function calculateExecutionRate(realizedActivities, totalActivities) {
    if (!totalActivities || totalActivities === 0) {
      return 0;
    }
    return (realizedActivities / totalActivities) * 100;
  }

  // Fonctions d'authentification (reprises de planning.js)
  
  function findToken() {
    console.log('Recherche du token JWT...');
    for (const key of DEFAULT_TOKEN_CANDIDATES) {
      const value = (localStorage.getItem(key) || '').trim();
      if (value && value.split('.').length >= 3) {
        console.log(`Token trouvé dans localStorage.${key}`);
        return value;
      }
    }
    if (typeof window.jwt === 'string' && window.jwt.split('.').length >= 3) {
      console.log('Token trouvé dans window.jwt');
      return window.jwt;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) || '';
      if (value.split('.').length >= 3 && value.length > 60) {
        console.log(`Token trouvé dans localStorage.${key}`);
        return value;
      }
    }
    console.log('Aucun token JWT trouvé');
    return null;
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

  // Mettre à jour l'indicateur de filtres actifs
  function updateFilterIndicator() {
    const projectFilter = document.getElementById('project-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    const supervisorFilter = (document.getElementById('supervisor-filter') || {}).value || '';
    const activeFiltersDiv = document.getElementById('active-filters');
    const filterIndicator = document.getElementById('filter-indicator');
    
    // Pour les agents, ne pas afficher l'indicateur de filtres (ils ne voient que leur projet)
    if (!isAdmin) {
      activeFiltersDiv.style.display = 'none';
      return;
    }
    
    const activeFilters = [];
    
    if (projectFilter) {
      const projectName = projects.find(p => p.name === projectFilter)?.name || projectFilter;
      activeFilters.push(`Projet: ${projectName}`);
    }
    
    if (statusFilter) {
      const statusText = getStatusText(statusFilter);
      activeFilters.push(`Statut: ${statusText}`);
    }
    if (supervisorFilter) {
      const sup = supervisors.find(s => String(s.id) === String(supervisorFilter));
      const name = sup ? sup.name : supervisorFilter;
      activeFilters.push(`Superviseur: ${name}`);
    }
    
    if (activeFilters.length > 0) {
      activeFiltersDiv.style.display = 'block';
      filterIndicator.textContent = `Filtres actifs: ${activeFilters.join(', ')}`;
    } else {
      activeFiltersDiv.style.display = 'none';
    }
  }

  // Effacer tous les filtres
  function clearFilters() {
    // Pour les agents, ne pas permettre d'effacer le filtre projet
    if (!isAdmin) {
      document.getElementById('status-filter').value = '';
    } else {
      document.getElementById('project-filter').value = '';
      document.getElementById('status-filter').value = '';
    }
    filterActivities();
    updateStatistics();
    updateFilterIndicator();
  }

  // Effacer les filtres du suivi d'activités
  function clearActivityFilters() {
    const projectFilter = document.getElementById('activity-project-filter');
    if (projectFilter) {
      projectFilter.value = '';
    }
    loadActivityFollowUp();
  }

  // Mettre à jour le filtre de projets
  function updateProjectFilter(projects) {
    const projectFilter = document.getElementById('activity-project-filter');
    if (!projectFilter) return;
    
    // Vérifier que projects est un tableau
    if (!projects || !Array.isArray(projects)) {
      console.warn('updateProjectFilter: projects n\'est pas un tableau', projects);
      return;
    }
    
    const currentValue = projectFilter.value;
    
    // Garder seulement l'option "Tous les projets"
    projectFilter.innerHTML = '<option value="">Tous les projets</option>';
    
    // Ajouter les projets uniques triés
    projects.sort().forEach(project => {
      const option = document.createElement('option');
      option.value = project;
      option.textContent = project;
      projectFilter.appendChild(option);
    });
    
    // Restaurer la sélection précédente si elle existe toujours
    if (currentValue) {
      projectFilter.value = currentValue;
    }
  }

  // Fonctions globales pour les boutons du tableau
  window.saveActivityRow = saveActivityRow;
  window.deleteActivityRow = deleteActivityRow;
  window.clearActivityFilters = clearActivityFilters;

  // Ajouter l'écouteur d'événement pour le filtre de projet
  document.addEventListener('DOMContentLoaded', () => {
    const projectFilter = document.getElementById('activity-project-filter');
    if (projectFilter) {
      projectFilter.addEventListener('change', () => {
        // Recharger les données avec le filtre actuel
        loadActivityFollowUp();
      });
    }
  });

})();
