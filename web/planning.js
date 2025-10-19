// =============================================
// Planning App - Code principal (version complète et propre)
// =============================================

// IIFE pour éviter la pollution de l'espace global
(() => {
  'use strict';

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
    selectedAgentId: '',
    supervisors: [],
    selectedSupervisorId: '',
    departments: [],
    communes: [],
    selectedDepartmentId: '',
    selectedCommuneId: '',
  };

  // ----------------------------
  // 3. UTILITAIRES (HELPERS)
  // ----------------------------

  /**
   * Récupère un élément DOM par son ID.
   * @param {string} id - ID de l'élément
   * @returns {HTMLElement|null}
   */
  const $ = (id) => document.getElementById(id);

  /**
   * Trouve un token JWT dans le stockage local ou global.
   * @returns {string}
   */
  const findToken = () => {
    for (const key of DEFAULT_TOKEN_CANDIDATES) {
      const value = (localStorage.getItem(key) || '').trim();
      if (value && value.split('.').length >= 3) return value;
    }
    if (typeof window.jwt === 'string' && window.jwt.split('.').length >= 3) {
      return window.jwt;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) || '';
      if (value.split('.').length >= 3 && value.length > 60) return value;
    }
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
    const diff = (day === 0 ? -6 : 1) - day;
    return addDays(d, diff);
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
        loadMonth($('month').value);
      } catch (e) {
        console.error('Erreur loadMonth:', e);
      }
    }, delay);
  };

  // ----------------------------
  // 5. CHARGEMENT DES DONNÉES
  // ----------------------------

  /**
   * Charge la liste des agents.
   */
  const loadAgents = async () => {
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_BASE}/admin/agents`, { headers });
      if (response.ok) {
        const result = await response.json();
        const users = result.agents || result.data || result || [];
        if (!Array.isArray(users)) return;
        state.agents = users.filter(user => user.role === 'agent');
        updateAgentSelect();
      }
    } catch (error) {
      console.error('Erreur chargement agents:', error);
    }
  };

  /**
   * Charge la liste des superviseurs.
   */
  const loadSupervisors = async () => {
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_BASE}/admin/agents`, { headers });
      if (response.ok) {
        const result = await response.json();
        const users = result.agents || result.data || result || [];
        if (!Array.isArray(users)) return;
        state.supervisors = users.filter(u =>
          ['supervisor', 'superviseur'].includes(String(u.role || '').toLowerCase())
        );
        updateSupervisorSelect();
      }
    } catch (error) {
      console.error('Erreur chargement superviseurs:', error);
    }
  };

  /**
   * Charge la liste des projets.
   */
  const loadProjects = async () => {
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_BASE}/admin/agents`, { headers });
      if (response.ok) {
        const result = await response.json();
        const users = result.agents || result.data || result || [];
        if (!Array.isArray(users)) return;
        const projectsSet = new Set();
        users.forEach(user => {
          if (user.project_name?.trim()) {
            projectsSet.add(user.project_name.trim());
          }
        });
        state.projects = Array.from(projectsSet).sort();
        updateProjectSelect();
      }
    } catch (error) {
      console.error('Erreur chargement projets:', error);
    }
  };

  /**
   * Charge la liste des départements.
   */
  const loadDepartments = async () => {
    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_BASE}/departments`, { headers });
      if (response.ok) {
        const data = await response.json();
        state.departments = data.items || [];
        updateDepartmentSelect();
      }
    } catch (error) {
      console.error('Erreur chargement départements:', error);
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
        state.communes = data.items || [];
        updateCommuneSelect();
      }
    } catch (error) {
      console.error('Erreur chargement communes:', error);
    }
  };

  /**
   * Met à jour la liste déroulante des agents.
   */
  const updateAgentSelect = () => {
    const select = $('agent-select');
    if (!select) return;
    select.innerHTML = '<option value="">Tous les agents</option>';
    state.agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.id;
      const name = agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email;
      option.textContent = `${name} (${agent.email})`;
      select.appendChild(option);
    });
  };

  /**
   * Met à jour la liste déroulante des superviseurs.
   */
  const updateSupervisorSelect = () => {
    const select = $('supervisor-select');
    if (!select) return;
    const prevValue = select.value;
    select.innerHTML = '<option value="">Tous</option>';
    state.supervisors.forEach(supervisor => {
      const option = document.createElement('option');
      option.value = String(supervisor.id || supervisor.email || '');
      const name = supervisor.name || `${supervisor.first_name || ''} ${supervisor.last_name || ''}`.trim() || supervisor.email;
      option.textContent = name;
      select.appendChild(option);
    });
    if (prevValue) select.value = prevValue;
  };

  /**
   * Met à jour la liste déroulante des projets.
   */
  const updateProjectSelect = () => {
    const select = $('project-select');
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
      const select = $('agent-select');
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

  // ----------------------------
  // 6. GESTION DE LA PLANIFICATION
  // ----------------------------

  /**
   * Charge la planification pour une semaine.
   * @param {string} dateStr
   */
  const loadWeek = async (dateStr) => {
    const start = startOfWeek(dateStr ? new Date(dateStr) : new Date());
    $('week-start').value = toISODate(start);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const from = toISODate(days[0]);
    const to = toISODate(days[6]);

    try {
      const headers = await authHeaders();
      const projectParam = state.selectedProjectId ? `&project_name=${encodeURIComponent(state.selectedProjectId)}` : '';
      const agentParam = state.selectedAgentId ? `&user_id=${encodeURIComponent(state.selectedAgentId)}` : '';
      const supervisorParam = state.selectedSupervisorId ? `&supervisor_id=${encodeURIComponent(state.selectedSupervisorId)}` : '';
      const checkinsPath = state.selectedAgentId
        ? `/checkins?agent_id=${encodeURIComponent(state.selectedAgentId)}&from=${from}&to=${to}`
        : `/checkins/mine?from=${from}&to=${to}`;
      const validationsPath = state.selectedAgentId
        ? `/validations?agent_id=${encodeURIComponent(state.selectedAgentId)}&from=${from}&to=${to}`
        : `/validations/mine?from=${from}&to=${to}`;

      const [plansRes, checkinsRes, validationsRes] = await Promise.all([
        fetch(`${API_BASE}/planifications?from=${from}&to=${to}${projectParam}${agentParam}${supervisorParam}`, { headers }),
        fetch(`${API_BASE}${checkinsPath}`, { headers }),
        fetch(`${API_BASE}${validationsPath}`, { headers }),
      ]);

      if ([plansRes.status, checkinsRes.status, validationsRes.status].includes(401)) {
        showAuthBanner('🔒 Session requise pour charger la planification. Connectez-vous depuis la page d\'accueil, puis revenez ici.');
        const tryRetry = () => {
          if (findToken()) {
            hideAuthBanner();
            loadWeek($('week-start').value);
          }
        };
        if (findToken()) setTimeout(tryRetry, 1500);
        else {
          const onStorage = (e) => {
            if (e.key === 'jwt' && e.newValue) {
              window.removeEventListener('storage', onStorage);
              tryRetry();
            }
          };
          window.addEventListener('storage', onStorage);
        }
        return;
      }

      const plans = (await plansRes.json()).items || [];
      const checkins = (await checkinsRes.json()).items || [];
      const validations = (await validationsRes.json()).items || [];

      hideAuthBanner();

      const plansByDate = new Map(plans.map(plan => [plan.date.slice(0, 10), plan]));
      const checkinDates = new Set(checkins.map(c => (c.timestamp || '').slice(0, 10)));
      const validatedDates = new Set(validations.filter(v => v.valid).map(v => toISODate(new Date(v.created_at))));

      const gantt = $('week-gantt');
      const todayIso = toISODate(new Date());

      gantt.innerHTML = '';
      const header = document.createElement('div');
      header.className = 'gantt-header d-flex border-bottom';
      header.innerHTML = `
        <div class="gantt-col gantt-day-col fw-bold text-center" style="width:120px">Jour</div>
        <div class="flex-grow-1 d-flex">
          ${Array.from({ length: 24 }, (_, h) => `<div class="gantt-col text-center small" style="width:60px">${String(h).padStart(2, '0')}h</div>`).join('')}
        </div>`;
      gantt.appendChild(header);

      let weeklyMinutes = 0;

      days.forEach((d, idx) => {
        const iso = toISODate(d);
        const plan = plansByDate.get(iso);
        const startMin = hoursToMinutes(plan?.planned_start_time || '');
        const endMin = hoursToMinutes(plan?.planned_end_time || '');
        const planned = Boolean(plan && (plan.planned_start_time || plan.planned_end_time));
        const duration = (Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin) ? (endMin - startMin) : 0;
        weeklyMinutes += duration;
        const hasPresence = checkinDates.has(iso);
        const isValidated = validatedDates.has(iso);
        const isPast = iso < todayIso;

        const row = document.createElement('div');
        row.className = 'gantt-row d-flex align-items-center border-bottom py-2';
        row.innerHTML = `
          <div class="gantt-col d-flex align-items-center gap-2" style="width:120px">
            <span class="fw-semibold">${DAY_NAMES[idx]} ${d.toLocaleDateString()}</span>
            ${planned ? '<span class="badge bg-primary">Planifié</span>' : '<span class="badge bg-secondary">Libre</span>'}
            ${hasPresence ? `<span class="badge ${isValidated ? 'bg-success' : 'bg-warning'}">${isValidated ? 'Présence validée' : 'Présence à valider'}</span>` : ''}
            ${plan?.project_name ? `<span class="badge bg-info">${plan.project_name}</span>` : ''}
            ${isPast ? '<span class="badge bg-secondary">Verrouillé</span>' : ''}
          </div>
          <div class="flex-grow-1 position-relative" style="height:34px">
            <div class="position-absolute bg-light w-100 h-100" style="opacity:.6"></div>
            ${planned && duration > 0 ? `<div class="position-absolute bg-primary" style="left:${startMin}px;width:${duration}px;height:26px;border-radius:6px;opacity:.85"></div>` : ''}
            <div class="position-absolute d-flex gap-2" style="left:4px;top:4px">
              <input type="time" class="form-control form-control-sm" id="gs-${iso}" value="${plan?.planned_start_time || ''}" style="width:110px" ${isPast ? 'disabled title="Jour passé — verrouillé"' : ''}>
              <input type="time" class="form-control form-control-sm" id="ge-${iso}" value="${plan?.planned_end_time || ''}" style="width:110px" ${isPast ? 'disabled' : ''}>
              <button class="btn btn-sm btn-success" data-date="${iso}" ${isPast ? 'disabled title="Jour passé — verrouillé"' : ''}>OK</button>
            </div>
            <div class="position-absolute d-flex gap-2" style="left:4px;top:40px">
              <input type="text" class="form-control form-control-sm" id="desc-${iso}" placeholder="Description de l'activité (2 lignes max)" value="${plan?.description_activite || ''}" style="width:300px" ${isPast ? 'disabled' : ''}>
            </div>
          </div>`;

        gantt.appendChild(row);

        if (plan?.description_activite) {
          const descRow = document.createElement('div');
          descRow.className = 'gantt-row border-bottom py-2';
          descRow.innerHTML = `
            <div class="col-12">
              <small class="text-muted">Description:</small>
              <div class="small">${plan.description_activite}</div>
            </div>
          `;
          gantt.appendChild(descRow);
        }

        try {
          const startInput = $(`gs-${iso}`);
          const endInput = $(`ge-${iso}`);
          if (startInput && !startInput.disabled) startInput.addEventListener('input', () => scheduleMonthRefresh());
          if (endInput && !endInput.disabled) endInput.addEventListener('input', () => scheduleMonthRefresh());
        } catch (e) {
          console.error('Erreur ajout event listener:', e);
        }
      });

      $('week-summary').textContent = `Total planifié: ${Math.round(weeklyMinutes / 60)}h${String(weeklyMinutes % 60).padStart(2, '0')}`;

      gantt.querySelectorAll('button[data-date]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const date = btn.getAttribute('data-date');
          if (date < todayIso) {
            alert('Impossible de planifier un jour passé.');
            return;
          }
          const planned_start_time = $(`gs-${date}`).value || null;
          const planned_end_time = $(`ge-${date}`).value || null;
          const description_activite = $(`desc-${date}`)?.value || null;
          const headers = await authHeaders();
          const response = await fetch(`${API_BASE}/planifications`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
              date,
              planned_start_time,
              planned_end_time,
              description_activite,
              project_name: state.selectedProjectId
            })
          });
          if (response.status === 401) {
            showAuthBanner('🔒 Session requise pour enregistrer la planification. Connectez-vous puis réessayez.');
            const tryRetry = () => {
              if (findToken()) {
                hideAuthBanner();
                loadWeek($('week-start').value);
              }
            };
            if (findToken()) setTimeout(tryRetry, 1500);
            else {
              const onStorage = (e) => {
                if (e.key === 'jwt' && e.newValue) {
                  window.removeEventListener('storage', onStorage);
                  tryRetry();
                }
              };
              window.addEventListener('storage', onStorage);
            }
            return;
          }
          if (response.ok) {
            await loadWeek($('week-start').value);
            try {
              await loadMonth($('month').value);
            } catch (e) {
              console.error('Erreur loadMonth:', e);
            }
            await loadWeeklySummary();
          } else {
            alert('Erreur enregistrement');
          }
        });
      });

    } catch (error) {
      console.error('Erreur chargement semaine:', error);
    }
  };

  /**
   * Charge la planification pour un mois.
   * @param {string} monthStr
   */
  const loadMonth = async (monthStr) => {
    const base = monthStr ? new Date(monthStr + '-01') : new Date();
    $('month').value = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
    const year = base.getFullYear();
    const month = base.getMonth();
    const days = daysInMonth(year, month);
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;

    try {
      const headers = await authHeaders();
      const gantt = $('month-gantt');
      if (gantt) gantt.innerHTML = '<div class="text-muted">Chargement du récap mensuel…</div>';

      const projectParam = state.selectedProjectId ? `&project_name=${encodeURIComponent(state.selectedProjectId)}` : '';
      const agentParam = state.selectedAgentId ? `&agent_id=${encodeURIComponent(state.selectedAgentId)}` : '';
      const supervisorParam = state.selectedSupervisorId ? `&supervisor_id=${encodeURIComponent(state.selectedSupervisorId)}` : '';
      const checkinsPathM = state.selectedAgentId
        ? `/checkins?agent_id=${encodeURIComponent(state.selectedAgentId)}&from=${from}&to=${to}`
        : `/checkins/mine?from=${from}&to=${to}`;

      const [plansRes, checkinsRes] = await Promise.all([
        fetch(`${API_BASE}/planifications?from=${from}&to=${to}${projectParam}${agentParam}${supervisorParam}`, { headers }),
        fetch(`${API_BASE}${checkinsPathM}`, { headers })
      ]);

      if (plansRes.status === 401 || checkinsRes.status === 401) {
        if (gantt) gantt.innerHTML = '<div class="text-muted">Connexion requise pour afficher le récap mensuel.</div>';
        showAuthBanner('🔒 Session requise pour charger la planification mensuelle. Connectez-vous puis revenez.');
        const tryRetry = () => {
          if (findToken()) {
            hideAuthBanner();
            loadMonth($('month').value);
          }
        };
        if (findToken()) setTimeout(tryRetry, 1500);
        else {
          const onStorage = (e) => {
            if (e.key === 'jwt' && e.newValue) {
              window.removeEventListener('storage', onStorage);
              tryRetry();
            }
          };
          window.addEventListener('storage', onStorage);
        }
        return;
      }

      const plans = (await plansRes.json()).items || [];
      const checkins = (await checkinsRes.json()).items || [];

      hideAuthBanner();

      const plansNorm = (plans || [])
        .map(p => ({
          date: String(p.date).slice(0, 10),
          s: hoursToMinutes(p.planned_start_time),
          e: hoursToMinutes(p.planned_end_time)
        }))
        .filter(p => (Number.isFinite(p.s) || Number.isFinite(p.e)) && ((p.e || 0) >= (p.s || 0)));

      const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
      const firstDate = new Date(firstDay + 'T00:00:00');
      const lastDate = new Date(lastDay + 'T23:59:59');
      const expandedStart = startOfWeek(firstDate);
      const expandedEnd = addDays(startOfWeek(lastDate), 6);

      const weekAgg = new Map();
      for (const p of plansNorm) {
        const d = new Date(p.date + 'T00:00:00');
        if (d < expandedStart || d > expandedEnd) continue;
        const ws = startOfWeek(d);
        const we = addDays(ws, 6);
        const key = toISODate(ws);
        if (!weekAgg.has(key)) weekAgg.set(key, { from: toISODate(ws), to: toISODate(we), minutes: 0, daysSet: new Set() });
        const bucket = weekAgg.get(key);
        const duration = (Number.isFinite(p.s) && Number.isFinite(p.e) && p.e > p.s) ? (p.e - p.s) : 0;
        bucket.minutes += duration;
        bucket.daysSet.add(toISODate(d));
      }

      const weeks = [];
      let cursor = new Date(firstDay + 'T00:00:00');
      while (cursor.getMonth() === month) {
        const ws = startOfWeek(cursor);
        const we = addDays(ws, 6);
        const wsIso = toISODate(ws);
        const agg = weekAgg.get(wsIso) || { from: toISODate(ws), to: toISODate(we), minutes: 0, daysSet: new Set() };
        const minutes = agg.minutes;
        const daysPlanned = agg.daysSet.size;
        weeks.push({ from: agg.from, to: agg.to, daysPlanned, hours: Math.round(minutes / 60), minutes: minutes % 60 });
        cursor = addDays(we, 1);
      }

      const table = document.createElement('table');
      table.className = 'table table-striped';
      table.innerHTML = `
        <thead><tr>
          <th>Semaine</th>
          <th>Période</th>
          <th>Jours planifiés</th>
          <th>Heures planifiées</th>
          <th>Activités planifiées</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>
          ${weeks.map((w, i) => `
            <tr>
              <td>Semaine ${i + 1}</td>
              <td>du ${new Date(w.from).toLocaleDateString()} au ${new Date(w.to).toLocaleDateString()}</td>
              <td>${w.daysPlanned}</td>
              <td>${w.hours}h${String(w.minutes).padStart(2, '0')}</td>
              <td>
                <div class="activities-summary" style="max-width: 300px; max-height: 100px; overflow-y: auto;">
                  ${getWeekActivities(w.from, w.to, plans) || '<em class="text-muted">Aucune activité planifiée</em>'}
                </div>
              </td>
              <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editWeekPlanning('${w.from}', '${w.to}')">
                  <i class="bi bi-pencil"></i> Éditer
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>`;

      if (gantt) {
        gantt.innerHTML = '';
        gantt.appendChild(table);
      }

      const totalMinutes = (weeks || []).reduce((acc, w) => acc + (w.hours * 60 + w.minutes), 0);
      const totalDaysPlanned = (weeks || []).reduce((acc, w) => acc + w.daysPlanned, 0);
      $('month-summary').textContent = `Total planifié: ${Math.round(totalMinutes / 60)}h${String(totalMinutes % 60).padStart(2, '0')} • Jours planifiés: ${totalDaysPlanned}`;

      await loadWeeklySummary();

    } catch (error) {
      console.error('Erreur chargement mois:', error);
      const gantt = $('month-gantt');
      if (gantt) gantt.innerHTML = '<div class="alert alert-danger">Erreur lors du chargement du récapitulatif mensuel.</div>';
    }
  };

  /**
   * Récupère les activités d'une semaine.
   * @param {string} weekStart
   * @param {string} weekEnd
   * @param {Array} plans
   * @returns {string|null}
   */
  const getWeekActivities = (weekStart, weekEnd, plans) => {
    const weekPlans = plans.filter(plan => {
      const planDate = new Date(plan.date);
      const start = new Date(weekStart);
      const end = new Date(weekEnd);
      return planDate >= start && planDate <= end && plan.description_activite;
    });
    if (weekPlans.length === 0) return null;
    return weekPlans.map(plan => {
      const date = new Date(plan.date).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric'
      });
      return `<div class="small mb-1">
        <strong>${date}:</strong> ${plan.description_activite}
      </div>`;
    }).join('');
  };

  /**
   * Charge le récapitulatif hebdomadaire.
   */
  const loadWeeklySummary = async () => {
    const summaryContainer = $('weekly-summary');
    if (!summaryContainer) return;

    summaryContainer.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-2 text-muted">Chargement du récapitulatif en cours...</p>
      </div>`;

    try {
      const headers = await authHeaders();
      const projectParam = state.selectedProjectId ? `&project_name=${encodeURIComponent(state.selectedProjectId)}` : '';
      const agentParam = state.selectedAgentId ? `&agent_id=${encodeURIComponent(state.selectedAgentId)}` : '';
      const supervisorParam = state.selectedSupervisorId ? `&supervisor_id=${encodeURIComponent(state.selectedSupervisorId)}` : '';
      const today = new Date();
      const startDate = addDays(today, -42);
      const endDate = addDays(today, 42);
      const from = toISODate(startDate);
      const to = toISODate(endDate);

      const [plansRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/planifications?from=${from}&to=${to}${projectParam}${agentParam}${supervisorParam}`, { headers }),
        fetch(`${API_BASE}/users`, { headers })
      ]);

      if (!plansRes.ok) {
        displayWeeklySummary([]);
        return;
      }

      const plansResult = await plansRes.json();
      const plans = plansResult.items || [];
      let usersMap = new Map();

      if (usersRes.ok) {
        const usersResponse = await usersRes.json();
        const usersData = Array.isArray(usersResponse) ? usersResponse : (usersResponse.items || []);
        usersMap = new Map(usersData.map(user => [user.id, user]));
      }

      const summaryMap = new Map();
      for (const plan of plans) {
        const planDate = new Date(plan.date);
        const weekStart = startOfWeek(planDate);
        const weekEnd = addDays(weekStart, 6);
        const weekKey = `${toISODate(weekStart)}_${plan.user_id}_${plan.project_name || 'général'}`;

        if (!summaryMap.has(weekKey)) {
          const userData = usersMap.get(plan.user_id) || {
            name: 'Utilisateur inconnu',
            email: '',
            role: 'agent'
          };
          summaryMap.set(weekKey, {
            week_start_date: toISODate(weekStart),
            week_end_date: toISODate(weekEnd),
            user_id: plan.user_id,
            users: userData,
            project_name: plan.project_name || 'Projet Général',
            total_planned_hours: 0,
            total_planned_days: new Set(),
            activities: []
          });
        }

        const summary = summaryMap.get(weekKey);
        if (plan.planned_start_time && plan.planned_end_time) {
          const startMinutes = hoursToMinutes(plan.planned_start_time);
          const endMinutes = hoursToMinutes(plan.planned_end_time);
          if (Number.isFinite(startMinutes) && Number.isFinite(endMinutes) && endMinutes > startMinutes) {
            summary.total_planned_hours += (endMinutes - startMinutes) / 60;
          }
        }
        summary.total_planned_days.add(toISODate(planDate));
        const activity = plan.activity || plan.activities || plan.task || plan.description || '';
        if (activity && activity.trim() && !summary.activities.includes(activity.trim())) {
          summary.activities.push(activity.trim());
        }
      }

      const weeklySummaries = Array.from(summaryMap.values()).map(summary => ({
        ...summary,
        total_planned_hours: Math.round(summary.total_planned_hours * 10) / 10,
        total_planned_days: summary.total_planned_days.size,
        activities_summary: summary.activities.join(' | ') || 'Aucune activité'
      }));

      weeklySummaries.sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
      displayWeeklySummary(weeklySummaries);

    } catch (error) {
      console.error('Erreur chargement récap hebdomadaire:', error);
      displayWeeklySummary([]);
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
      const weeksMap = new Map();
      summaries.forEach(summary => {
        if (!summary.week_start_date) return;
        const weekStart = new Date(summary.week_start_date);
        const weekKey = weekStart.toISOString().split('T')[0];
        if (!weeksMap.has(weekKey)) {
          weeksMap.set(weekKey, {
            weekStart: summary.week_start_date,
            weekEnd: summary.week_end_date || toISODate(addDays(new Date(summary.week_start_date), 6)),
            items: []
          });
        }
        weeksMap.get(weekKey).items.push(summary);
      });

      const sortedWeeks = Array.from(weeksMap.values()).sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));
      const mainDiv = document.createElement('div');
      mainDiv.className = 'weekly-summary-container';

      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'week-tabs d-flex overflow-auto mb-3';

      const contentContainer = document.createElement('div');
      contentContainer.className = 'week-contents';

      sortedWeeks.forEach((week, index) => {
        const tab = document.createElement('button');
        tab.className = `week-tab btn btn-outline-primary me-2 ${index === 0 ? 'active' : ''}`;
        tab.textContent = `Semaine du ${formatDate(week.weekStart, 'dd/MM')}`;
        tab.onclick = () => switchWeekTab(week.weekStart);

        const content = document.createElement('div');
        content.className = `week-content ${index === 0 ? 'active' : 'd-none'}`;
        content.id = `week-${week.weekStart}`;
        const table = generateWeekTable(week);
        content.appendChild(table);

        tabsContainer.appendChild(tab);
        contentContainer.appendChild(content);
      });

      mainDiv.appendChild(tabsContainer);
      mainDiv.appendChild(contentContainer);
      container.innerHTML = '';
      container.appendChild(mainDiv);

      const tooltipTriggerList = [].slice.call(container.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
      });

    } catch (error) {
      console.error('Erreur affichage récapitulatif:', error);
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          Une erreur est survenue lors du chargement du récapitulatif.
        </div>
      `;
    }
  };

  /**
   * Génère un tableau pour une semaine.
   * @param {Object} week
   * @returns {HTMLTableElement}
   */
  const generateWeekTable = (week) => {
    const table = document.createElement('table');
    table.className = 'table table-hover align-middle';
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
    const tbody = document.createElement('tbody');

    week.items.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="d-flex align-items-center">
            <div class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width:32px;height:32px;font-size:12px">
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
            <button class="btn btn-sm btn-outline-primary" onclick="editWeekPlanning('${item.week_start_date}', '${item.user_id}', '${item.project_name}')" title="Modifier la planification" data-bs-toggle="tooltip">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-info" onclick="viewWeekDetails('${item.week_start_date}', '${item.user_id}', '${item.project_name}')" title="Voir les détails" data-bs-toggle="tooltip">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteWeekPlanning('${item.week_start_date}', '${item.user_id}', '${item.project_name}')" title="Supprimer la planification" data-bs-toggle="tooltip">
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
  };

  /**
   * Change l'onglet de la semaine active.
   * @param {string} weekStart
   */
  const switchWeekTab = (weekStart) => {
    document.querySelectorAll('.week-tab').forEach(tab => {
      tab.classList.remove('active', 'btn-primary');
      tab.classList.add('btn-outline-primary');
    });
    document.querySelectorAll('.week-content').forEach(content => {
      content.classList.add('d-none');
    });
    const selectedTab = document.querySelector(`.week-tab[onclick*="${weekStart}"]`);
    const selectedContent = $(`week-${weekStart}`);
    if (selectedTab && selectedContent) {
      selectedTab.classList.add('active', 'btn-primary');
      selectedTab.classList.remove('btn-outline-primary');
      selectedContent.classList.remove('d-none');
    }
  };

  /**
   * Édite la planification d'une semaine.
   * @param {string} weekStart
   * @param {string} userId
   * @param {string} projectName
   */
  const editWeekPlanning = async (weekStart, userId, projectName) => {
    try {
      const headers = await authHeaders();
      const weekEnd = addDays(new Date(weekStart), 6);
      const response = await fetch(`${API_BASE}/planifications?from=${weekStart}&to=${toISODate(weekEnd)}&agent_id=${userId}&project_name=${encodeURIComponent(projectName)}`, { headers });
      if (response.ok) {
        const result = await response.json();
        const weekPlans = result.items || [];
        showWeekEditModal(weekStart, toISODate(weekEnd), weekPlans);
      }
    } catch (error) {
      console.error('Erreur chargement semaine:', error);
      alert('Erreur lors du chargement de la semaine');
    }
  };

  /**
   * Affiche la modale d'édition de la semaine.
   * @param {string} weekStart
   * @param {string} weekEnd
   * @param {Array} weekPlans
   */
  const showWeekEditModal = (weekStart, weekEnd, weekPlans) => {
    const existingModal = $('weekEditModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'weekEditModal';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Édition de la semaine du ${new Date(weekStart).toLocaleDateString()} au ${new Date(weekEnd).toLocaleDateString()}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div id="week-edit-content">
              ${generateWeekEditContent(weekStart, weekEnd, weekPlans)}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
            <button type="button" class="btn btn-primary" onclick="saveWeekPlanning('${weekStart}', '${weekEnd}')">Sauvegarder</button>
            <button type="button" class="btn btn-danger" onclick="deleteWeekPlanning('${weekStart}', '${weekEnd}')">Effacer la semaine</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      modal.addEventListener('hidden.bs.modal', () => {
        if (modal.parentNode) document.body.removeChild(modal);
      });
    }
  };

  /**
   * Génère le contenu de la modale d'édition de la semaine.
   * @param {string} weekStart
   * @param {string} weekEnd
   * @param {Array} weekPlans
   * @returns {string}
   */
  const generateWeekEditContent = (weekStart, weekEnd, weekPlans) => {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    const days = [];
    const todayIso = toISODate(new Date());
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));

    return days.map(day => {
      const iso = toISODate(day);
      const plan = weekPlans.find(p => p.date === iso);
      const dayName = day.toLocaleDateString('fr-FR', { weekday: 'long' });
      const isPast = iso < todayIso;

      return `
        <div class="row mb-3 border-bottom pb-3">
          <div class="col-12 d-flex align-items-center gap-2">
            <h6 class="fw-bold mb-0">${dayName} ${day.toLocaleDateString()}</h6>
            ${isPast ? '<span class="badge bg-secondary">Verrouillé (jour passé)</span>' : ''}
          </div>
          <div class="col-md-4">
            <label class="form-label">Heure de début</label>
            <input type="time" class="form-control" id="edit-start-${iso}" value="${plan?.planned_start_time || ''}" ${isPast ? 'disabled' : ''}>
          </div>
          <div class="col-md-4">
            <label class="form-label">Heure de fin</label>
            <input type="time" class="form-control" id="edit-end-${iso}" value="${plan?.planned_end_time || ''}" ${isPast ? 'disabled' : ''}>
          </div>
          <div class="col-md-4">
            <label class="form-label">Projet</label>
            <select class="form-select" id="edit-project-${iso}" ${isPast ? 'disabled' : ''}>
              <option value="">Sélectionner un projet</option>
              ${state.projects.map(p => `<option value="${p}" ${plan?.project_name === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="col-12 mt-2">
            <label class="form-label">Description de l'activité</label>
            <textarea class="form-control" id="edit-desc-${iso}" rows="2" placeholder="Décrivez l'activité prévue..." ${isPast ? 'disabled' : ''}>${plan?.description_activite || ''}</textarea>
          </div>
        </div>
      `;
    }).join('');
  };

  /**
   * Sauvegarde la planification de la semaine.
   * @param {string} weekStart
   * @param {string} weekEnd
   */
  const saveWeekPlanning = async (weekStart, weekEnd) => {
    try {
      const start = new Date(weekStart);
      const end = new Date(weekEnd);
      const days = [];
      const todayIso = toISODate(new Date());
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));

      const headers = await authHeaders();
      const promises = days.map(async (day) => {
        const iso = toISODate(day);
        if (iso < todayIso) return true;
        const startTime = $(`edit-start-${iso}`)?.value || null;
        const endTime = $(`edit-end-${iso}`)?.value || null;
        const project = $(`edit-project-${iso}`)?.value || null;
        const description = $(`edit-desc-${iso}`)?.value || null;
        const response = await fetch(`${API_BASE}/planifications`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            date: iso,
            planned_start_time: startTime,
            planned_end_time: endTime,
            description_activite: description,
            project_name: project
          })
        });
        return response.ok;
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r).length;

      if (successCount === days.length) {
        alert('Planification de la semaine sauvegardée avec succès !');
        const modal = bootstrap.Modal.getInstance($('weekEditModal'));
        if (modal) modal.hide();
        await loadWeek($('week-start').value);
        await loadMonth($('month').value);
        await loadWeeklySummary();
      } else {
        alert('Certaines journées n’ont pas été enregistrées (jours passés verrouillés ou erreurs).');
      }
    } catch (error) {
      console.error('Erreur sauvegarde semaine:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  /**
   * Supprime la planification d'une semaine.
   * @param {string} weekStart
   * @param {string} weekEnd
   */
  const deleteWeekPlanning = async (weekStart, weekEnd) => {
    if (!confirm(`Êtes-vous sûr de vouloir effacer toutes les planifications de la semaine du ${new Date(weekStart).toLocaleDateString()} au ${new Date(weekEnd).toLocaleDateString()} ?`)) return;

    try {
      const headers = await authHeaders();
      const response = await fetch(`${API_BASE}/planifications?from=${weekStart}&to=${weekEnd}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        alert('Planification de la semaine effacée avec succès');
        const modal = $('weekEditModal');
        if (modal) {
          const bsModal = bootstrap.Modal.getInstance(modal);
          if (bsModal) bsModal.hide();
          else modal.remove();
        }
        await loadWeeklySummary();
      } else {
        throw new Error('Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Erreur suppression planification:', error);
      alert('Erreur lors de la suppression de la planification');
    }
  };

  /**
   * Affiche les détails d'une semaine.
   * @param {string} weekStart
   * @param {string} userId
   * @param {string} projectName
   */
  const viewWeekDetails = async (weekStart, userId, projectName) => {
    try {
      const headers = await authHeaders();
      const weekEnd = addDays(new Date(weekStart), 6);
      const response = await fetch(`${API_BASE}/planifications?from=${weekStart}&to=${toISODate(weekEnd)}&agent_id=${userId}&project_name=${encodeURIComponent(projectName)}`, { headers });

      if (!response.ok) throw new Error('Erreur lors du chargement des détails');
      const result = await response.json();
      const plans = result.items || [];

      const modal = document.createElement('div');
      modal.className = 'modal fade';
      modal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-calendar-week"></i> Détails de la planification
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row mb-3">
                <div class="col-md-6">
                  <strong>Semaine:</strong> ${new Date(weekStart).toLocaleDateString()} - ${weekEnd.toLocaleDateString()}
                </div>
                <div class="col-md-6">
                  <strong>Projet:</strong> ${projectName}
                </div>
              </div>
              <div class="table-responsive">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Activité</th>
                      <th>Heure début</th>
                      <th>Heure fin</th>
                      <th>Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${plans.map(plan => `
                      <tr>
                        <td>${new Date(plan.date).toLocaleDateString()}</td>
                        <td>${plan.activity || plan.description_activite || 'N/A'}</td>
                        <td>${plan.planned_start_time || 'N/A'}</td>
                        <td>${plan.planned_end_time || 'N/A'}</td>
                        <td>
                          ${plan.planned_start_time && plan.planned_end_time ?
                            calculateDuration(plan.planned_start_time, plan.planned_end_time) : 'N/A'
                          }
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
              <button type="button" class="btn btn-primary" onclick="editWeekPlanning('${weekStart}', '${userId}', '${projectName}')">
                <i class="bi bi-pencil"></i> Modifier
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
      });

    } catch (error) {
      console.error('Erreur chargement détails:', error);
      alert('Erreur lors du chargement des détails');
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
        const duration = (end - start) / 60;
        const hours = Math.floor(duration);
        const minutes = Math.round((duration - hours) * 60);
        return `${hours}h${minutes.toString().padStart(2, '0')}`;
      }
      return 'N/A';
    } catch (e) {
      console.error('Erreur dans calculateDuration:', e);
      return 'N/A';
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
        const user = data.user;
        displayUserName(user);
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
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      const name = user.name || '';
      let displayName = '';
      if (firstName && lastName) displayName = `${firstName} ${lastName}`;
      else if (name) displayName = name;
      else displayName = user.email;
      displayElement.textContent = displayName;
    }
  };

  // ----------------------------
  // 7. INITIALISATION
  // ----------------------------

  /**
   * Initialise l'application au chargement de la page.
   */
  const init = () => {
    loadUserInfo();
    loadDepartments();
    loadAgents();
    loadProjects();
    loadSupervisors();

    const projectSelect = $('project-filter-select');
    const agentSelect = $('agent-select');
    const supervisorSelect = $('supervisor-select');
    const departmentSelect = $('department-filter-select');
    const communeSelect = $('commune-filter-select');
    const weekInput = $('week-start');
    const applyBtn = $('apply-filters-btn');
    const resetBtn = $('reset-filters-btn');

    if (supervisorSelect) {
      supervisorSelect.addEventListener('change', (e) => {
        state.selectedSupervisorId = e.target.value;
        filterAgentsBySupervisor();
      });
    }

    if (departmentSelect) {
      departmentSelect.addEventListener('change', async (e) => {
        state.selectedDepartmentId = e.target.value;
        state.selectedCommuneId = '';
        await loadCommunes(state.selectedDepartmentId);
      });
    }

    if (communeSelect) {
      communeSelect.addEventListener('change', (e) => {
        state.selectedCommuneId = e.target.value;
      });
    }

    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        state.selectedProjectId = e.target.value;
      });
    }

    if (agentSelect) {
      agentSelect.addEventListener('change', (e) => {
        state.selectedAgentId = e.target.value;
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        state.selectedProjectId = projectSelect?.value || '';
        state.selectedAgentId = agentSelect?.value || '';
        state.selectedSupervisorId = supervisorSelect?.value || '';
        state.selectedDepartmentId = departmentSelect?.value || '';
        state.selectedCommuneId = communeSelect?.value || '';
        loadWeek(weekInput?.value);
        scheduleMonthRefresh(0);
        loadWeeklySummary();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (agentSelect) agentSelect.value = '';
        state.selectedAgentId = '';
        if (supervisorSelect) supervisorSelect.value = '';
        state.selectedSupervisorId = '';
        if (projectSelect) projectSelect.value = '';
        state.selectedProjectId = '';
        if (departmentSelect) departmentSelect.value = '';
        state.selectedDepartmentId = '';
        if (communeSelect) {
          communeSelect.value = '';
          communeSelect.disabled = true;
          communeSelect.innerHTML = '<option value="">Sélectionnez d\'abord un département</option>';
        }
        state.selectedCommuneId = '';
        const now = new Date();
        const ws = startOfWeek(now);
        if (weekInput) weekInput.value = toISODate(ws);
        const monthEl = $('month');
        if (monthEl) monthEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        loadWeek(weekInput?.value);
        loadMonth(monthEl?.value);
        loadWeeklySummary();
      });
    }

    $('load-week')?.addEventListener('click', () => loadWeek($('week-start').value));
    $('load-month')?.addEventListener('click', () => loadMonth($('month').value));
    $('refresh-weekly-summary')?.addEventListener('click', () => loadWeeklySummary());
    $('prev-week')?.addEventListener('click', () => {
      const d = new Date($('week-start').value || new Date());
      d.setDate(d.getDate() - 7);
      loadWeek(toISODate(d));
    });
    $('next-week')?.addEventListener('click', () => {
      const d = new Date($('week-start').value || new Date());
      d.setDate(d.getDate() + 7);
      loadWeek(toISODate(d));
    });

    const boot = () => {
      loadAgents();
      loadProjects();
      loadSupervisors();
      loadWeek();
      loadMonth();
    };

    const token = findToken();
    if (token) boot();
    else {
      let tries = 0;
      const interval = setInterval(() => {
        tries++;
        if (findToken()) {
          clearInterval(interval);
          boot();
        }
        if (tries > 40) {
          clearInterval(interval);
          boot();
        }
      }, 250);
      window.addEventListener('storage', (e) => {
        if (e.key === 'jwt' && e.newValue) {
          boot();
        }
      });
    }
  };

  // ----------------------------
  // 8. DÉMARRAGE
  // ----------------------------
  document.addEventListener('DOMContentLoaded', init);

  // Exposition des fonctions globales
  window.loadWeek = loadWeek;
  window.loadMonth = loadMonth;
  window.loadWeeklySummary = loadWeeklySummary;
  window.editWeekPlanning = editWeekPlanning;
  window.saveWeekPlanning = saveWeekPlanning;
  window.deleteWeekPlanning = deleteWeekPlanning;
  window.viewWeekDetails = viewWeekDetails;
  window.switchWeekTab = switchWeekTab;
  window.displayWeeklySummary = displayWeeklySummary;
})();
