// Citations de motivation
    const motivationQuotes = [
      {
        text: "L'excellence n'est jamais un accident. C'est toujours le résultat d'une intention élevée, d'un effort sincère et d'une exécution intelligente.",
        author: "Aristote"
      },
      {
        text: "Le succès n'est pas final, l'échec n'est pas fatal : c'est le courage de continuer qui compte.",
        author: "Winston Churchill"
      },
      {
        text: "La seule façon de faire du bon travail est d'aimer ce que vous faites.",
        author: "Steve Jobs"
      },
      {
        text: "L'avenir appartient à ceux qui croient en la beauté de leurs rêves.",
        author: "Eleanor Roosevelt"
      },
      {
        text: "Le succès est la somme de petits efforts répétés jour après jour.",
        author: "Robert Collier"
      }
    ];

    let dashboardAgents = [];
    let dashboardAgentId = null;
    let dashboardSelectedAgent = null;
    let dashboardMonthValue = null;
    let dashboardProjectFilter = '';
    let monthlyReportRequestId = 0;
    let leaderboardCache = [];
    let leaderboardProjects = [];
    let leaderboardProjectFilter = null;
    let lastMonthlyReportParams = { agentId: null, monthValue: null };
    let aiGenerationInProgress = false;
    let projectSelectTouched = false;

    const REPORT_RESULT_LABELS = {
      realise: 'Réalisé',
      realisee: 'Réalisé',
      'realise partiellement': 'Partiellement réalisé',
      partiellement_realise: 'Partiellement réalisé',
      en_cours: 'En cours',
      non_realise: 'Non réalisé',
      planifie: 'Planifié',
      planned: 'Planifié'
    };

    const REPORT_ACTIVITY_STATUS_GROUPS = {
      realized: new Set(['realise', 'realisee', 'completed', 'complete', 'terminee', 'termine', 'fait', 'done']),
      notRealized: new Set(['non_realise', 'non_realisee', 'annule', 'annulee', 'cancelled', 'pas_fait', 'nonrealise']),
      inProgress: new Set(['en_cours', 'encours', 'in_progress', 'pending']),
      partiallyRealized: new Set(['partiellement_realise', 'partiellement_realisee', 'partially_completed', 'partially']),
      planned: new Set(['planifie', 'planifiee', 'planified', 'planifiees', 'planifie_en_cours'])
    };

    function normalizeActivityStatus(value) {
      if (!value) return '';
      return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_');
    }

    function detectActivityStatus(value) {
      const normalized = normalizeActivityStatus(value);
      if (!normalized) return 'unknown';
      if (REPORT_ACTIVITY_STATUS_GROUPS.realized.has(normalized)) return 'realized';
      if (REPORT_ACTIVITY_STATUS_GROUPS.notRealized.has(normalized)) return 'notRealized';
      if (REPORT_ACTIVITY_STATUS_GROUPS.inProgress.has(normalized)) return 'inProgress';
      if (REPORT_ACTIVITY_STATUS_GROUPS.partiallyRealized.has(normalized)) return 'partiallyRealized';
      if (REPORT_ACTIVITY_STATUS_GROUPS.planned.has(normalized)) return 'planned';
      return 'unknown';
    }

    /**
     * Échappe les caractères spéciaux HTML dans une chaîne de caractères
     * @param {string} value - La chaîne à échapper
     * @returns {string} La chaîne échappée
     */
    function escapeHtml(value) {
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      return stringValue
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function buildMonthRange(monthValue) {
      const today = new Date();
      let year = today.getFullYear();
      let monthIndex = today.getMonth();

      if (typeof monthValue === 'string' && /^\d{4}-\d{2}$/.test(monthValue)) {
        const [y, m] = monthValue.split('-').map(Number);
        if (y >= 2000 && m >= 1 && m <= 12) {
          year = y;
          monthIndex = m - 1;
        }
      }

      const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
      return {
        value: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
        startDate,
        endDate,
        startIso: startDate.toISOString(),
        endIso: endDate.toISOString()
      };
    }

    function countWorkingDaysBetween(startDate, endDate) {
      const cursor = new Date(startDate);
      const end = new Date(endDate);
      let total = 0;
      while (cursor <= end) {
        const day = cursor.getUTCDay();
        if (day >= 1 && day <= 5) {
          total += 1;
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return total;
    }

    function formatMonthLabel(monthValue) {
      if (!monthValue) return '';
      const [yearStr, monthStr] = String(monthValue).split('-');
      if (!yearStr || !monthStr) return monthValue;
      const date = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, 1));
      return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }

    function formatProjectDisplay(value) {
      return (value || 'Projet non attribué').toString().trim() || 'Projet non attribué';
    }

    function normalizeProjectIdentifier(value) {
      return (value || '')
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    }

    /**
     * Met à jour la liste déroulante des projets avec les projets uniques des agents
     * @param {Array} agentList - Liste des agents avec leurs projets
     */
    function populateProjectFilterOptions(agentList = []) {
      console.log('Mise à jour de la liste des projets...', agentList);
      const select = document.getElementById('report-project-select');
      if (!select) {
        console.error('Élément select des projets non trouvé');
        return;
      }

      try {
        // S'assurer que agentList est un tableau
        if (!Array.isArray(agentList)) {
          console.warn('La liste des agents n\'est pas un tableau:', agentList);
          agentList = [];
        }

        // Récupérer tous les projets uniques, triés par ordre alphabétique
        const projects = [];

        // Extraire les projets de chaque agent
        agentList.forEach(agent => {
          if (!agent) return;

          // Essayer de trouver un nom de projet dans différentes propriétés
          const projectName = formatProjectDisplay(
            agent.project_name ||
            agent.project ||
            (agent.projects && agent.projects[0]?.name) ||
            ''
          ).trim();

          if (projectName &&
            projectName !== 'Projet non attribué' &&
            projectName !== 'Non attribué' &&
            !projects.includes(projectName)) {
            projects.push(projectName);
          }
        });

        // Trier les projets par ordre alphabétique
        const sortedProjects = [...projects].sort((a, b) =>
          a.localeCompare(b, 'fr', { sensitivity: 'base' })
        );

        // Ajouter l'option par défaut
        const options = ['<option value="">Tous les projets</option>'];

        // Ajouter l'option d'administration si nécessaire
        const hasAdminAccess = agentList.some(agent => {
          const role = (agent.role || '').toLowerCase();
          const project = (agent.project_name || agent.project || '').toLowerCase();
          return role === 'admin' || project.includes('admin');
        });

        if (hasAdminAccess) {
          options.push('<option value="Administration">Administration</option>');
        }

        // Ajouter les autres projets
        sortedProjects.forEach(project => {
          if (project && !options.some(opt => opt.includes(`value="${project}"`))) {
            options.push(`<option value="${project}">${project}</option>`);
          }
        });

        // Mettre à jour le select
        select.innerHTML = options.join('');

        // Restaurer la sélection précédente si elle existe toujours
        const currentProject = dashboardProjectFilter || '';
        const projectExists = currentProject &&
          (currentProject === 'Administration' ||
            sortedProjects.some(p => p === currentProject));

        if (projectExists) {
          select.value = currentProject;
        } else if (sortedProjects.length === 1) {
          // Sélectionner le premier projet par défaut s'il n'y a qu'un seul projet
          select.value = sortedProjects[0];
          dashboardProjectFilter = sortedProjects[0];
        } else {
          select.value = ''; // Afficher "Tous les projets"
        }

        console.log(`Liste des projets mise à jour avec ${sortedProjects.length} projets`, sortedProjects);
      } catch (error) {
        console.error('Erreur lors de la mise à jour des projets:', error);
        select.innerHTML = '<option value="">Erreur de chargement des projets</option>';
      }
    }

    /**
     * Synchronise la sélection du projet avec l'agent sélectionné
     * @param {Object} agent - L'agent sélectionné
     * @param {Object} options - Options de configuration
     * @param {boolean} [options.force=false] - Forcer la mise à jour même si le filtre a été modifié manuellement
     */
    function syncProjectSelectWithAgent(agent, { force = false } = {}) {
      console.log('Synchronisation du projet avec l\'agent:', agent);
      const select = document.getElementById('report-project-select');
      if (!select || !agent) {
        console.warn('Impossible de synchroniser le projet: select ou agent manquant');
        return;
      }

      // Récupérer le nom du projet formaté
      const projectName = formatProjectDisplay(
        agent.project_name || agent.project || agent.projectName || ''
      );

      console.log(`Projet de l'agent: "${projectName}"`);

      // Ne rien faire si le projet est vide ou non attribué, sauf si on force
      if ((!projectName || projectName === 'Projet non attribué' || projectName === 'Non attribué') && !force) {
        console.log('Aucun projet valide pour cet agent');
        return;
      }

      // Vérifier si le projet existe dans la liste déroulante
      const projectExists = Array.from(select.options).some(opt => opt.value === projectName);

      // Mettre à jour la sélection si nécessaire
      if ((!projectSelectTouched || force || !dashboardProjectFilter) && projectName) {
        // Si le projet existe dans la liste, le sélectionner
        if (projectExists) {
          console.log(`Sélection du projet: ${projectName}`);
          select.value = projectName;
          dashboardProjectFilter = projectName;
        }
        // Sinon, essayer de trouver un projet similaire
        else {
          const similarProject = findSimilarProject(projectName, select.options);
          if (similarProject) {
            console.log(`Projet similaire trouvé: ${similarProject} (original: ${projectName})`);
            select.value = similarProject;
            dashboardProjectFilter = similarProject;
          } else if (force) {
            // Si on force et qu'aucun projet similaire n'est trouvé, sélectionner "Tous les projets"
            console.log('Aucun projet similaire trouvé, sélection de "Tous les projets"');
            select.value = '';
            dashboardProjectFilter = '';
          }
        }

        // Mettre à jour le filtre du classement si nécessaire
        updateLeaderboardProjectFilter(projectName);
      }
    }

    /**
     * Trouve un projet similaire dans la liste des options
     * @param {string} projectName - Nom du projet à rechercher
     * @param {HTMLOptionsCollection} options - Collection d'options de sélection
     * @returns {string|null} - Le nom du projet similaire ou null si non trouvé
     */
    function findSimilarProject(projectName, options) {
      if (!projectName || !options) return null;

      const normalizedSearch = projectName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        if (!option.value) continue;

        const normalizedOption = option.text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

        if (normalizedOption.includes(normalizedSearch) ||
          normalizedSearch.includes(normalizedOption)) {
          return option.value;
        }
      }

      return null;
    }

    /**
     * Met à jour le filtre de projet pour le classement
     * @param {string} projectName - Nom du projet à utiliser comme filtre
     */
    function updateLeaderboardProjectFilter(projectName) {
      if (!projectName) return;

      // Vérifier si le projet existe dans la liste des projets du classement
      if (leaderboardProjects.length === 0 || leaderboardProjects.includes(projectName)) {
        console.log(`Mise à jour du filtre du classement avec le projet: ${projectName}`);
        leaderboardProjectFilter = projectName;

        // Mettre à jour l'affichage du classement si nécessaire
        if (leaderboardCache.length > 0) {
          renderLeaderboardTable();
        }
      }
    }

    async function fetchMonthlyCheckins(agentId, monthRange) {
      if ((agentId ?? null) === null || !monthRange) return [];
      try {
        const params = new URLSearchParams({
          from: monthRange.startIso,
          to: monthRange.endIso
        });
        if (agentId !== undefined && agentId !== null && agentId !== '') {
          params.set('user_id', agentId);
        }
        const response = await fetch(`/api/checkins?${params.toString()}`, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`Erreur ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : (data.checkins || data.data || []);
      } catch (error) {
        console.warn('fetchMonthlyCheckins error:', error);
        return [];
      }
    }

    function summarizePresenceFromCheckins(checkins, monthRange) {
      if (!checkins || checkins.length === 0 || !monthRange) return null;
      const workedDays = new Set();
      checkins.forEach(checkin => {
        const rawDate = checkin?.created_at || checkin?.timestamp || checkin?.checkin_time;
        if (!rawDate) return;
        const date = new Date(rawDate);
        if (Number.isNaN(date.getTime())) return;
        workedDays.add(date.toISOString().split('T')[0]);
      });

      const totalCheckins = checkins.length;
      const workingDays = countWorkingDaysBetween(monthRange.startDate, monthRange.endDate);
      const worked = workedDays.size;
      const presenceRate = workingDays > 0 ? Math.round((worked / workingDays) * 1000) / 10 : 0;
      const average = worked > 0 ? Math.round((totalCheckins / worked) * 10) / 10 : totalCheckins;

      return {
        totalCheckins,
        workedDays: worked,
        workingDays,
        presenceRate,
        averageCheckinsPerDay: average,
        permissionDays: 0
      };
    }

    function parsePlanificationDate(plan) {
      if (!plan) return null;
      const candidates = [
        plan.date,
        plan.date_planification,
        plan.datePlanification,
        plan.day,
        plan.created_at,
        plan.createdAt,
        plan.planned_on
      ];

      for (const rawValue of candidates) {
        if (!rawValue) continue;
        const asDate = new Date(rawValue);
        if (!Number.isNaN(asDate.getTime())) {
          return asDate;
        }

        if (typeof rawValue === 'string') {
          const normalized = new Date(`${rawValue}T00:00:00`);
          if (!Number.isNaN(normalized.getTime())) {
            return normalized;
          }
        }
      }

      return null;
    }

    async function fetchMonthlyPlanifications(agentId, monthRange, extraFilters = {}) {
      if (!monthRange) return [];
      try {
        const params = new URLSearchParams({
          from: monthRange.startIso.split('T')[0],
          to: monthRange.endIso.split('T')[0]
        });
        if (agentId !== undefined && agentId !== null && agentId !== '') {
          params.set('agent_id', agentId);
          params.set('user_id', agentId); // compatibilité legacy
        }
        if (extraFilters.projectName) {
          params.set('project_name', extraFilters.projectName);
        }
        const response = await fetch(`/api/planifications?${params.toString()}`, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`Erreur ${response.status}`);
        const data = await response.json();
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.planifications)
              ? data.planifications
              : Array.isArray(data?.data)
                ? data.data
                : [];

        if (!items.length) return [];

        const normalizedAgentId = agentId !== undefined && agentId !== null && agentId !== ''
          ? String(agentId)
          : null;
        const startTime = monthRange.startDate.getTime();
        const endTime = monthRange.endDate.getTime();

        return items.filter(plan => {
          const planDate = parsePlanificationDate(plan);
          if (!planDate) return false;
          const time = planDate.getTime();
          if (time < startTime || time > endTime) return false;
          if (!normalizedAgentId) return true;
          const planAgentId = plan.agent_id ?? plan.user_id ?? plan.userId ?? plan.agentId;
          return String(planAgentId ?? '') === normalizedAgentId;
        });
      } catch (error) {
        console.warn('fetchMonthlyPlanifications error:', error);
        return [];
      }
    }

    async function fetchPermissionDaysRecord(agentId, monthValue) {
      try {
        if (!agentId || !monthValue) return null;
        const params = new URLSearchParams({
          agent_id: agentId,
          month: monthValue
        });
        const response = await fetch(`/api/permission-days?${params.toString()}`, {
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error(`Erreur ${response.status}`);
        const result = await response.json();
        const records = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result)
            ? result
            : [];
        return records.length > 0 ? records[0] : null;
      } catch (error) {
        console.warn('Erreur récupération jours permissionnaires:', error);
        return null;
      }
    }

    function summarizeActivitiesFromPlanifications(planifications = []) {
      if (!planifications.length) return null;

      const list = planifications.map(plan => ({
        id: plan.id,
        date: plan.date || plan.date_planification || plan.datePlanification || plan.day || plan.created_at,
        description: plan.description_activite || plan.activity_name || plan.description || 'Activité non spécifiée',
        result: plan.resultat_journee || plan.status || plan.result || 'planifie',
        project: plan.project_name || plan.project || null
      })).filter(item => !!item.date);

      const statusCounters = {
        total: list.length,
        realized: 0,
        notRealized: 0,
        inProgress: 0,
        partiallyRealized: 0,
        planned: 0,
        unknown: 0
      };

      list.forEach(item => {
        const status = detectActivityStatus(item.result);
        if (statusCounters[status] !== undefined) {
          statusCounters[status] += 1;
        } else {
          statusCounters.unknown += 1;
        }
      });

      const breakdownMap = new Map();
      list.forEach(item => {
        const key = normalizeActivityStatus(item.result || 'planifie');
        breakdownMap.set(key, (breakdownMap.get(key) || 0) + 1);
      });

      const breakdown = Array.from(breakdownMap.entries())
        .map(([key, count]) => ({
          key,
          label: REPORT_RESULT_LABELS[key] || key.replace(/_/g, ' '),
          count,
          percentage: list.length ? Math.round((count / list.length) * 1000) / 10 : 0
        }))
        .sort((a, b) => b.count - a.count);

      const executionRate = statusCounters.total > 0
        ? Math.round((statusCounters.realized / statusCounters.total) * 1000) / 10
        : 0;

      return {
        total: list.length,
        breakdown,
        list,
        hasMore: false,
        performance: {
          executionRate,
          totalPlanned: statusCounters.total,
          realized: statusCounters.realized,
          notRealized: statusCounters.notRealized,
          inProgress: statusCounters.inProgress,
          partiallyRealized: statusCounters.partiallyRealized,
          plannedOnly: statusCounters.planned,
          withoutStatus: statusCounters.unknown
        }
      };
    }

    // Récupérer les informations de l'utilisateur depuis l'API
    async function getUserProfile() {
      try {
        const headers = {
          'Content-Type': 'application/json'
        };
        const token = localStorage.getItem('jwt');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/profile', { headers });

        if (!response.ok) {
          if (response.status === 401) {
            window.location.href = '/login.html';
            return null;
          }
          throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // L'API peut retourner { success: true, user: {...} } ou directement {...}
        const profile = data.user || data;

        if (!profile) {
          throw new Error('Profil utilisateur introuvable');
        }

        return profile;
      } catch (error) {
        console.error('Erreur inattendue dans getUserProfile:', error);
        return null;
      }
    }

    // Initialiser la page du tableau de bord
    document.addEventListener('DOMContentLoaded', () => {
      setDashboardLocked(true);
      initializeDashboardPage();
    });

    function initializeDashboardPage() {
      // Attendre que le tableau de bord agent soit initialisé
      if (!window.agentDashboard) {
        setTimeout(initializeDashboardPage, 100);
        return;
      }

      // Set default month
      const today = new Date();
      const monthInput = document.getElementById('report-month-select');
      if (monthInput) {
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        monthInput.value = `${year}-${month}`;
        dashboardMonthFilter = monthInput.value;
      }

      // Load user info and agents
      loadAgentInfo().then(() => {
        return loadAgentsForReport();
      }).then(() => {
        // After loading agents, set up event listeners
        setupEventListeners();

        // If we have a selected agent and month, load the report
        if (dashboardAgentId && dashboardMonthFilter) {
          setDashboardLocked(false);
          loadMonthlyReport(dashboardMonthFilter, dashboardAgentId, {
            projectFilter: dashboardProjectFilter
          });
        } else {
          setDashboardLocked(true);
        }

        // Initial render
        renderDashboard();
      }).catch(error => {
        console.error('Error initializing dashboard:', error);
        setDashboardLocked(false);
        renderDashboard();
      });

      // Start motivation rotation
      startMotivationRotation();
    }

    async function loadAgentInfo(agentOverride = null) {
      try {
        console.log('Chargement des informations de l\'utilisateur...');
        let user = agentOverride;
        if (!user) {
          user = await getUserProfile();
        }

        if (!user) {
          console.error('Aucun utilisateur connecté');
          return;
        }

        console.log('Données utilisateur récupérées:', user);

        // Mettre à jour l'avatar
        const avatar = document.getElementById('agent-avatar');
        if (avatar) {
          const firstName = user.first_name || '';
          const lastName = user.last_name || '';
          const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
          avatar.textContent = initials || user.email?.charAt(0).toUpperCase() || 'A';
        }

        // Mettre à jour le nom
        const nameElement = document.getElementById('agent-name');
        if (nameElement) {
          // Essayer plusieurs champs possibles pour le nom
          const fullName = user.name ||
            [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
            [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

          if (fullName) {
            nameElement.textContent = fullName;
          } else if (user.email) {
            nameElement.textContent = user.email.split('@')[0];
          } else {
            nameElement.textContent = 'Utilisateur';
          }
        }

        // Mettre à jour le rôle
        const roleElement = document.getElementById('agent-role');
        if (roleElement) {
          const roleNames = {
            'agent': 'Agent de Terrain',
            'superviseur': 'Superviseur',
            'admin': 'Administrateur',
            'superadmin': 'Super Administrateur'
          };

          const userRole = user.role || 'agent';
          roleElement.textContent = roleNames[userRole] || 'Utilisateur';
        }
      } catch (error) {
        console.error('Erreur lors du chargement des informations utilisateur:', error);

        // Afficher un message d'erreur à l'utilisateur
        const nameElement = document.getElementById('agent-name');
        if (nameElement) {
          nameElement.textContent = 'Erreur de chargement';
        }

        const roleElement = document.getElementById('agent-role');
        if (roleElement) {
          roleElement.textContent = 'Veuillez rafraîchir la page';
        }
      }
    }

    function getCurrentAgentProject() {
      if (dashboardProjectFilter) {
        return dashboardProjectFilter;
      }

      const projectName = dashboardSelectedAgent?.project_name
        || dashboardSelectedAgent?.project
        || dashboardSelectedAgent?.projectName;
      return projectName ? projectName.trim() : null;
    }

    function renderDashboard() {
      window.agentDashboard.renderDashboard();
      loadLeaderboard();
      const agentId = dashboardAgentId || window.agentDashboard?.getCurrentAgent()?.id;
      loadPerformanceStats(agentId);
      loadPresenceStats(agentId);
    }

    function setDashboardLocked(isLocked) {
      const content = document.getElementById('dashboard-content');
      const notice = document.getElementById('dashboard-locked-notice');
      if (!content || !notice) return;
      if (isLocked) {
        content.classList.add('d-none');
        notice.classList.remove('d-none');
      } else {
        content.classList.remove('d-none');
        notice.classList.add('d-none');
      }
    }

    function buildProjectActivityRanking(planifications = []) {
      if (!Array.isArray(planifications) || planifications.length === 0) {
        return [];
      }

      const statsByAgent = new Map();

      planifications.forEach(plan => {
        const rawAgentId = plan?.agent_id ?? plan?.user_id ?? plan?.userId ?? plan?.agentId;
        if (!rawAgentId && rawAgentId !== 0) return;
        const agentKey = String(rawAgentId);

        if (!statsByAgent.has(agentKey)) {
          const rawProjectName =
            plan?.project_name ||
            plan?.project ||
            plan?.agent?.project_name ||
            dashboardProjectFilter ||
            '';

          const nameCandidates = [
            plan?.agent?.name,
            `${plan?.agent?.first_name || ''} ${plan?.agent?.last_name || ''}`.trim(),
            `${plan?.first_name || ''} ${plan?.last_name || ''}`.trim(),
            plan?.agent?.email,
            plan?.email
          ].filter(Boolean);

          const agentName = nameCandidates[0] || `Agent ${agentKey}`;
          const projectKey = normalizeProjectIdentifier(rawProjectName);
          const projectName = formatProjectDisplay(rawProjectName);

          statsByAgent.set(agentKey, {
            agentId: agentKey,
            agentName,
            projectName,
            projectKey,
            total: 0,
            realized: 0,
            partially: 0,
            notRealized: 0,
            inProgress: 0
          });

          const knownName = getAgentDisplayNameById(agentKey);
          if (knownName) {
            statsByAgent.get(agentKey).agentName = knownName;
          }

          const knownProject = getAgentProjectNameById(agentKey);
          if (knownProject && knownProject !== 'Projet non attribué') {
            statsByAgent.get(agentKey).projectName = knownProject;
            statsByAgent.get(agentKey).projectKey = normalizeProjectIdentifier(knownProject);
          }
        }

        const agentStats = statsByAgent.get(agentKey);
        agentStats.total += 1;

        const status = detectActivityStatus(
          plan?.resultat_journee || plan?.status || plan?.result || ''
        );

        switch (status) {
          case 'realized':
            agentStats.realized += 1;
            break;
          case 'partiallyRealized':
            agentStats.partially += 1;
            break;
          case 'inProgress':
            agentStats.inProgress += 1;
            break;
          case 'notRealized':
          case 'planned':
          case 'unknown':
          default:
            agentStats.notRealized += 1;
            break;
        }
      });

      return [...statsByAgent.values()]
        .map(stats => {
          const displayProject = formatProjectDisplay(stats.projectName || dashboardProjectFilter || '');
          return {
            ...stats,
            projectName: displayProject,
            projectKey: stats.projectKey || normalizeProjectIdentifier(displayProject),
            agentName: stats.agentName || getAgentDisplayNameById(stats.agentId) || `Agent ${stats.agentId}`,
            tep: stats.total ? Math.round((stats.realized / stats.total) * 1000) / 10 : 0
          };
        })
        .sort((a, b) => {
          if (b.tep !== a.tep) return b.tep - a.tep;
          if (b.realized !== a.realized) return b.realized - a.realized;
          return a.agentName.localeCompare(b.agentName);
        });
    }

    function buildFallbackLeaderboard(agents = []) {
      return agents.map(agent => ({
        id: agent.id,
        name: agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email || 'Agent',
        project: formatProjectDisplay(agent.project_name),
        score: 0,
        attendanceDays: 0,
        permissionDays: 0,
        checkins: 0,
        fieldTime: 0
      }));
    }

    function renderLeaderboardTable() {
      const container = document.getElementById('leaderboard-container');
      if (!container) return;

      if (!leaderboardCache.length) {
        container.innerHTML = `
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              Aucune donnée de classement disponible pour le moment.
            </div>
          `;
        return;
      }

      const filterValue = leaderboardProjectFilter?.trim() || '';
      const normalizedFilter = normalizeProjectIdentifier(filterValue);
      const filteredEntries = normalizedFilter
        ? leaderboardCache.filter(entry => normalizeProjectIdentifier(formatProjectDisplay(entry.project)) === normalizedFilter)
        : leaderboardCache;

      const currentUserId = Number(dashboardAgentId || 0);
      const rows = filteredEntries.map((entry, index) => `
          <tr class="${Number(entry.id) === currentUserId ? 'current-agent' : ''}">
            <td class="rank-cell">#${index + 1}</td>
            <td class="agent-name-cell">
              <div class="fw-semibold">${entry.name}</div>
              <small class="text-muted">${formatProjectDisplay(entry.project)}</small>
            </td>
            <td class="score-cell">${Math.round(entry.score || 0)} pts</td>
            <td style="text-align: center;">${entry.attendanceDays || 0}</td>
            <td style="text-align: center;">${entry.permissionDays || 0}</td>
            <td style="text-align: center;">${Number(entry.fieldTime || 0).toFixed(1)}h</td>
          </tr>
        `).join('');

      const projectOptions = leaderboardProjects.map(project => `
          <option value="${project}">${project}</option>
        `).join('');

      const leaderboardLegend = normalizedFilter
        ? `Classement restreint aux pairs du projet <strong>${escapeHtml(filterValue)}</strong>`
        : 'Classement basé sur les présences et jours permissionnaires récents';

      container.innerHTML = `
          <div class="d-flex flex-wrap align-items-end gap-3 mb-3">
            <div>
              <label for="leaderboard-project-filter" class="form-label text-muted small mb-1">
                <i class="bi bi-filter-square me-1"></i>Projet
              </label>
              <select id="leaderboard-project-filter" class="form-select form-select-sm">
                <option value="">Tous les projets</option>
                ${projectOptions}
              </select>
            </div>
            <div class="ms-auto text-muted small">
                  ${leaderboardLegend}
            </div>
          </div>
          <div class="table-responsive">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th style="width: 80px;">Rang</th>
                  <th>Agent</th>
                  <th style="text-align: right;">Score</th>
                  <th style="text-align: center;">Jours de présence</th>
                  <th style="text-align: center;">Jours permissionnaires</th>
                  <th style="text-align: center;">Heures terrain</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `
                  <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                      Aucun agent trouvé pour ce projet.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        `;

      const select = document.getElementById('leaderboard-project-filter');
      if (select) {
        select.value = filterValue;
        select.addEventListener('change', event => {
          leaderboardProjectFilter = event.target.value || null;
          renderLeaderboardTable();
        });
      }
    }

    // Fonction pour charger le classement depuis l'API
    async function loadLeaderboard() {
      const container = document.getElementById('leaderboard-container');
      if (!container) return;

      container.innerHTML = `
          <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-2 mb-0">Chargement du classement...</p>
          </div>
        `;

      try {
        const agentsResponse = await fetch('/api/admin/agents', {
          headers: { 'Content-Type': 'application/json' }
        });

        let agents = [];
        if (agentsResponse.ok) {
          const agentsData = await agentsResponse.json();
          agents = Array.isArray(agentsData) ? agentsData : (agentsData.data || []);
        }

        const filteredAgents = agents.filter(a =>
          (a.role === 'agent' || !a.role || a.role === 'AGENT') && a.id
        );

        let leaderboardData = [];
        try {
          const leaderboardResponse = await fetch('/api/agent/leaderboard', {
            headers: { 'Content-Type': 'application/json' }
          });
          if (leaderboardResponse.ok) {
            const leaderboardResult = await leaderboardResponse.json();
            if (leaderboardResult.success && Array.isArray(leaderboardResult.data)) {
              leaderboardData = leaderboardResult.data.map(item => ({
                id: item.agent_id || item.user_id || item.id,
                name: item.agent_name || item.name || 'Agent',
                project: formatProjectDisplay(item.project || item.project_name),
                score: item.score || 0,
                attendanceDays: item.attendanceDays || item.presenceDays || 0,
                permissionDays: item.permissionDays || item.permission_days || 0,
                checkins: item.checkins || 0,
                fieldTime: item.fieldTime || item.hours || 0
              }));
            }
          }
        } catch (error) {
          console.warn('Erreur récupération leaderboard (non critique):', error);
        }

        if (leaderboardData.length === 0) {
          leaderboardData = buildFallbackLeaderboard(filteredAgents);
        }

        leaderboardData.sort((a, b) => b.score - a.score);
        leaderboardCache = leaderboardData;
        leaderboardProjects = [...new Set(leaderboardData.map(entry => formatProjectDisplay(entry.project)))]
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));

        const preferredProject = getCurrentAgentProject();
        const preferredProjectFormatted = preferredProject ? formatProjectDisplay(preferredProject) : '';
        if (preferredProjectFormatted && !leaderboardProjects.includes(preferredProjectFormatted)) {
          leaderboardProjects = [...leaderboardProjects, preferredProjectFormatted]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        }
        const preferredInList = preferredProjectFormatted && leaderboardProjects.includes(preferredProjectFormatted) ? preferredProjectFormatted : '';

        if (!leaderboardProjectFilter) {
          leaderboardProjectFilter = preferredInList || '';
        } else if (leaderboardProjectFilter && leaderboardProjectFilter !== '' && !leaderboardProjects.includes(leaderboardProjectFilter)) {
          leaderboardProjectFilter = preferredInList || '';
        }

        renderLeaderboardTable();
      } catch (error) {
        console.error('Erreur lors du chargement du classement:', error);
        container.innerHTML = `
            <div class="alert alert-warning">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Impossible de charger le classement. Veuillez réessayer plus tard.
            </div>
          `;
      }
    }

    async function generateAiRecommendations() {
      if (aiGenerationInProgress) return;
      const monthValue = dashboardMonthValue || lastMonthlyReportParams.monthValue;
      const agentId = dashboardAgentId || lastMonthlyReportParams.agentId;

      if (!agentId || !monthValue) {
        alert('Veuillez sélectionner un agent et un mois avant de générer des recommandations IA.');
        return;
      }

      aiGenerationInProgress = true;
      try {
        await loadMonthlyReport(monthValue, agentId, { includeAI: true });
      } catch (error) {
        console.error('Erreur recommandation IA:', error);
        alert('Impossible de générer les recommandations IA pour le moment.');
      } finally {
        aiGenerationInProgress = false;
      }
    }

    // Fonction pour charger les statistiques de performance
    async function loadPerformanceStats(targetAgentId = dashboardAgentId) {
      const container = document.getElementById('performance-container');
      if (!container) return;

      try {
        const agentId = targetAgentId || window.agentDashboard?.getCurrentAgent()?.id;
        const missionsUrl = agentId ? `/api/me/missions?agent_id=${agentId}` : '/api/me/missions';
        const checkinsUrl = agentId ? `/api/checkins?user_id=${agentId}` : '/api/checkins';

        const missionsResponse = await fetch(missionsUrl, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        let missions = [];
        if (missionsResponse.ok) {
          const missionsData = await missionsResponse.json();
          missions = Array.isArray(missionsData) ? missionsData : (missionsData.missions || []);
        }

        const checkinsResponse = await fetch(checkinsUrl, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        let checkins = [];
        if (checkinsResponse.ok) {
          const checkinsData = await checkinsResponse.json();
          checkins = Array.isArray(checkinsData) ? checkinsData : (checkinsData.checkins || []);
        }

        // Calculer les statistiques
        const totalMissions = missions.length;
        const completedMissions = missions.filter(m => m.status === 'completed' || m.status === 'terminated').length;
        const pendingMissions = missions.filter(m => m.status === 'pending' || m.status === 'active').length;
        const completionRate = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0;
        const totalCheckins = checkins.length;
        const avgCheckinsPerDay = totalCheckins > 0 ? (totalCheckins / 30).toFixed(1) : 0;

        const html = `
            <div class="table-responsive">
              <table class="stats-table">
                <thead>
                  <tr>
                    <th>Indicateur</th>
                    <th style="text-align: right;">Valeur</th>
                    <th style="text-align: center;">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="stat-label">Missions complétées</td>
                    <td class="stat-value" style="text-align: right;">${completedMissions}</td>
                    <td style="text-align: center;">sur ${totalMissions} total</td>
                  </tr>
                  <tr>
                    <td class="stat-label">Taux de complétion</td>
                    <td class="stat-value" style="text-align: right;">${completionRate}%</td>
                    <td style="text-align: center;">${pendingMissions} en cours</td>
                  </tr>
                  <tr>
                    <td class="stat-label">Total check-ins</td>
                    <td class="stat-value" style="text-align: right;">${totalCheckins}</td>
                    <td style="text-align: center;">${avgCheckinsPerDay} / jour (moy.)</td>
                  </tr>
                  <tr>
                    <td class="stat-label">Missions en attente</td>
                    <td class="stat-value" style="text-align: right;">${pendingMissions}</td>
                    <td style="text-align: center;">À compléter</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;

        container.innerHTML = html;
      } catch (error) {
        console.error('Erreur lors du chargement des performances:', error);
        container.innerHTML = `
            <div class="alert alert-warning">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Impossible de charger les performances. Veuillez réessayer plus tard.
            </div>
          `;
      }
    }

    // Fonction pour charger les statistiques de présence
    async function loadPresenceStats(targetAgentId = dashboardAgentId) {
      const container = document.getElementById('stats-container');
      if (!container) return;

      try {
        // Récupérer les check-ins des 30 derniers jours
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);

        const userParam = targetAgentId ? `&user_id=${targetAgentId}` : '';
        const response = await fetch(`/api/checkins?from=${startDate.toISOString()}&to=${endDate.toISOString()}${userParam}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        let checkins = [];
        if (response.ok) {
          const data = await response.json();
          checkins = Array.isArray(data) ? data : (data.checkins || data.data || []);
        }

        // Calculer les statistiques
        const totalCheckins = checkins.length;
        const uniqueDays = new Set(checkins.map(c => {
          const date = new Date(c.timestamp || c.created_at);
          return date.toISOString().split('T')[0];
        })).size;

        const avgPerDay = uniqueDays > 0 ? (totalCheckins / uniqueDays).toFixed(1) : 0;
        const workingDays = 22; // Jours ouvrés moyens par mois
        const presenceRate = workingDays > 0 ? Math.round((uniqueDays / workingDays) * 100) : 0;

        if (totalCheckins === 0 && checkins.length === 0) {
          container.innerHTML = `
              <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                Aucune donnée de présence disponible pour les 30 derniers jours.
              </div>
            `;
          return;
        }

        const html = `
            <div class="stats-grid-table">
              <div class="stat-card-table" style="border-left-color: #007bff;">
                <div class="stat-label">Total Check-ins</div>
                <div class="stat-value">${totalCheckins}</div>
                <div class="stat-change">30 derniers jours</div>
              </div>
              <div class="stat-card-table" style="border-left-color: #28a745;">
                <div class="stat-label">Jours avec activité</div>
                <div class="stat-value">${uniqueDays}</div>
                <div class="stat-change">${presenceRate}% de présence</div>
              </div>
              <div class="stat-card-table" style="border-left-color: #ffc107;">
                <div class="stat-label">Moyenne / jour</div>
                <div class="stat-value">${avgPerDay}</div>
                <div class="stat-change">check-ins quotidiens</div>
              </div>
            </div>
          `;

        container.innerHTML = html;
      } catch (error) {
        console.warn('Erreur lors du chargement des statistiques (non critique):', error);
        container.innerHTML = `
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              Les statistiques de présence seront disponibles une fois que vous aurez effectué des check-ins.
            </div>
          `;
      }
    }

    function setupEventListeners() {
      // Écouter les mises à jour des statistiques
      document.addEventListener('agentStatsUpdated', () => {
        renderDashboard();
      });

      // Écouter les nouveaux badges
      document.addEventListener('badgeEarned', (event) => {
        const badge = event.detail.badge;
        showBadgeCelebration(badge);
        renderDashboard();
      });

      // Écouter les nouvelles réalisations
      document.addEventListener('achievementAdded', (event) => {
        const achievement = event.detail.achievement;
        showAchievementNotification(achievement);
        renderDashboard();
      });

      // Add event listeners for filter changes
      const agentSelect = document.getElementById('report-agent-select');
      const projectSelect = document.getElementById('report-project-select');
      const monthSelect = document.getElementById('report-month-select');
      const applyFilterBtn = document.getElementById('generate-report-btn');

      if (agentSelect) {
        agentSelect.addEventListener('change', (e) => {
          const agentId = e.target.value;
          if (agentId) {
            const agent = findAgentById(agentId);
            if (agent) {
              dashboardAgentId = agentId;
              dashboardSelectedAgent = agent;
              syncProjectSelectWithAgent(agent, { force: true });
            }
          }
        });
      }

      if (projectSelect) {
        projectSelect.addEventListener('change', (e) => {
          dashboardProjectFilter = e.target.value;
          projectSelectTouched = true;
        });
      }

      if (monthSelect) {
        monthSelect.addEventListener('change', (e) => {
          dashboardMonthFilter = e.target.value;
        });
      }

      if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', () => {
          applyDashboardFilter();
        });
      }
    }

    function showBadgeCelebration(badge) {
      // Créer une animation de célébration pour le badge
      const celebration = document.createElement('div');
      celebration.className = 'badge-celebration';
      celebration.innerHTML = `
          <div class="celebration-content">
            <div class="celebration-icon">${badge.icon}</div>
            <div class="celebration-text">
              <h4>🏆 Nouveau Badge!</h4>
              <p>${badge.name}</p>
            </div>
          </div>
        `;

      // Styles CSS pour l'animation
      celebration.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: linear-gradient(135deg, #ffc107, #ff9800);
          color: white;
          padding: 30px;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          z-index: 10000;
          animation: badgeCelebration 3s ease-in-out;
        `;

      const style = document.createElement('style');
      style.textContent = `
          @keyframes badgeCelebration {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
          }
          .celebration-content {
            text-align: center;
          }
          .celebration-icon {
            font-size: 48px;
            margin-bottom: 15px;
          }
          .celebration-text h4 {
            margin: 0 0 10px 0;
            font-size: 24px;
          }
          .celebration-text p {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
          }
        `;
      document.head.appendChild(style);

      document.body.appendChild(celebration);

      // Supprimer après 3 secondes
      setTimeout(() => {
        if (document.body.contains(celebration)) {
          document.body.removeChild(celebration);
        }
      }, 3000);
    }

    function showAchievementNotification(achievement) {
      // Afficher une notification pour la nouvelle réalisation
      if (window.notificationManager) {
        window.notificationManager.sendNotification('🎉 Nouvelle Réalisation!', {
          body: achievement.title,
          tag: 'achievement',
          requireInteraction: true
        });
      }
    }

    function startMotivationRotation() {
      const quoteElement = document.getElementById('motivation-quote');
      const authorElement = document.querySelector('.quote-author');
      let currentQuoteIndex = 0;

      function showNextQuote() {
        if (!quoteElement) return;
        const quote = motivationQuotes[currentQuoteIndex];
        quoteElement.innerHTML = `
            <div class="quote-text">"${quote.text}"</div>
            <div class="quote-author">- ${quote.author}</div>
          `;
        currentQuoteIndex = (currentQuoteIndex + 1) % motivationQuotes.length;
      }

      // Mettre à jour la citation toutes les 30 secondes
      setInterval(showNextQuote, 30000);

      // Mettre à jour immédiatement
      showNextQuote();
    }

    // Fonction pour rafraîchir le tableau de bord
    function refreshDashboard() {
      window.agentDashboard.loadAgentData().then(() => {
        renderDashboard();
      });
    }

    // Exposer la fonction globalement
    window.refreshDashboard = refreshDashboard;

    // Gestionnaire pour les boutons de génération d'IA
    document.addEventListener('click', async function (e) {
      if (e.target.closest('.generate-ai-summary')) {
        e.preventDefault();
        const button = e.target.closest('.generate-ai-summary');
        const type = button.dataset.type || 'concise';

        // Désactiver le bouton pendant le chargement
        button.disabled = true;
        const originalContent = button.innerHTML;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Génération...';

        try {
          await generateAiSummary(type);
        } catch (error) {
          console.error('Erreur lors de la génération du résumé:', error);
          const container = document.querySelector('.ai-summary-container');
          if (container) {
            container.innerHTML = `
                    <div class="alert alert-danger mt-2">
                      <i class="bi bi-exclamation-triangle me-2"></i>
                      Erreur lors de la génération du résumé: ${error.message}
                    </div>
                  `;
          }
        } finally {
          // Réactiver le bouton
          button.disabled = false;
          button.innerHTML = originalContent;
        }
      }
    });

    // Fonction pour générer un résumé IA
    async function generateAiSummary(type = 'concise') {
      // Nettoyer les anciens écouteurs et timers
      if (typeof cleanupTimers === 'function') {
        cleanupTimers();
      }

      const section = document.getElementById('ai-summary-section');
      if (!section) return;

      // Afficher l'indicateur de chargement
      const container = section.querySelector('.ai-summary-container');
      if (!container) return;

      container.innerHTML = `
              <div class="ai-loading">
                <div class="spinner-border text-primary mb-2" role="status">
                  <span class="visually-hidden">Chargement...</span>
                </div>
                <p class="mb-0">Génération de l'analyse en cours...</p>
                <small class="text-muted">Veuillez patienter</small>
              </div>
            `;

      try {
        // Récupérer le jeton CSRF
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

        // Préparer les données pour l'API
        const requestData = {
          agentId: document.querySelector('[name="agent_id"]')?.value || '',
          month: document.querySelector('[name="month"]')?.value || '',
          type: type,
          _token: csrfToken,
          includeSuggestions: true
        };

        // Envoyer la requête à l'API
        const response = await fetch('/api/generate-ai-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken
          },
          body: JSON.stringify(requestData)
        });

        if (!response.ok) {
          throw new Error('Erreur lors de la génération du résumé');
        }

        const data = await response.json();

        if (data.success) {
          // Recharger le rapport pour afficher le nouveau résumé
          const monthSelect = document.querySelector('[name="month"]');
          const agentId = document.querySelector('[name="agent_id"]')?.value || '';
          loadMonthlyReport(
            monthSelect ? monthSelect.value : '',
            agentId,
            { includeAI: true }
          );
        } else {
          throw new Error(data.error || 'Erreur lors de la génération');
        }
      } catch (error) {
        console.error('Erreur lors de la génération du résumé IA:', error);
        const container = document.querySelector('.ai-summary-container');
        if (container) {
          container.innerHTML = `
                  <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Erreur lors de la génération du résumé: ${error.message}
                  </div>
                `;
        }
      }
    }

    // Fonction pour obtenir l'ID utilisateur depuis l'API
    async function getUserId() {
      try {
        const response = await fetch('/api/profile', {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // L'API peut retourner { success: true, user: {...} } ou directement {...}
        const profile = data.user || data;

        // Vérifier plusieurs champs possibles pour l'ID
        const userId = profile?.id || profile?.user_id || profile?.userId;

        if (userId) {
          return userId;
        }

        throw new Error('ID utilisateur introuvable dans le profil');
      } catch (e) {
        console.error('Erreur lors de la récupération de l\'ID utilisateur:', e);
        throw new Error('Impossible de récupérer l\'ID utilisateur');
      }
    }

    // Fonction pour charger la liste des agents pour le sélecteur
    /**
     * Charge la liste des agents et des superviseurs pour le filtre
     */
    async function loadAgentsForReport() {
      console.log('Chargement de la liste des agents et superviseurs...');
      const select = document.getElementById('report-agent-select');
      if (!select) {
        console.error('Élément select des agents non trouvé');
        return;
      }

      try {
        // Afficher un indicateur de chargement
        select.innerHTML = '<option value="">Chargement des utilisateurs...</option>';

        // Récupérer le profil de l'utilisateur connecté
        const user = await getUserProfile();
        console.log('Profil utilisateur chargé:', user);

        // Déterminer le rôle et les permissions
        const userRole = (user?.role || user?.user?.role || 'agent').toLowerCase();
        const isAdmin = ['admin', 'administrateur'].includes(userRole);
        const isSupervisor = isAdmin || ['superviseur', 'supervisor'].includes(userRole);
        const currentUserId = user?.id || user?.user_id || await getUserId();

        console.log(`Utilisateur: ID=${currentUserId}, Rôle=${userRole}, Admin=${isAdmin}, Superviseur=${isSupervisor}`);

        // Créer l'entrée de l'utilisateur courant
        const currentUserEntry = {
          id: Number(currentUserId),
          name: user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Moi',
          first_name: user?.first_name,
          last_name: user?.last_name,
          email: user?.email,
          role: userRole,
          project: user?.project,
          project_name: formatProjectDisplay(user?.project_name || user?.project || 'Projet non attribué')
        };

        // Si l'utilisateur n'est ni admin ni superviseur, il ne peut voir que son propre profil
        if (!isAdmin && !isSupervisor) {
          console.log('Utilisateur standard, chargement du profil utilisateur uniquement');
          dashboardAgents = [currentUserEntry];
          dashboardAgentId = String(currentUserId);
          dashboardSelectedAgent = currentUserEntry;
          select.innerHTML = `<option value="${currentUserId}">Moi</option>`;
          select.value = currentUserId;
          populateProjectFilterOptions(dashboardAgents);
          syncProjectSelectWithAgent(currentUserEntry, { force: true });
          return;
        }

        console.log('Chargement de la liste complète des utilisateurs...');

        // Récupérer tous les utilisateurs (agents et superviseurs)
        const token = localStorage.getItem('jwt');
        if (!token) {
          console.error('No JWT token found in localStorage');
          throw new Error('Non authentifié. Veuillez vous reconnecter.');
        }

        console.log('Fetching agents from /api/agents with token:', token.substring(0, 10) + '...');

        let agents = [];

        try {
          const response = await fetch('/api/agents', {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            cache: 'no-store'
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error: ${response.status} - ${errorText}`);
            // En cas d'erreur 401 ou 403, forcer une déconnexion
            if (response.status === 401 || response.status === 403) {
              console.error('Session expirée ou non autorisée, déconnexion...');
              localStorage.removeItem('jwt');
              window.location.href = '/login.html?session_expired=1';
              return [currentUserEntry];
            }
            throw new Error(`Erreur lors de la récupération des agents: ${response.status} - ${errorText}`);
          }

          const responseData = await response.json();
          console.log(`API Response: ${responseData?.length || 0} utilisateurs récupérés`, responseData);

          if (!Array.isArray(responseData)) {
            console.error('Expected an array of agents but got:', typeof responseData, responseData);
            throw new Error('Format de réponse inattendu du serveur');
          }

          agents = responseData;

        } catch (error) {
          console.error('Erreur lors de la récupération des agents:', error);
          // En cas d'erreur, utiliser uniquement l'utilisateur courant
          return [currentUserEntry];
        }

        // S'assurer que les agents sont un tableau valide
        if (!Array.isArray(agents) || agents.length === 0) {
          console.warn('Aucun utilisateur trouvé dans la réponse ou format invalide');
          return [currentUserEntry];
        }

        // Formater les agents pour s'assurer que les champs nécessaires existent
        agents = agents.map(agent => ({
          id: Number(agent.id) || 0,
          name: agent.name || [agent.first_name, agent.last_name].filter(Boolean).join(' ').trim() || agent.email || `Utilisateur ${agent.id}`,
          first_name: agent.first_name || '',
          last_name: agent.last_name || '',
          email: agent.email || '',
          role: (agent.role || 'agent').toLowerCase(),
          project: agent.project || '',
          project_name: formatProjectDisplay(agent.project_name || agent.project || 'Projet non attribué')
        }));

        // Filtrer les utilisateurs selon le rôle de l'utilisateur connecté
        let filteredAgents = [];

        if (isAdmin) {
          // Les administrateurs voient tout le monde
          filteredAgents = [...agents];
        } else if (isSupervisor) {
          // Les superviseurs voient les agents et eux-mêmes
          filteredAgents = agents.filter(a =>
            (a.role === 'agent' || a.role === 'superviseur' || a.role === 'supervisor') ||
            a.id === currentUserId
          );

          // S'assurer que le superviseur se voit lui-même
          if (!filteredAgents.some(a => a.id === currentUserId)) {
            filteredAgents.push({
              ...currentUserEntry,
              id: Number(currentUserEntry.id)
            });
          }
        } else {
          // Les utilisateurs normaux ne voient qu'eux-mêmes
          filteredAgents = [{
            ...currentUserEntry,
            id: Number(currentUserEntry.id)
          }];
        }

        // S'assurer que les ID sont des nombres
        filteredAgents = filteredAgents.map(agent => ({
          ...agent,
          id: Number(agent.id),
          // S'assurer que le rôle est en minuscules
          role: (agent.role || 'agent').toLowerCase()
        }));

        // Trier les agents : d'abord les superviseurs, puis les agents, par ordre alphabétique
        filteredAgents.sort((a, b) => {
          // L'utilisateur actuel en premier
          if (a.id === currentUserId) return -1;
          if (b.id === currentUserId) return 1;

          // Ensuite les administrateurs
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;

          // Puis les superviseurs
          if ((a.role === 'superviseur' || a.role === 'supervisor') &&
            !['superviseur', 'supervisor', 'admin'].includes(b.role)) return -1;
          if (!['superviseur', 'supervisor', 'admin'].includes(a.role) &&
            (b.role === 'superviseur' || b.role === 'supervisor')) return 1;

          // Enfin trier par nom
          const nameA = (a.name || `${a.first_name || ''} ${a.last_name || ''}`).trim().toLowerCase();
          const nameB = (b.name || `${b.first_name || ''} ${b.last_name || ''}`).trim().toLowerCase();
          return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
        });

        // Mettre à jour la liste des agents dans le tableau de bord
        dashboardAgents = filteredAgents;

        // Mettre à jour la liste déroulante
        let options = [];

        // Ajouter l'utilisateur actuel en premier
        const currentUser = filteredAgents.find(a => a.id === currentUserId) || currentUserEntry;
        options.push(`<option value="${currentUserId}">Moi${isAdmin ? ' (Admin)' : isSupervisor ? ' (Superviseur)' : ''}</option>`);

        // Ajouter les autres utilisateurs
        filteredAgents.forEach(agent => {
          if (agent.id !== currentUserId) {
            const name = agent.name ||
              `${agent.first_name || ''} ${agent.last_name || ''}`.trim() ||
              agent.email ||
              `Utilisateur ${agent.id}`;

            let roleSuffix = '';
            if (agent.role === 'admin') {
              roleSuffix = ' (Admin)';
            } else if (agent.role === 'superviseur' || agent.role === 'supervisor') {
              roleSuffix = ' (Superviseur)';
            }

            options.push(`<option value="${agent.id}">${name}${roleSuffix}</option>`);
          }
        });

        // Mettre à jour le select
        select.innerHTML = options.join('\n');

        // Sélectionner l'utilisateur courant par défaut
        select.value = currentUserId;
        dashboardAgentId = String(currentUserId);
        dashboardSelectedAgent = currentUser;

        // Mettre à jour les filtres de projet
        populateProjectFilterOptions(dashboardAgents);
        syncProjectSelectWithAgent(currentUser, { force: true });

        console.log(`Liste des utilisateurs mise à jour avec ${filteredAgents.length} entrées`);

      } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);

        // Afficher un message d'erreur plus détaillé à l'utilisateur
        const errorMessage = `Erreur lors du chargement des utilisateurs: ${error.message || 'Erreur inconnue'}`;
        console.error(errorMessage);

        // Afficher une alerte à l'utilisateur
        if (!options.suppressAlerts) {
          alert(`Erreur: ${errorMessage}\n\nVeuillez rafraîchir la page ou contacter l'administrateur.`);
        }

        // En cas d'erreur, afficher uniquement l'utilisateur courant
        try {
          const userId = await getUserId();
          select.innerHTML = `<option value="${userId}">Moi (erreur de chargement)</option>`;
          select.value = userId;

          dashboardAgents = [{
            id: Number(userId),
            name: 'Moi',
            role: 'agent',
            project_name: 'Projet non attribué'
          }];

          dashboardAgentId = String(userId);
          dashboardSelectedAgent = dashboardAgents[0];

          populateProjectFilterOptions(dashboardAgents);
          syncProjectSelectWithAgent(dashboardSelectedAgent, { force: true });

        } catch (e) {
          console.error('Erreur lors de la récupération de l\'utilisateur courant:', e);
          select.innerHTML = '<option value="">Erreur de chargement des utilisateurs</option>';
        }
      }
    }

    /**
     * Find an agent by ID in the dashboardAgents array
     * @param {string|number} agentId - The ID of the agent to find
     * @returns {Object|null} The agent object or null if not found
     */
    function findAgentById(agentId) {
      if (!agentId || !dashboardAgents || !dashboardAgents.length) return null;
      return dashboardAgents.find(agent => String(agent.id) === String(agentId)) || null;
    }

    function getAgentDisplayNameById(agentId) {
      const agent = findAgentById(agentId);
      if (!agent) return null;
      const fullName = agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim();
      if (fullName) return fullName;
      if (agent.email) return agent.email.split('@')[0];
      return null;
    }

    function getAgentProjectNameById(agentId) {
      const agent = findAgentById(agentId);
      if (!agent) return null;
      return formatProjectDisplay(agent.project_name || agent.project || agent.projectName || '');
    }

    /**
     * Apply the selected filters and update the dashboard
     * @param {Object} options - Additional options
     * @param {boolean} [options.suppressAlerts=false] - Whether to suppress alert messages
     */
    async function applyDashboardFilter(options = {}) {
      try {
        console.log('Application des filtres...', {
          agentId: dashboardAgentId,
          projectFilter: dashboardProjectFilter,
          month: dashboardMonthFilter
        });
        
        const agentSelect = document.getElementById('report-agent-select');
        const projectSelect = document.getElementById('report-project-select');
        const monthSelect = document.getElementById('report-month-select');
        
        const agentId = agentSelect?.value?.trim();
        const monthValue = monthSelect?.value?.trim();
        const projectValue = projectSelect?.value?.trim();

        if (!agentId) {
          if (!options.skipValidation) alert('Veuillez sélectionner un agent');
          return;
        }
        if (!monthValue) {
          if (!options.skipValidation) alert('Veuillez sélectionner un mois');
          return;
        }
        if (!projectValue) {
          if (!options.skipValidation) {
            alert('Veuillez sélectionner un projet');
            return;
          }
        }

        dashboardAgentId = String(agentId);
        dashboardMonthValue = monthValue;
        if (projectValue) {
          dashboardProjectFilter = projectValue;
        }
        dashboardSelectedAgent = findAgentById(agentId) || { id: Number(agentId) };
        const agentProject = getCurrentAgentProject();
        if (agentProject) {
          // Format the project name to match the format used in leaderboard
          const formattedProject = formatProjectDisplay(agentProject);
          // Only set the filter if the formatted project exists in the leaderboard projects
          if (leaderboardProjects.length === 0 || leaderboardProjects.includes(formattedProject)) {
            leaderboardProjectFilter = formattedProject;
            if (leaderboardCache.length > 0) {
              renderLeaderboardTable();
            }
          }
        }

        await loadAgentInfo(dashboardSelectedAgent);
        if (window.agentDashboard?.setAgent) {
          await window.agentDashboard.setAgent({ ...dashboardSelectedAgent, id: Number(agentId) });
        }

        setDashboardLocked(false);

        await Promise.all([
          loadMonthlyReport(monthValue, agentId, { includeAI: false }),
          loadPerformanceStats(agentId),
          loadPresenceStats(agentId),
          initPresenceChart()
        ]);

      } catch (error) {
        console.error("Erreur lors de l'application des filtres:", error);
        if (!options.suppressAlerts) {
          alert("Erreur lors de l'application des filtres: " + error.message);
        }
      }

      // Fonction pour charger le rapport mensuel
      async function loadMonthlyReport(monthValue, agentId = null, options = {}) {
        const { includeAI = false } = options;
        const container = document.getElementById('monthly-report-container');
        if (!container) return;

        const currentRequestId = ++monthlyReportRequestId;

        container.innerHTML = `
          <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-2">Génération du rapport mensuel...</p>
          </div>
        `;

        try {
          // Utiliser l'agent sélectionné ou l'utilisateur actuel
          let userId = agentId;
          if (!userId) {
            const select = document.getElementById('report-agent-select');
            userId = select?.value;
          }

          if (!userId) {
            userId = await getUserId();
          }

          if (!userId) {
            throw new Error('Aucun agent sélectionné');
          }

          const monthRange = buildMonthRange(monthValue);
          const resolvedAgentId = Number.isFinite(Number(userId)) ? Number(userId) : userId;
          lastMonthlyReportParams = {
            agentId: resolvedAgentId,
            monthValue
          };

          const params = new URLSearchParams({
            agentId: userId,
            month: monthValue
          });
          params.set('ai', includeAI ? '1' : '0');
          if (dashboardProjectFilter) {
            params.set('project_name', dashboardProjectFilter);
          }

          // L'intercepteur dans app.js ajoutera automatiquement le token
          const response = await fetch(`/api/agents/monthly-report?${params.toString()}`, {
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            // Essayer de récupérer le message d'erreur détaillé
            let errorMessage = `Erreur ${response.status}: ${response.statusText}`;
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (e) {
              // Ignorer si on ne peut pas parser le JSON
            }
            throw new Error(errorMessage);
          }

          const report = await response.json();

          if (currentRequestId !== monthlyReportRequestId) {
            console.debug('Rapport mensuel ignoré (requête obsolète)', { agentId: userId, month: monthValue });
            return;
          }

          if (!report.success) {
            // Si l'erreur est liée aux présences, afficher un message plus clair
            const errorMsg = report.error || report.message || 'Erreur lors de la génération du rapport';
            if (errorMsg.includes('présences') || errorMsg.includes('checkins')) {
              throw new Error('Aucune donnée de présence trouvée pour cet agent ce mois-ci. Le rapport nécessite au moins un check-in.');
            }
            throw new Error(errorMsg);
          }

          try {
            const planifFilters = dashboardProjectFilter ? { projectName: dashboardProjectFilter } : {};
            const [monthlyCheckins, monthlyPlanifications] = await Promise.all([
              fetchMonthlyCheckins(resolvedAgentId, monthRange),
              fetchMonthlyPlanifications(resolvedAgentId, monthRange, planifFilters)
            ]);

            if (monthlyCheckins.length) {
              const computedPresence = summarizePresenceFromCheckins(monthlyCheckins, monthRange);
              if (computedPresence) {
                report.presence = { ...report.presence, ...computedPresence };
              }
            }

            if (monthlyPlanifications.length) {
              const computedActivities = summarizeActivitiesFromPlanifications(monthlyPlanifications);
              if (computedActivities) {
                report.activities = computedActivities;
              }
            }

            const agentProjectName =
              dashboardSelectedAgent?.project_name ||
              dashboardSelectedAgent?.project ||
              dashboardSelectedAgent?.projectName ||
              report?.meta?.agent?.project_name ||
              report?.meta?.agent?.project ||
              '';

            const projectForRanking = dashboardProjectFilter || agentProjectName;

            if (projectForRanking) {
              try {
                const projectPlanifications = await fetchMonthlyPlanifications(
                  null,
                  monthRange,
                  { projectName: projectForRanking }
                );
                const projectRanking = buildProjectActivityRanking(projectPlanifications);
                if (projectRanking.length) {
                  report.projectRanking = projectRanking;
                  report.projectRankingProject = projectForRanking;
                }
              } catch (projectRankingError) {
                console.warn('Erreur calcul classement projet:', projectRankingError);
              }
            }

            try {
              const permissionRecord = await fetchPermissionDaysRecord(resolvedAgentId, monthRange.value);
              if (permissionRecord && typeof permissionRecord.days !== 'undefined') {
                report.presence = report.presence || {};
                report.presence.permissionDays = Math.max(0, Number(permissionRecord.days) || 0);
              }
            } catch (permissionError) {
              console.warn('Erreur jours permissionnaires (rapport):', permissionError);
            }
          } catch (dataError) {
            console.warn('Erreur données mensuelles locales:', dataError);
          }

          renderMonthlyReport(report);
        } catch (error) {
          console.error('Erreur lors du chargement du rapport:', error);

          if (currentRequestId !== monthlyReportRequestId) {
            console.debug('Erreur rapport mensuel ignorée (requête obsolète)', { agentId, monthValue, error: error.message });
            return;
          }

          // Message d'erreur plus informatif
          let errorMessage = error.message;
          let suggestion = 'Veuillez vérifier que vous avez des données pour ce mois ou réessayer plus tard.';

          if (errorMessage.includes('présences') || errorMessage.includes('checkins')) {
            suggestion = 'Assurez-vous que l\'agent sélectionné a effectué des check-ins pendant ce mois.';
          } else if (errorMessage.includes('500')) {
            suggestion = 'Une erreur serveur s\'est produite. Veuillez contacter l\'administrateur si le problème persiste.';
          }

          container.innerHTML = `
            <div class="alert alert-warning">
              <i class="bi bi-exclamation-triangle me-2"></i>
              <strong>Impossible de charger le rapport mensuel</strong>
              <p class="mb-1 mt-2"><strong>Erreur:</strong> ${errorMessage}</p>
              <small class="text-muted">${suggestion}</small>
            </div>
          `;
        }
      }

      function renderProjectRankingSection(ranking = [], options = {}) {
        if (!Array.isArray(ranking) || ranking.length === 0) return '';

        const {
          projectName = 'Projet',
          matchProjectName = '',
          agentId = null,
          periodLabel = ''
        } = options;

        const sanitizedProjectName = escapeHtml(projectName || 'Projet');
        const normalizedProject = normalizeProjectIdentifier(matchProjectName || projectName);

        const enrichedRanking = ranking.map(entry => ({
          ...entry,
          projectKey: entry.projectKey || normalizeProjectIdentifier(entry.projectName || entry.project || ''),
          total: entry.total ?? entry.planified ?? 0,
          realized: entry.realized ?? entry.completed ?? 0,
          partially: entry.partially ?? entry.partial ?? 0,
          notRealized: entry.notRealized ?? entry.failed ?? 0,
          tep: Number.isFinite(entry.tep) ? entry.tep : Number(entry.executionRate || entry.tepPercent || 0)
        }));

        const filteredRanking = normalizedProject
          ? enrichedRanking.filter(entry => entry.projectKey === normalizedProject)
          : enrichedRanking;

        const orderedRanking = filteredRanking
          .sort((a, b) => {
            const rankA = Number.isFinite(a.rank) ? a.rank : null;
            const rankB = Number.isFinite(b.rank) ? b.rank : null;
            if (rankA !== null && rankB !== null) return rankA - rankB;
            if (rankA !== null) return -1;
            if (rankB !== null) return 1;
            return (b.tep || 0) - (a.tep || 0);
          })
          .map((entry, index) => ({
            ...entry,
            displayRank: Number.isFinite(entry.rank) ? entry.rank : index + 1
          }));

        if (!orderedRanking.length) {
          return `
            <section class="report-section">
              <div class="report-section-header">
                <div>
                  <h5><i class="bi bi-trophy me-2"></i>Classement du projet ${sanitizedProjectName}</h5>
                  ${periodLabel ? `<small>Période ${escapeHtml(periodLabel)}</small>` : ''}
                </div>
              </div>
              <p class="text-muted mb-0">Aucun classement disponible pour ce projet sur la période sélectionnée.</p>
            </section>
          `;
        }

        const rows = orderedRanking.map(entry => {
          const isSelected = agentId && String(entry.agentId) === String(agentId);
          const tepValue = Number(entry.tep || 0);
          const tepClass = tepValue >= 80 ? 'text-success' : tepValue >= 60 ? 'text-warning' : 'text-danger';
          return `
            <tr class="${isSelected ? 'table-primary' : ''}">
              <td class="text-center fw-semibold">${entry.displayRank}</td>
              <td>
                <div class="fw-semibold">${escapeHtml(entry.agentName || 'Agent')}</div>
                <small class="text-muted">${escapeHtml(entry.projectName || projectName)}</small>
              </td>
              <td class="text-center">${entry.total}</td>
              <td class="text-center text-success fw-semibold">${entry.realized}</td>
              <td class="text-center text-warning">${entry.partially}</td>
              <td class="text-center text-danger">${entry.notRealized}</td>
              <td class="text-center fw-bold ${tepClass}">${tepValue.toFixed(1)}%</td>
            </tr>
          `;
        }).join('');

        return `
          <section class="report-section">
            <div class="report-section-header">
              <div>
                <h5><i class="bi bi-trophy me-2"></i>Classement du projet ${sanitizedProjectName}</h5>
                ${periodLabel ? `<small>Période ${escapeHtml(periodLabel)}</small>` : ''}
              </div>
              <div class="report-chip-group">
                <span class="report-chip">${orderedRanking.length} agent(s)</span>
              </div>
            </div>
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th style="width: 80px;" class="text-center">Rang</th>
                    <th>Agent</th>
                    <th class="text-center">Planifié</th>
                    <th class="text-center">Réalisé</th>
                    <th class="text-center">Partiel</th>
                    <th class="text-center">Non réalisé</th>
                    <th class="text-center">TEP (%)</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
            <p class="text-muted small mb-0 mt-3">
              Classement restreint aux pairs du même projet. TEP = (activités réalisées / planifiées) × 100 avec prise en compte des statuts partiels et non réalisés.
            </p>
          </section>
        `;
      }

      /**
       * Affiche le rapport mensuel avec les données fournies
       * @param {Object} report - Les données du rapport à afficher
       * @returns {void}
       */
      function renderMonthlyReport(report) {
        const container = document.getElementById('monthly-report-container');
        if (!container) return;

        const {
          meta = {},
          presence: presenceInput = {},
          activities: activitiesInput = {},
          objectives: objectivesInput = [],
          locations = [],
          photos: photosInput = [],
          comments: commentsInput = {}
        } = report;

        const presenceData = presenceInput || {};
        const activitiesData = activitiesInput || {};
        const breakdownList = Array.isArray(activitiesData.breakdown) ? activitiesData.breakdown : [];
        const activityList = Array.isArray(activitiesData.list) ? activitiesData.list : [];
        const objectiveList = Array.isArray(objectivesInput) ? objectivesInput : [];
        const commentsData = commentsInput || {};
        const rawPhotos = Array.isArray(photosInput) ? photosInput : [];
        const photosList = rawPhotos
          .filter(photo => photo && (photo.url || photo.path || photo.photoUrl || photo.photo_url || photo.file_url || photo.imageUrl))
          .slice(0, 2);

        const activityPerformance = activitiesData.performance || null;
        const referenceMonthLabel = meta?.month?.label || formatMonthLabel(lastMonthlyReportParams?.monthValue);
        const reportingProject = formatProjectDisplay(
          report.projectRankingProject ||
          meta?.agent?.project_name ||
          getCurrentAgentProject() ||
          ''
        );
        const agentDisplayName = meta?.agent?.name || meta?.agent?.display_name || 'Agent';
        const generationTimestamp = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
        const periodStart = meta?.month?.start ? new Date(meta.month.start).toLocaleDateString('fr-FR') : 'N/A';
        const periodEnd = meta?.month?.end ? new Date(meta.month.end).toLocaleDateString('fr-FR') : 'N/A';

        const projectMatchValue =
          report.projectRankingProject ||
          dashboardProjectFilter ||
          meta?.agent?.project_name ||
          '';

        const rankingSection = renderProjectRankingSection(report.projectRanking, {
          projectName: reportingProject || 'Projet',
          matchProjectName: projectMatchValue,
          agentId: meta?.agent?.id || lastMonthlyReportParams.agentId,
          periodLabel: referenceMonthLabel || ''
        });

        const chipItems = [];
        if (referenceMonthLabel) chipItems.push(`Mois ${referenceMonthLabel}`);
        if (reportingProject) chipItems.push(`Projet ${reportingProject}`);
        chipItems.push(`${presenceData.totalCheckins ?? 0} check-ins`);
        const chipGroup = chipItems.map(text => `<span class="report-chip">${escapeHtml(text)}</span>`).join('');
        const coverageLabel = dashboardProjectFilter ? 'Filtrage par projet actif' : 'Couverture globale de l’agent';

        const reportCoverSection = `
          <section class="report-section report-cover">
            <div class="report-section-header">
              <div>
                <h5>Rapport mensuel — ${escapeHtml(agentDisplayName)}</h5>
                <small>Généré le ${escapeHtml(generationTimestamp)}</small>
              </div>
              <div class="report-chip-group">
                ${chipGroup}
              </div>
            </div>
            <div class="report-cover-details">
              <div class="detail">
                <div class="label">Agent audité</div>
                <div class="value">${escapeHtml(agentDisplayName)}</div>
              </div>
              <div class="detail">
                <div class="label">Projet couvert</div>
                <div class="value">${escapeHtml(reportingProject || 'Non spécifié')}</div>
              </div>
              <div class="detail">
                <div class="label">Période calendaire</div>
                <div class="value">${escapeHtml(`${periodStart} → ${periodEnd}`)}</div>
              </div>
              <div class="detail">
                <div class="label">Sources utilisées</div>
                <div class="value">Planifications &amp; Check-ins CCRB</div>
              </div>
              <div class="detail">
                <div class="label">Portée analytique</div>
                <div class="value">${escapeHtml(coverageLabel)}</div>
              </div>
            </div>
          </section>
        `;

        const formatNumber = (value, decimals = 0) => {
          const num = Number(value);
          if (!Number.isFinite(num)) return '0';
          return num.toFixed(decimals);
        };

        const absenceDays = Math.max((presenceData.workingDays || 0) - (presenceData.workedDays || 0), 0);
        const presenceMetrics = [
          { label: 'Taux de présence', value: `${formatNumber(presenceData.presenceRate ?? 0, 1)}%` },
          { label: 'Jours de présence', value: `${presenceData.workedDays ?? 0} / ${presenceData.workingDays ?? 0}` },
          { label: 'Jours permissionnaires', value: `${presenceData.permissionDays ?? 0}` },
          { label: 'Check-ins total', value: `${presenceData.totalCheckins ?? 0}` },
          { label: 'Moyenne / jour', value: `${formatNumber(presenceData.averageCheckinsPerDay ?? 0, 1)}` },
          { label: 'Absences estimées', value: `${absenceDays}` }
        ].map(metric => `
          <div class="report-metric-card">
            <div class="metric-value">${escapeHtml(metric.value)}</div>
            <div class="metric-label">${escapeHtml(metric.label)}</div>
          </div>
        `).join('');

        const presenceSection = `
          <section class="report-section">
            <div class="report-section-header">
              <div>
                <h5><i class="bi bi-calendar-check me-2"></i>Tableau de présence</h5>
                <small>Indicateurs clés du mois</small>
              </div>
            </div>
            <div class="report-metrics-grid">
              ${presenceMetrics}
            </div>
          </section>
        `;

        const getBreakdownCount = (statusKey) => {
          const entry = breakdownList.find(item => item.key === statusKey);
          return entry ? entry.count : 0;
        };

        const formatActivityResult = (value) => {
          if (!value) return 'Non évalué';
          return String(value).replace(/_/g, ' ').toUpperCase();
        };

        const getResultBadgeClass = (value) => {
          const normalized = String(value || '').toLowerCase();
          if (normalized.includes('realise') && !normalized.includes('partiellement')) return 'bg-success';
          if (normalized.includes('partiel')) return 'bg-warning text-dark';
          if (normalized.includes('cours')) return 'bg-info text-dark';
          if (normalized.includes('non')) return 'bg-danger';
          return 'bg-secondary';
        };

        const formatActivityDate = (value) => {
          if (!value) return '-';
          const parsed = new Date(value);
          return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('fr-FR');
        };

        const realizedHighlights = activityList
          .filter(act => detectActivityStatus(act.result) === 'realized')
          .slice(0, 3);

        const pendingHighlights = activityList
          .filter(act => {
            const status = detectActivityStatus(act.result);
            return status === 'planned' || status === 'notRealized';
          })
          .slice(0, 3);

        const highlightList = (items) => items.length ? `
              <ul class="mb-0">
                ${items.map(act => `
                  <li>
                    <strong>${formatActivityDate(act.date)}</strong> — ${escapeHtml(act.description || 'Sans description')}
                    (${escapeHtml(formatActivityResult(act.result))})
                  </li>
                `).join('')}
              </ul>
            ` : '';

        const plannedTotal = activityPerformance?.totalPlanned ?? (activitiesData.total ?? 0);
        const realizedTotal = activityPerformance?.realized ?? getBreakdownCount('realise');
        const partiallyTotal = activityPerformance?.partiallyRealized ?? getBreakdownCount('partiellement_realise');
        const inProgressTotal = activityPerformance?.inProgress ?? getBreakdownCount('en_cours');
        const notRealizedTotal = activityPerformance?.notRealized ?? getBreakdownCount('non_realise');
        const withoutStatusTotal = activityPerformance?.withoutStatus
          ?? activityPerformance?.plannedOnly
          ?? Math.max(plannedTotal - (realizedTotal + partiallyTotal + inProgressTotal + notRealizedTotal), 0);
        const executionRate = activityPerformance?.executionRate
          ?? (plannedTotal > 0 ? Math.round((realizedTotal / plannedTotal) * 1000) / 10 : 0);
        const tepBadgeClass = executionRate >= 80 ? 'bg-success' : executionRate >= 60 ? 'bg-warning text-dark' : 'bg-danger';

        const activitySummaryTable = `
          <div class="table-responsive mb-4">
            <table class="table table-bordered align-middle text-center">
              <thead class="table-light">
                <tr>
                  <th>Planifié</th>
                  <th>Réalisé</th>
                  <th>Partiel</th>
                  <th>En cours</th>
                  <th>Non réalisé</th>
                  <th>Sans statut</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>${plannedTotal}</strong></td>
                  <td class="text-success fw-semibold">${realizedTotal}</td>
                  <td class="text-warning fw-semibold">${partiallyTotal}</td>
                  <td class="text-info fw-semibold">${inProgressTotal}</td>
                  <td class="text-danger fw-semibold">${notRealizedTotal}</td>
                  <td class="text-muted fw-semibold">${withoutStatusTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;

        const activityKpiTable = `
          <div class="table-responsive mb-4">
            <table class="table table-striped align-middle">
              <thead class="table-light">
                <tr>
                  <th style="width: 35%;">Indicateur</th>
                  <th style="width: 20%;">Valeur</th>
                  <th>Observation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>TEP (réalisé / planifié)</td>
                  <td>
                    <span class="badge ${tepBadgeClass}">${executionRate.toFixed(1)}%</span>
                  </td>
                  <td>${realizedTotal}/${plannedTotal} activités totalement réalisées</td>
                </tr>
                <tr>
                  <td>Activités partiellement réalisées</td>
                  <td>${partiallyTotal}</td>
                  <td>Actions complémentaires à planifier</td>
                </tr>
                <tr>
                  <td>Activités en cours</td>
                  <td>${inProgressTotal}</td>
                  <td>Suivi en cours de période</td>
                </tr>
                <tr>
                  <td>Activités non réalisées</td>
                  <td>${notRealizedTotal}</td>
                  <td>Analyse des causes à prévoir</td>
                </tr>
                <tr>
                  <td>Activités sans statut</td>
                  <td>${withoutStatusTotal}</td>
                  <td>Saisie des résultats attendue</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;

        const shouldRenderActivities =
          (plannedTotal ?? 0) > 0 ||
          (realizedTotal ?? 0) > 0 ||
          (partiallyTotal ?? 0) > 0 ||
          (inProgressTotal ?? 0) > 0 ||
          (notRealizedTotal ?? 0) > 0 ||
          breakdownList.length > 0 ||
          activityList.length > 0;

        const activityNarrative = !shouldRenderActivities ? '' : `
              <div class="activity-narrative mb-4">
                <p>
                  ${realizedTotal > 0
            ? `Au cours du mois, <strong>${realizedTotal}</strong> activité${realizedTotal > 1 ? 's ont été menées' : ' a été menée'} à terme, en complément des ${partiallyTotal} actions partiellement clôturées.`
            : 'Aucune activité n’a été déclarée comme totalement réalisée ce mois-ci.'}
                </p>
                ${(plannedTotal > 0 || notRealizedTotal > 0 || inProgressTotal > 0) ? `
                  <p>
                    ${plannedTotal > 0 ? `Sur <strong>${plannedTotal}</strong> interventions planifiées,` : 'Concernant les interventions planifiées,'}
                    ${notRealizedTotal > 0 ? `<strong>${notRealizedTotal}</strong> sont restées non réalisées` : 'la plupart ont été exécutées'}
                    ${inProgressTotal > 0 ? `et ${inProgressTotal} sont encore en cours de finalisation` : ''}.
                    ${notRealizedTotal > 0 ? 'Un suivi spécifique est recommandé afin de documenter les obstacles rencontrés.' : ''}
                  </p>
                ` : ''}
                ${realizedHighlights.length ? `
                  <div class="mb-3">
                    <h6 class="text-success mb-2"><i class="bi bi-check2-circle me-2"></i>Activités menées</h6>
                    ${highlightList(realizedHighlights)}
                  </div>
                ` : ''}
                ${pendingHighlights.length ? `
                  <div class="mb-0">
                    <h6 class="text-danger mb-2"><i class="bi bi-exclamation-triangle me-2"></i>Activités planifiées/non réalisées</h6>
                    ${highlightList(pendingHighlights)}
                  </div>
                ` : ''}
              </div>
            `;

        const activitySection = !shouldRenderActivities ? '' : `
          <section class="report-section">
            <div class="report-section-header">
              <div>
                <h5><i class="bi bi-list-task me-2"></i>Activités (${activitiesData.total ?? 0})</h5>
                <small>Analyse détaillée des interventions</small>
              </div>
            </div>
                ${activityNarrative}
            ${activitySummaryTable}
            ${activityKpiTable}
            ${breakdownList.length ? `
              <div class="table-responsive mb-4">
                <table class="table table-sm table-hover align-middle">
                  <thead class="table-light">
                    <tr>
                      <th>Statut détaillé</th>
                      <th style="width: 120px;" class="text-center">Volume</th>
                      <th style="width: 120px;" class="text-center">Part (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${breakdownList.map(item => `
                      <tr>
                        <td>${escapeHtml(item.label)}</td>
                        <td class="text-center fw-semibold">${item.count}</td>
                        <td class="text-center">${item.percentage}%</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
            ${activityList.length ? `
              <div class="table-responsive">
                <table class="table table-striped table-hover align-middle">
                  <thead class="table-light">
                    <tr>
                      <th style="width: 140px;">Date</th>
                      <th>Description</th>
                      <th style="width: 180px;">Résultat</th>
                      <th style="width: 200px;">Projet</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${activityList.map(act => {
          const resultLabel = formatActivityResult(act.result);
          return `
                        <tr>
                          <td>${act.date ? new Date(act.date).toLocaleDateString('fr-FR') : '-'}</td>
                          <td>${escapeHtml(act.description || 'Sans description')}</td>
                          <td>
                            <span class="badge ${getResultBadgeClass(act.result)}">${escapeHtml(resultLabel)}</span>
                          </td>
                          <td>${escapeHtml(act.project || reportingProject || '-')}</td>
                        </tr>
                      `;
        }).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<p class="text-muted mb-0">Aucune activité enregistrée</p>'}
          </section>
        `;

        const objectivesSection = objectiveList.length ? `
          <section class="report-section">
            <div class="report-section-header">
              <div>
                <h5><i class="bi bi-bullseye me-2"></i>Objectifs</h5>
                <small>Suivi des engagements individuels</small>
              </div>
            </div>
            ${objectiveList.map(obj => `
              <div class="mb-3">
                <div class="d-flex justify-content-between mb-2">
                  <strong>${escapeHtml(obj.title)}</strong>
                  <span class="badge ${obj.progressPercent >= 100 ? 'bg-success' : obj.progressPercent >= 50 ? 'bg-warning' : 'bg-danger'}">
                    ${obj.progressPercent}%
                  </span>
                </div>
                <div class="progress" style="height: 20px;">
                  <div class="progress-bar ${obj.progressPercent >= 100 ? 'bg-success' : obj.progressPercent >= 50 ? 'bg-warning' : 'bg-danger'}" 
                       style="width: ${obj.progressPercent}%">
                    ${escapeHtml(`${obj.currentValue} / ${obj.targetValue}`)}
                  </div>
                </div>
                ${obj.description ? `<p class="text-muted small mt-1 mb-0">${escapeHtml(obj.description)}</p>` : ''}
              </div>
            `).join('')}
          </section>
        ` : '';

        // Styles pour la galerie de photos
        const photoGalleryStyles = `
              <style>
                .photo-gallery {
                  display: grid;
                  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                  gap: 1.5rem;
                  margin: 1.5rem 0;
                }
                .photo-card {
                  border-radius: 12px;
                  overflow: hidden;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                  transition: transform 0.3s ease, box-shadow 0.3s ease;
                  background: white;
                }
                .photo-card:hover {
                  transform: translateY(-5px);
                  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                }
                .photo-img-container {
                  position: relative;
                  padding-top: 75%;
                  overflow: hidden;
                }
                .photo-img {
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                  transition: transform 0.5s ease;
                }
                .photo-card:hover .photo-img {
                  transform: scale(1.05);
                }
                .photo-caption {
                  padding: 1rem;
                }
                .photo-meta {
                  display: flex;
                  align-items: center;
                  font-size: 0.85rem;
                  color: #6c757d;
                  margin-top: 0.5rem;
                }
                .photo-meta i {
                  margin-right: 0.5rem;
                  width: 16px;
                  text-align: center;
                }
                .photo-actions {
                  display: flex;
                  gap: 0.5rem;
                  margin-top: 1rem;
                  padding-top: 0.75rem;
                  border-top: 1px solid #eee;
                }
                .empty-photos {
                  text-align: center;
                  padding: 2rem;
                  background: #f8f9fa;
                  border-radius: 8px;
                  color: #6c757d;
                }
              </style>
            `;

        const photosSection = (() => {
          if (!photosList.length) return '';

          const resolvePhotoUrl = (photo) => {
            const candidates = [photo?.url, photo?.path, photo?.photoUrl, photo?.photo_url, photo?.file_url, photo?.imageUrl];
            const raw = candidates.find(Boolean);
            if (!raw) return '';
            try {
              return new URL(raw, window.location.origin).href;
            } catch {
              return raw;
            }
          };

          const photoCards = photosList.map((photo, index) => {
            const url = resolvePhotoUrl(photo);
            if (!url) return '';

            const caption = escapeHtml(photo.caption || photo.title || photo.description || `Photo de terrain ${index + 1}`);
            const rawTimestamp = photo.taken_at || photo.created_at || photo.timestamp || photo.date || photo.datetime;
            let timestampLabel = 'Date inconnue';

            if (rawTimestamp) {
              const ts = new Date(rawTimestamp);
              timestampLabel = Number.isFinite(ts.getTime()) ?
                ts.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) :
                rawTimestamp;
            }

            const locationLabel = photo.location || photo.place || photo.address || 'Localisation non précisée';

            return `
                  <div class="photo-card">
                    <div class="photo-img-container">
                      <img
                        src="${escapeHtml(url)}"
                        alt="${caption || 'Image sans description'}"
                        class="photo-img"
                        loading="lazy"
                      />
                    </div>
                    <div class="photo-caption">
                      <h6 class="mb-2">${caption}</h6>
                      <div class="photo-meta">
                        <i class="bi bi-calendar3"></i>
                        <span>${escapeHtml(timestampLabel)}</span>
                      </div>
                      <div class="photo-meta">
                        <i class="bi bi-geo-alt"></i>
                        <span>${escapeHtml(locationLabel)}</span>
                      </div>
                      <div class="photo-actions">
                        <a href="${escapeHtml(url)}" target="_blank" class="btn btn-sm btn-outline-primary w-100" download>
                          <i class="bi bi-download me-1"></i>Télécharger
                        </a>
                      </div>
                    </div>
                  </div>
                `;
          }).filter(Boolean).join('');

          return `
                ${photoGalleryStyles}
            <section class="report-section">
              <div class="report-section-header">
                <div>
                      <h5><i class="bi bi-images me-2"></i>Galerie terrain</h5>
                      <small>${photosList.length} photo${photosList.length > 1 ? 's' : ''} de terrain</small>
                </div>
              </div>
                  ${photosList.length > 0 ? `
                    <div class="photo-gallery">
                      ${photoCards}
              </div>
                    <div class="text-end mt-2">
                      <small class="text-muted">Cliquez sur une photo pour la télécharger</small>
                    </div>
                  ` : `
                    <div class="empty-photos">
                      <i class="bi bi-camera-off fs-1 mb-2 d-block"></i>
                      <p class="mb-0">Aucune photo disponible pour cette période</p>
                    </div>
                  `}
            </section>
          `;
        }
    }

    })();

        // Styles pour la section IA
        const aiSectionStyles = `
              <style>
                .ai-section {
                  position: relative;
                }
                .ai-loading {
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: rgba(255, 255, 255, 0.8);
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  border-radius: 8px;
                  z-index: 10;
                }
                .ai-summary-content {
                  white-space: pre-wrap;
                  line-height: 1.7;
                  background: #f8f9fa;
                  border-left: 4px solid #0d6efd;
                  padding: 1.25rem;
                  border-radius: 0 8px 8px 0;
                  position: relative;
                }
                .ai-summary-content:before {
                  content: '"\ 201C';
                  position: absolute;
                  top: 10px;
                  left: 15px;
                  font-size: 4rem;
                  color: rgba(13, 110, 253, 0.1);
                  font-family: Georgia, serif;
                  line-height: 1;
                  z-index: 0;
                }
                .ai-summary-text {
                  position: relative;
                  z-index: 1;
                }
                .ai-actions {
                  display: flex;
                  gap: 0.75rem;
                  margin-top: 1.5rem;
                  flex-wrap: wrap;
                }
                .ai-features {
                  display: flex;
                  gap: 0.5rem;
                  margin-top: 1rem;
                  flex-wrap: wrap;
                }
                .ai-feature-badge {
                  display: inline-flex;
                  align-items: center;
                  background: #e9ecef;
                  padding: 0.35rem 0.75rem;
                  border-radius: 20px;
                  font-size: 0.8rem;
                  color: #495057;
                }
                .ai-feature-badge i {
                  margin-right: 0.35rem;
                  color: #0d6efd;
                }
              </style>
            `;

        const aiSection = `
              ${aiSectionStyles}
              <section class="report-section ai-section" id="ai-summary-section">
            <div class="report-section-header">
              <div>
                    <h5><i class="bi bi-robot me-2"></i>Analyse Intelligente</h5>
                    <small>Synthèse avancée par intelligence artificielle</small>
              </div>
                  <div class="d-flex gap-2">
                    <button type="button"
                            class="btn btn-sm btn-outline-primary"
                            onclick="generateAiSummary('concise')"
                            title="Générer un résumé concis">
                      <i class="bi bi-file-text me-1"></i>Résumé
                    </button>
                    <button type="button"
                            class="btn btn-sm btn-outline-success"
                            onclick="generateAiSummary('detailed')"
                            title="Générer une analyse détaillée">
                      <i class="bi bi-file-earmark-text me-1"></i>Analyse
              </button>
            </div>
                </div>
                <div class="position-relative">
              ${commentsData.aiSummary ? `
                    <div class="ai-summary-content">
                      <div class="ai-summary-text">
                  ${commentsData.aiSummary}
                      </div>
                      <div class="ai-actions">
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="regenerateAiSummary()">
                          <i class="bi bi-arrow-repeat me-1"></i>Régénérer
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="copyAiSummary()">
                          <i class="bi bi-clipboard me-1"></i>Copier
                        </button>
                      </div>
                      <div class="ai-features">
                        <span class="ai-feature-badge">
                          <i class="bi ${commentsData.aiModel?.includes('gemini') ? 'bi-google' : 'bi-lightning'}"></i>
                          ${commentsData.aiModel || 'Modèle IA'}
                        </span>
                        <span class="ai-feature-badge">
                          <i class="bi bi-calendar3"></i>
                          ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                </div>
              ` : `
                    <div class="text-center p-4">
                      <div class="mb-3">
                        <i class="bi bi-robot fs-1 text-muted"></i>
                      </div>
                      <h6 class="mb-3">Générez une analyse intelligente</h6>
                      <p class="text-muted mb-4">
                        Obtenez un résumé détaillé de vos activités mensuelles et des recommandations personnalisées grâce à notre intelligence artificielle.
                      </p>
                      <div class="d-flex gap-2 justify-content-center">
                        <button type="button"
                                class="btn btn-outline-primary"
                                onclick="generateAiSummary('concise')">
                          <i class="bi bi-lightning me-1"></i>Résumé rapide
                        </button>
                        <button type="button"
                                class="btn btn-primary"
                                onclick="generateAiSummary('detailed')">
                          <i class="bi bi-stars me-1"></i>Analyse complète
                        </button>
                      </div>
                      ${commentsData.fallbackSummary ? `
                        <div class="mt-4 p-3 bg-light rounded">
                          <p class="small mb-0 fw-medium">Résumé automatique :</p>
                          <p class="small text-muted mb-0">${escapeHtml(commentsData.fallbackSummary)}</p>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                </div>
              </section>
            `;

        const hasSuggestions = commentsData.suggestions && Array.isArray(commentsData.suggestions) && commentsData.suggestions.length > 0;

        // Déclarations manquantes pour compléter la fonction
        const reportCoverSection = `
          <section class="report-section">
            <div class="text-center">
              <h3>Rapport Mensuel</h3>
              <p class="text-muted">${referenceMonthLabel}</p>
              <p><strong>Agent:</strong> ${escapeHtml(agentDisplayName)}</p>
              <p><strong>Projet:</strong> ${escapeHtml(reportingProject)}</p>
              <p><small>Généré le ${generationTimestamp}</small></p>
            </div>
          </section>
        `;

        const presenceSection = `
          <section class="report-section">
            <div class="report-section-header">
              <div>
                <h5><i class="bi bi-calendar-check me-2"></i>Présence</h5>
                <small>Période du ${periodStart} au ${periodEnd}</small>
              </div>
            </div>
            <div class="presence-summary">
              <p>Présence mensuelle à compléter</p>
            </div>
          </section>
        `;

        const activitySection = `
          <section class="report-section">
            <div class="report-section-header">
              <div>
                <h5><i class="bi bi-activity me-2"></i>Activités</h5>
                <small>Résumé des activités réalisées</small>
              </div>
            </div>
            <div class="activity-summary">
              <p>Activités mensuelles à compléter</p>
            </div>
          </section>
        `;

        const objectivesSection = `
          <section class="report-section">
            <div class="report-section-header">
              <div>
                <h5><i class="bi bi-target me-2"></i>Objectifs</h5>
                <small>Objectifs définis pour la période</small>
              </div>
            </div>
            <div class="objectives-summary">
              <p>Objectifs mensuels à compléter</p>
            </div>
          </section>
        `;

        // Construire le HTML complet du rapport
        const sections = [
          reportCoverSection,
          presenceSection,
          activitySection,
          rankingSection,
          objectivesSection,
          photosSection,
          aiSection,
          hasSuggestions ? `
            <section class="report-section">
              <div class="report-section-header">
                <div>
                  <h5><i class="bi bi-lightbulb me-2"></i>Recommandations</h5>
                  <small>Axes d'amélioration identifiés</small>
                </div>
              </div>
              <ul class="mb-0">
                ${commentsData.suggestions.map(suggestion =>
                  `<li>${escapeHtml(suggestion)}</li>`
                ).join('')}
              </ul>
            </section>
          ` : ''
        ].filter(Boolean).join('\n');

        // Mettre à jour le conteneur
        document.getElementById('monthly-report-container').innerHTML = `
          <div class="monthly-report report-layout">
                ${sections}
          </div>
        `;
      }

      // Initialisation du graphique de présence
      let presenceChart = null;

      async function fetchPresenceData(days) {
        try {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(endDate.getDate() - days);

          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);

          const userParam = dashboardAgentId ? `&user_id=${dashboardAgentId}` : '';
          const response = await fetch(`/api/checkins?from=${startDate.toISOString()}&to=${endDate.toISOString()}${userParam}`, {
            headers: { 'Content-Type': 'application/json' }
          });

          if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          const checkins = Array.isArray(data) ? data : (data.checkins || data.data || []);
          const dailyData = {};

          // Initialiser les jours avec 0
          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            dailyData[formatShortDate(d)] = 0;
          }

          // Compter les check-ins par jour
          checkins.forEach(checkin => {
            const date = new Date(checkin.timestamp || checkin.created_at);
            const dateKey = formatShortDate(date);
            dailyData[dateKey] = (parseFloat(dailyData[dateKey] || 0) + 1);
          });

          return {
            labels: Object.keys(dailyData),
            data: Object.values(dailyData)
          };
        } catch (error) {
          console.error('Erreur lors de la récupération des données de présence:', error);
          return { labels: [], data: [] };
        }
      }

      async function initPresenceChart() {
        const periodSelect = document.getElementById('period-select');
        if (!periodSelect) return;

        const days = parseInt(periodSelect.value, 10) || 30;
        const chartContainer = document.querySelector('.chart-container');

        if (!chartContainer) return;

        chartContainer.innerHTML = `
              <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Chargement...</span>
                </div>
                <p class="mt-2">Chargement des données de présence...</p>
              </div>
            `;

        try {
          const { labels, data } = await fetchPresenceData(days);

          chartContainer.innerHTML = '<canvas id="presenceChart"></canvas>';

          const ctx = document.getElementById('presenceChart').getContext('2d');

          if (presenceChart) {
            presenceChart.destroy();
          }

          presenceChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels,
              datasets: [{
                label: 'Heures de présence',
                data,
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: 'rgba(255, 255, 255, 1)',
                pointBorderColor: 'rgba(102, 126, 234, 1)',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: true,
                  position: 'top'
                },
                tooltip: {
                  callbacks: {
                    label: function (context) {
                      return `${context.parsed.y} heures`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Heures de présence',
                    font: { weight: 'bold' }
                  },
                  ticks: {
                    stepSize: 1,
                    callback: value => `${value}h`
                  }
                },
                x: {
                  title: {
                    display: true,
                    text: 'Date',
                    font: { weight: 'bold' }
                  }
                }
              }
            }
          });
        } catch (error) {
          console.error('Erreur lors de l\'initialisation du graphique:', error);
          chartContainer.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          Erreur lors du chargement du graphique de présence.
        </div>
      `;
        }
      }

      // Initialisation des écouteurs d'événements
      function initializeEventListeners() {
        // Initialisation des sélecteurs
        const monthSelect = document.getElementById('report-month-select');
        const agentSelect = document.getElementById('report-agent-select');
        const projectSelect = document.getElementById('report-project-select');
        const generateBtn = document.getElementById('generate-report-btn');
        const periodSelect = document.getElementById('period-select');

        // Initialisation des valeurs par défaut
        if (monthSelect) {
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          monthSelect.value = currentMonth;
        }

        // Gestion des changements de projet
        if (projectSelect) {
          projectSelect.addEventListener('change', (event) => {
            projectSelectTouched = true;
            dashboardProjectFilter = event.target.value || '';

            // Mise à jour du filtre du classement pour correspondre au filtre du projet
            if (dashboardProjectFilter) {
              const formattedProject = formatProjectDisplay(dashboardProjectFilter);
              if (leaderboardProjects.length === 0 || leaderboardProjects.includes(formattedProject)) {
                leaderboardProjectFilter = formattedProject;
                if (leaderboardCache.length > 0) {
                  renderLeaderboardTable();
                }
              }
            } else {
              leaderboardProjectFilter = null;
              if (leaderboardCache.length > 0) {
                renderLeaderboardTable();
              }
            }
          });
        }

        // Gestion des changements d'agent
        if (agentSelect) {
          agentSelect.addEventListener('change', (event) => {
            const agent = findAgentById(event.target.value);
            if (agent && !projectSelectTouched) {
              syncProjectSelectWithAgent(agent);
            }
          });
        }

        // Gestion du bouton de génération
        if (generateBtn) {
          generateBtn.addEventListener('click', async () => {
            generateBtn.disabled = true;
            try {
              // Logique de génération de rapport
            } finally {
              generateBtn.disabled = false;
            }
          });
        }

        // Gestion du changement de période pour le graphique
        if (periodSelect) {
          periodSelect.addEventListener('change', () => {
            initPresenceChart().catch(err => {
              console.warn('Erreur lors du chargement du graphique:', err);
            });
          });
        }

        // Chargement initial
        applyDashboardFilter({ skipValidation: true }).then(() => {
          return initPresenceChart();
        }).catch(err => {
          console.error('Erreur lors du chargement initial:', err);
        });
      }

      // Initialiser les écouteurs d'événements au chargement du DOM
      function initializeApp() {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initializeEventListeners);
        } else {
          initializeEventListeners();
        }
      }

      // Exposer les fonctions globalement
      window.initializeApp = initializeApp;
      window.initializeEventListeners = initializeEventListeners;

      // Démarrer l'application
      initializeApp();

      // Initialisation principale
      (() => {
        // S'assurer que le DOM est chargé avant d'initialiser
        const init = () => {
          // Vérifier si les fonctions existent avant de les appeler
          if (typeof initializeApp === 'function') {
            initializeApp();
          }
        };

        // Initialiser maintenant ou attendre que le DOM soit chargé
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', init);
        } else {
          // Le DOM est déjà chargé, initialiser immédiatement
          setTimeout(init, 0);
        }
      }
    }

    })();
