// Script pour la page de rapports - Version Backend uniquement
// Utilise /api/reports au lieu de Supabase directement

let jwt = localStorage.getItem('jwt') || '';
let currentUser = null;
let presenceLineChart = null;
let rolePieChart = null;

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || '';
}

function getEmailHint() {
  return getQueryParam('email') || localStorage.getItem('email') || localStorage.getItem('user_email') || localStorage.getItem('userEmail') || '';
}

function $(id) { return document.getElementById(id); }

const apiBase = '/api';

async function api(path, opts = {}) {
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
    console.error('API error:', errorText);
    throw new Error(errorText || res.statusText);
  }
  
  const ct = res.headers.get('content-type') || '';
  const result = ct.includes('application/json') ? await res.json() : await res.text();
  console.log('API result:', result);
  return result;
}

// Vérifier l'authentification et les permissions
async function checkAuth() {
  const emailHint = getEmailHint();
  if (!emailHint) {
    console.warn('Aucun email trouvé, mode lecture seule');
    return false;
  }

  try {
    const result = await api('/profile?email=' + encodeURIComponent(emailHint));
    if (result && result.user) {
      currentUser = result.user;
      console.log('Utilisateur connecté:', currentUser.name, currentUser.role);
      return true;
    }
  } catch (error) {
    console.warn('Impossible de vérifier l\'authentification:', error.message);
  }
  
  return false;
}

// === Utilitaires période ===
function getRangeDatesFromUI() {
  const range = document.getElementById('date-range')?.value || 'month';
  const fmt = d => d.toISOString().split('T')[0];
  const today = new Date();
  const precise = (document.getElementById('date-filter')?.value || '').trim();
  if (precise) return { start: precise, end: precise };
  
  if (range === 'today') return { start: fmt(today), end: fmt(today) };
  if (range === 'week') {
    const s = new Date(today);
    s.setDate(today.getDate() - 6);
    return { start: fmt(s), end: fmt(today) };
  }
  if (range === 'month') {
    const s = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: fmt(s), end: fmt(today) };
  }
  if (range === 'custom') {
    const s = document.getElementById('start-date')?.value || null;
    const e = document.getElementById('end-date')?.value || null;
    return { start: s, end: e };
  }
  return { start: null, end: null };
}

function periodToISO(start, end) {
  const fromISO = start ? new Date(start + 'T00:00:00Z').toISOString() : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const toISO = end ? new Date(end + 'T23:59:59Z').toISOString() : new Date().toISOString();
  return { fromISO, toISO };
}

// === Fonctions exposées globalement ===
window.updateDateInputs = function() {
  const g1 = document.getElementById('custom-date-group');
  const g2 = document.getElementById('custom-date-group-end');
  if (!g1 || !g2) return;
  
  const show = (document.getElementById('date-range')?.value === 'custom');
  g1.style.display = show ? 'block' : 'none';
  g2.style.display = show ? 'block' : 'none';
  
  if (show) {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    document.getElementById('end-date').value = today.toISOString().split('T')[0];
    document.getElementById('start-date').value = lastMonth.toISOString().split('T')[0];
  }
};

async function fetchReportsFromBackend(agentId = null) {
  const { start, end } = getRangeDatesFromUI();
  const { fromISO, toISO } = periodToISO(start, end);
  
  const params = new URLSearchParams();
  params.set('from', fromISO);
  params.set('to', toISO);
  if (agentId && agentId !== 'all') {
    params.set('agent_id', agentId);
  }
  
  try {
    const result = await api('/reports?' + params.toString());
    let rows = result.success ? (result.data || []) : [];
    // Filtrage client complémentaire: projet et date précise
    try {
      const proj = (document.getElementById('project-filter')?.value || 'all').trim();
      if (proj && proj !== 'all') rows = rows.filter(r => String(r.projet || r.project_name || '').trim() === proj);
    } catch {}
    try {
      const precise = (document.getElementById('date-filter')?.value || '').trim();
      if (precise) rows = rows.filter(r => dateMatchesPrecise(precise, r.ts || r.date || r.created_at));
    } catch {}
    return rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des rapports:', error);
    return [];
  }
}

function renderValidations(rows) {
  const tbody = document.getElementById('validations-body');
  if (!tbody) return;
  
  const cell = v => (v == null || v === '') ? '—' : v;
  const fmt = d => new Date(d).toLocaleString('fr-FR');
  
  tbody.innerHTML = (rows || []).map(it => `
    <tr>
      <td>${cell(it.agent)}</td>
      <td>${cell(it.projet)}</td>
      <td>${cell(it.localisation)}</td>
      <td>${cell(it.rayon_m)}</td>
      <td>${(it.ref_lat != null && it.ref_lon != null) ? `${it.ref_lat}, ${it.ref_lon}` : '—'}</td>
      <td>${(it.lat != null && it.lon != null) ? `${it.lat}, ${it.lon}` : '—'}</td>
      <td>${it.ts ? fmt(it.ts) : '—'}</td>
      <td>${cell(it.distance_m)}</td>
      <td>${cell(it.statut)}</td>
    </tr>
  `).join('') || `<tr><td colspan="9">Aucune donnée</td></tr>`;
  
  window.__lastRows = rows;
}

window.loadValidations = async function() {
  const agentSel = document.getElementById('agent-filter')?.value;
  const agentId = (agentSel && agentSel !== 'all') ? agentSel : null;
  
  const rows = await fetchReportsFromBackend(agentId);
  renderValidations(rows);
};

window.generateReport = async function() {
  await window.loadValidations();
  
  // Mettre à jour les métriques si présentes
  const rows = window.__lastRows || [];
  const agents = new Map();
  
  rows.forEach(r => {
    const k = r.agent_id + ':' + (r.agent || '');
    const rec = agents.get(k) || { present: true };
    if ((r.statut || '').toLowerCase().includes('hors')) rec.present = false;
    agents.set(k, rec);
  });
  
  const total = agents.size;
  const presents = Array.from(agents.values()).filter(a => a.present).length;
  const absent = total - presents;
  const rate = total ? Math.round((presents / total) * 100) : 0;
  
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };
  
  set('total-agents', total);
  set('present-agents', presents);
  set('absent-agents', absent);
  set('attendance-rate', rate + '%');
  
  const rr = document.getElementById('report-results');
  if (rr) rr.style.display = 'block';

  // Dessiner/mettre à jour les graphiques
  try { renderCharts(rows); } catch (e) { console.warn('Charts render failed:', e?.message || e); }
};

window.exportReport = function() {
  const rows = window.__lastRows || [];
  const cols = ['Agent', 'Projet', 'Localisation', 'Rayon (m)', 'Ref (lat, lon)', 'Actuel (lat, lon)', 'Date', 'Distance (m)', 'Statut'];
  const fmt = d => new Date(d).toLocaleString('fr-FR');
  const esc = s => String(s ?? '').replace(/[\n\r;,]/g, ' ').trim();
  
  const lines = [cols.join(';')].concat(rows.map(r => {
    return [
      esc(r.agent),
      esc(r.projet),
      esc(r.localisation),
      esc(r.rayon_m),
      (r.ref_lat != null && r.ref_lon != null) ? `${r.ref_lat}, ${r.ref_lon}` : '—',
      (r.lat != null && r.lon != null) ? `${r.lat}, ${r.lon}` : '—',
      r.ts ? fmt(r.ts) : '—',
      esc(r.distance_m),
      esc(r.statut)
    ].join(';');
  }));
  
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport_presence_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

window.printReport = () => window.print();

// === Chargement des agents pour le filtre ===
async function loadAgentsForFilter() {
  try {
    const result = await api('/users');
    const agents = result.items || result.data || result || [];
    
    const select = document.getElementById('agent-filter');
    if (!select) return;
    
    select.innerHTML = '<option value="all">Tous les agents</option>';
    agents.forEach(agent => {
      if (agent.role === 'agent') {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = agent.name || agent.email;
        select.appendChild(option);
      }
    });
  } catch (error) {
    console.error('Erreur lors du chargement des agents:', error);
  }
}

// === Chargement des projets pour le filtre ===
async function loadProjectsForFilter() {
  try {
    const result = await api('/users');
    const users = result.items || result.data || result || [];
    
    // Extraire les projets uniques des agents
    const projects = new Set();
    users.forEach(user => {
      if (user.project_name && user.project_name.trim()) {
        projects.add(user.project_name.trim());
      }
    });
    
    const select = document.getElementById('project-filter');
    if (!select) return;
    
    select.innerHTML = '<option value="all">Tous les projets</option>';
    Array.from(projects).sort().forEach(project => {
      const option = document.createElement('option');
      option.value = project;
      option.textContent = project;
      select.appendChild(option);
    });
    
    console.log('Projets chargés:', Array.from(projects));
  } catch (error) {
    console.error('Erreur lors du chargement des projets:', error);
  }
}

// === Initialisation ===
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Initialisation de reports.js (version backend)');
  
  // Vérifier l'authentification
  await checkAuth();
  
  // Charger les agents et projets pour les filtres
  await loadAgentsForFilter();
  await loadProjectsForFilter();
  
  // Attacher les événements
  const dateRangeSelect = document.getElementById('date-range');
  if (dateRangeSelect) {
    dateRangeSelect.addEventListener('change', window.updateDateInputs);
  }
  
  const generateBtn = document.getElementById('generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', window.generateReport);
  }
  
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', window.exportReport);
  }
  
  const printBtn = document.getElementById('print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', window.printReport);
  }
  
  const loadBtn = document.getElementById('load-btn');
  if (loadBtn) {
    loadBtn.addEventListener('click', window.loadValidations);
  }
  const applyBtn = document.getElementById('apply-filters-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => { try { await window.generateReport(); } catch (e) { console.error(e); } });
  }
  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      try {
        const dr = document.getElementById('date-range'); if (dr) dr.value = 'today';
        const df = document.getElementById('date-filter'); if (df) df.value = new Date().toISOString().slice(0,10);
        const ag = document.getElementById('agent-filter'); if (ag) ag.value = 'all';
        const pj = document.getElementById('project-filter'); if (pj) pj.value = 'all';
        const rr = document.getElementById('report-results'); if (rr) rr.style.display = 'none';
      } catch {}
    });
  }
  
  // Initialiser les champs de date
  window.updateDateInputs();
  
  console.log('✅ Reports.js initialisé avec succès');
});

// === Utilitaires ===
function dateMatchesPrecise(preciseYmd, value) {
  try {
    if (!value) return false;
    let d;
    if (typeof value === 'number') d = new Date(value);
    else if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) d = new Date(value);
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(String(value))) {
      const [dd, mm, yyyy] = String(value).split(/[\s/]/);
      d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    } else d = new Date(value);
    if (!d || isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    const localDate = `${y}-${m}-${day}`;
    const isoDate = d.toISOString().slice(0,10);
    return localDate === preciseYmd || isoDate === preciseYmd;
  } catch { return false; }
}

function renderCharts(rows) {
  // Préparer données d'évolution de présence par jour (Présents par date)
  const byDate = new Map(); // dateYMD -> { present: n, total: n }
  const fmtYMD = d => {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  };
  (rows || []).forEach(r => {
    if (!r.ts) return;
    const key = fmtYMD(r.ts);
    const rec = byDate.get(key) || { present: 0, total: 0 };
    rec.total++;
    if (!String(r.statut || '').toLowerCase().includes('hors')) rec.present++;
    byDate.set(key, rec);
  });
  const labels = Array.from(byDate.keys()).sort();
  const presentValues = labels.map(k => byDate.get(k).present);

  // Détruire les graphiques précédents si existants
  try { if (presenceLineChart) { presenceLineChart.destroy(); presenceLineChart = null; } } catch {}
  try { if (rolePieChart) { rolePieChart.destroy(); rolePieChart = null; } } catch {}

  // Line chart
  const lineCanvas = document.getElementById('presence-line-chart');
  if (lineCanvas && typeof Chart !== 'undefined') {
    presenceLineChart = new Chart(lineCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Présents par jour',
          data: presentValues,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.2)',
          tension: 0.25,
          fill: true,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  // Pie chart: répartition Présents vs Absents
  let present = 0, absent = 0;
  const agentsSet = new Map(); // agent_id -> present boolean OR
  (rows || []).forEach(r => {
    const key = r.agent_id || r.agent || Math.random();
    const isPresent = !String(r.statut || '').toLowerCase().includes('hors');
    if (!agentsSet.has(key)) agentsSet.set(key, isPresent);
    else agentsSet.set(key, agentsSet.get(key) || isPresent);
  });
  Array.from(agentsSet.values()).forEach(v => v ? present++ : absent++);
  const pieCanvas = document.getElementById('role-pie-chart');
  if (pieCanvas && typeof Chart !== 'undefined') {
    rolePieChart = new Chart(pieCanvas.getContext('2d'), {
      type: 'pie',
      data: {
        labels: ['Présents', 'Absents'],
        datasets: [{
          data: [present, absent],
          backgroundColor: ['#10b981', '#ef4444']
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
}
