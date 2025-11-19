/**
 * Utilitaires pour gérer les champs de compatibilité géographique
 * dans les checkins (commune, arrondissement, village)
 */

/**
 * Extrait les champs géographiques de device_info
 * @param {Object} deviceInfo - Champ device_info du checkin
 * @returns {Object} - { commune, arrondissement, village }
 */
function extractGeoFields(deviceInfo) {
  if (!deviceInfo || typeof deviceInfo !== 'object') {
    return {
      commune: null,
      arrondissement: null,
      village: null
    };
  }
  
  return {
    commune: deviceInfo.commune || null,
    arrondissement: deviceInfo.arrondissement || null,
    village: deviceInfo.village || null
  };
}

/**
 * Construit la localisation complète pour les rapports
 * @param {Object} checkin - Données du checkin
 * @param {Object} user - Données utilisateur (fallback)
 * @returns {String} - Localisation formatée
 */
function buildLocation(checkin, user) {
  const geoFields = extractGeoFields(checkin.device_info);
  
  const locationParts = [];
  
  // Priorité: checkin.device_info > user
  if (geoFields.commune) locationParts.push(geoFields.commune);
  else if (user?.commune) locationParts.push(user.commune);
  
  if (geoFields.arrondissement) locationParts.push(`Arr. ${geoFields.arrondissement}`);
  else if (user?.arrondissement) locationParts.push(`Arr. ${user.arrondissement}`);
  
  if (geoFields.village) locationParts.push(`Village ${geoFields.village}`);
  else if (user?.village) locationParts.push(`Village ${user.village}`);
  
  if (user?.departement) locationParts.push(user.departement);
  
  return locationParts.length > 0 ? locationParts.join(', ') : 'Non spécifiée';
}

/**
 * Vérifie si un checkin correspond aux filtres géographiques
 * @param {Object} checkin - Données du checkin
 * @param {Object} user - Données utilisateur
 * @param {Object} filters - Filtres { departement, commune, arrondissement, village }
 * @returns {Boolean} - True si le checkin correspond aux filtres
 */
function matchesGeoFilters(checkin, user, filters) {
  const geoFields = extractGeoFields(checkin.device_info);
  
  // Helper pour normaliser les chaînes
  const normalize = (str) => (str || '').toString().toLowerCase().trim();
  
  // Vérifier département
  if (filters.departement && filters.departement !== 'all') {
    const userDept = normalize(user?.departement);
    const filterDept = normalize(filters.departement);
    if (userDept !== filterDept) return false;
  }
  
  // Vérifier commune
  if (filters.commune && filters.commune !== 'all') {
    const checkinCommune = normalize(geoFields.commune);
    const userCommune = normalize(user?.commune);
    const filterCommune = normalize(filters.commune);
    
    if (checkinCommune !== filterCommune && userCommune !== filterCommune) {
      return false;
    }
  }
  
  // Vérifier arrondissement
  if (filters.arrondissement && filters.arrondissement !== 'all') {
    const checkinArr = normalize(geoFields.arrondissement);
    const userArr = normalize(user?.arrondissement);
    const filterArr = normalize(filters.arrondissement);
    
    if (checkinArr !== filterArr && userArr !== filterArr) {
      return false;
    }
  }
  
  // Vérifier village
  if (filters.village && filters.village !== 'all') {
    const checkinVillage = normalize(geoFields.village);
    const userVillage = normalize(user?.village);
    const filterVillage = normalize(filters.village);
    
    if (checkinVillage !== filterVillage && userVillage !== filterVillage) {
      return false;
    }
  }
  
  return true;
}

module.exports = {
  extractGeoFields,
  buildLocation,
  matchesGeoFilters
};
