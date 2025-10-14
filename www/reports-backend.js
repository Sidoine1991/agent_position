// Script pour la page de rapports - Version Backend uniquement
// Utilise /api/reports/validations au lieu de Supabase directement
console.log('🔄 reports-backend.js v4 chargé - ' + new Date().toISOString());

let jwt = localStorage.getItem('jwt') || '';
let currentUser = null;

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
    console.log('🔍 Appel API /reports avec params:', params.toString());
    const result = await api('/reports?' + params.toString());
    console.log('📊 Résultat API /reports:', result);
    
    if (result && result.success && result.data) {
      console.log('✅ Données trouvées:', result.data.length, 'rapports');
      // Les données sont déjà dans le bon format
      return result.data;
    } else {
      console.warn('⚠️ Aucune donnée dans /reports ou format inattendu:', result);
    }
    return [];
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des rapports:', error);
    return [];
  }
}

function renderValidations(rows) {
  console.log('🔍 renderValidations appelée avec:', rows?.length || 0, 'lignes');
  console.log('📋 Premier élément:', rows?.[0]);
  
  const tbody = document.getElementById('validations-body');
  if (!tbody) {
    console.error('❌ Élément validations-body non trouvé');
    return;
  }
  
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
  
  console.log('✅ Tableau rendu avec', (rows || []).length, 'lignes');
  window.__lastRows = rows;
}

window.loadValidations = async function() {
  console.log('🔍 loadValidations appelée');
  const agentSel = document.getElementById('agent-filter')?.value;
  const agentId = (agentSel && agentSel !== 'all') ? agentSel : null;
  
  console.log('📋 Agent sélectionné:', agentId);
  const rows = await fetchReportsFromBackend(agentId);
  console.log('📊 Rows récupérées:', rows?.length || 0);
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
    const result = await api('/admin/agents');
    const agents = result.data || result.agents || result || [];
    
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

// === Initialisation ===
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Initialisation de reports.js (version backend)');
  
  // Vérifier l'authentification
  await checkAuth();
  
  // Charger les agents pour le filtre
  await loadAgentsForFilter();
  
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
  
  const reloadBtn = document.getElementById('reload-validations');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', window.loadValidations);
  }
  
  // Initialiser les champs de date
  window.updateDateInputs();
  
  // Charger automatiquement les données au démarrage
  console.log('📊 Chargement automatique des données...');
  await window.loadValidations();
  
  console.log('✅ Reports.js initialisé avec succès');
});
