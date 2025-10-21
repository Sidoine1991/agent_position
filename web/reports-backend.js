// Script pour la page de rapports - Version Backend uniquement
let jwt = localStorage.getItem('jwt') || '';
let currentUser = null;
let presenceLineChart = null;
let rolePieChart = null;
let statusPieChart = null;
const apiBase = '/api';

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || '';
}

function getEmailHint() {
  return getQueryParam('email') ||
         localStorage.getItem('email') ||
         localStorage.getItem('user_email') ||
         localStorage.getItem('userEmail') ||
         '';
}

function $(id) {
  return document.getElementById(id);
}

/**
 * Génère les en-têtes d'authentification pour les requêtes API
 */
async function authHeaders() {
  const token = localStorage.getItem('jwt') || '';
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Effectue une requête API
 */
async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (jwt) {
    headers['Authorization'] = 'Bearer ' + jwt;
  }
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

/**
 * Vérifie l'authentification et les permissions
 */
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

/**
 * Récupère les dates de la période sélectionnée
 */
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

/**
 * Convertit une période en format ISO
 */
function periodToISO(start, end) {
  const fromISO = start ? new Date(start + 'T00:00:00Z').toISOString() : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const toISO = end ? new Date(end + 'T23:59:59Z').toISOString() : new Date().toISOString();
  return { fromISO, toISO };
}

/**
 * Met à jour les champs de date personnalisés
 */
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

/**
 * Récupère les rapports depuis le backend avec tous les filtres
 */
async function fetchReportsFromBackend() {
  const { start, end } = getRangeDatesFromUI();
  const { fromISO, toISO } = periodToISO(start, end);
  const params = new URLSearchParams();
  params.set('from', fromISO);
  params.set('to', toISO);
  
  console.log(`🔍 Recherche des rapports du ${start} au ${end}`);

  // Lire les valeurs des filtres depuis l'UI
  const agentId = document.getElementById('agent-filter')?.value;
  const supervisorId = document.getElementById('supervisor-filter')?.value;
  const projectName = document.getElementById('project-filter')?.value;
  const departmentId = document.getElementById('department-filter')?.value;
  const communeId = document.getElementById('commune-filter')?.value;

  console.log('🔧 Filtres appliqués:', {
    agentId,
    supervisorId,
    projectName,
    departmentId,
    communeId
  });

  try {
    // 1. Charger tous les utilisateurs pour avoir les métadonnées complètes
    console.log('🔄 Chargement des utilisateurs...');
    const usersResult = await api('/users?limit=1000'); // Augmenter la limite pour récupérer plus d'utilisateurs
    const users = Array.isArray(usersResult) 
      ? usersResult 
      : (usersResult?.items || usersResult?.data || []);
      
    // S'assurer que les clés de la map sont des chaînes pour éviter les erreurs de type
    const usersById = new Map(users.map(u => [String(u.id), u]));
    console.log(`✅ ${users.length} utilisateurs chargés`);

    // 2. Charger tous les rapports pour la période donnée avec pagination
    let rows = [];
    let page = 1;
    const limit = 2000; // Augmenter la limite pour réduire le nombre de requêtes
    let hasMore = true;
    let retryCount = 0;
    const maxRetries = 3;
    let totalPages = 1;
    let totalReports = 0;

    console.log('🔄 Chargement des rapports...');
    
    while (hasMore && page <= totalPages) {
      try {
        const paginatedParams = new URLSearchParams(params);
        paginatedParams.set('page', page);
        paginatedParams.set('limit', limit);
        
        console.log(`📄 Chargement de la page ${page} (limite: ${limit})...`);
        const result = await api('/reports?' + paginatedParams.toString());
        
        // Gérer la réponse paginée
        let pageData = [];
        if (Array.isArray(result)) {
          pageData = result;
        } else if (result?.data) {
          pageData = Array.isArray(result.data) ? result.data : [result.data];
          // Mise à jour du nombre total de pages si disponible
          if (result.total_pages && result.total_pages > totalPages) {
            totalPages = result.total_pages;
            console.log(`📊 Nombre total de pages détecté: ${totalPages}`);
          }
          if (result.total) {
            totalReports = result.total;
            console.log(`📊 Nombre total de rapports: ${totalReports}`);
          }
        } else if (result?.success && result.data) {
          pageData = Array.isArray(result.data) ? result.data : [result.data];
        }
        
        if (pageData.length > 0) {
          console.log(`📥 ${pageData.length} rapports chargés (page ${page}/${totalPages || '?'})`);
          
          // Enrichir chaque rapport avec les données utilisateur
          const enrichedRows = [];
          pageData.forEach(row => {
            const agentIdStr = String(row.agent_id);
            if (usersById.has(agentIdStr)) {
              row.user = usersById.get(agentIdStr);
              enrichedRows.push(row);
            }
          });
          
          rows.push(...enrichedRows);
          console.log(`✅ ${enrichedRows.length} rapports enrichis (total: ${rows.length})`);
          
          // Vérifier s'il y a plus de pages
          if (pageData.length < limit) {
            hasMore = false;
          } else if (totalPages > 1 && page < totalPages) {
            page++;
          } else if (totalPages === 1 && pageData.length === limit) {
            // Si on n'a pas d'information sur le nombre total de pages
            // et qu'on a reçu le nombre maximum d'éléments, on continue
            page++;
          } else {
            hasMore = false;
          }
          
          // Réinitialiser le compteur de tentatives en cas de succès
          retryCount = 0;
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.error(`❌ Erreur lors du chargement de la page ${page}:`, error);
        
        // Stratégie de nouvel essai pour les erreurs 500
        if (error.message && error.message.includes('500') && retryCount < maxRetries) {
          retryCount++;
          const delay = 1000 * retryCount; // Délai exponentiel
          console.log(`🔄 Nouvel essai ${retryCount}/${maxRetries} dans ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Si on a déjà des données, on continue avec ce qu'on a
        if (rows.length > 0) {
          console.warn(`⚠️ Chargement partiel: ${rows.length} rapports chargés avant l'erreur`);
          hasMore = false;
        } else {
          throw error;
        }
      }
    }
    
    console.log(`Chargement terminé: ${rows.length} rapports chargés`);

    // 3. Filtrer pour ne garder que le premier check-in par agent et par jour
    const firstCheckinByAgentAndDay = new Map();
    
    rows.forEach(row => {
      if (!row.agent_id || !row.ts) return;
      
      const dateKey = new Date(row.ts).toISOString().split('T')[0]; // Format YYYY-MM-DD
      const agentDateKey = `${row.agent_id}_${dateKey}`;
      
      if (!firstCheckinByAgentAndDay.has(agentDateKey)) {
        firstCheckinByAgentAndDay.set(agentDateKey, row);
      }
    });
    
    // Convertir la Map en tableau
    const uniqueRows = Array.from(firstCheckinByAgentAndDay.values());
    console.log(`🔍 ${uniqueRows.length} rapports uniques après filtrage des doublons (sur ${rows.length} au total)`);

    // 4. Appliquer tous les filtres côté client pour une logique unifiée
    const filteredRows = uniqueRows.filter(r => {
      const user = r.user;

      // Filtre par agent (si un agent spécifique est sélectionné)
      if (agentId && agentId !== 'all') {
        if (String(r.agent_id) !== agentId) {
          return false;
        }
      }

      // Si l'utilisateur n'a pas de données, on ne peut pas appliquer les autres filtres
      if (!user) {
        // Si un filtre nécessitant les données utilisateur est actif, on exclut l'enregistrement
        if (projectName && projectName !== 'all' || 
            departmentId && departmentId !== 'all' || 
            communeId && communeId !== 'all') {
          return false;
        }
        return true;
      }

      // Filtre par projet
      if (projectName && projectName !== 'all') {
        const userProject = user.project_name || user.projet || user.project || '';
        const cleanedUserProject = cleanProjectName(userProject);
        const cleanedFilterProject = cleanProjectName(projectName);
        
        // Log de débogage plus visible
        console.log('=== DÉBOGAGE FILTRE PROJET ===');
        console.log('Valeur du filtre sélectionné:', projectName);
        console.log('Projet utilisateur brut:', userProject);
        console.log('Projet utilisateur nettoyé:', cleanedUserProject);
        console.log('Valeur du filtre nettoyée:', cleanedFilterProject);
        console.log('Correspondance:', cleanedUserProject === cleanedFilterProject ? 'OUI' : 'NON');
        
        if (cleanedUserProject !== cleanedFilterProject) {
          console.log(`❌ Filtre projet: "${cleanedFilterProject}" ne correspond pas au projet de l'utilisateur: "${cleanedUserProject}"`);
          return false;
        } else {
          console.log(`✅ Projet correspondant trouvé pour l'utilisateur ${user.name || user.id}`);
        }
      }

      // Filtre par département
      if (departmentId && departmentId !== 'all') {
        if (String(user.departement || '') !== departmentId) {
          return false;
        }
      }

      // Filtre par commune
      if (communeId && communeId !== 'all') {
        if (String(user.commune || '') !== communeId) {
          return false;
        }
      }
      
      // Filtre par date précise (si appliqué)
      const precise = (document.getElementById('date-filter')?.value || '').trim();
      if (precise) {
        if (!dateMatchesPrecise(precise, r.ts || r.date || r.created_at)) {
          return false;
        }
      }

      // Journalisation pour le débogage
      console.log('Enregistrement conservé:', {
        id: r.id,
        agent_id: r.agent_id,
        user: user ? {
          id: user.id,
          name: user.name,
          project: user.project_name || user.projet,
          departement: user.departement,
          commune: user.commune
        } : 'no user data'
      });

      return true;
    });
    
    console.log(`${filteredRows.length} rapports filtrés sur ${rows.length} total`);
    return filteredRows;
  } catch (error) {
    console.error('Erreur lors de la récupération des rapports:', error);
    return [];
  }
}

/**
 * Vérifie si une planification existe pour un agent à une date donnée
 */
async function checkPlanningForAgent(agentId, date) {
  if (!agentId || !date) return false;
  try {
    const headers = await authHeaders();
    const response = await fetch(`${apiBase}/planifications?agent_id=${agentId}&date=${date}`, { headers });
    if (!response.ok) return false;
    const result = await response.json();
    return result && result.items && result.items.length > 0;
  } catch (error) {
    console.error('Erreur lors de la vérification de la planification:', error);
    return false;
  }
}

/**
 * Télécharge le rapport de validation au format PDF
 */
function downloadValidationReport(validationId) {
  if (!validationId) return;
  const link = document.createElement('a');
  link.href = `${apiBase}/validations/${validationId}/report`;
  link.download = `rapport-validation-${validationId}.pdf`;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Affiche les validations dans le tableau
 */
async function renderValidations(rows) {
  const tbody = document.getElementById('validations-body');
  if (!tbody) return;
  const cell = v => (v == null || v === '') ? '—' : v;
  const fmt = d => new Date(d).toLocaleString('fr-FR');
  // Trier les lignes par date
  const sortedRows = [...(rows || [])].sort((a, b) => {
    const dateA = a.ts ? new Date(a.ts) : new Date(0);
    const dateB = b.ts ? new Date(b.ts) : new Date(0);
    return dateA - dateB;
  });
  
  // Utiliser toutes les entrées sans déduplication
  const filteredRows = sortedRows.filter(row => row.agent_id && row.ts);
  const thead = document.querySelector('#validations-table thead');
  if (thead) {
    thead.innerHTML = `
      <tr>
        <th>Agent</th>
        <th>Projet</th>
        <th>Localisation</th>
        <th>Rayon (m)</th>
        <th>Référence GPS</th>
        <th>Position actuelle</th>
        <th>Date/Heure</th>
        <th>Distance (m)</th>
        <th>Statut</th>
        <th>Planification</th>
        <th>Actions</th>
      </tr>
    `;
  }
  tbody.innerHTML = await Promise.all(filteredRows.map(async row => {
    const date = new Date(row.ts).toISOString().split('T')[0];
    const hasPlanning = await checkPlanningForAgent(row.agent_id, date);
    
    // Récupérer les informations de l'utilisateur
    const user = row.user || {};
    const agentName = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || `Agent ${row.agent_id}`;
    const projectName = user.project_name || user.projet || user.project || row.projet || 'Non défini';
    
    return `
      <tr>
        <td>${cell(agentName)}</td>
        <td>${cell(projectName)}</td>
        <td>${cell(row.localisation)}</td>
        <td>${cell(row.rayon_m)}</td>
        <td>${(row.ref_lat != null && row.ref_lon != null) ? `${row.ref_lat}, ${row.ref_lon}` : '—'}</td>
        <td>${(row.lat != null && row.lon != null) ? `${row.lat}, ${row.lon}` : '—'}</td>
        <td>${row.ts ? fmt(row.ts) : '—'}</td>
        <td>${cell(row.distance_m)}</td>
        <td>${cell(row.statut)}</td>
        <td class="text-center">${hasPlanning ? '✅ Oui' : '❌ Non'}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary" onclick="downloadValidationReport('${row.id}')" title="Télécharger le rapport">
            <i class="bi bi-download"></i>
          </button>
        </td>
      </tr>
    `;
  })).then(rows => rows.join('') || `<tr><td colspan="11">Aucune donnée</td></tr>`);
  window.__lastRows = rows;
  window.__filteredRows = filteredRows;
}

/**
 * Charge les utilisateurs et leurs planifications pour la date sélectionnée
 */
async function loadUsersPlanning() {
  try {
    let date = '';
    const dateInput = document.getElementById('date') || document.getElementById('date-filter');
    if (dateInput && dateInput.value) {
      date = dateInput.value;
    } else {
      const today = new Date();
      date = today.toISOString().split('T')[0];
      if (dateInput) dateInput.value = date;
    }
    console.log('Date utilisée pour le filtre:', date);
    const headers = await authHeaders();
    const tbody = document.getElementById('users-planning-body');
    if (!tbody) {
      console.error('ERREUR: L\'élément avec l\'ID users-planning-body est introuvable dans le DOM');
      return;
    }
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Chargement des données...</td></tr>';
    let allUsers = [];
    let users = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;
    try {
      while (hasMore) {
        const url = `${apiBase}/users?page=${page}&limit=${limit}`;
        const usersRes = await fetch(url, { headers });
        if (!usersRes.ok) {
          const errorText = await usersRes.text();
          console.error('Erreur lors du chargement des utilisateurs:', usersRes.status, errorText);
          throw new Error(`Erreur ${usersRes.status} lors du chargement des utilisateurs`);
        }
        const response = await usersRes.json();
        let usersData = [];
        if (response && response.items && Array.isArray(response.items)) {
          usersData = response.items;
        } else if (Array.isArray(response)) {
          usersData = response;
        } else if (response && response.data && Array.isArray(response.data)) {
          usersData = response.data;
        } else if (response && response.success && response.items) {
          usersData = response.items || [];
        } else {
          usersData = Object.values(response).find(Array.isArray) || [];
        }
        allUsers = [...allUsers, ...usersData];
        if (usersData.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      }
      users = allUsers.filter(user => {
        if (!user) return false;
        const userRole = (user.role || '').toLowerCase().trim();
        return userRole !== 'admin' && userRole !== '';
      });
    } catch (error) {
      console.error('Erreur lors du parsing des utilisateurs:', error);
      users = [];
    }
    let planningItems = [];
    try {
      const from = `${date}T00:00:00.000Z`;
      const to = `${date}T23:59:59.999Z`;
      const planningRes = await fetch(`${apiBase}/planifications?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers });
      if (!planningRes.ok) {
        const errorText = await planningRes.text();
        console.error('Erreur lors du chargement des planifications:', planningRes.status, errorText);
      } else {
        const planningData = await planningRes.json();
        if (planningData && planningData.items && Array.isArray(planningData.items)) {
          planningItems = planningData.items;
        } else if (Array.isArray(planningData)) {
          planningItems = planningData;
        } else if (planningData && planningData.data && Array.isArray(planningData.data)) {
          planningItems = planningData.data;
        } else {
          planningItems = [];
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des planifications:', error);
    }
    const usersWithPlanning = new Set(planningItems.map(p => p.user_id));
    let withPlanning = 0;
    let withoutPlanning = 0;
    tbody.innerHTML = '';
    const rows = [];
    await Promise.all(users.map(async (user, index) => {
      const hasPlanning = await checkPlanningForAgent(user.id, date);
      if (hasPlanning) {
        withPlanning++;
      } else {
        withoutPlanning++;
      }
      const planningCell = hasPlanning ? 'Oui' : 'Non';
      const planningClass = hasPlanning ? 'text-success' : 'text-danger';
      // Construire le nom d'affichage selon la structure de la table users
      let displayName = '';
      if (user.name && user.name.trim()) {
        displayName = user.name.trim();
      } else if (user.first_name || user.last_name) {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        displayName = `${firstName} ${lastName}`.trim();
      } else {
        displayName = user.email || 'Non renseigné';
      }
      // Récupérer le numéro de projet de l'utilisateur
      const projectNumber = user.project_name || user.projet || user.project || '—';
      
      const row = `
        <tr>
          <td>${index + 1}</td>
          <td>${displayName}</td>
          <td>${projectNumber}</td>
          <td>${user.role || '—'}</td>
          <td class="${planningClass} text-center">${planningCell}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-info" onclick="viewPlanningDetails('${user.id}', '${date}')">
              <i class="bi bi-eye"></i> Voir
            </button>
          </td>
        </tr>
      `;
      rows.push(row);
    }));
    tbody.innerHTML = rows.join('') || '<tr><td colspan="6" class="text-center">Aucun utilisateur trouvé</td></tr>';
    const countElement = document.getElementById('planning-count');
    if (countElement) {
      countElement.innerHTML = `
        <span class="text-success">${withPlanning} avec</span> /
        <span class="text-danger">${withoutPlanning} sans</span>
      `;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des planifications:', error);
    const tbody = document.getElementById('users-planning-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-danger">
            Erreur lors du chargement des données: ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Affiche les détails de la planification d'un utilisateur
 */
async function viewPlanningDetails(userId, date) {
  console.log('[DEBUG] Début de viewPlanningDetails', { userId, date });
  try {
    console.log(`Récupération des détails pour l'utilisateur ${userId} à la date ${date}`);
    
    // Formater la date pour l'API (YYYY-MM-DD)
    const formattedDate = new Date(date).toISOString().split('T')[0];
    
    // Variables pour stocker les informations de l'utilisateur
    let userName = 'Non renseigné';
    let userProject = 'Non spécifié';
    let userDepartment = 'Non spécifié';
    let userCommune = 'Non spécifiée';
    
    // Récupérer la liste des utilisateurs à partir du tableau affiché
    console.log('[DEBUG] Récupération des lignes du tableau des utilisateurs');
    const tableRows = document.querySelectorAll('#users-planning-body tr');
    console.log(`[DEBUG] ${tableRows.length} lignes trouvées dans le tableau`);
    let userData = null;
    
    // Parcourir les lignes du tableau pour trouver l'utilisateur
    for (const row of tableRows) {
      const button = row.querySelector('button[onclick*="viewPlanningDetails"]');
      if (button) {
        // Extraire l'ID utilisateur du bouton
        const buttonOnClick = button.getAttribute('onclick');
        const match = buttonOnClick.match(/viewPlanningDetails\('(\d+)'/);
        if (match && match[1] === userId) {
          // Extraire les données de la ligne du tableau
          const cells = row.querySelectorAll('td');
          if (cells.length >= 6) {
            userData = {
              name: cells[1].textContent.trim(),
              project_name: cells[2].textContent.trim(),
              role: cells[3].textContent.trim()
            };
            break;
          }
        }
      }
    }
    
    if (userData) {
      console.log('Données utilisateur trouvées dans le cache:', userData);
      
      // Extraire le nom complet de l'utilisateur
      if (userData.name) {
        userName = userData.name;
      } else if (userData.first_name || userData.last_name) {
        userName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
      } else if (userData.email) {
        userName = userData.email;
      }
      
      // Extraire les informations du projet et de localisation
      userProject = userData.project_name || userData.projet || userData.project || 'Non spécifié';
      userDepartment = userData.departement || userData.department || 'Non spécifié';
      userCommune = userData.commune || userData.city || 'Non spécifiée';
      
      console.log('Informations extraites:', { userName, userProject, userDepartment, userCommune });
    } else {
      console.warn(`Aucune donnée utilisateur trouvée pour l'ID ${userId} (${typeof userId}) dans la liste des ${usersList.length} utilisateurs`);
      console.log('Premiers utilisateurs chargés:', usersList.slice(0, 5));
    }
    
    // Récupérer les détails de planification
    const headers = await authHeaders();
    const planificationUrl = new URL(`${apiBase}/planifications`, window.location.origin);
    planificationUrl.searchParams.append('user_id', userId);
    planificationUrl.searchParams.append('from', formattedDate);
    planificationUrl.searchParams.append('to', formattedDate);
    
    console.log('URL de la planification:', planificationUrl.toString());
    
    // Récupérer les informations de l'utilisateur et sa planification en parallèle
    console.log('[DEBUG] Initialisation des variables utilisateur');
    let userLocation = 'Non spécifiée';
    let userActivity = 'Non spécifiée';
    let userActivityDescription = 'Aucune description fournie';
    let hasError = false;
    let errorMessage = '';
    let heureDebut = 'Non spécifiée';
    let heureFin = 'Non spécifiée';
    
    console.log('[DEBUG] Préparation des appels API pour les données utilisateur et rapports');
    
    try {
      console.log('[DEBUG] Début de la récupération des données en parallèle');
      // Récupérer les détails complets de l'utilisateur avec les relations
      const [userResponse, reportsResponse] = await Promise.all([
        fetch(`${apiBase}/users?id=eq.${userId}`, {
          headers: await authHeaders()
        }),
        fetch(`${apiBase}/reports?user_id=eq.${userId}&date=eq.${formattedDate}&order=created_at.desc&limit=1`, {
          headers: await authHeaders()
        })
      ]);
      
      // Traiter la réponse des détails utilisateur
      if (userResponse.ok) {
        const userDetails = await userResponse.json();
        console.log('Détails utilisateur récupérés:', userDetails);
        
        if (userDetails && userDetails.length > 0) {
          const user = userDetails[0];
          
          // Extraire les informations de localisation
          userDepartment = user.departement || 'Non spécifié';
          userCommune = user.commune || 'Non spécifiée';
          
          // Construire la localisation complète
          const locationParts = [];
          if (user.departement) locationParts.push(user.departement);
          if (user.commune) locationParts.push(user.commune);
          if (user.arrondissement) locationParts.push(`Arr. ${user.arrondissement}`);
          if (user.village) locationParts.push(`Village ${user.village}`);
          
          userLocation = locationParts.length > 0 ? locationParts.join(', ') : 'Non spécifiée';
          console.log('Localisation construite depuis les données utilisateur:', userLocation);
        }
      }
      
      // Traiter la réponse des rapports
      if (reportsResponse.ok) {
        const reports = await reportsResponse.json();
        if (reports && reports.length > 0) {
          const report = reports[0];
          console.log('Détails du rapport trouvé:', report);
          
          // Mettre à jour la localisation avec les données du rapport si disponible
          if (report.localisation) {
            userLocation = report.localisation;
            console.log('Localisation du rapport:', userLocation);
          }
          
          // Mettre à jour l'activité et la description si disponibles dans le rapport
          if (report.activite) {
            userActivity = report.activite;
            console.log('Activité du rapport:', userActivity);
          }
          
          // Récupérer la description ou les notes du rapport
          if (report.description || report.notes) {
            userActivityDescription = report.description || report.notes;
            console.log('Description du rapport:', userActivityDescription);
          }
          
          // Vérifier s'il y a des commentaires ou des notes supplémentaires
          if (report.commentaires) {
            userActivityDescription += (userActivityDescription ? '\n\n' : '') + report.commentaires;
          }
          
          // Mettre à jour les heures de début et de fin si disponibles
          if (report.heure_debut) {
            heureDebut = formatTime(report.heure_debut);
          }
          if (report.heure_fin) {
            heureFin = formatTime(report.heure_fin);
          }
        }
      }
      
    } catch (error) {
      hasError = true;
      errorMessage = `Erreur lors de la récupération des données: ${error.message}`;
      console.error(errorMessage, error);
    }
    
    // Si une erreur s'est produite, afficher un message d'erreur
    if (hasError) {
      showErrorModal('Erreur de chargement', `Une erreur est survenue lors du chargement des données: ${errorMessage}`);
      return;
    }
    
    // Récupérer les détails de planification
    let planification = {};
    try {
      const response = await fetch(planificationUrl.toString(), { 
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Aucune planification trouvée pour cette date, utilisation des informations de base. Erreur:', response.status, errorText);
      } else {
        planification = await response.json();
        console.log('Réponse de l\'API de planification:', planification);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la planification:', error);
      // Continuer avec un objet vide pour permettre l'affichage des informations de base
    }
    
    let modalContent = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">Détails de la planification</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fermer"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <h6 class="text-muted">${new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h6>
            </div>
    `;
    
    // Vérifier si nous avons des données de planification
    let planData = null;
    
    // Essayer différents formats de réponse de l'API
    if (planification && planification.items && planification.items.length > 0) {
      planData = planification.items[0];
      console.log('Planification trouvée dans items:', planData);
    } else if (Array.isArray(planification) && planification.length > 0) {
      planData = planification[0];
      console.log('Planification trouvée dans tableau:', planData);
    } else if (planification && planification.data) {
      planData = planification.data;
      console.log('Planification trouvée dans data:', planData);
    } else {
      console.log('Aucune donnée de planification trouvée dans la réponse');
    }
    
    if (planData) {
      console.log('Données de planification trouvées:', planData);
      
      // Formater les heures si elles existent
      const formatTime = (timeStr) => {
        if (!timeStr) return 'Non spécifiée';
        try {
          // Si c'est une date complète, on la formate
          if (timeStr.includes('T')) {
            const date = new Date(timeStr);
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          }
          // Sinon, on suppose que c'est juste l'heure
          const [hours, minutes] = timeStr.split(':');
          return `${hours.padStart(2, '0')}h${(minutes || '00').padStart(2, '0')}`;
        } catch (e) {
          console.warn('Erreur de format de temps:', e);
          return timeStr; // Retourner la valeur brute en cas d'erreur de format
        }
      };
      
      // Fonction pour afficher une modale d'erreur
      function showErrorModal(title, message) {
        const modalContent = `
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header bg-danger text-white">
                <h5 class="modal-title">${title}</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fermer"></button>
              </div>
              <div class="modal-body">
                <div class="alert alert-danger">
                  <i class="bi bi-exclamation-triangle-fill me-2"></i>
                  ${message}
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
              </div>
            </div>
          </div>
        `;
        
        let modal = document.getElementById('errorModal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'errorModal';
          modal.className = 'modal fade';
          modal.tabIndex = -1;
          document.body.appendChild(modal);
        }
        
        modal.innerHTML = modalContent;
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
      }

      // Fonction pour formater la date
      const formatDate = (dateStr) => {
        if (!dateStr) return 'Non spécifiée';
        try {
          const date = new Date(dateStr);
          return date.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        } catch (e) {
          return dateStr;
        }
      };
      
      // Fonction pour formater la localisation
      const formatLocation = (loc) => {
        if (!loc) return 'Non spécifiée';
        // Supprimer les doublons si la localisation contient plusieurs fois la même information
        const parts = loc.split(' ').filter((v, i, a) => a.indexOf(v) === i);
        return parts.join(' ');
      };
      
      // Récupérer les informations d'activité
      const activite = userActivity || planData.activite || planData.activity || planData.tache || planData.task || 'Non spécifiée';
      
      // Construire la description en combinant toutes les sources possibles
      let description = [];
      
      // Ajouter la description du rapport si disponible
      if (userActivityDescription) {
        description.push(userActivityDescription.trim());
      }
      
      // Ajouter les notes de planification si différentes de la description
      const planNotes = planData.description || planData.notes;
      if (planNotes && planNotes.trim() !== userActivityDescription?.trim()) {
        description.push(planNotes.trim());
      }
      
      // Ajouter les commentaires de validation si disponibles
      if (planData.commentaires) {
        description.push(`Commentaires: ${planData.commentaires}`.trim());
      }
      
      // Utiliser la description complète ou un message par défaut
      const fullDescription = description.length > 0 
        ? description.join('\n\n') 
        : 'Aucune description fournie';
      const datePlan = formatDate(planData.date || date);
      const heureDebutPlan = planData.heure_debut || planData.start_time || planData.start || planData.heure_debut_planifiee;
      const heureFinPlan = planData.heure_fin || planData.end_time || planData.end || planData.heure_fin_planifiee;
      const heureDebutFinal = heureDebut !== 'Non spécifiée' ? heureDebut : (heureDebutPlan ? formatTime(heureDebutPlan) : 'Non spécifiée');
      const heureFinFinal = heureFin !== 'Non spécifiée' ? heureFin : (heureFinPlan ? formatTime(heureFinPlan) : 'Non spécifiée');
      const statut = planData.status || (planData.valide ? 'Validé' : 'Planifié');
      
      // Récupérer les informations de localisation de la planification si disponibles
      const localisationPlan = planData.lieu || planData.localisation || planData.location || userLocation;
      
      // Construire le contenu du tableau de détails
      const details = [
        { 
          label: 'Informations générales', 
          value: `
            <div class="mb-2"><strong>Nom :</strong> ${userName}</div>
            <div class="mb-2"><strong>Projet :</strong> ${userProject}</div>
            <div><strong>Localisation :</strong> ${userLocation || 'Non spécifiée'}</div>
          `,
          fullWidth: true
        },
        { 
          label: 'Activité planifiée', 
          value: `
            <div class="mb-2"><strong>Activité :</strong> ${activite}</div>
            <div class="mb-2"><strong>Description :</strong></div>
            <div class="border rounded p-2 bg-light">
              ${fullDescription.replace(/\n/g, '<br>')}
            </div>
          `,
          fullWidth: true 
        },
        { 
          label: 'Horaires', 
          value: `
            <div class="mb-2"><strong>Date :</strong> ${datePlan}</div>
            <div class="mb-2"><strong>Heure de début :</strong> ${heureDebutFinal}</div>
            <div><strong>Heure de fin :</strong> ${heureFinFinal}</div>
          `,
          fullWidth: true 
        },
        { 
          label: 'Statut', 
          value: `
            <span class="badge ${
              statut === 'validé' ? 'bg-success' : 
              statut === 'en attente' ? 'bg-warning' : 
              statut === 'annulé' ? 'bg-danger' : 'bg-secondary'
            }">
              ${statut}
            </span>
            ${planData.validated_by ? `<div class="mt-2">Validé par: ${planData.validated_by}</div>` : ''}
          `
        }
      ];
      
      // Ajouter les détails spécifiques si disponibles
      if (planData.notes) {
        details.push({ label: 'Notes', value: planData.notes, fullWidth: true });
      }
      
      // Générer les lignes du tableau
      const tableRows = details.map(item => {
        if (item.fullWidth) {
          return `
            <tr>
              <th colspan="2" class="bg-light">${item.label}</th>
            </tr>
            <tr>
              <td colspan="2">${item.value || 'Non spécifié'}</td>
            </tr>
          `;
        }
        return `
          <tr>
            <th style="width: 30%;">${item.label}</th>
            <td>${item.value || 'Non spécifié'}</td>
          </tr>
        `;
      }).join('');
      
      modalContent += `
        <div class="table-responsive">
          <table class="table table-hover table-striped">
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      `;
    } else {
      modalContent += `
        <div class="alert alert-warning">
          Aucune planification trouvée pour cette date.
        </div>
      `;
    }
    modalContent += `
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
          </div>
        </div>
      </div>
    `;
    let modal = document.getElementById('planningDetailsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'planningDetailsModal';
      modal.className = 'modal fade';
      modal.tabIndex = -1;
      modal.setAttribute('aria-hidden', 'true');
      document.body.appendChild(modal);
    }
    modal.innerHTML = modalContent;
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
  } catch (error) {
    console.error('Erreur dans viewPlanningDetails:', error);
    alert('Une erreur est survenue lors du chargement des détails de la planification');
  }
}

/**
 * Applique les filtres aux validations
 */
function applyValidationsFilters(validations, filters) {
  if (!validations || !validations.length) return [];

  return validations.filter(validation => {
    // Filtre par statut
    if (filters.status) {
      if (filters.status === 'validated' && !validation.validated) return false;
      if (filters.status === 'rejected' && !validation.rejected) return false;
      if (filters.status === 'pending' && (validation.validated || validation.rejected)) return false;
    }

    // Filtre par date
    if (filters.startDate || filters.endDate) {
      const validationDate = new Date(validation.date || validation.ts || validation.created_at);
      
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (validationDate < startDate) return false;
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setDate(endDate.getDate() + 1); // Inclure le jour de fin
        if (validationDate >= endDate) return false;
      }
    }

    // Filtre par agent
    if (filters.agentId && filters.agentId !== 'all') {
      if (String(validation.agent_id) !== filters.agentId) {
        return false;
      }
    }

    // Filtre par projet
    if (filters.project && filters.project !== 'all') {
      const userProject = validation.user ? (validation.user.project_name || validation.user.projet || '') : '';
      if (cleanProjectName(userProject) !== filters.project) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Charge et affiche les validations avec les filtres actuels
 */
window.loadValidations = async function() {
  try {
    // Récupérer les valeurs des filtres
    const filters = {
      status: document.getElementById('validation-status-filter')?.value,
      startDate: document.getElementById('date-from')?.value,
      endDate: document.getElementById('date-to')?.value,
      agentId: document.getElementById('agent-filter')?.value,
      project: document.getElementById('project-filter')?.value
    };

    // Charger les rapports avec les filtres
    const rows = await fetchReportsFromBackend();
    
    // Appliquer les filtres supplémentaires spécifiques aux validations
    const filteredRows = applyValidationsFilters(rows, filters);
    
    // Afficher les résultats
    await renderValidations(filteredRows);
    
    // Mettre à jour le compteur de résultats
    const counter = document.getElementById('validations-count');
    if (counter) {
      counter.textContent = filteredRows.length;
    }
    
  } catch (error) {
    console.error('Erreur lors du chargement des validations:', error);
    showError('Erreur lors du chargement des validations');
  }
};

/**
 * Génère le rapport et affiche les statistiques
 */
window.generateReport = async function() {
  await window.loadValidations();
  const filteredRows = window.__filteredRows || [];
  const total = filteredRows.length;
  const presents = filteredRows.filter(r => !(r.statut || '').toLowerCase().includes('hors')).length;
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
  try { renderCharts(filteredRows); } catch (e) { console.warn('Charts render failed:', e?.message || e); }
};

/**
 * Exporte le rapport en CSV
 */
window.printReport = function() {
  window.print();
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

/**
 * Exporte le rapport en image
 */
function loadHtml2Canvas() {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) {
      return resolve(window.html2canvas);
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.integrity = 'sha512-DtPgXY9o0X7dJQeVD3+BTaV3VH6f3WbbVwY6JyvRkU6pqfT4WkV95F6w5VwJQJZt+2Q1RCT3v5F7V0k58ygg==';
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = (error) => {
      console.error('Erreur lors du chargement de html2canvas:', error);
      reject(new Error('Impossible de charger la bibliothèque html2canvas'));
    };
    document.head.appendChild(script);
  });
}

// Fonction pour exporter le rapport en HTML
window.exportAsHtml = async function() {
  try {
    // Créer et afficher l'indicateur de chargement
    const loading = document.createElement('div');
    loading.id = 'export-loading';
    loading.style.position = 'fixed';
    loading.style.top = '50%';
    loading.style.left = '50%';
    loading.style.transform = 'translate(-50%, -50%)';
    loading.style.padding = '20px';
    loading.style.backgroundColor = 'rgba(0,0,0,0.8)';
    loading.style.color = 'white';
    loading.style.borderRadius = '5px';
    loading.style.zIndex = '10000';
    loading.style.textAlign = 'center';
    loading.innerHTML = 'Préparation de l\'export HTML...<br><small>Cette opération peut prendre quelques secondes</small>';
    document.body.appendChild(loading);

    // Donner le temps à l'UI de se mettre à jour
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Récupérer les conteneurs des tableaux
    const reportsContainer = document.getElementById('report-results');
    const validationsSection = document.querySelector('.card:has(#validations-table)');
    
    if (!reportsContainer && !validationsSection) {
      throw new Error('Aucune donnée à exporter. Veuillez générer un rapport d\'abord.');
    }
    
    // Récupérer les informations de date filtrée
    const getReportPeriod = () => {
      try {
        const dateRange = document.getElementById('date-range');
        const dateFilter = document.getElementById('date-filter');
        
        if (!dateRange || !dateFilter) return 'Période non spécifiée';
        
        const dateValue = dateFilter.value;
        const rangeValue = dateRange.value;
        
        if (rangeValue === 'today') {
          return `Aujourd'hui (${new Date(dateValue).toLocaleDateString('fr-FR')})`;
        } else if (rangeValue === 'yesterday') {
          return `Hier (${new Date(dateValue).toLocaleDateString('fr-FR')})`;
        } else if (rangeValue === 'this_week') {
          return 'Cette semaine';
        } else if (rangeValue === 'last_week') {
          return 'La semaine dernière';
        } else if (rangeValue === 'this_month') {
          return 'Ce mois-ci';
        } else if (rangeValue === 'last_month') {
          return 'Le mois dernier';
        } else if (rangeValue === 'custom' && dateValue) {
          return `Période personnalisée: ${new Date(dateValue).toLocaleDateString('fr-FR')}`;
        } else if (dateValue) {
          return new Date(dateValue).toLocaleDateString('fr-FR');
        }
        
        return 'Période non spécifiée';
      } catch (e) {
        console.error('Erreur lors de la récupération de la période:', e);
        return 'Période non spécifiée';
      }
    };
    
    const reportPeriod = getReportPeriod();
    
    // Créer un conteneur pour l'export
    const exportContainer = document.createElement('div');
    
    // Ajouter le rapport principal s'il existe
    if (reportsContainer && reportsContainer.textContent.trim() !== '') {
      const reportsClone = reportsContainer.cloneNode(true);
      
      // Nettoyer les éléments interactifs du rapport principal
      const buttons = reportsClone.querySelectorAll('button, .btn, .no-print, #reload-validations');
      buttons.forEach(btn => btn.remove());
      
      // Désactiver les liens dans le rapport principal
      const links = reportsClone.querySelectorAll('a');
      links.forEach(link => {
        link.style.pointerEvents = 'none';
        link.style.textDecoration = 'none';
        link.style.color = 'inherit';
      });
      
      // Récupérer les données des graphiques avant de cloner
      const metricsGrid = reportsClone.querySelector('.metrics-grid');
      const chartsContainer = reportsClone.querySelector('.report-charts');
      
      // Si les graphiques existent, les convertir en images
      if (chartsContainer) {
        const charts = chartsContainer.querySelectorAll('canvas');
        charts.forEach((chart, index) => {
          try {
            const imageUrl = chart.toDataURL('image/png');
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.marginTop = '20px';
            img.style.border = '1px solid #eee';
            img.style.borderRadius = '8px';
            img.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
            
            // Remplacer le canvas par l'image
            const container = chart.closest('.chart-container');
            if (container) {
              container.innerHTML = '';
              container.appendChild(img);
            }
          } catch (e) {
            console.error('Erreur lors de la conversion du graphique en image:', e);
          }
        });
      }
      
      exportContainer.appendChild(reportsClone);
      
      // S'assurer que la grille de métriques est correctement formatée
      if (metricsGrid) {
        metricsGrid.style.display = 'grid';
        metricsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(150px, 1fr))';
        metricsGrid.style.gap = '15px';
        metricsGrid.style.margin = '20px 0';
        metricsGrid.style.padding = '0 15px';
      }
    }
    
    // Ajouter la section des validations si elle existe
    if (validationsSection && validationsSection.textContent.trim() !== '') {
      const validationsClone = validationsSection.cloneNode(true);
      
      // Nettoyer les éléments interactifs de la section des validations
      const validationButtons = validationsClone.querySelectorAll('button, .btn, .no-print');
      validationButtons.forEach(btn => btn.remove());
      
      // Ajouter un espacement avant la section des validations
      if (exportContainer.children.length > 0) {
        const spacer = document.createElement('div');
        spacer.style.marginTop = '40px';
        exportContainer.appendChild(spacer);
      }
      
      // S'assurer que le tableau de validation est bien formaté
      const validationTable = validationsClone.querySelector('table');
      if (validationTable) {
        validationTable.style.width = '100%';
        validationTable.style.marginBottom = '1.5rem';
        validationTable.style.borderCollapse = 'collapse';
      }
      
      exportContainer.appendChild(validationsClone);
    }
    // Créer le contenu HTML complet
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rapport de Présence - ${new Date().toLocaleDateString('fr-FR')}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          padding: 20px; 
          color: #333;
          line-height: 1.5;
        }
        .report-header { 
          text-align: center; 
          margin-bottom: 30px; 
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e9ecef;
          page-break-inside: avoid;
        }
        .report-title { 
          font-size: 28px; 
          font-weight: 600; 
          margin-bottom: 10px;
          color: #0d6efd;
        }
        .report-period {
          color: #495057;
          font-size: 16px;
          margin: 10px 0;
          font-weight: 500;
        }
        .report-date { 
          color: #6c757d; 
          font-size: 14px;
          margin-top: 5px;
        }
        .section { 
          margin-bottom: 40px; 
        }
        .section-title { 
          font-size: 20px; 
          font-weight: 600; 
          margin: 30px 0 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid #0d6efd;
          color: #2c3e50;
        }
        .table { 
          width: 100%; 
          margin-bottom: 1.5rem; 
          color: #212529; 
          border-collapse: collapse;
          font-size: 14px;
          box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
          page-break-inside: auto;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin: 20px 0;
          padding: 0 15px;
        }
        
        .metric-card {
          background: white;
          border-radius: 10px;
          padding: 15px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          gap: 12px;
          page-break-inside: avoid;
        }
        
        .metric-icon {
          font-size: 24px;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #f0f4ff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .metric-content {
          flex: 1;
        }
        
        .metric-value {
          font-size: 20px;
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 2px;
        }
        
        .metric-label {
          font-size: 13px;
          color: #7f8c8d;
          font-weight: 500;
        }
        
        .report-charts {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 30px 0;
          page-break-inside: avoid;
        }
        
        .chart-container {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .chart-container h4 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #2c3e50;
          font-size: 16px;
        }
        .table th { 
          background-color: #f8f9fa;
          font-weight: 600;
          text-align: left;
        }
        .table th, 
        .table td { 
          padding: 0.75rem; 
          vertical-align: middle; 
          border: 1px solid #dee2e6; 
        }
        .table thead th { 
          vertical-align: bottom; 
          border-bottom: 2px solid #dee2e6;
          background-color: #f1f3f5;
        }
        .table tbody tr:nth-child(odd) {
          background-color: rgba(0, 0, 0, 0.02);
        }
        .table tbody tr:hover {
          background-color: rgba(13, 110, 253, 0.05);
        }
        .badge {
          display: inline-block;
          padding: 0.35em 0.65em;
          font-size: 0.75em;
          font-weight: 700;
          line-height: 1;
          text-align: center;
          white-space: nowrap;
          vertical-align: baseline;
          border-radius: 0.25rem;
        }
        .badge-success {
          color: #fff;
          background-color: #198754;
        }
        .badge-warning {
          color: #000;
          background-color: #ffc107;
        }
        .badge-danger {
          color: #fff;
          background-color: #dc3545;
        }
        .no-print { 
          display: none; 
        }
        .text-center {
          text-align: center !important;
        }
        .text-end {
          text-align: right !important;
        }
        .mt-4 {
          margin-top: 1.5rem !important;
        }
        .mb-3 {
          margin-bottom: 1rem !important;
        }
        .alert {
          position: relative;
          padding: 1rem 1rem;
          margin-bottom: 1rem;
          border: 1px solid transparent;
          border-radius: 0.25rem;
        }
        .alert-info {
          color: #055160;
          background-color: #cff4fc;
          border-color: #b6effb;
        }
        .bi {
          display: inline-block;
          vertical-align: -0.125em;
        }
        @media print {
          body { 
            padding: 10px !important; 
            font-size: 12px;
            background: white;
            -webkit-print-color-adjust: exact;
          }
          .no-print { 
            display: none !important; 
          }
          .page-break { 
            page-break-before: always;
          }
          .table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead { 
            display: table-header-group;
          }
          tfoot { 
            display: table-footer-group;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="report-header">
          <h1 class="report-title">Rapport de Présence et Validations</h1>
          <div class="report-period">
            <strong>Période :</strong> ${reportPeriod}
          </div>
          <div class="report-date">
            <strong>Date du rapport :</strong> ${new Date().toLocaleDateString('fr-FR')}
          </div>
          <div class="report-date">
            Généré le ${new Date().toLocaleString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </div>
        </div>
        ${exportContainer.innerHTML}
        <div class="mt-4 text-muted small text-center">
          <p>Rapport généré par Presence CCRB - ${new Date().getFullYear()}</p>
        </div>
      </div>
      <script>
        // Script pour gérer l'impression automatique si nécessaire
        window.onload = function() {
          // Délai pour s'assurer que tout est chargé avant l'impression
          setTimeout(() => {
            // Désactiver l'impression automatique pour permettre à l'utilisateur de prévisualiser
            // window.print();
            
            // Afficher un message d'aide pour l'impression
            const printHelp = document.createElement('div');
            printHelp.style.position = 'fixed';
            printHelp.style.bottom = '20px';
            printHelp.style.left = '0';
            printHelp.style.right = '0';
            printHelp.style.textAlign = 'center';
            printHelp.style.padding = '10px';
            printHelp.style.backgroundColor = 'rgba(0,0,0,0.8)';
            printHelp.style.color = 'white';
            printHelp.style.zIndex = '10000';
            printHelp.innerHTML = 'Appuyez sur Ctrl+P pour imprimer ou faites un clic droit et sélectionnez "Enregistrer sous" pour sauvegarder le rapport';
            document.body.appendChild(printHelp);
            
            // Supprimer le message après 10 secondes
            setTimeout(() => {
              if (printHelp.parentNode) {
                printHelp.style.transition = 'opacity 1s';
                printHelp.style.opacity = '0';
                setTimeout(() => {
                  if (printHelp.parentNode) {
                    document.body.removeChild(printHelp);
                  }
                }, 1000);
              }
            }, 10000);
          }, 1000);
        };
      </script>
    </body>
    </html>
    `;

    // Créer un blob avec le contenu HTML
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    
    // Créer un lien de téléchargement
    const link = document.createElement('a');
    link.href = url;
    const fileName = `rapport-presence-${new Date().toISOString().slice(0, 10)}.html`;
    link.setAttribute('download', fileName);
    
    // Ajouter le lien au DOM, le cliquer et le supprimer
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Libérer la mémoire
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 100);
    
    // Afficher un message de confirmation
    loading.innerHTML = 'Téléchargement démarré !<br><small>Vérifiez votre dossier de téléchargement</small>';
    setTimeout(() => {
      if (loading.parentNode) {
        document.body.removeChild(loading);
      }
    }, 2000);
    
  } catch (error) {
    console.error('Erreur lors de l\'export HTML:', error);
    
    // Afficher un message d'erreur plus détaillé
    const errorMsg = `Erreur lors de l'export HTML : ${error.message || 'Erreur inconnue'}\n\nVeuillez réessayer ou contacter le support si le problème persiste.`;
    
    // Mettre à jour le message de chargement avec l'erreur
    const loading = document.getElementById('export-loading');
    if (loading) {
      loading.innerHTML = `
        <div style="color: #ff6b6b; margin-bottom: 10px;">
          <i class="bi bi-exclamation-triangle-fill"></i> Erreur
        </div>
        <div style="margin-bottom: 15px;">${error.message || 'Erreur inconnue'}</div>
        <button onclick="this.parentNode.parentNode.remove()" class="btn btn-sm btn-outline-light">Fermer</button>
      `;
    } else {
      alert(errorMsg);
    }
    
    // Afficher l'erreur dans la console pour le débogage
    console.error('Détails de l\'erreur:', error);
  }
};

// Fonction pour exporter en image
window.exportAsImage = async function() {
  const loading = document.createElement('div');
  loading.style.position = 'fixed';
  loading.style.top = '50%';
  loading.style.left = '50%';
  loading.style.transform = 'translate(-50%, -50%)';
  loading.style.padding = '20px';
  loading.style.backgroundColor = 'rgba(0,0,0,0.8)';
  loading.style.color = 'white';
  loading.style.borderRadius = '5px';
  loading.style.zIndex = '1000';
  loading.style.textAlign = 'center';
  loading.innerHTML = 'Préparation de l\'export image...<br><small>Veuillez patienter</small>';
  document.body.appendChild(loading);
  try {
    await loadHtml2Canvas();
    loading.innerHTML = 'Génération de l\'image...<br><small>Veuillez patienter</small>';
    await new Promise(resolve => setTimeout(resolve, 500));
    const element = document.getElementById('reports-container');
    if (!element) {
      throw new Error('Élément à exporter non trouvé');
    }
    const clone = element.cloneNode(true);
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '1000px';
    container.style.padding = '20px';
    container.style.backgroundColor = 'white';
    container.style.boxSizing = 'border-box';
    container.appendChild(clone);
    document.body.appendChild(container);
    const cleanElement = (el) => {
      if (!el) return;
      const buttons = el.querySelectorAll('button, .btn, .no-print');
      buttons.forEach(btn => btn.remove());
      const links = el.querySelectorAll('a[onclick]');
      links.forEach(link => {
        link.style.pointerEvents = 'none';
        link.style.textDecoration = 'none';
        link.style.color = 'inherit';
      });
      el.style.overflow = 'visible';
      el.style.boxShadow = 'none';
      el.style.border = '1px solid #eee';
      el.style.marginBottom = '20px';
      const canvases = el.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
      });
    };
    cleanElement(clone);
    const style = document.createElement('style');
    style.textContent = `
      body { background: white !important; padding: 20px !important; }
      .card { border: 1px solid #dee2e6 !important; border-radius: 0.5rem !important; margin-bottom: 1rem !important; }
      .card-body { padding: 1.25rem !important; }
      .table { width: 100% !important; margin-bottom: 1rem !important; color: #212529 !important; border-collapse: collapse !important; }
      .table th, .table td { padding: 0.75rem !important; vertical-align: top !important; border: 1px solid #dee2e6 !important; }
      .table thead th { vertical-align: bottom !important; border-bottom: 2px solid #dee2e6 !important; }
      .badge { font-size: 90% !important; padding: 0.35em 0.65em !important; }
      .stats-grid { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important; gap: 15px !important; margin: 20px 0 !important; }
      .stat-card { background: #f8f9fa !important; border-radius: 8px !important; padding: 15px !important; text-align: center !important; }
      canvas { max-width: 100% !important; height: auto !important; display: block !important; }
    `;
    container.prepend(style);
    await new Promise(resolve => setTimeout(resolve, 500));
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    });
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.download = `rapport-${date}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Erreur lors de la génération de l\'image:', error);
    alert('Une erreur est survenue lors de l\'export en image : ' + (error.message || 'Erreur inconnue'));
  } finally {
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
    if (loading && loading.parentNode) {
      document.body.removeChild(loading);
    }
  }
};

/**
 * Récupère tous les utilisateurs avec pagination et gestion améliorée des erreurs
 */
async function fetchAllUsers() {
  const allUsers = [];
  const limit = 200; // Augmenté à 200 pour réduire le nombre de requêtes
  let page = 1;
  let totalPages = 1;
  let hasMore = true;
  let retryCount = 0;
  const maxRetries = 3;

  while (hasMore && page <= totalPages) {
    try {
      console.log(`Chargement des utilisateurs - Page ${page}/${totalPages}...`);
      const result = await api(`/users?page=${page}&limit=${limit}`);
      
      // Gestion de la réponse paginée
      let users = [];
      if (Array.isArray(result)) {
        users = result;
      } else if (result?.items) {
        users = result.items;
        // Mise à jour du nombre total de pages si disponible
        if (result.total_pages && result.total_pages > totalPages) {
          totalPages = result.total_pages;
          console.log(`Nombre total de pages détecté: ${totalPages}`);
        }
      } else if (result?.data) {
        users = Array.isArray(result.data) ? result.data : [result.data];
      }
      
      if (users.length > 0) {
        allUsers.push(...users);
        console.log(`${users.length} utilisateurs chargés (total: ${allUsers.length})`);
        
        // Si on n'a pas d'information sur le nombre total de pages, on continue jusqu'à ce qu'une page soit vide
        if (totalPages === 1 && users.length === limit) {
          page++;
        } else {
          page++;
        }
        
        // Réinitialiser le compteur de tentatives en cas de succès
        retryCount = 0;
      } else {
        hasMore = false;
      }
      
      // Limite de sécurité pour éviter les boucles infinies
      if (page > 50) {
        console.warn('Limite de 50 pages atteinte lors du chargement des utilisateurs');
        break;
      }
    } catch (error) {
      console.error(`Erreur lors du chargement de la page ${page}:`, error);
      
      // Stratégie de nouvel essai pour les erreurs 500
      if (error.message && error.message.includes('500') && retryCount < maxRetries) {
        retryCount++;
        const delay = 1000 * retryCount; // Délai exponentiel
        console.log(`Nouvel essai ${retryCount}/${maxRetries} dans ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Si on a déjà des utilisateurs, on continue avec ce qu'on a
      if (allUsers.length > 0) {
        console.warn(`Chargement partiel: ${allUsers.length} utilisateurs chargés avant l'erreur`);
        hasMore = false;
      } else {
        // Si aucune donnée n'a pu être chargée, on lance l'erreur
        throw error;
      }
    }
  }
  
  console.log(`Chargement des utilisateurs terminé. Total: ${allUsers.length} utilisateurs`);
  return allUsers;
}

/**
 * Charge les utilisateurs pour le filtre des agents
 * Inclut tous les utilisateurs avec leurs rôles respectifs
 */
async function loadAgentsForFilter() {
  const select = document.getElementById('agent-filter');
  if (!select) {
    console.error('Élément agent-filter non trouvé dans le DOM');
    return;
  }
  
  // Afficher un indicateur de chargement
  const loadingOption = document.createElement('option');
  loadingOption.textContent = 'Chargement des utilisateurs...';
  loadingOption.disabled = true;
  select.innerHTML = '';
  select.appendChild(loadingOption);
  
  try {
    // Récupérer tous les utilisateurs avec pagination
    const users = await fetchAllUsers();
    
    // Sauvegarder la valeur actuelle avant de vider le select
    const currentValue = select.value;
    
    // Vider et réinitialiser le sélecteur
    select.innerHTML = '<option value="all">Tous les utilisateurs</option>';
    
    if (users.length === 0) {
      console.warn('Aucun utilisateur trouvé');
      return;
    }
    
    console.log(`Total de ${users.length} utilisateurs chargés`);
    
    // Créer un Set pour éliminer les doublons (au cas où)
    const uniqueUsers = [];
    const seenIds = new Set();
    
    // Filtrer pour ne garder que les utilisateurs avec le rôle 'Agent' (insensible à la casse)
    users.forEach(user => {
      if (!user || !user.id || seenIds.has(String(user.id))) return;
      
      // Vérifier si l'utilisateur a le rôle 'Agent' (insensible à la casse)
      const userRole = String(user.role || '').toLowerCase().trim();
      if (userRole !== 'agent') {
        console.log(`Utilisateur non inclus (rôle: ${user.role}):`, user);
        return;
      }
      
      seenIds.add(String(user.id));
      uniqueUsers.push(user);
    });
    
    console.log(`${uniqueUsers.length} utilisateurs uniques après déduplication`);
    
    // Trier les utilisateurs par nom
    const sortedUsers = [...uniqueUsers].sort((a, b) => {
      const nameA = (a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || '').toLowerCase();
      const nameB = (b.name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.email || '').toLowerCase();
      return nameA.localeCompare(nameB, 'fr');
    });
    
    // Ajouter chaque utilisateur comme option
    sortedUsers.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      
      // Construire le nom d'affichage selon la structure de la table users
      let displayName = '';
      if (user.name && user.name.trim()) {
        displayName = user.name.trim();
      } else if (user.first_name || user.last_name) {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        displayName = `${firstName} ${lastName}`.trim();
      } else {
        displayName = user.email || `Utilisateur ${user.id}`;
      }
      
      // Ajouter le rôle entre parenthèses s'il est disponible
      if (user.role) {
        displayName += ` (${user.role})`;
      }
      
      option.textContent = displayName;
      select.appendChild(option);
    });
    
    // Restaurer la valeur précédente si elle existe toujours
    if (currentValue && currentValue !== 'all') {
      const userExists = uniqueUsers.some(user => String(user.id) === currentValue);
      if (userExists) {
        select.value = currentValue;
        console.log(`Valeur précédente restaurée: ${currentValue}`);
      }
    }
    
    console.log('Chargement des utilisateurs terminé');
    
  } catch (error) {
    console.error('Erreur lors du chargement des utilisateurs:', error);
    select.innerHTML = '<option value="all">Erreur de chargement des utilisateurs</option>';
  }
}

/**
 * Vérifie si un utilisateur est un superviseur basé sur son rôle ou ses propriétés
 */
function isSupervisorUser(user) {
  if (!user) return false;
  
  // Vérifier le rôle de différentes manières
  const role = String(user.role || '').toLowerCase().trim();
  const isSupervisorRole = [
    'superviseur', 'supervisor', 'superviseur principal', 'superviseur technique',
    'superviseur terrain', 'chef d\'équipe', 'team lead', 'manager',
    'chef de zone', 'responsable', 'coordinateur', 'coordonnateur'
  ].some(r => role.includes(r.toLowerCase()));
  
  // Vérifier également les champs booléens si disponibles
  const isSupervisorFlag = user.is_supervisor === true || 
                          user.is_supervisor === 'true' || 
                          user.is_supervisor === 1 || 
                          user.is_supervisor === '1';
  
  // Vérifier aussi le type de rôle si disponible
  const roleType = String(user.role_type || '').toLowerCase().trim();
  const isSupervisorRoleType = [
    'superviseur', 'supervisor', 'manager', 'admin', 'administrateur'
  ].some(rt => roleType.includes(rt.toLowerCase()));
  
  return isSupervisorRole || isSupervisorFlag || isSupervisorRoleType;
}

/**
 * Charge les superviseurs pour le filtre
 */
async function loadSupervisorsForFilter() {
  const select = document.getElementById('supervisor-filter');
  if (!select) {
    console.error('Élément select supervisor-filter non trouvé dans le DOM');
    return;
  }
  
  // Afficher un indicateur de chargement
  const loadingOption = document.createElement('option');
  loadingOption.textContent = 'Chargement des superviseurs...';
  loadingOption.disabled = true;
  select.innerHTML = '';
  select.appendChild(loadingOption);
  
  try {
    // Utiliser la fonction fetchAllUsers qui gère déjà la pagination
    const users = await fetchAllUsers();
    
    // Sauvegarder la valeur actuelle avant de vider le select
    const currentValue = select.value;
    
    // Vider et réinitialiser le sélecteur
    select.innerHTML = '<option value="all">Tous les superviseurs</option>';
    
    if (users.length === 0) {
      console.warn('Aucun utilisateur trouvé pour le filtre des superviseurs');
      return;
    }
    
    console.log(`Analyse de ${users.length} utilisateurs pour trouver les superviseurs`);
    
    // Filtrer les superviseurs
    const supervisors = users.filter(user => {
      if (!user || !user.id) return false;
      return isSupervisorUser(user);
    });
    
    console.log(`${supervisors.length} superviseurs trouvés sur ${users.length} utilisateurs`);
    
    // Afficher les superviseurs dans la console pour le débogage
    console.log('Superviseurs trouvés:', supervisors.map(s => ({
      id: s.id,
      name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      email: s.email,
      role: s.role,
      role_type: s.role_type,
      is_supervisor: s.is_supervisor
    })));
    
    // Trier les superviseurs par nom
    const sortedSupervisors = [...supervisors].sort((a, b) => {
      const nameA = (a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || '').toLowerCase();
      const nameB = (b.name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.email || '').toLowerCase();
      return nameA.localeCompare(nameB, 'fr');
    });
    
    // Ajouter chaque superviseur comme option
    sortedSupervisors.forEach(supervisor => {
      const option = document.createElement('option');
      option.value = supervisor.id;
      
      // Construire le nom d'affichage
      let displayName = '';
      if (supervisor.name && supervisor.name.trim()) {
        displayName = supervisor.name.trim();
      } else if (supervisor.first_name || supervisor.last_name) {
        const firstName = supervisor.first_name || '';
        const lastName = supervisor.last_name || '';
        displayName = `${firstName} ${lastName}`.trim();
      } else {
        displayName = supervisor.email || `Superviseur ${supervisor.id}`;
      }
      
      // Ajouter le rôle entre parenthèses s'il est disponible
      if (supervisor.role) {
        displayName += ` (${supervisor.role})`;
      } else if (supervisor.role_type) {
        displayName += ` (${supervisor.role_type})`;
      }
      
      option.textContent = displayName;
      select.appendChild(option);
    });
    
    // Restaurer la valeur précédente si elle existe toujours
    if (currentValue && currentValue !== 'all') {
      const supervisorExists = sortedSupervisors.some(s => String(s.id) === currentValue);
      if (supervisorExists) {
        select.value = currentValue;
        console.log(`Valeur précédente restaurée: ${currentValue}`);
      }
    }
    
    console.log('Chargement des superviseurs terminé');
    
  } catch (error) {
    console.error('Erreur lors du chargement des superviseurs:', error);
    select.innerHTML = '<option value="all">Erreur de chargement des superviseurs</option>';
  }
}

/**
 * Charge les départements pour le filtre
 */
async function loadDepartmentsForFilter() {
  try {
    // Données géographiques intégrées pour le Bénin
    const departments = [
      { id: 1, name: "Atlantique" },
      { id: 2, name: "Borgou" },
      { id: 3, name: "Collines" },
      { id: 4, name: "Couffo" },
      { id: 5, name: "Donga" },
      { id: 6, name: "Littoral" },
      { id: 7, name: "Mono" },
      { id: 8, name: "Ouémé" },
      { id: 9, name: "Plateau" },
      { id: 10, name: "Zou" }
    ];
    
    const select = document.getElementById('department-filter');
    if (!select) return;
    
    // Sauvegarder la valeur actuelle
    const currentValue = select.value;
    
    // Vider et réinitialiser le sélecteur
    select.innerHTML = '<option value="all">Tous les départements</option>';
    
    // Ajouter chaque département comme option
    departments.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = dept.name;
      select.appendChild(option);
    });
    
    // Restaurer la valeur précédente si elle existe toujours
    if (currentValue && currentValue !== 'all') {
      const deptExists = departments.some(dept => String(dept.id) === currentValue);
      if (deptExists) {
        select.value = currentValue;
      }
    }
    
    console.log(`${departments.length} départements chargés pour le filtre`);
  } catch (error) {
    console.error('Erreur lors du chargement des départements:', error);
  }
}

/**
 * Charge les communes pour un département donné
 */
async function loadCommunesForFilter(departmentId) {
  try {
    // Données géographiques intégrées pour le Bénin
    const communesData = {
      "1": [
        { id: 1, name: "Abomey-Calavi" },
        { id: 2, name: "Allada" },
        { id: 3, name: "Kpomassè" },
        { id: 4, name: "Ouidah" },
        { id: 5, name: "Sô-Ava" },
        { id: 6, name: "Toffo" },
        { id: 7, name: "Tori-Bossito" },
        { id: 8, name: "Zè" }
      ],
      "2": [
        { id: 9, name: "Bembèrèkè" },
        { id: 10, name: "Kalalé" },
        { id: 11, name: "N'Dali" },
        { id: 12, name: "Nikki" },
        { id: 13, name: "Parakou" },
        { id: 14, name: "Pèrèrè" },
        { id: 15, name: "Sinendé" },
        { id: 16, name: "Tchaourou" }
      ],
      "3": [
        { id: 17, name: "Bantè" },
        { id: 18, name: "Dassa-Zoumè" },
        { id: 19, name: "Glazoué" },
        { id: 20, name: "Ouèssè" },
        { id: 21, name: "Savalou" },
        { id: 22, name: "Savé" }
      ],
      "4": [
        { id: 23, name: "Aplahoué" },
        { id: 24, name: "Djakotomey" },
        { id: 25, name: "Klouékanmè" },
        { id: 26, name: "Lalo" },
        { id: 27, name: "Toviklin" }
      ],
      "5": [
        { id: 28, name: "Bassila" },
        { id: 29, name: "Copargo" },
        { id: 30, name: "Djougou" },
        { id: 31, name: "Ouaké" }
      ],
      "6": [
        { id: 32, name: "Cotonou" },
        { id: 33, name: "Porto-Novo" }
      ],
      "7": [
        { id: 34, name: "Athiémè" },
        { id: 35, name: "Bopa" },
        { id: 36, name: "Comè" },
        { id: 37, name: "Grand-Popo" },
        { id: 38, name: "Houéyogbé" },
        { id: 39, name: "Lokossa" }
      ],
      "8": [
        { id: 40, name: "Adjarra" },
        { id: 41, name: "Adjohoun" },
        { id: 42, name: "Aguégués" },
        { id: 43, name: "Akpro-Missérété" },
        { id: 44, name: "Avrankou" },
        { id: 45, name: "Bonou" },
        { id: 46, name: "Dangbo" },
        { id: 47, name: "Porto-Novo" },
        { id: 48, name: "Sèmè-Kpodji" }
      ],
      "9": [
        { id: 49, name: "Ifangni" },
        { id: 50, name: "Adja-Ouèrè" },
        { id: 51, name: "Kétou" },
        { id: 52, name: "Pobè" },
        { id: 53, name: "Sakété" }
      ],
      "10": [
        { id: 54, name: "Abomey" },
        { id: 55, name: "Agbangnizoun" },
        { id: 56, name: "Bohicon" },
        { id: 57, name: "Covè" },
        { id: 58, name: "Djidja" },
        { id: 59, name: "Ouinhi" },
        { id: 60, name: "Za-Kpota" },
        { id: 61, name: "Zangnanado" },
        { id: 62, name: "Zogbodomey" }
      ]
    };
    
    const select = document.getElementById('commune-filter');
    if (!select) return;
    
    // Sauvegarder la valeur actuelle
    const currentValue = select.value;
    
    if (!departmentId || departmentId === 'all') {
      // Vider et désactiver le sélecteur
      select.innerHTML = '<option value="all">Sélectionnez d\'abord un département</option>';
      select.disabled = true;
    } else {
      // Activer le sélecteur et charger les communes
      select.disabled = false;
      const communes = communesData[departmentId] || [];
      
      // Vider et réinitialiser le sélecteur
      select.innerHTML = '<option value="all">Toutes les communes</option>';
      
      // Ajouter chaque commune comme option
      communes.forEach(commune => {
        const option = document.createElement('option');
        option.value = commune.id;
        option.textContent = commune.name;
        select.appendChild(option);
      });
      
      // Restaurer la valeur précédente si elle existe toujours
      if (currentValue && currentValue !== 'all') {
        const communeExists = communes.some(commune => String(commune.id) === currentValue);
        if (communeExists) {
          select.value = currentValue;
        }
      }
      
      console.log(`${communes.length} communes chargées pour le département ${departmentId}`);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des communes:', error);
  }
}

/**
 * Nettoie et normalise le nom d'un projet pour une comparaison cohérente
 * @param {string} name - Le nom du projet à nettoyer
 * @returns {string|null} Le nom nettoyé ou null si invalide
 */
function cleanProjectName(name) {
  if (!name && name !== 0) return null;
  
  // Convertir en chaîne si ce n'est pas déjà le cas et nettoyer
  let cleaned = String(name)
    .trim() // Enlève les espaces en début et fin
    .normalize('NFD') // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques
    .toLowerCase() // Convertit en minuscules
    .replace(/[^\w\s-]/g, ' ') // Remplace les caractères spéciaux par des espaces
    .replace(/\s+/g, ' ') // Remplace les espaces multiples par un seul
    .trim(); // Enlève à nouveau les espaces en début et fin
    
  // Supprimer les guillemets (simples/doubles) qui pourraient rester
  cleaned = cleaned.replace(/^["\']+|["\']+$/g, '').trim();
  
  // Si après nettoyage on a une chaîne vide, on retourne null
  return cleaned || null;
}

/**
 * Met à jour la liste déroulante des projets
 */
function updateProjectSelect(projectsList) {
  const select = document.getElementById('project-filter');
  if (!select) return;
  
  const currentValue = select.value;
  select.innerHTML = '<option value="all">Tous les projets</option>';
  
  projectsList.forEach(project => {
    const option = document.createElement('option');
    option.value = project;
    option.textContent = project;
    select.appendChild(option);
  });
  
  // Restaurer la sélection précédente si elle existe toujours
  if (currentValue && currentValue !== 'all') {
    const cleanedCurrentValue = cleanProjectName(currentValue);
    if (projectsList.includes(cleanedCurrentValue)) {
      select.value = cleanedCurrentValue;
    }
  }
}

/**
 * Charge les projets pour le filtre depuis la colonne project_name de la table users
 */
async function loadProjectsForFilter() {
  const projects = new Set();
  const select = document.getElementById('project-filter');
  
  if (!select) {
    console.error('❌ Élément select project-filter non trouvé dans le DOM');
    return [];
  }
  
  try {
    console.log('Début du chargement des projets depuis la table users...');
    
    // Essayer d'abord de récupérer tous les projets en une seule requête
    try {
      console.log('Tentative de chargement des projets en une seule requête...');
      const result = await api('/users?select=project_name&limit=1000');
      const users = Array.isArray(result) ? result : (result?.items || result?.data || []);
      
      users.forEach(user => {
        try {
          if (!user || !user.project_name) return;
          const projectName = cleanProjectName(user.project_name);
          if (projectName) projects.add(projectName);
        } catch (error) {
          console.warn('Erreur lors du traitement d\'un utilisateur:', error);
        }
      });
      
      const projectsArray = Array.from(projects).sort((a, b) => a.localeCompare(b, 'fr'));
      console.log(`✅ ${projectsArray.length} projets chargés en une seule requête`);
      updateProjectSelect(projectsArray);
      return projectsArray;
      
    } catch (error) {
      console.warn('Impossible de charger tous les projets en une seule requête, tentative de chargement par lots...', error);
      
      // Réinitialiser l'ensemble des projets pour le chargement par lots
      projects.clear();
      const limit = 50;
      let page = 1;
      let hasMore = true;

      // Boucle pour récupérer les utilisateurs par lots
      while (hasMore) {
        try {
          console.log(`Chargement du lot ${page}...`);
          const result = await api(`/users?page=${page}&limit=${limit}`);
          const users = Array.isArray(result) ? result : (result?.items || result?.data || []);
          
          if (users.length > 0) {
            // Traiter les utilisateurs immédiatement sans les stocker tous en mémoire
            users.forEach(user => {
              try {
                if (!user || !user.project_name) return;
                const projectName = cleanProjectName(user.project_name);
                if (projectName) projects.add(projectName);
              } catch (error) {
                console.warn('Erreur lors du traitement d\'un utilisateur:', error);
              }
            });
            
            console.log(`Lot ${page} traité avec succès (${users.length} utilisateurs, ${projects.size} projets uniques)`);
            
            // Passer au lot suivant
            page++;
            
            // Limiter le nombre de pages pour éviter les boucles infinies
            if (page > 20) { // Limite de sécurité
              console.warn('Limite de 20 lots atteinte');
              hasMore = false;
            }
          } else {
            hasMore = false; // Plus de données à charger
          }
        } catch (error) {
          console.error(`Erreur lors du chargement du lot ${page}:`, error);
          hasMore = false; // En cas d'erreur, on s'arrête avec ce qu'on a
        }
      }
    }
    
    // Mise à jour finale de la liste des projets
    const projectsArray = Array.from(projects).sort((a, b) => a.localeCompare(b, 'fr'));
    console.log(`✅ Chargement terminé. ${projectsArray.length} projets uniques trouvés.`);
    
    // Mettre à jour l'interface utilisateur avec les projets chargés
    updateProjectSelect(projectsArray);
    
    console.log(`✅ ${projectsArray.length} projets uniques chargés dans le filtre.`);
    console.log('Liste complète des projets:', projectsArray);
    
    return projectsArray;
    
  } catch (outerError) {
    console.error('❌ Erreur lors du chargement des projets:', outerError);
    
    // Même en cas d'erreur, on essaie d'afficher les projets déjà chargés
    if (projects && projects.size > 0) {
      console.log(`Utilisation de ${projects.size} projets déjà chargés malgré l'erreur`);
      return Array.from(projects);
    }
    
    // Fallback en cas d'échec total
    if (select) {
      select.innerHTML = '<option value="all">Erreur de chargement - Réessayez plus tard</option>';
    }
    return [];
  }
}

/**
 * Vérifie si une date correspond à une date précise
 */
function dateMatchesPrecise(preciseYmd, value) {
  try {
    if (!value) return false;
    let d;
    if (typeof value === 'number') {
      d = new Date(value);
    } else if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
      d = new Date(value);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(String(value))) {
      const [dd, mm, yyyy] = String(value).split(/[\s/]/);
      d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    } else {
      d = new Date(value);
    }
    if (!d || isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const localDate = `${y}-${m}-${day}`;
    const isoDate = d.toISOString().slice(0, 10);
    return localDate === preciseYmd || isoDate === preciseYmd;
  } catch {
    return false;
  }
}

/**
 * Affiche les graphiques de présence
 */
function renderCharts(rows) {
  // 1. Préparation des données pour le graphique de présence par jour
  const byDate = new Map();
  const fmtYMD = d => {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  };
  
  // 2. Préparation des données pour le graphique par statut
  const statusCounts = new Map();
  
  (rows || []).forEach(r => {
    if (!r.ts) return;
    
    // Pour le graphique de présence par jour
    const key = fmtYMD(r.ts);
    const rec = byDate.get(key) || { present: 0, total: 0 };
    rec.total++;
    if (!String(r.statut || '').toLowerCase().includes('hors')) rec.present++;
    byDate.set(key, rec);
    
    // Pour le graphique par statut
    const status = r.statut?.trim() || 'Non spécifié';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });
  
  const labels = Array.from(byDate.keys()).sort();
  const presentValues = labels.map(k => byDate.get(k).present);
  
  // Nettoyage des anciens graphiques
  try { if (presenceLineChart) { presenceLineChart.destroy(); presenceLineChart = null; } } catch (e) { console.error(e); }
  try { if (rolePieChart) { rolePieChart.destroy(); rolePieChart = null; } } catch (e) { console.error(e); }
  try { if (statusPieChart) { statusPieChart.destroy(); statusPieChart = null; } } catch (e) { console.error(e); }
  
  // 3. Graphique de présence par jour (ligne)
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
        plugins: { 
          legend: { 
            display: true,
            position: 'top'
          },
          title: {
            display: true,
            text: 'Présence quotidienne',
            font: {
              size: 16
            }
          }
        },
        scales: { 
          y: { 
            beginAtZero: true, 
            ticks: { precision: 0 },
            title: {
              display: true,
              text: 'Nombre de présences'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          }
        }
      }
    });
  }
  let present = 0, absent = 0;
  const agentsSet = new Map();
  (rows || []).forEach(r => {
    const key = r.agent_id || r.agent || Math.random();
    const isPresent = !String(r.statut || '').toLowerCase().includes('hors');
    if (!agentsSet.has(key)) {
      agentsSet.set(key, isPresent);
    } else {
      agentsSet.set(key, agentsSet.get(key) || isPresent);
    }
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

// Initialisation
document.addEventListener('DOMContentLoaded', async function() {
  console.log('🚀 Initialisation de reports.js (version backend)');
  await checkAuth();
  
  // Charger tous les filtres
  await Promise.all([
    loadAgentsForFilter(),
    loadSupervisorsForFilter(),
    loadProjectsForFilter(),
    loadDepartmentsForFilter()
  ]);
  
  // Gestionnaires d'événements pour les filtres
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
    applyBtn.addEventListener('click', async () => { 
      try { 
        await window.generateReport(); 
      } catch (e) { 
        console.error(e); 
      } 
    });
  }
  
  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      try {
        const dr = document.getElementById('date-range'); if (dr) dr.value = 'month';
        const df = document.getElementById('date-filter'); if (df) df.value = '';
        const ag = document.getElementById('agent-filter'); if (ag) ag.value = 'all';
        const sup = document.getElementById('supervisor-filter'); if (sup) sup.value = 'all';
        const pj = document.getElementById('project-filter'); if (pj) pj.value = 'all';
        const dept = document.getElementById('department-filter'); if (dept) dept.value = 'all';
        const comm = document.getElementById('commune-filter'); if (comm) comm.value = 'all';
        const rr = document.getElementById('report-results'); if (rr) rr.style.display = 'none';
        
        // Réinitialiser les communes
        loadCommunesForFilter('all');
      } catch (e) { 
        console.error(e); 
      }
    });
  }
  
  // Gestionnaire pour le changement de département
  const departmentSelect = document.getElementById('department-filter');
  if (departmentSelect) {
    departmentSelect.addEventListener('change', (e) => {
      const departmentId = e.target.value;
      loadCommunesForFilter(departmentId);
    });
  }
  
  // Gestionnaires pour les autres filtres
  const filterSelects = [
    'agent-filter',
    'supervisor-filter', 
    'project-filter',
    'commune-filter'
  ];
  
  filterSelects.forEach(filterId => {
    const select = document.getElementById(filterId);
    if (select) {
      select.addEventListener('change', () => {
        // Optionnel: recharger automatiquement les données quand un filtre change
        // window.generateReport();
      });
    }
  });
  
  window.updateDateInputs();
  const dateInput = document.getElementById('date');
  if (dateInput) {
    dateInput.addEventListener('change', loadUsersPlanning);
  }
  
  try {
    await loadUsersPlanning();
    await window.generateReport();
  } catch (error) {
    console.error('Erreur lors du chargement initial:', error);
  }
  console.log('✅ Reports.js initialisé avec succès');
});
