// Configuration de l'API - utiliser Render en production sur Vercel
const onVercel = /\.vercel\.app$/.test(window.location.hostname) || window.location.hostname.includes('vercel.app');
const apiBase = '/api';
// Harmoniser la déconnexion
if (typeof window !== 'undefined' && typeof window.logout !== 'function') {
  window.logout = function() {
    try {
      localStorage.removeItem('jwt');
      localStorage.removeItem('loginData');
      localStorage.removeItem('userProfile');
      localStorage.setItem('presence_update', JSON.stringify({ type: 'logout', ts: Date.now() }));
    } catch {}
    // Rediriger vers l'accueil uniquement
    window.location.href = '/';
  };
}
let jwt = localStorage.getItem('jwt') || '';

// Variables globales pour la carte
let checkinMarkers = [];
const agentLegendColors = new Map();
function ensureAgentLegend(agentName, color) {
  try {
    const container = document.getElementById('agent-legend');
    if (!container) return;
    if (!agentLegendColors.has(agentName)) {
      agentLegendColors.set(agentName, color);
    }
    const entries = Array.from(agentLegendColors.entries());
    if (!entries.length) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    container.style.display = '';
    container.innerHTML = '<h3 style="margin:0 0 8px 0">Légende agents</h3>' + entries.map(([name, col]) => (
      `<span style="display:inline-flex;align-items:center;margin-right:12px;margin-bottom:6px;">
         <span style="width:12px;height:12px;border-radius:50%;background:${col};display:inline-block;margin-right:6px;border:2px solid #fff;box-shadow:0 0 0 1px #ccc"></span>
         <span>${name}</span>
       </span>`
    )).join('');
  } catch {}
}
const agentColorMap = new Map();
function colorForAgent(agentId) {
  if (!agentColorMap.has(agentId)) {
    // Palette distincte
    const palette = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#e11d48','#9333ea','#84cc16','#06b6d4'];
    const next = palette[agentColorMap.size % palette.length];
    agentColorMap.set(agentId, next);
  }
  return agentColorMap.get(agentId);
}

// Fonction pour obtenir une couleur basée sur le nom de l'agent
function colorForAgentName(agentName) {
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#e11d48', '#9333ea', '#84cc16', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < agentName.length; i++) {
    hash = agentName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Fonction pour obtenir une couleur basée sur le nom de l'agent (version simplifiée)
function colorForAgentName(agentName) {
  if (!agentName) return '#666666';
  
  // Générer une couleur basée sur le hash du nom
  let hash = 0;
  for (let i = 0; i < agentName.length; i++) {
    hash = agentName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const palette = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#e11d48','#9333ea','#84cc16','#06b6d4'];
  return palette[Math.abs(hash) % palette.length];
}
let agentMarkers = [];
// Restaurer le token depuis l'URL si présent
try {
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');
  if (urlToken && urlToken.length > 20) {
    localStorage.setItem('jwt', urlToken);
    jwt = urlToken;
    console.log('🔐 Token (dashboard) restauré depuis URL');
  }
} catch {}

function $(id) { return document.getElementById(id); }

// Déclarer les fonctions globalement dès le début
let generateMonthlyReport, exportMonthlyReport, createTestAgent, setupReferencePoints;

// Exposer immédiatement les fonctions sur window pour les onclick handlers
if (typeof window !== 'undefined') {
  window.generateMonthlyReport = function() { console.log('generateMonthlyReport called'); };
  window.exportMonthlyReport = function() { console.log('exportMonthlyReport called'); };
  window.createTestAgent = function() { console.log('createTestAgent called'); };
  window.setupReferencePoints = function() { console.log('setupReferencePoints called'); };
}

async function api(path, opts={}) {
  const headers = opts.headers || {};
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
  
  console.log('API call:', apiBase + path, { method: opts.method || 'GET', headers, body: opts.body });
  
  const res = await fetch(apiBase + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body instanceof FormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  
  console.log('API response:', res.status, res.statusText);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('API error:', res.status, errorText);
    const err = new Error(errorText || res.statusText);
    err.status = res.status;
    throw err;
  }
  
  const ct = res.headers.get('content-type') || '';
  const result = ct.includes('application/json') ? await res.json() : await res.text();
  console.log('API result:', result);
  return result;
}

let currentProfile;

async function getProfile() {
  try {
    // Essayer via /api/me si jwt, sinon /profile?email
    if (jwt) {
      const res = await api('/me');
      if (res && res.success && res.data && res.data.user) {
        currentProfile = res.data.user;
        return currentProfile;
      }
    }
    const email = (new URLSearchParams(window.location.search)).get('email') || localStorage.getItem('userEmail');
    const res2 = email ? await api(`/profile?email=${encodeURIComponent(email)}`) : await api('/profile');
    currentProfile = res2 && res2.user ? res2.user : res2?.data?.user || null;
    return currentProfile;
  } catch (e) {
    console.warn('getProfile: profil non disponible (continue en mode libre)');
    return null;
  }
}

async function tryAutoLoginIfNeeded() {
  if (jwt && jwt.length > 20) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || localStorage.getItem('userEmail') || localStorage.getItem('lastUserEmail');
    const password = params.get('password') || localStorage.getItem('userPassword') || localStorage.getItem('lastPassword');
    if (!email || !password) return false;
    console.log('🔐 Auto-login (dashboard) avec paramètres disponibles...');
    const res = await api('/login', { method: 'POST', body: { email, password } });
    if (res && res.success && res.token) {
      jwt = res.token;
      localStorage.setItem('jwt', jwt);
      localStorage.setItem('userEmail', res.user?.email || email);
      console.log('✅ Auto-login réussi (dashboard)');
      return true;
    }
  } catch (e) {
    console.warn('Auto-login dashboard échoué:', e.message || e);
  }
  return false;
}

async function ensureAuth() {
  // Mode libre: tenter de restaurer ou d'auto-connecter puis continuer
  jwt = localStorage.getItem('jwt') || jwt;
  if (!jwt) {
    await tryAutoLoginIfNeeded();
    jwt = localStorage.getItem('jwt') || jwt;
  }
  console.log('ensureAuth: mode libre, jwt présent =', !!jwt);
  // Optionnel: tenter d'obtenir le profil, sans bloquer
  try { await getProfile(); } catch {}
}

let map, markersLayer;
let gmap = null;
let gmarkers = [];
let basemapType = 'leaflet';
let appSettings = null;

async function loadSettings() {
  try {
    const res = await api('/settings');
    if (res && res.success) appSettings = res.settings || null;
  } catch {}
}

// === Calendrier: colorer les jours selon statut de présence ===
async function colorCalendarForAgent(agentId) {
  try {
    const cal = document.getElementById('calendar');
    if (!cal) return; // pas de calendrier sur cette vue

    // Déterminer la période (mois courant)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);
    const fromISO = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0,0,0)).toISOString();
    const toISO = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 23,59,59)).toISOString();

    const p = new URLSearchParams();
    p.set('agent_id', String(agentId));
    p.set('from', fromISO);
    p.set('to', toISO);
    const res = await api('/attendance/day-status?' + p.toString());
    const days = res?.days || {};

    // Attendre que les cases de jours existent (si rendu async)
    const cells = cal.querySelectorAll('[data-date]');
    cells.forEach(cell => {
      const d = cell.getAttribute('data-date'); // YYYY-MM-DD
      const info = days[d];
      cell.classList.remove('day--green','day--orange','day--yellow','day--red');
      if (info && info.color) {
        const cls = info.color === 'green' ? 'day--green' : info.color === 'orange' ? 'day--orange' : info.color === 'yellow' ? 'day--yellow' : info.color === 'red' ? 'day--red' : '';
        if (cls) cell.classList.add(cls);
        if (info.tooltip) cell.setAttribute('title', info.tooltip);
      }
    });
  } catch (e) {
    console.warn('colorCalendarForAgent error', e);
  }
}

// ---- Supabase (fallback direct) -------------------------------------------
function getSupabaseConfig() {
  try {
    const metaUrl = document.querySelector('meta[name="supabase-url"]')?.content || '';
    const metaKey = document.querySelector('meta[name="supabase-anon-key"]')?.content || '';
    const lsUrl = localStorage.getItem('SUPABASE_URL') || '';
    const lsKey = localStorage.getItem('SUPABASE_ANON_KEY') || '';
    const url = (window.SUPABASE_URL || metaUrl || lsUrl || '').trim().replace(/\/+$/,'');
    const key = (window.SUPABASE_ANON_KEY || metaKey || lsKey || '').trim();
    if (url && key) return { url, key };
  } catch {}
  return null;
}

function computeDistanceMeters(lat1, lon1, lat2, lon2) {
  try {
    const toRad = (v) => (Number(v) * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(Number(lat2) - Number(lat1));
    const dLon = toRad(Number(lon2) - Number(lon1));
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  } catch { return null; }
}

async function fetchCheckinsFromSupabase(params) {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  const { url, key } = cfg;

  // Build query
  const search = new URLSearchParams();
  search.set('select', 'id,agent_id,agent_name,lat,lon,timestamp,mission_id,user_id,commune');
  search.set('order', 'timestamp.desc');
  if (params?.agentId) search.set('agent_id', 'eq.' + Number(params.agentId));
  // Time filter: support single day or range [from, to]
  if (params?.from || params?.to) {
    try {
      if (params.from) {
        const f = new Date(params.from + 'T00:00:00');
        search.set('timestamp', `gte.${f.toISOString()}`);
      }
      if (params.to) {
        const t = new Date(params.to + 'T23:59:59');
        search.append('timestamp', `lte.${t.toISOString()}`);
      }
    } catch {}
  } else if (params?.date) {
    try {
      const from = new Date(params.date + 'T00:00:00');
      const to = new Date(from); to.setDate(to.getDate() + 1);
      search.set('timestamp', `gte.${from.toISOString()}`);
      search.append('timestamp', `lt.${to.toISOString()}`);
    } catch {}
  }
  if (params?.villageId) search.set('village_id', 'eq.' + Number(params.villageId));

  const endpoint = `${url}/rest/v1/checkins?${search.toString()}`;
  const res = await fetch(endpoint, {
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
    }
  });
  if (!res.ok) return null;
  const items = await res.json().catch(() => []);
  return Array.isArray(items) ? items : null;
}

async function fetchAgentsFromSupabase() {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  const { url, key } = cfg;
  const p = new URLSearchParams();
  p.set('select', 'id,name,first_name,last_name,project_name,expected_days_per_month');
  const res = await fetch(`${url}/rest/v1/agents?${p.toString()}`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!res.ok) return null;
  return await res.json().catch(() => []);
}

async function fetchUsersMetaFromSupabase() {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  const { url, key } = cfg;
  try {
    const p = new URLSearchParams();
    p.set('select', 'id,name,first_name,last_name,project_name,reference_lat,reference_lon,tolerance_radius_meters');
    const res = await fetch(`${url}/rest/v1/users?${p.toString()}`, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows)) return null;
    const byId = new Map();
    for (const u of rows) {
      const id = Number(u.id);
      const name = u.name || [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
      const refLat = (u.reference_lat != null) ? Number(u.reference_lat) : null;
      const refLon = (u.reference_lon != null) ? Number(u.reference_lon) : null;
      const tol = (u.tolerance_radius_meters != null) ? Number(u.tolerance_radius_meters) : 500;
      const project = u.project_name || '';
      if (Number.isFinite(id)) byId.set(id, { name, refLat, refLon, tol, project });
    }
    return byId;
  } catch { return null; }
}

async function fetchStatisticsFromSupabase(from, to) {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  const { url, key } = cfg;
  // Table optionnelle: statistics (par agent/mois) si disponible
  try {
    const p = new URLSearchParams();
    p.set('select', '*');
    if (from) p.set('period_from', 'eq.' + from);
    if (to) p.append('period_to', 'eq.' + to);
    const res = await fetch(`${url}/rest/v1/statistics?${p.toString()}`, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!res.ok) return null;
    return await res.json().catch(() => []);
  } catch { return null; }
}

// Charger les planifications (hebdo/journalier) depuis Supabase pour un intervalle
async function fetchPlanificationsFromSupabase(from, to) {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  const { url, key } = cfg;
  try {
    const p = new URLSearchParams();
    p.set('select', 'agent_id,date,planned_start_time,planned_end_time');
    if (from) p.set('date', 'gte.' + from);
    if (to) p.append('date', 'lte.' + to);
    const res = await fetch(`${url}/rest/v1/planifications?${p.toString()}`, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!res.ok) return null;
    const items = await res.json().catch(() => []);
    return Array.isArray(items) ? items : null;
  } catch { return null; }
}

function getBasemapType() {
  const el = document.getElementById('basemap');
  return el && el.value ? el.value : 'leaflet';
}

function getMonthRangeFromDateInput() {
  // Si une date est choisie, prendre le mois entier
  const dateStr = $('date')?.value;
  const now = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = d => d.toISOString().split('T')[0];
  return { from: fmt(start), to: fmt(end) };
}

async function updateMonthlySummary() {
  const tbody = document.getElementById('monthly-summary-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7">Chargement...</td></tr>';

  try {
    const { from, to } = getMonthRangeFromDateInput();
    console.log('📊 Période récapitulatif:', { from, to });

    // 1) Essayer d'utiliser les résultats VALIDÉS par le backend (algorithme distance/rayon)
    try {
      const q = new URLSearchParams({ from, to });
      
      // Ajouter les filtres
      const agentId = $('agent')?.value;
      const projectName = $('project')?.value;
      if (agentId) q.set('agent_id', agentId);
      if (projectName) q.set('project_name', projectName);
      
      // Endpoints possibles selon environnement: /presence/stats ou /admin/attendance
      let resp = await api('/presence/stats?' + q.toString());
      let validated = resp?.data || resp?.items || resp?.rows;
      if (!Array.isArray(validated) || !validated.length) {
        console.log('⚠️ /presence/stats vide, tentative /admin/attendance');
        const r2 = await api('/admin/attendance?' + q.toString());
        validated = r2?.data || r2?.items || r2?.rows;
      }

      if (Array.isArray(validated) && validated.length) {
        console.log('✅ Données validées backend utilisées:', validated.length);
        // Format attendu (souple):
        // - soit des tableaux de jours: planned_days[], present_days[], absent_days[]
        // - soit des nombres: planned_days, present_days, absent_days
        const rowsOut = [];
        validated.forEach(row => {
          const agentName = row.agent_name || row.name || `Agent ${row.agent_id || ''}`;
          const plannedIsNum = typeof row.planned_days === 'number';
          const presentIsNum = typeof row.present_days === 'number' || typeof row.presence_days === 'number';
          const absentIsNum = typeof row.absent_days === 'number';

          const plannedDaysArr = Array.isArray(row.planned_days) ? row.planned_days : (Array.isArray(row.plannedDays) ? row.plannedDays : []);
          const presenceDaysArr = Array.isArray(row.present_days) ? row.present_days : (Array.isArray(row.presenceDays) ? row.presenceDays : []);
          const absentDaysArr = Array.isArray(row.absent_days) ? row.absent_days : (Array.isArray(row.absentDays) ? row.absentDays : []);

          const planned = plannedIsNum ? row.planned_days : plannedDaysArr.length;
          const present = presentIsNum ? (row.present_days ?? row.presence_days) : presenceDaysArr.length;
          const absent = absentIsNum ? row.absent_days : (absentDaysArr.length || Math.max(planned - present, 0));
          let justification = row.justification;
          if (!justification) {
            if (planned === 0 && present === 0) justification = 'Aucune mission planifiée ce mois';
            else if (present === 0 && planned > 0) justification = `Absence (rayon/distance): ${absentDaysArr.join(', ')}`;
            else if (present > 0 && absent === 0) justification = `Présence validée (rayon): ${presenceDaysArr.join(', ')}`;
            else justification = `Présent: ${presenceDaysArr.join(', ')} / Absent: ${absentDaysArr.join(', ')}`;
          }
          rowsOut.push({
            agent: agentName,
            project: row.project || 'Terrain',
            planned,
            present,
            absent,
            justification
          });
        });

        // Enrichir la justification avec distances/rayon sur la période (texte simple)
        try {
          const qck = new URLSearchParams({ from, to, limit: String(10000), offset: String(0) });
          let list = [];
          try {
            const chkResp = await api('/admin/checkins?' + qck.toString());
            list = chkResp?.data?.items || chkResp?.items || chkResp?.checkins || [];
          } catch (eFetch) {
            // Fallback: certains serveurs n'exposent pas /admin/checkins (avec filtres). Utiliser latest et filtrer localement.
            const latest = await api('/admin/checkins/latest');
            const all = latest?.data?.items || latest?.items || latest?.checkins || [];
            const fromDate = new Date(from + 'T00:00:00');
            const toDate = new Date(to + 'T23:59:59');
            list = all.filter(c => {
              const t = c.timestamp || c.created_at;
              if (!t) return false;
              const d = new Date(t);
              return d >= fromDate && d <= toDate;
            });
          }
          const perAgentDay = new Map(); // agentName => Map(day => {within, hasAny, minDist, tol})
          const perAgentMeta = new Map(); // agentName => { tol }
          // Récupérer les métadonnées utilisateurs pour recalculer la distance si absente
          let usersMetaMap = null;
          try { usersMetaMap = await fetchUsersMetaFromSupabase(); } catch { usersMetaMap = null; }
          const nameToMeta = new Map();
          if (usersMetaMap) {
            for (const [, meta] of usersMetaMap.entries()) {
              if (meta?.name) nameToMeta.set(String(meta.name).trim().toLowerCase(), meta);
            }
          }
          list.forEach(c => {
            const agentName = c.agent_name || c.missions?.users?.name || 'Agent';
            const t = c.timestamp || c.created_at;
            if (!agentName || !t) return;
            const day = new Date(t).toISOString().slice(0, 10);
            if (!perAgentDay.has(agentName)) perAgentDay.set(agentName, new Map());
            const m = perAgentDay.get(agentName);
            const prev = m.get(day) || { within: false, hasAny: false, minDist: null, tol: 500 };
            let dist = (typeof c.distance_from_reference_m === 'number') ? Number(c.distance_from_reference_m) : null;
            let tol = Number(c.tol) || prev.tol || 500;
            // Recalculer la distance si absente en utilisant les références Supabase
            if ((dist == null || !Number.isFinite(dist)) && nameToMeta.size) {
              const meta = nameToMeta.get(String(agentName).trim().toLowerCase());
              if (meta && Number.isFinite(meta.refLat) && Number.isFinite(meta.refLon) && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lon))) {
                tol = meta.tol || tol || 500;
                const toRad = (v) => (Number(v) * Math.PI) / 180;
                const R = 6371000;
                const dLat = toRad(Number(c.lat) - Number(meta.refLat));
                const dLon = toRad(Number(c.lon) - Number(meta.refLon));
                const a = Math.sin(dLat/2)**2 + Math.cos(toRad(meta.refLat)) * Math.cos(toRad(Number(c.lat))) * Math.sin(dLon/2)**2;
                const calc = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                dist = Math.round(R * calc);
              }
            }
            const within = (typeof c.within_tolerance === 'boolean') ? c.within_tolerance : (dist != null ? dist <= tol : false);
            const minDist = (prev.minDist == null) ? dist : (dist == null ? prev.minDist : Math.min(prev.minDist, dist));
            m.set(day, { within: prev.within || !!within, hasAny: true, minDist, tol });
            if (!perAgentMeta.has(agentName)) perAgentMeta.set(agentName, { tol });
            else if (!perAgentMeta.get(agentName).tol && tol) perAgentMeta.get(agentName).tol = tol;
          });
          rowsOut.forEach(r => {
            const days = perAgentDay.get(r.agent) || new Map();
            let withinCount = 0, outsideCount = 0;
            days.forEach(v => { if (v.hasAny) { if (v.within) withinCount++; else outsideCount++; } });
            const missing = Math.max((r.absent || 0) - outsideCount, 0);
            const tol = perAgentMeta.get(r.agent)?.tol || 500;
            // Distances (par rapport au point de référence)
            const distVals = [];
            days.forEach(v => { if (v && v.minDist != null) distVals.push(Number(v.minDist)); });
            const distMin = distVals.length ? Math.round(Math.min(...distVals)) : null;
            const distMax = distVals.length ? Math.round(Math.max(...distVals)) : null;
            const absSuffix = (r.absent && r.absent > 0) ? ` — Absents: ${r.absent} j` : '';
            // Texte simple avec rayon et décision
            if ((r.present || 0) === 0 && (r.planned || 0) > 0) {
              r.justification = `Rayon ${tol} m — Absent` + (distMin != null ? ` — Dist. min/max: ${distMin}/${distMax} m` : '') + absSuffix;
            } else if (withinCount > 0 && outsideCount === 0) {
              r.justification = `Rayon ${tol} m — Présent dans la zone (${withinCount} j)` + (distMin != null ? ` — Dist. min/max: ${distMin}/${distMax} m` : '') + absSuffix;
            } else if (withinCount === 0 && outsideCount > 0) {
              r.justification = `Rayon ${tol} m — Présent hors zone (${outsideCount} j)` + (distMin != null ? ` — Dist. min/max: ${distMin}/${distMax} m` : '') + absSuffix;
            } else if (withinCount > 0 && outsideCount > 0) {
              r.justification = `Rayon ${tol} m — Mixte: ${withinCount} j dans zone, ${outsideCount} j hors zone` + (distMin != null ? ` — Dist. min/max: ${distMin}/${distMax} m` : '') + absSuffix;
            } else {
              r.justification = `Rayon ${tol} m — ${missing > 0 ? 'Absent' : '—'}` + (distMin != null ? ` — Dist. min/max: ${distMin}/${distMax} m` : '') + absSuffix;
            }
          });
        } catch(e) { console.warn('Justification enrichie (distance) indisponible:', e?.message || e); }

        rowsOut.sort((a, b) => a.agent.localeCompare(b.agent));
        tbody.innerHTML = rowsOut.map(r => {
          const decision = (r.present && r.present > 0) ? 'Présent' : ((r.absent && r.absent > 0) ? 'Absent' : '—');
          return `
          <tr>
            <td>${r.agent}</td>
            <td>${r.project}</td>
            <td>${r.planned}</td>
            <td>${r.present}</td>
            <td>${r.absent}</td>
            <td>${decision}</td>
            <td title="${r.justification}">${r.justification}</td>
          </tr>
        `; }).join('');
        console.log('✅ MonthlySummary (validé backend):', rowsOut.length);
        return; // On n'utilise pas le fallback si validé dispo
      }
    } catch (e) {
      console.log('ℹ️ Pas de données validées, fallback calcul local:', e?.message || e);
    }

    // 2) Fallback: calcul local (missions + check-ins) si les données validées ne sont pas dispo
    // Récupérer les données de tous les agents (et références depuis Supabase)
    let allMissions = [];
    let allCheckins = [];
    let allAgents = [];
    let usersMeta = null;

    try {
      console.log('👥 Récupération des données de tous les agents...');

      // Récupérer la liste des agents
      try {
        const agentsResp = await api('/admin/agents');
        allAgents = agentsResp?.agents || agentsResp?.data?.items || agentsResp?.items || [];
        console.log('👥 Agents récupérés:', allAgents.length);
      } catch (agentsError) {
        console.log('⚠️ Impossible de récupérer la liste des agents, utilisation des données disponibles');
      }

      // Références/rayons depuis Supabase (users)
      try {
        usersMeta = await fetchUsersMetaFromSupabase();
        console.log('👤 Users meta size:', usersMeta ? usersMeta.size : 0);
      } catch { usersMeta = null; }

      // Récupérer les check-ins de tous les agents (sur la période) avec distances/within
      try {
        const qck = new URLSearchParams({ from, to, limit: String(10000), offset: String(0) });
        const checkinsResp = await api('/admin/checkins?' + qck.toString());
        allCheckins = checkinsResp?.data?.items || checkinsResp?.items || checkinsResp?.checkins || [];
        console.log('📍 Check-ins (période) récupérés:', allCheckins.length);
      } catch (checkinsError) {
        console.log('⚠️ Impossible de récupérer les check-ins de tous les agents, fallback vers données utilisateur');
        try {
          const userCheckinsResp = await api('/checkins/mine');
          allCheckins = userCheckinsResp?.items || [];
        } catch (userError) {
          console.log('❌ Impossible de récupérer les check-ins utilisateur');
        }
      }

      // Récupérer les missions de tous les agents
      try {
        const missionsResp = await api('/admin/missions');
        allMissions = missionsResp?.missions || missionsResp?.data?.items || missionsResp?.items || [];
        console.log('📋 Missions de tous les agents récupérées:', allMissions.length);
      } catch (missionsError) {
        console.log('⚠️ Impossible de récupérer les missions de tous les agents, fallback vers données utilisateur');
        try {
          const userMissionsResp = await api('/me/missions');
          allMissions = userMissionsResp?.missions || [];
        } catch (userError) {
          console.log('❌ Impossible de récupérer les missions utilisateur');
        }
      }

    } catch (error) {
      console.error('❌ Erreur récupération données agents:', error);
    }

    console.log('📊 MonthlySummary: agents', allAgents.length, 'missions', allMissions.length, 'checkins', allCheckins.length, { from, to });

    // Filtrer les missions et check-ins par période
    const fromDate = new Date(from + 'T00:00:00');
    const toDate = new Date(to + 'T23:59:59');
    
    const filteredMissions = allMissions.filter(m => {
      if (!m.date_start) return false;
      const missionDate = new Date(m.date_start);
      return missionDate >= fromDate && missionDate <= toDate;
    });
    
    const filteredCheckins = allCheckins.filter(c => {
      const t = c.timestamp || c.created_at;
      if (!t) return false;
      const checkinDate = new Date(t);
      return checkinDate >= fromDate && checkinDate <= toDate;
    });
    
    console.log('📅 Données filtrées pour la période:', {
      missions: filteredMissions.length,
      checkins: filteredCheckins.length
    });

    // Grouper les données par agent
    const agentStats = new Map();
    
    // Initialiser les statistiques pour chaque agent (priorité données Supabase)
    allAgents.forEach(agent => {
      const meta = usersMeta?.get(Number(agent.id));
      agentStats.set(agent.id, {
        name: (meta?.name) || agent.name || agent.first_name || `Agent ${agent.id}`,
        project: (meta?.project) || agent.project_name || agent.project || agent.assigned_project || agent.projet || agent.projectName || '',
        plannedDays: new Set(),
        presenceDays: new Set()
      });
    });

    // S'il manque des agents, les déduire des missions/check-ins
    const ensureAgent = (id, nameGuess, projectGuess) => {
      if (!id) return;
      if (!agentStats.has(id)) {
        agentStats.set(id, {
          name: nameGuess || `Agent ${id}`,
          project: projectGuess || '',
          plannedDays: new Set(),
          presenceDays: new Set()
        });
      }
    };
    filteredMissions.forEach(m => ensureAgent(
      m.agent_id || m.user_id,
      m.users?.name,
      m.users?.project || m.users?.project_name || m.profiles?.project || m.profiles?.project_name
    ));
    filteredCheckins.forEach(c => ensureAgent(
      c.agent_id || c.user_id || c.missions?.agent_id,
      c.missions?.users?.name,
      c.missions?.users?.project || c.missions?.users?.project_name || c.missions?.profiles?.project || c.missions?.profiles?.project_name
    ));
    
    // Ajouter les jours planifiés (Supabase planifications si dispo, sinon missions)
    try {
      const sbPlans = await fetchPlanificationsFromSupabase(from, to);
      if (Array.isArray(sbPlans) && sbPlans.length) {
        for (const p of sbPlans) {
          const agentId = Number(p.agent_id);
          const day = (p.date || '').toString().slice(0,10);
          if (!agentId || !day) continue;
          if (agentStats.has(agentId)) agentStats.get(agentId).plannedDays.add(day);
        }
      } else {
    filteredMissions.forEach(mission => {
      const agentId = mission.agent_id || mission.user_id;
      if (agentId && mission.date_start) {
        const day = new Date(mission.date_start).toISOString().slice(0, 10);
        if (agentStats.has(agentId)) {
          agentStats.get(agentId).plannedDays.add(day);
        }
      }
    });
      }
    } catch {
      filteredMissions.forEach(mission => {
        const agentId = mission.agent_id || mission.user_id;
        if (agentId && mission.date_start) {
          const day = new Date(mission.date_start).toISOString().slice(0, 10);
          if (agentStats.has(agentId)) {
            agentStats.get(agentId).plannedDays.add(day);
          }
        }
      });
    }
    
    // Ajouter les jours de présence (check-ins) en jugeant par la distance/rayon
    // On agrège par agent+jour le statut et la distance minimale observée (distance calculée via référence Supabase si pas fournie)
    const perAgentDay = new Map();
    const keyAD = (aid, day) => aid + '|' + day;
    filteredCheckins.forEach(checkin => {
      const agentId = checkin.missions?.agent_id || checkin.agent_id || checkin.user_id;
      const t = checkin.timestamp || checkin.created_at;
      if (!agentId || !t) return;
        const day = new Date(t).toISOString().slice(0, 10);
      const k = keyAD(agentId, day);
      let dist = (typeof checkin.distance_from_reference_m === 'number') ? Number(checkin.distance_from_reference_m) : null;
      let tol = Number(checkin.tol) || null;
      if ((dist == null || !Number.isFinite(dist)) && usersMeta && usersMeta.has(Number(agentId))) {
        const meta = usersMeta.get(Number(agentId));
        tol = tol || meta.tol || 500;
        if (Number.isFinite(meta?.refLat) && Number.isFinite(meta?.refLon) && Number.isFinite(checkin.lat) && Number.isFinite(checkin.lon)) {
          dist = computeDistanceMeters(meta.refLat, meta.refLon, Number(checkin.lat), Number(checkin.lon));
        }
      }
      if (tol == null) tol = 500;
      const within = (typeof checkin.within_tolerance === 'boolean') ? checkin.within_tolerance : (dist != null ? dist <= tol : false);
      const prev = perAgentDay.get(k) || { within: false, minDist: null, hasAny: false, tol };
      const minDist = (prev.minDist == null) ? dist : (dist == null ? prev.minDist : Math.min(prev.minDist, dist));
      perAgentDay.set(k, { within: prev.within || !!within, minDist, hasAny: true, tol });
    });

    // Reporter les jours jugés présents dans presenceDays
    for (const [k, agg] of perAgentDay.entries()) {
      const [aidStr, day] = k.split('|');
      const aid = Number(aidStr);
      if (!agentStats.has(aid)) continue;
      if (agg.within) agentStats.get(aid).presenceDays.add(day);
    }

    // Calculer les statistiques pour chaque agent
    const rowsOut = [];
    for (const [agentId, stats] of agentStats.entries()) {
      const planned = stats.plannedDays.size;
      const present = stats.presenceDays.size;
      const absent = Math.max(planned - present, 0);

      // Construire une justification lisible basée sur distance/rayon (Supabase)
      const plannedDaysArr = Array.from(stats.plannedDays).sort();
      const presenceDaysArr = Array.from(stats.presenceDays).sort();
      const absentDaysArr = plannedDaysArr.filter(d => !stats.presenceDays.has(d));
      const tol = (() => {
        const meta = usersMeta?.get(Number(agentId));
        if (meta?.tol) return meta.tol;
        const keys = [...new Set([...presenceDaysArr, ...absentDaysArr])].map(d => agentId + '|' + d);
        for (const key of keys) { const agg = perAgentDay.get(key); if (agg?.tol) return agg.tol; }
        return 500;
      })();
      const distVals = [];
      presenceDaysArr.forEach(d => { const agg = perAgentDay.get(agentId + '|' + d); if (agg?.minDist != null) distVals.push(Number(agg.minDist)); });
      absentDaysArr.forEach(d => { const agg = perAgentDay.get(agentId + '|' + d); if (agg?.minDist != null) distVals.push(Number(agg.minDist)); });
      const distMin = distVals.length ? Math.round(Math.min(...distVals)) : null;
      const distMax = distVals.length ? Math.round(Math.max(...distVals)) : null;
      const withinCount = presenceDaysArr.filter(d => (perAgentDay.get(agentId + '|' + d)?.minDist ?? Infinity) <= tol).length;
      const outsideCount = presenceDaysArr.length - withinCount;
      let justification = '';
      if (present === 0 && planned > 0) {
        justification = `Rayon ${tol} m — Absent` + (distMin != null ? ` — Dist. min/max: ${distMin}/${distMax} m` : '');
      } else if (outsideCount === 0 && withinCount > 0) {
        justification = `Rayon ${tol} m — Présent dans la zone (${withinCount} j)` + (distMin != null ? ` — Dist. min/max: ${distMin}/${distMax} m` : '');
      } else if (withinCount === 0 && outsideCount > 0) {
        justification = `Rayon ${tol} m — Présent hors zone (${outsideCount} j)` + (distMin != null ? ` — Dist. min/max: ${distMin}/${distMax} m` : '');
      } else if (withinCount > 0 && outsideCount > 0) {
        justification = `Rayon ${tol} m — Mixte: ${withinCount} j dans zone, ${outsideCount} j hors zone` + (distMin != null ? ` — Dist. min/max: ${distMin}/${distMax} m` : '');
      } else {
        justification = (planned === 0) ? '—' : `Rayon ${tol} m — Absent` + (distMin != null ? ` — Dist. min/max: ${distMin}/${distMax} m` : '');
      }
      
      console.log(`📊 Statistiques agent ${stats.name}:`, {
        planned,
        present,
        absent,
        plannedDays: Array.from(stats.plannedDays),
        presenceDays: Array.from(stats.presenceDays)
      });
      
      if (present > 0 || planned > 0) {
        rowsOut.push({
          agent: stats.name,
          project: stats.project || '—',
          planned,
          present,
          absent,
          justification
        });
      }
    }

    // Trier par nom d'agent
    rowsOut.sort((a, b) => a.agent.localeCompare(b.agent));

    if (!rowsOut.length) {
    tbody.innerHTML = '<tr><td colspan="7">Aucune donnée pour la période sélectionnée.</td></tr>';
      return;
    }

    tbody.innerHTML = rowsOut.map(r => `
      <tr>
        <td>${r.agent}</td>
        <td>${r.project}</td>
        <td>${r.planned}</td>
        <td>${r.present}</td>
        <td>${r.absent}</td>
        <td>${r.justification}</td>
      </tr>
    `).join('');
    
    console.log('✅ MonthlySummary rows pour tous les agents:', rowsOut.length, rowsOut);
  } catch (e) {
    console.warn('updateMonthlySummary error:', e);
    tbody.innerHTML = '<tr><td colspan="5">Impossible de charger le récapitulatif.</td></tr>';
  }
}

function clearGoogleMarkers() {
  try { gmarkers.forEach(m => m.setMap(null)); } catch {}
  gmarkers = [];
}

function initMap() {
  basemapType = getBasemapType();
  // Reuse existing Leaflet map if already initialized to avoid double init error
  try {
    if (typeof window !== 'undefined' && window.__lmap) {
      map = window.__lmap;
      try { if (markersLayer && markersLayer.clearLayers) markersLayer.clearLayers(); } catch {}
      try { markersLayer = L.layerGroup().addTo(map); } catch {}
    } else {
  // Cleanup previous maps
  try { if (map && map.remove) map.remove(); } catch {}
  map = null;
    }
  } catch {}
  try { clearGoogleMarkers(); } catch {}
  gmap = null;

  if (basemapType === 'google' && window.google && window.google.maps) {
    const el = document.getElementById('map');
    const center = { lat: 9.3077, lng: 2.3158 };
    gmap = new google.maps.Map(el, { center, zoom: 7, mapTypeId: 'roadmap' });
    markersLayer = null;
    return;
  }

  // Default to Leaflet
  if (!map) {
  map = L.map('map').setView([9.3077, 2.3158], 7);
    try { window.__lmap = map; } catch {}
  }
  let osmLayer = null;
  let fallbackLayer = null;
  try {
    osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      crossOrigin: true,
      maxZoom: 19
    }).addTo(map);
  } catch (e) {
    console.warn('⚠️ OSM layer init failed, will try fallback:', e);
  }
  setTimeout(() => {
    const anyTile = document.querySelector('#map .leaflet-tile');
    if (!anyTile && !fallbackLayer) {
      console.warn('⚠️ Aucune tuile OSM chargée, bascule vers ArcGIS World_Imagery');
      if (osmLayer) { try { map.removeLayer(osmLayer); } catch {} }
      fallbackLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
      }).addTo(map);
    }
  }, 2000);
  markersLayer = L.layerGroup().addTo(map);
}

async function init() {
  await ensureAuth();
  await loadSettings();
  
  // Vérifier l'accès au dashboard
  const hasAccess = await checkDashboardAccess();
  if (!hasAccess) return;
  
  // Mettre à jour les informations utilisateur
  await updateUserInfo();
  
  // Conserver le comportement d'origine (pas de forçage du basemap)

  // Map
  initMap();
  
  // Créer le bouton d'ajout de point de début après l'initialisation de la carte
  setTimeout(() => {
    createAddStartPointButton();
    try { createDashboardPresenceButtons(); } catch {}
  }, 1500);

  await loadAgents();
  await loadProjects();
  
  // Ajouter les gestionnaires d'événements pour les filtres
  setupFilterEventListeners();
  
  // Initialiser les sélecteurs géographiques avec les bonnes fonctions
  setTimeout(() => {
    console.log('🌍 Initialisation des sélecteurs géographiques dans dashboard...');
    initGeoSelectorsLocal();
  }, 100);

  // Test de chargement des départements au démarrage
  console.log('🚀 Test de chargement des départements au démarrage...');
  setTimeout(() => {
    loadAfDepartements();
  }, 1000);

  // Changement de fond de carte
  const basemapEl = document.getElementById('basemap');
  if (basemapEl) {
    basemapEl.addEventListener('change', async () => {
      // Si l'utilisateur sélectionne Google alors que l'API est indisponible, revenir à Leaflet
      if (basemapEl.value === 'google' && !(window.google && window.google.maps)) {
        basemapEl.value = 'leaflet';
      }
      initMap();
      await refresh();
    });
  }

  $('refresh').onclick = refresh;
  
  // Bouton de test pour diagnostiquer les check-ins
  const testBtn = $('test-checkins');
  if (testBtn) {
    testBtn.onclick = async () => {
      console.log('🧪 TEST DIAGNOSTIC DES CHECK-INS');
      console.log('================================');
      
      try {
        // Test 0: Vérifier le JWT
        console.log('0️⃣ Vérification du JWT...');
        console.log('JWT présent:', !!jwt);
        console.log('JWT longueur:', jwt?.length || 0);
        console.log('JWT localStorage:', !!localStorage.getItem('jwt'));
        
        // Test 1: Vérifier l'authentification
        console.log('1️⃣ Test authentification...');
        const profile = await api('/profile');
        console.log('✅ Profil utilisateur:', profile);
        
        // Test 2: Tester l'endpoint check-ins
        console.log('2️⃣ Test endpoint /api/checkins/mine...');
        const checkins = await api('/checkins/mine');
        console.log('✅ Réponse check-ins:', checkins);
        
        // Test 3: Vérifier les missions
        console.log('3️⃣ Test endpoint /api/me/missions...');
        const missions = await api('/me/missions');
        console.log('✅ Réponse missions:', missions);
        
        // Test 4: Forcer le rechargement de la carte
        console.log('4️⃣ Test rechargement carte...');
        await loadCheckinsOnMap();
        
        alert(`Test terminé ! Check-ins trouvés: ${checkins?.items?.length || 0}`);
        
      } catch (error) {
        console.error('❌ Erreur pendant le test:', error);
        alert('Erreur: ' + error.message);
      }
    };
  }
  try {
    await refresh();
    
    // S'assurer que les check-ins sont chargés après l'initialisation
    setTimeout(async () => {
      try {
        console.log('🔄 Chargement des check-ins après initialisation...');
        await loadCheckinsOnMap();
      } catch (e) {
        console.error('❌ Erreur chargement check-ins après init:', e);
      }
    }, 2000);
  } catch (e) {
    handleDashboardError(e);
  }
  
  // Configurer la navigation circulaire selon le rôle
  await setupCircularNavigation();

  // Mettre à jour le récap quand la date change (mois sélectionné)
  const dateEl = $('date');
  if (dateEl) dateEl.addEventListener('change', () => updateMonthlySummary().catch(()=>{}));

  // Modal agent
  window.openAgentModal = openAgentModal;
  window.closeAgentModal = closeAgentModal;
  const form = document.getElementById('agent-form');
  
  // Close modal when clicking outside
  $('agent-modal').addEventListener('click', (e) => {
    if (e.target === $('agent-modal')) {
      closeAgentModal();
    }
  });
  
  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('agent-modal').classList.contains('hidden')) {
      closeAgentModal();
    }
  });

  // Habillage Bootstrap léger du dashboard
  try {
    const main = document.querySelector('.main-content');
    if (main) main.classList.add('container', 'py-3');
    const nav = document.querySelector('nav.navbar');
    if (nav) nav.classList.add('navbar', 'navbar-expand-lg', 'bg-light', 'border-bottom');
    document.querySelectorAll('table').forEach(t => t.classList.add('table', 'table-striped', 'table-hover'));
    document.querySelectorAll('input, select, textarea').forEach(i => {
      if (!['checkbox','radio','file'].includes(i.type)) i.classList.add('form-control');
    });
    document.querySelectorAll('label').forEach(l => l.classList.add('form-label'));
    document.querySelectorAll('button').forEach(b => b.classList.add('btn', 'btn-primary'));
  } catch {}
}

// Fonction pour charger et afficher les check-ins sur la carte
async function loadCheckinsOnMap() {
  try {
    console.log('🗺️ Chargement des check-ins existants pour la carte...');
    
    let rows = [];
    
    // Essayer d'abord l'endpoint admin pour tous les agents
    try {
      console.log('📍 Récupération des check-ins de tous les agents...');
      const response = await api('/admin/checkins/latest');
      console.log('📦 Réponse admin checkins:', response);
      
      const checkins = response?.data?.items || response?.checkins || [];
      console.log('📋 Check-ins extraits:', checkins.length);
      
      if (Array.isArray(checkins) && checkins.length > 0) {
        // Traiter les check-ins de l'endpoint admin
        const filteredCheckins = checkins.filter(checkin => {
          const hasCoords = Number.isFinite(Number(checkin.lat)) && Number.isFinite(Number(checkin.lon));
          return hasCoords;
        });
        
        console.log('📋 Check-ins avec coordonnées valides:', filteredCheckins.length);
        
        // Grouper par agent et par mission pour avoir un point par agent par mission
        const agentMissionMap = {};
        filteredCheckins.forEach(checkin => {
          const agentId = checkin.missions?.agent_id || checkin.mission_id;
          const missionId = checkin.mission_id || checkin.missions?.id;
          const agentName = checkin.missions?.users?.name || 'Agent';
          
          const key = `${agentId}_${missionId}`;
          if (!agentMissionMap[key]) {
            agentMissionMap[key] = {
              agent_id: agentId,
              mission_id: missionId,
              agent_name: agentName,
              checkins: []
            };
          }
          agentMissionMap[key].checkins.push(checkin);
        });
        
        console.log('📊 Groupes agent-mission:', Object.keys(agentMissionMap).length);
        
        // Pour chaque groupe agent-mission, créer un point représentatif
        const presencePoints = [];
        Object.keys(agentMissionMap).forEach(key => {
          const group = agentMissionMap[key];
          const checkins = group.checkins;
          
          // Sélectionner le point de début si présent, sinon le premier check-in chronologique
          const startCheckin = checkins.find(c => {
            const t = (c.type || '').toLowerCase();
            const n = (c.note || '').toLowerCase();
            return t === 'start_mission' || t === 'mission_start' || n.includes('début') || n.includes('depart') || n.includes('start');
          });

          // Ordonner pour trouver le premier check-in si pas de start explicite
          const sortedByTime = [...checkins].sort((a, b) => {
            const timeA = new Date(a.timestamp || a.created_at);
            const timeB = new Date(b.timestamp || b.created_at);
            return timeA - timeB;
          });

          const representativeCheckin = startCheckin || sortedByTime[0];
          const latestCheckin = checkins[checkins.length - 1];
          
          console.log(`🎯 Point de présence pour ${group.agent_name} mission ${group.mission_id}:`, representativeCheckin);
          
          // Déterminer le type de point basé sur l'activité
          let pointType = startCheckin ? 'mission_start' : 'mission_start';
          let note = `Mission ${group.mission_id} - ${group.agent_name}`;
          
          if (checkins.length > 1) {
            const duration = new Date(latestCheckin.timestamp || latestCheckin.token) - 
                           new Date(representativeCheckin.timestamp || representativeCheckin.created_at);
            const hours = Math.round(duration / (1000 * 60 * 60));
            note = `${note} (${checkins.length} check-ins, ${hours}h)`;
            pointType = 'mission_active';
          }
          
          presencePoints.push({
            lat: Number(representativeCheckin.lat),
            lon: Number(representativeCheckin.lon),
            timestamp: representativeCheckin.timestamp || representativeCheckin.created_at,
            agent_name: group.agent_name,
            user_id: group.agent_id,
            mission_id: group.mission_id,
            type: pointType,
            note: note,
            checkins_count: checkins.length,
            checkin_id: representativeCheckin.id,
            last_checkin_time: latestCheckin.timestamp || latestCheckin.created_at
          });
        });
        
        rows = presencePoints;
        console.log('✅ Points de présence créés:', rows.length, 'répartis sur:', Object.keys(agentMissionMap).length, 'groupes agent-mission');

        // Fallbacks si aucun point n'a été généré (ex: pas de mission_id agrégable)
        if (!rows.length) {
          console.warn('⚠️ Aucun point agent-mission généré, tentative fallback sur les check-ins de début explicites...');
          const startOnly = filteredCheckins
            .filter(c => {
              const t = (c.type || '').toLowerCase();
              const n = (c.note || '').toLowerCase();
              return (t === 'start_mission' || t === 'mission_start' || n.includes('début') || n.includes('depart') || n.includes('start'))
                && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lon));
            })
            .map(c => ({
              lat: Number(c.lat),
              lon: Number(c.lon),
              timestamp: c.timestamp || c.created_at,
              agent_name: c.missions?.users?.name || 'Agent',
              user_id: c.missions?.agent_id || c.user_id,
              mission_id: c.mission_id || c.missions?.id,
              type: 'mission_start',
              note: `Début mission - ${(c.missions?.users?.name || 'Agent')}${c.note ? `: ${c.note}` : ''}`
            }));
          if (startOnly.length) {
            rows = startOnly;
            console.log('✅ Fallback: points de début explicites utilisés:', rows.length);
          }
        }

        if (!rows.length) {
          console.warn('⚠️ Aucun point de début explicite trouvé, fallback sur tous les check-ins valides...');
          rows = filteredCheckins.map(c => ({
            lat: Number(c.lat),
            lon: Number(c.lon),
            timestamp: c.timestamp || c.created_at,
            agent_name: c.missions?.users?.name || 'Agent',
            user_id: c.missions?.agent_id || c.user_id,
            mission_id: c.mission_id || c.missions?.id,
            type: (c.type || 'checkin'),
            note: c.note || `Check-in ${c.id}`
          }));
          console.log('✅ Fallback final: affichage de tous les check-ins:', rows.length);
        }
      }
    } catch (adminError) {
      console.log('⚠️ Endpoint admin non disponible, fallback vers check-ins utilisateur');
      
      // Fallback: récupérer les check-ins de l'utilisateur connecté
      try {
        const userCheckinsResp = await api('/checkins/mine');
        const userCheckins = userCheckinsResp?.items || [];
        console.log('📋 Check-ins utilisateur récupérés:', userCheckins.length);
        
        rows = userCheckins
          .filter(checkin => {
            const hasCoords = Number.isFinite(Number(checkin.lat)) && Number.isFinite(Number(checkin.lon));
            // Filtrer pour n'afficher que les points de début de mission
            const isStartPoint = checkin.type === 'start_mission' || checkin.type === 'mission_start' || 
                                checkin.note?.toLowerCase().includes('début') || 
                                checkin.note?.toLowerCase().includes('start') ||
                                checkin.note?.toLowerCase().includes('départ');
            return hasCoords && isStartPoint;
          })
          .map(checkin => ({
            lat: Number(checkin.lat),
            lon: Number(checkin.lon),
            timestamp: checkin.timestamp,
            agent_name: currentProfile?.name || 'Moi',
            user_id: currentProfile?.id,
            type: 'start_mission',
            note: `Début mission - ${currentProfile?.name || 'Moi'}${checkin.note ? `: ${checkin.note}` : ''}`
          }));
        console.log('✅ Check-ins utilisateur traités:', rows.length);
      } catch (userError) {
        console.error('❌ Erreur récupération check-ins utilisateur:', userError);
      }
    }
    if (rows && rows.length) {
      console.log('✅ Check-ins chargés pour affichage sur carte:', rows.length);
      console.log('Données check-ins:', rows);
      console.log('Type de carte:', basemapType);
      console.log('Objet map disponible:', !!map);
      console.log('Objet gmap disponible:', !!gmap);
      
      // Clear existing markers
      if (basemapType === 'google') {
        clearGoogleMarkers();
        console.log('🧹 Marqueurs Google Maps nettoyés');
      } else {
        checkinMarkers.forEach(marker => { try { map.removeLayer(marker); } catch {} });
        checkinMarkers = [];
        console.log('🧹 Marqueurs Leaflet nettoyés');
      }

      const latlngs = [];
      rows.forEach((checkin, index) => {
        console.log(`🔍 Traitement check-in ${index + 1}:`, checkin);
        if (typeof checkin.lat === 'number' && typeof checkin.lon === 'number') {
          console.log(`✅ Coordonnées valides pour check-in ${index + 1}: ${checkin.lat}, ${checkin.lon}`);
          const color = colorForAgentName(checkin.agent_name || 'Agent');
          ensureAgentLegend(checkin.agent_name || 'Agent', color);
          
          // Déterminer le type et l'apparence du marqueur
          let pointType = checkin.type || 'mission_active';
          let typeLabel = 'Mission en cours';
          let markerStyle = {
            radius: 8,
            fillColor: color,
            color: color,
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.6
          };
          
          // Personnaliser l'apparence selon le type
          if (pointType === 'mission_start') {
            typeLabel = 'Début de mission';
            markerStyle.radius = 10;
            markerStyle.weight = 3;
          } else if (pointType === 'mission_active') {
            console.log(pointType === 'mission_active', 'Mission active');
            typeLabel = 'Présence';
            markerStyle.radius = 12;
            markerStyle.fillOpacity = 0.7;
            markerStyle.weight = 4;
          }
          
          const title = `${checkin.agent_name || 'Agent'} • ${typeLabel}`;
          const note = checkin.note || `Mission ${checkin.mission_id || 'N/A'}`;
          
          const popupHtml = `
            <div style="min-width: 220px;">
              <h6 style="color: ${color};"><strong>${checkin.agent_name || 'Agent'}</strong></h6>
              <p><strong>Type:</strong> ${typeLabel}</p>
              <p><strong>Mission:</strong> ${checkin.mission_id || 'N/A'}</p>
              <p><strong>Date:</strong> ${new Date(checkin.timestamp).toLocaleString('fr-FR')}</p>
              <p><strong>Check-ins:</strong> ${checkin.checkins_count || 1}</p>
              <p><strong>Note:</strong> ${note}</p>
              ${checkin.last_checkin_time ? `<p><strong>Dernier check-in:</strong> ${new Date(checkin.last_checkin_time).toLocaleString('fr-FR')}</p>` : ''}
            </div>`;

          if (basemapType === 'google' && gmap) {
            console.log(`📍 Création marqueur Google Maps pour check-in ${index + 1}`);
            const marker = new google.maps.Marker({ position: { lat: checkin.lat, lng: checkin.lon }, map: gmap, title });
            const infowindow = new google.maps.InfoWindow({ content: popupHtml });
            marker.addListener('click', () => infowindow.open({ anchor: marker, map: gmap }));
            gmarkers.push(marker);
            console.log(`✅ Marqueur Google Maps créé et ajouté`);
          } else if (map) {
            console.log(`📍 Création marqueur Leaflet pour check-in ${index + 1}`);
            const marker = L.circleMarker([checkin.lat, checkin.lon], markerStyle).addTo(map);
            marker.bindPopup(popupHtml);
            checkinMarkers.push(marker);
            console.log(`✅ Marqueur Leaflet créé et ajouté (${typeLabel})`);
          } else {
            console.warn(`❌ Impossible de créer le marqueur: map=${!!map}, gmap=${!!gmap}, basemapType=${basemapType}`);
          }
          latlngs.push([checkin.lat, checkin.lon]);
        }
      });

      if (latlngs.length) {
        console.log(`🗺️ Centrage de la carte sur ${latlngs.length} points`);
        if (basemapType === 'google' && gmap) {
          const bounds = new google.maps.LatLngBounds();
          latlngs.forEach(([lat, lon]) => bounds.extend({ lat, lng: lon }));
          gmap.fitBounds(bounds, 50);
          console.log('✅ Carte Google Maps centrée');
        } else if (map) {
          const group = new L.featureGroup(checkinMarkers);
          map.fitBounds(group.getBounds().pad(0.1));
          console.log('✅ Carte Leaflet centrée');
        }
      } else {
        console.warn('⚠️ Aucun point à afficher sur la carte');
      }
      console.log(`✅ Carte mise à jour avec ${latlngs.length} marqueurs (${checkinMarkers.length} Leaflet, ${gmarkers?.length || 0} Google)`);
    }
  } catch (error) {
    console.error('❌ Erreur lors du chargement des check-ins:', error);
    handleDashboardError(error);
  }
}

async function loadAgents() {
  const sel = $('agent'); 
  if (!sel) return;
  
  sel.innerHTML = '';
  try {
    const result = await api('/admin/agents');
    const agents = result.agents || result.data || result || [];
    
    // Vérifier que agents est un array
    if (!Array.isArray(agents)) {
      console.error('Erreur: agents n\'est pas un array:', agents);
      return;
    }
    
    sel.append(new Option('Tous les agents', ''));
    agents.forEach(agent => {
      if (agent.role === 'agent') {
        const name = agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email;
        sel.append(new Option(`${name} (${agent.email})`, agent.id));
      }
    });
    
    console.log('Agents chargés dans dashboard:', agents.length);
  } catch (e) {
    console.warn('admin/agents indisponible, masquer la liste');
    sel.append(new Option('Liste indisponible', ''));
  }
}

async function loadProjects() {
  const sel = $('project'); 
  if (!sel) return;
  
  sel.innerHTML = '';
  try {
    const result = await api('/admin/agents');
    const users = result.agents || result.data || result || [];

    if (!Array.isArray(users)) {
      console.error('Erreur: users n\'est pas un array:', users);
      return;
    }

    // Ne garder que les comptes rôle 'agent' et récupérer leur project_name propre
    const projects = new Set();
    users.forEach(user => {
      const role = (user.role || '').toLowerCase();
      const projectName = (user.project_name || '').trim();
      if (role === 'agent' && projectName) {
        projects.add(projectName);
      }
    });

    sel.append(new Option('Tous les projets', ''));
    Array.from(projects).sort((a,b)=>a.localeCompare(b)).forEach(project => {
      sel.append(new Option(project, project));
    });

    console.log('Projets chargés (agents) dans dashboard:', Array.from(projects));
  } catch(e) {
    console.error('Erreur chargement projets:', e); 
    sel.append(new Option('Erreur chargement projets', ''));
  }
}

// Configuration des gestionnaires d'événements pour les filtres
function setupFilterEventListeners() {
  const agentSelect = $('agent');
  const projectSelect = $('project');
  const dateSelect = $('date');
  
  if (agentSelect) {
    agentSelect.addEventListener('change', () => {
      console.log('Filtre agent changé:', agentSelect.value);
      applyFilters();
    });
  }
  
  if (projectSelect) {
    projectSelect.addEventListener('change', () => {
      console.log('Filtre projet changé:', projectSelect.value);
      applyFilters();
    });
  }
  
  if (dateSelect) {
    dateSelect.addEventListener('change', () => {
      console.log('Filtre date changé:', dateSelect.value);
      applyFilters();
    });
  }
  
  console.log('✅ Gestionnaires d\'événements des filtres configurés');
}

// Appliquer les filtres sélectionnés
async function applyFilters() {
  try {
    const agentId = $('agent')?.value || '';
    const projectName = $('project')?.value || '';
    const selectedDate = $('date')?.value || '';
    
    console.log('Application des filtres:', { agentId, projectName, selectedDate });
    
    // Recharger les données avec les filtres
    await refresh();
    
    // Mettre à jour le récapitulatif mensuel si une date est sélectionnée
    if (selectedDate) {
      await updateMonthlySummary();
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'application des filtres:', error);
  }
}

function openAgentModal(agent = null) {
  $('agent-modal-title').textContent = agent ? 'Modifier un Agent' : 'Créer un Agent';
  
  // Remplir les champs du formulaire
  $('af_id').value = agent?.id || '';
  $('af_name').value = agent?.name || '';
  $('af_email').value = agent?.email || '';
  $('af_password').value = '';
  $('af_password_confirm').value = '';
  $('af_role').value = agent?.role || 'agent';
  $('af_first_name').value = agent?.first_name || '';
  $('af_last_name').value = agent?.last_name || '';
  $('af_phone').value = agent?.phone || '';
  $('af_project').value = agent?.project_name || '';
  $('af_project_description').value = agent?.project_description || '';
  $('af_plan_start').value = agent?.planning_start_date || '';
  $('af_plan_end').value = agent?.planning_end_date || '';
  const defaultDays = appSettings?.['presence.expected_days_per_month'];
  const defaultHours = appSettings?.['presence.expected_hours_per_month'];
  $('af_expected_days').value = agent?.expected_days_per_month || (defaultDays ?? '');
  $('af_expected_hours').value = agent?.expected_hours_per_month || (defaultHours ?? '');
  $('af_work_schedule').value = agent?.work_schedule || '';
  $('af_contract_type').value = agent?.contract_type || '';
  $('af_tolerance').value = agent?.tolerance_radius_meters || '';
  $('af_ref_lat').value = agent?.reference_lat || '';
  $('af_ref_lon').value = agent?.reference_lon || '';
  $('af_gps_accuracy').value = agent?.gps_accuracy || 'medium';
  $('af_observations').value = agent?.observations || '';
  
  // Gérer la photo de profil
  updatePhotoPreview(agent?.photo_path);
  
  const modal = $('agent-modal');
  modal.classList.remove('hidden');
  
  // Charger cascades geo pour le modal immédiatement
  loadAfDepartements(agent?.village_path);
  
  // Ajouter un gestionnaire pour fermer le modal en cliquant à l'extérieur
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeAgentModal();
    }
  };
}

function closeAgentModal(){ 
  const modal = $('agent-modal');
  modal.classList.add('hidden');
  // Reset form
  document.getElementById('agent-form').reset();
  $('af_id').value = '';
  // Reset photo preview
  updatePhotoPreview(null);
}

async function loadAfDepartements(villagePath){
  console.log('🌍 Chargement des départements...');
  console.log('🔍 Recherche de l\'élément af_departement...');
  
  const depSel = $('af_departement'); 
  if (!depSel) {
    console.error('❌ Élément af_departement non trouvé');
    console.log('🔍 Éléments disponibles avec "af_":', document.querySelectorAll('[id^="af_"]'));
    return;
  }
  
  console.log('✅ Élément af_departement trouvé:', depSel);
  depSel.innerHTML='';
  
  try {
    console.log('🌐 Chargement des départements depuis geo-data.js...');
    
    if (typeof geoData !== 'undefined' && geoData.departements) {
      depSel.append(new Option('Sélectionner un département...', ''));
      for(const d of geoData.departements) {
        const option = new Option(d.name, d.id);
        depSel.append(option);
        console.log('➕ Option ajoutée:', d.name, d.id);
      }
      
      console.log('✅ Total options dans le select:', depSel.options.length);
    } else {
      console.error('❌ geoData non disponible');
      alert('Erreur: Données géographiques non disponibles');
    }
  } catch (error) {
    console.error('❌ Erreur lors du chargement des départements:', error);
    alert('Erreur lors du chargement des départements: ' + error.message);
  }
  
  // Reset other selects
  $('af_commune').innerHTML = '<option value="">Sélectionner une commune...</option>';
  $('af_arrondissement').innerHTML = '<option value="">Sélectionner un arrondissement...</option>';
  $('af_village').innerHTML = '<option value="">Sélectionner un village...</option>';
  $('af_commune').disabled = true; 
  $('af_arrondissement').disabled = true; 
  $('af_village').disabled = true;
  
  // Département change handler
  depSel.onchange = async ()=>{
    const id = Number(depSel.value); 
    const comSel = $('af_commune'); 
    comSel.innerHTML='<option value="">Sélectionner une commune...</option>';
    if(!id){ 
      comSel.disabled=true; 
      $('af_arrondissement').disabled=true; 
      $('af_village').disabled=true;
      return; 
    }
    try {
      // Utiliser les données statiques
      const departement = geoData.departements.find(d => d.id == id);
      if (departement && geoData.communes[departement.name]) {
        const communes = geoData.communes[departement.name];
        for(const c of communes) comSel.append(new Option(c.name, c.id));
        comSel.disabled=false; 
        $('af_arrondissement').disabled=true; 
        $('af_village').disabled=true;
      }
    } catch(e) {
      console.error('Error loading communes:', e);
      alert('Erreur lors du chargement des communes');
    }
  };
  
  // Commune change handler
  $('af_commune').onchange = async ()=>{
    const id = Number($('af_commune').value); 
    const arrSel = $('af_arrondissement'); 
    arrSel.innerHTML='<option value="">Sélectionner un arrondissement...</option>';
    if(!id){ 
      arrSel.disabled=true; 
      $('af_village').disabled=true;
      return; 
    }
    try {
      // Utiliser les données statiques
      let commune = null;
      for (const [deptName, communes] of Object.entries(geoData.communes)) {
        commune = communes.find(c => c.id == id);
        if (commune) break;
      }
      
      if (commune && geoData.arrondissements[commune.name]) {
        const arrondissements = geoData.arrondissements[commune.name];
        for(const a of arrondissements) arrSel.append(new Option(a.name, a.id));
        arrSel.disabled=false; 
        $('af_village').disabled=true;
      }
    } catch(e) {
      console.error('Error loading arrondissements:', e);
      alert('Erreur lors du chargement des arrondissements');
    }
  };
  
  // Arrondissement change handler
  $('af_arrondissement').onchange = async ()=>{
    const id = Number($('af_arrondissement').value); 
    const vilSel = $('af_village'); 
    vilSel.innerHTML='<option value="">Sélectionner un village...</option>';
    if(!id){ 
      vilSel.disabled=true;
      return; 
    }
    try {
      // Utiliser les données statiques
      let arrondissement = null;
      for (const [communeName, arrondissements] of Object.entries(geoData.arrondissements)) {
        arrondissement = arrondissements.find(a => a.id == id);
        if (arrondissement) break;
      }
      
      if (arrondissement && geoData.villages[arrondissement.name]) {
        const villages = geoData.villages[arrondissement.name];
        for(const v of villages) vilSel.append(new Option(v.name, v.id));
        vilSel.disabled=false;
      }
    } catch(e) {
      console.error('Error loading villages:', e);
      alert('Erreur lors du chargement des villages');
    }
  };
}

async function onAgentSubmit(ev){
  ev.preventDefault();
  
  // Valider les champs géographiques requis
  if (!validateGeoFieldsDashboard()) {
    return;
  }
  
  // Validation des mots de passe
  const password = $('af_password').value.trim();
  const passwordConfirm = $('af_password_confirm').value.trim();
  
  if (password && password !== passwordConfirm) {
    alert('Les mots de passe ne correspondent pas');
    return;
  }
  
  const id = $('af_id').value.trim();
  
  // Préparer les données JSON
  const payload = {
    name: $('af_name').value.trim(),
    email: $('af_email').value.trim(),
    role: $('af_role').value,
    phone: $('af_phone').value.trim() || undefined,
    first_name: $('af_first_name').value.trim() || undefined,
    last_name: $('af_last_name').value.trim() || undefined,
    project_name: $('af_project').value.trim() || undefined,
    project_description: $('af_project_description').value.trim() || undefined,
    planning_start_date: $('af_plan_start').value || undefined,
    planning_end_date: $('af_plan_end').value || undefined,
    // Utiliser les valeurs géographiques (select ou manuel)
    departement: getGeoValueDashboard('af_departement'),
    commune: getGeoValueDashboard('af_commune'),
    arrondissement: getGeoValueDashboard('af_arrondissement'),
    village: getGeoValueDashboard('af_village'),
    village_id: $('af_village').value ? Number($('af_village').value) : undefined,
    expected_days_per_month: $('af_expected_days').value ? Number($('af_expected_days').value) : undefined,
    expected_hours_per_month: $('af_expected_hours').value ? Number($('af_expected_hours').value) : undefined,
    work_schedule: $('af_work_schedule').value.trim() || undefined,
    contract_type: $('af_contract_type').value || undefined,
    tolerance_radius_meters: $('af_tolerance').value ? Number($('af_tolerance').value) : undefined,
    reference_lat: $('af_ref_lat').value ? Number($('af_ref_lat').value) : undefined,
    reference_lon: $('af_ref_lon').value ? Number($('af_ref_lon').value) : undefined,
    gps_accuracy: $('af_gps_accuracy').value || undefined,
    observations: $('af_observations').value.trim() || undefined
  };
  
  // Gestion du mot de passe
  if (password) {
    payload.password = password;
  } else if (!id) {
    payload.password = 'Agent@123';
  }
  
  console.log('📤 Envoi des données agent:', payload);
  console.log('🔑 JWT token:', jwt ? 'présent' : 'absent');
  
  try {
    const url = `/api/admin/agents${id ? '/' + id : ''}`;
    const body = JSON.stringify(payload);
    
    console.log('🌐 URL:', url);
    console.log('📦 Body JSON:', body);
    
    const response = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + jwt
      },
      body: body
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }
    
    closeAgentModal();
    await loadAgents();
    alert('Agent enregistré avec succès !');
  } catch(e){ 
    console.error('Error saving agent:', e);
    alert('Erreur enregistrement agent: ' + (e.message||'Erreur')); 
  }
}

// Fonction d'initialisation locale des sélecteurs géographiques
function initGeoSelectorsLocal() {
  console.log('🌍 Initialisation locale des sélecteurs géographiques dans dashboard...');
  
  // Charger les départements
  loadDepartements();
  
  // Ajouter les événements
  const departementSelect = $('departement');
  const communeSelect = $('commune');
  const arrondissementSelect = $('arrondissement');
  
  if (departementSelect) {
    departementSelect.addEventListener('change', function() {
      loadCommunes(this.value);
    });
  }
  
  if (communeSelect) {
    communeSelect.addEventListener('change', function() {
      loadArrondissements(this.value);
    });
  }
  
  if (arrondissementSelect) {
    arrondissementSelect.addEventListener('change', function() {
      loadVillages(this.value);
    });
  }
  
  console.log('✅ Sélecteurs géographiques initialisés localement dans dashboard');
}

// Fonctions de chargement des données géographiques
async function loadDepartements() {
  try {
    const deptSelect = $('departement');
    if (!deptSelect) return;
    
    deptSelect.innerHTML = '<option value="">Sélectionner un département</option>';
    
    // Attendre que geo-data.js soit prêt (mobile/PWA peut retarder le chargement)
    for (let i = 0; i < 10 && !(window.geoData && window.geoData.departements && window.geoData.departements.length); i++) {
      await new Promise(r => setTimeout(r, 300));
    }

    // Utiliser les données de geo-data.js
    if (window.geoData && window.geoData.departements && window.geoData.departements.length) {
      window.geoData.departements.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name;
        deptSelect.appendChild(opt);
      });
      console.log('✅ Départements chargés depuis geo-data.js:', window.geoData.departements.length);
    } else {
      console.error('❌ Données géographiques locales non disponibles');
      // Fallback sécurisé: lister les 12 départements du Bénin si geoData indisponible (mobile)
      const fallback = [
        { id: 1, name: 'Alibori' }, { id: 2, name: 'Atacora' }, { id: 3, name: 'Atlantique' },
        { id: 4, name: 'Borgou' }, { id: 5, name: 'Collines' }, { id: 6, name: 'Couffo' },
        { id: 7, name: 'Donga' }, { id: 8, name: 'Littoral' }, { id: 9, name: 'Mono' },
        { id: 10, name: 'Ouémé' }, { id: 11, name: 'Plateau' }
      ];
      fallback.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name;
        deptSelect.appendChild(opt);
      });
      console.log('✅ Départements chargés (fallback mobile):', fallback.length);
    }
  } catch (error) {
    console.error('Erreur chargement départements:', error);
  }
}

async function loadCommunes(departementId) {
  try {
    const communeSelect = $('commune');
    if (!communeSelect) return;
    
    communeSelect.innerHTML = '<option value="">Sélectionner une commune</option>';
    
    // Utiliser les données de geo-data.js qui utilisent des IDs numériques
    if (window.geoData && window.geoData.communes && window.geoData.communes[departementId]) {
      const communes = window.geoData.communes[departementId];
      communes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        communeSelect.appendChild(opt);
      });
      console.log('✅ Communes chargées depuis geo-data.js:', communes.length, 'pour département ID:', departementId);
    } else {
      console.error('❌ Communes non disponibles pour le département ID:', departementId);
    }
    
    // Réinitialiser les niveaux suivants
    $('arrondissement').innerHTML = '<option value=``>Sélectionner un arrondissement</option>';
    $('village').innerHTML = '<option value=``>Sélectionner un village</option>';
  } catch (error) {
    console.error('Erreur chargement communes:', error);
  }
}

async function loadArrondissements(communeId) {
  try {
    const arrSelect = $('arrondissement');
    if (!arrSelect) return;
    
    arrSelect.innerHTML = '<option value="">Sélectionner un arrondissement</option>';
    
    // Utiliser les données de geo-data.js qui utilisent des IDs numériques
    if (window.geoData && window.geoData.arrondissements && window.geoData.arrondissements[communeId]) {
      const arrondissements = window.geoData.arrondissements[communeId];
      arrondissements.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name;
        arrSelect.appendChild(opt);
      });
      console.log('✅ Arrondissements chargés depuis geo-data.js:', arrondissements.length, 'pour commune ID:', communeId);
    } else {
      console.error('❌ Arrondissements non disponibles pour la commune ID:', communeId);
    }
    
    // Réinitialiser le niveau suivant
    $('village').innerHTML = '<option value="">Sélectionner un village</option>';
  } catch (error) {
    console.error('Erreur chargement arrondissements:', error);
  }
}

async function loadVillages(arrondissementId) {
  try {
    const villageSelect = $('village');
    if (!villageSelect) return;
    
    villageSelect.innerHTML = '<option value="">Sélectionner un village</option>';
    
    // Utiliser les données de geo-data.js qui utilisent des IDs numériques
    if (window.geoData && window.geoData.villages && window.geoData.villages[arrondissementId]) {
      const villages = window.geoData.villages[arrondissementId];
      villages.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        villageSelect.appendChild(opt);
      });
      console.log('✅ Villages chargés depuis geo-data.js:', villages.length, 'pour arrondissement ID:', arrondissementId);
    } else {
      console.error('❌ Villages non disponibles pour l\'arrondissement ID:', arrondissementId);
    }
  } catch (error) {
    console.error('Erreur chargement villages:', error);
  }
}

async function refresh() {
  const overlay = document.getElementById('map-loading');
  if (overlay) overlay.classList.add('active');
  try {
  try { if (markersLayer && markersLayer.clearLayers) markersLayer.clearLayers(); } catch {}
  const tlContainer = $('timeline');
  if (tlContainer) tlContainer.innerHTML = '';
  const date = $('date').value || undefined;
  const agentId = $('agent').value ? Number($('agent').value) : undefined;
  const projectName = $('project').value || undefined;
  const villageId = $('village').value ? Number($('village').value) : undefined;
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (agentId) params.set('agent_id', String(agentId));
  if (projectName) params.set('project_name', projectName);
  if (villageId) params.set('village_id', String(villageId));
  const useLatest = !date && !agentId && !projectName && !villageId;
  let rows;
  try {
    // Utiliser l'endpoint admin pour récupérer les vrais check-ins de la table checkins
    console.log('📋 Récupération des check-ins depuis la table checkins...');
    const resp = await api('/admin/checkins/latest');
    console.log('📦 Réponse check-ins:', resp);
    
    const checkins = resp?.data?.items || resp?.checkins || [];
    console.log('📋 Check-ins extraits:', checkins.length);
    
    rows = checkins
      .filter(checkin => {
        const hasCoords = Number.isFinite(Number(checkin.lat)) && Number.isFinite(Number(checkin.lon));
        console.log(`🔍 Check-in ${checkin.id}: coordonnées valides =`, hasCoords, `(${checkin.lat}, ${checkin.lon})`);
        
        // Filtrage par agent si spécifié
        if (agentId && checkin.missions?.agent_id !== agentId) {
          return false;
        }
        
        // Filtrage par projet si spécifié
        if (projectName && checkin.missions?.users?.project_name !== projectName) {
          return false;
        }
        
        return hasCoords;
      })
      .map(checkin => {
        const agentName = checkin.missions?.users?.name || 'Agent';
        const checkinType = checkin.type || 'checkin';
        const typeLabel = checkinType === 'start_mission' ? 'Début mission' : 
                         checkinType === 'mission_start' ? 'Départ' : 
                         checkinType === 'mission_end' ? 'Fin mission' : 'Check-in';
        return {
          lat: Number(checkin.lat),
          lon: Number(checkin.lon),
          timestamp: checkin.timestamp || checkin.created_at,
          agent_name: agentName,
          user_id: checkin.missions?.agent_id || checkin.mission_id,
          type: checkinType,
          note: `${typeLabel} - ${agentName}${checkin.note ? `: ${checkin.note}` : ''}`
        };
      });
    
    console.log('✅ Check-ins traités pour timeline:', rows.length);
  } catch (e) {
    console.warn('API /presence indisponible, tentative /admin/checkins puis Supabase:', e.message || e);
    try {
      if (useLatest) {
        const resp = await api('/admin/checkins/latest');
        const arr = resp?.data?.items || resp?.checkins || [];
        rows = Array.isArray(arr) ? arr : [];
      } else {
        const resp = await api('/admin/checkins?' + params.toString());
        rows = resp?.data?.items || [];
      }
    } catch {}
    // Fallback authentifié: checkins de l'agent courant si l'endpoint admin est refusé
    try {
      if (!rows || rows.length === 0) {
        const q2 = new URLSearchParams();
        if (date) {
          const d = new Date(date + 'T00:00:00');
          const start = new Date(d);
          const end = new Date(d); end.setDate(end.getDate() + 1);
          q2.set('from', start.toISOString());
          q2.set('to', end.toISOString());
        }
        const mine = await api('/checkins/mine' + (q2.toString() ? ('?' + q2.toString()) : ''));
        const items = mine?.items || mine?.data?.items || [];
        if (Array.isArray(items)) {
          rows = items.map(r => ({
            lat: typeof r.lat === 'number' ? r.lat : Number(r.lat),
            lon: typeof r.lon === 'number' ? r.lon : Number(r.lon),
            timestamp: r.timestamp,
            agent_name: r.agent_name || (currentProfile?.name || 'Moi'),
          })).filter(x => isFinite(x.lat) && isFinite(x.lon));
        }
      }
    } catch {}
    // Fallback Supabase direct si configuré
    try {
      if (!rows || rows.length === 0) {
        const sbRows = await fetchCheckinsFromSupabase({
          date: $('date').value || undefined,
          agentId: $('agent').value ? Number($('agent').value) : undefined,
          villageId: $('village').value ? Number($('village').value) : undefined,
        });
        if (Array.isArray(sbRows)) {
          rows = sbRows.map(r => ({
            lat: r.lat,
            lon: r.lon,
            timestamp: r.timestamp,
            agent_name: r.agent_name || r.user_id,
          }));
        }
      }
    } catch {}
  }

  // Vider la timeline avant d'ajouter de nouveaux éléments
  const timelineContainer = $('timeline');
  if (timelineContainer) {
    console.log('🧹 Vidage de la timeline avant ajout');
    timelineContainer.innerHTML = '';
  }
  
  console.log('📋 Génération timeline avec', rows?.length || 0, 'éléments');
  console.log('📋 Données pour timeline:', rows);

  const latlngs = [];
  for (const r of rows) {
    if (typeof r.lat !== 'number' || typeof r.lon !== 'number') continue;
    if (basemapType !== 'google' && markersLayer) {
      const m = L.marker([r.lat, r.lon]).bindPopup(`<b>${r.agent_name}</b><br>${r.timestamp}`);
      markersLayer.addLayer(m);
    }
    latlngs.push([r.lat, r.lon]);

    const li = document.createElement('li');
    li.textContent = `${r.timestamp} - ${r.agent_name} - (${r.lat.toFixed(5)}, ${r.lon.toFixed(5)})`;
    console.log('📋 Ajout à timeline:', li.textContent);
    $('timeline').appendChild(li);
  }
  if (latlngs.length) {
    if (basemapType === 'google' && gmap) {
      const bounds = new google.maps.LatLngBounds();
      latlngs.forEach(([lat, lon]) => bounds.extend({ lat, lng: lon }));
      gmap.fitBounds(bounds, 50);
    } else if (map) {
      map.fitBounds(latlngs, { padding: [20, 20] });
    }
  }

  // Mettre à jour le récapitulatif mensuel
  try { await updateMonthlySummary(); } catch(e){ console.warn('monthly summary:', e); }
  
  // Rafraîchir les check-ins sur la carte (avec délai pour s'assurer que la carte est prête)
  try { 
    console.log('🔄 Appel de loadCheckinsOnMap depuis refresh()...');
    // Attendre un peu pour que la carte soit prête
    setTimeout(async () => {
      try {
        await loadCheckinsOnMap();
      } catch(e) {
        console.error('❌ Erreur loadCheckinsOnMap (délai):', e);
      }
    }, 1000);
  } catch(e){ 
    console.error('❌ Erreur loadCheckinsOnMap depuis refresh():', e); 
  }
  } finally {
    if (overlay) overlay.classList.remove('active');
  }
}

// Réagir aux mises à jour de présence depuis d'autres pages (start/checkin/end/complete)
try {
  let isNavigatingAway = false;
  
  // Détecter quand l'utilisateur navigue vers une autre page
  window.addEventListener('beforeunload', () => {
    isNavigatingAway = true;
  });
  
  window.addEventListener('storage', async (e) => {
    try {
      if (e && e.key === 'presence_update' && !isNavigatingAway) {
        // Vérifier si on est toujours sur la page dashboard
        if (window.location.pathname.includes('dashboard')) {
          console.log('🔄 Mise à jour de présence détectée, rafraîchissement du dashboard...');
          await refresh();
          await loadCheckinsOnMap();
        }
      }
    } catch {}
  });
} catch (e) {
  console.warn('Erreur lors de l\'ajout du listener storage:', e);
}

// Générer le rapport mensuel
generateMonthlyReport = async function() {
  const month = document.getElementById('report-month').value;
  if (!month) {
    alert('Veuillez sélectionner un mois');
    return;
  }
  
  try {
    await api('/admin/generate-monthly-report', { method: 'POST', body: { month_year: month } });
      alert('Rapport mensuel généré avec succès !');
  } catch (e) {
    console.error('Error generating report:', e);
    alert('Erreur lors de la génération du rapport');
  }
}

// Mettre à jour la fonction sur window
if (typeof window !== 'undefined') {
  window.generateMonthlyReport = generateMonthlyReport;
}

// Exporter le rapport mensuel
exportMonthlyReport = async function() {
  const month = document.getElementById('report-month').value;
  if (!month) {
    alert('Veuillez sélectionner un mois');
    return;
  }
  
  try {
    const response = await fetch(`${apiBase}/admin/export/monthly-report.csv?month=${month}`, { headers: { 'Authorization': 'Bearer ' + jwt } });
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-presence-${month}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      alert('Erreur lors de l\'export');
    }
  } catch (e) {
    console.error('Error exporting report:', e);
    alert('Erreur lors de l\'export');
  }
}

// Mettre à jour la fonction sur window
if (typeof window !== 'undefined') {
  window.exportMonthlyReport = exportMonthlyReport;
}

// Créer un agent de test
createTestAgent = async function() {
  if (!confirm('Créer un agent de test avec des données complètes ?\nEmail: agent@test.com\nMot de passe: Test@123')) {
    return;
  }
  
  try {
    const result = await api('/admin/create-test-agent', { method: 'POST' });
    alert(`Agent de test créé avec succès !\nID: ${result.agent_id}\nVous pouvez maintenant vous connecter avec:\nEmail: agent@test.com\nMot de passe: Test@123`);
    await loadAgents(); // Recharger la liste des agents
  } catch (e) {
    console.error('Error creating test agent:', e);
    alert('Erreur lors de la création de l\'agent de test');
  }
}

// Mettre à jour la fonction sur window
if (typeof window !== 'undefined') {
  window.createTestAgent = createTestAgent;
}

// Configurer les points de référence pour tous les agents
setupReferencePoints = async function() {
  const toleranceRadius = prompt('Rayon de tolérance en mètres (défaut: 50000 = 50km):', '50000');
  if (!toleranceRadius) return;
  
  const radius = parseInt(toleranceRadius);
  if (isNaN(radius) || radius <= 0) {
    alert('Veuillez entrer un nombre valide pour le rayon de tolérance');
    return;
  }
  
  if (!confirm(`Configurer les points de référence pour tous les agents avec un rayon de ${radius}m (${radius/1000}km) ?`)) {
    return;
  }
  
  try {
    const result = await api('/admin/setup-reference-points', { 
      method: 'POST', 
      body: { toleranceRadius: radius } 
    });
    alert(`Configuration réussie !\n${result.message}\n\nAgents mis à jour: ${result.updated_count}/${result.total_agents}`);
  } catch (e) {
    console.error('Error setting up reference points:', e);
    alert('Erreur lors de la configuration des points de référence');
  }
}

// Mettre à jour la fonction sur window
if (typeof window !== 'undefined') {
  window.setupReferencePoints = setupReferencePoints;
}

// Fonction de déconnexion
function logout() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    localStorage.removeItem('jwt');
    window.location.href = window.location.origin + '/';
  }
}

// Exposer la fonction de déconnexion
if (typeof window !== 'undefined') {
  window.logout = logout;
}

// Fonctions pour la gestion des photos
function updatePhotoPreview(photoPath) {
  const previewImg = $('photo-preview-img');
  const placeholder = $('photo-placeholder');
  const removeBtn = $('btn-photo-remove');
  
  if (!previewImg || !placeholder || !removeBtn) {
    console.warn('Éléments photo non trouvés, ignoré');
    return;
  }
  
  if (photoPath) {
    previewImg.src = photoPath;
    previewImg.style.display = 'block';
    placeholder.style.display = 'none';
    removeBtn.style.display = 'block';
  } else {
    previewImg.src = '/Media/default-avatar.svg';
    previewImg.style.display = 'none';
    placeholder.style.display = 'flex';
    removeBtn.style.display = 'none';
  }
}

function removePhoto() {
  $('af_photo').value = '';
  updatePhotoPreview(null);
}

// Gestion de l'upload de photo
document.addEventListener('DOMContentLoaded', function() {
  const photoInput = $('af_photo');
  if (photoInput) {
    photoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          updatePhotoPreview(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    });
  }
});

// Configuration de la navigation circulaire selon le rôle
async function setupCircularNavigation() {
  try {
    console.log('🎯 Configuration de la navigation circulaire...');
    
    // Récupérer le profil utilisateur
    const profile = await getProfile();
    const userRole = profile?.role || 'agent';
    
    console.log('👤 Rôle utilisateur:', userRole);
    
    // Définir les accès par rôle
    const roleAccess = {
      agent: ['presence-link', 'planning-link', 'dashboard-link', 'profile-link'],
      supervisor: ['presence-link', 'planning-link', 'dashboard-link', 'profile-link', 'agents-link', 'reports-link'],
      admin: ['presence-link', 'planning-link', 'dashboard-link', 'profile-link', 'agents-link', 'reports-link', 'admin-link', 'help-link']
    };
    
    const allowedActions = roleAccess[userRole] || roleAccess.agent;
    console.log('✅ Actions autorisées:', allowedActions);
    
    // Afficher/masquer les boutons selon le rôle
    const circleActions = document.getElementById('circle-actions');
    if (circleActions) {
      const allActions = circleActions.querySelectorAll('.circle-action');
      
      allActions.forEach(action => {
        const actionId = action.id;
        if (allowedActions.includes(actionId)) {
          action.style.display = 'flex';
        } else {
          action.style.display = 'none';
        }
      });
      
      // Afficher la navigation
      circleActions.style.display = 'flex';
      console.log('🎯 Navigation circulaire configurée pour le rôle:', userRole);
    }
    
  } catch (error) {
    console.error('❌ Erreur configuration navigation:', error);
    // En cas d'erreur, afficher seulement les actions de base
    const circleActions = document.getElementById('circle-actions');
    if (circleActions) {
      const basicActions = ['presence-link', 'dashboard-link', 'profile-link'];
      const allActions = circleActions.querySelectorAll('.circle-action');
      
      allActions.forEach(action => {
        const actionId = action.id;
        action.style.display = basicActions.includes(actionId) ? 'flex' : 'none';
      });
      
      circleActions.style.display = 'flex';
    }
  }
}

// Exposer les fonctions globalement
if (typeof window !== 'undefined') {
  window.updatePhotoPreview = updatePhotoPreview;
  window.removePhoto = removePhoto;
  window.testLoadDepartements = loadAfDepartements;
  window.testApi = () => console.log('geoData disponible:', typeof geoData !== 'undefined');
  window.setupCircularNavigation = setupCircularNavigation;
}

// Mettre à jour les informations utilisateur dans la navbar
async function updateUserInfo() {
  try {
    const profile = await getProfile();
    const userInfo = document.getElementById('user-info');
    if (userInfo && profile) {
      userInfo.textContent = `${profile.name} (${profile.role})`;
    }
  } catch (e) {
    console.error('Error updating user info:', e);
  }
}

// Affichage d'une alerte explicite en haut de page pour erreurs d'accès
function handleDashboardError(error) {
  try {
    const container = document.querySelector('.main-content') || document.body;
    let banner = document.getElementById('dashboard-alert');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dashboard-alert';
      banner.style.cssText = 'margin:12px 0;padding:12px 16px;border-radius:8px;background:#fff3cd;color:#664d03;border:1px solid #ffe69c;';
      container.prepend(banner);
    }
    const status = error && (error.status || error.code);
    if (status === 401) {
      banner.innerHTML = '🔒 Accès requis: veuillez vous connecter en tant qu\'admin/superviseur. Ouvrez la page d\'accueil, connectez-vous puis revenez sur le Dashboard.';
    } else {
      banner.textContent = '⚠️ Impossible de charger les check-ins pour le moment. Réessayez après connexion ou plus tard.';
    }
  } catch {}
}

// Gérer l'accès au dashboard selon le rôle
async function checkDashboardAccess() {
  // Mode libre: toujours autoriser l'accès au dashboard
  return true;
}

// Fonctions pour la saisie manuelle des unités géographiques (Dashboard)
function setupManualGeoInputsDashboard() {
  console.log('🔧 Configuration de la saisie manuelle des unités géographiques (Dashboard)...');
  
  // Configuration des boutons de basculement pour les champs agent
  const geoFields = ['af_departement', 'af_commune', 'af_arrondissement', 'af_village'];
  
  geoFields.forEach(field => {
    const select = $(field);
    const manualInput = $(`${field}-manual`);
    const toggleBtn = $(`toggle-${field}`);
    
    if (select && manualInput && toggleBtn) {
      // Gestionnaire pour le bouton de basculement
      toggleBtn.addEventListener('click', () => {
        const isManual = manualInput.style.display !== 'none';
        
        if (isManual) {
          // Passer en mode sélection
          select.style.display = 'block';
          manualInput.style.display = 'none';
          toggleBtn.textContent = '✏️';
          toggleBtn.classList.remove('active');
          select.disabled = false;
        } else {
          // Passer en mode saisie manuelle
          select.style.display = 'none';
          manualInput.style.display = 'block';
          toggleBtn.textContent = '📋';
          toggleBtn.classList.add('active');
          select.disabled = true;
          manualInput.focus();
        }
      });
      
      // Synchroniser les valeurs entre select et input manuel
      select.addEventListener('change', () => {
        if (manualInput.style.display === 'none') {
          manualInput.value = select.options[select.selectedIndex]?.text || '';
        }
      });
      
      manualInput.addEventListener('input', () => {
        if (select.style.display === 'none') {
          // Trouver l'option correspondante dans le select
          const options = Array.from(select.options);
          const matchingOption = options.find(option => 
            option.text.toLowerCase().includes(manualInput.value.toLowerCase())
          );
          
          if (matchingOption) {
            select.value = matchingOption.value;
          }
        }
      });
    }
  });
}

// Fonction pour obtenir la valeur géographique (select ou manuel) - Dashboard
function getGeoValueDashboard(field) {
  const select = $(field);
  const manualInput = $(`${field}-manual`);
  
  if (manualInput && manualInput.style.display !== 'none' && manualInput.value.trim()) {
    return manualInput.value.trim();
  } else if (select && select.value) {
    return select.options[select.selectedIndex]?.text || select.value;
  }
  
  return '';
}

// Fonction pour valider les champs géographiques requis - Dashboard
function validateGeoFieldsDashboard() {
  const departement = getGeoValueDashboard('af_departement');
  
  if (!departement.trim()) {
    alert('❌ Veuillez sélectionner ou saisir un département');
    return false;
  }
  
  return true;
}

// Initialiser la saisie manuelle au chargement du dashboard
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    setupManualGeoInputsDashboard();
  }, 1000);
  
  // Ajouter un gestionnaire pour le logo
  const logo = document.querySelector('.navbar-logo');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🏠 Clic sur logo - redirection vers home');
      window.location.href = '/home.html';
    });
  }
});

// Exposer les fonctions globalement
window.getGeoValueDashboard = getGeoValueDashboard;
window.validateGeoFieldsDashboard = validateGeoFieldsDashboard;
window.setupManualGeoInputsDashboard = setupManualGeoInputsDashboard;

// Fonction pour ajouter un point de début de mission
function addStartMissionPoint() {
  getBestLocationDashboard().then(async (coords) => {
    try {
      const latitude = coords?.latitude;
      const longitude = coords?.longitude;
      const accuracy = Math.round(coords?.accuracy || 0);
      
      // Créer un marqueur temporaire pour confirmer l'emplacement
      if (map) {
        const tempMarker = L.circleMarker([latitude, longitude], {
          radius: 10,
          fillColor: '#ff6b6b',
          color: '#ff0000',
          weight: 3,
          opacity: 0.8,
          fillOpacity: 0.6
        }).addTo(map);
        
        tempMarker.bindPopup(`
          <div style="min-width: 200px;">
            <h6><strong>Nouveau point de début</strong></h6>
            <p><strong>Agent:</strong> ${currentProfile?.name || 'Moi'}</p>
            <p><strong>Position:</strong> ${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
            <p><strong>Précision:</strong> ±${accuracy}m</p>
            <br>
            <button onclick="confirmStartPoint(${latitude}, ${longitude}, ${accuracy})" class="btn btn-success btn-sm">
              ✅ Confirmer
            </button>
            <button onclick="cancelStartPoint()" class="btn btn-danger btn-sm">
              ❌ Annuler
            </button>
          </div>
        `).openPopup();
        
        // Centrer la carte sur le point
        map.setView([latitude, longitude], 15);
      }
    } catch (error) {
      console.error('Erreur lors de l\'obtention de la position:', error);
      alert('Erreur lors de l\'obtention de votre position');
    }
  }, (error) => {
    console.error('Erreur géolocalisation:', error);
    alert('Impossible d\'obtenir votre position. Vérifiez que la géolocalisation est activée.');
  });
}

// Fonction pour confirmer l'ajout du point
function confirmStartPoint(lat, lon, accuracy) {
  if (confirm(`Confirmer l'ajout du point de début de mission à cette position ?\nLat: ${lat.toFixed(6)}\nLon: ${lon.toFixed(6)}`)) {
    // Ici nous pourrions ajouter le point à la base de données
    // Pour l'instant, on recharge simplement la carte
    loadCheckinsOnMap();
    alert('Point de début ajouté !');
  }
}

// Fonction pour annuler l'ajout du point
function cancelStartPoint() {
  // Supprimer les marqueurs temporaires
  if (map) {
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker && layer.options.fillColor === '#ff6b6b') {
        map.removeLayer(layer);
      }
    });
  }
}

// Fonction pour créer le bouton d'ajout de point
function createAddStartPointButton() {
  // Vérifier si le bouton existe déjà
  if (document.getElementById('add-presence-point-btn')) return;
  
  const button = document.createElement('button');
  button.id = 'add-presence-point-btn';
  button.className = 'btn btn-primary btn-sm';
  button.innerHTML = '📍 Ajouter présence';
  button.style.position = 'absolute';
  button.style.top = '10px';
  button.style.right = '10px';
  button.style.zIndex = '1000';
  button.style.fontSize = '12px';
  button.style.padding = '8px 12px';
  button.onclick = addStartMissionPoint;
  
  // Ajouter le bouton à la carte
  const mapContainer = document.getElementById('map');
  if (mapContainer) {
    mapContainer.appendChild(button);
  }
}

// Exposer les nouvelles fonctions
window.addStartMissionPoint = addStartMissionPoint;
window.confirmStartPoint = confirmStartPoint;
window.cancelStartPoint = cancelStartPoint;
window.createAddStartPointButton = createAddStartPointButton;

// Boutons Début/Fin mission sur la carte (dashboard)
function createDashboardPresenceButtons() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;
  if (document.getElementById('dash-start-btn')) return;

  const wrap = document.createElement('div');
  wrap.style.position = 'absolute';
  wrap.style.top = '10px';
  wrap.style.left = '10px';
  wrap.style.zIndex = '1000';
  wrap.style.display = 'flex';
  wrap.style.gap = '8px';

  const startBtn = document.createElement('button');
  startBtn.id = 'dash-start-btn';
  startBtn.className = 'btn btn-success btn-sm';
  startBtn.textContent = 'Début mission';
  startBtn.onclick = startMissionFromDashboard;

  const endBtn = document.createElement('button');
  endBtn.id = 'dash-end-btn';
  endBtn.className = 'btn btn-danger btn-sm';
  endBtn.textContent = 'Fin mission';
  endBtn.onclick = endMissionFromDashboard;

  wrap.appendChild(startBtn);
  wrap.appendChild(endBtn);
  mapContainer.appendChild(wrap);
}

async function startMissionFromDashboard() {
  try {
    const coords = await getBestLocationDashboard();

    const fd = new FormData();
    if (coords) {
      fd.append('lat', String(coords.latitude));
      fd.append('lon', String(coords.longitude));
      if (typeof coords.accuracy !== 'undefined') fd.append('accuracy', String(Math.round(coords.accuracy)));
    }
    fd.append('note', 'Début mission (dashboard)');

    await api('/presence/start', { method: 'POST', body: fd });
    try { notifyPresenceUpdate('start'); } catch {}
    await refresh();
    await loadCheckinsOnMap();
    alert('Début de mission enregistré');
  } catch (e) {
    console.error('startMissionFromDashboard error:', e);
    alert('Erreur début mission: ' + (e?.message || e));
  }
}

async function endMissionFromDashboard() {
  try {
    const coords = await getBestLocationDashboard();

    const fd = new FormData();
    if (coords) {
      fd.append('lat', String(coords.latitude));
      fd.append('lon', String(coords.longitude));
      if (typeof coords.accuracy !== 'undefined') fd.append('accuracy', String(Math.round(coords.accuracy)));
    }
    fd.append('note', 'Fin mission (dashboard)');

    await api('/presence/end', { method: 'POST', body: fd });
    try { notifyPresenceUpdate('end'); } catch {}
    await refresh();
    await loadCheckinsOnMap();
    alert('Fin de mission enregistrée');
  } catch (e) {
    console.error('endMissionFromDashboard error:', e);
    alert('Erreur fin mission: ' + (e?.message || e));
  }
}

if (typeof window !== 'undefined') {
  window.createDashboardPresenceButtons = createDashboardPresenceButtons;
}

init();

// Utiliser le même algorithme de position que la page principale (meilleure précision)
async function getBestLocationDashboard() {
  try {
    // Essayer d'abord la dernière position validée stockée
    const last = JSON.parse(localStorage.getItem('lastGPS') || '{}');
    if (isFinite(last.lat) && isFinite(last.lon) && isFinite(last.accuracy)) {
      // En parallèle, tenter une mise à jour rapide
      try {
        navigator.geolocation.getCurrentPosition(p => {
          try {
            localStorage.setItem('lastGPS', JSON.stringify({
              lat: Number(p.coords.latitude),
              lon: Number(p.coords.longitude),
              accuracy: Number(p.coords.accuracy || 0),
              timestamp: Date.now()
            }));
          } catch {}
        }, () => {}, { enableHighAccuracy: true, timeout: 8000 });
      } catch {}
      return { latitude: Number(last.lat), longitude: Number(last.lon), accuracy: Number(last.accuracy) };
    }
  } catch {}

  // Sinon, demander une position haute précision
  const coords = await new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => resolve(p.coords),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });

  if (coords && isFinite(coords.latitude) && isFinite(coords.longitude)) {
    try {
      localStorage.setItem('lastGPS', JSON.stringify({
        lat: Number(coords.latitude),
        lon: Number(coords.longitude),
        accuracy: Number(coords.accuracy || 0),
        timestamp: Date.now()
      }));
    } catch {}
    return coords;
  }

  // Fallback Bénin si rien
  return { latitude: 9.3077, longitude: 2.3158, accuracy: 1000 };
}
