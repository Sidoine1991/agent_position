import { db } from './db.js';

// Fonction pour calculer la distance entre deux points GPS (formule de Haversine)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance en mètres
}

// Algorithme de validation de présence
export function validatePresence(
  checkinLat: number, 
  checkinLon: number, 
  referenceLat: number, 
  referenceLon: number, 
  toleranceRadius: number = 50000 // 50km par défaut
): { status: 'present' | 'absent' | 'tolerance', distance: number } {
  const distance = calculateDistance(checkinLat, checkinLon, referenceLat, referenceLon);
  
  // Logique simplifiée : dans le rayon = présent, au-delà = absent
  if (distance <= toleranceRadius) {
    return { status: 'present', distance };
  } else {
    return { status: 'absent', distance };
  }
}

// Fonction pour configurer le point de référence d'un agent
export function setAgentReferencePoint(
  agentId: number, 
  referenceLat: number, 
  referenceLon: number, 
  toleranceRadius: number = 50000
): void {
  db.prepare(`
    UPDATE users 
    SET reference_lat = ?, reference_lon = ?, tolerance_radius_meters = ?
    WHERE id = ? AND role = 'agent'
  `).run(referenceLat, referenceLon, toleranceRadius, agentId);
}

// Fonction pour obtenir les coordonnées GPS d'un village
export function getVillageCoordinates(villageId: number): { lat: number, lon: number } | null {
  // Pour l'instant, on retourne des coordonnées par défaut
  // Dans une vraie implémentation, on aurait les coordonnées GPS des villages
  const villageCoords: { [key: number]: { lat: number, lon: number } } = {
    // Coordonnées approximatives de quelques villes du Bénin
    1: { lat: 6.3729, lon: 2.3543 }, // Cotonou
    2: { lat: 6.4969, lon: 2.6036 }, // Porto-Novo
    3: { lat: 7.1861, lon: 1.9911 }, // Abomey
    4: { lat: 9.3077, lon: 2.3158 }, // Parakou
    5: { lat: 6.3600, lon: 2.4200 }, // Ouidah
  };
  
  return villageCoords[villageId] || { lat: 6.3729, lon: 2.3543 }; // Cotonou par défaut
}

// Enregistrer la validation de présence
export function recordPresenceValidation(
  agentId: number,
  checkinId: number,
  checkinLat: number,
  checkinLon: number,
  validatedBy?: number
): { id: number, status: string, distance: number } {
  // Récupérer les informations de l'agent
  const agent = db.prepare(`
    SELECT reference_lat, reference_lon, tolerance_radius_meters 
    FROM users 
    WHERE id = ?
  `).get(agentId) as { reference_lat: number, reference_lon: number, tolerance_radius_meters: number };

  if (!agent || !agent.reference_lat || !agent.reference_lon) {
    throw new Error('Point de référence non défini pour cet agent');
  }

  // Valider la présence
  const validation = validatePresence(
    checkinLat,
    checkinLon,
    agent.reference_lat,
    agent.reference_lon,
    agent.tolerance_radius_meters
  );

  // Enregistrer dans la base de données
  const result = db.prepare(`
    INSERT INTO presence_records 
    (agent_id, checkin_id, reference_lat, reference_lon, checkin_lat, checkin_lon, 
     distance_meters, tolerance_radius, status, validated_by, validated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    agentId,
    checkinId,
    agent.reference_lat,
    agent.reference_lon,
    checkinLat,
    checkinLon,
    validation.distance,
    agent.tolerance_radius_meters,
    validation.status,
    validatedBy || null
  );

  return {
    id: result.lastInsertRowid as number,
    status: validation.status,
    distance: validation.distance
  };
}

// Générer le rapport mensuel pour un agent
export function generateMonthlyReport(agentId: number, monthYear: string): void {
  const startDate = `${monthYear}-01`;
  const endDate = `${monthYear}-31`;
  
  // Récupérer les données de présence du mois
  const presenceData = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM presence_records pr
    JOIN checkins c ON c.id = pr.checkin_id
    WHERE pr.agent_id = ? 
    AND date(c.timestamp) >= ? 
    AND date(c.timestamp) <= ?
    GROUP BY status
  `).all(agentId, startDate, endDate);

  // Récupérer les informations de l'agent
  const agent = db.prepare('SELECT expected_days_per_month FROM users WHERE id = ?').get(agentId) as { expected_days_per_month: number };
  
  const presentDays = presenceData.find(p => p.status === 'present')?.count || 0;
  const absentDays = presenceData.find(p => p.status === 'absent')?.count || 0;
  const toleranceDays = presenceData.find(p => p.status === 'tolerance')?.count || 0;
  
  // Insérer ou mettre à jour le rapport
  db.prepare(`
    INSERT OR REPLACE INTO monthly_reports 
    (agent_id, month_year, expected_days, present_days, absent_days, tolerance_days, status)
    VALUES (?, ?, ?, ?, ?, ?, 'completed')
  `).run(agentId, monthYear, agent.expected_days_per_month, presentDays, absentDays, toleranceDays);
}

// Exporter le rapport mensuel en Excel
export function exportMonthlyReport(monthYear: string): any[] {
  const reports = db.prepare(`
    SELECT 
      u.first_name || ' ' || u.last_name as nom_complet,
      u.phone,
      u.role as statut_agent,
      d.name as departement,
      c.name as commune,
      a.name as arrondissement,
      v.name as village_intervention,
      u.project_name as projet_intervention,
      u.planning_start_date as date_debut_planification,
      u.planning_end_date as date_fin_planification,
      mr.expected_days as nombre_jours_attendu,
      mr.present_days as nombre_jours_present,
      mr.absent_days as nombre_jours_absent,
      mr.tolerance_days as nombre_jours_tolerance,
      (mr.expected_days - mr.present_days) as ecart,
      mr.status as statut_rapport,
      mr.created_at as date_generation
    FROM monthly_reports mr
    JOIN users u ON u.id = mr.agent_id
    LEFT JOIN villages v ON v.id = u.village_id
    LEFT JOIN arrondissements a ON a.id = v.arrondissement_id
    LEFT JOIN communes c ON c.id = a.commune_id
    LEFT JOIN departements d ON d.id = c.departement_id
    WHERE mr.month_year = ?
    ORDER BY u.name
  `).all(monthYear);

  return reports;
}
