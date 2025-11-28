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
  : 'gemini-1.5-flash-8b';
const MAX_ACTIVITIES_PREVIEW = 40;
const MAX_LOCATIONS = 6;
const MAX_PHOTOS = 6;

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
    const rawDate = checkin?.created_at || checkin?.timestamp || checkin?.checkin_time;
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

function summarizePresence(checkins, monthContext) {
  const totalCheckins = checkins.length;
  const workedDaysSet = new Set();
  let earliest = null;
  let latest = null;

  checkins.forEach(checkin => {
    const rawDate = checkin?.created_at || checkin?.timestamp || checkin?.checkin_time;
    if (!rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const dayKey = date.toISOString().split('T')[0];
    workedDaysSet.add(dayKey);
    if (!earliest || date < earliest) earliest = date;
    if (!latest || date > latest) latest = date;
  });

  const totalWorkingDays = countWorkingDays(monthContext.start, monthContext.end);
  const workedDays = workedDaysSet.size;
  const presenceRate = totalWorkingDays > 0
    ? Math.round((workedDays / totalWorkingDays) * 1000) / 10
    : 0;
  const avgCheckinsPerDay = workedDays > 0
    ? Math.round((totalCheckins / workedDays) * 10) / 10
    : totalCheckins;

  return {
    totalCheckins,
    workedDays,
    workingDays: totalWorkingDays,
    presenceRate,
    averageCheckinsPerDay: avgCheckinsPerDay,
    firstEntry: earliest ? earliest.toISOString() : null,
    lastEntry: latest ? latest.toISOString() : null,
    weeklyDistribution: summarizeWeeklyDistribution(checkins)
  };
}

function summarizeActivities(planifications = []) {
  const list = (planifications || []).map(plan => ({
    id: plan.id,
    date: plan.date,
    description: plan.description_activite || plan.activity_name || plan.description || 'Activité non spécifiée',
    result: plan.resultat_journee || plan.status || 'planifie',
    observations: plan.observations || plan.result_details || '',
    project: plan.project_name || plan.project || null
  }));

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
  const lat = pickNumber(checkin.lat, checkin.latitude, checkin.location_lat);
  const lon = pickNumber(checkin.lon, checkin.longitude, checkin.location_lng);
  const label = (checkin.location_name || checkin.address || checkin.commune || checkin.village || checkin.note || '').trim();
  if (label) {
    return { id: label.toLowerCase(), label, lat, lon };
  }
  if (lat !== null && lon !== null) {
    const roundedLat = lat.toFixed(3);
    const roundedLon = lon.toFixed(3);
    return {
      id: `${roundedLat}_${roundedLon}`,
      label: `Coordonnées ${roundedLat}, ${roundedLon}`,
      lat,
      lon
    };
  }
  return null;
}

function summarizeLocations(checkins = []) {
  const map = new Map();
  checkins.forEach(checkin => {
    const descriptor = getLocationDescriptor(checkin);
    if (!descriptor) return;
    if (!map.has(descriptor.id)) {
      map.set(descriptor.id, { ...descriptor, visits: 0 });
    }
    map.get(descriptor.id).visits += 1;
  });

  return Array.from(map.values())
    .sort((a, b) => b.visits - a.visits)
    .slice(0, MAX_LOCATIONS);
}

function summarizePhotos(checkins = []) {
  return checkins
    .filter(checkin => checkin.photo_url || checkin.photo_path)
    .map(checkin => ({
      url: checkin.photo_url || checkin.photo_path,
      date: (checkin.created_at || checkin.timestamp || checkin.checkin_time) ? new Date(checkin.created_at || checkin.timestamp || checkin.checkin_time).toISOString() : null,
      note: checkin.note || checkin.description || ''
    }))
    .slice(0, MAX_PHOTOS);
}

async function fetchPermissionDaysRecord(supabaseClient, agentId, monthValue) {
  if (!supabaseClient || !Number.isFinite(agentId) || !monthValue) {
    return 0;
  }
  try {
    const { data, error } = await supabaseClient
      .from('permission_days')
      .select('days')
      .eq('agent_id', agentId)
      .eq('month', monthValue)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return Math.max(0, Number(data?.days) || 0);
  } catch (error) {
    console.warn('Impossible de récupérer les jours permissionnaires:', error.message || error);
    return 0;
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

async function maybeGenerateAiSummary({ geminiApiKey, payload }) {
  if (!geminiApiKey) {
    return { text: null, status: 'missing_api_key', model: GEMINI_MODEL };
  }

  const candidateModels = Array.from(new Set([
    GEMINI_MODEL,
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b'
  ].filter(Boolean)));

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: [
                    'Tu es un assistant qui rédige des rapports mensuels professionnels pour le CCRB.',
                    'Structure le rapport en 4 paragraphes (contexte, réalisations, preuves terrain, recommandations).',
                    'Utilise un ton professionnel et reste en français.',
                    'Voici les données:',
                    JSON.stringify(payload)
                  ].join('\n')
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
            topP: 0.9
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini API error (${modelName}):`, errText);
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
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
      lastError = error;
      console.warn(`Impossible d'obtenir une réponse du modèle ${modelName}:`, error.message);
    }
  }

  return {
    text: null,
    status: 'error',
    model: candidateModels[0],
    error: lastError?.message || 'Erreur inconnue'
  };
}

async function buildAgentMonthlyReport({
  supabaseClient,
  agentId,
  monthValue,
  includeAiSummary = true,
  geminiApiKey,
  requester
}) {
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
  const { data: agent, error: agentError } = await supabaseClient
    .from('users')
    .select('id, email, name, first_name, last_name, role, phone, departement, commune, arrondissement, village, project_name')
    .eq('id', targetAgentId)
    .single();
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
  let checkinsData = null;
  let checkinsError = null;

  // Essayer d'abord avec user_id direct
  const { data: checkinsByUserId, error: errorByUserId } = await supabaseClient
    .from('checkins')
    .select('id, user_id, created_at, timestamp, checkin_time, note, lat, lon, location_name, address, commune, village, photo_url, photo_path, mission_id')
    .eq('user_id', targetAgentId)
    .gte('created_at', monthContext.startIso)
    .lte('created_at', monthContext.endIso)
    .order('created_at', { ascending: true })
    .limit(500);

  if (!errorByUserId && checkinsByUserId) {
    checkinsData = checkinsByUserId;
  } else {
    // Si échec, essayer via missions
    console.warn('Tentative récupération checkins via missions pour agent', targetAgentId);
    const { data: missionsData, error: missionsError } = await supabaseClient
      .from('missions')
      .select('id')
      .eq('agent_id', targetAgentId)
      .gte('date_start', monthContext.startIso.split('T')[0])
      .lte('date_end', monthContext.endIso.split('T')[0])
      .limit(100);

    if (!missionsError && missionsData && missionsData.length > 0) {
      const missionIds = missionsData.map(m => m.id);
      const { data: checkinsByMission, error: errorByMission } = await supabaseClient
        .from('checkins')
        .select('id, user_id, created_at, timestamp, checkin_time, note, lat, lon, location_name, address, commune, village, photo_url, photo_path, mission_id')
        .in('mission_id', missionIds)
        .gte('created_at', monthContext.startIso)
        .lte('created_at', monthContext.endIso)
        .order('created_at', { ascending: true })
        .limit(500);

      if (!errorByMission && checkinsByMission) {
        checkinsData = checkinsByMission;
      } else {
        checkinsError = errorByMission || errorByUserId;
      }
    } else {
      checkinsError = errorByUserId;
    }
  }

  // Si toujours une erreur, la gérer mais ne pas bloquer si on a des données
  if (checkinsError && !checkinsData) {
    console.error('Erreur récupération checkins:', checkinsError);
    // Ne pas bloquer complètement, utiliser un tableau vide
    checkinsData = [];
  }

  const { data: planificationsData = [], error: planificationsError } = await supabaseClient
    .from('planifications')
    .select('id, user_id, date, description_activite, resultat_journee, observations, project_name, status')
    .eq('user_id', targetAgentId)
    .gte('date', monthContext.startIso.split('T')[0])
    .lte('date', monthContext.endIso.split('T')[0])
    .order('date', { ascending: true })
    .limit(200);
  if (planificationsError) {
    console.warn('Impossible de charger les planifications:', planificationsError.message);
  }

  const permissionDays = await fetchPermissionDaysRecord(supabaseClient, targetAgentId, monthContext.value);

  const objectives = mapObjectives(goalsData || []);
  const presence = summarizePresence(checkinsData || [], monthContext);
  if (typeof permissionDays === 'number' && permissionDays >= 0) {
    presence.permissionDays = permissionDays;
  }
  const activities = summarizeActivities(planificationsData || []);
  const locations = summarizeLocations(checkinsData || []);
  const photos = summarizePhotos(checkinsData || []);
  const sanitizedAgent = sanitizeAgent(agent);
  const suggestions = buildSuggestions({ presence, activities, objectives, photos });
  const fallbackSummary = buildFallbackSummary({ agent: sanitizedAgent, month: monthContext }, presence, activities);

  const aiPayload = {
    agent: sanitizedAgent,
    month: { label: monthContext.label, value: monthContext.value },
    presence: {
      presenceRate: presence.presenceRate,
      totalCheckins: presence.totalCheckins,
      workedDays: presence.workedDays,
      workingDays: presence.workingDays,
      permissionDays: presence.permissionDays || 0
    },
    keyObjectives: objectives.slice(0, 5),
    highlightedActivities: activities.list.slice(0, 8),
    topLocations: locations.slice(0, 5),
    photoEvidence: photos.slice(0, 3)
  };

  const aiSummary = includeAiSummary
    ? await maybeGenerateAiSummary({ geminiApiKey, payload: aiPayload })
    : { text: null, status: 'disabled', model: GEMINI_MODEL };

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
    comments: {
      aiSummary: aiSummary.text,
      aiSummaryStatus: aiSummary.status,
      aiModel: aiSummary.model,
      fallbackSummary,
      suggestions
    },
    dataSources: {
      goals: goalsData?.length || 0,
      checkins: checkinsData?.length || 0,
      planifications: planificationsData?.length || 0
    }
  };
}

module.exports = {
  buildAgentMonthlyReport
};

