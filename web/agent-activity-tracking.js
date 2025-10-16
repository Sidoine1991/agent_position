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
            agents = list.filter(u => String(u.role || '').trim().toLowerCase() === 'agent');
            loaded = true;
          }
        }
      } catch {}

      // 2) Fallback endpoint générique utilisateurs
      if (!loaded) {
        try {
          const res2 = await fetch(`${apiBase}/users`, { headers });
          if (res2.ok) {
            const data = await res2.json();
            const list = data?.items || data?.users || data?.data || [];
            if (Array.isArray(list) && list.length) {
              agents = list.filter(u => String(u.role || '').trim().toLowerCase() === 'agent');
              loaded = true;
            }
          }
        } catch {}
      }

      // 3) Fallback: si profil courant est agent, limiter au compte courant
      if (!loaded) {
        try {
          if (currentUser && String(currentUser.role || '').toLowerCase() === 'agent') {
            agents = [{ id: currentUser.id, first_name: currentUser.first_name, last_name: currentUser.last_name, email: currentUser.email, role: 'agent' }];
            loaded = true;
          }
        } catch {}
      }

      if (!Array.isArray(agents)) agents = [];
      populateAgentSelect();
      // Charger la liste des superviseurs pour le filtre (admins)
      if (isAdmin) {
        populateSupervisorFilter();
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
      const selectedAgentId = document.getElementById('agent-select').value;
      const projectFilterValue = document.getElementById('project-filter').value;
      const supervisorFilterValue = (document.getElementById('supervisor-filter') || {}).value || '';
      
      if (isAdmin && selectedAgentId) {
        url += `&agent_id=${selectedAgentId}`;
      } else if (!isAdmin) {
        // Pour les agents non-admin, filtrer par leur propre ID
        url += `&agent_id=${currentUserId}`;
      }

      // Appliquer le filtre projet au niveau API si présent
      if (projectFilterValue) {
        url += `&project_name=${encodeURIComponent(projectFilterValue)}`;
      }
      
      const res = await fetch(url, { headers });
      
      if (res.status === 401) {
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

  // Fonctions globales pour les boutons du tableau
  window.saveActivityRow = saveActivityRow;
  window.deleteActivityRow = deleteActivityRow;

})();
