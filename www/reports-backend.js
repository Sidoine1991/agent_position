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
  
  // Vérifier si on a des données
  if (!rows || rows.length === 0) {
    console.warn('⚠️ Aucune donnée à afficher dans le tableau');
    tbody.innerHTML = '<tr><td colspan="10">Aucune donnée</td></tr>';
    return;
  }
  
  const cell = v => (v == null || v === '') ? '—' : v;
  const fmt = d => new Date(d).toLocaleString('fr-FR');
  
  tbody.innerHTML = (rows || []).map(it => `
    <tr>
      <td>${it.ts ? fmt(it.ts) : '—'}</td>
      <td>${cell(it.agent)}</td>
      <td>${cell(it.projet)}</td>
      <td>${cell(it.localisation)}</td>
      <td>${cell(it.rayon_m)}</td>
      <td>${(it.ref_lat != null && it.ref_lon != null) ? `${it.ref_lat}, ${it.ref_lon}` : '—'}</td>
      <td>${(it.lat != null && it.lon != null) ? `${it.lat}, ${it.lon}` : '—'}</td>
      <td>${cell(it.distance_m)}</td>
      <td>${cell(it.mission_duration)}</td>
      <td>${cell(it.statut)}</td>
    </tr>
  `).join('') || `<tr><td colspan="10">Aucune donnée</td></tr>`;
  
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
  
  // Mettre à jour l'en-tête du rapport avec la date, l'heure et le nom de l'administrateur
  updateReportHeader();
  
  // Générer les diagrammes
  console.log('🎨 Appel de generateCharts avec', rows?.length || 0, 'lignes');
  generateCharts(rows);
  
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

// Fonction de déconnexion
window.logout = function() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    localStorage.removeItem('jwt');
    localStorage.removeItem('user_email');
    localStorage.removeItem('email');
    localStorage.removeItem('userEmail');
    window.location.href = '/index.html';
  }
};

// Fonction pour mettre à jour les informations utilisateur dans la navbar
function updateNavbarUser() {
  const userInfoEl = document.getElementById('user-info');
  if (userInfoEl && currentUser) {
    const userName = currentUser.name || currentUser.first_name + ' ' + currentUser.last_name || currentUser.email || 'Utilisateur';
    const userRole = currentUser.role || 'Agent';
    userInfoEl.textContent = `${userName} (${userRole})`;
  }
}

// Fonction pour gérer les filtres de date
function updateDateInputs() {
  const dateRange = document.getElementById('date-range');
  const customStartGroup = document.getElementById('custom-date-group');
  const customEndGroup = document.getElementById('custom-date-group-end');
  
  if (dateRange && customStartGroup && customEndGroup) {
    if (dateRange.value === 'custom') {
      customStartGroup.style.display = 'block';
      customEndGroup.style.display = 'block';
    } else {
      customStartGroup.style.display = 'none';
      customEndGroup.style.display = 'none';
    }
  }
}

// Fonction pour générer les diagrammes
function generateCharts(rows) {
  console.log('📊 Génération des diagrammes avec', rows?.length || 0, 'lignes');
  console.log('📋 Première ligne pour debug:', rows?.[0]);
  generatePresenceEvolutionChart(rows);
  generateRoleDistributionChart(rows);
}

// Diagramme d'évolution de la présence
function generatePresenceEvolutionChart(rows) {
  const chartContainer = document.getElementById('presence-evolution-chart');
  if (!chartContainer) {
    console.error('❌ Élément presence-evolution-chart non trouvé');
    return;
  }
  
  console.log('📊 Génération du diagramme d\'évolution de la présence...');
  console.log('📋 Données reçues:', rows?.length || 0, 'lignes');
  
  if (!rows || rows.length === 0) {
    chartContainer.innerHTML = '<div class="chart-loading">Aucune donnée disponible</div>';
    return;
  }
  
  // Grouper par date
  const dailyData = {};
  rows.forEach(row => {
    if (!row.ts) {
      console.warn('⚠️ Ligne sans timestamp:', row);
      return;
    }
    
    const date = new Date(row.ts).toLocaleDateString('fr-FR');
    if (!dailyData[date]) {
      dailyData[date] = { present: 0, absent: 0, total: 0 };
    }
    dailyData[date].total++;
    if (row.statut === 'Présent') {
      dailyData[date].present++;
    } else {
      dailyData[date].absent++;
    }
  });
  
  console.log('📅 Données groupées par date:', dailyData);
  
  const dates = Object.keys(dailyData).sort();
  if (dates.length === 0) {
    chartContainer.innerHTML = '<div class="chart-loading">Aucune date trouvée</div>';
    return;
  }
  
  const maxTotal = Math.max(...Object.values(dailyData).map(d => d.total));
  
  let chartHTML = '<div class="chart-bar-container">';
  dates.forEach(date => {
    const data = dailyData[date];
    const presentPercent = (data.present / data.total) * 100;
    const absentPercent = (data.absent / data.total) * 100;
    
    chartHTML += `
      <div class="chart-bar">
        <div class="chart-bar-label">${date}</div>
        <div class="chart-bar-fill" style="width: ${(data.total / maxTotal) * 200}px; background: linear-gradient(90deg, #10b981 ${presentPercent}%, #ef4444 ${presentPercent}%);">
          ${data.present}/${data.total}
        </div>
      </div>
    `;
  });
  chartHTML += '</div>';
  
  chartContainer.innerHTML = chartHTML;
  console.log('✅ Diagramme d\'évolution généré');
}

// Diagramme de répartition par projet
function generateRoleDistributionChart(rows) {
  const chartContainer = document.getElementById('role-distribution-chart');
  if (!chartContainer) {
    console.error('❌ Élément role-distribution-chart non trouvé');
    return;
  }
  
  console.log('📊 Génération du diagramme de répartition par projet...');
  console.log('📋 Données reçues:', rows?.length || 0, 'lignes');
  
  if (!rows || rows.length === 0) {
    chartContainer.innerHTML = '<div class="chart-loading">Aucune donnée disponible</div>';
    return;
  }
  
  // Grouper par projet
  const projectData = {};
  rows.forEach(row => {
    const project = row.projet || 'Non spécifié';
    if (!projectData[project]) {
      projectData[project] = 0;
    }
    projectData[project]++;
  });
  
  console.log('📊 Données groupées par projet:', projectData);
  
  const total = Object.values(projectData).reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    chartContainer.innerHTML = '<div class="chart-loading">Aucun projet trouvé</div>';
    return;
  }
  
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];
  
  let chartHTML = '<div class="chart-pie">';
  let colorIndex = 0;
  
  Object.entries(projectData).forEach(([project, count]) => {
    const percentage = ((count / total) * 100).toFixed(1);
    const color = colors[colorIndex % colors.length];
    
    chartHTML += `
      <div class="chart-pie-item">
        <div class="chart-pie-color" style="background-color: ${color};"></div>
        <div class="chart-pie-label">${project}</div>
        <div class="chart-pie-value">${count} (${percentage}%)</div>
      </div>
    `;
    colorIndex++;
  });
  
  chartHTML += '</div>';
  chartContainer.innerHTML = chartHTML;
  console.log('✅ Diagramme de répartition généré');
}

// Fonction d'export Excel
window.exportExcel = function() {
  const rows = window.__lastRows || [];
  if (rows.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }
  
  // Créer le contenu Excel (format HTML table pour Excel)
  const excelContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <meta name="ExcelCreated" content="01/01/2025">
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .header { background-color: #4f46e5; color: white; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2>Rapport de Présence - Presence CCRB</h2>
      <p><strong>Généré le:</strong> ${new Date().toLocaleString('fr-FR')}</p>
      <p><strong>Par:</strong> ${currentUser?.name || currentUser?.email || 'Administrateur'}</p>
      <p><strong>Période:</strong> ${document.getElementById('report-period')?.textContent || 'Non spécifiée'}</p>
      
      <table>
        <thead>
                 <tr class="header">
                   <th>Date</th>
                   <th>Agent</th>
                   <th>Projet</th>
                   <th>Localisation</th>
                   <th>Rayon (m)</th>
                   <th>Ref (lat, lon)</th>
                   <th>Actuel (lat, lon)</th>
                   <th>Distance (m)</th>
                   <th>Durée Mission</th>
                   <th>Statut</th>
                 </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${row.ts ? new Date(row.ts).toLocaleString('fr-FR') : '—'}</td>
              <td>${row.agent || '—'}</td>
              <td>${row.projet || '—'}</td>
              <td>${row.localisation || '—'}</td>
              <td>${row.rayon_m || '—'}</td>
              <td>${(row.ref_lat != null && row.ref_lon != null) ? `${row.ref_lat}, ${row.ref_lon}` : '—'}</td>
              <td>${(row.lat != null && row.lon != null) ? `${row.lat}, ${row.lon}` : '—'}</td>
              <td>${row.distance_m || '—'}</td>
              <td>${row.mission_duration ? `${row.mission_duration} min` : '—'}</td>
              <td>${row.statut || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  // Créer et télécharger le fichier
  const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport_presence_${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
};

// Fonction pour mettre à jour l'en-tête du rapport
function updateReportHeader() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  // Mettre à jour la date de génération
  const generatedDateEl = document.getElementById('generated-date');
  if (generatedDateEl) {
    generatedDateEl.textContent = `${dateStr} à ${timeStr}`;
  }
  
  // Mettre à jour le nom de l'administrateur
  const generatorNameEl = document.getElementById('generator-name');
  if (generatorNameEl && currentUser) {
    const adminName = currentUser.name || currentUser.first_name + ' ' + currentUser.last_name || currentUser.email || 'Administrateur';
    generatorNameEl.textContent = adminName;
  }
  
  // Mettre à jour la période
  const periodEl = document.getElementById('report-period');
  if (periodEl) {
    const dateRange = document.getElementById('date-range');
    if (dateRange) {
      const selectedPeriod = dateRange.value;
      let periodText = 'Aujourd\'hui';
      
      switch(selectedPeriod) {
        case 'today':
          periodText = 'Aujourd\'hui';
          break;
        case 'yesterday':
          periodText = 'Hier';
          break;
        case 'week':
          periodText = 'Cette semaine';
          break;
        case 'month':
          periodText = 'Ce mois';
          break;
        case 'year':
          periodText = 'Cette année';
          break;
        case 'custom':
          const startDate = document.getElementById('start-date')?.value;
          const endDate = document.getElementById('end-date')?.value;
          if (startDate && endDate) {
            const start = new Date(startDate).toLocaleDateString('fr-FR');
            const end = new Date(endDate).toLocaleDateString('fr-FR');
            periodText = `Du ${start} au ${end}`;
          }
          break;
      }
      
      periodEl.textContent = `Période: ${periodText}`;
    }
  }
}

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
  
  // Mettre à jour les informations utilisateur dans la navbar
  updateNavbarUser();
  
  // Charger les agents pour le filtre
  await loadAgentsForFilter();
  
  // Attacher les événements
  const dateRangeSelect = document.getElementById('date-range');
  if (dateRangeSelect) {
    dateRangeSelect.addEventListener('change', updateDateInputs);
  }
  
  const generateBtn = document.getElementById('generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', window.generateReport);
  }
  
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', window.exportReport);
  }
  
  const exportExcelBtn = document.getElementById('export-excel-btn');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', window.exportExcel);
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
