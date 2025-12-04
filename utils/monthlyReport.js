const MONTHS_FR = [
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre'
];

const RESULT_LABELS = {
  realise: 'Réalisé',
  realisee: 'Réalisé',
  'realise partiellement': 'Partiellement réalisé',
  partiellement_realise: 'Partiellement réalisé',
  en_cours: 'En cours',
  non_realise: 'Non réalisé',
  planifie: 'Planifié',
  planned: 'Planifié'
};

const ACTIVITY_STATUS_GROUPS = {
  realized: new Set(['realise', 'realisee', 'completed', 'complete', 'terminee', 'termine', 'fait', 'done']),
  notRealized: new Set(['non_realise', 'non_realisee', 'annule', 'annulee', 'cancelled', 'pas_fait', 'nonrealise']),
  inProgress: new Set(['en_cours', 'encours', 'in_progress', 'pending']),
  partiallyRealized: new Set(['partiellement_realise', 'partiellement_realisee', 'partially_completed', 'partially']),
  planned: new Set(['planifie', 'planifiee', 'planified', 'planifiees', 'planifie_en_cours'])
};

const GEMINI_MODEL = (typeof process !== 'undefined' && process.env && process.env.GEMINI_MODEL)
  ? process.env.GEMINI_MODEL
  : 'gemini-1.5-flash';
const MAX_ACTIVITIES_PREVIEW = 200;
const MAX_LOCATIONS = 6;
const MAX_PHOTOS = 20;

function normalizeStatusValue(value) {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function detectActivityStatus(rawValue) {
  const normalized = normalizeStatusValue(rawValue);
  if (!normalized) return 'unknown';
  if (ACTIVITY_STATUS_GROUPS.realized.has(normalized)) return 'realized';
  if (ACTIVITY_STATUS_GROUPS.notRealized.has(normalized)) return 'notRealized';
  if (ACTIVITY_STATUS_GROUPS.inProgress.has(normalized)) return 'inProgress';
  if (ACTIVITY_STATUS_GROUPS.partiallyRealized.has(normalized)) return 'partiallyRealized';
  if (ACTIVITY_STATUS_GROUPS.planned.has(normalized)) return 'planned';
  return 'unknown';
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function pickNumber(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return num;
    }
  }
  return null;
}

function buildMonthContext(monthValue) {
  const now = new Date();
  let year = now.getUTCFullYear();
  let monthIndex = now.getUTCMonth();

  if (typeof monthValue === 'string' && /^\d{4}-\d{2}$/.test(monthValue)) {
    const [y, m] = monthValue.split('-').map(Number);
    if (y >= 2000 && m >= 1 && m <= 12) {
      year = y;
      monthIndex = m - 1;
    }
  }

  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  return {
    value: `${year}-${pad2(monthIndex + 1)}`,
    label: `${MONTHS_FR[monthIndex] || 'Mois'} ${year}`,
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function countWorkingDays(startDate, endDate) {
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  let total = 0;

  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) {
      total += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return total;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function summarizeWeeklyDistribution(checkins = []) {
  const map = new Map();
  checkins.forEach(checkin => {
    const rawDate = checkin?.created_at || checkin?.start_time;
    if (!rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const weekStart = startOfWeek(date);
    const key = weekStart.toISOString().split('T')[0];
    const existing = map.get(key) || { startDate: key, endDate: key, checkins: 0 };
    existing.checkins += 1;
    existing.endDate = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    map.set(key, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((week, index) => ({
      weekLabel: `Semaine ${index + 1}`,
      startDate: week.startDate,
      endDate: week.endDate,
      checkins: week.checkins
    }));
}

function sanitizeAgent(agent) {
  if (!agent) return null;
  const fallbackName = [agent.first_name, agent.last_name].filter(Boolean).join(' ').trim();
  return {
    id: agent.id,
    name: agent.name || fallbackName || agent.email || `Agent ${agent.id}`,
    email: agent.email || null,
    role: agent.role || 'agent',
    phone: agent.phone || agent.telephone || null,
    departement: agent.departement || null,
    commune: agent.commune || null,
    arrondissement: agent.arrondissement || null,
    village: agent.village || null,
    project_name: agent.project_name || null
  };
}

function mapObjectives(goals = []) {
  return goals.map(goal => {
    const target = toNumber(goal.target_value ?? goal.target ?? goal.objective_target);
    const current = toNumber(goal.progress_value ?? goal.current_value ?? goal.current ?? goal.completed_value);
    let progressPercent = 0;
    if (target > 0) {
      progressPercent = Math.min(100, Math.round((current / target) * 100));
    } else if (String(goal.status || '').toLowerCase() === 'completed') {
      progressPercent = 100;
    }

    return {
      id: goal.id,
      title: goal.title || 'Objectif',
      description: goal.description || '',
      status: goal.status || 'active',
      category: goal.category || goal.type || 'general',
      targetValue: target,
      currentValue: current,
      progressPercent,
      deadline: goal.target_date || goal.deadline || null
    };
  });
}

function summarizePresence(checkins, monthContext, missions = []) {
  const totalCheckins = checkins.length;
  const workedDaysSet = new Set();
  let earliest = null;
  let latest = null;

  // Analyser les checkins pour les jours de présence
  checkins.forEach(checkin => {
    const rawDate = checkin?.created_at || checkin?.start_time;
    if (!rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const dayKey = date.toISOString().split('T')[0];
    workedDaysSet.add(dayKey);
    if (!earliest || date < earliest) earliest = date;
    if (!latest || date > latest) latest = date;
  });

  // Calculer le temps terrain à partir des MISSIONS (date_start -> date_end)
  let totalFieldTimeMinutes = 0;
  let missionsCount = 0;
  let completedMissionsCount = 0;
  const missionDaysSet = new Set();

  // Nouveau : Grouper les missions par jour pour le détail quotidien
  const missionsByDay = new Map();

  (missions || []).forEach(mission => {
    // Utiliser date_start et date_end pour le temps terrain (les champs start_time/end_time sont souvent null)
    const startTime = mission.date_start ? new Date(mission.date_start) : null;
    const endTime = mission.date_end ? new Date(mission.date_end) : null;

    if (startTime && !Number.isNaN(startTime.getTime())) {
      const dayKey = startTime.toISOString().split('T')[0];
      missionDaysSet.add(dayKey);
      workedDaysSet.add(dayKey); // Ajouter aussi aux jours travaillés

      // Initialiser le jour dans le Map si nécessaire
      if (!missionsByDay.has(dayKey)) {
        missionsByDay.set(dayKey, {
          date: dayKey,
          missions: [],
          totalHours: 0
        });
      }
    }

    missionsCount++;
    if (mission.status === 'completed') {
      completedMissionsCount++;
    }

    // Calculer le temps terrain pour cette mission (date_start -> date_end)
    let missionHours = 0;
    if (startTime && endTime && endTime > startTime) {
      const diffMinutes = (endTime - startTime) / (1000 * 60);
      // Limiter à 14h max par mission
      const cappedMinutes = Math.min(diffMinutes, 14 * 60);
      totalFieldTimeMinutes += cappedMinutes;
      missionHours = cappedMinutes / 60;
    } else if (mission.duration_minutes && Number.isFinite(Number(mission.duration_minutes))) {
      // Utiliser duration_minutes si disponible
      const cappedMinutes = Math.min(Number(mission.duration_minutes), 14 * 60);
      totalFieldTimeMinutes += cappedMinutes;
      missionHours = cappedMinutes / 60;
    }

    // Ajouter la mission au jour correspondant
    if (startTime && !Number.isNaN(startTime.getTime())) {
      const dayKey = startTime.toISOString().split('T')[0];
      const dayData = missionsByDay.get(dayKey);
      if (dayData) {
        dayData.missions.push({
          id: mission.id,
          startTime: startTime.toISOString(),
          endTime: endTime ? endTime.toISOString() : null,
          hours: missionHours,
          status: mission.status || 'active',
          commune: mission.commune || null,
          village: mission.village || null,
          arrondissement: mission.arrondissement || null,
          departement: mission.departement || null,
          note: mission.note || null
        });
        dayData.totalHours += missionHours;
      }
    }
  });

  // Si pas de temps terrain calculé depuis les missions, calculer depuis les checkins
  // (temps entre premier et dernier checkin de chaque jour)
  if (totalFieldTimeMinutes === 0 && checkins && checkins.length > 0) {
    const checkinsByDay = new Map();

    checkins.forEach(checkin => {
      const rawDate = checkin?.created_at || checkin?.start_time;
      if (rawDate) {
        const date = new Date(rawDate);
        if (!Number.isNaN(date.getTime())) {
          const dayKey = date.toISOString().split('T')[0];
          if (!checkinsByDay.has(dayKey)) {
            checkinsByDay.set(dayKey, []);
          }
          checkinsByDay.get(dayKey).push(date.getTime());
        }
      }
    });

    // Pour chaque jour, calculer le temps entre premier et dernier checkin
    checkinsByDay.forEach((timestamps) => {
      if (timestamps.length >= 2) {
        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);
        const diffMinutes = (maxTime - minTime) / (1000 * 60);
        // Limiter à 14h max par jour
        totalFieldTimeMinutes += Math.min(diffMinutes, 14 * 60);
      }
    });
  }

  const fieldTimeHours = Math.round((totalFieldTimeMinutes / 60) * 10) / 10;

  // Calculer le temps moyen par jour de présence
  const daysWithPresence = workedDaysSet.size || 1;
  const avgFieldTimePerDay = Math.round((fieldTimeHours / daysWithPresence) * 10) / 10;

  const totalWorkingDays = countWorkingDays(monthContext.start, monthContext.end);
  const workedDays = workedDaysSet.size;
  const presenceRate = totalWorkingDays > 0
    ? Math.round((workedDays / totalWorkingDays) * 1000) / 10
    : 0;
  const avgCheckinsPerDay = workedDays > 0
    ? Math.round((totalCheckins / workedDays) * 10) / 10
    : totalCheckins;

  // Convertir missionsByDay en tableau trié par date avec noms de jour en français
  const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const dailyMissions = Array.from(missionsByDay.values())
    .map(day => {
      const date = new Date(day.date + 'T00:00:00Z');
      const dayOfWeek = DAYS_FR[date.getUTCDay()];
      return {
        ...day,
        dayOfWeek
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalCheckins,
    workedDays,
    workingDays: totalWorkingDays,
    presenceRate,
    averageCheckinsPerDay: avgCheckinsPerDay,
    fieldTimeHours,
    avgFieldTimePerDay,
    missionsCount,
    completedMissionsCount,
    daysWithMissions: missionDaysSet.size,
    daysWithPresence,
    firstEntry: earliest ? earliest.toISOString() : null,
    lastEntry: latest ? latest.toISOString() : null,
    weeklyDistribution: summarizeWeeklyDistribution(checkins),
    zones: summarizeZones(missions, checkins),
    dailyMissions  // Ajouter le détail quotidien des missions
  };
}

function summarizeZones(missions = [], checkins = []) {
  const communes = new Map();
  const villages = new Map();
  const locations = new Set();

  // Analyser les missions
  missions.forEach(mission => {
    if (mission.commune) {
      const name = String(mission.commune).trim();
      communes.set(name, (communes.get(name) || 0) + 1);
    }
    if (mission.village) {
      const name = String(mission.village).trim();
      villages.set(name, (villages.get(name) || 0) + 1);
    }
  });

  // Analyser les checkins pour les localisations
  checkins.forEach(checkin => {
    const locName = checkin.location_name || checkin.checkin_location_name || checkin.location;
    if (locName) {
      locations.add(String(locName).trim());
    }
    if (checkin.commune) {
      const name = String(checkin.commune).trim();
      communes.set(name, (communes.get(name) || 0) + 1);
    }
  });

  // Trier par fréquence
  const topCommunes = Array.from(communes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topVillages = Array.from(villages.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    communesCount: communes.size,
    villagesCount: villages.size,
    locationsCount: locations.size,
    topCommunes,
    topVillages,
    locationsList: Array.from(locations).slice(0, 15)
  };
}

function summarizeActivities(planifications = [], checkins = []) {
  const list = (planifications || []).map(plan => {
    return {
      id: plan.id,
      date: plan.date,
      description: plan.description_activite || plan.activity_name || plan.description || 'Activité non spécifiée',
      result: plan.resultat_journee || plan.status || 'planifie',
      observations: plan.observations || plan.result_details || '',
      project: plan.project_name || plan.project || null,
      planned_hours: plan.planned_hours || plan.estimated_hours || null,
      planned_start_time: plan.planned_start_time || null,
      planned_end_time: plan.planned_end_time || null
    };
  });

  // Calculer les jours planifiés (jours distincts avec des planifications)
  const plannedDaysSet = new Set();
  list.forEach(item => {
    if (item.date) {
      const dateStr = String(item.date).split('T')[0];
      if (dateStr) plannedDaysSet.add(dateStr);
    }
  });
  const plannedDays = plannedDaysSet.size;

  // Calculer les jours planifiés où l'agent était présent (basé sur les checkins)
  const presentDaysSet = new Set();
  (checkins || []).forEach(checkin => {
    const rawDate = checkin?.created_at || checkin?.start_time;
    if (!rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    presentDaysSet.add(date.toISOString().split('T')[0]);
  });

  // Calculer les heures planifiées totales et validées (seulement pour les jours présents)
  let totalPlannedHours = 0;
  let validatedPlannedHours = 0;

  list.forEach(item => {
    let hours = 0;
    if (item.planned_hours && Number.isFinite(Number(item.planned_hours))) {
      hours = Number(item.planned_hours);
    } else if (item.planned_start_time && item.planned_end_time && item.date) {
      try {
        const dateStr = String(item.date).split('T')[0];
        const start = new Date(`${dateStr}T${item.planned_start_time}`);
        const end = new Date(`${dateStr}T${item.planned_end_time}`);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          hours = Math.max(0, (end - start) / (1000 * 60 * 60));
        }
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
    }

    if (hours > 0) {
      totalPlannedHours += hours;

      // Valider seulement si l'agent était présent ce jour-là
      const dateStr = String(item.date).split('T')[0];
      if (dateStr && presentDaysSet.has(dateStr)) {
        validatedPlannedHours += hours;
      }
    }
  });

  const statusCounters = {
    total: list.length,
    realized: 0,
    notRealized: 0,
    inProgress: 0,
    partiallyRealized: 0,
    planned: 0,
    unknown: 0
  };

  list.forEach(item => {
    const detected = detectActivityStatus(item.result);
    if (statusCounters[detected] !== undefined) {
      statusCounters[detected] += 1;
    } else {
      statusCounters.unknown += 1;
    }
  });

  const autoRemaining = Math.max(statusCounters.total - (
    statusCounters.realized +
    statusCounters.partiallyRealized +
    statusCounters.inProgress +
    statusCounters.notRealized +
    statusCounters.planned +
    statusCounters.unknown
  ), 0);

  if (statusCounters.notRealized === 0 && autoRemaining > 0) {
    statusCounters.notRealized = autoRemaining;
  }

  const breakdownMap = new Map();
  list.forEach(item => {
    const key = String(item.result || 'planifie').toLowerCase();
    breakdownMap.set(key, (breakdownMap.get(key) || 0) + 1);
  });

  const breakdown = Array.from(breakdownMap.entries())
    .map(([key, count]) => ({
      key,
      label: RESULT_LABELS[key] || key.replace(/_/g, ' '),
      count,
      percentage: list.length ? Math.round((count / list.length) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.count - a.count);

  const executionRate = statusCounters.total > 0
    ? Math.round((statusCounters.realized / statusCounters.total) * 1000) / 10
    : 0;

  return {
    total: list.length,
    breakdown,
    list: list.slice(0, MAX_ACTIVITIES_PREVIEW),
    hasMore: list.length > MAX_ACTIVITIES_PREVIEW,
    plannedDays,
    totalPlannedHours: Math.round(totalPlannedHours * 10) / 10,
    validatedPlannedHours: Math.round(validatedPlannedHours * 10) / 10,
    performance: {
      executionRate,
      totalPlanned: statusCounters.total,
      realized: statusCounters.realized,
      notRealized: statusCounters.notRealized,
      inProgress: statusCounters.inProgress,
      partiallyRealized: statusCounters.partiallyRealized,
      plannedOnly: statusCounters.planned,
      withoutStatus: statusCounters.unknown
    }
  };
}

function getLocationDescriptor(checkin) {
  if (!checkin) return null;

  // Extraire les coordonnées depuis différentes sources
  const lat = pickNumber(
    checkin.lat,
    checkin.latitude,
    checkin.location_lat,
    checkin.checkin_lat
  );
  const lon = pickNumber(
    checkin.lon,
    checkin.longitude,
    checkin.location_lng,
    checkin.checkin_lng
  );

  // Extraire le nom de la localisation depuis différentes sources
  const label = (
    checkin.location_name ||
    checkin.checkin_location_name ||
    checkin.address ||
    checkin.commune ||
    checkin.village ||
    checkin.note ||
    ''
  ).trim();

  if (label) {
    return {
      id: label.toLowerCase(),
      label,
      lat,
      lon,
      commune: checkin.commune || null,
      village: checkin.village || null,
      address: checkin.address || null
    };
  }

  if (lat !== null && lon !== null) {
    const roundedLat = lat.toFixed(3);
    const roundedLon = lon.toFixed(3);
    return {
      id: `${roundedLat}_${roundedLon}`,
      label: `Coordonnées ${roundedLat}, ${roundedLon}`,
      lat,
      lon,
      commune: checkin.commune || null,
      village: checkin.village || null,
      address: null
    };
  }

  return null;
}

function summarizeLocations(checkins = []) {
  const map = new Map();
  let locationsFound = 0;
  let locationsSkipped = 0;

  checkins.forEach(checkin => {
    const descriptor = getLocationDescriptor(checkin);
    if (!descriptor) {
      locationsSkipped++;
      return;
    }

    if (!map.has(descriptor.id)) {
      map.set(descriptor.id, {
        ...descriptor,
        visits: 0,
        name: descriptor.label
      });
    }
    map.get(descriptor.id).visits += 1;
    locationsFound++;
  });

  console.log(`📍 Localisations résumées: ${map.size} uniques trouvées, ${locationsSkipped} ignorées (${checkins.length} check-ins analysés)`);

  const sortedLocations = Array.from(map.values())
    .sort((a, b) => b.visits - a.visits)
    .slice(0, MAX_LOCATIONS);

  console.log(`📍 Localisations retournées: ${sortedLocations.length} (limite: ${MAX_LOCATIONS})`);

  return sortedLocations;
}

function summarizePhotos(checkins = []) {
  // Filtrer et dédupliquer les photos depuis checkins et presence_validations
  const uniquePhotos = new Map();
  let photosFound = 0;
  let photosSkipped = 0;

  checkins.forEach(checkin => {
    if (!checkin) {
      photosSkipped++;
      return;
    }

    // Essayer différents champs pour l'URL de la photo
    const photoUrl = checkin.photo_url ||
      checkin.photo_path ||
      checkin.photoUrl ||
      checkin.file_url ||
      checkin.imageUrl;

    if (!photoUrl) {
      photosSkipped++;
      return;
    }

    if (uniquePhotos.has(photoUrl)) {
      photosSkipped++;
      return;
    }

    // Extraire la date depuis différentes sources
    const rawDate = checkin.created_at ||
      checkin.start_time ||
      checkin.checkin_timestamp ||  // Ajout pour presence_validations
      checkin.taken_at ||
      null;
    const parsedDate = rawDate ? new Date(rawDate) : null;

    // Extraire la localisation depuis différentes sources
    const locationLabel =
      checkin.location_name ||
      checkin.checkin_location_name ||
      checkin.address ||
      [checkin.commune, checkin.village].filter(Boolean).join(', ') ||
      null;

    // Extraire les coordonnées GPS
    const lat = pickNumber(
      checkin.lat,
      checkin.latitude,
      checkin.location_lat,
      checkin.checkin_lat
    );
    const lon = pickNumber(
      checkin.lon,
      checkin.longitude,
      checkin.location_lng,
      checkin.checkin_lng
    );

    uniquePhotos.set(photoUrl, {
      url: photoUrl,
      path: photoUrl,
      photoUrl: photoUrl,
      date: parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString() : rawDate,
      taken_at: parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString() : rawDate,
      note: checkin.note || checkin.notes || checkin.description || '',
      caption: checkin.note || checkin.notes || checkin.description || 'Photo de terrain',
      location: locationLabel,
      address: checkin.address || null,
      commune: checkin.commune || null,
      village: checkin.village || null,
      lat,
      lon,
      missionId: checkin.mission_id || checkin.missionId || null
    });
    photosFound++;
  });

  console.log(`📸 Photos résumées: ${photosFound} trouvées, ${photosSkipped} ignorées (${checkins.length} check-ins analysés)`);

  // Convertir en tableau et trier par date (plus récent d'abord)
  const sortedPhotos = Array.from(uniquePhotos.values())
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, MAX_PHOTOS);

  console.log(`📸 Photos retournées: ${sortedPhotos.length} (limite: ${MAX_PHOTOS})`);

  return sortedPhotos;
}

async function buildProjectRanking(supabaseClient, targetAgentId, monthContext) {
  try {
    // Récupérer le projet de l'agent cible
    const { data: agentData } = await supabaseClient
      .from('users')
      .select('project_name')
      .eq('id', targetAgentId)
      .single();

    const agentProject = agentData?.project_name;
    if (!agentProject) {
      return [];
    }

    // Normaliseur de nom de projet (similaire au frontend)
    const normalizeProjectName = (value) => {
      if (!value) return '';
      return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    };
    const targetProjectKey = normalizeProjectName(agentProject);

    // Récupérer les utilisateurs avec un project_name non nul puis filtrer côté JS
    // pour supporter les variantes (espaces, majuscules, accents)
    const { data: projectAgents, error: projectAgentsError } = await supabaseClient
      .from('users')
      .select('id, name, first_name, last_name, project_name, role')
      .not('project_name', 'is', null)
      .limit(1000);

    if (projectAgentsError) {
      console.error('Erreur récupération agents du projet:', projectAgentsError.message);
    }

    let rawProjectAgents = Array.isArray(projectAgents) ? projectAgents : [];

    // Filtrer en utilisant le project_name normalisé
    rawProjectAgents = rawProjectAgents.filter(user => {
      const key = normalizeProjectName(user.project_name);
      return key === targetProjectKey;
    });

    // 🔁 Étendre la liste avec les agents qui ont des planifications dans ce projet
    // même si leur champ users.project_name n'est pas correctement renseigné.
    try {
      const startDateOnly = monthContext.startIso.split('T')[0];
      const endDateOnly = monthContext.endIso.split('T')[0];

      const { data: planningAgents, error: planningError } = await supabaseClient
        .from('planifications')
        .select('agent_id, user_id, project_name')
        .not('project_name', 'is', null)
        .gte('date', startDateOnly)
        .lte('date', endDateOnly);

      if (planningError) {
        console.warn('Erreur récupération agents via planifications:', planningError.message);
      } else if (planningAgents && planningAgents.length > 0) {
        const existingIds = new Set(rawProjectAgents.map(a => a.id));
        const extraIds = new Set();

        planningAgents.forEach(row => {
          if (!row) return;
          // Vérifier aussi que le projet de la planification correspond (normalisé)
          const planProjectKey = normalizeProjectName(row.project_name);
          if (planProjectKey !== targetProjectKey) return;

          const candidateId = row.agent_id || row.user_id;
          if (candidateId && !existingIds.has(candidateId)) {
            extraIds.add(candidateId);
          }
        });

        if (extraIds.size > 0) {
          const extraIdList = Array.from(extraIds);
          const { data: extraUsers, error: extraUsersError } = await supabaseClient
            .from('users')
            .select('id, name, first_name, last_name, project_name, role')
            .in('id', extraIdList);

          if (extraUsersError) {
            console.warn('Erreur récupération utilisateurs supplémentaires pour le projet:', extraUsersError.message);
          } else if (extraUsers && extraUsers.length > 0) {
            // Forcer project_name sur le projet de référence si manquant
            extraUsers.forEach(user => {
              if (!user.project_name) {
                user.project_name = agentProject;
              }
            });
            rawProjectAgents = rawProjectAgents.concat(extraUsers);
          }
        }
      }
    } catch (extendError) {
      console.warn('Erreur lors de l\'extension de la liste des agents du projet:', extendError.message || extendError);
    }

    // NE PAS FILTRER par rôle - inclure TOUS les utilisateurs du projet
    // Cela permet d'afficher tous les 24 agents de PARSAD
    const agentsToProcess = rawProjectAgents;

    console.log(`📊 Agents trouvés pour le projet "${agentProject}": ${rawProjectAgents.length} total (tous inclus dans le classement)`);

    if (!agentsToProcess || agentsToProcess.length === 0) {
      console.warn(`⚠️ Aucun agent trouvé pour le projet "${agentProject}"`);
      return [];
    }

    // Récupérer les statistiques de présence pour tous les agents du projet
    const agentStats = [];
    const startDateOnly = monthContext.startIso.split('T')[0];
    const endDateOnly = monthContext.endIso.split('T')[0];

    for (const agent of agentsToProcess) {
      try {
        // Récupérer les CHECKINS de l'agent pour calculer la présence
        // Utiliser start_time (date réelle de présence) pour les filtres de date
        const { data: checkins, error: checkinsError } = await supabaseClient
          .from('checkins')
          .select('id, user_id, start_time, end_time, created_at')
          .eq('user_id', agent.id)
          .gte('start_time', monthContext.startIso)
          .lte('start_time', monthContext.endIso)
          .limit(500);

        if (checkinsError) {
          console.warn(`Erreur récupération checkins pour agent ${agent.id}:`, checkinsError.message);
        }

        // Récupérer les MISSIONS de l'agent avec start_time et end_time pour calculer le temps terrain
        const { data: missions } = await supabaseClient
          .from('missions')
          .select('id, date_start, date_end, start_time, end_time, status, duration_minutes')
          .eq('agent_id', agent.id)
          .gte('date_start', startDateOnly)
          .lte('date_start', endDateOnly)
          .order('date_start', { ascending: true })
          .limit(500);

        // Récupérer les planifications
        const { data: planifications } = await supabaseClient
          .from('planifications')
          .select('date, description_activite, resultat_journee')
          .eq('user_id', agent.id)
          .gte('date', startDateOnly)
          .lte('date', endDateOnly)
          .limit(500);

        // Calculer les jours de présence à partir des CHECKINS
        const workedDaysSet = new Set();

        // Ajouter les jours de checkins (priorité: start_time > created_at)
        (checkins || []).forEach(checkin => {
          const rawDate = checkin.start_time || checkin.created_at;
          if (rawDate) {
            const date = new Date(rawDate);
            if (!Number.isNaN(date.getTime())) {
              const dayKey = date.toISOString().split('T')[0];
              workedDaysSet.add(dayKey);
            }
          }
        });

        // Calculer le temps terrain à partir des MISSIONS
        let totalFieldTimeMinutes = 0;
        let missionsCount = 0;
        let completedMissionsCount = 0;

        (missions || []).forEach(mission => {
          // Utiliser date_start et date_end pour le temps terrain (les champs start_time/end_time sont souvent null)
          const startTime = mission.date_start ? new Date(mission.date_start) : null;
          const endTime = mission.date_end ? new Date(mission.date_end) : null;

          // Ajouter aussi les jours de missions aux jours travaillés
          if (startTime && !Number.isNaN(startTime.getTime())) {
            const dayKey = startTime.toISOString().split('T')[0];
            workedDaysSet.add(dayKey);
          }

          missionsCount++;
          if (mission.status === 'completed') {
            completedMissionsCount++;
          }

          // Calculer le temps terrain pour cette mission (date_start -> date_end)
          if (startTime && endTime && endTime > startTime) {
            const diffMinutes = (endTime - startTime) / (1000 * 60);
            // Limiter à 14h max par mission (pour éviter les erreurs de données)
            totalFieldTimeMinutes += Math.min(diffMinutes, 14 * 60);
          } else if (mission.duration_minutes && Number.isFinite(Number(mission.duration_minutes))) {
            // Utiliser duration_minutes si disponible
            totalFieldTimeMinutes += Math.min(Number(mission.duration_minutes), 14 * 60);
          }
        });

        // Si pas de temps terrain calculé depuis les missions, calculer depuis les checkins
        // (temps entre premier et dernier checkin de chaque jour)
        if (totalFieldTimeMinutes === 0 && checkins && checkins.length > 0) {
          const checkinsByDay = new Map();

          (checkins || []).forEach(checkin => {
            const rawDate = checkin.start_time || checkin.created_at;
            if (rawDate) {
              const date = new Date(rawDate);
              if (!Number.isNaN(date.getTime())) {
                const dayKey = date.toISOString().split('T')[0];
                if (!checkinsByDay.has(dayKey)) {
                  checkinsByDay.set(dayKey, []);
                }
                checkinsByDay.get(dayKey).push(date.getTime());
              }
            }
          });

          // Pour chaque jour, calculer le temps entre premier et dernier checkin
          checkinsByDay.forEach((timestamps, dayKey) => {
            if (timestamps.length >= 2) {
              const minTime = Math.min(...timestamps);
              const maxTime = Math.max(...timestamps);
              const diffMinutes = (maxTime - minTime) / (1000 * 60);
              // Limiter à 14h max par jour
              totalFieldTimeMinutes += Math.min(diffMinutes, 14 * 60);
            }
          });
        }

        const fieldTimeHours = Math.round((totalFieldTimeMinutes / 60) * 10) / 10;

        // Calculer le temps moyen par jour de présence
        const daysWithPresence = workedDaysSet.size || 1;
        const avgFieldTimePerDay = Math.round((fieldTimeHours / daysWithPresence) * 10) / 10;

        const totalActivities = (planifications || []).length;
        const realizedActivities = (planifications || []).filter(p => {
          const result = String(p.resultat_journee || '').toLowerCase();
          return result.includes('réalis') || result.includes('realise') || result.includes('fait');
        }).length;

        const partiallyRealized = (planifications || []).filter(p => {
          const result = String(p.resultat_journee || '').toLowerCase();
          return result.includes('partiel');
        }).length;

        const inProgressActivities = (planifications || []).filter(p => {
          const result = String(p.resultat_journee || '').toLowerCase();
          return result.includes('cours');
        }).length;

        const withoutStatusActivities = (planifications || []).filter(p => {
          const result = String(p.resultat_journee || '').trim().toLowerCase();
          return !result || result === 'planifie' || result === 'planifié';
        }).length;

        const notRealized = Math.max(totalActivities - realizedActivities - partiallyRealized - inProgressActivities - withoutStatusActivities, 0);

        const agentName = agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || `Agent ${agent.id}`;

        // Calculer le taux de présence (jours travaillés / jours ouvrables du mois)
        const workingDays = countWorkingDays(monthContext.start, monthContext.end);
        const presenceRate = workingDays > 0 ? (workedDaysSet.size / workingDays) * 100 : 0;

        // Calculer le taux d'exécution (TEP) (activités réalisées / activités planifiées)
        const executionRate = totalActivities > 0 ? (realizedActivities / totalActivities) * 100 : 0;

        console.log(`📊 Agent ${agent.id} (${agentName})`, {
          checkins: (checkins || []).length,
          workedDays: workedDaysSet.size,
          planifications: (planifications || []).length,
          totalActivities,
          realizedActivities,
          presenceRate: Math.round(presenceRate * 10) / 10,
          tep: Math.round(executionRate * 10) / 10,
          fieldTimeHours: Math.round(fieldTimeHours * 10) / 10,
          missions: (missions || []).length
        });

        // Normaliser le temps terrain (max 8h par jour considéré comme 100%)
        const maxFieldTimePerDay = 8;
        const maxFieldTime = maxFieldTimePerDay * workingDays;
        const fieldTimeRate = maxFieldTime > 0 ? Math.min((fieldTimeHours / maxFieldTime) * 100, 100) : 0;

        // Score composite: 70% présence + 15% exécution + 15% temps terrain
        const compositeScore = (presenceRate * 0.70) + (executionRate * 0.15) + (fieldTimeRate * 0.15);

        agentStats.push({
          agentId: agent.id,
          agentName,
          firstName: agent.first_name || '',
          lastName: agent.last_name || '',
          projectName: agent.project_name,
          workedDays: workedDaysSet.size,
          workingDays,
          presenceRate: Math.round(presenceRate * 10) / 10,
          totalActivities,
          total: totalActivities,
          realizedActivities,
          realized: realizedActivities,
          partially: partiallyRealized,
          notRealized: notRealized,
          tep: Math.round(executionRate * 10) / 10,
          executionRate: Math.round(executionRate * 10) / 10,
          fieldTimeHours,
          avgFieldTimePerDay,
          fieldTimeRate: Math.round(fieldTimeRate * 10) / 10,
          missionsCount,
          completedMissionsCount,
          compositeScore: Math.round(compositeScore * 10) / 10
        });
      } catch (error) {
        console.warn(`Erreur lors de la récupération des stats pour l'agent ${agent.id}:`, error.message);

        // IMPORTANT: Ajouter quand même l'agent avec des valeurs à 0
        // Cela garantit que TOUS les agents du projet apparaissent dans le classement
        const agentName = agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || `Agent ${agent.id}`;
        const workingDays = countWorkingDays(monthContext.start, monthContext.end);

        agentStats.push({
          agentId: agent.id,
          agentName,
          firstName: agent.first_name || '',
          lastName: agent.last_name || '',
          projectName: agent.project_name,
          workedDays: 0,
          workingDays,
          presenceRate: 0,
          totalActivities: 0,
          total: 0,
          realizedActivities: 0,
          realized: 0,
          partially: 0,
          notRealized: 0,
          tep: 0,
          executionRate: 0,
          fieldTimeHours: 0,
          avgFieldTimePerDay: 0,
          fieldTimeRate: 0,
          missionsCount: 0,
          completedMissionsCount: 0,
          compositeScore: 0
        });
      }
    }

    // Trier par score composite décroissant
    agentStats.sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) {
        return b.compositeScore - a.compositeScore;
      }
      // En cas d'égalité, trier par taux de présence
      return b.presenceRate - a.presenceRate;
    });

    // Ajouter le rang
    agentStats.forEach((stat, index) => {
      stat.rank = index + 1;
    });

    // Log détaillé pour le débogage
    const agentsWithPresence = agentStats.filter(a => a.presenceRate > 0).length;
    const agentsWithFieldTime = agentStats.filter(a => a.fieldTimeHours > 0).length;
    console.log(`✅ Classement calculé pour ${agentStats.length} agents du projet "${agentProject}"`);
    console.log(`   - ${agentsWithPresence} agents avec présence > 0%`);
    console.log(`   - ${agentsWithFieldTime} agents avec temps terrain > 0h`);

    return agentStats;
  } catch (error) {
    console.warn('Erreur lors de la génération du classement:', error.message);
    return [];
  }
}

async function fetchMonthlyPermissions(supabaseClient, agentId, monthContext) {
  if (!supabaseClient || !Number.isFinite(agentId) || !monthContext) {
    console.warn('⚠️ fetchMonthlyPermissions - Paramètres invalides:', { agentId, monthContext });
    return { days: 0, details: [] };
  }

  try {
    const { start, end } = monthContext;
    const startIso = start.toISOString().split('T')[0];
    const endIso = end.toISOString().split('T')[0];

    console.log('🔍 Recherche permissions pour:', {
      agentId,
      month: monthContext.value,
      startDate: startIso,
      endDate: endIso
    });

    // Récupérer les permissions approuvées qui chevauchent le mois
    // Une permission chevauche le mois si: start_date <= mois_fin ET end_date >= mois_début
    const { data, error } = await supabaseClient
      .from('permissions')
      .select('start_date, end_date, status, reason')
      .eq('agent_id', agentId)
      .eq('status', 'approved')
      .lte('start_date', endIso)
      .gte('end_date', startIso);

    if (error) {
      console.error('❌ Erreur Supabase lors de la récupération des permissions:', error);
      throw error;
    }

    console.log('📋 Permissions trouvées:', {
      count: data?.length || 0,
      permissions: data
    });

    let totalDays = 0;
    const details = [];

    (data || []).forEach(perm => {
      const permStart = new Date(perm.start_date);
      const permEnd = new Date(perm.end_date);

      // Calculer l'intersection avec le mois courant
      const effectiveStart = permStart < start ? start : permStart;
      const effectiveEnd = permEnd > end ? end : permEnd;

      if (effectiveStart <= effectiveEnd) {
        // Calculer le nombre de jours (inclusif)
        const diffTime = Math.abs(effectiveEnd - effectiveStart);
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        console.log('📅 Permission calculée:', {
          original: { start: perm.start_date, end: perm.end_date },
          effective: { start: effectiveStart.toISOString().split('T')[0], end: effectiveEnd.toISOString().split('T')[0] },
          days
        });

        totalDays += days;
        details.push({
          start: perm.start_date,
          end: perm.end_date,
          days: days,
          status: perm.status,
          reason: perm.reason || null
        });
      }
    });

    console.log('✅ Total jours permissionnaires:', totalDays);

    return { days: totalDays, details };
  } catch (error) {
    console.error('❌ Erreur dans fetchMonthlyPermissions:', error.message || error);
    return { days: 0, details: [] };
  }
}

function buildSuggestions({ presence, activities, objectives, photos }) {
  const suggestions = [];

  if ((presence?.presenceRate || 0) < 80) {
    suggestions.push('Améliorer la régularité des check-ins en planifiant des rappels quotidiens.');
  }

  const nonRealise = (activities?.breakdown || []).find(item => item.key.includes('non'));
  if (nonRealise && nonRealise.count > 0) {
    suggestions.push('Analyser les activités non réalisées pour ajuster les moyens ou la planification.');
  }

  const lowObjective = (objectives || []).find(obj => obj.progressPercent < 50);
  if (lowObjective) {
    suggestions.push(`Renforcer l\'accompagnement sur l\'objectif "${lowObjective.title}" pour accélérer la progression.`);
  }

  if (!photos || photos.length === 0) {
    suggestions.push('Ajouter davantage de preuves photo lors des check-ins pour enrichir les rapports.');
  }

  if (suggestions.length === 0) {
    suggestions.push('Poursuivre sur cette dynamique et documenter chaque mission avec le même niveau de rigueur.');
  }

  return suggestions.slice(0, 4);
}

function buildFallbackSummary(meta, presence, activities) {
  const agentName = meta?.agent?.name || 'Agent';
  const monthLabel = meta?.month?.label || '';
  const presenceLine = `${presence?.presenceRate || 0}% de présence (${presence?.workedDays || 0}/${presence?.workingDays || 0} jours ouvrés, ${presence?.totalCheckins || 0} check-ins).`;
  const activityBreakdown = (activities?.breakdown || [])
    .slice(0, 3)
    .map(item => `${item.label}: ${item.count}`)
    .join(', ') || 'Aucune activité consignée';
  return `${agentName} — Synthèse ${monthLabel}. ${presenceLine} Activités: ${activities?.total || 0} (${activityBreakdown}).`;
}

async function maybeGenerateAiSummary({ geminiApiKey, geminiModel, payload }) {
  if (!geminiApiKey || geminiApiKey.trim() === '') {
    return {
      text: null,
      status: 'missing_api_key',
      model: geminiModel || GEMINI_MODEL || 'gemini-1.5-flash',
      error: 'Clé API Gemini non configurée. Veuillez configurer votre clé API dans les paramètres.'
    };
  }

  // Utiliser le modèle spécifié par l'utilisateur ou la liste par défaut (uniquement Flash)
  const candidateModels = geminiModel
    ? [geminiModel]
    : Array.from(new Set([
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b'
    ].filter(Boolean)));

  let lastError = null;

  for (const modelName of candidateModels) {
    let timeoutId = null;
    try {
      // Créer un timeout pour éviter les attentes infinies
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondes max

      // Sérialiser le payload de manière sécurisée
      let payloadText;
      try {
        payloadText = JSON.stringify(payload);
      } catch (stringifyError) {
        clearTimeout(timeoutId);
        throw new Error('Impossible de sérialiser les données pour l\'analyse IA: ' + (stringifyError.message || 'erreur inconnue'));
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: [
                    'Tu es un expert en analyse de performance terrain pour le CCRB (Conseil de Concertation des Riziculteurs du Bénin).',
                    'Ta tâche est de rédiger un rapport mensuel professionnel, motivant et constructif pour un agent de terrain.',
                    'Le rapport doit être rédigé en français, à la troisième personne (parler de "l\'agent" ou utiliser son nom).',
                    '',
                    'Structure ta réponse en exactement 4 sections distinctes avec ces titres exacts :',
                    '1. CONTEXTE ET ACTIVITÉ',
                    '2. RÉALISATIONS MAJEURES',
                    '3. PREUVES ET OBSERVATIONS',
                    '4. RECOMMANDATIONS STRATÉGIQUES',
                    '',
                    'Contenu attendu pour chaque section :',
                    '- CONTEXTE : Résume le taux de présence, le volume d\'activité et la couverture géographique. Mentionne explicitement les permissions (congés, absences justifiées) si elles existent pour expliquer les absences.',
                    '- RÉALISATIONS : Mets en avant les succès (objectifs atteints, activités réalisées). Sois précis sur les chiffres.',
                    '- PREUVES : Commente la qualité du reporting (photos, descriptions, géolocalisation).',
                    '- RECOMMANDATIONS : Donne 3 conseils concrets et actionnables pour le mois prochain pour améliorer la performance.',
                    '',
                    'Voici les données brutes du mois :',
                    payloadText
                  ].join('\n')
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            topP: 0.8,
            topK: 40
          }
        })
      });

      if (!response.ok) {
        if (timeoutId) clearTimeout(timeoutId);
        const errText = await response.text();
        console.error(`Gemini API error (${modelName}):`, errText);

        // Essayer de parser l'erreur JSON pour obtenir plus de détails
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorJson = JSON.parse(errText);
          if (errorJson.error?.message) {
            errorMessage = errorJson.error.message;
          } else if (errorJson.error) {
            errorMessage = String(errorJson.error);
          }
        } catch (parseError) {
          // Si ce n'est pas du JSON, utiliser le texte brut
          if (errText && errText.length < 200) {
            errorMessage = errText;
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Vérifier si l'API a retourné une erreur dans la réponse
      if (data.error) {
        if (timeoutId) clearTimeout(timeoutId);
        const errorMsg = data.error.message || String(data.error);
        console.error(`Gemini API returned error (${modelName}):`, errorMsg);
        throw new Error(errorMsg);
      }

      // Nettoyer le timeout en cas de succès
      if (timeoutId) clearTimeout(timeoutId);

      const text = data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('\n')
        .trim();

      if (text) {
        return { text, status: 'ready', model: modelName };
      }

      // Réponse vide : essayer un autre modèle
      lastError = new Error('Réponse vide du modèle');
    } catch (error) {
      // S'assurer que le timeout est nettoyé même en cas d'erreur
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      lastError = error;
      const errorMsg = error.message || String(error);
      console.warn(`Impossible d'obtenir une réponse du modèle ${modelName}:`, errorMsg);

      // Si c'est une erreur réseau ou de timeout, ne pas essayer les autres modèles
      if (error.name === 'AbortError' || (error.name === 'TypeError' && error.message.includes('fetch'))) {
        console.error('Erreur réseau ou timeout détecté, arrêt des tentatives');
        break;
      }
    }
  }

  // Construire un message d'erreur détaillé
  let errorMessage = 'Erreur inconnue lors de la génération de l\'analyse IA';
  if (lastError) {
    if (lastError.name === 'AbortError') {
      errorMessage = 'Délai d\'attente dépassé (timeout). L\'API Gemini n\'a pas répondu dans les 30 secondes.';
    } else if (lastError.message) {
      errorMessage = lastError.message;
      // Ajouter des suggestions selon le type d'erreur
      if (errorMessage.includes('401') || errorMessage.includes('403')) {
        errorMessage += ' Vérifiez que votre clé API Gemini est valide et active.';
      } else if (errorMessage.includes('429')) {
        errorMessage += ' Trop de requêtes. Veuillez réessayer plus tard.';
      } else if (errorMessage.includes('400')) {
        errorMessage += ' Requête invalide. Vérifiez les données envoyées.';
      }
    }
  }

  return {
    text: null,
    status: 'error',
    model: candidateModels[0] || 'gemini-1.5-flash',
    error: errorMessage,
    aiSummaryError: errorMessage
  };
}

async function buildAgentMonthlyReport({
  supabaseClient,
  agentId,
  monthValue,
  projectName,  // Nouveau: filtre par projet
  includeAiSummary = true,
  geminiApiKey,
  geminiModel,
  requester
}) {
  try {
    if (!supabaseClient) {
      throw createHttpError(500, 'Supabase non configuré');
    }

    const requesterId = Number(requester?.id || requester?.user_id || requester?.userId);
    if (!Number.isFinite(requesterId)) {
      throw createHttpError(401, 'Authentification requise');
    }

    const normalizedRole = String(requester?.role || '').toLowerCase();
    const privileged = ['admin', 'supervisor', 'superviseur'];
    const targetAgentId = Number(agentId || requesterId);
    if (!Number.isFinite(targetAgentId)) {
      throw createHttpError(400, 'agentId invalide');
    }

    if (!privileged.includes(normalizedRole) && targetAgentId !== requesterId) {
      throw createHttpError(403, 'Accès refusé pour ce rapport');
    }

    const monthContext = buildMonthContext(monthValue);

    // Récupérer l'agent avec gestion d'erreur
    let agent = null;
    let agentError = null;
    try {
      const agentResult = await supabaseClient
        .from('users')
        .select('id, email, name, first_name, last_name, role, phone, departement, commune, arrondissement, village, project_name')
        .eq('id', targetAgentId)
        .single();

      if (agentResult.error) {
        agentError = agentResult.error;
        console.warn('Erreur récupération agent:', agentError.message);
      } else {
        agent = agentResult.data;
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'agent:', error.message || error);
      agentError = error;
    }

    if (!agent) {
      agent = {
        id: targetAgentId,
        email: 'unknown@example.com',
        name: `Agent ${targetAgentId}`,
        first_name: 'Agent',
        last_name: String(targetAgentId),
        role: 'agent',
        project_name: projectName || null
      };
    }

    //Logs pour le débogage du filtre projet
    console.log('🔍 Filtre projet:', {
      requestedProject: projectName,
      agentProject: agent.project_name,
      willFilterByProject: !!projectName
    });

    if (agentError || !agent) {
      throw createHttpError(404, 'Agent introuvable');
    }

    const { data: goalsData = [], error: goalsError } = await supabaseClient
      .from('personal_goals')
      .select('id, title, description, status, category, target_value, progress_value, target_date, type')
      .eq('user_id', targetAgentId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (goalsError) {
      console.warn('Impossible de charger les objectifs:', goalsError.message);
    }

    // Récupérer les checkins : essayer d'abord avec user_id, puis via missions si nécessaire
    let checkinsData = [];
    let checkinsError = null;

    try {
      // Vérifier que targetAgentId est valide
      if (!Number.isFinite(targetAgentId)) {
        throw new Error(`agentId invalide: ${targetAgentId}`);
      }

      // Essayer d'abord avec user_id direct depuis presence_validations
      const { data: checkinsByUserId, error: errorByUserId } = await supabaseClient
        .from('presence_validations')
        .select('id, user_id, checkin_timestamp, validation_notes as note, checkin_lat as lat, checkin_lng as lon, checkin_location_name as location_name, photo_url, presence_id')
        .eq('user_id', targetAgentId)
        .eq('validation_status', 'validated')  // Seulement les présences validées
        .gte('checkin_timestamp', monthContext.startIso)
        .lte('checkin_timestamp', monthContext.endIso)
        .order('checkin_timestamp', { ascending: true })
        .limit(500);

      if (!errorByUserId && checkinsByUserId) {
        // Mapper les données pour compatibilité avec le code existant
        checkinsData = checkinsByUserId.map(pv => ({
          ...pv,
          created_at: pv.checkin_timestamp,  // Ajouter created_at pour compatibilité
          start_time: pv.checkin_timestamp
        }));
      } else {
        checkinsError = errorByUserId;
        console.warn('Erreur récupération presence_validations:', {
          error: errorByUserId?.message,
          code: errorByUserId?.code,
          targetAgentId
        });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des checkins:', {
        message: error.message,
        stack: error.stack,
        targetAgentId,
        monthContext: monthContext.value
      });
      checkinsError = error;
      checkinsData = [];
    }

    // Récupérer les données depuis presence_validations pour compléter les informations manquantes
    let presenceValidationsData = [];
    try {
      const { data: validationsData, error: validationsError } = await supabaseClient
        .from('presence_validations')
        .select('id, user_id, checkin_timestamp, checkin_lat, checkin_lng, checkin_location_name, photo_url, reference_lat, reference_lng, distance_from_reference_m, validation_status, notes')
        .eq('user_id', targetAgentId)
        .gte('checkin_timestamp', monthContext.startIso)
        .lte('checkin_timestamp', monthContext.endIso)
        .order('checkin_timestamp', { ascending: true })
        .limit(500);

      if (!validationsError && validationsData) {
        presenceValidationsData = validationsData;

        // Compléter les checkins avec les photos depuis presence_validations
        const checkinsMap = new Map();
        checkinsData.forEach(checkin => {
          const dateKey = new Date(checkin.created_at || checkin.timestamp || checkin.checkin_time).toISOString();
          checkinsMap.set(dateKey, checkin);
        });

        // Ajouter les photos et données manquantes depuis presence_validations
        presenceValidationsData.forEach(validation => {
          const validationDate = new Date(validation.checkin_timestamp).toISOString();
          const existingCheckin = checkinsMap.get(validationDate);

          if (existingCheckin) {
            // Compléter les données manquantes
            if (!existingCheckin.photo_url && validation.photo_url) {
              existingCheckin.photo_url = validation.photo_url;
            }
            if (!existingCheckin.lat && validation.checkin_lat) {
              existingCheckin.lat = validation.checkin_lat;
            }
            if (!existingCheckin.lon && validation.checkin_lng) {
              existingCheckin.lon = validation.checkin_lng;
            }
            if (!existingCheckin.location_name && validation.checkin_location_name) {
              existingCheckin.location_name = validation.checkin_location_name;
            }
          } else {
            // Ajouter comme nouveau checkin si non présent
            const newCheckin = {
              id: validation.id,
              user_id: validation.user_id,
              created_at: validation.checkin_timestamp,
              timestamp: validation.checkin_timestamp,
              checkin_time: validation.checkin_timestamp,
              lat: validation.checkin_lat,
              lon: validation.checkin_lng,
              location_name: validation.checkin_location_name,
              photo_url: validation.photo_url,
              note: validation.notes,
              mission_id: null
            };
            checkinsData.push(newCheckin);
          }
        });

        // Trier par date
        checkinsData.sort((a, b) => new Date(a.created_at || a.timestamp || a.checkin_time) - new Date(b.created_at || b.timestamp || b.checkin_time));
      }
    } catch (error) {
      console.warn('Erreur lors de la récupération des presence_validations:', error.message);
    }

    // Si toujours une erreur, la gérer mais ne pas bloquer si on a des données
    if (checkinsError && checkinsData.length === 0) {
      console.warn('Aucun checkin récupéré, utilisation d\'un tableau vide:', {
        error: checkinsError.message || checkinsError,
        targetAgentId
      });
      checkinsData = [];
    }

    // Récupérer les planifications avec gestion d'erreur améliorée
    let planificationsData = [];
    let planificationsError = null;
    try {
      const startDate = monthContext.startIso.split('T')[0];
      const endDate = monthContext.endIso.split('T')[0];

      if (!Number.isFinite(targetAgentId)) {
        console.warn('targetAgentId invalide pour les planifications:', targetAgentId);
        planificationsData = [];
      } else {
        // Essayer deux approches : d'abord avec or(), puis avec deux requêtes séparées si ça échoue
        // Utiliser select('*') pour éviter les erreurs si certaines colonnes n'existent pas
        try {
          // Essayer d'abord avec une requête simple par user_id uniquement (plus fiable)
          // Augmenter la limite pour afficher TOUTES les activités du mois
          let query = supabaseClient
            .from('planifications')
            .select('*')
            .eq('user_id', targetAgentId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true })
            .limit(1000);

          // IMPORTANT: ne pas filtrer en SQL (casse/espaces). On filtrera en JS après récupération

          const resultByUserId = await query;

          console.log(`📋 Planifications trouvées pour agent ${targetAgentId} (user_id):`, {
            count: resultByUserId.data?.length || 0,
            period: `${startDate} à ${endDate}`,
            projectFilter: projectName || 'AUCUN',
            error: resultByUserId.error?.message || null
          });

          // Si pas d'erreur et qu'on a des données, les utiliser
          if (!resultByUserId.error && resultByUserId.data && resultByUserId.data.length > 0) {
            planificationsData = resultByUserId.data;
          } else {
            // Essayer aussi avec agent_id si user_id ne donne rien
            let queryByAgentId = supabaseClient
              .from('planifications')
              .select('*')
              .eq('agent_id', targetAgentId)
              .gte('date', startDate)
              .lte('date', endDate)
              .order('date', { ascending: true })
              .limit(1000);

            // idem: pas de filtre SQL sur projet ici

            const resultByAgentId = await queryByAgentId;

            console.log(`📋 Planifications trouvées pour agent ${targetAgentId} (agent_id):`, {
              count: resultByAgentId.data?.length || 0,
              period: `${startDate} à ${endDate}`,
              projectFilter: projectName || 'AUCUN',
              error: resultByAgentId.error?.message || null
            });

            if (!resultByAgentId.error && resultByAgentId.data) {
              // Combiner les résultats et supprimer les doublons
              // Combiner et filtrer côté JS
              const combined = [
                ...(resultByUserId.data || []),
                ...(resultByAgentId.data || [])
              ];

              const uniqueMap = new Map();
              combined.forEach(item => {
                if (item && item.id) {
                  uniqueMap.set(item.id, item);
                }
              });

              let merged = Array.from(uniqueMap.values())
                .sort((a, b) => {
                  const dateA = new Date(a.date || 0);
                  const dateB = new Date(b.date || 0);
                  return dateA - dateB;
                });
              if (projectName) {
                const norm = v => String(v || '').trim().toLowerCase();
                const projNorm = norm(projectName);
                merged = merged.filter(p => norm(p.project_name) === projNorm);
                console.log(`📋 Filtre projet (JS) appliqué: "${projectName}" => ${merged.length} items`);
              }
              planificationsData = merged;
            } else if (resultByUserId.error) {
              // Si user_id échoue, essayer quand même avec agent_id
              if (!resultByAgentId.error && resultByAgentId.data) {
                planificationsData = resultByAgentId.data;
              } else {
                // Si les deux échouent, logger l'erreur mais continuer avec un tableau vide
                console.warn('Erreur récupération planifications par user_id:', resultByUserId.error);
                planificationsData = [];
              }
            } else {
              let onlyUser = resultByUserId.data || [];
              if (projectName) {
                const norm = v => String(v || '').trim().toLowerCase();
                const projNorm = norm(projectName);
                onlyUser = onlyUser.filter(p => norm(p.project_name) === projNorm);
                console.log(`📋 Filtre projet (JS,user) appliqué: "${projectName}" => ${onlyUser.length} items`);
              }
              planificationsData = onlyUser;
            }
          }
        } catch (error) {
          // En cas d'erreur, logger et continuer avec un tableau vide
          console.error('Erreur lors de la récupération des planifications:', {
            message: error.message,
            code: error.code,
            details: error.details,
            targetAgentId,
            startDate,
            endDate
          });
          planificationsError = error;
          planificationsData = [];
        }
      }

      if (planificationsError) {
        console.warn('Impossible de charger les planifications:', {
          message: planificationsError.message,
          code: planificationsError.code,
          details: planificationsError.details,
          hint: planificationsError.hint,
          targetAgentId,
          startDate,
          endDate
        });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des planifications:', {
        message: error.message,
        stack: error.stack,
        targetAgentId,
        monthContext: monthContext.value
      });
      planificationsError = error;
      planificationsData = [];
    }

    // Récupérer le récapitulatif mensuel de présence depuis la même source que /api/presence-summary
    let presenceSummary = null;
    try {
      console.log('🔍 Récupération du récapitulatif de présence (source report_presence_view)...');
      const [yearStr, monthStr] = String(monthContext.value || '').split('-');
      const yearNum = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      const { data: summaryRows, error: summaryError } = await supabaseClient
        .from('report_presence_view')
        .select('*')
        .eq('user_id', targetAgentId)
        .gte('ts', startDateStr)
        .lte('ts', endDateStr)
        .order('ts', { ascending: true });

      if (summaryError) {
        console.warn('Erreur récupération report_presence_view:', summaryError.message);
      } else if (summaryRows && summaryRows.length > 0) {
        // Agréger par jour (au cas où plusieurs lignes par jour)
        const daysMap = new Map();
        for (const row of summaryRows) {
          const dayKey = String(row.date || row.ts || '').split('T')[0];
          if (!dayKey) continue;
          if (!daysMap.has(dayKey)) {
            daysMap.set(dayKey, {
              date: dayKey,
              isWorkingDay: row.is_working_day ?? true,
              isHoliday: row.is_holiday ?? false,
              planned: row.planned || 0,
              present: row.present || 0,
              permission: row.permission || 0
            });
          } else {
            const existing = daysMap.get(dayKey);
            existing.planned += row.planned || 0;
            existing.present += row.present || 0;
            existing.permission += row.permission || 0;
            existing.isWorkingDay = existing.isWorkingDay || (row.is_working_day ?? false);
            existing.isHoliday = existing.isHoliday || (row.is_holiday ?? false);
          }
        }

        let expectedDays = 0;
        let plannedDays = 0;
        let presentDays = 0;
        let permissionDays = 0;

        for (const day of daysMap.values()) {
          if (day.isWorkingDay) {
            expectedDays += 1;
          }
          if (day.planned > 0) {
            plannedDays += 1;
          }
          if (day.present > 0) {
            presentDays += 1;
          }
          if (day.permission > 0) {
            permissionDays += 1;
          }
        }

        const presenceRate = expectedDays > 0
          ? Math.round((presentDays / expectedDays) * 1000) / 10
          : 0;

        presenceSummary = {
          expectedDays,
          plannedDays,
          presentDays,
          presenceRate,
          permissionDays
        };

        console.log('✅ Récapitulatif présence (report_presence_view):', presenceSummary);
      }
    } catch (error) {
      console.warn('Erreur inattendue lors de la récupération du récapitulatif de présence:', error.message || error);
      presenceSummary = null;
    }

    // Récupérer les jours permissionnaires avec gestion d'erreur (fallback si report_presence_view indisponible)
    let permissionDays = presenceSummary?.permissionDays ?? 0;
    let permissionsData = { days: 0, details: [] };

    if (!presenceSummary) {
      // Aucun récapitulatif pré-calculé: utiliser uniquement la table permissions
      try {
        permissionsData = await fetchMonthlyPermissions(supabaseClient, targetAgentId, monthContext);
        console.log('✅ Permissions récupérées (fallback):', {
          agentId: targetAgentId,
          month: monthContext.value,
          days: permissionsData.days,
          detailsCount: permissionsData.details?.length || 0
        });
      } catch (error) {
        console.warn('Erreur lors de la récupération des jours permissionnaires (fallback):', error.message || error);
        permissionsData = { days: 0, details: [] };
      }
      permissionDays = permissionsData.days;
    } else {
      // presenceSummary existe (via report_presence_view) mais peut ne pas compter correctement les permissions.
      // On récupère toujours les permissions détaillées et on fusionne.
      try {
        permissionsData = await fetchMonthlyPermissions(supabaseClient, targetAgentId, monthContext);
        console.log('✅ Détails permissions récupérés:', {
          agentId: targetAgentId,
          month: monthContext.value,
          days: permissionsData.days,
          detailsCount: permissionsData.details?.length || 0
        });

        // Si la table permissions indique plus de jours que le résumé, on prend le maximum
        if (typeof permissionsData.days === 'number') {
          permissionDays = Math.max(permissionDays || 0, permissionsData.days);
        }
      } catch (error) {
        console.warn('Erreur lors de la récupération des détails permissions:', error.message || error);
        permissionsData = { days: permissionDays, details: [] };
      }
    }

    // Récupérer les MISSIONS de l'agent pour calculer le temps terrain
    // Utiliser le format date (YYYY-MM-DD) pour le filtrage car date_start peut être un champ date
    let missionsData = [];
    try {
      const missionStartDate = monthContext.startIso.split('T')[0];
      const missionEndDate = monthContext.endIso.split('T')[0];
      const { data: missions, error: missionsError } = await supabaseClient
        .from('missions')
        .select('id, date_start, date_end, start_time, end_time, status, agent_id, duration_minutes')
        .eq('agent_id', targetAgentId)
        .gte('date_start', missionStartDate)
        .lte('date_start', missionEndDate)
        .order('date_start', { ascending: true })
        .limit(500);

      if (missionsError) {
        console.warn('Erreur récupération missions:', missionsError.message);
      } else {
        missionsData = missions || [];
        console.log('✅ Missions récupérées:', {
          agentId: targetAgentId,
          count: missionsData.length,
          month: monthContext.value
        });
      }
    } catch (error) {
      console.warn('Erreur lors de la récupération des missions:', error.message || error);
      missionsData = [];
    }

    // Récupérer jusqu'à 3 photos de terrain depuis presence_validations pour enrichir le rapport
    let fieldPhoto = null;
    let fieldPhotos = [];
    try {
      const { data: validationPhotos, error: validationError } = await supabaseClient
        .from('presence_validations')
        .select('photo_url, checkin_timestamp, checkin_location_name')
        .eq('user_id', targetAgentId)
        .gte('checkin_timestamp', monthContext.startIso)
        .lte('checkin_timestamp', monthContext.endIso)
        .not('photo_url', 'is', null)
        .order('checkin_timestamp', { ascending: false })
        .limit(3);

      if (!validationError && Array.isArray(validationPhotos) && validationPhotos.length > 0) {
        fieldPhotos = validationPhotos.map(p => ({
          url: p.photo_url,
          date: p.checkin_timestamp,
          location: p.checkin_location_name || null
        }));
        fieldPhoto = fieldPhotos[0] || null;
      }
    } catch (photoError) {
      console.warn('Erreur lors de la récupération des photos terrain (presence_validations):', photoError.message || photoError);
      fieldPhoto = null;
    }

    // Récupérer le classement du projet
    let projectRanking = [];
    try {
      projectRanking = await buildProjectRanking(supabaseClient, targetAgentId, monthContext);
    } catch (error) {
      console.warn('Erreur lors de la génération du classement:', error.message || error);
      projectRanking = [];
    }

    // Traiter les données avec gestion d'erreur pour chaque étape
    let objectives = [];
    let presence = { totalCheckins: 0, workedDays: 0, workingDays: 0, presenceRate: 0 };
    let activities = { total: 0, breakdown: [], list: [], plannedDays: 0, totalPlannedHours: 0, validatedPlannedHours: 0, performance: {} };
    let locations = [];
    let photos = [];
    let sanitizedAgent = null;
    let suggestions = [];
    let fallbackSummary = '';

    try {
      objectives = mapObjectives(goalsData || []);
    } catch (error) {
      console.warn('Erreur lors du mapping des objectifs:', error.message || error);
      objectives = [];
    }

    try {
      if (presenceSummary) {
        // Utiliser les mêmes agrégats que /reports.html pour les jours attendus/planifiés/préences
        presence = summarizePresence(checkinsData || [], monthContext, missionsData || []);
        presence.workingDays = presenceSummary.expectedDays ?? presence.workingDays;
        presence.workedDays = presenceSummary.presentDays ?? presence.workedDays;
        presence.presenceRate = presenceSummary.presenceRate ?? presence.presenceRate;
        presence.plannedDays = presenceSummary.plannedDays ?? presence.plannedDays;
      } else {
        console.log('ℹ️ Aucune présence agrégée (report_presence_view), utilisation du calcul local summarizePresence');
        presence = summarizePresence(checkinsData || [], monthContext, missionsData || []);
      }
      // Ajouter les jours permissionnaires au résumé de présence (quelle que soit la source)
      presence.permissionDays = permissionDays || 0;
      console.log('📊 Résumé de présence calculé:', {
        totalCheckins: presence.totalCheckins,
        workedDays: presence.workedDays,
        permissionDays: presence.permissionDays,
        fieldTimeHours: presence.fieldTimeHours,
        avgFieldTimePerDay: presence.avgFieldTimePerDay,
        missionsCount: presence.missionsCount
      });

      // Harmoniser le classement de projet avec les métriques de présence de l'agent audité
      // IMPORTANT: Utiliser TOUJOURS les valeurs de presence pour l'agent filtré, même si elles sont > 0
      // car elles sont calculées différemment (summarizePresence) et sont plus fiables
      if (Array.isArray(projectRanking) && projectRanking.length > 0) {
        projectRanking = projectRanking.map(entry => {
          if (entry.agentId === targetAgentId) {
            // Pour l'agent filtré, TOUJOURS utiliser les valeurs de presence si disponibles
            // même si elles sont différentes de celles calculées dans buildProjectRanking
            const updatedEntry = {
              ...entry,
              presenceRate: Number.isFinite(presence.presenceRate)
                ? presence.presenceRate
                : (entry.presenceRate || 0)
            };

            // Pour le temps terrain, utiliser la valeur de presence si elle est > 0
            // Sinon, garder la valeur du classement (qui peut être > 0 si calculée différemment)
            if (Number.isFinite(presence.fieldTimeHours) && presence.fieldTimeHours > 0) {
              updatedEntry.fieldTimeHours = presence.fieldTimeHours;
              updatedEntry.avgFieldTimePerDay = Number.isFinite(presence.avgFieldTimePerDay)
                ? presence.avgFieldTimePerDay
                : (entry.avgFieldTimePerDay || 0);
            } else if (entry.fieldTimeHours > 0) {
              // Si presence.fieldTimeHours est à 0 mais que le classement a une valeur > 0,
              // utiliser la valeur du classement (elle a été calculée différemment et peut être correcte)
              updatedEntry.fieldTimeHours = entry.fieldTimeHours;
              updatedEntry.avgFieldTimePerDay = entry.avgFieldTimePerDay || 0;
            } else {
              // Si les deux sont à 0, utiliser 0
              updatedEntry.fieldTimeHours = 0;
              updatedEntry.avgFieldTimePerDay = 0;
            }

            return updatedEntry;
          }
          return entry;
        });
      }
    } catch (error) {
      console.warn('Erreur lors du résumé de présence:', error.message || error);
      presence = {
        totalCheckins: 0,
        workedDays: 0,
        workingDays: 0,
        presenceRate: 0,
        permissionDays: permissionDays || 0,
        fieldTimeHours: 0,
        avgFieldTimePerDay: 0,
        missionsCount: 0
      };
    }

    try {
      activities = summarizeActivities(planificationsData || [], checkinsData || []);
    } catch (error) {
      console.warn('Erreur lors du résumé des activités:', error.message || error);
      activities = { total: 0, breakdown: [], list: [], plannedDays: 0, totalPlannedHours: 0, validatedPlannedHours: 0, performance: {} };
    }

    try {
      locations = summarizeLocations(checkinsData || []);
    } catch (error) {
      console.warn('Erreur lors du résumé des lieux:', error.message || error);
      locations = [];
    }

    try {
      photos = summarizePhotos(checkinsData || []);
    } catch (error) {
      console.warn('Erreur lors du résumé des photos:', error.message || error);
      photos = [];
    }

    try {
      sanitizedAgent = sanitizeAgent(agent);
    } catch (error) {
      console.warn('Erreur lors de la sanitization de l\'agent:', error.message || error);
      sanitizedAgent = {
        id: targetAgentId,
        name: agent?.name || agent?.first_name || `Agent ${targetAgentId}`,
        email: agent?.email || null,
        role: agent?.role || 'agent'
      };
    }

    try {
      suggestions = buildSuggestions({ presence, activities, objectives, photos });
    } catch (error) {
      console.warn('Erreur lors de la génération des suggestions:', error.message || error);
      suggestions = ['Poursuivre sur cette dynamique et documenter chaque mission avec le même niveau de rigueur.'];
    }

    try {
      fallbackSummary = buildFallbackSummary({ agent: sanitizedAgent, month: monthContext }, presence, activities);
    } catch (error) {
      console.warn('Erreur lors de la génération du résumé de secours:', error.message || error);
      fallbackSummary = `${sanitizedAgent?.name || 'Agent'} — Synthèse ${monthContext.label}.`;
    }

    const aiPayload = {
      agent: sanitizedAgent,
      month: { label: monthContext.label, value: monthContext.value },
      presence: {
        presenceRate: presence.presenceRate,
        totalCheckins: presence.totalCheckins,
        workedDays: presence.workedDays,
        workingDays: presence.workingDays,
        permissionDays: presence.permissionDays || 0,
        permissionDetails: permissionsData.details
      },
      keyObjectives: objectives.slice(0, 5),
      highlightedActivities: activities.list.slice(0, 8),
      topLocations: locations.slice(0, 5),
      photoEvidence: photos.slice(0, 3)
    };

    let aiSummary;
    if (includeAiSummary) {
      try {
        aiSummary = await maybeGenerateAiSummary({ geminiApiKey, geminiModel, payload: aiPayload });
      } catch (error) {
        // En cas d'erreur inattendue, continuer sans l'analyse IA
        console.error('Erreur inattendue lors de la génération de l\'analyse IA:', error);
        aiSummary = {
          text: null,
          status: 'error',
          model: GEMINI_MODEL || 'gemini-1.5-flash',
          error: error.message || 'Erreur inattendue lors de la génération de l\'analyse IA'
        };
      }
    } else {
      aiSummary = { text: null, status: 'disabled', model: GEMINI_MODEL };
    }

    // Log de diagnostic avant le retour
    console.log('Rapport mensuel généré avec succès:', {
      agentId: targetAgentId,
      agentName: sanitizedAgent?.name,
      month: monthContext.value,
      checkinsCount: checkinsData?.length || 0,
      planificationsCount: planificationsData?.length || 0,
      goalsCount: goalsData?.length || 0,
      presenceRate: presence?.presenceRate,
      activitiesTotal: activities?.total || 0
    });

    return {
      success: true,
      meta: {
        agent: sanitizedAgent,
        month: {
          value: monthContext.value,
          label: monthContext.label,
          start: monthContext.startIso,
          end: monthContext.endIso
        }
      },
      objectives,
      presence,
      activities,
      locations,
      photos,
      fieldPhoto,
      fieldPhotos,
      projectRanking,
      fieldTimeHours: presence.fieldTimeHours || 0,
      dailyMissions: presence.dailyMissions || [],  // Nouveau : détail quotidien
      comments: {
        aiSummary: aiSummary.text,
        aiSummaryStatus: aiSummary.status,
        aiModel: aiSummary.model,
        aiSummaryError: aiSummary.error || aiSummary.aiSummaryError,
        fallbackSummary,
        suggestions
      },
      dataSources: {
        goals: goalsData?.length || 0,
        checkins: checkinsData?.length || 0,
        planifications: planificationsData?.length || 0,
        missions: missionsData?.length || 0
      }
    };
  } catch (error) {
    // Gestion d'erreur globale pour éviter que toute erreur non gérée fasse planter le serveur
    console.error('Erreur globale dans buildAgentMonthlyReport:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      statusCode: error.statusCode,
      agentId,
      monthValue
    });

    // Si c'est déjà une erreur HTTP, la relancer
    if (error.statusCode) {
      throw error;
    }

    // Sinon, créer une erreur HTTP 500
    throw createHttpError(500, error.message || 'Erreur lors de la génération du rapport mensuel');
  }
}

module.exports = {
  buildAgentMonthlyReport,
  buildProjectRanking
};

