// Script pour la page de rapports - Version Backend uniquement
let jwt = localStorage.getItem('jwt') || '';
let currentUser = null;
let presenceLineChart = null;
let rolePieChart = null;
let statusPieChart = null;
const apiBase = '/api';
let cachedSupabaseConfig = null;

function getSupabaseConfig() {
  if (cachedSupabaseConfig) return cachedSupabaseConfig;
  try {
    const metaUrl = document.querySelector('meta[name="supabase-url"]')?.content || '';
    const metaKey = document.querySelector('meta[name="supabase-anon-key"]')?.content || '';
    const lsUrl = localStorage.getItem('SUPABASE_URL') || '';
    const lsKey = localStorage.getItem('SUPABASE_ANON_KEY') || '';
    const url = ((typeof window !== 'undefined' && window.SUPABASE_URL) || metaUrl || lsUrl || '').trim().replace(/\/+$/, '');
    const key = ((typeof window !== 'undefined' && window.SUPABASE_ANON_KEY) || metaKey || lsKey || '').trim();
    if (url && key) {
      cachedSupabaseConfig = { url, key };
      return cachedSupabaseConfig;
    }
  } catch (error) {
    console.warn('Impossible de récupérer la configuration Supabase:', error?.message || error);
  }
  return null;
}

async function fetchPlanificationsFromSupabase(date, filters = {}, userList = []) {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    console.warn('⚠️ Aucun accès direct à Supabase pour le fallback des planifications.');
    return [];
  }

  const { url, key } = cfg;
  const search = new URLSearchParams();
  const selectColumns = [
    'id',
    'user_id',
    'agent_id',
    'date',
    'date_planification',
    'planned_date',
    'planned_start_time',
    'planned_end_time',
    'planifie',
    'project_name',
    'projet',
    'departement',
    'commune',
    'description',
    'description_activite',
    'notes',
    'resultat_journee',
    'supervisor_id',
    'created_at',
    'updated_at'
  ];

  search.set(
    'select',
    `${selectColumns.join(',')},users(id,name,first_name,last_name,email,role,project_name,departement,commune,supervisor_id,supervisor)`
  );
  search.set('limit', '1000');
  search.set('order', 'date.desc');

  if (date) {
    search.append('date', `gte.${date}`);
    search.append('date', `lte.${date}`);
  }

  const requestOptions = {
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Cache-Control': 'no-cache'
    }
  };

  try {
    const response = await fetch(`${url}/rest/v1/planifications?${search.toString()}`, requestOptions);
    if (!response.ok) {
      console.warn('⚠️ Fallback Supabase planifications échoué:', response.status, response.statusText);
      return [];
    }

    const payload = await response.json().catch(() => []);
    const rows = Array.isArray(payload)
      ? payload
      : (payload?.items && Array.isArray(payload.items) ? payload.items : []);

    if (!rows.length) {
      return [];
    }

    const userMap = new Map();
    (userList || []).forEach(u => {
      if (!u) return;
      const identifier = u.id ?? u.user_id ?? u.userId;
      if (identifier != null) {
        userMap.set(String(identifier), u);
      }
    });

    const normalized = rows
      .map(row => {
        const rawId =
          row.user_id ??
          row.agent_id ??
          row.users?.id ??
          row.userId ??
          row.agentId ??
          null;
        if (rawId == null) return null;
        const idStr = String(rawId);
        const associatedUser =
          row.users ||
          row.user ||
          userMap.get(idStr) ||
          null;

        return {
          ...row,
          user_id: row.user_id ?? rawId,
          agent_id: row.agent_id ?? rawId,
          date: row.date || row.date_planification || row.planned_date || date,
          project_name: row.project_name || row.projet || associatedUser?.project_name || null,
          departement: row.departement || associatedUser?.departement || null,
          commune: row.commune || associatedUser?.commune || null,
          user: associatedUser
        };
      })
      .filter(Boolean);

    const departmentNames = {
      '1': 'Atacora',
      '2': 'Atacora-Donga',
      '3': 'Collines',
      '4': 'Couffo',
      '5': 'Donga',
      '6': 'Littoral',
      '7': 'Mono',
      '8': 'Ouémé',
      '9': 'Plateau',
      '10': 'Zou'
    };

    const normalize = value =>
      value ? String(value).trim().toLowerCase() : '';

    return normalized.filter(row => {
      const rowIdStr = String(row.user_id ?? row.agent_id ?? '');
      if (!rowIdStr) return false;

      if (filters.agentId && filters.agentId !== 'all') {
        const agentFilter = String(filters.agentId);
        if (rowIdStr !== agentFilter) return false;
      }

      if (filters.project && filters.project !== 'all') {
        const planProject = cleanProjectName(row.project_name);
        const filterProject = cleanProjectName(filters.project);
        if (filterProject && (!planProject || planProject.toLowerCase() !== filterProject.toLowerCase())) {
          return false;
        }
      }

      if (filters.department && filters.department !== 'all') {
        const expectedDept = departmentNames[filters.department] || filters.department;
        const rowDept = row.departement || row.department;
        if (normalize(rowDept) !== normalize(expectedDept)) {
          return false;
        }
      }

      if (filters.commune && filters.commune !== 'all') {
        const rowCommune = row.commune || row.user?.commune;
        if (normalize(rowCommune) !== normalize(filters.commune)) {
          return false;
        }
      }

      if (filters.supervisorId && filters.supervisorId !== 'all') {
        const supervisor =
          row.supervisor_id ??
          row.user?.supervisor_id ??
          row.user?.supervisor ??
          row.user?.supervisorId;
        if (supervisor && String(supervisor) !== String(filters.supervisorId)) {
          return false;
        }
      }

      return true;
    });
  } catch (error) {
    console.error('❌ Erreur lors du fallback Supabase planifications:', error);
    return [];
  }
}

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
      
    // Filtrer pour ne garder que les agents et superviseurs (rôles 'agent' et 'superviseur')
    const fieldUsersOnly = users.filter(user => user.role === 'agent' || user.role === 'superviseur');
    console.log(`✅ ${fieldUsersOnly.length} agents/superviseurs chargés sur ${users.length} utilisateurs totaux`);
      
    // S'assurer que les clés de la map sont des chaînes pour éviter les erreurs de type
    const usersById = new Map(fieldUsersOnly.map(u => [String(u.id), u]));
    console.log(`✅ ${fieldUsersOnly.length} agents/superviseurs chargés`);
    console.log(`🔑 User IDs disponibles: ${Array.from(usersById.keys()).slice(0, 10).join(', ')}...`);

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

          // Transformer les données de l'API vers le format attendu
          const enrichedRows = [];
          const skippedRows = [];
          pageData.forEach(row => {
            // Transformer le format de l'API vers le format attendu par renderValidations
            const transformedRow = {
              id: row.validation_id || row.id,
              agent_id: row.agent_id,
              ts: row.created_at || row.date,
              lat: row.lat,
              lon: row.lon,
              ref_lat: row.ref_lat,
              ref_lon: row.ref_lon,
              distance_m: row.distance_m,
              rayon_m: row.tolerance_m,
              localisation: row.localisation,
              statut: row.status_presence || row.statut,
              projet: row.projet,
              validation_notes: row.note,
              user: null
            };

            // Log de débogage pour vérifier les coordonnées
            if (!row.ref_lat || !row.ref_lon) {
              console.warn(`⚠️ Agent ${row.agent} (ID: ${row.agent_id}) n'a pas de coordonnées de référence`);
            }
            if (!row.lat || !row.lon) {
              console.warn(`⚠️ Validation ${row.validation_id} n'a pas de coordonnées de checkin`);
            }

            const agentIdStr = String(row.agent_id || row.user_id);
            if (usersById.has(agentIdStr)) {
              transformedRow.user = usersById.get(agentIdStr);
              enrichedRows.push(transformedRow);
            } else {
              // Conserver le rapport même sans données utilisateur
              skippedRows.push(row);
              transformedRow.user = {
                name: row.agent || `Agent ${row.agent_id}`,
                project_name: row.projet
              };
              enrichedRows.push(transformedRow);
            }
          });
          
          if (skippedRows.length > 0) {
            console.warn(`⚠️ ${skippedRows.length} rapports sans correspondance utilisateur (agent_id: ${skippedRows.slice(0, 3).map(r => r.agent_id || r.user_id).join(', ')})`);
          }
          
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
        
        // Vérification de correspondance du projet (insensible à la casse)
        if (cleanedUserProject?.toLowerCase() !== cleanedFilterProject?.toLowerCase()) {
          return false;
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
      
      // Filtre par superviseur (si un superviseur spécifique est sélectionné)
      if (supervisorId && supervisorId !== 'all') {
        // Le superviseur peut être dans différents champs
        const userSupervisorId = user.supervisor_id || user.supervisor || user.supervisor_email || user.supervisorId;
        // Vérifier si le user a un superviseur
        if (userSupervisorId && String(userSupervisorId) !== String(supervisorId)) {
          // console.log(`Filtre superviseur non matché pour ${user.name || user.id}`);
          return false;
        } else if (!userSupervisorId) {
          // Pas de superviseur défini, on ignore ce filtre
          // console.log(`Agent ${user.name || user.id} n'a pas de superviseur défini`);
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

// Cache pour les vérifications de planification (évite les requêtes multiples pour le même agent/date)
const planningCheckCache = new Map();

/**
 * Vérifie si une planification existe pour un agent à une date donnée
 * Utilise un cache pour éviter les requêtes multiples
 */
async function checkPlanningForAgent(agentId, date) {
  if (!agentId || !date) return false;
  
  // Créer une clé de cache
  const cacheKey = `${agentId}_${date}`;
  
  // Vérifier le cache d'abord
  if (planningCheckCache.has(cacheKey)) {
    return planningCheckCache.get(cacheKey);
  }
  
  try {
    const headers = await authHeaders();
    const response = await fetch(`${apiBase}/planifications?agent_id=${agentId}&date=${date}`, { headers });
    
    // Si erreur 401, ne pas logger d'erreur (token peut avoir expiré, mais ce n'est pas critique pour l'affichage)
    if (response.status === 401) {
      console.warn(`⚠️ Token expiré ou invalide pour la vérification de planification (agent ${agentId}, date ${date})`);
      planningCheckCache.set(cacheKey, false);
      return false;
    }
    
    if (!response.ok) {
      planningCheckCache.set(cacheKey, false);
      return false;
    }
    
    const result = await response.json();
    const hasPlanning = result && result.items && result.items.length > 0;
    
    // Mettre en cache le résultat
    planningCheckCache.set(cacheKey, hasPlanning);
    return hasPlanning;
  } catch (error) {
    // Ne pas logger d'erreur pour les erreurs réseau (peut être dû à un token expiré)
    // C'est une vérification optionnelle pour l'affichage
    planningCheckCache.set(cacheKey, false);
    return false;
  }
}

/**
 * Vide le cache des vérifications de planification
 * Utile si on veut forcer une nouvelle vérification
 */
function clearPlanningCheckCache() {
  planningCheckCache.clear();
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
        <th>Observations</th>
        <th>Actions</th>
      </tr>
    `;
  }
  // Limiter le nombre de requêtes simultanées pour éviter de surcharger l'API
  // Traiter les lignes par lots de 10 pour éviter trop de requêtes en parallèle
  const batchSize = 10;
  const rowsHtml = [];
  
  for (let i = 0; i < filteredRows.length; i += batchSize) {
    const batch = filteredRows.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(async row => {
      const date = new Date(row.ts).toISOString().split('T')[0];
      // Utiliser le cache pour éviter les requêtes multiples
      const hasPlanning = await checkPlanningForAgent(row.agent_id, date);
      
      // Récupérer les informations de l'utilisateur
      const user = row.user || {};
      const agentName = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || `Agent ${row.agent_id}`;
      const projectName = user.project_name || user.projet || user.project || row.projet || 'Non défini';
      
      const obsValue = (row.validation_notes || row.notes || row.note || '').toString();
      const safeId = String(row.id || `${row.agent_id || ''}-${row.ts || ''}`);
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
          <td>
            <input 
              class="form-control form-control-sm obs-input" 
              data-rowid="${safeId}"
              value="${obsValue.replace(/"/g, '&quot;')}"
              placeholder="Ajouter une observation" />
          </td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-primary" onclick="downloadValidationReport('${row.id}')" title="Télécharger le rapport">
              <i class="bi bi-download"></i>
            </button>
          </td>
        </tr>
      `;
    }));
    rowsHtml.push(...batchResults);
  }
  
  tbody.innerHTML = rowsHtml.join('') || `<tr><td colspan="11">Aucune donnée</td></tr>`;
  window.__lastRows = rows;
  window.__filteredRows = filteredRows;
  // Initialiser le cache des observations et les écouteurs
  if (!window.__obsByRow) window.__obsByRow = {};
  document.querySelectorAll('#validations-table .obs-input').forEach(input => {
    const id = input.getAttribute('data-rowid');
    window.__obsByRow[id] = input.value || '';
    input.addEventListener('input', (e) => {
      window.__obsByRow[id] = e.target.value;
    });
  });
}

/**
 * Charge les utilisateurs et leurs planifications pour la date sélectionnée
 * Applique les filtres sélectionnés (projet, agent, département, commune, superviseur)
 */
async function loadUsersPlanning() {
  try {
    // Récupérer les filtres sélectionnés
    const filters = (typeof getSelectedFilters === 'function') ? getSelectedFilters() : {
      dateRange: 'today',
      preciseDate: '',
      agentId: 'all',
      project: 'all',
      department: 'all',
      commune: 'all',
      supervisorId: 'all'
    };
    console.log('Filtres appliqués au tableau de planification:', filters);
    console.log('Filtre projet actif:', filters.project !== 'all' ? filters.project : 'Aucun');
    
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

    // Utilitaire: normaliser une valeur de date vers un format YYYY-MM-DD
    const normalizeDateValue = (value) => {
      if (!value) return null;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
          return trimmed.slice(0, 10);
        }
      }
      try {
        const parsed = new Date(value);
        if (isNaN(parsed.getTime())) return null;
        return parsed.toISOString().split('T')[0];
      } catch {
        return null;
      }
    };

    const matchesSelectedDate = (value) => normalizeDateValue(value) === date;

    const headers = await authHeaders();
    const tbody = document.getElementById('users-planning-body');
    if (!tbody) {
      console.error('ERREUR: L\'élément avec l\'ID users-planning-body est introuvable dans le DOM');
      return;
    }
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Chargement des données...</td></tr>';
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
        
        // Filtre de base : exclure les admins
        if (userRole === 'admin' || userRole === '') return false;
        
        // Appliquer les filtres sélectionnés
        if (filters.agentId && filters.agentId !== 'all' && user.id != filters.agentId) {
          return false;
        }
        
        if (filters.project && filters.project !== 'all') {
          const userProject = user.project_name || user.projet || user.project || '';
          const cleanedUserProject = cleanProjectName(userProject);
          const cleanedFilterProject = cleanProjectName(filters.project);
          if (cleanedUserProject?.toLowerCase() !== cleanedFilterProject?.toLowerCase()) {
            return false;
          }
        }
        
        if (filters.department && filters.department !== 'all') {
          // Le filtre département utilise des IDs, mais les utilisateurs peuvent avoir des noms de départements
          // On doit mapper l'ID vers le nom ou vice versa
          const departmentNames = {
            '1': 'Atacora',
            '2': 'Atacora-Donga', 
            '3': 'Collines',
            '4': 'Couffo',
            '5': 'Donga',
            '6': 'Littoral',
            '7': 'Mono',
            '8': 'Ouémé',
            '9': 'Plateau',
            '10': 'Zou'
          };
          const departmentName = departmentNames[filters.department];
          if (departmentName && user.department !== departmentName) {
            return false;
          }
        }
        
        if (filters.commune && filters.commune !== 'all' && user.commune !== filters.commune) {
          return false;
        }
        
      if (filters.supervisorId && filters.supervisorId !== 'all') {
        // Le superviseur peut être dans différents champs
        const userSupervisorId = user.supervisor_id || user.supervisor || user.supervisor_email || user.supervisorId;
        // Vérifier si le user a un superviseur
        if (userSupervisorId && String(userSupervisorId) !== String(filters.supervisorId)) {
          return false;
        }
        // Si pas de superviseur défini, on accepte quand même (le filtre est optionnel)
      }
        
        return true;
      });
      
      console.log(`Filtrage appliqué au tableau de planification: ${allUsers.length} utilisateurs → ${users.length} utilisateurs après filtrage`);
    } catch (error) {
      console.error('Erreur lors du parsing des utilisateurs:', error);
      users = [];
    }
    let planningItems = [];
    try {
      // Utiliser la date au format YYYY-MM-DD pour la requête
      // L'API peut accepter soit un format ISO complet, soit juste la date
      const from = `${date}T00:00:00.000Z`;
      const to = `${date}T23:59:59.999Z`;
      
      // Construire l'URL avec tous les filtres
      // Essayer d'abord avec la date au format simple YYYY-MM-DD
      let planningUrl = `${apiBase}/planifications?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`;
      
      // Ajouter les filtres si ils sont définis
      if (filters.project && filters.project !== 'all') {
        planningUrl += `&project_name=${encodeURIComponent(filters.project)}`;
      }
      if (filters.agentId && filters.agentId !== 'all') {
        planningUrl += `&agent_id=${encodeURIComponent(filters.agentId)}`;
      }
      if (filters.department && filters.department !== 'all') {
        planningUrl += `&departement=${encodeURIComponent(filters.department)}`;
      }
      if (filters.commune && filters.commune !== 'all') {
        planningUrl += `&commune=${encodeURIComponent(filters.commune)}`;
      }
      
      console.log('📅 Date utilisée pour les planifications:', date);
      console.log('🔗 URL de chargement des planifications:', planningUrl);
      const planningRes = await fetch(planningUrl, { headers });
      if (!planningRes.ok) {
        const errorText = await planningRes.text();
        console.error('❌ Erreur lors du chargement des planifications:', planningRes.status, errorText);
        
        // Essayer avec le format ISO complet en cas d'échec
        console.log('🔄 Tentative avec format ISO complet...');
        planningUrl = `${apiBase}/planifications?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
        if (filters.project && filters.project !== 'all') {
          planningUrl += `&project_name=${encodeURIComponent(filters.project)}`;
        }
        if (filters.agentId && filters.agentId !== 'all') {
          planningUrl += `&agent_id=${encodeURIComponent(filters.agentId)}`;
        }
        if (filters.department && filters.department !== 'all') {
          planningUrl += `&departement=${encodeURIComponent(filters.department)}`;
        }
        if (filters.commune && filters.commune !== 'all') {
          planningUrl += `&commune=${encodeURIComponent(filters.commune)}`;
        }
        
        const planningResRetry = await fetch(planningUrl, { headers });
        if (planningResRetry.ok) {
          const planningDataRetry = await planningResRetry.json();
          if (planningDataRetry && planningDataRetry.items && Array.isArray(planningDataRetry.items)) {
            planningItems = planningDataRetry.items;
          } else if (Array.isArray(planningDataRetry)) {
            planningItems = planningDataRetry;
          } else if (planningDataRetry && planningDataRetry.data && Array.isArray(planningDataRetry.data)) {
            planningItems = planningDataRetry.data;
          }
          console.log('✅ Planifications récupérées avec format ISO');
        }
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
        console.log('✅ Planifications récupérées avec format date simple');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des planifications:', error);
    }
    
    console.log(`📊 ${planningItems.length} planifications chargées (API) pour la date ${date}`);

    // Toujours tenter un fallback Supabase pour compléter les données manquantes
    try {
      const fallbackPlans = await fetchPlanificationsFromSupabase(date, filters, users);
      if (fallbackPlans.length) {
        const planKey = (plan) => {
          const planId = plan.id || plan.uuid || '';
          const userIdentifier = plan.user_id || plan.userId || plan.agent_id || plan.agentId || plan.user?.id || plan.agent?.id || '';
          const planDate = normalizeDateValue(
            plan.date ||
            plan.date_planification ||
            plan.datePlanification ||
            plan.planned_date ||
            plan.plannedDate ||
            plan.planned_day ||
            plan.planning_date
          ) || date;
          return `${planId}_${userIdentifier}_${planDate}`;
        };

        const existingKeys = new Set();
        planningItems.forEach(plan => existingKeys.add(planKey(plan)));

        const newPlans = fallbackPlans.filter(plan => {
          const key = planKey(plan);
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });

        if (newPlans.length) {
          planningItems = [...planningItems, ...newPlans];
          console.log(`➕ ${newPlans.length} planifications supplémentaires ajoutées depuis Supabase (total ${planningItems.length})`);
        } else {
          console.log('ℹ️ Aucune planification supplémentaire depuis Supabase (toutes déjà présentes)');
        }
      } else {
        console.log('ℹ️ Supabase n\'a retourné aucune planification supplémentaire pour cette date.');
      }
    } catch (fallbackError) {
      console.warn('⚠️ Fallback Supabase indisponible:', fallbackError?.message || fallbackError);
    }

    // Filtrer explicitement les planifications pour ne garder que celles de la date sélectionnée
    const filteredPlanningItems = planningItems.filter(plan => {
      const planDates = [
        plan.date,
        plan.date_planification,
        plan.datePlanification,
        plan.planned_date,
        plan.plannedDate,
        plan.planned_day,
        plan.planning_date,
        plan.created_at,
        plan.updated_at
      ].filter(Boolean);

      if (!planDates.length) {
        // Pas d'information de date exploitable, on conserve par défaut
        return true;
      }
      return planDates.some(field => matchesSelectedDate(field));
    });

    if (filteredPlanningItems.length !== planningItems.length) {
      console.log(`📅 Filtrage: ${planningItems.length} planifications → ${filteredPlanningItems.length} pour la date ${date}`);
    }
    planningItems = filteredPlanningItems;
    
    // Les filtres sont maintenant appliqués côté serveur, plus besoin de filtrage côté client
    
    // Récupérer les validations de présence pour la date sélectionnée
    // Vérifier directement dans le DOM du second tableau pour garantir la cohérence avec ce qui est affiché
    let validatedUserIds = [];
    let validatedAgentNames = new Set(); // Set des noms d'agents présents dans le second tableau
    let validationData = [];
    
    try {
      // Méthode 1: Vérifier directement dans le DOM du second tableau (validations-body)
      // IMPORTANT: Filtrer par date pour ne garder que les validations de la date sélectionnée
      const validationsBody = document.getElementById('validations-body');
      if (validationsBody) {
        const validationRows = validationsBody.querySelectorAll('tr');
        validationRows.forEach(row => {
          // Vérifier la date dans la colonne Date/Heure (généralement la 7ème colonne, index 6)
          const dateCell = row.querySelectorAll('td')[6]; // Colonne Date/Heure
          if (dateCell) {
            const dateText = dateCell.textContent.trim();
            if (dateText) {
              // Parser la date depuis le format affiché (ex: "13/11/2025 10:30:00")
              try {
                const parsedDate = new Date(dateText);
                if (!isNaN(parsedDate.getTime())) {
                  const validationDateStr = parsedDate.toISOString().split('T')[0];
                  // Ne considérer que les validations de la date sélectionnée
                  if (validationDateStr === date) {
                    const firstCell = row.querySelector('td');
                    if (firstCell) {
                      // Extraire le nom de l'agent depuis la première cellule (colonne Agent)
                      const agentName = firstCell.textContent.trim();
                      if (agentName && agentName !== 'Aucune donnée' && !agentName.includes('Erreur') && !agentName.includes('Chargement')) {
                        // Normaliser le nom (enlever les espaces multiples, mettre en minuscules pour comparaison)
                        const normalizedName = agentName.replace(/\s+/g, ' ').trim().toLowerCase();
                        validatedAgentNames.add(normalizedName);
                        console.log(`📋 Agent trouvé dans le DOM du second tableau (date ${date}): ${agentName}`);
                      }
                    }
                  }
                }
              } catch (e) {
                // Si le parsing échoue, ignorer cette ligne
                console.warn(`⚠️ Impossible de parser la date: ${dateText}`);
              }
            }
          }
        });
        console.log(`✅ ${validatedAgentNames.size} agents trouvés dans le DOM du second tableau pour la date ${date}`);
      }
      
      // Méthode 1b: Vérifier aussi dans les données stockées globalement par renderValidations()
      // IMPORTANT: Filtrer par date pour ne garder que les validations de la date sélectionnée
      if (window.__lastRows && Array.isArray(window.__lastRows) && window.__lastRows.length > 0) {
        window.__lastRows.forEach(row => {
          // Vérifier que la validation correspond à la date sélectionnée
          if (row.ts && matchesSelectedDate(row.ts)) {
            if (row.user) {
              const user = row.user;
              let agentName = '';
              if (user.name && user.name.trim()) {
                agentName = user.name.trim();
              } else if (user.first_name || user.last_name) {
                agentName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
              }
              if (agentName) {
                const normalizedName = agentName.replace(/\s+/g, ' ').trim().toLowerCase();
                validatedAgentNames.add(normalizedName);
                console.log(`📋 Agent trouvé dans window.__lastRows (date ${date}): ${agentName}`);
              }
            }
          }
        });
        console.log(`✅ ${validatedAgentNames.size} agents trouvés au total (DOM + window.__lastRows) pour la date ${date}`);
      }
      
      // Méthode 2: Récupérer aussi via fetchReportsFromBackend pour les IDs
      const filters = (typeof getSelectedFilters === 'function') ? getSelectedFilters() : {
        dateRange: 'today',
        preciseDate: date,
        agentId: 'all',
        project: 'all',
        department: 'all',
        commune: 'all',
        supervisorId: 'all'
      };
      
      // Récupérer les validations via fetchReportsFromBackend pour obtenir les IDs
      // IMPORTANT: Les filtres incluent déjà la date via preciseDate, mais on filtre aussi côté client pour être sûr
      const validationRows = await fetchReportsFromBackend(
        filters.agentId !== 'all' ? filters.agentId : null,
        filters.project !== 'all' ? filters.project : null,
        filters.department !== 'all' ? filters.department : null,
        filters.commune !== 'all' ? filters.commune : null,
        filters.supervisorId !== 'all' ? filters.supervisorId : null
      );
      
      // Filtrer les validations pour ne garder que celles de la date sélectionnée
      const filteredValidationRows = validationRows.filter(row => {
        if (!row.ts) return false;
        return matchesSelectedDate(row.ts);
      });
      
      console.log(`📅 ${filteredValidationRows.length} validations filtrées pour la date ${date} (sur ${validationRows.length} au total)`);
      
      // Extraire les IDs uniques des agents qui ont validé leur présence (uniquement pour la date sélectionnée)
      const validatedIdsSet = new Set();
      filteredValidationRows.forEach(row => {
        if (row.agent_id) {
          const agentIdStr = String(row.agent_id).trim();
          validatedIdsSet.add(agentIdStr);
          
          if (row.user && row.user.id) {
            const userIdStr = String(row.user.id).trim();
            validatedIdsSet.add(userIdStr);
          }
          
          // Aussi extraire le nom de l'agent depuis les données
          if (row.user) {
            const user = row.user;
            let agentName = '';
            if (user.name && user.name.trim()) {
              agentName = user.name.trim();
            } else if (user.first_name || user.last_name) {
              agentName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
            }
            if (agentName) {
              const normalizedName = agentName.replace(/\s+/g, ' ').trim().toLowerCase();
              validatedAgentNames.add(normalizedName);
            }
          }
        }
      });
      
      validatedUserIds = Array.from(validatedIdsSet);
      validationData = filteredValidationRows; // Utiliser les données filtrées par date
      
      console.log(`✅ ${validatedUserIds.length} utilisateurs uniques ont validé leur présence (via fetchReportsFromBackend) pour la date ${date}. IDs:`, validatedUserIds);
      console.log(`✅ ${validatedAgentNames.size} noms d'agents uniques trouvés au total pour la date ${date}`);
      
      // Fallback: si aucune validation n'est trouvée, essayer l'API directe
      if (validatedUserIds.length === 0 && validatedAgentNames.size === 0) {
        console.log('🔄 Aucune validation trouvée, tentative avec l\'API directe...');
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
        const fromDate = startDate.toISOString().split('T')[0];
        const toDate = endDate.toISOString().split('T')[0];
        
        const validationsUrl = `${apiBase}/reports/validations?from=${fromDate}&to=${toDate}`;
        const validationsRes = await fetch(validationsUrl, { headers });
        if (validationsRes.ok) {
          const validationsData = await validationsRes.json();
          const apiValidationData = Array.isArray(validationsData?.items) 
            ? validationsData.items 
            : Array.isArray(validationsData) 
              ? validationsData 
              : [];
          
          // Filtrer par date pour ne garder que les validations de la date sélectionnée
          const filteredApiValidationData = apiValidationData.filter(v => {
            const vDate = v.date || v.ts || v.created_at;
            return vDate && matchesSelectedDate(vDate);
          });
          
          console.log(`📅 ${filteredApiValidationData.length} validations filtrées pour la date ${date} (sur ${apiValidationData.length} au total via API directe)`);
          
          validatedUserIds = [...new Set(
            filteredApiValidationData
              .map(v => {
                const agentId = v.agent_id || v.agentId || v.user_id || v.userId || v.id;
                return agentId ? String(agentId).trim() : null;
              })
              .filter(id => id !== null && id !== 'undefined' && id !== 'null')
          )];
          
          // Extraire aussi les noms depuis l'API (uniquement pour la date sélectionnée)
          filteredApiValidationData.forEach(v => {
            if (v.agent_name) {
              const normalizedName = v.agent_name.replace(/\s+/g, ' ').trim().toLowerCase();
              validatedAgentNames.add(normalizedName);
            }
          });
          
          validationData = filteredApiValidationData; // Utiliser les données filtrées par date
          console.log(`✅ ${validatedUserIds.length} utilisateurs uniques trouvés via l'API directe pour la date ${date}. IDs:`, validatedUserIds);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des validations:', error);
    }

    // Créer un Set des IDs des utilisateurs avec planification (en s'assurant que les IDs sont des strings)
    console.log('📋 Planifications brutes reçues:', planningItems.length);
    if (planningItems.length > 0) {
      console.log('📝 Exemple de planification:', JSON.stringify(planningItems[0], null, 2));
      console.log('📝 Clés disponibles dans la planification:', Object.keys(planningItems[0]));
    }
    
    const usersWithPlanning = new Set();
    planningItems.forEach((p, idx) => {
      // Gérer différents noms de champs possibles pour l'ID utilisateur
      const userId = p.user_id || p.userId || p.agent_id || p.agentId || p.user?.id || p.agent?.id;
      if (userId) {
        const userIdStr = String(userId).trim();
        usersWithPlanning.add(userIdStr);
        if (idx < 5) {
          console.log(`📌 Planification ${idx + 1}: userId=${userIdStr} (type: ${typeof userId}, brut: ${userId})`);
        }
      } else {
        console.warn(`⚠️ Planification sans ID utilisateur trouvé:`, p);
      }
    });
    
    console.log(`✅ Set usersWithPlanning créé avec ${usersWithPlanning.size} IDs uniques`);
    console.log('📋 IDs dans usersWithPlanning:', Array.from(usersWithPlanning).slice(0, 10));
    let withPlanning = 0;
    let withoutPlanning = 0;
    tbody.innerHTML = '';
    const rows = [];
    
    // Convertir validatedUserIds en Set pour une recherche plus rapide et fiable
    // Normaliser tous les IDs pour garantir une comparaison cohérente
    const validatedUserIdsSet = new Set(validatedUserIds.map(id => String(id).trim()));
    
    // Créer aussi un Set avec les IDs numériques pour une comparaison plus robuste
    const validatedUserIdsNumericSet = new Set();
    validatedUserIds.forEach(id => {
      const idStr = String(id).trim();
      validatedUserIdsNumericSet.add(idStr);
      // Ajouter aussi la version numérique si applicable
      const idNum = parseInt(idStr);
      if (!isNaN(idNum)) {
        validatedUserIdsNumericSet.add(String(idNum));
      }
    });
    
    // Afficher les IDs pour le débogage
    console.log('📋 IDs des utilisateurs avec planification:', [...usersWithPlanning]);
    console.log('✅ IDs des utilisateurs avec validation:', [...validatedUserIdsSet]);
    console.log(`📊 Comparaison: ${usersWithPlanning.size} planifiés, ${validatedUserIdsSet.size} validés`);
    
    // D'abord, on récupère tous les IDs des utilisateurs qui sont à la fois planifiés et absents
    const absentUserIds = [];
    users.forEach(user => {
      const userIdStr = String(user.id || user.user_id || user.userId || '').trim();
      if (!userIdStr) return;
      
      const isPlanned = usersWithPlanning.has(userIdStr);
      
      // Construire le nom d'affichage pour la comparaison
      let userDisplayName = '';
      if (user.name && user.name.trim()) {
        userDisplayName = user.name.trim();
      } else if (user.first_name || user.last_name) {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        userDisplayName = `${firstName} ${lastName}`.trim();
      } else {
        userDisplayName = user.email || 'Non renseigné';
      }
      
      // Normaliser le nom pour la comparaison
      const normalizedUserDisplayName = userDisplayName.replace(/\s+/g, ' ').trim().toLowerCase();
      
      // LOGIQUE SIMPLIFIÉE : Un agent est présent s'il apparaît dans le second tableau
      // Priorité 1: Vérifier par nom dans le DOM du second tableau (source de vérité)
      let isPresent = false;
      
      if (validatedAgentNames && validatedAgentNames.size > 0) {
        if (validatedAgentNames.has(normalizedUserDisplayName)) {
          isPresent = true;
        }
      }
      
      // Priorité 2: Si pas trouvé par nom, vérifier par ID dans les données
      if (!isPresent) {
        isPresent = validatedUserIdsSet.has(userIdStr) || validatedUserIdsNumericSet.has(userIdStr);
        
        // Si pas trouvé, essayer avec la version numérique
        if (!isPresent) {
          const userIdNum = parseInt(userIdStr);
          if (!isNaN(userIdNum)) {
            isPresent = validatedUserIdsSet.has(String(userIdNum)) || validatedUserIdsNumericSet.has(String(userIdNum));
          }
        }
      }
      
      // Priorité 3: Vérification finale dans validationData (par ID et nom)
      if (!isPresent && validationData && validationData.length > 0) {
        const foundInValidations = validationData.some(v => {
          const vAgentId = String(v.agent_id || v.agentId || v.user_id || v.userId || '').trim();
          const vUserId = v.user && v.user.id ? String(v.user.id).trim() : null;
          
          // Vérifier par ID
          const idMatch = vAgentId === userIdStr || 
                 (vUserId && vUserId === userIdStr) ||
                 (vAgentId && !isNaN(parseInt(vAgentId)) && parseInt(vAgentId) === parseInt(userIdStr)) ||
                 (vUserId && !isNaN(parseInt(vUserId)) && parseInt(vUserId) === parseInt(userIdStr));
          
          // Vérifier par nom
          let nameMatch = false;
          if (v.user) {
            const vUser = v.user;
            let vAgentName = '';
            if (vUser.name && vUser.name.trim()) {
              vAgentName = vUser.name.trim();
            } else if (vUser.first_name || vUser.last_name) {
              vAgentName = `${vUser.first_name || ''} ${vUser.last_name || ''}`.trim();
            }
            if (vAgentName) {
              const vNormalizedName = vAgentName.replace(/\s+/g, ' ').trim().toLowerCase();
              nameMatch = vNormalizedName === normalizedUserDisplayName;
            }
          }
          
          return idMatch || nameMatch;
        });
        if (foundInValidations) {
          isPresent = true;
        }
      }
      
      // RÈGLE FINALE : Un agent est absent SEULEMENT s'il est planifié ET qu'il n'apparaît PAS dans le second tableau
      if (isPlanned && !isPresent) {
        absentUserIds.push(userIdStr);
      }
    });
    
    console.log('📊 IDs des utilisateurs absents (planifiés mais pas de validation):', absentUserIds);
    
    await Promise.all(users.map(async (user, index) => {
      const userIdStr = String(user.id || user.user_id || user.userId || '').trim();
      if (!userIdStr) {
        console.warn(`⚠️ Utilisateur sans ID valide:`, user);
        return;
      }
      
      // Vérifier si l'utilisateur est planifié avec plusieurs méthodes de comparaison
      let isPlanned = usersWithPlanning.has(userIdStr);
      
      // Si pas trouvé, essayer avec différents formats de l'ID
      if (!isPlanned) {
        // Essayer avec l'ID numérique
        const userIdNum = parseInt(userIdStr);
        if (!isNaN(userIdNum)) {
          isPlanned = usersWithPlanning.has(String(userIdNum)) || usersWithPlanning.has(userIdNum.toString());
        }
        
        // Essayer avec l'ID original de l'utilisateur
        const originalUserId = user.id || user.user_id || user.userId;
        if (originalUserId) {
          isPlanned = isPlanned || usersWithPlanning.has(String(originalUserId)) || usersWithPlanning.has(originalUserId.toString());
        }
      }
      
      // Log de débogage pour les utilisateurs qui devraient être planifiés mais ne le sont pas
      if (!isPlanned && index < 10) {
        const userDisplayName = user.name || user.first_name || user.email || userIdStr;
        console.log(`🔍 Agent ${userDisplayName} (ID: ${userIdStr}):`, {
          userIdStr,
          userIdType: typeof userIdStr,
          userOriginalId: user.id,
          userOriginalIdType: typeof user.id,
          inSet: usersWithPlanning.has(userIdStr),
          setContents: Array.from(usersWithPlanning).slice(0, 5),
          planningItemsForUser: planningItems.filter(p => {
            const pUserId = String(p.user_id || p.userId || p.agent_id || p.agentId || '').trim();
            return pUserId === userIdStr || pUserId === String(user.id);
          }).length
        });
      }
      
      // Construire le nom d'affichage pour la comparaison
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
      
      // Normaliser le nom pour la comparaison (enlever les espaces multiples, mettre en minuscules)
      const normalizedDisplayName = displayName.replace(/\s+/g, ' ').trim().toLowerCase();
      
      // LOGIQUE SIMPLIFIÉE : Un agent est présent s'il apparaît dans le second tableau
      // Priorité 1: Vérifier par nom dans le DOM du second tableau (source de vérité)
      let isPresent = false;
      
      if (validatedAgentNames && validatedAgentNames.size > 0) {
        if (validatedAgentNames.has(normalizedDisplayName)) {
          isPresent = true;
          console.log(`✅ Agent trouvé par nom dans le second tableau: ${displayName}`);
        }
      }
      
      // Priorité 2: Si pas trouvé par nom, vérifier par ID dans les données
      if (!isPresent) {
        isPresent = validatedUserIdsSet.has(userIdStr) || validatedUserIdsNumericSet.has(userIdStr);
        
        // Si pas trouvé, essayer avec la version numérique
        if (!isPresent) {
          const userIdNum = parseInt(userIdStr);
          if (!isNaN(userIdNum)) {
            isPresent = validatedUserIdsSet.has(String(userIdNum)) || validatedUserIdsNumericSet.has(String(userIdNum));
          }
        }
      }
      
      // Priorité 3: Vérification finale dans validationData (par ID et nom)
      if (!isPresent && validationData && validationData.length > 0) {
        const foundInValidations = validationData.some(v => {
          const vAgentId = String(v.agent_id || v.agentId || v.user_id || v.userId || '').trim();
          const vUserId = v.user && v.user.id ? String(v.user.id).trim() : null;
          
          // Vérifier par ID
          const idMatch = vAgentId === userIdStr || 
                 (vUserId && vUserId === userIdStr) ||
                 (vAgentId && !isNaN(parseInt(vAgentId)) && parseInt(vAgentId) === parseInt(userIdStr)) ||
                 (vUserId && !isNaN(parseInt(vUserId)) && parseInt(vUserId) === parseInt(userIdStr));
          
          // Vérifier par nom
          let nameMatch = false;
          if (v.user) {
            const vUser = v.user;
            let vAgentName = '';
            if (vUser.name && vUser.name.trim()) {
              vAgentName = vUser.name.trim();
            } else if (vUser.first_name || vUser.last_name) {
              vAgentName = `${vUser.first_name || ''} ${vUser.last_name || ''}`.trim();
            }
            if (vAgentName) {
              const vNormalizedName = vAgentName.replace(/\s+/g, ' ').trim().toLowerCase();
              nameMatch = vNormalizedName === normalizedDisplayName;
            }
          }
          
          return idMatch || nameMatch;
        });
        if (foundInValidations) {
          isPresent = true;
          console.log(`✅ Agent trouvé dans validationData: ${displayName}`);
        }
      }
      
      // RÈGLE FINALE : Un agent est absent SEULEMENT s'il est planifié ET qu'il n'apparaît PAS dans le second tableau
      // Si l'agent apparaît dans le second tableau (même par nom), il est considéré comme présent
      const isAbsent = isPlanned && !isPresent;
      
      // Log détaillé pour le débogage
      if (isPlanned) {
        console.log(`👤 Agent ${user.name || user.first_name || user.id} (ID: ${userIdStr}):`, { 
          isPlanned, 
          isPresent, 
          isAbsent,
          userIdType: typeof userIdStr,
          validatedUserIds: validatedUserIds.slice(0, 5).join(', ') + (validatedUserIds.length > 5 ? '...' : '')
        });
      }
      
      if (isPlanned) {
        withPlanning++;
      } else {
        withoutPlanning++;
      }
      
      const planningCell = isPlanned ? 'Oui' : 'Non';
      const planningClass = isPlanned ? 'text-success' : 'text-danger';
      // displayName a déjà été construit plus haut pour la comparaison
      // Récupérer le numéro de projet de l'utilisateur
      const projectNumber = user.project_name || user.projet || user.project || '—';
      const cleanedProject = (typeof cleanProjectName === 'function') 
        ? (cleanProjectName(projectNumber) || '') 
        : String(projectNumber || '').trim();
      
      // Récupérer l'observation depuis le localStorage
      const observationKey = `planning_observation_${user.id}_${date}`;
      const savedObservation = localStorage.getItem(observationKey) || '';
      
      const row = `
        <tr data-project="${cleanedProject}">
          <td>${index + 1}</td>
          <td>${displayName}</td>
          <td>${projectNumber}</td>
          <td>${user.role || '—'}</td>
          <td class="${planningClass} text-center">${planningCell}</td>
          <td>
            <input type="text" 
                   class="form-control form-control-sm planning-observation" 
                   data-user-id="${user.id}" 
                   data-date="${date}"
                   placeholder="Ajouter une observation..."
                   value="${savedObservation.replace(/"/g, '&quot;')}"
                   style="min-width: 200px;">
          </td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-info" onclick="viewPlanningDetails('${user.id}', '${date}')">
              <i class="bi bi-eye"></i> Voir
            </button>
          </td>
        </tr>
      `;
      rows.push(row);
    }));
    tbody.innerHTML = rows.join('') || '<tr><td colspan="7" class="text-center">Aucun utilisateur trouvé</td></tr>';
    
    // Ajouter les event listeners pour sauvegarder les observations
    tbody.querySelectorAll('.planning-observation').forEach(input => {
      input.addEventListener('blur', function() {
        const userId = this.getAttribute('data-user-id');
        const date = this.getAttribute('data-date');
        const observation = this.value.trim();
        const key = `planning_observation_${userId}_${date}`;
        
        if (observation) {
          localStorage.setItem(key, observation);
          console.log(`Observation sauvegardée pour l'agent ${userId} le ${date}:`, observation);
        } else {
          localStorage.removeItem(key);
          console.log(`Observation supprimée pour l'agent ${userId} le ${date}`);
        }
      });
      
      // Sauvegarder aussi lors de la pression de Enter
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.blur();
        }
      });
    });
    const countElement = document.getElementById('planning-count');
    if (countElement) {
      countElement.innerHTML = `
        <span class="text-success">${withPlanning} avec</span> /
        <span class="text-danger">${withoutPlanning} sans</span>
      `;
    }
    
    // Extraire les projets uniques du tableau de planification et mettre à jour le filtre
    updatePlanningProjectFilter(users);
  } catch (error) {
    console.error('Erreur lors du chargement des planifications:', error);
    const tbody = document.getElementById('users-planning-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-danger">
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
      // Convertir la date de validation (format DD/MM/YYYY) vers Date
      let validationDate;
      if (validation.date && validation.date.includes('/')) {
        // Format DD/MM/YYYY
        const parts = validation.date.split('/');
        validationDate = new Date(parts[2], parts[1] - 1, parts[0]);
      } else {
        validationDate = new Date(validation.date || validation.ts || validation.created_at);
      }
      
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
      const cleanedUserProject = cleanProjectName(userProject);
      const cleanedFilterProject = cleanProjectName(filters.project);
      if (cleanedUserProject?.toLowerCase() !== cleanedFilterProject?.toLowerCase()) {
        return false;
      }
    }

    // Filtre par superviseur
    if (filters.supervisorId && filters.supervisorId !== 'all') {
      const user = validation.user;
      if (!user) return false;
      
      const userSupervisorId = user.supervisor_id || user.supervisor || user.supervisor_email;
      if (String(userSupervisorId) !== String(filters.supervisorId)) {
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
      startDate: document.getElementById('date-filter')?.value,
      endDate: document.getElementById('date-filter')?.value,
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

  // Compter les présents et absents en fonction du statut
  // Le statut peut être "Présent" ou "Absent" (venant de status_presence de l'API)
  const presents = filteredRows.filter(r => {
    const statut = (r.statut || '').toLowerCase().trim();
    // Considérer comme présent si le statut contient "présent" ou "present"
    return statut.includes('présent') || statut.includes('present');
  }).length;

  const absent = total - presents;
  const rate = total ? Math.round((presents / total) * 100) : 0;

  console.log(`📊 Statistiques calculées: ${total} agents, ${presents} présents, ${absent} absents, ${rate}% de présence`);

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
  try { 
    renderCharts(filteredRows);
    // Charger les personnes planifiées mais absentes
    await loadPlannedButAbsent();
  } catch (e) { 
    console.warn('Erreur lors du rendu des graphiques ou du chargement des absents:', e?.message || e); 
  }
};

/**
 * Exporte le rapport en CSV
 */
window.printReport = function() {
  window.print();
};

window.exportReport = function() {
  const rows = window.__lastRows || [];
  const cols = ['Agent', 'Projet', 'Localisation', 'Rayon (m)', 'Ref (lat, lon)', 'Actuel (lat, lon)', 'Date', 'Distance (m)', 'Statut', 'Observations'];
  const fmt = d => new Date(d).toLocaleString('fr-FR');
  const esc = s => String(s ?? '').replace(/[\n\r;,]/g, ' ').trim();
  const lines = [cols.join(';')].concat(rows.map(r => {
    const safeId = String(r.id || `${r.agent_id || ''}-${r.ts || ''}`);
    const obsFromDom = (() => {
      const el = document.querySelector(`#validations-table .obs-input[data-rowid="${CSS.escape(safeId)}"]`);
      if (el && typeof el.value === 'string') return el.value;
      if (window.__obsByRow && window.__obsByRow[safeId] != null) return window.__obsByRow[safeId];
      return r.validation_notes || r.notes || r.note || '';
    })();
    return [
      esc(r.agent),
      esc(r.projet),
      esc(r.localisation),
      esc(r.rayon_m),
      (r.ref_lat != null && r.ref_lon != null) ? `${r.ref_lat}, ${r.ref_lon}` : '—',
      (r.lat != null && r.lon != null) ? `${r.lat}, ${r.lon}` : '—',
      r.ts ? fmt(r.ts) : '—',
      esc(r.distance_m),
      esc(r.statut),
      esc(obsFromDom)
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
      console.log('✅ html2canvas déjà chargé (window.html2canvas)');
      return resolve(window.html2canvas);
    }
    
    if (typeof html2canvas === 'function') {
      console.log('✅ html2canvas déjà chargé (global html2canvas)');
      return resolve(html2canvas);
    }
    
    console.log('🔄 Chargement de html2canvas...');
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.integrity = 'sha512-DtPgXY9o0X7dJQeVD3+BTaV3VH6f3WbbVwY6JyvRkU6pqfT4WkV95F6w5VwJQJZt+2Q1RCT3v5F7V0k58ygg==';
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    
    script.onload = () => {
      console.log('✅ html2canvas chargé avec succès');
      if (window.html2canvas) {
        resolve(window.html2canvas);
      } else {
        reject(new Error('html2canvas chargé mais non disponible dans window'));
      }
    };
    
    script.onerror = (error) => {
      console.error('❌ Erreur lors du chargement de html2canvas:', error);
      console.error('Détails de l\'erreur:', {
        type: error.type,
        target: error.target,
        src: script.src
      });
      reject(new Error('Impossible de charger la bibliothèque html2canvas. Vérifiez votre connexion internet.'));
    };
    
    // Timeout de sécurité
    setTimeout(() => {
      if (!window.html2canvas) {
        reject(new Error('Timeout lors du chargement de html2canvas'));
      }
    }, 10000);
    
    document.head.appendChild(script);
  });
}

/**
 * Stocke automatiquement les données de présence dans la table presence_validations
 */
async function storePresenceValidations(presencesData) {
  try {
    if (!presencesData || presencesData.length === 0) {
      console.log('ℹ️ Aucune donnée de présence à stocker');
      return;
    }

    console.log(`📊 Stockage de ${presencesData.length} presences dans presence_validations...`);
    
    // Préparer les données pour l'insertion
    const validationRecords = [];
    
    for (const presence of presencesData) {
      if (!presence.user_id || !presence.start_time) {
        continue; // Ignorer les presences incomplètes
      }
      
      // Déterminer le statut de validation
      let validationStatus = 'pending';
      let checkinType = 'manual';
      
      if (presence.checkin_type === 'validated') {
        validationStatus = 'validated';
        checkinType = 'manual';
      } else if (presence.checkin_type === 'rejected') {
        validationStatus = 'rejected';
        checkinType = 'manual';
      } else if (presence.within_tolerance === true) {
        validationStatus = 'validated';
      } else if (presence.within_tolerance === false) {
        validationStatus = 'rejected';
      }
      
      // Normaliser checkin_type
      if (presence.checkin_type && ['manual', 'automatic', 'admin_override'].includes(presence.checkin_type)) {
        checkinType = presence.checkin_type;
      }
      
      const validationRecord = {
        user_id: presence.user_id,
        presence_id: presence.id,
        validation_status: validationStatus,
        checkin_type: checkinType,
        checkin_lat: presence.location_lat || 0,
        checkin_lng: presence.location_lng || 0,
        checkin_location_name: presence.location_name,
        reference_lat: presence.users?.reference_lat,
        reference_lng: presence.users?.reference_lon,
        distance_from_reference_m: presence.distance_from_reference_m,
        tolerance_meters: presence.tolerance_meters || presence.users?.tolerance_radius_meters || 500,
        within_tolerance: presence.within_tolerance || false,
        validation_reason: presence.notes,
        validation_notes: presence.notes,
        validation_method: 'gps',
        photo_url: presence.photo_url,
        checkin_timestamp: presence.start_time,
        validation_timestamp: presence.created_at || presence.start_time,
        device_info: {
          source: 'reports_auto_sync',
          original_presence_id: presence.id,
          sync_timestamp: new Date().toISOString()
        }
      };
      
      validationRecords.push(validationRecord);
    }
    
    if (validationRecords.length === 0) {
      console.log('ℹ️ Aucun enregistrement de validation à créer');
      return;
    }
    
    // Insérer les données par batch pour éviter les timeouts
    const batchSize = 20;
    let insertedCount = 0;
    
    for (let i = 0; i < validationRecords.length; i += batchSize) {
      const batch = validationRecords.slice(i, i + batchSize);
      
      try {
        // Vérifier d'abord si l'enregistrement existe déjà
        const existingCheck = await Promise.all(
          batch.map(async (record) => {
            try {
              const response = await api(`/presence-validations?user_id=${record.user_id}&checkin_timestamp=${record.checkin_timestamp}`);
              return response.data && response.data.length > 0;
            } catch (error) {
              return false;
            }
          })
        );
        
        // Filtrer les enregistrements qui n'existent pas déjà
        const newRecords = batch.filter((record, index) => !existingCheck[index]);
        
        if (newRecords.length > 0) {
          // Créer les validations via l'API
          for (const record of newRecords) {
            try {
              await api('/presence-validations', {
                method: 'POST',
                body: record
              });
              insertedCount++;
            } catch (error) {
              console.warn(`⚠️ Erreur lors de la création de la validation pour l'utilisateur ${record.user_id}:`, error.message);
            }
          }
        }
        
        // Petite pause entre les batches
        if (i + batchSize < validationRecords.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.warn(`⚠️ Erreur lors du traitement du batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      }
    }
    
    console.log(`✅ ${insertedCount} validations stockées dans presence_validations`);
    
  } catch (error) {
    console.error('❌ Erreur lors du stockage des validations:', error);
    // Ne pas faire échouer le rapport pour cette erreur
  }
}

// Fonction pour exporter le tableau récapitulatif mensuel des présences
window.exportPresenceSummaryHTML = async function() {
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
    
    // Récupérer le tableau de présence
    const presenceTable = document.getElementById('presence-summary');
    if (!presenceTable) {
      throw new Error('Tableau de présence non trouvé');
    }
    
    // Obtenir le mois et l'année sélectionnés
    const monthSelect = document.getElementById('month-selector');
    const yearSelect = document.getElementById('year-selector');
    const monthName = monthSelect ? monthSelect.options[monthSelect.selectedIndex].text : 'Mois';
    const year = yearSelect ? yearSelect.value : new Date().getFullYear();
    
    // Créer le HTML d'export
    const exportHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Récapitulatif mensuel des présences - ${monthName} ${year}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #f8f9fa; 
            padding: 20px; 
        }
        .export-header { 
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            margin-bottom: 30px; 
            border-radius: 10px; 
        }
        .export-title { 
            font-size: 2.5rem; 
            font-weight: bold; 
            margin-bottom: 10px; 
        }
        .export-subtitle { 
            font-size: 1.2rem; 
            opacity: 0.9; 
        }
        .table-container { 
            background: white; 
            border-radius: 10px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
            overflow: hidden; 
            margin-bottom: 30px; 
        }
        .table { 
            margin: 0; 
        }
        .export-footer { 
            text-align: center; 
            color: #6c757d; 
            margin-top: 30px; 
            padding: 20px; 
            border-top: 1px solid #dee2e6; 
        }
        .badge-success { background-color: #28a745; }
        .badge-danger { background-color: #dc3545; }
        .badge-warning { background-color: #ffc107; color: #212529; }
        .table th { background-color: #343a40; color: white; }
        @media print {
            body { padding: 10px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="export-header">
        <div class="export-title">
            <i class="fas fa-calendar-check me-2"></i>
            Récapitulatif mensuel des présences
        </div>
        <div class="export-subtitle">
            ${monthName} ${year}
        </div>
    </div>
    
    <div class="table-container">
        ${presenceTable.outerHTML}
    </div>
    
    <div class="export-footer">
        <p class="mb-2">
            <i class="fas fa-info-circle me-1"></i>
            Rapport généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
        </p>
        <p class="mb-0 text-muted">
            Système de suivi des agents - CCRB Bénin
        </p>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Auto-imprimer optionnel
        window.addEventListener('load', function() {
            setTimeout(function() {
                if (confirm('Voulez-vous imprimer ce rapport maintenant?')) {
                    window.print();
                }
            }, 1000);
        });
    </script>
</body>
</html>`;
    
    // Créer un blob et télécharger
    const blob = new Blob([exportHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport-presences-${monthName.toLowerCase()}-${year}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Supprimer l'indicateur de chargement
    const loadingElement = document.getElementById('export-loading');
    if (loadingElement) {
      loadingElement.remove();
    }
    
    showSuccessMessage('Rapport de présence exporté avec succès!');
    
  } catch (error) {
    console.error('Erreur lors de l\'export HTML du tableau de présence:', error);
    
    // Supprimer l'indicateur de chargement
    const loadingElement = document.getElementById('export-loading');
    if (loadingElement) {
      loadingElement.remove();
    }
    
    const errorMsg = `Erreur lors de l'export HTML : ${error.message || 'Erreur inconnue'}\n\nVeuillez réessayer ou contacter le support si le problème persiste.`;
    showErrorMessage(errorMsg);
  }
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
    const planningSection = document.querySelector('.card:has(#users-planning-table)') || document.getElementById('users-planning-table')?.closest('.card');
    const presenceSummarySection = document.querySelector('.card:has(#presence-summary)') || document.getElementById('presence-summary')?.closest('.card');
    
    if (!reportsContainer && !validationsSection && !planningSection && !presenceSummarySection) {
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
        // 1) Traiter les canvas (Chart.js)
        const canvasCharts = chartsContainer.querySelectorAll('canvas');
        canvasCharts.forEach((chart) => {
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
            const container = chart.closest('.chart-container');
            if (container) {
              container.innerHTML = '';
              container.appendChild(img);
            }
          } catch (e) {
            console.error('Erreur lors de la conversion du graphique en image (canvas):', e);
          }
        });

        // 2) Traiter les graphiques HTML (placeholders/div-based)
        const htmlCharts = chartsContainer.querySelectorAll('.chart-placeholder, .chart-bar-container');
        if (htmlCharts.length > 0) {
          // Charger html2canvas si nécessaire
          const ensureHtml2Canvas = async () => {
            if (window.html2canvas) return;
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
              script.onload = resolve;
              script.onerror = () => reject(new Error('Erreur chargement html2canvas pour export HTML'));
              document.head.appendChild(script);
            });
          };

          try {
            await ensureHtml2Canvas();
            for (const chartEl of Array.from(htmlCharts)) {
              try {
                const container = chartEl.closest('.chart-container') || chartEl;
                const canvas = await window.html2canvas(container, {
                  backgroundColor: '#ffffff',
                  scale: Math.min(2, window.devicePixelRatio || 1.5),
                  useCORS: true
                });
                const imageUrl = canvas.toDataURL('image/png');
                const img = document.createElement('img');
                img.src = imageUrl;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.marginTop = '20px';
                img.style.border = '1px solid #eee';
                img.style.borderRadius = '8px';
                img.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
                if (container) {
                  container.innerHTML = '';
                  container.appendChild(img);
                }
              } catch (e) {
                console.error('Erreur snapshot html2canvas du graphique HTML:', e);
              }
            }
          } catch (e) {
            console.error('Impossible de charger/ utiliser html2canvas pour les graphiques HTML:', e);
          }
        }
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
    
    // Ordre d'export souhaité après le rapport principal:
    // 1) Validations, 2) Planifications, 3) Récapitulatif mensuel des présences

    // 1) Ajouter la section des validations si elle existe
    if (validationsSection && validationsSection.textContent.trim() !== '') {
      const validationsClone = validationsSection.cloneNode(true);
      // Remplacer les champs d'observation par leur valeur texte pour l'export
      validationsClone.querySelectorAll('input.obs-input').forEach(inp => {
        const span = validationsClone.ownerDocument.createElement('span');
        span.textContent = inp.value || '';
        const td = inp.parentElement;
        inp.remove();
        if (td) td.appendChild(span);
      });
      
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

    // 2) Ajouter la section des planifications si elle existe
    if (planningSection && planningSection.textContent.trim() !== '') {
      const planningClone = planningSection.cloneNode(true);
      // Retirer les boutons et filtres interactifs
      planningClone.querySelectorAll('button, .btn, .no-print').forEach(el => el.remove());
      
      // Remplacer les champs d'observation par leur valeur texte pour l'export
      // Récupérer aussi les observations depuis localStorage au cas où elles ne seraient pas dans le DOM
      planningClone.querySelectorAll('input.planning-observation').forEach(inp => {
        const userId = inp.getAttribute('data-user-id');
        const date = inp.getAttribute('data-date');
        let observationValue = inp.value || '';
        
        // Si pas de valeur dans l'input, essayer de récupérer depuis localStorage
        if (!observationValue && userId && date) {
          const key = `planning_observation_${userId}_${date}`;
          observationValue = localStorage.getItem(key) || '';
        }
        
        const span = planningClone.ownerDocument.createElement('span');
        span.textContent = observationValue || '—';
        span.style.display = 'inline-block';
        span.style.padding = '4px 8px';
        span.style.whiteSpace = 'pre-wrap';
        span.style.wordBreak = 'break-word';
        const td = inp.parentElement;
        if (td) {
          inp.remove();
          td.appendChild(span);
        }
      });
      
      // Si des observations ne sont pas dans les inputs (lignes non chargées), les ajouter depuis localStorage
      const allRows = planningClone.querySelectorAll('#users-planning-body tr');
      allRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
          // Chercher le bouton "Voir" pour extraire userId et date
          const viewButton = row.querySelector('button[onclick*="viewPlanningDetails"]');
          if (viewButton) {
            const onclickAttr = viewButton.getAttribute('onclick');
            const match = onclickAttr.match(/viewPlanningDetails\('(\d+)',\s*'([^']+)'\)/);
            if (match) {
              const userId = match[1];
              const date = match[2];
              const key = `planning_observation_${userId}_${date}`;
              const observation = localStorage.getItem(key);
              
              // Si on trouve une observation et qu'il n'y a pas déjà une cellule observation
              if (observation && cells.length === 6) {
                // Insérer une cellule observation avant la dernière cellule (Détails)
                const observationCell = planningClone.ownerDocument.createElement('td');
                observationCell.textContent = observation;
                observationCell.style.padding = '4px 8px';
                observationCell.style.whiteSpace = 'pre-wrap';
                observationCell.style.wordBreak = 'break-word';
                row.insertBefore(observationCell, cells[cells.length - 1]);
              } else if (observation && cells.length === 7) {
                // Mettre à jour la cellule observation existante
                const observationCell = cells[5];
                if (observationCell && !observationCell.textContent.trim()) {
                  observationCell.textContent = observation;
                }
              }
            }
          }
        }
      });
      
      // Mise en forme
      const tbl = planningClone.querySelector('table');
      if (tbl) {
        tbl.style.width = '100%';
        tbl.style.borderCollapse = 'collapse';
        tbl.style.marginBottom = '1.5rem';
      }
      // Espacement
      if (exportContainer.children.length > 0) {
        const spacer = document.createElement('div');
        spacer.style.marginTop = '40px';
        exportContainer.appendChild(spacer);
      }
      exportContainer.appendChild(planningClone);
    }

    // 3) Ajouter la section du récapitulatif mensuel de présence si elle existe
    if (presenceSummarySection && presenceSummarySection.textContent.trim() !== '') {
      const summaryClone = presenceSummarySection.cloneNode(true);
      summaryClone.querySelectorAll('button, .btn, .no-print').forEach(el => el.remove());
      const tbl = summaryClone.querySelector('table');
      if (tbl) {
        tbl.style.width = '100%';
        tbl.style.borderCollapse = 'collapse';
        tbl.style.marginBottom = '1.5rem';
      }
      if (exportContainer.children.length > 0) {
        const spacer = document.createElement('div');
        spacer.style.marginTop = '40px';
        exportContainer.appendChild(spacer);
      }
      exportContainer.appendChild(summaryClone);
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

// Fonction simple pour exporter en PNG - Version simplifiée et robuste
window.exportAsImage = async function() {
  console.log('🖼️ Début export PNG simplifié...');
  
  // Créer un indicateur de chargement simple
  const loading = document.createElement('div');
  loading.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.9); color: white; padding: 20px;
    border-radius: 8px; z-index: 99999; font-family: Arial, sans-serif;
    text-align: center; min-width: 300px;
  `;
  loading.innerHTML = '🔄 Préparation export PNG...<br><small>Veuillez patienter</small>';
  document.body.appendChild(loading);
  
  try {
    // Étape 1: Charger html2canvas de manière simple
    loading.innerHTML = '📦 Chargement html2canvas...';
    
    if (!window.html2canvas) {
      console.log('📥 Chargement html2canvas depuis CDN...');
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => {
          console.log('✅ html2canvas chargé');
          resolve();
        };
        script.onerror = () => reject(new Error('Erreur chargement html2canvas'));
        document.head.appendChild(script);
      });
    }
    
    // Étape 2: Sélectionner le contenu à exporter
    loading.innerHTML = '🎯 Sélection du contenu...';
    
    let targetElement = document.querySelector('main.main-content');
    if (!targetElement) {
      targetElement = document.querySelector('main');
    }
    if (!targetElement) {
      targetElement = document.querySelector('.main-content');
    }
    if (!targetElement) {
      targetElement = document.body;
    }
    
    console.log('📋 Élément cible:', targetElement.tagName, targetElement.className);
    
    // Étape 3: Générer le canvas
    loading.innerHTML = '🎨 Génération du canvas...';
    
    // Étendre temporairement pour capturer toute la largeur/hauteur
    const prevOverflow = targetElement.style.overflow;
    const prevWidth = targetElement.style.width;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyWidth = document.body.style.width;
    document.body.style.overflow = 'visible';
    document.body.style.width = document.body.scrollWidth + 'px';
    targetElement.style.overflow = 'visible';
    targetElement.style.width = targetElement.scrollWidth + 'px';

    const canvas = await window.html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: targetElement.scrollWidth,
      height: targetElement.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: targetElement.scrollWidth,
      windowHeight: targetElement.scrollHeight,
      pixelRatio: 2,
      foreignObjectRendering: true,
      onclone: (clonedDoc) => {
        // Forcer la visibilité de tous les éléments importants
        const allCards = clonedDoc.querySelectorAll('.card');
        allCards.forEach(card => {
          card.style.opacity = '1';
          card.style.visibility = 'visible';
          card.style.display = 'block';
        });
        
        // Forcer la visibilité de tous les tableaux
        const allTables = clonedDoc.querySelectorAll('table');
        allTables.forEach(table => {
          table.style.opacity = '1';
          table.style.visibility = 'visible';
          table.style.display = 'table';
        });
        
        // Forcer la visibilité de la section validations-table
        const validationsTable = clonedDoc.querySelector('#validations-table');
        if (validationsTable) {
          const card = validationsTable.closest('.card');
          if (card) {
            card.style.opacity = '1';
            card.style.visibility = 'visible';
            card.style.display = 'block';
          }
          validationsTable.style.opacity = '1';
          validationsTable.style.visibility = 'visible';
          validationsTable.style.display = 'table';
          const tbody = validationsTable.querySelector('tbody');
          if (tbody) {
            tbody.style.opacity = '1';
            tbody.style.visibility = 'visible';
          }
        }
      }
    });
    
    console.log('✅ Canvas généré:', canvas.width, 'x', canvas.height);
    // Restaurer les styles
    targetElement.style.overflow = prevOverflow;
    targetElement.style.width = prevWidth;
    document.body.style.overflow = prevBodyOverflow;
    document.body.style.width = prevBodyWidth;
    
    // Étape 4: Créer et télécharger l'image PNG
    loading.innerHTML = '💾 Génération PNG...';
    
    const dataURL = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `rapport-presence-${timestamp}.png`;
    link.href = dataURL;
    
    // Déclencher le téléchargement
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('✅ Export PNG terminé avec succès !');
    loading.innerHTML = '✅ Export PNG réussi !<br><small>Téléchargement en cours...</small>';
    
    // Nettoyer après 2 secondes
    setTimeout(() => {
      if (loading.parentNode) {
        document.body.removeChild(loading);
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ Erreur export PNG:', error);
    loading.innerHTML = `❌ Erreur export PNG:<br>${error.message}`;
    
    setTimeout(() => {
      if (loading.parentNode) {
        document.body.removeChild(loading);
      }
    }, 3000);
    
    alert(`Erreur lors de l'export PNG:\n\n${error.message}\n\nVérifiez la console pour plus de détails.`);
  }
};

// Fonction d'export PNG ultra-simple (alternative de secours)
window.exportAsImageSimple = async function() {
  console.log('🖼️ Export PNG ultra-simple...');
  
  try {
    // Charger html2canvas si nécessaire
    if (!window.html2canvas) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    
    // Exporter directement le body
    const canvas = await window.html2canvas(document.body, {
      scale: 2,
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      foreignObjectRendering: true
    });
    
    // Télécharger
    const link = document.createElement('a');
    link.download = `rapport-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    console.log('✅ Export simple réussi !');
    
  } catch (error) {
    console.error('❌ Erreur export simple:', error);
    alert('Erreur export: ' + error.message);
  }
};

// Ancienne fonction complexe (gardée en commentaire pour référence)
window.exportAsImageComplex = async function() {
  const loading = document.createElement('div');
  loading.style.position = 'fixed';
  loading.style.top = '50%';
  loading.style.left = '50%';
  loading.style.transform = 'translate(-50%, -50%)';
  loading.style.padding = '20px';
  loading.style.backgroundColor = 'rgba(0,0,0,0.8)';
  loading.style.color = 'white';
  loading.style.borderRadius = '5px';
  loading.style.zIndex = '99999';
  loading.style.textAlign = 'center';
  loading.innerHTML = 'Préparation de l\'export image...<br><small>Veuillez patienter</small>';
  document.body.appendChild(loading);
  
  let container = null;
  
  try {
    console.log('🚀 Début de l\'export d\'image...');
    console.log('🔍 Vérification de l\'environnement:', {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      windowSize: { width: window.innerWidth, height: window.innerHeight }
    });
    
    // Charger html2canvas
    console.log('📦 Chargement de html2canvas...');
    await loadHtml2Canvas();
    console.log('✅ html2canvas chargé avec succès');
    
    // Vérifier que html2canvas est bien disponible
    if (typeof window.html2canvas !== 'function' && typeof html2canvas !== 'function') {
      throw new Error('html2canvas n\'est pas disponible après le chargement');
    }
    console.log('✅ html2canvas vérifié et disponible');
    
    loading.innerHTML = 'Création de la structure pour l\'export...';
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Récupérer le conteneur principal (main ou fallback)
    let mainContent = document.querySelector('main.main-content');
    
    // Fallback si le sélecteur principal ne fonctionne pas
    if (!mainContent) {
      mainContent = document.querySelector('main');
    }
    
    // Autre fallback
    if (!mainContent) {
      mainContent = document.querySelector('.main-content');
    }
    
    // Dernier fallback - utiliser le body
    if (!mainContent) {
      mainContent = document.body;
      console.warn('⚠️ Utilisation du body comme conteneur de fallback');
    }
    
    if (!mainContent) {
      console.error('❌ Aucun conteneur trouvé');
      throw new Error('Aucun conteneur trouvé pour l\'export');
    }
    
    console.log('✅ Conteneur principal trouvé:', mainContent.tagName, mainContent.className);
    
    loading.innerHTML = 'Clonage du contenu...';
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Cloner tout le contenu
    const clone = mainContent.cloneNode(true);
    
    // Nettoyer le clone pour l'export
    const cleanElement = (el) => {
      if (!el) return;
      
      // Supprimer les boutons et éléments interactifs
      const buttons = el.querySelectorAll('button, .btn, .dropdown, .no-print, .filter-actions');
      buttons.forEach(btn => {
        if (!btn.classList.contains('table-dark')) {
          btn.remove();
        }
      });
      
      // Supprimer les sélecteurs de mois/année (on garde juste l'en-tête)
      const monthSelector = el.querySelector('#month-selector');
      const yearSelector = el.querySelector('#year-selector');
      if (monthSelector) monthSelector.parentNode.removeChild(monthSelector);
      if (yearSelector) yearSelector.parentNode.removeChild(yearSelector);
      
      // Supprimer les éléments circular-nav
      const navs = el.querySelectorAll('circular-nav');
      navs.forEach(nav => nav.remove());
      
      // Nettoyer les liens
      const links = el.querySelectorAll('a');
      links.forEach(link => {
        link.style.pointerEvents = 'none';
        link.style.textDecoration = 'none';
        link.style.color = 'inherit';
      });
      
      // Supprimer les spinners de chargement
      const spinners = el.querySelectorAll('.spinner-border, .visually-hidden');
      spinners.forEach(spinner => spinner.remove());
      
      // Afficher les tableaux cachés
      const hiddenTables = el.querySelectorAll('table[style*="display: none"]');
      hiddenTables.forEach(table => table.style.display = 'table');
      
      // Afficher les éléments qui doivent être visibles pour l'export
      const reportResults = el.querySelector('#report-results');
      if (reportResults) {
        reportResults.style.display = 'block';
      }
      
      // Rendre les canvas Chart.js visibles et nets
      const canvases = el.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.marginBottom = '20px';
        canvas.style.opacity = '1';
        canvas.style.position = 'relative';
        canvas.style.zIndex = '1';
      });
      
      // S'assurer que tous les tableaux sont visibles et nets
      const tables = el.querySelectorAll('table');
      tables.forEach(table => {
        table.style.display = 'table';
        table.style.opacity = '1';
        table.style.position = 'relative';
        table.style.zIndex = '1';
        table.style.borderCollapse = 'separate';
        table.style.borderSpacing = '0';
      });
      
      // S'assurer que la section validations est visible
      const validationsTable = el.querySelector('#validations-table');
      if (validationsTable) {
        // Rendre le tableau visible
        validationsTable.style.display = 'table';
        validationsTable.style.opacity = '1';
        validationsTable.style.visibility = 'visible';
        validationsTable.style.position = 'relative';
        validationsTable.style.zIndex = '1';
        
        // Rendre le conteneur table-responsive visible
        const tableResponsive = validationsTable.closest('.table-responsive');
        if (tableResponsive) {
          tableResponsive.style.display = 'block';
          tableResponsive.style.opacity = '1';
          tableResponsive.style.visibility = 'visible';
          tableResponsive.style.position = 'relative';
          tableResponsive.style.zIndex = '1';
          tableResponsive.style.width = '100%';
          tableResponsive.style.overflowX = 'visible';
          console.log('✅ Conteneur table-responsive rendu visible');
        }
        
        // Rendre la carte parent visible
        const validationsCard = validationsTable.closest('.card');
        if (validationsCard) {
          validationsCard.style.display = 'block';
          validationsCard.style.opacity = '1';
          validationsCard.style.visibility = 'visible';
          validationsCard.style.position = 'relative';
          validationsCard.style.zIndex = '1';
          console.log('✅ Carte validations rendue visible');
        }
        
        // Rendre tous les éléments parents visibles
        let parent = validationsTable.parentElement;
        while (parent && parent !== el) {
          parent.style.display = parent.style.display || 'block';
          parent.style.opacity = '1';
          parent.style.visibility = 'visible';
          parent.style.position = parent.style.position || 'relative';
          parent = parent.parentElement;
        }
        
        console.log('✅ Section validations rendue visible');
      }
      
      // Nettoyer les styles overflow
      el.style.overflow = 'visible';
      el.style.height = 'auto';
      
      // Corriger les couleurs de texte
      el.querySelectorAll('*').forEach(elem => {
        elem.style.color = elem.style.color || '#212529';
      });
      
      console.log('✅ Éléments nettoyés pour l\'export');
      console.log(`📊 Canvas trouvés: ${el.querySelectorAll('canvas').length}`);
      console.log(`📋 Tableaux trouvés: ${el.querySelectorAll('table').length}`);
    };
    
    loading.innerHTML = 'Nettoyage des éléments interactifs...';
    await new Promise(resolve => setTimeout(resolve, 300));
    
    cleanElement(clone);
    
    // Créer un conteneur pour l'export
    container = document.createElement('div');
    container.id = 'export-container';
    container.style.position = 'absolute';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.width = '1200px';
    container.style.backgroundColor = 'white';
    container.style.padding = '40px';
    container.style.boxSizing = 'border-box';
    
    // Ajouter des styles pour l'export
    const style = document.createElement('style');
    style.textContent = `
      #export-container { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }
      #export-container .card { 
        border: 1px solid #dee2e6 !important; 
        border-radius: 0.5rem !important; 
        margin-bottom: 1.5rem !important; 
        box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.075) !important;
      }
      #export-container .card-header { 
        padding: 0.75rem 1.25rem !important; 
        background-color: #f8f9fa !important; 
        border-bottom: 1px solid #dee2e6 !important; 
      }
      #export-container .card-body { 
        padding: 1.25rem !important; 
      }
      #export-container .card-body.p-0 { 
        padding: 0 !important; 
      }
      #export-container .table { 
        width: 100% !important; 
        margin-bottom: 1rem !important; 
        color: #212529 !important; 
        border-collapse: collapse !important; 
        font-size: 14px !important;
      }
      #export-container .table th, #export-container .table td { 
        padding: 0.75rem !important; 
        vertical-align: top !important; 
        border: 1px solid #dee2e6 !important; 
      }
      #export-container .table thead th { 
        vertical-align: bottom !important; 
        border-bottom: 2px solid #dee2e6 !important; 
        background-color: #f8f9fa !important;
        font-weight: 600 !important;
      }
      #export-container .table-striped > tbody > tr:nth-of-type(odd) { 
        background-color: rgba(0,0,0,0.02) !important; 
      }
      #export-container .metric-card { 
        background: #f8f9fa !important; 
        border-radius: 8px !important; 
        padding: 20px !important; 
        text-align: center !important;
        border: 1px solid #dee2e6 !important;
      }
      #export-container canvas { 
        max-width: 100% !important; 
        height: auto !important; 
        display: block !important;
        opacity: 1 !important;
        position: relative !important;
        z-index: 1 !important;
        margin: 20px 0 !important;
        background: white !important;
      }
      #export-container .chart-container {
        background: white !important;
        padding: 20px !important;
        margin-bottom: 20px !important;
        border: 1px solid #dee2e6 !important;
        border-radius: 0.5rem !important;
      }
      #export-container .report-charts {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 20px !important;
        margin: 20px 0 !important;
      }
      #export-container .progress { 
        height: 20px !important; 
        overflow: visible !important;
        background-color: #e9ecef !important;
        border-radius: 0.25rem !important;
      }
      #export-container .progress-bar { 
        height: 100% !important;
        background-color: #0d6efd !important;
        border-radius: 0.25rem !important;
      }
      #export-container .table-responsive {
        overflow: visible !important;
        width: 100% !important;
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      #export-container #validations-table {
        display: table !important;
        opacity: 1 !important;
        visibility: visible !important;
        position: relative !important;
        z-index: 1 !important;
        background: white !important;
      }
      #export-container .card {
        page-break-inside: avoid !important;
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      #export-container .card:has(#validations-table),
      #export-container .card .table-responsive:has(#validations-table),
      #export-container .card:has(.table-responsive #validations-table) {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        position: relative !important;
        z-index: 1 !important;
        background: white !important;
      }
      #export-container h3, #export-container h4, #export-container h5 {
        color: #212529 !important;
        font-weight: 600 !important;
        margin-top: 0 !important;
      }
    `;
    
    container.appendChild(style);
    container.appendChild(clone);
    document.body.appendChild(container);
    
    loading.innerHTML = 'Génération de l\'image en haute résolution...';
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Vérifications avant génération du canvas
    console.log('🔍 Vérifications avant génération du canvas...');
    console.log('Container dimensions:', {
      width: container.offsetWidth,
      height: container.offsetHeight,
      scrollWidth: container.scrollWidth,
      scrollHeight: container.scrollHeight
    });
    
    // Vérifier que le conteneur a du contenu
    if (container.offsetHeight === 0) {
      throw new Error('Le conteneur d\'export est vide - Aucun contenu à exporter');
    }
    
    // Vérifier que html2canvas est disponible
    if (typeof html2canvas !== 'function' && typeof window.html2canvas !== 'function') {
      throw new Error('html2canvas n\'est pas disponible - Erreur de chargement de la bibliothèque');
    }
    
    console.log('✅ Toutes les vérifications passées, génération du canvas...');
    
    const canvas = await (window.html2canvas || html2canvas)(container, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      scrollY: 0,
      scrollX: 0,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight,
      ignoreElements: (element) => {
        // Ignorer les éléments cachés ou vides
        return element.style.display === 'none' || 
               element.style.visibility === 'hidden' ||
               element.offsetParent === null ||
               element.classList.contains('spinner-border');
      },
      onclone: (clonedDoc) => {
        // S'assurer que tous les canvas sont bien visibles dans le clone
        const clonedCanvases = clonedDoc.querySelectorAll('canvas');
        clonedCanvases.forEach(canvas => {
          canvas.style.display = 'block';
          canvas.style.opacity = '1';
          canvas.style.visibility = 'visible';
          canvas.style.position = 'relative';
          canvas.style.zIndex = '1';
        });
        
        // S'assurer que tous les tableaux sont visibles
        const clonedTables = clonedDoc.querySelectorAll('table');
        clonedTables.forEach(table => {
          table.style.display = 'table';
          table.style.opacity = '1';
          table.style.visibility = 'visible';
          table.style.position = 'relative';
        });
      }
    });
    
    // Vérifier que le canvas a été généré correctement
    if (!canvas) {
      throw new Error('Échec de la génération du canvas - Aucune image générée');
    }
    
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas vide généré - Dimensions nulles');
    }
    
    console.log('✅ Canvas généré avec succès:', {
      width: canvas.width,
      height: canvas.height
    });
    
    loading.innerHTML = 'Téléchargement de l\'image...';
    
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString().split('T')[1].substring(0, 5).replace(':', '-');
    link.download = `rapport-complet-${date}-${time}.png`;
    
    // Générer l'URL de l'image
    const imageDataUrl = canvas.toDataURL('image/png');
    if (!imageDataUrl || imageDataUrl === 'data:,') {
      throw new Error('Échec de la génération de l\'URL de l\'image');
    }
    
    link.href = imageDataUrl;
    document.body.appendChild(link);
    
    console.log('📥 Déclenchement du téléchargement...');
    link.click();
    
    // Attendre un peu avant de supprimer le lien
    await new Promise(resolve => setTimeout(resolve, 100));
    document.body.removeChild(link);
    
    console.log('✅ Export terminé avec succès !');
    loading.innerHTML = '✅ Export terminé avec succès !';
    await new Promise(resolve => setTimeout(resolve, 800));
    
  } catch (error) {
    console.error('🚨 ERREUR DÉTAILLÉE lors de la génération de l\'image:', error);
    console.error('📊 Stack trace complète:', error.stack);
    console.error('🏷️ Type d\'erreur:', error.name);
    console.error('💬 Message détaillé:', error.message);
    console.error('🔍 Propriétés de l\'erreur:', Object.keys(error));
    
    // Diagnostic détaillé avec plus d'informations
    let errorDetails = 'Erreur inconnue';
    let errorCode = 'UNKNOWN';
    
    if (error.message) {
      errorDetails = error.message;
    } else if (error.name) {
      errorDetails = error.name;
    }
    
    // Vérifications spécifiques avec codes d'erreur
    if (error.message && error.message.includes('html2canvas')) {
      errorDetails = 'Erreur de chargement de la bibliothèque html2canvas';
      errorCode = 'HTML2CANVAS_LOAD_ERROR';
    } else if (error.message && error.message.includes('canvas')) {
      errorDetails = 'Erreur de génération du canvas';
      errorCode = 'CANVAS_GENERATION_ERROR';
    } else if (error.message && error.message.includes('CORS')) {
      errorDetails = 'Erreur CORS - Problème de sécurité du navigateur';
      errorCode = 'CORS_ERROR';
    } else if (error.message && error.message.includes('memory')) {
      errorDetails = 'Erreur de mémoire - Page trop volumineuse';
      errorCode = 'MEMORY_ERROR';
    } else if (error.name === 'TypeError') {
      errorDetails = 'Erreur de type - Élément non trouvé ou invalide';
      errorCode = 'TYPE_ERROR';
    } else if (error.name === 'ReferenceError') {
      errorDetails = 'Erreur de référence - Variable ou fonction non définie';
      errorCode = 'REFERENCE_ERROR';
    } else if (error.name === 'SecurityError') {
      errorDetails = 'Erreur de sécurité - Restrictions du navigateur';
      errorCode = 'SECURITY_ERROR';
    } else if (error.name === 'NetworkError') {
      errorDetails = 'Erreur réseau - Problème de connexion';
      errorCode = 'NETWORK_ERROR';
    }
    
    console.error(`🎯 Code d'erreur identifié: ${errorCode}`);
    console.error(`📝 Message final: ${errorDetails}`);
    
    loading.innerHTML = `❌ Erreur [${errorCode}]: ${errorDetails}`;
    await new Promise(resolve => setTimeout(resolve, 2000));
    alert(`Une erreur est survenue lors de l'export en image :\n\nCode: ${errorCode}\nMessage: ${errorDetails}\n\nVérifiez la console pour plus de détails.`);
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
    // Rechercher une correspondance insensible à la casse
    const matchingProject = projectsList.find(project => 
      project.toLowerCase() === currentValue.toLowerCase()
    );
    if (matchingProject) {
      select.value = matchingProject;
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
          // Préserver la casse originale du nom du projet
          const projectName = String(user.project_name).trim();
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
                // Préserver la casse originale du nom du projet
                const projectName = String(user.project_name).trim();
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

  // Gestionnaire d'événement pour le bouton d'export HTML
  const exportHtmlBtn = document.getElementById('export-html');
  if (exportHtmlBtn) {
    exportHtmlBtn.addEventListener('click', exportAsHtml);
  }

  // Initialisation du tableau récapitulatif des présences
async function updatePresenceSummary() {
  try {
    const month = parseInt(document.getElementById('month-selector').value);
    const year = parseInt(document.getElementById('year-selector').value);
    
    // Récupérer tous les filtres actifs avec getSelectedFilters() pour la cohérence
    const filters = (typeof getSelectedFilters === 'function') ? getSelectedFilters() : {
      project: document.getElementById('project-filter')?.value || 'all',
      department: document.getElementById('department-filter')?.value || 'all',
      commune: document.getElementById('commune-filter')?.value || 'all',
      agentId: document.getElementById('agent-filter')?.value || 'all',
      supervisorId: document.getElementById('supervisor-filter')?.value || 'all'
    };
    
    const projectFilter = filters.project;
    const departementFilter = filters.department;
    const communeFilter = filters.commune;
    const agentFilter = filters.agentId;
    const supervisorFilter = filters.supervisorId;
    
    console.log('🔍 Filtres actifs pour le récapitulatif mensuel:', { 
      projectFilter, 
      departementFilter, 
      communeFilter, 
      agentFilter, 
      supervisorFilter 
    });
    console.log('📍 Source des filtres: getSelectedFilters()');
    
    // Afficher le spinner de chargement
    const tbody = document.querySelector('#presence-summary tbody');
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Chargement...</span>
          </div>
        </td>
      </tr>`;

    // Utiliser l'endpoint /api/presence-summary qui calcule déjà tout
    console.log(`📊 Chargement du récapitulatif pour ${month}/${year}`);
    
    let summaryResponse;
    try {
      // Construire l'URL avec le filtre projet
      let apiUrl = `/presence-summary?month=${month}&year=${year}`;
      if (projectFilter && projectFilter !== 'all') {
        apiUrl += `&project_name=${encodeURIComponent(projectFilter)}`;
      }
      summaryResponse = await api(apiUrl);
      console.log('Réponse API presence-summary:', summaryResponse);
    } catch (error) {
      console.error('Erreur avec /api/presence-summary:', error);
      throw error;
    }
    
    // Gérer la réponse de l'API
    const summaryData = summaryResponse?.data || [];
    console.log('Données extraites:', summaryData.length, 'agents');
    
    if (!summaryData || !Array.isArray(summaryData) || summaryData.length === 0) {
      console.warn('Aucune donnée de récapitulatif trouvée pour la période sélectionnée');
    } else {
      console.log(`${summaryData.length} agents chargés`);
      if (summaryData.length > 0) {
        console.log('Premier agent:', summaryData[0]);
        console.log('Clés du premier agent:', Object.keys(summaryData[0]));
      }
      
      // Chercher l'agent FAKOUNDE Constantin pour le débogage
      const fakounde = summaryData.find(agent => 
        agent.name && (agent.name.includes('FAKOUNDE') || agent.name.includes('Fakounde') || agent.name.includes('Constantin'))
      );
      if (fakounde) {
        console.log('🔍 Agent FAKOUNDE Constantin trouvé:', fakounde);
        console.log('   - present_days:', fakounde.present_days);
        console.log('   - planned_days:', fakounde.planned_days);
        console.log('   - expected_days:', fakounde.expected_days);
        console.log('   - presence_rate:', fakounde.presence_rate);
      } else {
        console.warn('⚠️ Agent FAKOUNDE Constantin non trouvé dans les données de l\'API');
      }
    }
    
    // Utiliser les données du récapitulatif directement
    const summaryResult = summaryData;
    
    // Appliquer les filtres côté client si nécessaire
    let filteredResult = summaryResult;
    
    if (projectFilter && projectFilter !== 'all') {
      filteredResult = filteredResult.filter(agent => agent.project === projectFilter);
    }
    
    if (departementFilter && departementFilter !== 'all') {
      filteredResult = filteredResult.filter(agent => agent.departement === departementFilter);
    }
    
    if (communeFilter && communeFilter !== 'all') {
      filteredResult = filteredResult.filter(agent => agent.commune === communeFilter);
    }
    
    if (agentFilter && agentFilter !== 'all') {
      filteredResult = filteredResult.filter(agent => agent.user_id === parseInt(agentFilter));
    }
    
    console.log(`📈 Récapitulatif final: ${filteredResult.length} agents avec des données de présence`);
    
    // Générer les lignes du tableau
    const agentsWithData = filteredResult;
    console.log(`✅ Statistiques finales: ${agentsWithData.length} utilisateurs avec données`);
    
    if (agentsWithData.length === 0) {
      console.warn('⚠️ Aucune statistique générée. Vérifiez les filtres et les données.');
      console.log('Filtres actifs:', { projectFilter, departementFilter, communeFilter });
      
      let debugInfo = '';
      if (summaryResult.length > 0) {
        debugInfo = `
          <div class="mt-2 small">
            <div><strong>${summaryResult.length} agents</strong> trouvés pour cette période</div>
            ${projectFilter ? `<div>Filtre projet: <strong>${projectFilter}</strong></div>` : ''}
            ${departementFilter ? `<div>Filtre département: <strong>${departementFilter}</strong></div>` : ''}
            ${communeFilter ? `<div>Filtre commune: <strong>${communeFilter}</strong></div>` : ''}
            <div class="text-muted">Vérifiez que les filtres correspondent aux données.</div>
          </div>`;
      }
      
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4">
            Aucune donnée de présence disponible pour cette période avec les filtres actuels.
            ${debugInfo}
          </td>
        </tr>`;
      return;
    }
    
    // Récupérer les permissions approuvées pour le mois/année sélectionné
    // Map pour stocker les agents avec leurs observations de permissions
    const agentsWithPermissions = new Map(); // Map<agentId, observations[]>
    try {
      const token = localStorage.getItem('jwt');
      if (token) {
        // Récupérer toutes les permissions approuvées
        const permissionsResponse = await fetch('/api/permissions', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (permissionsResponse.ok) {
          const permissionsData = await permissionsResponse.json();
          const allPermissions = Array.isArray(permissionsData?.permissions) ? permissionsData.permissions : [];
          
          // Filtrer les permissions approuvées pour le mois sélectionné
          const monthValue = `${year}-${String(month).padStart(2, '0')}`;
          const approvedPermissions = allPermissions.filter(perm => {
            if (perm.status !== 'approved') return false;
            
            // Vérifier si la permission est dans le mois sélectionné
            if (perm.start_date) {
              const permMonth = perm.start_date.substring(0, 7); // YYYY-MM
              return permMonth === monthValue;
            }
            return false;
          });
          
          // Grouper les observations par agent
          approvedPermissions.forEach(perm => {
            const agentId = perm.agent_id || perm.agent?.id;
            if (!agentId) return;
            
            const agentIdStr = String(agentId);
            
            // Construire l'observation de la permission
            const startDate = new Date(perm.start_date).toLocaleDateString('fr-FR');
            const endDate = new Date(perm.end_date).toLocaleDateString('fr-FR');
            const duration = Math.ceil((new Date(perm.end_date) - new Date(perm.start_date)) / (1000 * 60 * 60 * 24)) + 1;
            
            let observation = `Permission du ${startDate} au ${endDate} (${duration} jour${duration > 1 ? 's' : ''})`;
            
            // Ajouter le motif de rejet s'il existe (pour les permissions rejetées puis approuvées)
            if (perm.rejection_reason) {
              observation += ` - Motif: ${perm.rejection_reason}`;
            }
            
            // Ajouter une note si elle existe
            if (perm.note) {
              observation += ` - Note: ${perm.note}`;
            }
            
            // Stocker l'observation pour cet agent
            if (!agentsWithPermissions.has(agentIdStr)) {
              agentsWithPermissions.set(agentIdStr, []);
            }
            agentsWithPermissions.get(agentIdStr).push(observation);
          });
          
          console.log(`✅ ${approvedPermissions.length} permission(s) approuvée(s) trouvée(s) pour ${monthValue}`);
        }
      }
    } catch (error) {
      console.warn('Erreur lors de la récupération des permissions:', error);
    }

    // Générer le tableau avec les données filtrées
    const DAYS_REQUIRED = 20; // Nombre de jours requis par mois
    
    console.log(`📊 Génération du tableau avec ${agentsWithData.length} utilisateurs`);  

    let tableContent = '';
    
    if (filteredResult.length === 0) {
      tableContent = `
        <tr>
          <td colspan="6" class="text-center py-4">
            Aucune donnée de présence disponible pour cette période avec les filtres actuels.
          </td>
        </tr>`;
    } else {
      filteredResult.forEach(agent => {
        // S'assurer que toutes les valeurs sont définies et numériques
        const expectedDays = (agent.expected_days !== undefined && agent.expected_days !== null) ? parseInt(agent.expected_days) : 20;
        const plannedDays = (agent.planned_days !== undefined && agent.planned_days !== null) ? parseInt(agent.planned_days) : 0;
        const presentDays = (agent.present_days !== undefined && agent.present_days !== null) ? parseInt(agent.present_days) : 0;
        
        // Log pour déboguer les agents avec des valeurs manquantes
        if (agent.present_days === undefined || agent.present_days === null) {
          console.warn(`⚠️ Agent ${agent.name} (ID: ${agent.user_id}) n'a pas de present_days défini. Valeur brute:`, agent.present_days);
          console.log('Données complètes de l\'agent:', agent);
        }
        
        // Taux global mensuel par rapport aux 20 jours attendus
        const presenceRate = (agent.presence_rate !== undefined && agent.presence_rate !== null) 
          ? parseInt(agent.presence_rate) 
          : Math.min(100, Math.round((presentDays / expectedDays) * 100));
        
        // Déterminer la classe de la barre de progression
        let progressClass = 'bg-success';
        if (presenceRate < 50) progressClass = 'bg-danger';
        else if (presenceRate < 80) progressClass = 'bg-warning';

        // Construire les observations avec les permissions
        let observationText = agent.observation || '';
        const agentIdStr = String(agent.user_id || '');
        
        // Ajouter les observations des permissions approuvées
        if (agentsWithPermissions.has(agentIdStr)) {
          const permissionObservations = agentsWithPermissions.get(agentIdStr);
          const permissionsText = permissionObservations.join(' | ');
          
          if (observationText) {
            observationText = `${observationText} | ${permissionsText}`;
          } else {
            observationText = permissionsText;
          }
        }

        tableContent += `
          <tr>
            <td>${agent.name || 'Non renseigné'}</td>
            <td>${agent.project || '-'}</td>
            <td>${expectedDays}</td>
            <td>${plannedDays}</td>
            <td>${presentDays}</td>
            <td>
              <div class="progress" style="height: 20px;">
                <div class="progress-bar ${progressClass}" 
                     role="progressbar" 
                     style="width: ${presenceRate}%" 
                     aria-valuenow="${presenceRate}" 
                     aria-valuemin="0" 
                     aria-valuemax="100">
                  ${presenceRate}%
                </div>
              </div>
            </td>
            <td>
              <input type="text" 
                     class="form-control form-control-sm observation-input" 
                     data-user-id="${agent.user_id}" 
                     data-month="${month}" 
                     data-year="${year}"
                     placeholder="Ajouter une note..."
                     value="${(observationText || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}">
            </td>
          </tr>`;
      });
    }

    tbody.innerHTML = tableContent;
    
    // Extraire les projets uniques du récapitulatif mensuel (depuis le DOM) et mettre à jour le filtre
    updateSummaryProjectFilter();

    // Ajouter les gestionnaires d'événements pour les champs d'observation
    document.querySelectorAll('#presence-summary .observation-input').forEach(input => {
      // Récupérer les données
      const userId = input.getAttribute('data-user-id');
      const month = input.getAttribute('data-month');
      const year = input.getAttribute('data-year');
      const key = `monthly_observation_${userId}_${month}_${year}`;
      
      // Charger la valeur sauvegardée si elle existe
      const savedObservation = localStorage.getItem(key);
      if (savedObservation) {
        input.value = savedObservation;
      }
      
      // Ajouter l'écouteur d'événement pour sauvegarder les modifications
      input.addEventListener('blur', function() {
        const observation = this.value.trim();
        if (observation) {
          localStorage.setItem(key, observation);
          console.log(`Observation sauvegardée pour l'agent ${userId} (${month}/${year}):`, observation);
        } else {
          localStorage.removeItem(key);
          console.log(`Observation supprimée pour l'agent ${userId} (${month}/${year})`);
        }
      });
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du récapitulatif:', error);
    const tbody = document.querySelector('#presence-summary tbody');
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-danger py-4">
          Erreur lors du chargement des données. Veuillez réessayer.
          ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? `<br><small>${error.message}</small>` : ''}
        </td>
      </tr>`;
  }
}

// Fonction utilitaire pour récupérer les filtres actifs
function getActiveFilters() {
  return {
    project: document.getElementById('project-filter')?.value || '',
    departement: document.getElementById('department-filter')?.value || '',
    commune: document.getElementById('commune-filter')?.value || ''
  };
}

// Récupère les filtres sélectionnés sur la page Rapports
window.getSelectedFilters = function() {
  // Filtres de date
  const dateRange = document.getElementById('date-range')?.value || 'today';
  const preciseDate = document.getElementById('date-filter')?.value || '';
  
  // Filtres de sélection
  const agentId = document.getElementById('agent-filter')?.value || 'all';
  const project = document.getElementById('project-filter')?.value || 'all';
  const department = document.getElementById('department-filter')?.value || 'all';
  const commune = document.getElementById('commune-filter')?.value || 'all';
  const supervisorId = document.getElementById('supervisor-filter')?.value || 'all';
  
  return { 
    dateRange, 
    preciseDate, 
    agentId, 
    project,
    department,
    commune,
    supervisorId
  };
}

// Mettre à jour le récapitulatif quand les filtres changent
document.addEventListener('DOMContentLoaded', () => {
  const filterElements = [
    document.getElementById('month-selector'),
    document.getElementById('year-selector'),
    document.getElementById('project-filter'),
    document.getElementById('department-filter'),
    document.getElementById('commune-filter'),
    document.getElementById('agent-filter'),
    document.getElementById('supervisor-filter')
  ].filter(Boolean);
  
  console.log(`✅ ${filterElements.length} filtres attachés au récapitulatif mensuel`);
  
  filterElements.forEach(element => {
    element?.addEventListener('change', updatePresenceSummary);
  });
});

  // Gestionnaires d'événements pour les sélecteurs de mois/année
  const monthSelector = document.getElementById('month-selector');
  const yearSelector = document.getElementById('year-selector');
  
  if (monthSelector && yearSelector) {
    // Définir le mois et l'année actuels par défaut
    const today = new Date();
    monthSelector.value = today.getMonth() + 1;
    yearSelector.value = today.getFullYear();
    
    // Mettre à jour le tableau lors du changement de mois/année
    const updateHandler = () => updatePresenceSummary();
    monthSelector.addEventListener('change', updateHandler);
    yearSelector.addEventListener('change', updateHandler);
    
    // Charger les données initiales
    updatePresenceSummary();
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
  
  // Initialiser les filtres de projet des tableaux
  initializeTableProjectFilters();
  
  window.updateDateInputs();
  window.loadUsersPlanning = loadUsersPlanning; // Exposer la fonction au scope global
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

/**
 * Initialise les filtres de projet pour les tableaux
 */
async function initializeTableProjectFilters() {
  try {
    // Ajouter les gestionnaires d'événements
    setupTableProjectFilterHandlers();
    
    // Les projets seront chargés dynamiquement quand les tableaux seront remplis
    console.log('✅ Filtres de projet des tableaux initialisés');
    
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des filtres de projet des tableaux:', error);
  }
}

/**
 * Récupère la liste des projets depuis l'API
 */
async function getProjectsList() {
  try {
    const headers = await authHeaders();
    const response = await fetch(`${apiBase}/projects`, { headers });
    if (!response.ok) {
      throw new Error(`Erreur ${response.status} lors du chargement des projets`);
    }
    const data = await response.json();
    const projects = data.items || data.projects || data || [];
    return projects.map(project => project.name || project).filter(Boolean);
  } catch (error) {
    console.error('Erreur lors du chargement des projets:', error);
    return [];
  }
}

/**
 * Remplit un menu déroulant de filtres de projet
 */
function populateProjectFilterMenu(menuId, projects) {
  const menu = document.getElementById(menuId);
  if (!menu) {
    console.warn(`Menu ${menuId} non trouvé`);
    return;
  }
  
  // Vider le menu et ajouter l'option "Tous les projets"
  menu.innerHTML = `
    <li><a class="dropdown-item" href="#" data-project="all">
      <i class="bi bi-funnel"></i> Tous les projets
    </a></li>
  `;
  
  // Trier les projets par ordre alphabétique et supprimer les doublons
  const sortedProjects = [...new Set(projects)].sort();
  
  // Ajouter les projets
  sortedProjects.forEach(project => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'dropdown-item';
    a.href = '#';
    a.setAttribute('data-project', project);
    a.innerHTML = `<i class="bi bi-diagram-3"></i> ${project}`;
    li.appendChild(a);
    menu.appendChild(li);
  });
  
  console.log(`Menu ${menuId} mis à jour avec ${sortedProjects.length} projets:`, sortedProjects);
  
  // Test de débogage : vérifier que les projets sont bien détectés
  if (sortedProjects.length === 0) {
    console.warn(`Aucun projet détecté pour le menu ${menuId}`);
  } else {
    console.log(`✅ Projets détectés pour ${menuId}:`, sortedProjects);
  }
}

/**
 * Configure les gestionnaires d'événements pour les filtres de projet des tableaux
 */
function setupTableProjectFilterHandlers() {
  // Filtre pour le tableau de planification
  const planningMenu = document.getElementById('planning-project-filter-menu');
  if (planningMenu) {
    planningMenu.addEventListener('click', (e) => {
      e.preventDefault();
      const item = e.target.closest('a.dropdown-item');
      if (!item) return;
      const project = item.getAttribute('data-project');
      filterPlanningTableByProject(project);
      updatePlanningFilterButton(project);
    });
  }
  
  // Filtre pour le tableau de récapitulatif mensuel
  const summaryMenu = document.getElementById('summary-project-filter-menu');
  if (summaryMenu) {
    summaryMenu.addEventListener('click', (e) => {
      e.preventDefault();
      const item = e.target.closest('a.dropdown-item');
      if (!item) return;
      const project = item.getAttribute('data-project');
      filterSummaryTableByProject(project);
      updateSummaryFilterButton(project);
    });
  }
}

/**
 * Filtre le tableau de planification par projet
 */
function filterPlanningTableByProject(project) {
  const tbody = document.getElementById('users-planning-body');
  if (!tbody) return;
  
  const rows = tbody.querySelectorAll('tr');
  let visibleCount = 0;
  
  const selected = (project || '').trim();
  rows.forEach(row => {
    // Ignorer uniquement les lignes d'état (chargement/erreur) avec un colspan explicite
    if (row.querySelector('td[colspan]')) {
      return;
    }
    
    const rowProject = (row.getAttribute('data-project') || '').trim();
    let shouldShow = false;
    
    if (selected === 'all' || selected === '') {
      shouldShow = true;
    } else {
      // Comparaison exacte du nom du projet (normalisé)
      shouldShow = rowProject === selected;
    }
    
    row.style.display = shouldShow ? '' : 'none';
    if (shouldShow) visibleCount++;
  });
  
  console.log(`Tableau de planification filtré par projet "${project}": ${visibleCount} lignes visibles`);
  
  // Mettre à jour le compteur si disponible
  updatePlanningCount();
}

/**
 * Filtre le tableau de récapitulatif mensuel par projet
 */
function filterSummaryTableByProject(project) {
  const tbody = document.querySelector('#presence-summary tbody');
  if (!tbody) return;
  
  const rows = tbody.querySelectorAll('tr');
  let visibleCount = 0;
  
  rows.forEach(row => {
    // Ignorer les lignes d'erreur ou de chargement
    if (row.querySelector('.text-center') && row.querySelector('.text-center').colSpan) {
      return;
    }
    
    const projectCell = row.querySelector('td:nth-child(2)'); // Colonne Projet
    if (!projectCell) return;
    
    const projectText = projectCell.textContent.trim();
    let shouldShow = false;
    
    if (project === 'all') {
      shouldShow = true;
    } else {
      // Comparaison exacte du nom du projet
      shouldShow = projectText === project;
    }
    
    row.style.display = shouldShow ? '' : 'none';
    if (shouldShow) visibleCount++;
  });
  
  console.log(`Tableau de récapitulatif filtré par projet "${project}": ${visibleCount} lignes visibles`);
}

/**
 * Met à jour l'apparence du bouton de filtre de planification
 */
function updatePlanningFilterButton(project) {
  const btn = document.getElementById('planning-project-filter-btn');
  if (!btn) return;
  
  if (project === 'all') {
    btn.innerHTML = '<i class="bi bi-funnel"></i>';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-outline-secondary');
  } else {
    btn.innerHTML = `<i class="bi bi-funnel-fill"></i> ${project}`;
    btn.classList.remove('btn-outline-secondary');
    btn.classList.add('btn-primary');
  }
}

/**
 * Met à jour l'apparence du bouton de filtre de récapitulatif
 */
function updateSummaryFilterButton(project) {
  const btn = document.getElementById('summary-project-filter-btn');
  if (!btn) return;
  
  if (project === 'all') {
    btn.innerHTML = '<i class="bi bi-funnel"></i>';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-outline-light');
  } else {
    btn.innerHTML = `<i class="bi bi-funnel-fill"></i> ${project}`;
    btn.classList.remove('btn-outline-light');
    btn.classList.add('btn-primary');
  }
}

/**
 * Met à jour le filtre de projet du tableau de planification avec les projets uniques
 */
function updatePlanningProjectFilter(users) {
  try {
    // Extraire les projets uniques des utilisateurs
    const uniqueProjects = [...new Set(users.map(user => {
      const project = user.project_name || user.projet || user.project || '';
      const cleaned = (typeof cleanProjectName === 'function') 
        ? (cleanProjectName(project) || '') 
        : String(project || '').trim();
      return cleaned;
    }).filter(project => project && project !== '—' && project !== '-' && project !== ''))];
    
    console.log('Projets uniques du tableau de planification:', uniqueProjects);
    
    // Mettre à jour le menu déroulant
    populateProjectFilterMenu('planning-project-filter-menu', uniqueProjects);
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour du filtre de projet de planification:', error);
  }
}

/**
 * Met à jour le filtre de projet du récapitulatif mensuel avec les projets uniques
 */
function updateSummaryProjectFilter(summaryData) {
  try {
    let uniqueProjects = [];
    if (Array.isArray(summaryData) && summaryData.length) {
      // Extraire depuis les données si fournies
      uniqueProjects = [...new Set(summaryData.map(agent => {
        const project = agent.project || '';
        return project.trim();
      }).filter(project => project && project !== '—' && project !== '-' && project !== ''))];
    } else {
      // Extraire depuis le DOM rendu
      const tbody = document.querySelector('#presence-summary tbody');
      const projects = new Set();
      if (tbody) {
        tbody.querySelectorAll('tr').forEach(row => {
          const cell = row.querySelector('td:nth-child(2)');
          if (!cell) return;
          const value = (cell.textContent || '').trim();
          if (value && value !== '-' && value !== '—') projects.add(value);
        });
      }
      uniqueProjects = Array.from(projects).sort();
    }
    
    console.log('Projets uniques du récapitulatif mensuel:', uniqueProjects);
    
    // Mettre à jour le menu déroulant
    populateProjectFilterMenu('summary-project-filter-menu', uniqueProjects);
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour du filtre de projet du récapitulatif:', error);
  }
}

/**
 * Met à jour le compteur de planification après filtrage
 */
function updatePlanningCount() {
  const tbody = document.getElementById('users-planning-body');
  if (!tbody) return;
  
  const visibleRows = tbody.querySelectorAll('tr:not([style*="display: none"])');
  let withPlanning = 0;
  let withoutPlanning = 0;
  
  visibleRows.forEach(row => {
    // Ignorer uniquement les lignes d'état (chargement/erreur) avec un colspan explicite
    if (row.querySelector('td[colspan]')) {
      return;
    }
    
    const planningCell = row.querySelector('td:nth-child(5)'); // Colonne Planification
    if (!planningCell) return;
    
    const planningText = planningCell.textContent.trim();
    if (planningText === 'Oui') {
      withPlanning++;
    } else if (planningText === 'Non') {
      withoutPlanning++;
    }
  });
  
  const countElement = document.getElementById('planning-count');
  if (countElement) {
    countElement.innerHTML = `
      <span class="text-success">${withPlanning} avec</span> /
      <span class="text-danger">${withoutPlanning} sans</span>
    `;
  }
}

/**
 * Affiche la liste des agents qui ont planifié mais n'ont pas envoyé de check-ins
 */
async function loadPlannedButAbsent() {
  const tbody = document.getElementById('planned-absent-body');
  if (!tbody) return;

  // Afficher un indicateur de chargement
  tbody.innerHTML = '<tr><td class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></td></tr>';

  try {
    // Vérifier si l'utilisateur est authentifié
    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
      throw new Error('Non authentifié. Veuillez vous reconnecter.');
    }
    
    const apiBase = '/api';
    const targetDate = document.getElementById('date-filter')?.value || new Date().toISOString().split('T')[0];
    
    // Configuration de la requête
    const fetchOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      credentials: 'include',
      cache: 'no-store'
    };
    
    // 1. Récupérer TOUTES les planifications (sans filtre de date d'abord pour le débogage)
    console.log('🔍 [DEBUG] Début de la récupération des planifications');
    console.log('📅 Date cible:', targetDate);
    
    // Vérifier que la date est valide
    if (!targetDate || isNaN(new Date(targetDate).getTime())) {
      const errorMsg = `❌ Date invalide: ${targetDate}`;
      console.error(errorMsg);
      tbody.innerHTML = `
        <tr>
          <td class="text-center">Erreur: Date invalide (${targetDate})</td>
        </tr>`;
      return;
    }
    
    // Formater la date pour l'API (YYYY-MM-DD)
    const formattedDate = new Date(targetDate).toISOString().split('T')[0];
    console.log('📆 Date formatée pour la requête:', formattedDate);
    
    // 1. D'abord, on récupère TOUTES les planifications pour le débogage
    const allPlanningsUrl = new URL(`${apiBase}/planifications`, window.location.origin);
    allPlanningsUrl.searchParams.append('select', 'id,user_id,date_planification,planifie,created_at,updated_at,projet,localisation,users(id,first_name,last_name,role)');
    allPlanningsUrl.searchParams.append('limit', '1000');
    allPlanningsUrl.searchParams.append('_t', Date.now());
    
    console.log('🔗 URL de requête complète (sans filtre de date):', allPlanningsUrl.toString());
    
    // 2. Ensuite, on fait la requête avec le filtre de date
    const planningUrl = new URL(`${apiBase}/planifications`, window.location.origin);
    planningUrl.searchParams.append('date', `eq.${formattedDate}`);
    planningUrl.searchParams.append('select', 'id,user_id,users(first_name,last_name,role),planifie,date_planification,projet,localisation,created_at,updated_at');
    planningUrl.searchParams.append('_t', Date.now());
    
    console.log('🔗 URL de requête avec filtre de date:', planningUrl.toString());
    
    // Options de requête avec gestion du cache
    const requestOptions = {
      ...fetchOptions,
      cache: 'no-store',
      headers: {
        ...fetchOptions.headers,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    };
    
    let allPlanifications = [];
    let planifications = [];
    
    try {
      console.log('🔄 1/2 - Récupération de TOUTES les planifications...');
      const allResponse = await fetch(allPlanningsUrl.toString(), requestOptions);
      if (allResponse.ok) {
        const allData = await allResponse.json();
        console.log('📋 Toutes les planifications disponibles (premiers 5):', 
          Array.isArray(allData) 
            ? allData.slice(0, 5).map(p => ({
                id: p.id,
                user_id: p.user_id,
                date: p.date_planification,
                planifie: p.planifie,
                user: p.users ? `${p.users.first_name} ${p.users.last_name}` : 'N/A'
              }))
            : 'Format de réponse inattendu'
        );
      } else {
        console.error('⚠️ Impossible de récupérer toutes les planifications:', await allResponse.text());
      }
      
      console.log(`🔄 2/2 - Récupération des planifications pour le ${formattedDate}...`);
      const planningResponse = await fetch(planningUrl.toString(), requestOptions);
      console.log('✅ Réponse reçue, statut:', planningResponse.status);
      
      if (!planningResponse.ok) {
        const errorText = await planningResponse.text();
        throw new Error(`Erreur ${planningResponse.status}: ${errorText}`);
      }
      
      const responseData = await planningResponse.json();
      console.log('📦 Réponse brute de l\'API planifications:', responseData);
      
      // Gérer différents formats de réponse
      if (Array.isArray(responseData)) {
        allPlanifications = responseData;
      } else if (responseData && Array.isArray(responseData.items)) {
        allPlanifications = responseData.items;
      } else if (responseData && responseData.data && Array.isArray(responseData.data)) {
        allPlanifications = responseData.data;
      } else if (responseData) {
        // Essayer d'extraire un tableau de la réponse
        const possibleArrays = Object.values(responseData).filter(Array.isArray);
        allPlanifications = possibleArrays.length > 0 ? possibleArrays[0] : [];
      }
      
      console.log(`📊 ${allPlanifications.length} planifications trouvées au total pour la date ${formattedDate}`);
      
      if (allPlanifications.length > 0) {
        console.log('📝 Exemple de planification:', JSON.stringify(allPlanifications[0], null, 2));
      }
      
      // Filtrer les planifications avec planifie = 'Oui' ou true
      planifications = allPlanifications.filter(planning => {
        const isPlanned = planning.planifie === 'Oui' || planning.planifie === true || planning.planifie === 'OUI';
        console.log(`🔍 Planification de ${planning.users?.first_name || 'N/A'} ${planning.users?.last_name || 'N/A'}: ` +
                   `planifié = ${planning.planifie} (${typeof planning.planifie})`);
        return isPlanned;
      });
      
      console.log(`✅ ${planifications.length} planifications actives trouvées (${allPlanifications.length} au total)`);
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des planifications:', error);
      tbody.innerHTML = `
        <tr>
          <td class="text-center">Erreur: ${escapeHtml(error.message)}</td>
        </tr>`;
      return;
    }
    
    if (planifications.length === 0) {
      console.warn('⚠️ Aucune planification active trouvée pour la date', formattedDate);
      tbody.innerHTML = `
        <tr>
          <td class="text-center">Aucune planification active trouvée pour le ${new Date(targetDate).toLocaleDateString('fr-FR')}</td>
        </tr>`;
      return;
    }
    
    // 3. Récupérer les validations de présence pour la même date
    console.log('🔍 Récupération des validations de présence...');
    const validationsUrl = new URL(`${apiBase}/reports/validations`, window.location.origin);
    
    // Ajouter la plage de dates (du jour sélectionné à minuit à minuit le lendemain)
    const startDate = new Date(targetDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
    validationsUrl.searchParams.append('from', startDate.toISOString().split('T')[0]);
    validationsUrl.searchParams.append('to', endDate.toISOString().split('T')[0]);
    
    console.log('URL de la requête des validations:', validationsUrl.toString());
    
    let validatedUserIds = [];
    try {
      const validationsResponse = await fetch(validationsUrl.toString(), {
        ...fetchOptions,
        headers: {
          ...fetchOptions.headers,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (validationsResponse.ok) {
        const responseData = await validationsResponse.json();
        const validations = Array.isArray(responseData?.items) 
          ? responseData.items 
          : Array.isArray(responseData) 
            ? responseData 
            : [];
        
        console.log('📋 Données brutes des validations:', validations);
        
        // Extraire les user_id uniques des validations
        validatedUserIds = [...new Set(validations
          .filter(v => v.agent_id) // Filtrer les validations avec un agent_id valide
          .map(v => v.agent_id.toString()) // Convertir en chaîne pour la comparaison
        )];
        
        console.log(`✅ ${validatedUserIds.length} utilisateurs uniques avec validation trouvés:`, validatedUserIds);
      } else {
        const errorText = await validationsResponse.text();
        console.warn('⚠️ Impossible de récupérer les validations de présence:', {
          status: validationsResponse.status,
          statusText: validationsResponse.statusText,
          error: errorText
        });
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des validations de présence:', error);
    }
    
    // 4. Filtrer les agents planifiés mais absents
    console.log('🔍 Filtrage des agents planifiés mais absents...');
    const plannedButAbsent = planifications.filter(planning => {
      const userId = planning.user_id?.toString();
      const isAbsent = !validatedUserIds.includes(userId);
      console.log(`- ${planning.users?.first_name || 'N/A'} ${planning.users?.last_name || 'N/A'}: ` +
                 `planifié=${planning.planifie}, validé=${!isAbsent}`);
      return isAbsent;
    });
    
    console.log(`📊 ${plannedButAbsent.length} agents planifiés mais absents trouvés`);
    
    // 5. Afficher les résultats dans le tableau
    if (plannedButAbsent.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="text-center">Tous les agents planifiés sont présents pour le ${new Date(targetDate).toLocaleDateString('fr-FR')}</td>
        </tr>`;
      return;
    }
    
    // Trier par nom de famille puis par prénom
    plannedButAbsent.sort((a, b) => {
      const nameA = `${a.users?.last_name || ''} ${a.users?.first_name || ''}`.toLowerCase();
      const nameB = `${b.users?.last_name || ''} ${b.users?.first_name || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    // Générer les lignes du tableau
    tbody.innerHTML = plannedButAbsent.map(planning => {
      const user = planning.users || {};
      return `
        <tr>
          <td>${escapeHtml(user.first_name || '')} ${escapeHtml(user.last_name || '')}</td>
          <td>${escapeHtml(planning.projet || 'Non spécifié')}</td>
          <td>${escapeHtml(planning.localisation || 'Non spécifiée')}</td>
          <td>${planning.date_planification ? new Date(planning.date_planification).toLocaleDateString('fr-FR') : 'Non spécifiée'}</td>
        </tr>`;
    }).join('');
    
    console.log('✅ Affichage des agents planifiés mais absents terminé');
  } catch (error) {
    console.error('❌ Erreur inattendue dans loadPlannedButAbsent:', error);
    tbody.innerHTML = `
      <tr>
        <td class="text-center">Une erreur est survenue: ${escapeHtml(error.message)}</td>
      </tr>`;
  }
}

// Gestionnaire d'erreur global pour la fonction
function handlePlannedAbsentError(error) {
  console.error('❌ Erreur lors du chargement des absents planifiés:', error);
  const tbody = document.getElementById('planned-absent-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td class="text-center text-danger">
          Erreur lors du chargement des absents planifiés: ${escapeHtml(error.message)}
        </td>
      </tr>`;
  }
}

/**
 * Fonction utilitaire pour échapper le HTML
 * @param {string|any} unsafe - La chaîne à échapper
 * @returns {string} La chaîne échappée
 */
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return String(unsafe || '');
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
