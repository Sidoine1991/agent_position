(function() {
  const apiBase = '/api';
  let refreshMonthTimer = null;
  
  // ... (contenu existant jusqu'à la fonction displayWeeklySummary)

  function displayWeeklySummary(summaries) {
    const container = document.getElementById('weekly-summary');
    if (!container) return;
    
    // Vérifier si des données sont disponibles
    if (!summaries || summaries.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <div class="d-flex align-items-center">
            <i class="bi bi-info-circle-fill me-2"></i>
            <div>
              <h5 class="alert-heading mb-1">Aucune activité planifiée</h5>
              <p class="mb-0">Aucune activité n'a été trouvée pour la période sélectionnée.</p>
            </div>
          </div>
        </div>
      `;
      return;
    }
    
    try {
      // Grouper par semaine
      const weeksMap = new Map();

      summaries.forEach(summary => {
        if (!summary.week_start_date) return;

        const weekStart = new Date(summary.week_start_date);
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!weeksMap.has(weekKey)) {
          weeksMap.set(weekKey, {
            weekStart: summary.week_start_date,
            weekEnd: summary.week_end_date || addDays(new Date(summary.week_start_date), 6).toISOString().split('T')[0],
            items: []
          });
        }
        weeksMap.get(weekKey).items.push(summary);
      });

      // Trier les semaines par date décroissante
      const sortedWeeks = Array.from(weeksMap.values()).sort((a, b) =>
        new Date(b.weekStart) - new Date(a.weekStart)
      );

      // Créer le conteneur principal
      const mainDiv = document.createElement('div');
      mainDiv.className = 'weekly-summary-container';
      
      // Créer les onglets de navigation
      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'week-tabs d-flex overflow-auto mb-3';
      
      // Créer le contenu des onglets
      const contentContainer = document.createElement('div');
      contentContainer.className = 'week-contents';
      
      sortedWeeks.forEach((week, index) => {
        // Créer l'onglet
        const tab = document.createElement('button');
        tab.className = `week-tab btn btn-outline-primary me-2 ${index === 0 ? 'active' : ''}`;
        tab.textContent = `Semaine du ${formatDate(week.weekStart, 'dd/MM')}`;
        tab.onclick = () => switchWeekTab(week.weekStart);
        
        // Créer le contenu de l'onglet
        const content = document.createElement('div');
        content.className = `week-content ${index === 0 ? 'active' : 'd-none'}`;
        content.id = `week-${week.weekStart}`;
        
        // Générer le tableau pour cette semaine
        const table = generateWeekTable(week);
        content.appendChild(table);
        
        // Ajouter au DOM
        tabsContainer.appendChild(tab);
        contentContainer.appendChild(content);
      });
      
      // Ajouter les onglets et le contenu au conteneur principal
      mainDiv.appendChild(tabsContainer);
      mainDiv.appendChild(contentContainer);
      
      // Ajouter le conteneur principal à la page
      container.innerHTML = '';
      container.appendChild(mainDiv);
      
      // Initialiser les tooltips
      const tooltipTriggerList = [].slice.call(container.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
      });
      
    } catch (error) {
      console.error('Erreur lors de l\'affichage du récapitulatif:', error);
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          Une erreur est survenue lors du chargement du récapitulatif.
        </div>
      `;
    }
  }

  function formatDate(dateString, format = 'dd/MM/yyyy') {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date invalide';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return format
      .replace('dd', day)
      .replace('MM', month)
      .replace('yyyy', year);
  }

  function switchWeekTab(weekStart) {
    // Désactiver tous les onglets et contenus
    document.querySelectorAll('.week-tab').forEach(tab => {
      tab.classList.remove('active', 'btn-primary');
      tab.classList.add('btn-outline-primary');
    });
    document.querySelectorAll('.week-content').forEach(content => {
      content.classList.add('d-none');
    });
    
    // Activer l'onglet et le contenu sélectionnés
    const selectedTab = document.querySelector(`.week-tab[onclick*="${weekStart}"]`);
    const selectedContent = document.getElementById(`week-${weekStart}`);
    
    if (selectedTab && selectedContent) {
      selectedTab.classList.add('active', 'btn-primary');
      selectedTab.classList.remove('btn-outline-primary');
      selectedContent.classList.remove('d-none');
    }
  }

  function generateWeekTable(week) {
    const table = document.createElement('table');
    table.className = 'table table-hover align-middle';
    
    // En-tête du tableau
    const thead = document.createElement('thead');
    thead.className = 'table-light';
    thead.innerHTML = `
      <tr>
        <th>Agent</th>
        <th>Projet</th>
        <th>Heures planifiées</th>
        <th>Jours planifiés</th>
        <th>Activités</th>
        <th>Actions</th>
      </tr>
    `;
    
    // Corps du tableau
    const tbody = document.createElement('tbody');
    week.items.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="d-flex align-items-center">
            <div class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" 
                 style="width:32px;height:32px;font-size:12px">
              ${(item.users?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="fw-semibold">${item.users?.name || 'Agent'}</div>
              <small class="text-muted">${item.users?.email || ''}</small>
            </div>
          </div>
        </td>
        <td><span class="badge bg-info">${item.project_name || 'Projet Général'}</span></td>
        <td><span class="fw-semibold">${item.total_planned_hours || 0}h</span></td>
        <td><span class="badge bg-secondary">${item.total_planned_days || 0} jours</span></td>
        <td>
          <div class="activities-preview" style="max-width: 200px; max-height: 80px; overflow-y: auto;">
            ${item.activities_summary ? 
              item.activities_summary.split(' | ').map(activity => 
                `<div class="small mb-1 text-truncate" title="${activity}">${activity}</div>`
              ).join('') : 
              '<em class="text-muted small">Aucune activité</em>'
            }
          </div>
        </td>
        <td>
          <div class="btn-group" role="group">
            <button class="btn btn-sm btn-outline-primary" 
                    onclick="editWeekPlanning('${item.week_start_date}', '${item.user_id}', '${item.project_name}')" 
                    title="Modifier la planification"
                    data-bs-toggle="tooltip">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-info" 
                    onclick="viewWeekDetails('${item.week_start_date}', '${item.user_id}', '${item.project_name}')" 
                    title="Voir les détails"
                    data-bs-toggle="tooltip">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" 
                    onclick="deleteWeekPlanning('${item.week_start_date}', '${item.user_id}', '${item.project_name}')" 
                    title="Supprimer la planification"
                    data-bs-toggle="tooltip">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
    
    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
  }

  // Exposer les fonctions globales
  window.displayWeeklySummary = displayWeeklySummary;
  window.formatDate = formatDate;
  window.switchWeekTab = switchWeekTab;
  window.generateWeekTable = generateWeekTable;

  // ... (reste du code existant)

})();
