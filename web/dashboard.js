// Configuration de l'API - utiliser Render en production sur Vercel
const apiBase = window.location.hostname === 'agent-position.vercel.app' 
    ? 'https://presence-ccrb-v2.onrender.com/api'
    : '/api';
let jwt = localStorage.getItem('jwt') || '';

// Variables globales pour la carte
let checkinMarkers = [];
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
    // Essayer avec email si disponible pour compat
    const email = (new URLSearchParams(window.location.search)).get('email') || localStorage.getItem('userEmail');
    const res = email ? await api(`/profile?email=${encodeURIComponent(email)}`) : await api('/profile');
    // Adapter à la réponse { success, user }
    currentProfile = res && res.user ? res.user : res;
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
let appSettings = null;

async function loadSettings() {
  try {
    const res = await api('/settings');
    if (res && res.success) appSettings = res.settings || null;
  } catch {}
}

async function init() {
  await ensureAuth();
  await loadSettings();
  
  // Vérifier l'accès au dashboard
  const hasAccess = await checkDashboardAccess();
  if (!hasAccess) return;
  
  // Mettre à jour les informations utilisateur
  await updateUserInfo();
  
  // Map
  map = L.map('map').setView([9.3077, 2.3158], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);

  await loadAgents();
  
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

  // Charger les check-ins sur la carte
  try {
    await loadCheckinsOnMap();
  } catch (e) {
    handleDashboardError(e);
  }

  $('refresh').onclick = refresh;
  try {
    await refresh();
  } catch (e) {
    handleDashboardError(e);
  }

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
    console.log('🗺️ Chargement des check-ins pour la carte...');
    
    // Charger les derniers check-ins
    const response = await api('/admin/checkins/latest?limit=100');
    if (response.success && response.checkins) {
      console.log('✅ Check-ins chargés:', response.checkins.length);
      
      // Nettoyer les marqueurs existants
      checkinMarkers.forEach(marker => map.removeLayer(marker));
      checkinMarkers = [];
      
      // Ajouter les marqueurs pour chaque check-in
      response.checkins.forEach(checkin => {
        if (checkin.lat && checkin.lon) {
          const color = colorForAgent(checkin.user_id || checkin.agent_id || 0);
          const marker = L.circleMarker([checkin.lat, checkin.lon], {
            radius: 7,
            fillColor: color,
            color: color,
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.6
          }).addTo(map);
          
          // Popup avec informations du check-in
          const popupContent = `
            <div style="min-width: 200px;">
              <h6><strong>${checkin.agent_name}</strong></h6>
              <p><strong>Rôle:</strong> ${checkin.agent_role}</p>
              <p><strong>Date:</strong> ${new Date(checkin.timestamp).toLocaleString('fr-FR')}</p>
              <p><strong>Position:</strong> ${checkin.commune || 'Non spécifiée'}</p>
              <p><strong>Distance:</strong> ${checkin.distance_from_reference_m ? checkin.distance_from_reference_m + 'm' : 'N/A'}</p>
              <p><strong>Statut:</strong> <span style="color: ${checkin.within_tolerance ? '#10b981' : '#ef4444'}">${checkin.within_tolerance ? '✅ Dans la zone' : '❌ Hors zone'}</span></p>
            </div>
          `;
          
          marker.bindPopup(popupContent);
          checkinMarkers.push(marker);
        }
      });
      
      // Ajuster la vue de la carte pour inclure tous les marqueurs
      if (checkinMarkers.length > 0) {
        const group = new L.featureGroup(checkinMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
      }
      
      console.log('✅ Carte mise à jour avec', checkinMarkers.length, 'marqueurs');
    }
  } catch (error) {
    console.error('❌ Erreur lors du chargement des check-ins:', error);
    handleDashboardError(error);
  }
}

async function loadAgents() {
  const sel = $('agent'); sel.innerHTML = '';
  try {
    const rows = await api('/admin/agents');
    sel.append(new Option('Tous les agents', ''));
    for (const r of rows) sel.append(new Option(`${r.name} (${r.email})`, r.id));
  } catch (e) {
    console.warn('admin/agents indisponible, masquer la liste');
    sel.append(new Option('Liste indisponible', ''));
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
  markersLayer.clearLayers();
  $('timeline').innerHTML = '';
  const date = $('date').value || undefined;
  const agentId = $('agent').value ? Number($('agent').value) : undefined;
  const villageId = $('village').value ? Number($('village').value) : undefined;
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (agentId) params.set('agent_id', String(agentId));
  if (villageId) params.set('village_id', String(villageId));
  const useLatest = !date && !agentId && !villageId;
  let rows;
  try {
    if (useLatest) {
      const resp = await api('/admin/checkins/latest');
      rows = resp && resp.checkins ? resp.checkins : (Array.isArray(resp) ? resp : []);
    } else {
      rows = await api('/admin/checkins?' + params.toString());
    }
  } catch (e) {
    console.warn('Admin checkins API indisponible, tentative fallback public:', e.message || e);
    // Fallback léger: tenter une route publique si disponible
    try {
      const resp = await fetch(apiBase + '/admin/checkins/latest');
      const data = await resp.json().catch(() => null);
      rows = data && data.checkins ? data.checkins : [];
    } catch {}
  }

  const latlngs = [];
  for (const r of rows) {
    if (typeof r.lat !== 'number' || typeof r.lon !== 'number') continue;
    const m = L.marker([r.lat, r.lon]).bindPopup(`<b>${r.agent_name}</b><br>${r.timestamp}<br>${r.departement_name || ''} / ${r.commune_name || ''} / ${r.arrondissement_name || ''} / ${r.village_name || ''}${r.photo_path ? `<br><img src='${r.photo_path}' style='max-width:160px'/>` : ''}`);
    markersLayer.addLayer(m);
    latlngs.push([r.lat, r.lon]);

    const li = document.createElement('li');
    li.textContent = `${r.timestamp} - ${r.agent_name} - (${r.lat.toFixed(5)}, ${r.lon.toFixed(5)})`;
    $('timeline').appendChild(li);
  }
  if (latlngs.length) map.fitBounds(latlngs, { padding: [20, 20] });

  // Export CSV
  const exp = $('export');
  exp.onclick = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(apiBase + '/admin/export/checkins.csv?' + params.toString(), {
        headers: { 'Authorization': 'Bearer ' + jwt }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `checkins-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Erreur lors de l\'export CSV');
      }
    } catch (e) {
      console.error('Export error:', e);
      alert('Erreur lors de l\'export CSV');
    }
  };

  // Export TXT
  const expTxt = $('export-txt');
  if (expTxt) {
    expTxt.onclick = async (e) => {
      e.preventDefault();
      try {
        const response = await fetch(apiBase + '/admin/export/checkins.txt?' + params.toString(), {
          headers: { 'Authorization': 'Bearer ' + jwt }
        });
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `rapport-presence-${new Date().toISOString().split('T')[0]}.txt`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          alert('Erreur lors de l\'export TXT');
        }
      } catch (e) {
        console.error('Export TXT error:', e);
        alert('Erreur lors de l\'export TXT');
      }
    };
  }
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

// Exposer les fonctions globalement
if (typeof window !== 'undefined') {
  window.updatePhotoPreview = updatePhotoPreview;
  window.removePhoto = removePhoto;
  window.testLoadDepartements = loadAfDepartements;
  window.testApi = () => console.log('geoData disponible:', typeof geoData !== 'undefined');
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
});

// Exposer les fonctions globalement
window.getGeoValueDashboard = getGeoValueDashboard;
window.validateGeoFieldsDashboard = validateGeoFieldsDashboard;
window.setupManualGeoInputsDashboard = setupManualGeoInputsDashboard;

init();
