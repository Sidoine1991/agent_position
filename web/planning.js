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

  document.addEventListener('DOMContentLoaded', () => {
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


