(function() {
  const apiBase = '/api';
  let refreshMonthTimer = null;
  function scheduleMonthRefresh(delay = 400) {
    try { clearTimeout(refreshMonthTimer); } catch {}
    refreshMonthTimer = setTimeout(() => {
      try { loadMonth(document.getElementById('month').value); } catch {}
    }, delay);
  }

  // Helpers pour bannière d'auth
  function showPlanningAuthBanner(message) {
    try {
      const container = document.querySelector('.container') || document.body;
      let banner = document.getElementById('planning-auth-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'planning-auth-banner';
        banner.style.cssText = 'margin:12px 0;padding:12px 16px;border-radius:8px;background:#fff3cd;color:#664d03;border:1px solid #ffe69c;';
        container.prepend(banner);
      }
      banner.textContent = message || '🔒 Session requise. Veuillez vous connecter.';
    } catch {}
  }
  function hidePlanningAuthBanner() {
    try { const b = document.getElementById('planning-auth-banner'); if (b) b.remove(); } catch {}
  }

  let projects = [];
  let selectedProjectId = '';
  let agents = [];
  let selectedAgentId = '';

  // Charger les agents
  async function loadAgents() {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/admin/agents`, { headers });
      if (res.ok) {
        const result = await res.json();
        // Corriger l'extraction des données - utiliser result.agents au lieu de result.data
        const users = result.agents || result.data || result || [];
        
        // Vérifier que users est un array
        if (!Array.isArray(users)) {
          console.error('Erreur: users n\'est pas un array:', users);
          return;
        }
        
        // Filtrer seulement les agents (role = 'agent')
        agents = users.filter(user => user.role === 'agent');
        updateAgentSelect();
        
        console.log('Agents chargés dans planning:', agents.length);
      }
    } catch (error) {
      console.error('Erreur chargement agents:', error);
    }
  }

  function updateAgentSelect() {
    const select = document.getElementById('agent-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Tous les agents</option>';
    agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.id;
      const name = agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email;
      option.textContent = `${name} (${agent.email})`;
      select.appendChild(option);
    });
  }

  // Charger les projets
  async function loadProjects() {
    try {
      const headers = await authHeaders();
      // Utiliser l'API /admin/agents pour récupérer les projets depuis la table users
      const res = await fetch(`${apiBase}/admin/agents`, { headers });
      if (res.ok) {
        const result = await res.json();
        // Corriger l'extraction des données - utiliser result.agents au lieu de result.data
        const users = result.agents || result.data || result || [];
        
        // Vérifier que users est un array
        if (!Array.isArray(users)) {
          console.error('Erreur: users n\'est pas un array:', users);
          return;
        }
        
        // Extraire les projets uniques des agents
        const projectsSet = new Set();
        users.forEach(user => {
          if (user.project_name && user.project_name.trim()) {
            projectsSet.add(user.project_name.trim());
          }
        });
        
        projects = Array.from(projectsSet).sort();
        updateProjectSelect();
        
        console.log('Projets chargés dans planning:', projects);
      }
    } catch (error) {
      console.error('Erreur chargement projets:', error);
    }
  }

  function updateProjectSelect() {
    const select = document.getElementById('project-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Tous les projets</option>';
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project; // Utiliser le nom du projet comme valeur
      option.textContent = project;
      select.appendChild(option);
    });
  }

  // Écouter les changements de projet et agent
  document.addEventListener('DOMContentLoaded', () => {
    const projectSelect = document.getElementById('project-select');
    const agentSelect = document.getElementById('agent-select');
    
    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        selectedProjectId = e.target.value;
        console.log('Filtre projet changé:', selectedProjectId);
        loadWeek(document.getElementById('week-start').value);
      });
    }
    
    if (agentSelect) {
      agentSelect.addEventListener('change', (e) => {
        selectedAgentId = e.target.value;
        console.log('Filtre agent changé:', selectedAgentId);
        loadWeek(document.getElementById('week-start').value);
      });
    }
  });

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

  // Date ISO locale (YYYY-MM-DD) sans décalage UTC
  function toISODate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
  function startOfWeek(date) { const d = new Date(date); const day = d.getDay(); const diff = (day === 0 ? -6 : 1) - day; return addDays(d, diff); }
  function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

  function hoursToX(hourStr) {
    if (!hourStr) return 0;
    const parts = String(hourStr).split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return h * 60 + m;
  }

  function xToHourStr(x) {
    const h = Math.floor(x / 60);
    const m = Math.round(x % 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // Fonction pour récupérer les activités d'une semaine
  function getWeekActivities(weekStart, weekEnd, plans) {
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
  }

  // Fonction pour éditer la planification d'une semaine
  async function editWeekPlanning(weekStart, weekEnd) {
    try {
      const headers = await authHeaders();
      const projectParam = selectedProjectId ? `&project_name=${selectedProjectId}` : '';
      const agentParam = selectedAgentId ? `&agent_id=${selectedAgentId}` : '';
      
      const res = await fetch(`${apiBase}/planifications?from=${weekStart}&to=${weekEnd}${projectParam}${agentParam}`, { headers });
      if (res.ok) {
        const result = await res.json();
        const weekPlans = result.items || [];
        
        // Ouvrir une modal pour éditer la semaine
        showWeekEditModal(weekStart, weekEnd, weekPlans);
      }
    } catch (error) {
      console.error('Erreur chargement semaine:', error);
      alert('Erreur lors du chargement de la semaine');
    }
  }

  // Fonction pour afficher la modal d'édition de semaine
  function showWeekEditModal(weekStart, weekEnd, weekPlans) {
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
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Nettoyer la modal quand elle est fermée
    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modal);
    });
  }

  // Fonction pour générer le contenu d'édition de semaine
  function generateWeekEditContent(weekStart, weekEnd, weekPlans) {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    const days = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    
    return days.map(day => {
      const iso = toISODate(day);
      const plan = weekPlans.find(p => p.date === iso);
      const dayName = day.toLocaleDateString('fr-FR', { weekday: 'long' });
      
      return `
        <div class="row mb-3 border-bottom pb-3">
          <div class="col-12">
            <h6 class="fw-bold">${dayName} ${day.toLocaleDateString()}</h6>
          </div>
          <div class="col-md-4">
            <label class="form-label">Heure de début</label>
            <input type="time" class="form-control" id="edit-start-${iso}" value="${plan?.planned_start_time || ''}">
          </div>
          <div class="col-md-4">
            <label class="form-label">Heure de fin</label>
            <input type="time" class="form-control" id="edit-end-${iso}" value="${plan?.planned_end_time || ''}">
          </div>
          <div class="col-md-4">
            <label class="form-label">Projet</label>
            <select class="form-select" id="edit-project-${iso}">
              <option value="">Sélectionner un projet</option>
              ${projects.map(p => `<option value="${p}" ${plan?.project_name === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="col-12 mt-2">
            <label class="form-label">Description de l'activité</label>
            <textarea class="form-control" id="edit-desc-${iso}" rows="2" placeholder="Décrivez l'activité prévue...">${plan?.description_activite || ''}</textarea>
          </div>
        </div>
      `;
    }).join('');
  }

  // Fonction pour sauvegarder la planification de la semaine
  async function saveWeekPlanning(weekStart, weekEnd) {
    try {
      const start = new Date(weekStart);
      const end = new Date(weekEnd);
      const days = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }
      
      const headers = await authHeaders();
      const promises = days.map(async (day) => {
        const iso = toISODate(day);
        const startTime = document.getElementById(`edit-start-${iso}`)?.value || null;
        const endTime = document.getElementById(`edit-end-${iso}`)?.value || null;
        const project = document.getElementById(`edit-project-${iso}`)?.value || null;
        const description = document.getElementById(`edit-desc-${iso}`)?.value || null;
        
        const res = await fetch(`${apiBase}/planifications`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            date: iso,
            planned_start_time: startTime,
            planned_end_time: endTime,
            description_activite: description,
            project_name: project // Le nom du projet sélectionné
          })
        });
        
        return res.ok;
      });
      
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r).length;
      
      if (successCount === days.length) {
        alert('Planification de la semaine sauvegardée avec succès !');
        // Fermer la modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('weekEditModal'));
        if (modal) modal.hide();
        
        // Recharger les données
        await loadWeek(document.getElementById('week-start').value);
        await loadMonth(document.getElementById('month').value);
      } else {
        alert('Erreur lors de la sauvegarde de certaines planifications');
      }
    } catch (error) {
      console.error('Erreur sauvegarde semaine:', error);
      alert('Erreur lors de la sauvegarde');
    }
  }

  async function loadWeek(dateStr) {
    const start = startOfWeek(dateStr ? new Date(dateStr) : new Date());
    $('week-start').value = toISODate(start);
    const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    const from = toISODate(days[0]);
    const to = toISODate(days[6]);
    const headers = await authHeaders();

    const projectParam = selectedProjectId ? `&project_name=${selectedProjectId}` : '';
    const agentParam = selectedAgentId ? `&agent_id=${selectedAgentId}` : '';
    const [plansRes, checkinsRes, validationsRes] = await Promise.all([
      fetch(`${apiBase}/planifications?from=${from}&to=${to}${projectParam}${agentParam}`, { headers }),
      fetch(`${apiBase}/checkins/mine?from=${from}&to=${to}`, { headers }),
      fetch(`${apiBase}/validations/mine?from=${from}&to=${to}`, { headers })
    ]);
    if (plansRes.status === 401 || checkinsRes.status === 401 || validationsRes.status === 401) {
      showPlanningAuthBanner('🔒 Session requise pour charger la planification. Connectez-vous depuis la page d\'accueil, puis revenez ici.');
      // Auto-retry quand le token devient disponible
      const tryRetry = () => { if (findToken()) { hidePlanningAuthBanner(); loadWeek($('week-start').value); } };
      if (findToken()) {
        setTimeout(tryRetry, 1500);
      } else {
        const onStorage = (e) => { if (e.key === 'jwt' && e.newValue) { window.removeEventListener('storage', onStorage); tryRetry(); } };
        window.addEventListener('storage', onStorage);
      }
      return;
    }
    const plans = (await plansRes.json()).items || [];
    const checkins = (await checkinsRes.json()).items || [];
    const validations = (await validationsRes.json()).items || [];

    hidePlanningAuthBanner();
    const plansByDate = new Map(plans.map(p => [String(p.date).slice(0,10), p]));
    const checkinDates = new Set(checkins.map(c => (c.timestamp || '').slice(0,10)));
    const validatedDates = new Set(validations.filter(v => v.valid).map(v => toISODate(new Date(v.created_at))));

    // Render Gantt grid
    const gantt = $('week-gantt');
    const hours = Array.from({ length: 24 }).map((_, h) => h);
    const dayNames = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    const header = document.createElement('div');
    header.className = 'gantt-header d-flex border-bottom';
    header.innerHTML = `
      <div class="gantt-col gantt-day-col fw-bold text-center" style="width:120px">Jour</div>
      <div class="flex-grow-1 d-flex">
        ${hours.map(h => `<div class="gantt-col text-center small" style="width:60px">${String(h).padStart(2,'0')}h</div>`).join('')}
      </div>`;
    gantt.innerHTML = '';
    gantt.appendChild(header);

    let weeklyMinutes = 0;

    const todayIso = toISODate(new Date());
    days.forEach((d, idx) => {
      const iso = toISODate(d);
      const plan = plansByDate.get(iso);
      const startMin = hoursToX(plan?.planned_start_time || '');
      const endMin = hoursToX(plan?.planned_end_time || '');
      // Considérer un jour planifié même si une seule des deux heures est présente
      const planned = Boolean(plan && (plan.planned_start_time || plan.planned_end_time));
      const duration = (Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin) ? (endMin - startMin) : 0;
      weeklyMinutes += duration;
      const hasPresence = checkinDates.has(iso);
      const isValidated = validatedDates.has(iso);
      const isPast = iso < todayIso; // garder l'info mais permettre l'édition

      const row = document.createElement('div');
      row.className = 'gantt-row d-flex align-items-center border-bottom py-2';
      row.innerHTML = `
        <div class="gantt-col d-flex align-items-center gap-2" style="width:120px">
          <span class="fw-semibold">${dayNames[idx]} ${d.toLocaleDateString()}</span>
          ${planned ? '<span class="badge bg-primary">Planifié</span>' : '<span class="badge bg-secondary">Libre</span>'}
          ${hasPresence ? `<span class="badge ${isValidated ? 'bg-success' : 'bg-warning'}">${isValidated ? 'Présence validée' : 'Présence à valider'}</span>` : ''}
          ${plan?.projects?.name ? `<span class="badge bg-info">${plan.projects.name}</span>` : ''}
        </div>
        <div class="flex-grow-1 position-relative" style="height:34px">
          <div class="position-absolute bg-light w-100 h-100" style="opacity:.6"></div>
          ${planned && duration > 0 ? `<div class="position-absolute bg-primary" style="left:${startMin}px;width:${duration}px;height:26px;border-radius:6px;opacity:.85"></div>` : ''}
          <div class="position-absolute d-flex gap-2" style="left:4px;top:4px">
            <input type="time" class="form-control form-control-sm" id="gs-${iso}" value="${plan?.planned_start_time || ''}" style="width:110px">
            <input type="time" class="form-control form-control-sm" id="ge-${iso}" value="${plan?.planned_end_time || ''}" style="width:110px">
            <button class="btn btn-sm btn-success" data-date="${iso}">OK</button>
          </div>
          <div class="position-absolute d-flex gap-2" style="left:4px;top:40px">
            <input type="text" class="form-control form-control-sm" id="desc-${iso}" placeholder="Description de l'activité (2 lignes max)" value="${plan?.description_activite || ''}" style="width:300px">
          </div>
        </div>`;
      
      // Ajouter la description d'activité si elle existe
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
      
      gantt.appendChild(row);
      // écoute des inputs pour mise à jour du récap mensuel en direct
      try {
        const s = document.getElementById(`gs-${iso}`);
        const e = document.getElementById(`ge-${iso}`);
        if (s && !s.disabled) s.addEventListener('input', () => scheduleMonthRefresh());
        if (e && !e.disabled) e.addEventListener('input', () => scheduleMonthRefresh());
      } catch {}
    });

    $('week-summary').textContent = `Total planifié: ${Math.round(weeklyMinutes/60)}h${String(weeklyMinutes%60).padStart(2,'0')}`;

    gantt.querySelectorAll('button[data-date]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const date = btn.getAttribute('data-date');
        const planned_start_time = document.getElementById(`gs-${date}`).value || null;
        const planned_end_time = document.getElementById(`ge-${date}`).value || null;
        const description_activite = document.getElementById(`desc-${date}`)?.value || null;
        const project_id = selectedProjectId || null;
        
        const headers2 = await authHeaders();
        const res = await fetch(`${apiBase}/planifications`, {
          method: 'POST',
          headers: headers2,
          body: JSON.stringify({ 
            date, 
            planned_start_time, 
            planned_end_time, 
            description_activite,
            project_name: selectedProjectId // Utiliser le nom du projet sélectionné
          })
        });
        if (res.status === 401) {
          showPlanningAuthBanner('🔒 Session requise pour enregistrer la planification. Connectez-vous puis réessayez.');
          const tryRetry = () => { if (findToken()) { hidePlanningAuthBanner(); loadWeek($('week-start').value); } };
          if (findToken()) {
            setTimeout(tryRetry, 1500);
          } else {
            const onStorage = (e) => { if (e.key === 'jwt' && e.newValue) { window.removeEventListener('storage', onStorage); tryRetry(); } };
            window.addEventListener('storage', onStorage);
          }
          return;
        }
        if (res.ok) {
          await loadWeek($('week-start').value);
          try { await loadMonth($('month').value); } catch {}
        } else {
          alert('Erreur enregistrement');
        }
      });
    });
  }

  async function loadMonth(monthStr) {
    const base = monthStr ? new Date(monthStr + '-01') : new Date();
    $('month').value = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}`;
    const year = base.getFullYear();
    const month = base.getMonth();
    const days = daysInMonth(year, month);
    const from = `${year}-${String(month+1).padStart(2,'0')}-01`;
    const to = `${year}-${String(month+1).padStart(2,'0')}-${String(days).padStart(2,'0')}`;
    const headers = await authHeaders();
    const gantt = $('month-gantt');
    if (gantt) { gantt.innerHTML = '<div class="text-muted">Chargement du récap mensuel…</div>'; }

    const projectParam = selectedProjectId ? `&project_name=${selectedProjectId}` : '';
    const agentParam = selectedAgentId ? `&agent_id=${selectedAgentId}` : '';
    const [plansRes, checkinsRes] = await Promise.all([
      fetch(`${apiBase}/planifications?from=${from}&to=${to}${projectParam}${agentParam}`, { headers }),
      fetch(`${apiBase}/checkins/mine?from=${from}&to=${to}`, { headers })
    ]);
    if (plansRes.status === 401 || checkinsRes.status === 401) {
      if (gantt) { gantt.innerHTML = '<div class="text-muted">Connexion requise pour afficher le récap mensuel.</div>'; }
      showPlanningAuthBanner('🔒 Session requise pour charger la planification mensuelle. Connectez-vous puis revenez.');
      const tryRetry = () => { if (findToken()) { hidePlanningAuthBanner(); loadMonth($('month').value); } };
      if (findToken()) {
        setTimeout(tryRetry, 1500);
      } else {
        const onStorage = (e) => { if (e.key === 'jwt' && e.newValue) { window.removeEventListener('storage', onStorage); tryRetry(); } };
        window.addEventListener('storage', onStorage);
      }
      return;
    }
    const plans = (await plansRes.json()).items || [];
    const checkins = (await checkinsRes.json()).items || [];

    hidePlanningAuthBanner();
    const plansNorm = (plans || [])
      .map(p => ({
        date: String(p.date).slice(0,10),
        s: hoursToX(p.planned_start_time),
        e: hoursToX(p.planned_end_time)
      }))
      .filter(p => (Number.isFinite(p.s) || Number.isFinite(p.e)) && ((p.e || 0) >= (p.s || 0)));

    const firstDay = `${year}-${String(month+1).padStart(2,'0')}-01`;
    const lastDay = `${year}-${String(month+1).padStart(2,'0')}-${String(days).padStart(2,'0')}`;
    const firstDate = new Date(firstDay + 'T00:00:00');
    const lastDate = new Date(lastDay + 'T23:59:59');
    // Étendre la fenêtre d'agrégation à la semaine complète couvrant le mois
    const expandedStart = startOfWeek(firstDate);
    const expandedEnd = addDays(startOfWeek(lastDate), 6);

    const weekAgg = new Map();
    for (const p of plansNorm) {
      const d = new Date(p.date + 'T00:00:00');
      // inclure aussi les jours planifiés des semaines chevauchant le mois
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

    // Construire semaines du mois dans l'ordre et y injecter les agrégats calculés
    const weeks = [];
    let cursor = new Date(firstDay + 'T00:00:00');
    while (cursor.getMonth() === month) {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      const wsIso = toISODate(ws);
      const agg = weekAgg.get(wsIso) || { from: toISODate(ws), to: toISODate(we), minutes: 0, daysSet: new Set() };
      const minutes = agg.minutes;
      const daysPlanned = agg.daysSet.size;
      weeks.push({ from: agg.from, to: agg.to, daysPlanned, hours: Math.round(minutes/60), minutes: minutes%60 });
      cursor = addDays(we, 1);
    }

    // Construire le tableau synthèse avec les activités planifiées
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
        ${weeks.map((w,i)=>`<tr>
          <td>Semaine ${i+1}</td>
          <td>du ${new Date(w.from).toLocaleDateString()} au ${new Date(w.to).toLocaleDateString()}</td>
          <td>${w.daysPlanned}</td>
          <td>${w.hours}h${String(w.minutes).padStart(2,'0')}</td>
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
        </tr>`).join('')}
      </tbody>`;
    if (gantt) { gantt.innerHTML = ''; gantt.appendChild(table); }

    const totalMinutes = (weeks||[]).reduce((acc, w)=> acc + (w.hours*60 + w.minutes), 0);
    const totalDaysPlanned = (weeks||[]).reduce((acc, w)=> acc + w.daysPlanned, 0);
    $('month-summary').textContent = `Total planifié: ${Math.round(totalMinutes/60)}h${String(totalMinutes%60).padStart(2,'0')} • Jours planifiés: ${totalDaysPlanned}`;
    
    // Charger le récap hebdomadaire
    await loadWeeklySummary();
  }

  // Fonction pour charger le récap hebdomadaire
  async function loadWeeklySummary() {
    try {
      const headers = await authHeaders();
      const projectParam = selectedProjectId ? `&project_name=${selectedProjectId}` : '';
      const agentParam = selectedAgentId ? `&agent_id=${selectedAgentId}` : '';
      
      // Obtenir les dates de la semaine actuelle
      const today = new Date();
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
      
      const from = startOfWeek.toISOString().split('T')[0];
      const to = endOfWeek.toISOString().split('T')[0];
      
      const res = await fetch(`${apiBase}/planifications/weekly-summary?from=${from}&to=${to}${projectParam}${agentParam}`, { headers });
      if (res.ok) {
        const result = await res.json();
        const weeklySummaries = result.items || [];
        displayWeeklySummary(weeklySummaries);
      } else {
        displayWeeklySummary([]);
      }
    } catch (error) {
      console.error('Erreur chargement récap hebdomadaire:', error);
      displayWeeklySummary([]);
    }
  }

  // Fonction pour afficher le récap hebdomadaire
  function displayWeeklySummary(summaries) {
    const container = document.getElementById('weekly-summary');
    if (!container) return;
    
    if (summaries.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted">
          <i class="bi bi-calendar-week fs-1"></i>
          <p>Aucune activité planifiée pour cette période</p>
        </div>
      `;
      return;
    }
    
    const table = document.createElement('table');
    table.className = 'table table-hover';
    table.innerHTML = `
      <thead class="table-light">
        <tr>
          <th>Semaine</th>
          <th>Agent</th>
          <th>Projet</th>
          <th>Heures planifiées</th>
          <th>Jours planifiés</th>
          <th>Activités</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${summaries.map(summary => `
          <tr>
            <td>
              <strong>Semaine du ${new Date(summary.week_start_date).toLocaleDateString()}</strong><br>
              <small class="text-muted">au ${new Date(summary.week_end_date).toLocaleDateString()}</small>
            </td>
            <td>
              <div class="d-flex align-items-center">
                <div class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width:32px;height:32px;font-size:12px">
                  ${(summary.users?.name || 'A').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div class="fw-semibold">${summary.users?.name || 'Agent'}</div>
                  <small class="text-muted">${summary.users?.email || ''}</small>
                </div>
              </div>
            </td>
            <td>
              <span class="badge bg-info">${summary.project_name || 'Projet Général'}</span>
            </td>
            <td>
              <span class="fw-semibold">${summary.total_planned_hours || 0}h</span>
            </td>
            <td>
              <span class="badge bg-secondary">${summary.total_planned_days || 0} jours</span>
            </td>
            <td>
              <div class="activities-preview" style="max-width: 200px; max-height: 80px; overflow-y: auto;">
                ${summary.activities_summary ? 
                  summary.activities_summary.split(' | ').map(activity => 
                    `<div class="small mb-1 text-truncate" title="${activity}">${activity}</div>`
                  ).join('') : 
                  '<em class="text-muted small">Aucune activité</em>'
                }
              </div>
            </td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="editWeekPlanning('${summary.week_start_date}', '${summary.week_end_date}')">
                <i class="bi bi-pencil"></i>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('load-week').addEventListener('click', () => loadWeek($('week-start').value));
    $('load-month').addEventListener('click', () => loadMonth($('month').value));
    $('refresh-weekly-summary').addEventListener('click', () => loadWeeklySummary());
    $('prev-week').addEventListener('click', () => {
      const d = new Date($('week-start').value || new Date());
      d.setDate(d.getDate() - 7);
      loadWeek(toISODate(d));
    });
    $('next-week').addEventListener('click', () => {
      const d = new Date($('week-start').value || new Date());
      d.setDate(d.getDate() + 7);
      loadWeek(toISODate(d));
    });
    // Wait for auth token if needed to avoid 401 on first load
    const boot = () => { loadAgents(); loadProjects(); loadWeek(); loadMonth(); };
    const tokenNow = findToken();
    if (tokenNow) {
      boot();
    } else {
      // Try for a short time; app.js will set jwt after login
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        if (findToken()) { clearInterval(iv); boot(); }
        if (tries > 40) { clearInterval(iv); boot(); } // fallback after ~10s
      }, 250);
      window.addEventListener('storage', (e) => {
        if (e.key === 'jwt' && e.newValue) { boot(); }
      });
    }
  });
})();

// Exposer les fonctions nécessaires globalement pour l'interface
window.editWeekPlanning = editWeekPlanning;
window.saveWeekPlanning = saveWeekPlanning;
window.loadWeek = loadWeek;
window.loadMonth = loadMonth;


