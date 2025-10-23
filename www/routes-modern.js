const express = require('express');
const { z } = require('zod');
const { db } = require('./db');
const { signToken, comparePassword, hashPassword, verifyToken } = require('./auth');
const { upload, getPublicPhotoPath } = require('./storage');
const { getDepartements, getCommunes, getArrondissements, getVillages } = require('./db-cloud');

const router = express.Router();

// Auth middleware
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = header.slice(7);
  
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Utils: haversine distance (meters)
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = (v) => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function getZoneForUser(db, userId, zoneId) {
  if (!zoneId) return null;
  const res = await db.query(`SELECT zones FROM users WHERE id = $1`, [userId]);
  const zones = res.rows?.[0]?.zones || [];
  const zid = Number(zoneId);
  const found = (zones || []).find(z => Number(z.id ?? z.temp_id ?? -1) === zid);
  return found || null;
}

// ===== AUTHENTIFICATION =====

// Inscription
router.post('/auth/register', async (req, res) => {
  const schema = z.object({ 
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email(), 
    password: z.string().min(6),
    phone: z.string().optional(),
    role: z.enum(['agent', 'supervisor', 'admin']).default('agent'),
    project_name: z.string().optional(),
    planning_start_date: z.string().optional(),
    planning_end_date: z.string().optional(),
    expected_days_per_month: z.number().optional(),
    expected_hours_per_month: z.number().optional(),
    zones: z.array(z.object({
      id: z.number().optional(),
      name: z.string().optional(),
      departement: z.string().optional(),
      commune: z.string().optional(),
      arrondissement: z.string().optional(),
      village: z.string().optional(),
      reference_lat: z.number().nullable().optional(),
      reference_lon: z.number().nullable().optional(),
      tolerance_radius_meters: z.number().optional()
    })).optional()
  });
  
  try {
    const data = schema.parse(req.body);
    
    // Vérifier si l'email existe déjà
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }
    
    // Hasher le mot de passe
    const hashedPassword = await hashPassword(data.password);
    
    // Créer l'utilisateur
    const result = await db.query(`
      INSERT INTO users (first_name, last_name, email, password, phone, role, project_name, 
                        planning_start_date, planning_end_date, expected_days_per_month, 
                        expected_hours_per_month, is_active, created_at, zones)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), $12::jsonb)
      RETURNING id, first_name, last_name, email, role, phone, project_name, 
                planning_start_date, planning_end_date, expected_days_per_month, 
                expected_hours_per_month, is_active, created_at
    `, [
      data.first_name, data.last_name, data.email, hashedPassword, data.phone, data.role,
      data.project_name, data.planning_start_date, data.planning_end_date,
      data.expected_days_per_month, data.expected_hours_per_month, JSON.stringify(data.zones || [])
    ]);
    
    const user = result.rows[0];
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    
    res.json({
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        project_name: user.project_name,
        planning_start_date: user.planning_start_date,
        planning_end_date: user.planning_end_date,
        expected_days_per_month: user.expected_days_per_month,
        expected_hours_per_month: user.expected_hours_per_month,
        is_active: user.is_active,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// Connexion
router.post('/auth/login', async (req, res) => {
  const schema = z.object({ 
    email: z.string().email(), 
    password: z.string().min(1) 
  });
  
  try {
    const data = schema.parse(req.body);
    
    // Trouver l'utilisateur
    const result = await db.query(`
      SELECT id, first_name, last_name, email, password, phone, role, project_name,
             planning_start_date, planning_end_date, expected_days_per_month,
             expected_hours_per_month, is_active, created_at
      FROM users WHERE email = $1
    `, [data.email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    const user = result.rows[0];
    
    // Vérifier le mot de passe
    const isValid = await comparePassword(data.password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    // Vérifier si l'utilisateur est actif
    if (!user.is_active) {
      return res.status(401).json({ error: 'Compte désactivé' });
    }
    
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    
    res.json({
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        project_name: user.project_name,
        planning_start_date: user.planning_start_date,
        planning_end_date: user.planning_end_date,
        expected_days_per_month: user.expected_days_per_month,
        expected_hours_per_month: user.expected_hours_per_month,
        is_active: user.is_active,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: 'Erreur lors de la connexion' });
  }
});

// ===== PROFIL UTILISATEUR =====

// Obtenir le profil
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(`
      SELECT id, first_name, last_name, email, phone, role, project_name,
             planning_start_date, planning_end_date, expected_days_per_month,
             expected_hours_per_month, is_active, created_at
      FROM users WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement du profil' });
  }
});

// Zones d'intervention (multi-UD)
router.get('/me/zones', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(`SELECT COALESCE(zones, '[]'::jsonb) as zones FROM users WHERE id = $1`, [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const zones = result.rows[0].zones || [];
    res.json({ zones });
  } catch (error) {
    console.error('Get zones error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des zones' });
  }
});

router.put('/me/zones', requireAuth, async (req, res) => {
  const zoneSchema = z.object({
    id: z.number().optional(),
    name: z.string().optional(),
    departement: z.string().optional(),
    commune: z.string().optional(),
    arrondissement: z.string().optional(),
    village: z.string().optional(),
    reference_lat: z.number().nullable().optional(),
    reference_lon: z.number().nullable().optional(),
    tolerance_radius_meters: z.number().optional()
  });
  const schema = z.object({ zones: z.array(zoneSchema) });
  try {
    const data = schema.parse(req.body);
    const userId = req.user.id;
    const payload = JSON.stringify(data.zones || []);
    const result = await db.query(`
      UPDATE users SET zones = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING COALESCE(zones, '[]'::jsonb) as zones
    `, [payload, userId]);
    res.json({ zones: result.rows[0].zones || [] });
  } catch (error) {
    console.error('Update zones error:', error);
    res.status(400).json({ error: 'Erreur lors de la mise à jour des zones' });
  }
});

// Mettre à jour le profil
router.put('/profile', requireAuth, async (req, res) => {
  const schema = z.object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    phone: z.string().optional(),
    project_name: z.string().optional(),
    planning_start_date: z.string().optional(),
    planning_end_date: z.string().optional(),
    expected_days_per_month: z.number().optional(),
    expected_hours_per_month: z.number().optional()
  });
  
  try {
    const data = schema.parse(req.body);
    const userId = req.user.id;
    
    // Construire la requête dynamiquement
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }
    
    values.push(userId);
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, first_name, last_name, email, phone, role, project_name,
                planning_start_date, planning_end_date, expected_days_per_month,
                expected_hours_per_month, is_active, created_at, updated_at
    `;
    
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
});

// Mettre à jour le profil (alias pratique utilisé par le front)
router.post('/me/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const data = req.body || {};
    // Construire la requête dynamiquement à partir des clés fournies
    const allowed = new Set([
      'first_name','last_name','phone','project_name',
      'departement','commune','arrondissement','village',
      'reference_lat','reference_lon','tolerance_radius_meters',
      'contract_start_date','contract_end_date','years_of_service',
      'expected_days_per_month','expected_hours_per_month',
      'planning_start_date','planning_end_date','photo_path'
    ]);
    const updates = [];
    const values = [];
    let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!allowed.has(k)) continue;
      updates.push(`${k} = $${idx}`);
      values.push(v);
      idx++;
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }
    values.push(userId);
    const q = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
    const result = await db.query(q, values);
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('me/profile update error:', error);
    res.status(400).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
});

// ===== GESTION DES MISSIONS =====

// Démarrer une mission
router.post('/presence/start', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const zoneId = (req.body && (req.body.zone_id || req.body.zoneId)) || null;
    
    // Vérifier s'il y a déjà une mission active
    const activeMission = await db.query(`
      SELECT id FROM missions 
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);
    
    if (activeMission.rows.length > 0) {
      return res.status(400).json({ error: 'Une mission est déjà active' });
    }
    
    // Créer une nouvelle mission
    const lat = Number(req.body?.lat ?? req.body?.latitude);
    const lon = Number(req.body?.lon ?? req.body?.longitude);
    const result = await db.query(`
      INSERT INTO missions (user_id, status, start_time, created_at, start_lat, start_lon)
      VALUES ($1, 'active', NOW(), NOW(), $2, $3)
      RETURNING id, user_id, status, start_time, created_at
    `, [userId, Number.isFinite(lat) ? lat : null, Number.isFinite(lon) ? lon : null]);
    
    const mission = result.rows[0];
    // Geofencing calculation if coords provided
    let distance_m = null, tol_m = null, within_tolerance = null;
    try {
      const lat = Number(req.body?.lat ?? req.body?.latitude);
      const lon = Number(req.body?.lon ?? req.body?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon) && zoneId) {
        const z = await getZoneForUser(db, userId, zoneId);
        const refLat = Number(z?.reference_lat ?? z?.ref_lat);
        const refLon = Number(z?.reference_lon ?? z?.ref_lon);
        const tol = Number(z?.tolerance_radius_meters ?? z?.radius_m ?? 1000);
        if (Number.isFinite(refLat) && Number.isFinite(refLon)) {
          distance_m = Math.round(haversineMeters(lat, lon, refLat, refLon));
          tol_m = tol;
          within_tolerance = distance_m <= tol_m;
        }
      }
    } catch {}
    // Echo back selected zone and geofence result
    // Persister un premier check-in de départ dans presences (optionnel) ou juste renvoyer le calcul
    res.json({ ...mission, zone_id: zoneId ? Number(zoneId) : null, distance_m, tol_m, within_tolerance });
  } catch (error) {
    console.error('Start mission error:', error);
    res.status(500).json({ error: 'Erreur lors du démarrage de la mission' });
  }
});

// Terminer une mission
router.post('/presence/end', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const zoneId = (req.body && (req.body.zone_id || req.body.zoneId)) || null;
    let distance_m = null, tol_m = null, within_tolerance = null;
    try {
      const lat = Number(req.body?.lat ?? req.body?.latitude);
      const lon = Number(req.body?.lon ?? req.body?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon) && zoneId) {
        const z = await getZoneForUser(db, userId, zoneId);
        const refLat = Number(z?.reference_lat ?? z?.ref_lat);
        const refLon = Number(z?.reference_lon ?? z?.ref_lon);
        const tol = Number(z?.tolerance_radius_meters ?? z?.radius_m ?? 1000);
        if (Number.isFinite(refLat) && Number.isFinite(refLon)) {
          distance_m = Math.round(haversineMeters(lat, lon, refLat, refLon));
          tol_m = tol;
          within_tolerance = distance_m <= tol_m;
        }
      }
    } catch {}
    
    // Trouver la mission active
    const activeMission = await db.query(`
      SELECT id FROM missions 
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);
    
    if (activeMission.rows.length === 0) {
      return res.status(400).json({ error: 'Aucune mission active trouvée' });
    }
    
    // Terminer la mission
    const lat = Number(req.body?.lat ?? req.body?.latitude);
    const lon = Number(req.body?.lon ?? req.body?.longitude);
    await db.query(`
      UPDATE missions 
      SET status = 'completed', end_time = NOW(), updated_at = NOW(), end_lat = $2, end_lon = $3
      WHERE user_id = $1 AND status = 'active'
    `, [userId, Number.isFinite(lat) ? lat : null, Number.isFinite(lon) ? lon : null]);
    
    res.json({ message: 'Mission terminée avec succès', zone_id: zoneId ? Number(zoneId) : null, distance_m, tol_m, within_tolerance });
  } catch (error) {
    console.error('End mission error:', error);
    res.status(500).json({ error: 'Erreur lors de la fin de la mission' });
  }
});

// Obtenir les missions de l'utilisateur
router.get('/me/missions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(`
      SELECT m.id, m.status, m.start_time, m.end_time, m.created_at,
             COUNT(p.id) as presence_count
      FROM missions m
      LEFT JOIN presences p ON m.id = p.mission_id
      WHERE m.user_id = $1
      GROUP BY m.id, m.status, m.start_time, m.end_time, m.created_at
      ORDER BY m.created_at DESC
    `, [userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get missions error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des missions' });
  }
});

// ===== GESTION DES PRÉSENCES =====

// Envoyer un check-in
router.post('/mission/checkin', requireAuth, async (req, res) => {
  const schema = z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional(),
    note: z.string().optional(),
    photo: z.string().optional(),
    timestamp: z.string().optional(),
    zone_id: z.number().optional()
  });
  
  try {
    const data = schema.parse(req.body);
    const userId = req.user.id;
    
    // Trouver la mission active
    const activeMission = await db.query(`
      SELECT id FROM missions 
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);
    
    if (activeMission.rows.length === 0) {
      return res.status(400).json({ error: 'Aucune mission active. Démarrez une mission d\'abord.' });
    }
    
    const missionId = activeMission.rows[0].id;
    // Geofencing using selected zone
    let distance_m = null, tol_m = null, within_tolerance = null;
    try {
      if (data.zone_id) {
        const z = await getZoneForUser(db, userId, data.zone_id);
        const refLat = Number(z?.reference_lat ?? z?.ref_lat);
        const refLon = Number(z?.reference_lon ?? z?.ref_lon);
        const tol = Number(z?.tolerance_radius_meters ?? z?.radius_m ?? 1000);
        if (Number.isFinite(refLat) && Number.isFinite(refLon)) {
          distance_m = Math.round(haversineMeters(data.latitude, data.longitude, refLat, refLon));
          tol_m = tol;
          within_tolerance = distance_m <= tol_m;
        }
      }
    } catch {}
    
    // Enregistrer la présence (avec zone_id / within_tolerance si migration appliquée)
    const result = await db.query(`
      INSERT INTO presences (mission_id, user_id, latitude, longitude, accuracy, note, photo, created_at, zone_id, within_tolerance, distance_from_reference_m, tolerance_meters)
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamp, NOW()), $9, $10, $11, $12)
      RETURNING id, mission_id, user_id, latitude, longitude, accuracy, note, photo, created_at, zone_id, within_tolerance, distance_from_reference_m, tolerance_meters
    `, [
      missionId, userId, data.latitude, data.longitude, data.accuracy,
      data.note, data.photo, data.timestamp,
      data.zone_id ?? null, within_tolerance, distance_m, tol_m
    ]);
    
    res.json({ ...result.rows[0], zone_id: data.zone_id ?? null, distance_m, tol_m, within_tolerance });
  } catch (error) {
    console.error('Checkin error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la présence' });
  }
});

// Obtenir les statistiques de présence
router.get('/presence/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const month = req.query.month;
    
    let dateFilter = '';
    let params = [userId];
    
    if (month) {
      dateFilter = 'AND DATE_TRUNC(\'month\', p.created_at) = DATE_TRUNC(\'month\', $2::date)';
      params.push(month);
    }
    
    const result = await db.query(`
      SELECT 
        COUNT(CASE WHEN DATE(p.created_at) = CURRENT_DATE THEN 1 END) as today_presences,
        COUNT(CASE WHEN DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as month_presences,
        COUNT(DISTINCT m.id) as total_missions
      FROM presences p
      JOIN missions m ON p.mission_id = m.id
      WHERE m.user_id = $1 ${dateFilter}
    `, params);
    
    res.json(result.rows[0] || { today_presences: 0, month_presences: 0, total_missions: 0 });
  } catch (error) {
    console.error('Presence stats error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des statistiques' });
  }
});

// Obtenir l'historique des présences
router.get('/presence/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const agentId = req.query.agent_id;
    const month = req.query.month;
    
    let whereClause = 'm.user_id = $1';
    let params = [userId];
    let paramIndex = 1;
    
    if (agentId && (req.user.role === 'admin' || req.user.role === 'supervisor')) {
      paramIndex++;
      whereClause = `m.user_id = $${paramIndex}`;
      params = [agentId];
    }
    
    if (month) {
      paramIndex++;
      whereClause += ` AND DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', $${paramIndex}::date)`;
      params.push(month);
    }
    
    const result = await db.query(`
      SELECT p.id, p.latitude, p.longitude, p.accuracy, p.note, p.photo, p.created_at,
             m.id as mission_id, m.status as mission_status
      FROM presences p
      JOIN missions m ON p.mission_id = m.id
      WHERE ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT 100
    `, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Presence history error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement de l\'historique' });
  }
});

// ===== GESTION DES AGENTS (SUPERVISEURS/ADMIN) =====

// Obtenir tous les agents
router.get('/agents', requireAuth, requireRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, first_name, last_name, email, phone, role, project_name,
             planning_start_date, planning_end_date, expected_days_per_month,
             expected_hours_per_month, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des agents' });
  }
});

// Créer un agent
router.post('/agents', requireAuth, requireRole(['admin']), async (req, res) => {
  const schema = z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().optional(),
    role: z.enum(['agent', 'supervisor', 'admin']).default('agent'),
    project_name: z.string().optional(),
    planning_start_date: z.string().optional(),
    planning_end_date: z.string().optional(),
    expected_days_per_month: z.number().optional(),
    expected_hours_per_month: z.number().optional()
  });
  
  try {
    const data = schema.parse(req.body);
    
    // Vérifier si l'email existe déjà
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }
    
    // Hasher le mot de passe
    const hashedPassword = await hashPassword(data.password);
    
    // Créer l'agent
    const result = await db.query(`
      INSERT INTO users (first_name, last_name, email, password, phone, role, project_name,
                        planning_start_date, planning_end_date, expected_days_per_month,
                        expected_hours_per_month, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW())
      RETURNING id, first_name, last_name, email, phone, role, project_name,
                planning_start_date, planning_end_date, expected_days_per_month,
                expected_hours_per_month, is_active, created_at
    `, [
      data.first_name, data.last_name, data.email, hashedPassword, data.phone, data.role,
      data.project_name, data.planning_start_date, data.planning_end_date,
      data.expected_days_per_month, data.expected_hours_per_month
    ]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'agent' });
  }
});

// Mettre à jour un agent
router.put('/agents/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const schema = z.object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    role: z.enum(['agent', 'supervisor', 'admin']).optional(),
    project_name: z.string().optional(),
    planning_start_date: z.string().optional(),
    planning_end_date: z.string().optional(),
    expected_days_per_month: z.number().optional(),
    expected_hours_per_month: z.number().optional(),
    is_active: z.boolean().optional()
  });
  
  try {
    const data = schema.parse(req.body);
    const agentId = req.params.id;
    
    // Construire la requête dynamiquement
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }
    
    values.push(agentId);
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, first_name, last_name, email, phone, role, project_name,
                planning_start_date, planning_end_date, expected_days_per_month,
                expected_hours_per_month, is_active, created_at, updated_at
    `;
    
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'agent' });
  }
});

// Supprimer un agent
router.delete('/agents/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const agentId = req.params.id;
    
    // Vérifier que l'agent existe
    const agent = await db.query('SELECT id FROM users WHERE id = $1', [agentId]);
    if (agent.rows.length === 0) {
      return res.status(404).json({ error: 'Agent non trouvé' });
    }
    
    // Supprimer l'agent (cascade supprimera les missions et présences)
    await db.query('DELETE FROM users WHERE id = $1', [agentId]);
    
    res.json({ message: 'Agent supprimé avec succès' });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'agent' });
  }
});

// ===== RAPPORTS =====

// Obtenir les rapports
router.get('/reports', requireAuth, requireRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const filters = req.query;
    
    // Construire la requête avec filtres
    let whereClause = '1=1';
    const params = [];
    let paramIndex = 1;
    
    if (filters.agent_id) {
      whereClause += ` AND m.user_id = $${paramIndex}`;
      params.push(filters.agent_id);
      paramIndex++;
    }
    
    if (filters.start_date) {
      whereClause += ` AND p.created_at >= $${paramIndex}`;
      params.push(filters.start_date);
      paramIndex++;
    }
    
    if (filters.end_date) {
      whereClause += ` AND p.created_at <= $${paramIndex}`;
      params.push(filters.end_date);
      paramIndex++;
    }
    
    const result = await db.query(`
      SELECT 
        u.id as agent_id,
        u.first_name,
        u.last_name,
        u.email,
        COUNT(p.id) as total_presences,
        COUNT(DISTINCT m.id) as total_missions,
        MIN(p.created_at) as first_presence,
        MAX(p.created_at) as last_presence
      FROM users u
      LEFT JOIN missions m ON u.id = m.user_id
      LEFT JOIN presences p ON m.id = p.mission_id
      WHERE ${whereClause}
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY total_presences DESC
    `, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des rapports' });
  }
});

// Générer un rapport
router.post('/reports/generate', requireAuth, requireRole(['admin', 'supervisor']), async (req, res) => {
  const schema = z.object({
    type: z.enum(['daily', 'monthly', 'agents']),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    agent_id: z.string().optional()
  });
  
  try {
    const data = schema.parse(req.body);
    
    // Logique de génération de rapport selon le type
    let reportData = {};
    
    switch (data.type) {
      case 'daily':
        reportData = await generateDailyReport(data);
        break;
      case 'monthly':
        reportData = await generateMonthlyReport(data);
        break;
      case 'agents':
        reportData = await generateAgentsReport(data);
        break;
    }
    
    res.json(reportData);
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du rapport' });
  }
});

// ===== ADMINISTRATION =====

// Obtenir les statistiques admin
router.get('/admin/stats', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_agents,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_agents,
        COUNT(CASE WHEN role = 'agent' THEN 1 END) as agent_count,
        COUNT(CASE WHEN role = 'supervisor' THEN 1 END) as supervisor_count,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
        (SELECT COUNT(*) FROM presences) as total_presences,
        (SELECT COUNT(*) FROM missions) as total_missions
      FROM users
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des statistiques admin' });
  }
});

// Mettre à jour les paramètres de l'application
router.put('/admin/settings', requireAuth, requireRole(['admin']), async (req, res) => {
  const schema = z.object({
    app_name: z.string().optional(),
    max_accuracy: z.number().optional(),
    work_hours_start: z.string().optional(),
    work_hours_end: z.string().optional(),
    tolerance_minutes: z.number().optional()
  });
  
  try {
    const data = schema.parse(req.body);
    
    // Mettre à jour les paramètres dans la base de données
    // (Implémentation dépendante de votre structure de paramètres)
    
    res.json({ message: 'Paramètres mis à jour avec succès', settings: data });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres' });
  }
});

// ===== DONNÉES GÉOGRAPHIQUES =====

// Obtenir les départements
router.get('/geo/departements', async (req, res) => {
  try {
    const departements = await getDepartements();
    res.json(departements);
  } catch (error) {
    console.error('Get departements error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des départements' });
  }
});

// Obtenir les communes
router.get('/geo/communes', async (req, res) => {
  try {
    const departementId = req.query.departement_id;
    if (!departementId) {
      return res.status(400).json({ error: 'ID du département requis' });
    }
    
    const communes = await getCommunes(departementId);
    res.json(communes);
  } catch (error) {
    console.error('Get communes error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des communes' });
  }
});

// Obtenir les arrondissements
router.get('/geo/arrondissements', async (req, res) => {
  try {
    const communeId = req.query.commune_id;
    if (!communeId) {
      return res.status(400).json({ error: 'ID de la commune requis' });
    }
    
    const arrondissements = await getArrondissements(communeId);
    res.json(arrondissements);
  } catch (error) {
    console.error('Get arrondissements error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des arrondissements' });
  }
});

// Obtenir les villages
router.get('/geo/villages', async (req, res) => {
  try {
    const arrondissementId = req.query.arrondissement_id;
    if (!arrondissementId) {
      return res.status(400).json({ error: 'ID de l\'arrondissement requis' });
    }
    
    const villages = await getVillages(arrondissementId);
    res.json(villages);
  } catch (error) {
    console.error('Get villages error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des villages' });
  }
});

// ===== FONCTIONS UTILITAIRES POUR LES RAPPORTS =====

async function generateDailyReport(data) {
  const result = await db.query(`
    SELECT 
      DATE(p.created_at) as date,
      COUNT(p.id) as total_presences,
      COUNT(DISTINCT m.user_id) as active_agents,
      AVG(p.accuracy) as avg_accuracy
    FROM presences p
    JOIN missions m ON p.mission_id = m.id
    WHERE DATE(p.created_at) = COALESCE($1::date, CURRENT_DATE)
    GROUP BY DATE(p.created_at)
    ORDER BY date DESC
  `, [data.start_date]);
  
  return result.rows;
}

async function generateMonthlyReport(data) {
  const result = await db.query(`
    SELECT 
      DATE_TRUNC('month', p.created_at) as month,
      COUNT(p.id) as total_presences,
      COUNT(DISTINCT m.user_id) as active_agents,
      AVG(p.accuracy) as avg_accuracy
    FROM presences p
    JOIN missions m ON p.mission_id = m.id
    WHERE DATE_TRUNC('month', p.created_at) = COALESCE(DATE_TRUNC('month', $1::date), DATE_TRUNC('month', CURRENT_DATE))
    GROUP BY DATE_TRUNC('month', p.created_at)
    ORDER BY month DESC
  `, [data.start_date]);
  
  return result.rows;
}

async function generateAgentsReport(data) {
  let whereClause = '1=1';
  const params = [];
  let paramIndex = 1;
  
  if (data.agent_id) {
    whereClause += ` AND m.user_id = $${paramIndex}`;
    params.push(data.agent_id);
    paramIndex++;
  }
  
  if (data.start_date) {
    whereClause += ` AND p.created_at >= $${paramIndex}`;
    params.push(data.start_date);
    paramIndex++;
  }
  
  if (data.end_date) {
    whereClause += ` AND p.created_at <= $${paramIndex}`;
    params.push(data.end_date);
    paramIndex++;
  }
  
  const result = await db.query(`
    SELECT 
      u.id as agent_id,
      u.first_name,
      u.last_name,
      u.email,
      COUNT(p.id) as total_presences,
      COUNT(DISTINCT m.id) as total_missions,
      MIN(p.created_at) as first_presence,
      MAX(p.created_at) as last_presence,
      AVG(p.accuracy) as avg_accuracy
    FROM users u
    LEFT JOIN missions m ON u.id = m.user_id
    LEFT JOIN presences p ON m.id = p.mission_id
    WHERE ${whereClause}
    GROUP BY u.id, u.first_name, u.last_name, u.email
    ORDER BY total_presences DESC
  `, params);
  
  return result.rows;
}

export default router;