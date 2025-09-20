const apiBase = '/api';
let jwt = localStorage.getItem('jwt') || '';

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
    console.error('API error:', errorText);
    if (res.status === 401 || res.status === 403) {
      try { localStorage.removeItem('jwt'); } catch {}
    }
    throw new Error(errorText || res.statusText);
  }
  
  const ct = res.headers.get('content-type') || '';
  const result = ct.includes('application/json') ? await res.json() : await res.text();
  console.log('API result:', result);
  return result;
}

let currentProfile;

async function getProfile() {
  try {
    currentProfile = await api('/profile');
    return currentProfile;
  } catch (e) {
    throw e;
  }
}

async function ensureAuth() {
  if (!jwt) {
    const email = prompt('Email superviseur/admin ?');
    const password = prompt('Mot de passe ?');
    if (!email || !password) {
      alert('Connexion annulée');
      window.location.href = window.location.origin + '/';
      return;
    }
    try {
      const data = await api('/login', { method: 'POST', body: { email, password } });
      jwt = data.token; localStorage.setItem('jwt', jwt);
    } catch (e) {
      alert('Erreur de connexion: ' + e.message);
      window.location.href = window.location.origin + '/';
    }
  }
  // Verify role
  try {
    const profile = await getProfile();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'supervisor')) {
      alert('Accès refusé: veuillez vous connecter en tant que superviseur ou admin.');
      localStorage.removeItem('jwt');
      window.location.href = window.location.origin + '/';
    }
  } catch (e) {
    alert('Session invalide. Veuillez vous reconnecter.');
    localStorage.removeItem('jwt');
    window.location.href = window.location.origin + '/';
  }
}

let map, markersLayer;

async function init() {
  await ensureAuth();
  
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
  await loadDepartements();
  $('departement').onchange = () => loadCommunes(Number($('departement').value));
  $('commune').onchange = () => loadArrondissements(Number($('commune').value));
  $('arrondissement').onchange = () => loadVillages(Number($('arrondissement').value));

  // Test de chargement des départements au démarrage
  console.log('🚀 Test de chargement des départements au démarrage...');
  setTimeout(() => {
    loadAfDepartements();
  }, 1000);

  $('refresh').onclick = refresh;
  await refresh();

  // Modal agent
  window.openAgentModal = openAgentModal;
  window.closeAgentModal = closeAgentModal;
  const form = document.getElementById('agent-form');
  form.addEventListener('submit', onAgentSubmit);
  
  // Les fonctions sont déjà exposées globalement au moment de leur déclaration
  
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
}

async function loadAgents() {
  const sel = $('agent'); sel.innerHTML = '';
  const rows = await api('/admin/agents');
  sel.append(new Option('Tous les agents', ''));
  for (const r of rows) sel.append(new Option(`${r.name} (${r.email})`, r.id));
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
  $('af_expected_days').value = agent?.expected_days_per_month || '';
  $('af_expected_hours').value = agent?.expected_hours_per_month || '';
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

// Les fonctions de chargement géographique sont maintenant dans geo-data.js

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
  const rows = useLatest
    ? await api('/admin/checkins/latest')
    : await api('/admin/checkins?' + params.toString());

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
      const response = await fetch('/api/admin/export/checkins.csv?' + params.toString(), {
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
        const response = await fetch('/api/admin/export/checkins.txt?' + params.toString(), {
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
    const response = await fetch(`/api/admin/export/monthly-report.csv?month=${month}`, { headers: { 'Authorization': 'Bearer ' + jwt } });
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

// Gérer l'accès au dashboard selon le rôle
async function checkDashboardAccess() {
  try {
    const profile = await getProfile();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'supervisor')) {
      alert('Accès refusé: Cette page est réservée aux superviseurs et administrateurs.');
      localStorage.removeItem('jwt');
      window.location.href = window.location.origin + '/';
      return false;
    }
    return true;
  } catch (e) {
    alert('Session invalide. Veuillez vous reconnecter.');
    localStorage.removeItem('jwt');
    window.location.href = window.location.origin + '/';
    return false;
  }
}

init();
