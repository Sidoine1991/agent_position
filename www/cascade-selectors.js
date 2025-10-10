/**
 * Sélecteurs en cascade pour les données géographiques du Bénin
 * Utilise les données locales (geo-data.js) avec fallback vers l'API Supabase
 * Version optimisée pour la cascade hiérarchique
 */

// Configuration de l'API
const API_BASE_URL = window.location.origin;

// Fonction pour charger les départements
async function loadDepartements() {
  try {
    const select = document.getElementById('departement');
    if (!select) return;
    
    select.innerHTML = '<option value="">Sélectionnez un département</option>';
    
    // Priorité 1: Données locales (geo-data.js)
    if (window.geoData && window.geoData.departements) {
      window.geoData.departements.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.id;
        option.textContent = dept.name;
        select.appendChild(option);
      });
      console.log('✅ Départements chargés depuis les données locales:', window.geoData.departements.length);
      return;
    }
    
    // Fallback: API Supabase
    const response = await fetch(`${API_BASE_URL}/api/departements`);
    const departements = await response.json();
    
    departements.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = dept.nom || dept.name;
      select.appendChild(option);
    });
    
    console.log('✅ Départements chargés depuis l\'API:', departements.length);
  } catch (error) {
    console.error('❌ Erreur lors du chargement des départements:', error);
  }
}

// Fonction pour charger les communes d'un département
async function loadCommunes(departementId) {
  try {
    const communeSelect = document.getElementById('commune');
    const arrondissementSelect = document.getElementById('arrondissement');
    const villageSelect = document.getElementById('village');
    
    if (!communeSelect) return;
    
    // Réinitialiser les sélecteurs suivants
    communeSelect.innerHTML = '<option value="">Sélectionnez une commune</option>';
    communeSelect.disabled = true;
    
    if (arrondissementSelect) {
      arrondissementSelect.innerHTML = '<option value="">Sélectionnez un arrondissement</option>';
      arrondissementSelect.disabled = true;
    }
    
    if (villageSelect) {
      villageSelect.innerHTML = '<option value="">Sélectionnez un village</option>';
      villageSelect.disabled = true;
    }
    
    if (!departementId) return;
    
    // Priorité 1: Données locales (geo-data.js)
    if (window.geoData && window.geoData.communes && window.geoData.communes[departementId]) {
      const communes = window.geoData.communes[departementId];
      communes.forEach(commune => {
        const option = document.createElement('option');
        option.value = commune.id;
        option.textContent = commune.name;
        communeSelect.appendChild(option);
      });
      communeSelect.disabled = false;
      console.log('✅ Communes chargées depuis les données locales:', communes.length);
      return;
    }
    
    // Fallback: API Supabase
    const response = await fetch(`${API_BASE_URL}/api/communes?departement_id=${departementId}`);
    const communes = await response.json();
    
    communes.forEach(commune => {
      const option = document.createElement('option');
      option.value = commune.id;
      option.textContent = commune.nom || commune.name;
      communeSelect.appendChild(option);
    });
    
    communeSelect.disabled = false;
    console.log('✅ Communes chargées depuis l\'API:', communes.length);
  } catch (error) {
    console.error('❌ Erreur lors du chargement des communes:', error);
  }
}

// Fonction pour charger les arrondissements d'une commune
async function loadArrondissements(communeId) {
  try {
    const arrondissementSelect = document.getElementById('arrondissement');
    const villageSelect = document.getElementById('village');
    
    if (!arrondissementSelect) return;
    
    // Réinitialiser le sélecteur suivant
    arrondissementSelect.innerHTML = '<option value="">Sélectionnez un arrondissement</option>';
    arrondissementSelect.disabled = true;
    
    if (villageSelect) {
      villageSelect.innerHTML = '<option value="">Sélectionnez un village</option>';
      villageSelect.disabled = true;
    }
    
    if (!communeId) return;
    
    // Priorité 1: Données locales (geo-data.js)
    if (window.geoData && window.geoData.arrondissements && window.geoData.arrondissements[communeId]) {
      const arrondissements = window.geoData.arrondissements[communeId];
      arrondissements.forEach(arrondissement => {
        const option = document.createElement('option');
        option.value = arrondissement.id;
        option.textContent = arrondissement.name;
        arrondissementSelect.appendChild(option);
      });
      arrondissementSelect.disabled = false;
      console.log('✅ Arrondissements chargés depuis les données locales:', arrondissements.length);
      return;
    }
    
    // Fallback: API Supabase
    const response = await fetch(`${API_BASE_URL}/api/arrondissements?commune_id=${communeId}`);
    const arrondissements = await response.json();
    
    arrondissements.forEach(arrondissement => {
      const option = document.createElement('option');
      option.value = arrondissement.id;
      option.textContent = arrondissement.nom || arrondissement.name;
      arrondissementSelect.appendChild(option);
    });
    
    arrondissementSelect.disabled = false;
    console.log('✅ Arrondissements chargés depuis l\'API:', arrondissements.length);
  } catch (error) {
    console.error('❌ Erreur lors du chargement des arrondissements:', error);
  }
}

// Fonction pour charger les villages d'un arrondissement
async function loadVillages(arrondissementId) {
  try {
    const villageSelect = document.getElementById('village');
    
    if (!villageSelect) return;
    
    villageSelect.innerHTML = '<option value="">Sélectionnez un village</option>';
    villageSelect.disabled = true;
    
    if (!arrondissementId) return;
    
    // Priorité 1: Données locales (geo-data.js)
    if (window.geoData && window.geoData.villages && window.geoData.villages[arrondissementId]) {
      const villages = window.geoData.villages[arrondissementId];
      villages.forEach(village => {
        const option = document.createElement('option');
        option.value = village.id;
        option.textContent = village.name;
        villageSelect.appendChild(option);
      });
      villageSelect.disabled = false;
      console.log('✅ Villages chargés depuis les données locales:', villages.length);
      return;
    }
    
    // Fallback: API Supabase
    const response = await fetch(`${API_BASE_URL}/api/villages?arrondissement_id=${arrondissementId}`);
    const villages = await response.json();
    
    villages.forEach(village => {
      const option = document.createElement('option');
      option.value = village.id;
      option.textContent = village.nom || village.name;
      villageSelect.appendChild(option);
    });
    
    villageSelect.disabled = false;
    console.log('✅ Villages chargés depuis l\'API:', villages.length);
  } catch (error) {
    console.error('❌ Erreur lors du chargement des villages:', error);
  }
}

// Fonction pour réinitialiser tous les sélecteurs
function resetAllSelectors() {
  const departementSelect = document.getElementById('departement');
  const communeSelect = document.getElementById('commune');
  const arrondissementSelect = document.getElementById('arrondissement');
  const villageSelect = document.getElementById('village');
  
  if (departementSelect) {
    departementSelect.value = '';
  }
  
  if (communeSelect) {
    communeSelect.innerHTML = '<option value="">Sélectionnez une commune</option>';
    communeSelect.disabled = true;
  }
  
  if (arrondissementSelect) {
    arrondissementSelect.innerHTML = '<option value="">Sélectionnez un arrondissement</option>';
    arrondissementSelect.disabled = true;
  }
  
  if (villageSelect) {
    villageSelect.innerHTML = '<option value="">Sélectionnez un village</option>';
    villageSelect.disabled = true;
  }
}

// Fonction d'initialisation des sélecteurs en cascade
function initCascadeSelectors() {
  console.log('🌍 Initialisation des sélecteurs en cascade...');
  
  // Charger les départements
  loadDepartements();
  
  // Ajouter les événements
  const departementSelect = document.getElementById('departement');
  const communeSelect = document.getElementById('commune');
  const arrondissementSelect = document.getElementById('arrondissement');
  const villageSelect = document.getElementById('village');
  
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
  
  console.log('✅ Sélecteurs en cascade initialisés');
}

// Fonction pour obtenir les valeurs sélectionnées
function getSelectedGeoValues() {
  return {
    departement: document.getElementById('departement')?.value || '',
    commune: document.getElementById('commune')?.value || '',
    arrondissement: document.getElementById('arrondissement')?.value || '',
    village: document.getElementById('village')?.value || ''
  };
}

// Fonction pour valider qu'au moins un niveau est sélectionné
function validateGeoSelection() {
  const values = getSelectedGeoValues();
  return values.departement || values.commune || values.arrondissement || values.village;
}

// Exposer les fonctions globalement
window.loadDepartements = loadDepartements;
window.loadCommunes = loadCommunes;
window.loadArrondissements = loadArrondissements;
window.loadVillages = loadVillages;
window.resetAllSelectors = resetAllSelectors;
window.initCascadeSelectors = initCascadeSelectors;
window.getSelectedGeoValues = getSelectedGeoValues;
window.validateGeoSelection = validateGeoSelection;

// Auto-initialisation si le DOM est déjà chargé
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCascadeSelectors);
} else {
  initCascadeSelectors();
}
