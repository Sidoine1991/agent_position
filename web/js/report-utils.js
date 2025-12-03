// Fonction utilitaire pour formater les données de présence
export function formatPresenceData(presenceData = {}) {
  if (!presenceData || Object.keys(presenceData).length === 0) {
    return {
      presenceRate: "0.0%",
      workedDays: "0 / 0",
      permissionDays: 0,
      totalCheckins: 0,
      averageCheckinsPerDay: "0.0",
      absenceDays: 0
    };
  }

  const workedDays = Number(presenceData.workedDays || 0);
  const workingDays = Number(presenceData.workingDays || presenceData.totalDays || 0);
  const presenceRate = workingDays > 0 ? (workedDays / workingDays * 100).toFixed(1) : 0;
  const absenceDays = Math.max(0, workingDays - workedDays - (presenceData.permissionDays || 0));
  
  return {
    presenceRate: `${presenceRate}%`,
    workedDays: `${workedDays} / ${workingDays}`,
    permissionDays: presenceData.permissionDays || 0,
    totalCheckins: presenceData.totalCheckins || 0,
    averageCheckinsPerDay: presenceData.averageCheckinsPerDay?.toFixed(1) || "0.0",
    absenceDays: absenceDays
  };
}

// Fonction pour formater les données d'activités
export function formatActivitiesData(activities = []) {
  if (!Array.isArray(activities)) return [];
  
  return activities.map(activity => ({
    ...activity,
    date: formatDate(activity.date),
    status: getActivityStatus(activity.status)
  }));
}

// Fonction utilitaire pour formater une date
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR');
}

// Fonction utilitaire pour normaliser le statut d'une activité
function getActivityStatus(status) {
  if (!status) return 'Non défini';
  
  const statusMap = {
    'planned': 'Planifié',
    'completed': 'Réalisé',
    'in_progress': 'En cours',
    'not_completed': 'Non réalisé',
    'cancelled': 'Annulé'
  };
  
  return statusMap[status.toLowerCase()] || status;
}
