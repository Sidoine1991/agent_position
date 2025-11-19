// Fonction pour normaliser les dates au format YYYY-MM-DD
function normalizeDate(dateString) {
  if (!dateString) return dateString;
  
  // Si la date est déjà au format YYYY-MM-DD, la retourner telle quelle
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  // Si la date est au format ISO complet, extraire YYYY-MM-DD
  if (dateString.includes('T')) {
    return dateString.split('T')[0];
  }
  
  // Sinon, essayer de parser et formater
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch (e) {
    return dateString; // En cas d'erreur, retourner l'original
  }
}

// Tests
console.log('🔍 Tests de normalisation des dates:');
console.log('YYYY-MM-DD:', normalizeDate('2025-11-18'));
console.log('ISO complet:', normalizeDate('2025-11-18T00:00:00.000Z'));
console.log('ISO avec offset:', normalizeDate('2025-11-18T05:59:23.643+00:00'));
console.log('Format invalide:', normalizeDate('date-invalide'));
