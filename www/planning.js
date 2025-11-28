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

  function $(id) { return document.getElementById(id); }

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

  async function loadWeek(dateStr) {
    const start = startOfWeek(dateStr ? new Date(dateStr) : new Date());
    $('week-start').value = toISODate(start);
    const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    const from = toISODate(days[0]);
    const to = toISODate(days[6]);
    const headers = await authHeaders();

    const [plansRes, checkinsRes, validationsRes] = await Promise.all([
      fetch(`${apiBase}/planifications?from=${from}&to=${to}`, { headers }),
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
      const isPast = iso < todayIso; // désactiver édition pour les dates passées

      const row = document.createElement('div');
      row.className = 'gantt-row d-flex align-items-center border-bottom py-2';
      row.innerHTML = `
        <div class="gantt-col d-flex align-items-center gap-2" style="width:120px">
          <span class="fw-semibold">${dayNames[idx]} ${d.toLocaleDateString()}</span>
          ${planned ? '<span class="badge bg-primary">Planifié</span>' : '<span class="badge bg-secondary">Libre</span>'}
          ${hasPresence ? `<span class="badge ${isValidated ? 'bg-success' : 'bg-warning'}">${isValidated ? 'Présence validée' : 'Présence à valider'}</span>` : ''}
        </div>
        <div class="flex-grow-1 position-relative" style="height:34px">
          <div class="position-absolute bg-light w-100 h-100" style="opacity:.6"></div>
          ${planned && duration > 0 ? `<div class="position-absolute bg-primary" style="left:${startMin}px;width:${duration}px;height:26px;border-radius:6px;opacity:.85"></div>` : ''}
          <div class="position-absolute d-flex gap-2" style="left:4px;top:4px">
            <input type="time" class="form-control form-control-sm" id="gs-${iso}" value="${plan?.planned_start_time || ''}" style="width:110px" ${isPast ? 'disabled' : ''}>
            <input type="time" class="form-control form-control-sm" id="ge-${iso}" value="${plan?.planned_end_time || ''}" style="width:110px" ${isPast ? 'disabled' : ''}>
            ${isPast ? '' : `<button class="btn btn-sm btn-success" data-date="${iso}">OK</button>`}
          </div>
        </div>`;
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
        const headers2 = await authHeaders();
        const res = await fetch(`${apiBase}/planifications`, {
          method: 'POST',
          headers: headers2,
          body: JSON.stringify({ date, planned_start_time, planned_end_time })
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

    const [plansRes, checkinsRes] = await Promise.all([
      fetch(`${apiBase}/planifications?from=${from}&to=${to}`, { headers }),
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

    // Construire le tableau synthèse
    const table = document.createElement('table');
    table.className = 'table table-striped';
    table.innerHTML = `
      <thead><tr>
        <th>Semaine</th>
        <th>Période</th>
        <th>Jours planifiés</th>
        <th>Heures planifiées</th>
      </tr></thead>
      <tbody>
        ${weeks.map((w,i)=>`<tr>
          <td>Semaine ${i+1}</td>
          <td>du ${new Date(w.from).toLocaleDateString()} au ${new Date(w.to).toLocaleDateString()}</td>
          <td>${w.daysPlanned}</td>
          <td>${w.hours}h${String(w.minutes).padStart(2,'0')}</td>
        </tr>`).join('')}
      </tbody>`;
    if (gantt) { gantt.innerHTML = ''; gantt.appendChild(table); }

    const totalMinutes = (weeks||[]).reduce((acc, w)=> acc + (w.hours*60 + w.minutes), 0);
    const totalDaysPlanned = (weeks||[]).reduce((acc, w)=> acc + w.daysPlanned, 0);
    $('month-summary').textContent = `Total planifié: ${Math.round(totalMinutes/60)}h${String(totalMinutes%60).padStart(2,'0')} • Jours planifiés: ${totalDaysPlanned}`;
  }

  // Fonctions pour la gestion des jours permissionnaires
  let agentsList = [];

  async function loadAgents() {
    const select = document.getElementById('permission-agent');
    
    try {
      // Afficher un indicateur de chargement
      select.innerHTML = '<option value="">Chargement des agents...</option>';
      
      const headers = await authHeaders();
      const response = await fetch('/api/agents', { 
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        // En cas d'erreur, on charge quand même la section avec les agents vides
        console.warn('Impossible de charger la liste des agents, la section sera limitée');
        return [];
      }
      
      agentsList = await response.json();
      
      if (!Array.isArray(agentsList)) {
        throw new Error('Format de réponse inattendu de l\'API');
      }
      
      // Mettre à jour la liste déroulante
      select.innerHTML = '<option value="">Sélectionnez un agent</option>';
      
      agentsList.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email || `Agent ${agent.id}`;
        select.appendChild(option);
      });
      
      return true;
      
    } catch (error) {
      console.error('Erreur chargement agents:', error);
      select.innerHTML = `<option value="" disabled>Erreur: ${error.message || 'Impossible de charger les agents'}</option>`;
      showError(`Erreur lors du chargement des agents: ${error.message || 'Veuillez réessayer plus tard'}`);
      return false;
    }
  }

  async function loadPermissions() {
    console.log('Début du chargement des permissions...');
    const tbody = document.getElementById('permissions-list');
    
    if (!tbody) {
      console.error('Élément permissions-list non trouvé dans le DOM');
      return;
    }
    
    try {
      console.log('Affichage du spinner de chargement...');
      // Afficher un indicateur de chargement
      tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Chargement des permissions...</td></tr>';
      
      const headers = await authHeaders();
      console.log('En-têtes d\'authentification:', headers);
      
      // Charger la liste des agents si nécessaire
      if (!agentsList || agentsList.length === 0) {
        console.log('Chargement de la liste des agents...');
        agentsList = await loadAgents();
        console.log(`${agentsList.length} agents chargés`);
      }
      
      console.log('Requête API vers /api/planifications...');
      const response = await fetch('/api/planifications?limit=50&order=date.desc', { 
        headers,
        credentials: 'include' // Important pour les cookies d'authentification
      });
      
      console.log('Réponse reçue, statut:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur de réponse:', errorText);
        if (response.status === 401) {
          throw new Error('Authentification requise');
        } else if (response.status === 403) {
          throw new Error('Permissions insuffisantes');
        } else {
          throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
        }
      }
      
      const planifications = await response.json();
      console.log(`${planifications.length} planifications reçues`, planifications);
      
      if (!Array.isArray(planifications)) {
        console.error('La réponse n\'est pas un tableau:', planifications);
        throw new Error('Format de réponse inattendu');
      }
      
      if (planifications.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted">
              Aucun jour permissionnaire enregistré
              <div class="mt-2">
                <small>Utilisez le formulaire ci-dessus pour ajouter des permissions</small>
              </div>
            </td>
          </tr>`;
        return;
      }
      
      // Grouper par agent et mois
      const permissionsByAgentAndMonth = {};
      
      planifications.forEach(plan => {
        try {
          // Ignorer les entrées sans jours de permission définis
          if (typeof plan.jours_permission === 'undefined' || plan.jours_permission === null) return;
          
          // S'assurer que la date est valide
          if (!plan.date || !plan.user_id) {
            console.warn('Entrée de planification invalide (date ou user_id manquant):', plan);
            return;
          }
          
          const monthYear = String(plan.date).substring(0, 7); // Format YYYY-MM
          const key = `${plan.user_id}-${monthYear}`;
          
          if (!permissionsByAgentAndMonth[key]) {
            // Trouver le nom de l'agent dans la liste chargée
            let agentName = `Agent ${plan.user_id}`;
            if (agentsList && agentsList.length > 0) {
              const agent = agentsList.find(a => a && a.id === plan.user_id);
              if (agent) {
                agentName = [agent.first_name, agent.last_name]
                  .filter(Boolean)
                  .join(' ')
                  .trim() || agent.email || agentName;
              }
            }
            
            permissionsByAgentAndMonth[key] = {
              user_id: plan.user_id,
              month: monthYear,
              jours_permission: parseInt(plan.jours_permission) || 0,
              project_name: plan.project_name || 'Non spécifié',
              agent_name: agentName
            };
          }
        } catch (err) {
          console.error('Erreur lors du traitement d\'une entrée de planification:', err, plan);
        }
      });
      
      // Afficher les résultats
      const permissionsList = Object.values(permissionsByAgentAndMonth);
      
      if (permissionsList.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted">
              Aucun jour permissionnaire trouvé
              <div class="mt-2">
                <small>Les permissions seront affichées ici après avoir été enregistrées</small>
              </div>
            </td>
          </tr>`;
        return;
      }
      
      // Trier par mois (du plus récent au plus ancien) puis par nom d'agent
      permissionsList.sort((a, b) => {
        if (b.month !== a.month) return b.month.localeCompare(a.month);
        return a.agent_name.localeCompare(b.agent_name);
      });
      
      tbody.innerHTML = permissionsList.map(perm => `
        <tr>
          <td class="align-middle">${escapeHtml(perm.agent_name)}</td>
          <td class="align-middle">${escapeHtml(perm.project_name)}</td>
          <td class="align-middle">${formatMonthYear(perm.month)}</td>
          <td class="align-middle">
            <span class="badge bg-primary rounded-pill">
              ${perm.jours_permission} jour${perm.jours_permission > 1 ? 's' : ''}
            </span>
          </td>
          <td class="align-middle">
            <button class="btn btn-sm btn-outline-primary edit-permission" 
                    data-user-id="${perm.user_id}" 
                    data-month="${perm.month}"
                    title="Modifier les permissions">
              <i class="bi bi-pencil"></i> Modifier
            </button>
          </td>
        </tr>
      `).join('');
      
      // Ajouter les écouteurs d'événements pour les boutons de modification
      document.querySelectorAll('.edit-permission').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const userId = parseInt(btn.dataset.userId);
          const month = btn.dataset.month;
          const permission = permissionsList.find(p => p.user_id === userId && p.month === month);
          
          if (permission) {
            document.getElementById('permission-agent').value = userId;
            document.getElementById('permission-month').value = month + '-01';
            document.getElementById('permission-days').value = permission.jours_permission || 0;
            
            // Faire défiler jusqu'au formulaire
            document.getElementById('permissions-container').scrollIntoView({ behavior: 'smooth' });
          }
        });
      });
      
    } catch (error) {
      console.error('Erreur chargement permissions:', error);
      const errorMessage = error.message || 'Une erreur est survenue';
      
      // Afficher un message d'erreur détaillé dans la console
      if (error.response) {
        console.error('Détails de la réponse:', await error.response.text());
      }
      
      // Afficher un message d'erreur convivial à l'utilisateur
      const errorHtml = `
        <tr>
          <td colspan="5" class="text-center">
            <div class="alert alert-warning mb-0">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>Impossible de charger les permissions</strong>
              <div class="small mt-1">${escapeHtml(errorMessage)}</div>
              <button onclick="loadPermissions()" class="btn btn-sm btn-outline-primary mt-2">
                <i class="bi bi-arrow-clockwise"></i> Réessayer
              </button>
            </div>
          </td>
        </tr>`;
      
      document.getElementById('permissions-list').innerHTML = errorHtml;
    }
  }

  async function savePermissions() {
    const userId = document.getElementById('permission-agent').value;
    const month = document.getElementById('permission-month').value;
    const joursPermission = parseInt(document.getElementById('permission-days').value) || 0;
    
    if (!userId || !month) {
      showError('Veuillez sélectionner un agent et un mois');
      return;
    }
    
    try {
      const headers = await authHeaders();
      headers['Content-Type'] = 'application/json';
      
      const response = await fetch('/api/planifications/permissions', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          user_id: parseInt(userId),
          mois: month,
          jours_permission: joursPermission
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Erreur lors de la sauvegarde');
      }
      
      showSuccess('Jours permissionnaires enregistrés avec succès');
      loadPermissions();
      
      // Réinitialiser le formulaire
      document.getElementById('permission-days').value = '0';
      
    } catch (error) {
      console.error('Erreur sauvegarde permissions:', error);
      showError(error.message || 'Erreur lors de la sauvegarde des permissions');
    }
  }

  function formatMonthYear(monthYear) {
    const [year, month] = monthYear.split('-');
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showError(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show';
    alert.role = 'alert';
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fermer"></button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alert, container.firstChild);
    
    // Supprimer l'alerte après 5 secondes
    setTimeout(() => {
      alert.remove();
    }, 5000);
  }

  function showSuccess(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show';
    alert.role = 'alert';
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fermer"></button>
    `;
    
    const container = document.querySelector('.container');
    container.insertBefore(alert, container.firstChild);
    
    // Supprimer l'alerte après 5 secondes
    setTimeout(() => {
      alert.remove();
    }, 5000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Charger les agents et les permissions
    loadAgents().then(loadPermissions);
    
    // Gestionnaire pour le bouton d'enregistrement
    document.getElementById('save-permissions').addEventListener('click', savePermissions);
    
    // Initialisation des champs de date
    const today = new Date();
    document.getElementById('permission-month').value = today.toISOString().substring(0, 7) + '-01';
    
    $('load-week').addEventListener('click', () => loadWeek($('week-start').value));
    $('load-month').addEventListener('click', () => loadMonth($('month').value));
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
    const boot = () => { loadWeek(); loadMonth(); };
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


