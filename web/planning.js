// =============================================
// Planning App - Code principal (version complète et propre)
// =============================================
// IIFE pour éviter la pollution de l'espace global
(() => {
  'use strict';

  // ----------------------------
  // 0. FONCTIONS UTILITAIRES
  const getElementById = (id) => document.getElementById(id);

  // ----------------------------
  // 1. CONSTANTES GLOBALES
  // ----------------------------
  const API_BASE = '/api';
  const DEFAULT_TOKEN_CANDIDATES = ['jwt', 'access_token', 'token', 'sb-access-token', 'sb:token'];
  const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // ----------------------------
  // 2. ÉTAT DE L'APPLICATION
  // ----------------------------
  const state = {
    refreshMonthTimer: null,
    projects: [],
    selectedProjectId: '',
    agents: [],
    supervisors: [],
    selectedAgentId: '',
    selectedSupervisorId: '',
    projectList: [],
    selectedProjectFilter: '',
    departments: [],
    communes: [],
    selectedDepartmentId: '',
    selectedCommuneId: '',
    selectedStatus: '',
  };

  // Données géographiques intégrées
  const geoData = {
    "departements": [
      { "id": 1, "name": "Atlantique" },
      { "id": 2, "name": "Borgou" },
      { "id": 3, "name": "Collines" },
      { "id": 4, "name": "Couffo" },
      { "id": 5, "name": "Donga" },
      { "id": 6, "name": "Littoral" },
      { "id": 7, "name": "Mono" },
      { "id": 8, "name": "Ouémé" },
      { "id": 9, "name": "Plateau" },
      { "id": 10, "name": "Zou" }
    ],
    "communes": {
      "1": [
        { "id": 1, "name": "Abomey-Calavi" },
        { "id": 2, "name": "Allada" },
        { "id": 3, "name": "Kpomassè" },
        { "id": 4, "name": "Ouidah" },
        { "id": 5, "name": "Sô-Ava" },
        { "id": 6, "name": "Toffo" },
        { "id": 7, "name": "Tori-Bossito" },
        { "id": 8, "name": "Zè" }
      ],
      "2": [
        { "id": 9, "name": "Bembèrèkè" },
        { "id": 10, "name": "Kalalé" },
        { "id": 11, "name": "N'Dali" },
        { "id": 12, "name": "Nikki" },
        { "id": 13, "name": "Parakou" },
        { "id": 14, "name": "Pèrèrè" },
        { "id": 15, "name": "Sinendé" },
        { "id": 16, "name": "Tchaourou" }
      ],
      "3": [
        { "id": 17, "name": "Bantè" },
        { "id": 18, "name": "Dassa-Zoumè" },
        { "id": 19, "name": "Glazoué" },
        { "id": 20, "name": "Ouèssè" },
        { "id": 21, "name": "Savalou" },
        { "id": 22, "name": "Savé" }
      ],
      "4": [
        { "id": 23, "name": "Aplahoué" },
        { "id": 24, "name": "Djakotomey" },
        { "id": 25, "name": "Klouékanmè" },
        { "id": 26, "name": "Lalo" },
        { "id": 27, "name": "Toviklin" }
      ],
      "5": [
        { "id": 28, "name": "Bassila" },
        { "id": 29, "name": "Copargo" },
        { "id": 30, "name": "Djougou" },
        { "id": 31, "name": "Ouaké" }
      ],
      "6": [
        { "id": 32, "name": "Cotonou" },
        { "id": 33, "name": "Porto-Novo" }
      ],
      "7": [
        { "id": 34, "name": "Athiémè" },
        { "id": 35, "name": "Bopa" },
        { "id": 36, "name": "Comè" },
        { "id": 37, "name": "Grand-Popo" },
        { "id": 38, "name": "Houéyogbé" },
        { "id": 39, "name": "Lokossa" }
      ],
      "8": [
        { "id": 40, "name": "Adjarra" },
        { "id": 41, "name": "Adjohoun" },
        { "id": 42, "name": "Aguégués" },
        { "id": 43, "name": "Akpro-Missérété" },
        { "id": 44, "name": "Avrankou" },
        { "id": 45, "name": "Bonou" },
        { "id": 46, "name": "Dangbo" },
        { "id": 47, "name": "Porto-Novo" },
        { "id": 48, "name": "Sèmè-Kpodji" }
      ],
      "9": [
        { "id": 49, "name": "Ifangni" },
        { "id": 50, "name": "Adja-Ouèrè" },
        { "id": 51, "name": "Kétou" },
        { "id": 52, "name": "Pobè" },
        { "id": 53, "name": "Sakété" }
      ],
      "10": [
        { "id": 54, "name": "Abomey" },
        { "id": 55, "name": "Agbangnizoun" },
        { "id": 56, "name": "Bohicon" },
        { "id": 57, "name": "Covè" },
        { "id": 58, "name": "Djidja" },
        { "id": 59, "name": "Ouinhi" },
        { "id": 60, "name": "Za-Kpota" },
        { "id": 61, "name": "Zangnanado" },
        { "id": 62, "name": "Zogbodomey" }
      ]
    }
  };

  // ----------------------------
  // 3. UTILITAIRES (HELPERS)
  // ----------------------------
  
  /**
   * Applique les filtres côté client aux planifications
   * @param {Array} plans - Les planifications à filtrer
   * @returns {Array} - Les planifications filtrées
   */
  const applyClientSideFilters = (plans) => {
    let filteredPlans = [...plans];
    
    // Filtre par superviseur (si un superviseur est sélectionné)
    if (state.selectedSupervisorId) {
      console.log(`Application du filtre superviseur côté client: ${state.selectedSupervisorId}`);
      // Pour l'instant, on ne peut pas filtrer par superviseur car l'API ne retourne pas cette info
      // Il faudrait modifier l'API pour inclure les données utilisateur enrichies
    }
    
    // Filtre par département (si un département est sélectionné)
    if (state.selectedDepartmentId) {
      console.log(`Application du filtre département côté client: ${state.selectedDepartmentId}`);
      // Pour l'instant, on ne peut pas filtrer par département car l'API ne retourne pas cette info
    }
    
    // Filtre par commune (si une commune est sélectionnée)
    if (state.selectedCommuneId) {
      console.log(`Application du filtre commune côté client: ${state.selectedCommuneId}`);
      // Pour l'instant, on ne peut pas filtrer par commune car l'API ne retourne pas cette info
    }
    
    return filteredPlans;
  };

  /**
   * Trouve un token JWT dans le stockage local ou global.
   * @returns {string}
   */
  const findToken = () => {
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
    return '';
  };

  /**
   * Génère les headers d'authentification.
   * @returns {Promise<Object>}
   */
  const authHeaders = async () => {
    const token = findToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  /**
   * Formate une date en chaîne ISO (YYYY-MM-DD).
   * @param {Date} date
   * @returns {string}
   */
  const toISODate = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  /**
   * Ajoute des jours à une date.
   * @param {Date|string} date
   * @param {number} days
   * @returns {Date}
   */
  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  /**
   * Retourne le lundi de la semaine pour une date donnée.
   * @param {Date|string} date
   * @returns {Date}
   */
  const startOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  /**
   * Retourne le nombre de jours dans un mois.
   * @param {number} year
   * @param {number} month (0-11)
   * @returns {number}
   */
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  /**
   * Convertit une heure au format "HH:MM" en minutes.
   * @param {string} hourStr
   * @returns {number}
   */
  const hoursToMinutes = (hourStr) => {
    if (!hourStr) return 0;
    const [h, m] = String(hourStr).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  /**
   * Convertit des minutes en chaîne "HH:MM".
   * @param {number} minutes
   * @returns {string}
   */
  const minutesToHourStr = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  /**
   * Formate une date selon un format personnalisé.
   * @param {string|Date} dateString
   * @param {string} format
   * @returns {string}
   */
  const formatDate = (dateString, format = 'dd/MM/yyyy') => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date invalide';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return format
      .replace('dd', day)
      .replace('MM', month)
      .replace('yyyy', year);
  };

  // ----------------------------
  // 4. GESTION DE L'INTERFACE
  // ----------------------------
  /**
   * Affiche une bannière d'authentification.
   * @param {string} message
   */
  const showAuthBanner = (message = '🔒 Session requise. Veuillez vous connecter.') => {
    try {
      const container = document.querySelector('.container') || document.body;
      let banner = document.getElementById('planning-auth-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'planning-auth-banner';
        banner.style.cssText = 'margin:12px 0;padding:12px 16px;border-radius:8px;background:#fff3cd;color:#664d03;border:1px solid #ffe69c;';
        container.prepend(banner);
      }
      banner.textContent = message;
    } catch (e) {
      console.error('Erreur affichage bannière:', e);
    }
  };

  /**
   * Masque la bannière d'authentification.
   */
  const hideAuthBanner = () => {
    try {
      const banner = document.getElementById('planning-auth-banner');
      if (banner) banner.remove();
    } catch (e) {
      console.error('Erreur masquage bannière:', e);
    }
  };

  /**
   * Planifie le rafraîchissement du mois.
   * @param {number} delay
   */
  const scheduleMonthRefresh = (delay = 400) => {
    try {
      clearTimeout(state.refreshMonthTimer);
    } catch (e) {
      console.error('Erreur clearTimeout:', e);
    }
    state.refreshMonthTimer = setTimeout(() => {
      try {
        const monthEl = $('month');
        if (monthEl && monthEl.value) {
          loadMonth(monthEl.value);
        } else {
          loadMonth();
        }
      } catch (e) {
        console.error('Erreur scheduleMonthRefresh:', e);
      }
    }, delay);
  };

  // ----------------------------
  // 5. CHARGEMENT DES DONNÉES
  
  /**
   * Charge la liste des utilisateurs (agents et superviseurs) depuis l'API avec pagination
   * @returns {Promise<void>}
   */
  const loadUsers = async () => {
    console.log('🔄 Début du chargement des utilisateurs...');
    const loadingToastId = showToast('Chargement des utilisateurs...', 'info', { autoClose: false });
    
    try {
      // Vérifier la connexion Internet
      if (!navigator.onLine) {
        throw new Error('Pas de connexion Internet. Veuillez vérifier votre connexion.');
      }

      console.log('🔑 Génération des headers d\'authentification...');
      const headers = await authHeaders();
      console.log('📤 Headers générés:', headers);

      // Afficher un indicateur de chargement
      showToast('Chargement des utilisateurs...', 'info', { id: loadingToastId, autoClose: false });



      // Essayer de charger les utilisateurs depuis l'API /api/users
      try {
        console.log('🌐 Chargement des utilisateurs depuis /api/users...');
        console.log('📤 Headers utilisés:', headers);
        
        const startTime = Date.now();
        const response = await fetch(`${API_BASE}/users`, { 
          headers: {
            ...headers,
            'Accept': 'application/json'
          },
          credentials: 'include'
        });
        const loadTime = Date.now() - startTime;
        console.log(`⏱️ Temps de réponse API: ${loadTime}ms`);

        if (!response.ok) {
          console.error(`❌ Erreur API: ${response.status} ${response.statusText}`);
          if (response.status === 401) {
            localStorage.removeItem('jwt');
            showAuthBanner('Session expirée. Veuillez vous reconnecter.');
            throw new Error('Session expirée');
          }
          throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        const raw = await response.json();
        const allUsers = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items)
            ? raw.items
            : Array.isArray(raw?.data)
              ? raw.data
              : [];
        console.log(`✅ ${allUsers.length} utilisateurs chargés depuis l'API en ${loadTime}ms`);
        
        // Traiter les données reçues avec filtrage correct des rôles
        state.agents = allUsers.filter(user => user.role === 'agent');
        state.supervisors = allUsers.filter(user => user.role === 'superviseur');
        state.admins = allUsers.filter(user => user.role === 'admin');
        
        // Pour l'affichage, on peut combiner superviseurs et admins si nécessaire
        state.allSupervisors = [...state.supervisors, ...state.admins];
        
        console.log(`📊 Répartition: ${state.agents.length} agents, ${state.supervisors.length} superviseurs, ${state.admins.length} admins`);
        
        // Si aucun utilisateur n'est trouvé, afficher un message
        if (state.agents.length === 0 && state.supervisors.length === 0 && state.admins.length === 0) {
          console.warn('⚠️ Aucun utilisateur trouvé dans la base de données');
          showToast('Aucun utilisateur trouvé dans la base de données', 'warning', { id: loadingToastId });
          return;
        }
        
        console.log('🔄 Mise à jour de l\'interface utilisateur...');
        // Mettre à jour l'interface
        updateAgentSelect();
        updateSupervisorSelect();
        
        showToast(
          `✅ ${state.agents.length} agents, ${state.supervisors.length} superviseurs et ${state.admins.length} admins chargés`, 
          'success', 
          { id: loadingToastId }
        );
        
      } catch (error) {
        console.error('❌ Erreur lors du chargement des utilisateurs:', error);
        
        // Afficher un message d'erreur et ne pas utiliser les données de test
          const errorMessage = `Erreur: ${error.message || 'Impossible de charger les utilisateurs'}`;
          showToast(errorMessage, 'error', { id: loadingToastId });
          
        // Réessayer après un délai seulement si c'est une erreur réseau
        if (navigator.onLine && error.message.includes('Failed to fetch')) {
          const retryTime = 5000; // 5 secondes
          console.log(`🔄 Nouvelle tentative dans ${retryTime / 1000} secondes...`);
            setTimeout(loadUsers, retryTime);
        }
      }
      
    } catch (error) {
      console.error('Erreur critique lors du chargement des utilisateurs:', error);
      showToast(`Erreur: ${error.message || 'Erreur inconnue'}`, 'error');
    }
  };

  /**
   * Charge la liste des projets uniques depuis la colonne project_name de la table users
   */
  const loadProjects = async () => {
    try {
      const headers = await authHeaders();
      
      // Essayer d'abord l'endpoint dédié aux projets
      let response = await fetch(`${API_BASE}/users/projects`, { 
        headers,
        credentials: 'include',
        method: 'GET'
      });
      
      if (response.ok) {
        const projects = await response.json();
        if (Array.isArray(projects)) {
          state.projectList = projects.filter(project => project && project.trim() !== '').sort();
          state.projects = state.projectList;
          console.log(`${state.projectList.length} projets chargés depuis l'endpoint dédié:`, state.projectList);
        } else {
          throw new Error('Format de réponse inattendu pour les projets');
        }
      } else {
        // Fallback: récupérer tous les utilisateurs pour extraire les projets uniques
        console.warn('Endpoint projets non disponible, fallback vers les utilisateurs');
        response = await fetch(`${API_BASE}/users`, { 
          headers,
          credentials: 'include',
          method: 'GET'
        });
        
        if (response.ok) {
          const users = await response.json();
          
          // Extraire les projets uniques depuis la colonne project_name
          const projects = users
            .map(user => user.project_name)
            .filter(project => project && project.trim() !== '')
            .map(project => project.trim());
          
          // Supprimer les doublons et trier
          state.projectList = [...new Set(projects)].sort();
          state.projects = state.projectList;
          
          console.log(`${state.projectList.length} projets chargés depuis les utilisateurs:`, state.projectList);
        } else {
          throw new Error(`Erreur HTTP ${response.status} lors du chargement des projets`);
        }
      }
      
      // Mettre à jour les sélecteurs de projet
      updateProjectSelect();
      updateProjectFilterSelect();
      
    } catch (error) {
      console.error('Erreur lors du chargement des projets:', error);
      state.projectList = [];
      state.projects = [];
    }
  };

  /**
   * Charge la liste des départements depuis l'API ou utilise les données intégrées en cas d'échec.
   */
  const loadDepartments = async () => {
    console.log('Chargement des départements...');
    
    // Fonction pour charger les données intégrées
    const loadIntegratedData = () => {
      console.warn('Utilisation des données intégrées pour les départements');
      state.departments = geoData.departements || [];
      updateDepartmentSelect();
      console.log(`${state.departments.length} départements chargés depuis les données intégrées`);
    };

    // Si pas de connexion, utiliser directement les données intégrées
    if (!navigator.onLine) {
      console.warn('Pas de connexion Internet, utilisation des données intégrées');
      loadIntegratedData();
      return;
    }

    try {
      // Essayer de récupérer les en-têtes d'authentification
      let headers;
      try {
        headers = await authHeaders();
      } catch (authError) {
        console.warn('Erreur d\'authentification, utilisation des données intégrées:', authError);
        loadIntegratedData();
        return;
      }

      // Configuration de la requête avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout de 5 secondes

      try {
        const response = await fetch(`${API_BASE}/departments`, { 
          headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          state.departments = data.items || data || [];
          
          // Si aucun département n'est retourné, utiliser les données intégrées
          if (state.departments.length === 0) {
            console.warn('Aucun département trouvé dans la réponse, utilisation des données intégrées');
            loadIntegratedData();
            return;
          }
          
          console.log(`${state.departments.length} départements chargés depuis l'API`);
          updateDepartmentSelect();
        } else {
          // Si l'API retourne une erreur, utiliser les données intégrées
          console.warn(`Erreur ${response.status} lors du chargement des départements, utilisation des données intégrées`);
          loadIntegratedData();
        }
      } catch (error) {
        clearTimeout(timeoutId);
        
        // En cas d'erreur réseau ou de timeout, utiliser les données intégrées
        if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
          console.warn('Délai d\'attente dépassé ou erreur réseau, utilisation des données intégrées');
        } else {
          console.error('Erreur lors du chargement des départements:', error);
        }
        
        loadIntegratedData();
      }
    } catch (error) {
      console.error('Erreur critique lors du chargement des départements:', error);
      // En cas d'erreur inattendue, utiliser les données intégrées
      loadIntegratedData();
    }
  };

  /**
   * Charge la liste des communes pour un département donné.
   * @param {string} departmentId
   */
  const loadCommunes = async (departmentId) => {
    if (!departmentId) {
      state.communes = [];
      updateCommuneSelect();
      return;
    }
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_BASE}/communes?department_id=eq.${departmentId}`, { headers });
      
      if (response.ok) {
        const data = await response.json();
        state.communes = data.items || data || [];
        console.log(`${state.communes.length} communes chargées depuis Supabase pour le département ${departmentId}`);
      } else {
        console.warn('Erreur lors du chargement des communes depuis Supabase, utilisation des données intégrées');
        // Fallback vers les données intégrées
        state.communes = geoData.communes[departmentId] || [];
        console.log(`${state.communes.length} communes chargées depuis les données intégrées pour le département ${departmentId}`);
      }
      
      updateCommuneSelect();
    } catch (error) {
      console.error('Erreur chargement communes:', error);
      // Fallback vers les données intégrées
      state.communes = geoData.communes[departmentId] || [];
      console.log(`${state.communes.length} communes chargées depuis les données intégrées (fallback) pour le département ${departmentId}`);
      updateCommuneSelect();
    }
  };

  /**
   * Met à jour la liste déroulante des agents.
   */
  const updateAgentSelect = () => {
    console.log('Mise à jour du sélecteur des agents...');
    const select = document.getElementById('agent-select');
    if (!select) {
      console.error('Élément agent-select non trouvé dans le DOM');
      return;
    }
    const prevValue = select.value;
    select.innerHTML = '<option value="">Tous les agents</option>';
    console.log(`Nombre d'agents à afficher: ${state.agents ? state.agents.length : 0}`);
    state.agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.id;
      const name = agent.name || agent.email;
      option.textContent = `${name} (${agent.email})`;
      select.appendChild(option);
    });
    if (prevValue) select.value = prevValue;
  };

  /**
   * Met à jour la liste déroulante des superviseurs.
   */
  const updateSupervisorSelect = () => {
    console.log('Mise à jour du sélecteur des superviseurs...');
    const select = document.getElementById('supervisor-filter-select');
    if (!select) {
      console.error('Sélecteur de superviseur non trouvé: supervisor-filter-select');
      return;
    }
    
    // Utiliser allSupervisors qui combine superviseurs et admins
    const supervisorsToShow = state.allSupervisors || [];
    console.log(`Nombre de superviseurs à afficher: ${supervisorsToShow.length} (${state.supervisors?.length || 0} superviseurs + ${state.admins?.length || 0} admins)`);
    
    const prevValue = select.value;
    
    console.log(`Mise à jour du sélecteur de superviseurs avec ${supervisorsToShow.length} superviseurs/admins`);
    
    select.innerHTML = '<option value="">Tous les superviseurs</option>';
    
    supervisorsToShow.forEach(supervisor => {
      const option = document.createElement('option');
      option.value = String(supervisor.id || supervisor.email || '');
      const name = supervisor.name || supervisor.email;
      const roleLabel = supervisor.role === 'admin' ? ' (Admin)' : ' (Superviseur)';
      option.textContent = name + roleLabel;
      select.appendChild(option);
      console.log(`Ajout du superviseur: ${name}${roleLabel} (ID: ${supervisor.id})`);
    });
    
    if (prevValue) select.value = prevValue;
    
    // Déclencher un événement de changement si la valeur a changé
    if (select.value !== prevValue) {
      select.dispatchEvent(new Event('change'));
    }
  };

  /**
   * Met à jour la liste déroulante des projets.
   */
  const updateProjectSelect = () => {
    const select = getElementById('project-select');
    if (!select) return;
    select.innerHTML = '<option value="">Tous les projets</option>';
    state.projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project;
      option.textContent = project;
      select.appendChild(option);
    });
  };

  /**
   * Met à jour la liste déroulante des projets (filtre) avec les projets disponibles
   */
  const updateProjectFilterSelect = () => {
    const select = getElementById('project-filter-select');
    if (!select) return;
    
    const prevValue = select.value;
    
    // Vider la liste tout en conservant l'option par défaut
    select.innerHTML = '<option value="">Tous les projets</option>';
    
    // Vérifier si des projets sont disponibles
    if (!state.projects || state.projects.length === 0) {
      console.warn('Aucun projet disponible pour le filtre');
      return;
    }
    
    console.log(`Mise à jour du sélecteur de projets avec ${state.projects.length} projets`);
    
    // Ajouter chaque projet comme option
    state.projects.forEach(project => {
      if (project) { // S'assurer que le projet n'est pas vide
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        select.appendChild(option);
      }
    });
    
    // Restaurer la valeur précédente si elle existe toujours
    if (prevValue && state.projects.includes(prevValue)) {
      select.value = prevValue;
    }
    
    // Déclencher un événement de changement si la valeur a changé
    if (select.value !== prevValue) {
      select.dispatchEvent(new Event('change'));
    }
  };

  /**
   * Met à jour la liste déroulante des départements.
   */
  const updateDepartmentSelect = () => {
    const select = $('department-filter-select');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Tous les départements</option>';
    state.departments.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = dept.name;
      select.appendChild(option);
    });
    if (currentValue && state.departments.some(d => d.id === currentValue)) {
      select.value = currentValue;
    }
  };

  /**
   * Met à jour la liste déroulante des communes.
   */
  const updateCommuneSelect = () => {
    const select = $('commune-filter-select');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '';
    if (state.communes.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = state.selectedDepartmentId ? 'Aucune commune trouvée' : 'Sélectionnez d\'abord un département';
      select.disabled = !state.selectedDepartmentId;
      select.appendChild(option);
    } else {
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Toutes les communes';
      select.appendChild(defaultOption);
      state.communes.forEach(commune => {
        const option = document.createElement('option');
        option.value = commune.id;
        option.textContent = commune.name;
        select.appendChild(option);
      });
      select.disabled = false;
      if (currentValue && state.communes.some(c => c.id === currentValue)) {
        select.value = currentValue;
      }
    }
  };

  /**
   * Filtre les agents par superviseur sélectionné.
   */
  const filterAgentsBySupervisor = () => {
    try {
      const select = document.getElementById('agent-select');
      if (!select) return;
      const options = Array.from(select.querySelectorAll('option'));
      options.forEach((option, index) => {
        if (index === 0) return;
        const agent = state.agents.find(a => String(a.id) === option.value);
        if (!agent) {
          option.style.display = 'none';
          return;
        }
        const supervisorId = String(agent.supervisor_id || agent.supervisor || agent.supervisor_email || '');
        const shouldShow = !state.selectedSupervisorId || supervisorId === String(state.selectedSupervisorId);
        option.style.display = shouldShow ? '' : 'none';
      });
      const currentValue = select.value;
      const currentAgent = state.agents.find(a => String(a.id) === currentValue);
      if (currentValue && currentAgent) {
        const supervisorId = String(currentAgent.supervisor_id || currentAgent.supervisor || currentAgent.supervisor_email || '');
        if (state.selectedSupervisorId && supervisorId !== String(state.selectedSupervisorId)) {
          select.value = '';
          state.selectedAgentId = '';
        }
      }
    } catch (e) {
      console.error('Erreur filtre agents:', e);
    }
  };

  /**
   * Filtre les agents par projet sélectionné.
   */
  const filterAgentsByProject = () => {
    try {
      const select = document.getElementById('agent-select');
      if (!select) return;

      const visibleAgents = state.agents.filter(agent => {
        const projectMatch = !state.selectedProjectFilter || agent.project_name === state.selectedProjectFilter;
        // Ajoutez d'autres logiques de filtrage ici si nécessaire
        return projectMatch;
      });

      select.innerHTML = '<option value="">Tous les agents</option>';
      visibleAgents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        const name = agent.name || agent.email;
        option.textContent = `${name} (${agent.email})`;
        select.appendChild(option);
      });

      // Vérifier si l'agent actuellement sélectionné est toujours visible
      if (state.selectedAgentId && !visibleAgents.some(a => String(a.id) === state.selectedAgentId)) {
        state.selectedAgentId = '';
      }
      select.value = state.selectedAgentId;

    } catch (e) {
      console.error('Erreur lors du filtrage des agents par projet:', e);
    }
  };

  // ----------------------------
  // 6. GESTION DE LA PLANIFICATION
  // ----------------------------
  
  /**
   * Sauvegarde une planification via l'API
   * @param {Object} planningData - Les données de planification à sauvegarder
   * @param {HTMLElement} [buttonElement=null] - Élément bouton à désactiver pendant la sauvegarde
   * @returns {Promise<Object>} - La réponse de l'API
   */
  const savePlanning = async (planningData, buttonElement = null) => {
    // Sauvegarder l'état original du bouton
    let originalButtonState = null;
    if (buttonElement) {
      originalButtonState = {
        disabled: buttonElement.disabled,
        innerHTML: buttonElement.innerHTML
      };
      buttonElement.disabled = true;
      buttonElement.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    }

    try {
      // Récupérer les en-têtes d'authentification
      const auth = await authHeaders();
      if (!auth) {
        throw new Error('Erreur d\'authentification: veuillez vous reconnecter');
      }

      // Valider les données requises
      if (!planningData.date || !planningData.planned_start_time || !planningData.planned_end_time) {
        throw new Error('Les champs date, heure de début et heure de fin sont obligatoires');
      }

      // Valider que l'heure de fin est après l'heure de début
      const startTime = planningData.planned_start_time;
      const endTime = planningData.planned_end_time;
      if (startTime && endTime && startTime >= endTime) {
        throw new Error('L\'heure de fin doit être postérieure à l\'heure de début');
      }

      // Préparer les en-têtes
      const headers = {
        'Content-Type': 'application/json',
        ...auth,
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      };

      console.log('Envoi des données de planification:', planningData);
      
      // Envoyer la requête à l'API
      const response = await fetch(`${API_BASE}/planifications`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(planningData)
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('Erreur API:', response.status, responseData);
        throw new Error(
          responseData.message || 
          responseData.error || 
          `Erreur ${response.status} lors de l'enregistrement`
        );
      }

      return responseData;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la planification:', error);
      throw error; // Propager l'erreur pour la gestion par l'appelant
    } finally {
      // Restaurer l'état du bouton
      if (buttonElement && originalButtonState) {
        buttonElement.disabled = originalButtonState.disabled;
        buttonElement.innerHTML = originalButtonState.innerHTML;
      }
    }
  };
  /**
   * Charge la planification pour une semaine.
   * @param {string} dateStr
   */
  const loadWeek = async (dateStr) => {
    try {
      const start = startOfWeek(dateStr ? new Date(dateStr) : new Date());
      if (isNaN(start.getTime())) {
        throw new Error('Date de début invalide');
      }

      if ($('week-start')) {
        $('week-start').value = toISODate(start);
      }

      const weekDays = Array.from({ length: 5 }, (_, i) => addDays(start, i));
      const from = toISODate(weekDays[0]);
      const to = toISODate(weekDays[weekDays.length - 1]);

      if (!from || !to) {
        throw new Error('Impossible de déterminer la période de la semaine');
      }

      const headers = await authHeaders();
      if (!headers) {
        throw new Error('Impossible de récupérer les en-têtes d\'authentification');
      }

      // Construire l'URL complète pour les planifications
      const planificationsUrl = new URL(`${API_BASE}/planifications`, window.location.origin);
      planificationsUrl.searchParams.append('from', from);
      planificationsUrl.searchParams.append('to', to);
      
      // Appliquer les filtres
      if (state.selectedProjectFilter) {
        planificationsUrl.searchParams.append('project_name', state.selectedProjectFilter);
        console.log(`Filtre projet appliqué: ${state.selectedProjectFilter}`);
      }
      if (state.selectedAgentId) {
        planificationsUrl.searchParams.append('agent_id', state.selectedAgentId);
        console.log(`Filtre agent appliqué: ${state.selectedAgentId}`);
      }
      // Note: Le filtre superviseur sera appliqué côté client car l'API ne le supporte pas
      if (state.selectedSupervisorId) {
        console.log(`Filtre superviseur à appliquer côté client: ${state.selectedSupervisorId}`);
      }

      // Mapper departement/commune ID -> nom pour l'API backend (users stocke les noms)
      if (state.selectedDepartmentId) {
        const dept = (geoData.departements || []).find(d => String(d.id) === String(state.selectedDepartmentId));
        if (dept && dept.name) planificationsUrl.searchParams.append('departement', dept.name);
      }
      if (state.selectedCommuneId) {
        const communesForDept = (geoData.communes || {})[String(state.selectedDepartmentId)] || state.communes || [];
        const com = communesForDept.find(c => String(c.id) === String(state.selectedCommuneId));
        if (com && com.name) planificationsUrl.searchParams.append('commune', com.name);
      }
      if (state.selectedStatus) {
        planificationsUrl.searchParams.append('resultat_journee', state.selectedStatus);
      }

      // Construire les chemins pour les autres appels API
      const checkinsUrl = new URL(`${API_BASE}/checkins`, window.location.origin);
      checkinsUrl.searchParams.append('from', from);
      checkinsUrl.searchParams.append('to', to);
      if (state.selectedAgentId) checkinsUrl.searchParams.append('agent_id', state.selectedAgentId);

      const validationsUrl = new URL(`${API_BASE}/validations`, window.location.origin);
      validationsUrl.searchParams.append('from', from);
      validationsUrl.searchParams.append('to', to);
      if (state.selectedAgentId) validationsUrl.searchParams.append('agent_id', state.selectedAgentId);

      const requests = [
        fetch(planificationsUrl.toString(), { headers, credentials: 'include' }).catch(err => ({ ok: false, status: 500, json: async () => ({ items: [] }) })),
        fetch(checkinsUrl.toString(), { headers, credentials: 'include' }).catch(err => ({ ok: false, status: 500, json: async () => ({ items: [] }) })),
        fetch(validationsUrl.toString(), { headers, credentials: 'include' }).catch(err => ({ ok: false, status: 500, json: async () => ({ items: [] }) }))
      ];

      const [plansRes, checkinsRes, validationsRes] = await Promise.all(requests);

      if (!plansRes || !checkinsRes || !validationsRes) {
        throw new Error('Une ou plusieurs réponses API sont invalides');
      }

      if ([plansRes.status, checkinsRes.status, validationsRes.status].includes(401)) {
        showAuthBanner('🔒 Session requise. Connectez-vous, puis revenez ici.');
        return;
      }

      let plans = [];
      let checkins = [];
      let validations = [];

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        plans = plansData.items || [];
        // Appliquer les filtres côté client
        plans = applyClientSideFilters(plans);
        console.log(`${plans.length} planifications après filtrage côté client (vue semaine)`);
      }
      if (checkinsRes.ok) checkins = (await checkinsRes.json()).items || [];
      if (validationsRes.ok) validations = (await validationsRes.json()).items || [];
      
      hideAuthBanner();

      const plansByDate = new Map(plans.map(p => [String(p.date).slice(0, 10), p]));
      const checkinDates = new Set(checkins.map(c => String(c.timestamp).slice(0, 10)));
      const validatedDates = new Set(validations.filter(v => v.valid && v.created_at).map(v => toISODate(new Date(v.created_at))));
      
      const gantt = $('week-gantt');
      if (!gantt) {
        console.error('Erreur: Élément week-gantt introuvable dans le DOM');
        return;
      }

      gantt.innerHTML = '';
      const todayIso = toISODate(new Date());

      const header = document.createElement('div');
      header.className = 'gantt-header d-flex border-bottom';
      header.innerHTML = `
        <div class="gantt-col gantt-day-col fw-bold text-center" style="width:120px">Jour</div>
        <div class="flex-grow-1 d-flex">
          ${Array.from({ length: 24 }, (_, h) => `<div class="gantt-col text-center small" style="width:60px">${String(h).padStart(2, '0')}h</div>`).join('')}
        </div>`;
      gantt.appendChild(header);

      let weeklyMinutes = 0;
      weekDays.forEach((d) => {
        if (!d || isNaN(d.getTime())) return;
        
        const iso = toISODate(d);
        const plan = plansByDate.get(iso);
        const startMin = hoursToMinutes(plan?.planned_start_time);
        const endMin = hoursToMinutes(plan?.planned_end_time);
        const planned = Boolean(plan && (plan.planned_start_time || plan.planned_end_time));
        const duration = (endMin > startMin) ? (endMin - startMin) : 0;
        weeklyMinutes += duration;
        const hasPresence = checkinDates.has(iso);
        const isValidated = validatedDates.has(iso);
        const isPast = iso < todayIso;

        const row = document.createElement('div');
        row.className = 'gantt-row d-flex align-items-center border-bottom py-2';
        row.innerHTML = `
          <div class="gantt-col d-flex align-items-center flex-wrap gap-2" style="width:120px">
            <span class="fw-semibold">${DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1]} ${formatDate(d, 'dd/MM')}</span>
            ${planned ? '<span class="badge bg-primary">Planifié</span>' : '<span class="badge bg-secondary">Libre</span>'}
            ${hasPresence ? `<span class="badge ${isValidated ? 'bg-success' : 'bg-warning'}">${isValidated ? 'Validée' : 'À valider'}</span>` : ''}
            ${plan?.project_name ? `<span class="badge bg-info text-truncate" style="max-width: 100px;" title="${plan.project_name}">${plan.project_name}</span>` : ''}
            ${isPast ? '<span class="badge bg-secondary">Verrouillé</span>' : ''}
          </div>
          <div class="flex-grow-1 position-relative" style="height:34px">
            <div class="position-absolute bg-light w-100 h-100" style="opacity:.6"></div>
            ${planned && duration > 0 ? `<div class="position-absolute bg-primary" style="left:${startMin}px;width:${duration}px;height:26px;border-radius:6px;opacity:.85"></div>` : ''}
            <div class="position-absolute d-flex gap-2" style="left:4px;top:4px">
              <input type="time" class="form-control form-control-sm" id="gs-${iso}" value="${plan?.planned_start_time || ''}" style="width:110px" ${isPast ? 'disabled' : ''}>
              <input type="time" class="form-control form-control-sm" id="ge-${iso}" value="${plan?.planned_end_time || ''}" style="width:110px" ${isPast ? 'disabled' : ''}>
              <input type="text" class="form-control form-control-sm" id="desc-${iso}" placeholder="Description..." value="${plan?.description_activite || ''}" style="width:200px" ${isPast ? 'disabled' : ''}>
              <button class="btn btn-sm btn-success" data-date="${iso}" ${isPast ? 'disabled' : ''}>OK</button>
            </div>
          </div>`;
        gantt.appendChild(row);
      });

      if ($('week-summary')) {
        $('week-summary').textContent = `Total planifié: ${Math.floor(weeklyMinutes / 60)}h${String(weeklyMinutes % 60).padStart(2, '0')}`;
      }

      gantt.querySelectorAll('button[data-date]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const date = btn.getAttribute('data-date');
          const today = toISODate(new Date());
          
          // Vérifier si la date est dans le passé
          if (date < today) {
            showToast('Impossible de modifier un jour passé', 'error');
            return;
          }
          
          // Préparer les données de planification
          const planningData = {
            date,
            planned_start_time: $(`gs-${date}`).value || null,
            planned_end_time: $(`ge-${date}`).value || null,
            description_activite: $(`desc-${date}`).value || null,
            project_name: state.selectedProjectFilter || null,
            user_id: state.selectedAgentId ? parseInt(state.selectedAgentId, 10) : null,
            resultat_journee: 'en_cours'
          };
          
          // Validation des champs requis
          if (!planningData.planned_start_time || !planningData.planned_end_time) {
            showToast('Veuillez spécifier une heure de début et de fin', 'error');
            return;
          }
          
          try {
            // Utiliser la fonction savePlanning centralisée
            await savePlanning(planningData, btn);
            
            // Afficher un message de succès
            showToast('Planification enregistrée avec succès', 'success');
            
            // Recharger les données mises à jour
            await loadWeek($('week-start')?.value || toISODate(new Date()));
            scheduleMonthRefresh(100);
            await loadWeeklySummary();
            
            // Forcer le rechargement du Gantt
            const ganttElement = $('week-gantt');
            if (ganttElement) {
              ganttElement.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Rechargement du planning...</p></div>';
            }
            
          } catch (error) {
            // L'erreur est déjà gérée dans savePlanning
            console.error('Erreur lors de la sauvegarde de la planification:', error);
          }
        });
      });
    } catch (error) {
      console.error('Erreur chargement semaine:', error);
      const gantt = $('week-gantt');
      if (gantt) {
        gantt.innerHTML = `<div class="alert alert-danger">Erreur lors du chargement de la planification : ${error.message}</div>`;
      }
    }
  };

  /**
   * Charge la planification pour un mois.
   * @param {string} monthStr
   */
  const loadMonth = async (monthStr) => {
    try {
      const base = monthStr ? new Date(monthStr + '-01T12:00:00Z') : new Date();
      if ($('month')) {
         $('month').value = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
      }
      const year = base.getFullYear();
      const month = base.getMonth();
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth(year, month)}`;

      const headers = await authHeaders();
      const gantt = $('month-gantt');
      if (gantt) gantt.innerHTML = '<div class="text-muted">Chargement...</div>';

      const planificationsUrl = new URL(`${API_BASE}/planifications`, window.location.origin);
      planificationsUrl.searchParams.append('from', from);
      planificationsUrl.searchParams.append('to', to);
      
      // Appliquer tous les filtres
      if (state.selectedProjectFilter) {
        planificationsUrl.searchParams.append('project_name', state.selectedProjectFilter);
        console.log(`Filtre projet (mois): ${state.selectedProjectFilter}`);
      }
      if (state.selectedAgentId) {
        planificationsUrl.searchParams.append('agent_id', state.selectedAgentId);
        console.log(`Filtre agent (mois): ${state.selectedAgentId}`);
      }
      // Note: Le filtre superviseur sera appliqué côté client
      if (state.selectedSupervisorId) {
        console.log(`Filtre superviseur (mois) à appliquer côté client: ${state.selectedSupervisorId}`);
      }
      // Mapper departement/commune ID -> nom pour l'API backend
      if (state.selectedDepartmentId) {
        const dept = (geoData.departements || []).find(d => String(d.id) === String(state.selectedDepartmentId));
        if (dept && dept.name) planificationsUrl.searchParams.append('departement', dept.name);
      }
      if (state.selectedCommuneId) {
        const communesForDept = (geoData.communes || {})[String(state.selectedDepartmentId)] || state.communes || [];
        const com = communesForDept.find(c => String(c.id) === String(state.selectedCommuneId));
        if (com && com.name) planificationsUrl.searchParams.append('commune', com.name);
      }
      if (state.selectedStatus) {
        planificationsUrl.searchParams.append('resultat_journee', state.selectedStatus);
      }

      const plansRes = await fetch(planificationsUrl.toString(), { headers, credentials: 'include' });
      
      if (!plansRes.ok) throw new Error('Erreur API lors du chargement du mois');
      
      const plansData = await plansRes.json();
      let plans = plansData.items || [];
      // Appliquer les filtres côté client
      plans = applyClientSideFilters(plans);
      console.log(`${plans.length} planifications après filtrage côté client (vue mois)`);
      hideAuthBanner();

      const weekAgg = new Map();
      plans.forEach(p => {
        const d = new Date(p.date + 'T12:00:00Z');
        const key = toISODate(startOfWeek(d));
        if (!weekAgg.has(key)) weekAgg.set(key, { minutes: 0, daysSet: new Set(), activities: [] });
        const bucket = weekAgg.get(key);
        const startMin = hoursToMinutes(p.planned_start_time);
        const endMin = hoursToMinutes(p.planned_end_time);
        if (endMin > startMin) bucket.minutes += (endMin - startMin);
        bucket.daysSet.add(p.date.slice(0, 10));
        if (p.description_activite) bucket.activities.push(p.description_activite);
      });

      const weeks = [];
      let cursor = new Date(`${from}T12:00:00Z`);
      while (cursor.getMonth() === month) {
        const ws = startOfWeek(cursor);
        const we = addDays(ws, 6);
        const wsIso = toISODate(ws);
        const agg = weekAgg.get(wsIso) || { minutes: 0, daysSet: new Set(), activities: [] };
        weeks.push({
          from: wsIso,
          to: toISODate(we),
          daysPlanned: agg.daysSet.size,
          hours: Math.floor(agg.minutes / 60),
          minutes: agg.minutes % 60,
          activities: agg.activities
        });
        cursor = addDays(we, 1);
      }
      
      const table = document.createElement('table');
      table.className = 'table table-striped table-sm';
      table.innerHTML = `
        <thead><tr><th>Semaine</th><th>Période</th><th>Jours planifiés</th><th>Heures</th><th>Actions</th></tr></thead>
        <tbody>
          ${weeks.map((w, i) => `
            <tr>
              <td>Sem. ${i + 1}</td>
              <td>${formatDate(w.from, 'dd/MM')} - ${formatDate(w.to, 'dd/MM')}</td>
              <td>${w.daysPlanned}</td>
              <td>${w.hours}h${String(w.minutes).padStart(2, '0')}</td>
              <td><button class="btn btn-sm btn-outline-primary" onclick="loadWeek('${w.from}')">Voir</button></td>
            </tr>
          `).join('')}
        </tbody>`;

      if (gantt) {
        gantt.innerHTML = '';
        gantt.appendChild(table);
      }

      const totalMinutes = weeks.reduce((acc, w) => acc + (w.hours * 60 + w.minutes), 0);
      if($('month-summary')) {
        $('month-summary').textContent = `Total: ${Math.floor(totalMinutes / 60)}h${String(totalMinutes % 60).padStart(2, '0')}`;
      }
    } catch (error) {
      console.error('Erreur chargement mois:', error);
      if ($('month-gantt')) $('month-gantt').innerHTML = '<div class="alert alert-danger">Erreur chargement.</div>';
    }
  };


  /**
   * Charge le récapitulatif hebdomadaire.
   */
  const loadWeeklySummary = async () => {
    console.log('Début du chargement du récapitulatif hebdomadaire');
    const summaryContainer = $('weekly-summary');
    if (!summaryContainer) {
      console.error('Conteneur weekly-summary introuvable dans le DOM');
      return;
    }
    
    // Afficher un indicateur de chargement
    summaryContainer.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-2 text-muted">Chargement du récapitulatif en cours...</p>
      </div>`;

    try {
      // 1. Préparer les paramètres de la requête
      const headers = await authHeaders();
      if (!headers) {
        throw new Error('Impossible de récupérer les en-têtes d\'authentification');
      }

      const today = new Date();
      const startDate = addDays(today, -42); // 6 semaines avant
      const endDate = addDays(today, 42);    // 6 semaines après
      
      console.log(`Période de chargement: ${toISODate(startDate)} au ${toISODate(endDate)}`);
      
      // Construire l'URL des planifications
      const planificationsUrl = new URL(`${API_BASE}/planifications`, window.location.origin);
      planificationsUrl.searchParams.append('from', toISODate(startDate));
      planificationsUrl.searchParams.append('to', toISODate(endDate));
      
      // Appliquer tous les filtres
      if (state.selectedProjectFilter) {
        planificationsUrl.searchParams.append('project_name', state.selectedProjectFilter);
        console.log(`Filtre projet: ${state.selectedProjectFilter}`);
      }
      
      if (state.selectedAgentId) {
        planificationsUrl.searchParams.append('agent_id', state.selectedAgentId);
        console.log(`Filtre agent: ${state.selectedAgentId}`);
      }
      
      // Note: Les filtres superviseur, département et commune seront appliqués côté client
      if (state.selectedSupervisorId) {
        console.log(`Filtre superviseur à appliquer côté client: ${state.selectedSupervisorId}`);
      }
      
      if (state.selectedDepartmentId) {
        console.log(`Filtre département à appliquer côté client: ${state.selectedDepartmentId}`);
      }
      
      if (state.selectedCommuneId) {
        console.log(`Filtre commune à appliquer côté client: ${state.selectedCommuneId}`);
      }

      // 2. Effectuer l'appel API pour les planifications
      console.log('Début de l\'appel API pour les planifications...');
      
      const plansRes = await fetch(planificationsUrl.toString(), { 
        headers, 
        credentials: 'include' 
      }).catch(err => {
        console.error('Erreur lors de la récupération des planifications:', err);
        return { ok: false, status: 500, json: async () => ({ items: [] }) };
      });
      
      // Utiliser les agents déjà chargés dans state.agents et state.supervisors
      let usersData = [];
      
      // Vérifier si state.agents est défini et contient des données
      if (state.agents && Array.isArray(state.agents) && state.agents.length > 0) {
        usersData = [...state.agents];
        console.log(`${usersData.length} agents trouvés dans state.agents`);
      } else {
        console.warn('Aucun agent trouvé dans state.agents, tentative de rechargement...');
        await loadUsers();
        if (state.agents && Array.isArray(state.agents)) {
          usersData = [...state.agents];
          console.log(`${usersData.length} agents chargés après rechargement`);
        }
      }
      
      // Ajouter les superviseurs et admins s'ils existent
      if (state.allSupervisors && Array.isArray(state.allSupervisors) && state.allSupervisors.length > 0) {
        usersData = [...usersData, ...state.allSupervisors];
        console.log(`${state.allSupervisors.length} superviseurs/admins ajoutés`);
      }
      
      console.log(`${usersData.length} utilisateurs chargés (${state.agents?.length || 0} agents, ${state.supervisors?.length || 0} superviseurs, ${state.admins?.length || 0} admins)`);

      // 3. Vérifier la réponse
      if (!plansRes || !plansRes.ok) {
        const errorMsg = plansRes ? `Erreur ${plansRes.status} lors du chargement des planifications` : 'Réponse invalide du serveur pour les planifications';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      // 4. Traiter les données des planifications
      const plansData = await plansRes.json();
      let plans = Array.isArray(plansData.items) ? plansData.items : [];
      console.log(`${plans.length} planifications chargées avant filtrage côté client`);
      
      // Debug: afficher les premières planifications pour voir la structure
      if (plans.length > 0) {
        console.log('Première planification:', plans[0]);
      }
      
      // Appliquer les filtres côté client
      plans = applyClientSideFilters(plans);
      console.log(`${plans.length} planifications après filtrage côté client`);
      
      // Vérifier que nous avons bien des données d'utilisateurs
      if (usersData.length === 0) {
        console.warn('Aucun utilisateur trouvé dans le state, tentative de rechargement...');
        await loadUsers(); // Recharger les utilisateurs si nécessaire
        usersData = [...(state.agents || []), ...(state.allSupervisors || [])];
        console.log(`${usersData.length} utilisateurs après rechargement`);
        
        // Si toujours aucun utilisateur, essayer de charger directement depuis l'API
        if (usersData.length === 0) {
          console.warn('Tentative de chargement direct depuis l\'API...');
          try {
            const headers = await authHeaders();
            const response = await fetch(`${API_BASE}/users`, { headers });
            if (response.ok) {
              const apiUsers = await response.json();
              usersData = apiUsers.filter(user => user && user.id !== undefined);
              console.log(`${usersData.length} utilisateurs chargés directement depuis l'API`);
            }
          } catch (error) {
            console.error('Erreur lors du chargement direct des utilisateurs:', error);
          }
        }
      }

      // Créer une map des utilisateurs pour un accès rapide
      const usersMap = new Map();
      
      // Remplir la map avec les utilisateurs
      usersData.forEach(user => {
        if (user && user.id !== undefined) {
          // S'assurer que l'ID est une chaîne pour éviter les problèmes de comparaison
          const userId = String(user.id);
          
          // S'assurer que l'utilisateur a un nom valide
          if (!user.name) {
            const firstName = user.first_name || '';
            const lastName = user.last_name || '';
            user.name = `${firstName} ${lastName}`.trim() || user.email || `Agent ${user.id}`;
          }
          
          usersMap.set(userId, user);
          
          // Ajouter également l'ID numérique si c'est différent
          if (user.id !== userId) {
            usersMap.set(user.id, user);
          }
        }
      });
      
      console.log(`Map des utilisateurs créée avec ${usersMap.size} entrées`);
      
      // Debug: afficher les utilisateurs chargés
      console.log('Utilisateurs chargés:', Array.from(usersMap.values()).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role
      })));
      const summaryMap = new Map();

      // 5. Traiter chaque planification
      plans.forEach(plan => {
        try {
          if (!plan || !plan.date) return;
          
          const planDate = new Date(plan.date);
          if (isNaN(planDate.getTime())) {
            console.warn('Date de planification invalide:', plan.date);
            return;
          }

          // Ignorer les week-ends
          const dayOfWeek = planDate.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) return;
          
          const weekStart = startOfWeek(planDate);
          const weekKey = `${toISODate(weekStart)}_${plan.user_id || plan.agent_id}_${plan.project_name || 'general'}`;

          // Initialiser la semaine si nécessaire
          if (!summaryMap.has(weekKey)) {
            // Utiliser les données utilisateur enrichies directement depuis la planification
            let userName = `Agent ${plan.user_id || plan.agent_id}`;
            let userEmail = '';
            let projectName = 'Projet Général';
            
            // Utiliser les données utilisateur enrichies si disponibles
            if (plan.user && plan.user.name) {
              userName = plan.user.name;
              userEmail = plan.user.email || '';
            } else {
              // Fallback vers la map des utilisateurs
              const user = usersMap.get(String(plan.user_id || plan.agent_id)) || usersMap.get(plan.user_id || plan.agent_id);
              if (user) {
                if (user.name && user.name.trim() !== '') {
                  userName = user.name;
                } else if (user.name) {
                  userName = user.name;
                } else if (user.email) {
                  userName = user.email;
                }
                userEmail = user.email || '';
              }
            }
            
            // Utiliser le nom du projet depuis l'utilisateur (table users, colonne project_name)
            if (plan.user && plan.user.project_name && plan.user.project_name.trim() !== '') {
              projectName = plan.user.project_name;
            } else {
              // Fallback vers la map des utilisateurs pour récupérer le project_name
              const user = usersMap.get(String(plan.user_id || plan.agent_id)) || usersMap.get(plan.user_id || plan.agent_id);
              if (user && user.project_name && user.project_name.trim() !== '') {
                projectName = user.project_name;
              }
            }
            
            console.log(`Nom d'agent récupéré: ${userName} pour l'ID ${plan.user_id || plan.agent_id}`);
            console.log(`Projet récupéré: ${projectName}`);
            console.log(`Données utilisateur enrichies:`, plan.user);
            
            summaryMap.set(weekKey, {
              week_start_date: toISODate(weekStart),
              user_id: plan.user_id || plan.agent_id,
              user_name: userName,
              user_email: userEmail,
              project_name: projectName,
              total_planned_hours: 0,
              planned_days: new Set(),
              activities: []
            });
          }

          // Mettre à jour le résumé de la semaine
          const summary = summaryMap.get(weekKey);
          
          // Calculer la durée planifiée
          if (plan.planned_start_time && plan.planned_end_time) {
            const startMinutes = hoursToMinutes(plan.planned_start_time);
            const endMinutes = hoursToMinutes(plan.planned_end_time);
            
            if (startMinutes >= 0 && endMinutes > startMinutes) {
              const durationHours = (endMinutes - startMinutes) / 60;
              summary.total_planned_hours += durationHours;
              summary.planned_days.add(toISODate(planDate));
            }
          }
          
          // Ajouter l'activité si elle n'existe pas déjà
          if (plan.description_activite && !summary.activities.includes(plan.description_activite)) {
            summary.activities.push(plan.description_activite);
          }
        } catch (err) {
          console.error('Erreur lors du traitement d\'une planification:', err, plan);
        }
      });

      // 6. Préparer les données pour l'affichage
      const weeklySummaries = Array.from(summaryMap.values())
        .map(s => ({
          ...s,
          total_planned_days: s.planned_days.size,
          activities_summary: s.activities.slice(0, 3).join(' | ') || 'Aucune activité',
          // Formater les heures avec une décimale
          total_planned_hours: Math.round(s.total_planned_hours * 10) / 10
        }))
        .sort((a, b) => 
          b.week_start_date.localeCompare(a.week_start_date) || 
          a.user_name.localeCompare(b.user_name)
        );

      console.log(`${weeklySummaries.length} semaines à afficher`);
      
      // 7. Afficher les résultats
      displayWeeklySummary(weeklySummaries);

    } catch (error) {
      console.error('Erreur lors du chargement du récapitulatif hebdomadaire:', error);
      
      let errorMessage = 'Erreur lors du chargement du récapitulatif';
      if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'Session expirée. Veuillez vous reconnecter.';
      } else if (error.message.includes('NetworkError')) {
        errorMessage = 'Erreur de connexion au serveur. Vérifiez votre connexion Internet.';
      }
      
      if (summaryContainer) {
        summaryContainer.innerHTML = `
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            ${errorMessage}
            <div class="mt-2">
              <button class="btn btn-sm btn-outline-primary" onclick="loadWeeklySummary()">
                <i class="bi bi-arrow-clockwise me-1"></i> Réessayer
              </button>
            </div>
            <div class="mt-2 small text-muted">
              Détails techniques: ${error.message || 'Aucun détail disponible'}
            </div>
          </div>`;
      }
    }
  };

  /**
   * Affiche le récapitulatif hebdomadaire.
   * @param {Array} summaries
   */
  const displayWeeklySummary = (summaries) => {
    const container = $('weekly-summary');
    if (!container) return;

    if (!summaries || summaries.length === 0) {
      container.innerHTML = `<div class="alert alert-info">Aucune activité planifiée trouvée pour les filtres sélectionnés.</div>`;
      return;
    }
    
    // Regrouper par semaine
    const weeksMap = new Map();
    summaries.forEach(summary => {
        const weekKey = summary.week_start_date;
        if (!weeksMap.has(weekKey)) {
            weeksMap.set(weekKey, []);
        }
        weeksMap.get(weekKey).push(summary);
    });

    const sortedWeeks = Array.from(weeksMap.keys()).sort((a, b) => b.localeCompare(a));
    
    let html = '';
    sortedWeeks.forEach(weekKey => {
        const weekSummaries = weeksMap.get(weekKey);
        const weekStartDate = new Date(weekKey + 'T12:00:00Z');
        html += `
            <div class="card mb-4">
                <div class="card-header">
                    Semaine du ${formatDate(weekStartDate, 'dd/MM/yyyy')}
                </div>
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Agent</th>
                                <th>Projet</th>
                                <th class="text-center">Heures plan.</th>
                                <th class="text-center">Jours plan.</th>
                                <th>Activités</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${weekSummaries.map(item => `
                                <tr>
                                    <td>
                                        <div class="fw-semibold">${item.user_name}</div>
                                        <small class="text-muted">${item.user_email}</small>
                                    </td>
                                    <td><span class="badge bg-info">${item.project_name}</span></td>
                                    <td class="text-center">${item.total_planned_hours.toFixed(1)}h</td>
                                    <td class="text-center"><span class="badge bg-secondary">${item.total_planned_days}</span></td>
                                    <td><small class="text-muted" title="${item.activities.join('\n')}">${item.activities_summary}</small></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
  };


  /**
   * Affiche une notification toast
   * @param {string} message - Le message à afficher
   * @param {string} type - Le type de notification (success, error, warning, info)
   */
  const showToast = (message, type = 'info') => {
    try {
      // Créer le conteneur s'il n'existe pas
      let toastContainer = document.getElementById('toast-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
      }

      // Créer le toast
      const toast = document.createElement('div');
      const toastClass = `alert alert-${type} alert-dismissible fade show`;
      toast.className = toastClass;
      toast.role = 'alert';
      toast.style.marginBottom = '10px';
      toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
      
      // Icône selon le type
      let icon = 'info-circle';
      if (type === 'success') icon = 'check-circle';
      else if (type === 'error') icon = 'exclamation-triangle';
      else if (type === 'warning') icon = 'exclamation-circle';
      
      toast.innerHTML = `
        <i class="bi bi-${icon} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      `;
      
      toastContainer.appendChild(toast);
      
      // Animation d'entrée
      setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
      }, 10);
      
      // Supprimer automatiquement après 5 secondes
      const removeToast = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      };
      
      const timeoutId = setTimeout(removeToast, 5000);
      
      // Annuler la suppression automatique si l'utilisateur survole le toast
      toast.addEventListener('mouseenter', () => clearTimeout(timeoutId));
      toast.addEventListener('mouseleave', () => {
        const newTimeoutId = setTimeout(removeToast, 2000);
        toast.dataset.timeoutId = newTimeoutId;
      });
      
      // Gérer la fermeture manuelle
      const closeBtn = toast.querySelector('.btn-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          clearTimeout(timeoutId);
          removeToast();
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'affichage du toast:', error);
      // Fallback simple
      alert(message);
    }
  };

  /**
   * Calcule la durée entre deux heures.
   * @param {string} startTime
   * @param {string} endTime
   * @returns {string}
   */
  const calculateDuration = (startTime, endTime) => {
    try {
      const start = hoursToMinutes(startTime);
      const end = hoursToMinutes(endTime);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        const duration = (end - start);
        const hours = Math.floor(duration/60);
        const minutes = Math.round(duration % 60);
        return `${hours}h${minutes.toString().padStart(2, '0')}`;
      }
      return '-';
    } catch (e) {
      return '-';
    }
  };

  /**
   * Charge les informations de l'utilisateur.
   */
  const loadUserInfo = async () => {
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_BASE}/profile`, { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.user) displayUserName(data.user);
      }
    } catch (error) {
      console.error('Erreur chargement info utilisateur:', error);
    }
  };

  /**
   * Affiche le nom de l'utilisateur.
   * @param {Object} user
   */
  const displayUserName = (user) => {
    const displayElement = $('user-display-name');
    if (displayElement) {
      const displayName = user.name || user.email;
      displayElement.textContent = displayName;
    }
  };

  // ----------------------------
  // 7. INITIALISATION
  // ----------------------------
  /**
   * Applique les filtres sélectionnés
   */
  const applyFilters = () => {
    const filters = {
      agentId: $('agent-select')?.value || '',
      supervisorId: $('supervisor-filter-select')?.value || '',
      project: $('project-filter-select')?.value || '',
      departmentId: $('department-filter-select')?.value || '',
      communeId: $('commune-filter-select')?.value || '',
      status: $('status-filter-select')?.value || ''
    };
    
    console.log('Application des filtres:', filters);
    
    // Mettre à jour l'état global
    state.selectedAgentId = filters.agentId;
    state.selectedSupervisorId = filters.supervisorId;
    state.selectedProjectFilter = filters.project;
    state.selectedDepartmentId = filters.departmentId;
    state.selectedCommuneId = filters.communeId;
    
    // Mettre à jour l'URL avec les filtres
    updateUrlWithFilters(filters);
    
    // Recharger les données avec les nouveaux filtres
    console.log('Rechargement des vues avec les filtres appliqués...');
    
    // Recharger la vue hebdomadaire avec les filtres
    const weekStartInput = $('week-start');
    if (weekStartInput && weekStartInput.value) {
      loadWeek(weekStartInput.value);
    } else {
      loadWeek();
    }
    
    // Recharger le récapitulatif hebdomadaire avec les filtres
    loadWeeklySummary();
    
    // Recharger la vue mensuelle avec les filtres
    const monthInput = $('month');
    if (monthInput && monthInput.value) {
      loadMonth(monthInput.value);
    } else {
      loadMonth();
    }
    
    console.log('Filtres appliqués avec succès');
  };
  
  /**
   * Met à jour l'URL avec les filtres actuels
   */
  const updateUrlWithFilters = (filters) => {
    const params = new URLSearchParams();
    
    if (filters.agentId) params.set('agent', filters.agentId);
    if (filters.supervisorId) params.set('supervisor', filters.supervisorId);
    if (filters.project) params.set('project', filters.project);
    if (filters.departmentId) params.set('department', filters.departmentId);
    if (filters.communeId) params.set('commune', filters.communeId);
    if (filters.status) params.set('status', filters.status);
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  };
  
  /**
   * Charge les filtres depuis l'URL
   */
  const loadFiltersFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('agent') && $('agent-select')) $('agent-select').value = params.get('agent');
    if (params.has('supervisor') && $('supervisor-filter-select')) $('supervisor-filter-select').value = params.get('supervisor');
    if (params.has('project') && $('project-filter-select')) $('project-filter-select').value = params.get('project');
    
    if (params.has('department') && $('department-filter-select')) {
      const deptId = params.get('department');
      $('department-filter-select').value = deptId;
      
      // Si une commune est spécifiée, charger les communes du département
      if (params.has('commune') && deptId) {
        loadCommunes(deptId).then(() => {
          if ($('commune-filter-select')) {
            $('commune-filter-select').value = params.get('commune');
          }
        });
      }
    }
    
    if (params.has('status') && $('status-filter-select')) {
      $('status-filter-select').value = params.get('status');
    }
  };
  
  /**
   * Affiche un message d'erreur à l'utilisateur
   */
  const showError = (message) => {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
      container.insertBefore(alertDiv, container.firstChild);
    }
  };

  /**
   * Initialise le Gantt
   */
  const setupGantt = () => {
    console.log('Initialisation du Gantt...');
    // Le Gantt sera initialisé dans les fonctions loadWeek et loadMonth
  };

  /**
   * Réinitialise le formulaire de planification
   */
  const resetPlanningForm = () => {
    // Réinitialiser les sélecteurs
    if ($('agent-select')) $('agent-select').value = '';
    if ($('supervisor-filter-select')) $('supervisor-filter-select').value = '';
    if ($('project-filter-select')) $('project-filter-select').value = '';
    if ($('department-filter-select')) $('department-filter-select').value = '';
    if ($('commune-filter-select')) $('commune-filter-select').value = '';
    if ($('status-filter-select')) $('status-filter-select').value = '';
    
    // Réinitialiser l'état global
    state.selectedAgentId = '';
    state.selectedSupervisorId = '';
    state.selectedProjectFilter = '';
    state.selectedDepartmentId = '';
    state.selectedCommuneId = '';
  };

  /**
   * Gère la soumission du formulaire de planification
   */
  const handlePlanningSubmit = async (event) => {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    
    // Validation des champs requis
    if (!payload.agent_id || !payload.start_date || !payload.end_date || !payload.start_time || !payload.end_time) {
      showError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    
    try {
      // Préparer les données pour l'API
      const planningData = {
        user_id: parseInt(payload.agent_id, 10),
        date: payload.start_date,
        planned_start_time: payload.start_time,
        planned_end_time: payload.end_time,
        description_activite: payload.notes || '',
        resultat_journee: 'en_cours',
        project_name: payload.project_id || null
      };
      
      // Utiliser la fonction savePlanning centralisée
      await savePlanning(planningData, submitBtn);
      
      // Afficher un message de succès
      showToast('Planification enregistrée avec succès', 'success');
      
      // Recharger les données
      await loadWeek($('week-start')?.value || toISODate(new Date()));
      await loadWeeklySummary();
      
      // Réinitialiser le formulaire
      form.reset();
      
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la planification:', error);
      showError(error.message || 'Une erreur est survenue lors de l\'enregistrement');
    }
  };

  /**
   * Configure les écouteurs d'événements
   */
  const setupEventListeners = () => {
    // Ajouter l'écouteur pour le formulaire de planification
    const planningForm = document.getElementById('planning-form');
    if (planningForm) {
      planningForm.addEventListener('submit', handlePlanningSubmit);
    }
    // Écouteurs pour les filtres
    const agentSelect = $('agent-select');
    const supervisorSelect = $('supervisor-filter-select');
    const projectSelect = $('project-filter-select');
    const departmentSelect = $('department-filter-select');
    const communeSelect = $('commune-filter-select');
    const statusSelect = $('status-filter-select');
    
    if (agentSelect) agentSelect.addEventListener('change', applyFilters);
    if (supervisorSelect) supervisorSelect.addEventListener('change', applyFilters);
    if (projectSelect) projectSelect.addEventListener('change', applyFilters);
    if (departmentSelect) {
      departmentSelect.addEventListener('change', (e) => {
        const departmentId = e.target.value;
        if (departmentId) {
          loadCommunes(departmentId);
        } else {
          state.communes = [];
          updateCommuneSelect();
        }
        applyFilters();
      });
    }
    if (communeSelect) communeSelect.addEventListener('change', applyFilters);
    if (statusSelect) statusSelect.addEventListener('change', applyFilters);
    
    // Écouteur pour le bouton d'application des filtres
    const applyBtn = $('apply-filters-btn');
    if (applyBtn) applyBtn.addEventListener('click', applyFilters);
    
    // Écouteur pour le chargement de la semaine
    const weekStartInput = $('week-start');
    if (weekStartInput) {
      weekStartInput.addEventListener('change', () => {
        if (weekStartInput.value) {
          loadWeek(weekStartInput.value);
        }
      });
    }
    
    // Écouteurs pour les boutons de navigation
    const prevWeekBtn = $('prev-week');
    const nextWeekBtn = $('next-week');
    const prevMonthBtn = $('prev-month');
    const nextMonthBtn = $('next-month');
    
    if (prevWeekBtn) {
      prevWeekBtn.addEventListener('click', () => {
        const currentDate = $('week-start')?.value ? new Date($('week-start').value) : new Date();
        const newDate = addDays(currentDate, -7);
        loadWeek(toISODate(newDate));
      });
    }
    
    if (nextWeekBtn) {
      nextWeekBtn.addEventListener('click', () => {
        const currentDate = $('week-start')?.value ? new Date($('week-start').value) : new Date();
        const newDate = addDays(currentDate, 7);
        loadWeek(toISODate(newDate));
      });
    }
    
    if (prevMonthBtn) {
      prevMonthBtn.addEventListener('click', () => {
        const currentDate = $('month')?.value ? new Date($('month').value + '-01') : new Date();
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        loadMonth(toISODate(newDate).slice(0, 7));
      });
    }
    
    if (nextMonthBtn) {
      nextMonthBtn.addEventListener('click', () => {
        const currentDate = $('month')?.value ? new Date($('month').value + '-01') : new Date();
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        loadMonth(toISODate(newDate).slice(0, 7));
      });
    }
  };

  /**
   * Initialise l'application au chargement de la page.
   */
  const init = async () => {
    console.log('🚀 Initialisation de l\'application Planning...');
    
    // Vérifier l'authentification
    const token = findToken();
    if (!token) {
      console.log('❌ Aucun token trouvé, affichage de la bannière d\'authentification');
      showAuthBanner();
      
      // Essayer de démarrer si le token apparaît plus tard (ex: connexion dans un autre onglet)
      window.addEventListener('storage', (e) => {
        if (e.key && DEFAULT_TOKEN_CANDIDATES.includes(e.key) && e.newValue) {
          console.log('🔄 Token détecté dans le storage, relance de l\'initialisation');
          hideAuthBanner();
          init(); // Relancer l'initialisation si un token est détecté
        }
      });
      return;
    }
    
    console.log('✅ Token trouvé, démarrage de l\'initialisation');
    // Cacher la bannière d'authentification si l'utilisateur est connecté
    hideAuthBanner();
    
    try {
      console.log('📋 Étape 1: Chargement des informations utilisateur...');
      await loadUserInfo();
      
      console.log('📋 Étape 2: Chargement des données en parallèle...');
      // Charger les données initiales en parallèle pour améliorer les performances
      const [usersResult, projectsResult, departmentsResult] = await Promise.allSettled([
        loadUsers(),
        loadProjects(),
        loadDepartments()
      ]);
      
      // Vérifier les résultats
      if (usersResult.status === 'rejected') {
        console.error('❌ Erreur lors du chargement des utilisateurs:', usersResult.reason);
      } else {
        console.log('✅ Utilisateurs chargés avec succès');
      }
      
      if (projectsResult.status === 'rejected') {
        console.error('❌ Erreur lors du chargement des projets:', projectsResult.reason);
      } else {
        console.log('✅ Projets chargés avec succès');
      }
      
      if (departmentsResult.status === 'rejected') {
        console.error('❌ Erreur lors du chargement des départements:', departmentsResult.reason);
      } else {
        console.log('✅ Départements chargés avec succès');
      }
      
      console.log('📋 Étape 3: Initialisation du Gantt...');
      // Initialiser le Gantt
      setupGantt();
      
      console.log('📋 Étape 4: Configuration des écouteurs d\'événements...');
      // Configurer les écouteurs d'événements
      setupEventListeners();
      
      console.log('📋 Étape 5: Chargement des filtres depuis l\'URL...');
      // Charger les filtres depuis l'URL
      loadFiltersFromUrl();
      
      console.log('📋 Étape 6: Chargement des données du planning...');
      // Charger les données initiales du planning
      loadWeek();
      loadWeeklySummary();
      
      console.log('📋 Étape 7: Réinitialisation du formulaire...');
      // Réinitialiser le formulaire
      resetPlanningForm();
      
      console.log('🎉 Initialisation terminée avec succès!');
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation:', error);
      showError('Une erreur est survenue lors du chargement des données.');
    }
  };


  // ----------------------------
  // 8. DÉMARRAGE
  // ----------------------------
  document.addEventListener('DOMContentLoaded', init);

  // Exposition des fonctions globales (si nécessaire pour des appels depuis le HTML)
  window.loadWeek = loadWeek;
  window.loadMonth = loadMonth;
  window.loadWeeklySummary = loadWeeklySummary;
  window.applyFilters = applyFilters;
  window.resetPlanningForm = resetPlanningForm;
})();