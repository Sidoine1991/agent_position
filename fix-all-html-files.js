const XLSX = require('xlsx');
const fs = require('fs');

console.log('📊 Correction complète de tous les fichiers HTML...');

try {
  // Lire le fichier Excel
  const workbook = XLSX.readFile('./Data/benin_subdvision.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convertir en JSON
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`✅ ${data.length} lignes trouvées dans le fichier Excel`);
  
  // Organiser les données par hiérarchie
  const geoData = {
    departements: [],
    communes: {},
    arrondissements: {},
    villages: {}
  };
  
  // Extraire les départements
  const departements = data.filter(row => row.list_name === 'depart');
  departements.forEach((row, index) => {
    geoData.departements.push({ id: index + 1, name: row.name });
  });
  
  console.log(`✅ ${geoData.departements.length} départements extraits`);
  
  // Extraire les communes
  const communes = data.filter(row => row.list_name === 'comm');
  communes.forEach((row, index) => {
    const deptIndex = Math.floor(index / Math.ceil(communes.length / geoData.departements.length));
    const departement = geoData.departements[deptIndex] || geoData.departements[0];
    
    if (!geoData.communes[departement.name]) {
      geoData.communes[departement.name] = [];
    }
    
    geoData.communes[departement.name].push({
      id: geoData.communes[departement.name].length + 1,
      name: row.name
    });
  });
  
  // Extraire les arrondissements
  const arrondissements = data.filter(row => row.list_name === 'arrond');
  arrondissements.forEach((row, index) => {
    const communeIndex = Math.floor(index / Math.ceil(arrondissements.length / communes.length));
    const commune = communes[communeIndex];
    
    if (commune) {
      if (!geoData.arrondissements[commune.name]) {
        geoData.arrondissements[commune.name] = [];
      }
      
      geoData.arrondissements[commune.name].push({
        id: geoData.arrondissements[commune.name].length + 1,
        name: row.name
      });
    }
  });
  
  // Extraire les villages
  const villages = data.filter(row => row.list_name === 'villag');
  villages.forEach((row, index) => {
    const arrondissementIndex = Math.floor(index / Math.ceil(villages.length / arrondissements.length));
    const arrondissement = arrondissements[arrondissementIndex];
    
    if (arrondissement) {
      if (!geoData.villages[arrondissement.name]) {
        geoData.villages[arrondissement.name] = [];
      }
      
      geoData.villages[arrondissement.name].push({
        id: geoData.villages[arrondissement.name].length + 1,
        name: row.name
      });
    }
  });
  
  // Créer le script complet
  const completeScript = `
// Données géographiques du Bénin (complètes)
const geoData = ${JSON.stringify(geoData, null, 2)};

// Fonction pour charger les départements
window.loadDepartements = function loadDepartements() {
  const select = document.getElementById('departement');
  if (!select) return;
  
  select.innerHTML = '<option value="">Sélectionner un département...</option>';
  geoData.departements.forEach(dept => {
    const option = document.createElement('option');
    option.value = dept.id;
    option.textContent = dept.name;
    select.appendChild(option);
  });
  
  select.disabled = false;
  console.log('✅ Départements chargés:', geoData.departements.length);
};

// Fonction pour charger les communes
window.loadCommunes = function loadCommunes(departementId) {
  const communeSelect = document.getElementById('commune');
  const arrondissementSelect = document.getElementById('arrondissement');
  const villageSelect = document.getElementById('village');
  
  if (!communeSelect) return;
  
  communeSelect.innerHTML = '<option value="">Sélectionner une commune...</option>';
  communeSelect.disabled = true;
  arrondissementSelect.innerHTML = '<option value="">Sélectionner un arrondissement...</option>';
  arrondissementSelect.disabled = true;
  villageSelect.innerHTML = '<option value="">Sélectionner un village...</option>';
  villageSelect.disabled = true;
  
  if (!departementId) return;
  
  const departement = geoData.departements.find(d => d.id == departementId);
  if (!departement) return;
  
  const communes = geoData.communes[departement.name] || [];
  communes.forEach(commune => {
    const option = document.createElement('option');
    option.value = commune.id;
    option.textContent = commune.name;
    communeSelect.appendChild(option);
  });
  
  communeSelect.disabled = false;
  console.log('✅ Communes chargées pour', departement.name + ':', communes.length);
};

// Fonction pour charger les arrondissements
window.loadArrondissements = function loadArrondissements(communeId) {
  const arrondissementSelect = document.getElementById('arrondissement');
  const villageSelect = document.getElementById('village');
  
  if (!arrondissementSelect) return;
  
  arrondissementSelect.innerHTML = '<option value="">Sélectionner un arrondissement...</option>';
  arrondissementSelect.disabled = true;
  villageSelect.innerHTML = '<option value="">Sélectionner un village...</option>';
  villageSelect.disabled = true;
  
  if (!communeId) return;
  
  let commune = null;
  for (const [deptName, communes] of Object.entries(geoData.communes)) {
    commune = communes.find(c => c.id == communeId);
    if (commune) break;
  }
  
  if (!commune) return;
  
  const arrondissements = geoData.arrondissements[commune.name] || [];
  arrondissements.forEach(arrondissement => {
    const option = document.createElement('option');
    option.value = arrondissement.id;
    option.textContent = arrondissement.name;
    arrondissementSelect.appendChild(option);
  });
  
  arrondissementSelect.disabled = false;
  console.log('✅ Arrondissements chargés pour', commune.name + ':', arrondissements.length);
};

// Fonction pour charger les villages
window.loadVillages = function loadVillages(arrondissementId) {
  const villageSelect = document.getElementById('village');
  
  if (!villageSelect) return;
  
  villageSelect.innerHTML = '<option value="">Sélectionner un village...</option>';
  villageSelect.disabled = true;
  
  if (!arrondissementId) return;
  
  let arrondissement = null;
  for (const [communeName, arrondissements] of Object.entries(geoData.arrondissements)) {
    arrondissement = arrondissements.find(a => a.id == arrondissementId);
    if (arrondissement) break;
  }
  
  if (!arrondissement) return;
  
  const villages = geoData.villages[arrondissement.name] || [];
  villages.forEach(village => {
    const option = document.createElement('option');
    option.value = village.id;
    option.textContent = village.name;
    villageSelect.appendChild(option);
  });
  
  villageSelect.disabled = false;
  console.log('✅ Villages chargés pour', arrondissement.name + ':', villages.length);
};

// Fonction d'initialisation manuelle
window.initGeoSelectors = function() {
  console.log('🌍 Initialisation manuelle des sélecteurs géographiques...');
  
  loadDepartements();
  
  const departementSelect = document.getElementById('departement');
  const communeSelect = document.getElementById('commune');
  const arrondissementSelect = document.getElementById('arrondissement');
  
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
  
  console.log('✅ Sélecteurs géographiques initialisés manuellement');
};

// Initialisation automatique
document.addEventListener('DOMContentLoaded', function() {
  console.log('🌍 DOMContentLoaded - Vérification des sélecteurs...');
  
  const departementSelect = document.getElementById('departement');
  if (departementSelect && departementSelect.offsetParent !== null) {
    console.log('🌍 Sélecteurs visibles détectés, initialisation automatique...');
    initGeoSelectors();
  } else {
    console.log('🌍 Sélecteurs non visibles, initialisation manuelle requise');
  }
});
`;

  // Mettre à jour dashboard.html
  let dashboardHtml = fs.readFileSync('./web/dashboard.html', 'utf8');
  
  // Remplacer le script geo-data.js par le script complet
  const dashboardScriptTag = '<script src="/geo-data.js?v=4"></script>';
  const dashboardEmbeddedScript = `<script>${completeScript}</script>`;
  
  dashboardHtml = dashboardHtml.replace(dashboardScriptTag, dashboardEmbeddedScript);
  fs.writeFileSync('./web/dashboard.html', dashboardHtml);
  console.log('✅ dashboard.html mis à jour avec données complètes');
  
  // Mettre à jour admin-agents.html avec données complètes
  let adminAgentsHtml = fs.readFileSync('./web/admin-agents.html', 'utf8');
  
  // Remplacer le script simple par le script complet
  const adminSimpleScript = adminAgentsHtml.match(/<script>\/\/ Données géographiques du Bénin \(intégrées\)[\s\S]*?<\/script>/);
  if (adminSimpleScript) {
    adminAgentsHtml = adminAgentsHtml.replace(adminSimpleScript[0], `<script>${completeScript}</script>`);
    fs.writeFileSync('./web/admin-agents.html', adminAgentsHtml);
    console.log('✅ admin-agents.html mis à jour avec données complètes');
  }
  
  console.log('✅ Tous les fichiers HTML mis à jour avec les données complètes');
  console.log('📊 Statistiques finales:');
  console.log(`   - ${geoData.departements.length} départements`);
  
  let totalCommunes = 0;
  Object.values(geoData.communes).forEach(communes => totalCommunes += communes.length);
  console.log(`   - ${totalCommunes} communes`);
  
  let totalArrondissements = 0;
  Object.values(geoData.arrondissements).forEach(arrondissements => totalArrondissements += arrondissements.length);
  console.log(`   - ${totalArrondissements} arrondissements`);
  
  let totalVillages = 0;
  Object.values(geoData.villages).forEach(villages => totalVillages += villages.length);
  console.log(`   - ${totalVillages} villages`);
  
} catch (error) {
  console.error('❌ Erreur lors de la correction:', error.message);
}
