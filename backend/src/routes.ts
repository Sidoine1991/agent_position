import express from 'express';
import { z } from 'zod';
import { db } from './db.js';
import { signToken, comparePassword, hashPassword, verifyToken } from './auth.js';
import { upload, getPublicPhotoPath } from './storage.js';
import { recordPresenceValidation, generateMonthlyReport, exportMonthlyReport } from './presence-algorithm.js';
import type { Role } from './models.js';

export const router = express.Router();

// Auth middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  console.log('Auth header:', header);
  
  if (!header || !header.startsWith('Bearer ')) {
    console.log('No valid auth header');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = header.slice(7);
  console.log('Token:', token.substring(0, 20) + '...');
  
  try {
    const payload = verifyToken(token);
    console.log('Verified user:', payload);
    (req as any).user = payload;
    next();
  } catch (error) {
    console.log('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(roles: Array<'admin' | 'supervisor'>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user as { role: string } | undefined;
    if (!user || !roles.includes(user.role as any)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Auth endpoints
router.post('/auth/register', (req, res) => {
  const schema = z.object({ 
    name: z.string().min(1), 
    email: z.string().email(), 
    password: z.string().min(6),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    role: z.string().default('agent')
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { name, email, password, first_name, last_name, phone, role } = parse.data;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already used' });
  const password_hash = hashPassword(password);
  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, first_name, last_name, phone, expected_days_per_month, tolerance_radius_meters) 
    VALUES (?, ?, ?, ?, ?, ?, ?, 20, 100)
  `).run(name, email, password_hash, role, first_name || '', last_name || '', phone || '');
  const token = signToken({ userId: info.lastInsertRowid as number, role: role as Role });
  res.json({ token });
});

router.post('/auth/login', (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { email, password } = parse.data;
  const user = db.prepare('SELECT id, password_hash, role FROM users WHERE email = ?').get(email) as any;
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!comparePassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ userId: user.id, role: user.role });
  res.json({ token });
});

// Missions
router.post('/mission/start', requireAuth, (req, res) => {
  try {
    const userId = (req as any).user.userId as number;
    console.log('Starting mission for user:', userId);
    console.log('Request body:', req.body);
    
    const schema = z.object({ village_id: z.number().optional() });
    const parse = schema.safeParse(req.body);
    console.log('Schema parse result:', parse);
    
    const villageId = parse.success && parse.data.village_id ? parse.data.village_id : null;
    console.log('Village ID:', villageId);
    
    // Check if there's already an active mission
    const existingMission = db.prepare('SELECT id FROM missions WHERE agent_id = ? AND status = ?').get(userId, 'active');
    console.log('Existing mission:', existingMission);
    
    if (existingMission) {
      return res.status(400).json({ error: 'Une mission est déjà active' });
    }
    
    const info = db.prepare("INSERT INTO missions (agent_id, date_start, status, village_id) VALUES (?, datetime('now'), 'active', ?)").run(userId, villageId);
    console.log('Mission created:', info);
    
    res.json({ mission_id: info.lastInsertRowid });
  } catch (error: any) {
    console.error('Error starting mission:', error);
    res.status(500).json({ error: 'Erreur lors du démarrage de la mission: ' + (error?.message || 'Unknown') });
  }
});

router.post('/mission/end', requireAuth, (req, res) => {
  const schema = z.object({ mission_id: z.number() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { mission_id } = parse.data;
  db.prepare("UPDATE missions SET status='ended', date_end = datetime('now') WHERE id = ?").run(mission_id);
  res.json({ ok: true });
});

router.post('/mission/checkin', requireAuth, upload.single('photo'), (req, res) => {
  try {
    const schema = z.object({ mission_id: z.coerce.number(), lat: z.coerce.number(), lon: z.coerce.number(), note: z.string().optional() });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.format() });
    const { mission_id, lat, lon, note } = parse.data;
    const filename = (req.file && req.file.filename) || null;
    const photo_path = filename ? getPublicPhotoPath(filename) : null;
    
    // Enregistrer le check-in
    const info = db
      .prepare('INSERT INTO checkins (mission_id, lat, lon, photo_path, note) VALUES (?, ?, ?, ?, ?)')
      .run(mission_id, lat, lon, photo_path, note ?? null);
    
    // Récupérer l'agent_id depuis la mission
    const mission = db.prepare('SELECT agent_id FROM missions WHERE id = ?').get(mission_id) as { agent_id: number };
    if (!mission) return res.status(404).json({ error: 'Mission non trouvée' });
    
    // Valider la présence automatiquement
    const validation = recordPresenceValidation(mission.agent_id, info.lastInsertRowid as number, lat, lon);
    
    res.json({ 
      ok: true, 
      checkin_id: info.lastInsertRowid, 
      photo_path,
      presence_status: validation.status,
      distance_meters: Math.round(validation.distance)
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Erreur lors du check-in' });
  }
});

// Presence-based flow: start presence (creates mission if none active)
router.post('/presence/start', requireAuth, upload.single('photo'), (req, res) => {
  try {
    const userId = (req as any).user.userId as number;
    const schema = z.object({ lat: z.coerce.number(), lon: z.coerce.number(), note: z.string().optional(), village_id: z.coerce.number().optional() });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.format() });
    const { lat, lon, note, village_id } = parse.data;

    // Ensure there is an active mission or create one
    let mission = db.prepare('SELECT id FROM missions WHERE agent_id = ? AND status = ?').get(userId, 'active') as { id: number } | undefined;
    if (!mission) {
      const info = db.prepare("INSERT INTO missions (agent_id, date_start, status, village_id) VALUES (?, datetime('now'), 'active', ?)").run(userId, village_id ?? null);
      mission = { id: info.lastInsertRowid as number };
    }

    const filename = (req.file && req.file.filename) || null;
    const photo_path = filename ? getPublicPhotoPath(filename) : null;

    // If agent has no reference point yet, initialize it with this first presence position
    const ref = db.prepare('SELECT reference_lat AS lat, reference_lon AS lon, tolerance_radius_meters AS tol FROM users WHERE id = ?').get(userId) as any;
    if (!ref || ref.lat == null || ref.lon == null) {
      db.prepare('UPDATE users SET reference_lat = ?, reference_lon = ? WHERE id = ?').run(lat, lon, userId);
    }

    // Record a checkin at start
    const checkin = db
      .prepare('INSERT INTO checkins (mission_id, lat, lon, photo_path, note) VALUES (?, ?, ?, ?, ?)')
      .run(mission.id, lat, lon, photo_path, note ? `START: ${note}` : 'START');

    // Validate presence
    const validation = recordPresenceValidation(userId, checkin.lastInsertRowid as number, lat, lon);

    res.json({ ok: true, mission_id: mission.id, presence_status: validation.status, distance_meters: Math.round(validation.distance), photo_path });
  } catch (error) {
    console.error('Presence start error:', error);
    res.status(500).json({ error: 'Erreur lors de la prise de présence (début): ' + ((error as any)?.message || 'Unknown') });
  }
});

// Presence-based flow: end presence (ends mission if active)
router.post('/presence/end', requireAuth, upload.single('photo'), (req, res) => {
  try {
    const userId = (req as any).user.userId as number;
    const schema = z.object({ lat: z.coerce.number(), lon: z.coerce.number(), note: z.string().optional() });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.format() });
    const { lat, lon, note } = parse.data;

    // Require an active mission
    const mission = db.prepare('SELECT id FROM missions WHERE agent_id = ? AND status = ?').get(userId, 'active') as { id: number } | undefined;
    if (!mission) return res.status(400).json({ error: 'Aucune mission active pour clôturer la présence' });

    const filename = (req.file && req.file.filename) || null;
    const photo_path = filename ? getPublicPhotoPath(filename) : null;

    // Record a checkin at end
    const checkin = db
      .prepare('INSERT INTO checkins (mission_id, lat, lon, photo_path, note) VALUES (?, ?, ?, ?, ?)')
      .run(mission.id, lat, lon, photo_path, note ? `END: ${note}` : 'END');

    // Validate presence
    const validation = recordPresenceValidation(userId, checkin.lastInsertRowid as number, lat, lon);

    // End mission
    db.prepare("UPDATE missions SET status='ended', date_end = datetime('now') WHERE id = ?").run(mission.id);

    res.json({ ok: true, mission_id: mission.id, presence_status: validation.status, distance_meters: Math.round(validation.distance), photo_path });
  } catch (error) {
    console.error('Presence end error:', error);
    res.status(500).json({ error: 'Erreur lors de la prise de présence (fin): ' + ((error as any)?.message || 'Unknown') });
  }
});

router.get('/mission/:missionId/checkins', requireAuth, (req, res) => {
  const missionId = Number(req.params.missionId);
  const rows = db.prepare('SELECT * FROM checkins WHERE mission_id = ? ORDER BY timestamp ASC').all(missionId);
  res.json(rows);
});

router.get('/me/missions', requireAuth, (req, res) => {
  const userId = (req as any).user.userId as number;
  const rows = db.prepare('SELECT * FROM missions WHERE agent_id = ? ORDER BY date_start DESC').all(userId);
  res.json(rows);
});

// Profil de l'agent
router.get('/me/profile', requireAuth, (req, res) => {
  const userId = (req as any).user.userId as number;
  const profile = db.prepare(`
    SELECT u.*, 
           v.name as village_name,
           a.name as arrondissement_name,
           c.name as commune_name,
           d.name as departement_name,
           CONCAT(d.name, ' / ', c.name, ' / ', a.name, ' / ', v.name) as zone_name
    FROM users u
    LEFT JOIN villages v ON v.id = u.village_id
    LEFT JOIN arrondissements a ON a.id = v.arrondissement_id
    LEFT JOIN communes c ON c.id = a.commune_id
    LEFT JOIN departements d ON d.id = c.departement_id
    WHERE u.id = ?
  `).get(userId);
  res.json(profile);
});

// Geo hierarchy endpoints (public access)
router.get('/geo/departements', (_req, res) => {
  const rows = db.prepare('SELECT id, name FROM departements ORDER BY name').all();
  res.json(rows);
});

router.get('/geo/communes', (req, res) => {
  const depId = Number(req.query.departement_id);
  const rows = db.prepare('SELECT id, name FROM communes WHERE departement_id = ? ORDER BY name').all(depId);
  res.json(rows);
});

router.get('/geo/arrondissements', (req, res) => {
  const communeId = Number(req.query.commune_id);
  const rows = db.prepare('SELECT id, name FROM arrondissements WHERE commune_id = ? ORDER BY name').all(communeId);
  res.json(rows);
});

router.get('/geo/villages', (req, res) => {
  const arrId = Number(req.query.arrondissement_id);
  const rows = db.prepare('SELECT id, name FROM villages WHERE arrondissement_id = ? ORDER BY name').all(arrId);
  res.json(rows);
});

// Admin: seed or create geo entries
router.post('/geo/seed', requireAuth, (req, res) => {
  const role = (req as any).user.role as string;
  if (role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const schema = z.object({
    departements: z.array(z.object({ name: z.string(), communes: z.array(z.object({ name: z.string(), arrondissements: z.array(z.object({ name: z.string(), villages: z.array(z.object({ name: z.string() })) })) })) }))
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const tx = db.transaction((payload: any) => {
    for (const d of payload.departements) {
      const dInfo = db.prepare('INSERT OR IGNORE INTO departements (name) VALUES (?)').run(d.name);
      const depRow = db.prepare('SELECT id FROM departements WHERE name = ?').get(d.name) as any;
      for (const c of d.communes) {
        db.prepare('INSERT OR IGNORE INTO communes (departement_id, name) VALUES (?, ?)').run(depRow.id, c.name);
        const comRow = db.prepare('SELECT id FROM communes WHERE departement_id = ? AND name = ?').get(depRow.id, c.name) as any;
        for (const a of c.arrondissements) {
          db.prepare('INSERT OR IGNORE INTO arrondissements (commune_id, name) VALUES (?, ?)').run(comRow.id, a.name);
          const arrRow = db.prepare('SELECT id FROM arrondissements WHERE commune_id = ? AND name = ?').get(comRow.id, a.name) as any;
          for (const v of a.villages) {
            db.prepare('INSERT OR IGNORE INTO villages (arrondissement_id, name) VALUES (?, ?)').run(arrRow.id, v.name);
          }
        }
      }
    }
  });
  tx(parse.data);
  res.json({ ok: true });
});

// Admin/Supervisor: list agents (avec authentification)
router.get('/admin/agents', requireAuth, requireRole(['admin', 'supervisor']), (_req, res) => {
  const rows = db.prepare("SELECT id, name, email, role FROM users ORDER BY name").all();
  res.json(rows);
});

// Endpoint public pour l'accès libre aux agents (sans authentification)
router.get('/admin/agents/public', (_req, res) => {
  const rows = db.prepare(`
    SELECT 
      id, name, email, role, first_name, last_name, phone,
      project_name, project_description, planning_start_date, planning_end_date,
      expected_days_per_month, expected_hours_per_month, work_schedule, contract_type,
      reference_lat, reference_lon, tolerance_radius_meters, gps_accuracy, observations, photo_path,
      created_at
    FROM users 
    ORDER BY name
  `).all();
  res.json(rows);
});

// Admin: create agent
router.post('/admin/agents', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  try {
    console.log('📥 Requête reçue pour créer un agent');
    console.log('📦 Headers:', req.headers);
    console.log('📋 Body:', req.body);
    console.log('🔍 Body type:', typeof req.body);
    console.log('🔍 Body keys:', req.body ? Object.keys(req.body) : 'undefined');
    
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6).default('Agent@123'),
      role: z.enum(['agent','supervisor','admin']).default('agent'),
      phone: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      project_name: z.string().optional(),
      project_description: z.string().optional(),
      planning_start_date: z.string().optional(),
      planning_end_date: z.string().optional(),
      village_id: z.coerce.number().optional(),
      expected_days_per_month: z.coerce.number().optional(),
      expected_hours_per_month: z.coerce.number().optional(),
      work_schedule: z.string().optional(),
      contract_type: z.string().optional(),
      tolerance_radius_meters: z.coerce.number().optional(),
      reference_lat: z.coerce.number().optional(),
      reference_lon: z.coerce.number().optional(),
      gps_accuracy: z.string().optional(),
      observations: z.string().optional(),
    });
    
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      console.error('Validation error:', parse.error.format());
      return res.status(400).json({ error: parse.error.format() });
    }
    
    const data = parse.data;
    console.log('Creating agent with data:', data);
    
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
    if (exists) return res.status(409).json({ error: 'Email déjà utilisé' });
    
    const info = db.prepare(`
      INSERT INTO users (
        name, email, password_hash, role, phone, first_name, last_name,
        project_name, project_description, planning_start_date, planning_end_date, village_id,
        expected_days_per_month, expected_hours_per_month, work_schedule, contract_type,
        tolerance_radius_meters, reference_lat, reference_lon, gps_accuracy, observations
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name,
      data.email,
      hashPassword(data.password),
      data.role,
      data.phone || '',
      data.first_name || '',
      data.last_name || '',
      data.project_name || null,
      data.project_description || null,
      data.planning_start_date || null,
      data.planning_end_date || null,
      data.village_id || null,
      data.expected_days_per_month || 20,
      data.expected_hours_per_month || 160,
      data.work_schedule || null,
      data.contract_type || null,
      data.tolerance_radius_meters || 100,
      data.reference_lat || null,
      data.reference_lon || null,
      data.gps_accuracy || 'medium',
      data.observations || null
    );
    
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'agent' });
  }
});

// Admin: update agent basic fields
router.put('/admin/agents/:id', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    role: z.enum(['agent','supervisor','admin']).optional(),
    project_name: z.string().optional(),
    planning_start_date: z.string().optional(),
    planning_end_date: z.string().optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const fields = parse.data as any;
  const keys = Object.keys(fields);
  if (!keys.length) return res.json({ ok: true });
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = keys.map(k => fields[k]);
  db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...vals, id);
  res.json({ ok: true });
});

// Admin: delete agent
router.delete('/admin/agents/:id', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Admin: reset one agent password
router.post('/admin/agents/:id/reset-password', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({ new_password: z.string().min(6) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND role = "agent"').run(hashPassword(parse.data.new_password), id);
  res.json({ ok: true });
});

// Admin: reset all agents passwords
router.post('/admin/agents/reset-all-passwords', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const schema = z.object({ new_password: z.string().min(6).default('Agent@123') });
  const parse = schema.safeParse(req.body || {});
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const hash = hashPassword(parse.data.new_password);
  db.prepare('UPDATE users SET password_hash = ? WHERE role = "agent"').run(hash);
  res.json({ ok: true });
});

// Admin: delete all agents (keep admins/supervisors)
router.post('/admin/agents/delete-all', requireAuth, requireRole(['admin', 'supervisor']), (_req, res) => {
  db.prepare("DELETE FROM users WHERE role = 'agent'").run();
  res.json({ ok: true });
});

// Admin: reset admin password
router.post('/admin/reset-admin', requireAuth, requireRole(['admin']), (req, res) => {
  const schema = z.object({ email: z.string().email(), new_password: z.string().min(8) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  const { email, new_password } = parse.data;
  const info = db.prepare('UPDATE users SET password_hash = ? WHERE email = ? AND role = "admin"').run(hashPassword(new_password), email);
  if (info.changes === 0) return res.status(404).json({ error: 'Admin non trouvé' });
  res.json({ ok: true });
});

// Admin/Supervisor: checkins with filters
router.get('/admin/checkins', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const date = (req.query.date as string) || undefined; // YYYY-MM-DD
  const agentId = req.query.agent_id ? Number(req.query.agent_id) : undefined;
  const villageId = req.query.village_id ? Number(req.query.village_id) : undefined;
  const conditions: string[] = [];
  const params: any[] = [];
  if (date) { conditions.push("date(c.timestamp) = date(?)"); params.push(date); }
  if (agentId) { conditions.push("m.agent_id = ?"); params.push(agentId); }
  if (villageId) { conditions.push("m.village_id = ?"); params.push(villageId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT c.id, c.mission_id, c.lat, c.lon, c.photo_path, c.note, c.timestamp,
           m.agent_id, u.name as agent_name, m.village_id,
           v.name as village_name, a.name as arrondissement_name, co.name as commune_name, d.name as departement_name
    FROM checkins c
    JOIN missions m ON m.id = c.mission_id
    JOIN users u ON u.id = m.agent_id
    LEFT JOIN villages v ON v.id = m.village_id
    LEFT JOIN arrondissements a ON a.id = v.arrondissement_id
    LEFT JOIN communes co ON co.id = a.commune_id
    LEFT JOIN departements d ON d.id = co.departement_id
    ${where}
    ORDER BY c.timestamp ASC
  `;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Admin/Supervisor: latest checkin per agent (for map pins)
router.get('/admin/checkins/latest', requireAuth, requireRole(['admin', 'supervisor']), (_req, res) => {
  const sql = `
    WITH last_per_agent AS (
      SELECT m.agent_id, MAX(c.timestamp) AS last_ts
      FROM checkins c
      JOIN missions m ON m.id = c.mission_id
      GROUP BY m.agent_id
    )
    SELECT c.id, c.mission_id, c.lat, c.lon, c.photo_path, c.note, c.timestamp,
           m.agent_id, u.name as agent_name, u.phone,
           v.name as village_name, a.name as arrondissement_name, co.name as commune_name, d.name as departement_name
    FROM last_per_agent l
    JOIN missions m ON m.agent_id = l.agent_id
    JOIN checkins c ON c.mission_id = m.id AND c.timestamp = l.last_ts
    JOIN users u ON u.id = m.agent_id
    LEFT JOIN villages v ON v.id = m.village_id
    LEFT JOIN arrondissements a ON a.id = v.arrondissement_id
    LEFT JOIN communes co ON co.id = a.commune_id
    LEFT JOIN departements d ON d.id = co.departement_id
    ORDER BY c.timestamp DESC
  `;
  const rows = db.prepare(sql).all();
  res.json(rows);
});

// Admin/Supervisor: agent dossier (missions, checkins, presence)
router.get('/admin/agent/:agentId/dossier', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const agentId = Number(req.params.agentId);
  const from = (req.query.from as string) || undefined; // YYYY-MM-DD
  const to = (req.query.to as string) || undefined;     // YYYY-MM-DD

  // Agent info
  const agent = db.prepare(`
    SELECT u.id, u.name, u.phone, u.role, u.project_name, u.planning_start_date, u.planning_end_date,
           u.reference_lat, u.reference_lon, u.tolerance_radius_meters,
           v.name AS village_name, a.name AS arrondissement_name, c.name AS commune_name, d.name AS departement_name
    FROM users u
    LEFT JOIN villages v ON v.id = u.village_id
    LEFT JOIN arrondissements a ON a.id = v.arrondissement_id
    LEFT JOIN communes c ON c.id = a.commune_id
    LEFT JOIN departements d ON d.id = c.departement_id
    WHERE u.id = ?
  `).get(agentId);

  if (!agent) return res.status(404).json({ error: 'Agent non trouvé' });

  const dateFilter = (alias: string) => {
    const conds: string[] = [];
    const params: any[] = [];
    if (from) { conds.push(`date(${alias}) >= date(?)`); params.push(from); }
    if (to)   { conds.push(`date(${alias}) <= date(?)`); params.push(to); }
    return { where: conds.length ? `AND ${conds.join(' AND ')}` : '', params };
  };

  // Missions (with optional date filter on date_start/date_end range)
  const missions = db.prepare(
    `SELECT * FROM missions WHERE agent_id = ? ORDER BY date_start DESC`
  ).all(agentId);

  // Checkins (filtered by date range if provided)
  const cf = dateFilter('c.timestamp');
  const checkinsSql = `
    SELECT c.*, m.village_id FROM checkins c
    JOIN missions m ON m.id = c.mission_id
    WHERE m.agent_id = ? ${cf.where}
    ORDER BY c.timestamp ASC
  `;
  const checkins = db.prepare(checkinsSql).all(agentId, ...cf.params);

  // Presence records (filtered)
  const pf = dateFilter('created_at');
  const presence = db.prepare(
    `SELECT * FROM presence_records WHERE agent_id = ? ${pf.where} ORDER BY created_at ASC`
  ).all(agentId, ...pf.params);

  res.json({ agent, missions, checkins, presence });
});

// CSV export
router.get('/admin/export/checkins.csv', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const date = (req.query.date as string) || undefined;
  const agentId = req.query.agent_id ? Number(req.query.agent_id) : undefined;
  const villageId = req.query.village_id ? Number(req.query.village_id) : undefined;
  const conditions: string[] = [];
  const params: any[] = [];
  if (date) { conditions.push("date(c.timestamp) = date(?)"); params.push(date); }
  if (agentId) { conditions.push("m.agent_id = ?"); params.push(agentId); }
  if (villageId) { conditions.push("m.village_id = ?"); params.push(villageId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT c.timestamp, u.name as agent, u.phone, d.name as departement, co.name as commune, a.name as arrondissement, v.name as village,
           c.lat, c.lon, c.note, c.photo_path, pr.status as presence_status, pr.distance_meters
    FROM checkins c
    JOIN missions m ON m.id = c.mission_id
    JOIN users u ON u.id = m.agent_id
    LEFT JOIN villages v ON v.id = m.village_id
    LEFT JOIN arrondissements a ON a.id = v.arrondissement_id
    LEFT JOIN communes co ON co.id = a.commune_id
    LEFT JOIN departements d ON d.id = co.departement_id
    LEFT JOIN presence_records pr ON pr.checkin_id = c.id
    ${where}
    ORDER BY c.timestamp ASC
  `;
  const rows = db.prepare(sql).all(...params) as any[];
  const header = ['Date_Heure','Agent','Telephone','Departement','Commune','Arrondissement','Village','Latitude','Longitude','Note','Photo','Statut_Presence','Distance_Reference_M'];
  const csv = [header.join(',')].concat(rows.map(r => header.map(h => {
    const key = h.toLowerCase().replace(/_/g, '_');
    const value = r[key] ?? '';
    return String(value).replace(/"/g,'""');
  }).map(v => /[",\n]/.test(v) ? '"'+v+'"' : v).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="rapport-presence-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
});

// TXT export (format texte lisible)
router.get('/admin/export/checkins.txt', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const date = (req.query.date as string) || undefined;
  const agentId = req.query.agent_id ? Number(req.query.agent_id) : undefined;
  const villageId = req.query.village_id ? Number(req.query.village_id) : undefined;
  const conditions: string[] = [];
  const params: any[] = [];
  if (date) { conditions.push("date(c.timestamp) = date(?)"); params.push(date); }
  if (agentId) { conditions.push("m.agent_id = ?"); params.push(agentId); }
  if (villageId) { conditions.push("m.village_id = ?"); params.push(villageId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT c.timestamp, u.name as agent, u.phone, d.name as departement, co.name as commune, a.name as arrondissement, v.name as village,
           c.lat, c.lon, c.note, c.photo_path, pr.status as presence_status, pr.distance_meters
    FROM checkins c
    JOIN missions m ON m.id = c.mission_id
    JOIN users u ON u.id = m.agent_id
    LEFT JOIN villages v ON v.id = m.village_id
    LEFT JOIN arrondissements a ON a.id = v.arrondissement_id
    LEFT JOIN communes co ON co.id = a.commune_id
    LEFT JOIN departements d ON d.id = co.departement_id
    LEFT JOIN presence_records pr ON pr.checkin_id = c.id
    ${where}
    ORDER BY c.timestamp ASC
  `;
  const rows = db.prepare(sql).all(...params) as any[];
  
  // Create readable TXT format
  let txt = `RAPPORT DE PRÉSENCE - CCRB\n`;
  txt += `Généré le: ${new Date().toLocaleString('fr-FR')}\n`;
  txt += `Nombre d'enregistrements: ${rows.length}\n`;
  txt += `${'='.repeat(80)}\n\n`;
  
  for (const r of rows) {
    txt += `📅 DATE: ${r.timestamp || 'N/A'}\n`;
    txt += `👤 AGENT: ${r.agent || 'N/A'}\n`;
    txt += `📞 TÉLÉPHONE: ${r.phone || 'N/A'}\n`;
    txt += `📍 LOCALISATION: ${r.departement || ''} / ${r.commune || ''} / ${r.arrondissement || ''} / ${r.village || ''}\n`;
    txt += `🌍 COORDONNÉES GPS: ${r.lat || 'N/A'}, ${r.lon || 'N/A'}\n`;
    txt += `✅ STATUT PRÉSENCE: ${r.presence_status || 'Non validé'}\n`;
    txt += `📏 DISTANCE RÉFÉRENCE: ${r.distance_meters || 'N/A'} mètres\n`;
    txt += `📝 NOTE: ${r.note || 'Aucune note'}\n`;
    if (r.photo_path) {
      txt += `📷 PHOTO: ${r.photo_path}\n`;
    }
    txt += `${'-'.repeat(60)}\n\n`;
  }
  
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="rapport-presence-${new Date().toISOString().split('T')[0]}.txt"`);
  res.send(txt);
});

// Export rapport mensuel Excel
router.get('/admin/export/monthly-report.csv', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const monthYear = req.query.month as string;
  if (!monthYear) return res.status(400).json({ error: 'Paramètre month requis (format: YYYY-MM)' });
  
  try {
    const reports = exportMonthlyReport(monthYear);
    const header = [
      'Nom et Prénom Agent', 'Téléphone', 'Statut Agent', 'Département', 'Commune', 
      'Arrondissement', 'Village Intervention', 'Projet Intervention', 
      'Date Début Planification', 'Date Fin Planification', 'Nombre Jours Attendu',
      'Nombre Jours Présent', 'Nombre Jours Absent', 'Nombre Jours Tolérance',
      'Écart', 'Statut Rapport', 'Date Génération'
    ];
    
    const csv = [header.join(',')].concat(
      reports.map(r => header.map(h => {
        const value = r[h.replace(/\s+/g, '_').toLowerCase()] || '';
        return String(value).replace(/"/g,'""');
      }).map(v => /[",\n]/.test(v) ? '"'+v+'"' : v).join(','))
    ).join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rapport-presence-${monthYear}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

// Générer rapport mensuel
router.post('/admin/generate-monthly-report', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const schema = z.object({ month_year: z.string() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  
  try {
    // Générer les rapports pour tous les agents
    const agents = db.prepare('SELECT id FROM users WHERE role = ?').all('agent') as { id: number }[];
    for (const agent of agents) {
      generateMonthlyReport(agent.id, parse.data.month_year);
    }
    res.json({ ok: true, message: 'Rapport mensuel généré avec succès' });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du rapport' });
  }
});

// Configurer le point de référence GPS pour un agent
router.post('/admin/set-reference-point', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const schema = z.object({ 
    agent_id: z.coerce.number(), 
    lat: z.coerce.number(), 
    lon: z.coerce.number(),
    tolerance_radius: z.coerce.number().optional().default(100)
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });
  
  try {
    const { agent_id, lat, lon, tolerance_radius } = parse.data;
    db.prepare(`
      UPDATE users 
      SET reference_lat = ?, reference_lon = ?, tolerance_radius_meters = ?
      WHERE id = ? AND role = 'agent'
    `).run(lat, lon, tolerance_radius, agent_id);
    
    res.json({ ok: true, message: 'Point de référence configuré avec succès' });
  } catch (error) {
    console.error('Set reference point error:', error);
    res.status(500).json({ error: 'Erreur lors de la configuration du point de référence' });
  }
});

// Créer un utilisateur de test avec données complètes
router.post('/admin/create-test-agent', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  try {
    const password_hash = hashPassword('Test@123');
    const info = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, first_name, last_name, phone, 
                        project_name, project_description, planning_start_date, planning_end_date,
                        expected_days_per_month, tolerance_radius_meters, reference_lat, reference_lon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Agent Test',
      'agent@test.com',
      password_hash,
      'agent',
      'Jean',
      'Dupont',
      '+229 12345678',
      'Projet Riz CCRB',
      'Supervision des unités de démonstration de riz',
      '2024-01-01',
      '2024-12-31',
      20,
      50000, // 50km par défaut
      6.3729, // Latitude Cotonou
      2.3543  // Longitude Cotonou
    );
    
    res.json({ ok: true, agent_id: info.lastInsertRowid, message: 'Agent de test créé avec succès' });
  } catch (error) {
    console.error('Create test agent error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'agent de test' });
  }
});

// Configurer automatiquement les points de référence pour tous les agents
router.post('/admin/setup-reference-points', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  try {
    const { toleranceRadius = 50000 } = req.body; // 50km par défaut
    
    // Récupérer tous les agents avec leur village
    const agents = db.prepare(`
      SELECT u.id, u.name, u.village_id, v.name as village_name
      FROM users u
      LEFT JOIN villages v ON v.id = u.village_id
      WHERE u.role = 'agent'
    `).all() as any[];
    
    let updated = 0;
    const villageCoords: { [key: number]: { lat: number, lon: number } } = {
      // Coordonnées approximatives de quelques villes du Bénin
      1: { lat: 6.3729, lon: 2.3543 }, // Cotonou
      2: { lat: 6.4969, lon: 2.6036 }, // Porto-Novo
      3: { lat: 7.1861, lon: 1.9911 }, // Abomey
      4: { lat: 9.3077, lon: 2.3158 }, // Parakou
      5: { lat: 6.3600, lon: 2.4200 }, // Ouidah
    };
    
    for (const agent of agents) {
      if (agent.village_id && villageCoords[agent.village_id]) {
        const coords = villageCoords[agent.village_id];
        if (coords) {
          db.prepare(`
            UPDATE users 
            SET reference_lat = ?, reference_lon = ?, tolerance_radius_meters = ?
            WHERE id = ?
          `).run(coords.lat, coords.lon, toleranceRadius, agent.id);
          updated++;
        }
      }
    }
    
    res.json({ 
      ok: true, 
      message: `${updated} agents mis à jour avec leurs points de référence`,
      updated_count: updated,
      total_agents: agents.length
    });
  } catch (error) {
    console.error('Setup reference points error:', error);
    res.status(500).json({ error: 'Erreur lors de la configuration des points de référence' });
  }
});

// Valider manuellement la présence d'un check-in
router.post('/admin/validate-presence/:checkinId', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  try {
    const checkinId = Number(req.params.checkinId);
    const { status, notes } = req.body;
    
    // Récupérer le check-in
    const checkin = db.prepare(`
      SELECT c.*, m.agent_id
      FROM checkins c
      JOIN missions m ON m.id = c.mission_id
      WHERE c.id = ?
    `).get(checkinId) as any;
    
    if (!checkin) {
      return res.status(404).json({ error: 'Check-in non trouvé' });
    }
    
    // Mettre à jour le statut de présence
    db.prepare(`
      UPDATE presence_records 
      SET status = ?, notes = ?, validated_by = ?, validated_at = datetime('now')
      WHERE checkin_id = ?
    `).run(status, notes, (req as any).user.userId, checkinId);
    
    res.json({ ok: true, message: 'Présence validée avec succès' });
  } catch (error) {
    console.error('Validate presence error:', error);
    res.status(500).json({ error: 'Erreur lors de la validation de la présence' });
  }
});

// Endpoint pour lister tous les agents (admin seulement)
router.get('/admin/agents', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const agents = db.prepare(`
      SELECT 
        id, name, email, first_name, last_name, phone, role, status,
        project_name, project_description, planning_start_date, planning_end_date,
        expected_days_per_month, expected_hours_per_month, work_schedule, contract_type,
        ref_lat, ref_lon, tolerance, gps_accuracy, observations, photo_path,
        departement, commune, arrondissement, village,
        created_at, updated_at
      FROM users 
      ORDER BY created_at DESC
    `).all();
    
    res.json(agents);
  } catch (error) {
    console.error('Erreur récupération agents:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour supprimer un agent (admin seulement)
router.delete('/admin/agents/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que l'agent existe
    const agent = db.prepare('SELECT id, name FROM users WHERE id = ?').get(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent non trouvé' });
    }
    
    // Supprimer l'agent
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Agent non trouvé' });
    }
    
    res.json({ message: 'Agent supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression agent:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour exporter les agents en format texte
router.get('/admin/export/agents.txt', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const agents = db.prepare(`
      SELECT 
        name, email, first_name, last_name, phone, role, status,
        project_name, departement, commune, arrondissement, village,
        planning_start_date, planning_end_date, expected_days_per_month,
        work_schedule, contract_type, observations, created_at
      FROM users 
      ORDER BY created_at DESC
    `).all();
    
    let content = 'RAPPORT DES AGENTS CCRB\n';
    content += '='.repeat(50) + '\n\n';
    content += `Généré le: ${new Date().toLocaleString('fr-FR')}\n`;
    content += `Total agents: ${agents.length}\n\n`;
    
    agents.forEach((agent, index) => {
      content += `${index + 1}. ${agent.name}\n`;
      content += `   Email: ${agent.email}\n`;
      content += `   Téléphone: ${agent.phone || 'Non renseigné'}\n`;
      content += `   Rôle: ${agent.role}\n`;
      content += `   Statut: ${agent.status || 'Actif'}\n`;
      content += `   Projet: ${agent.project_name || 'Non renseigné'}\n`;
      content += `   Localisation: ${agent.departement || ''} - ${agent.commune || ''} - ${agent.arrondissement || ''} - ${agent.village || ''}\n`;
      content += `   Planification: ${agent.planning_start_date || ''} au ${agent.planning_end_date || ''}\n`;
      content += `   Jours/mois: ${agent.expected_days_per_month || 'Non renseigné'}\n`;
      content += `   Horaires: ${agent.work_schedule || 'Non renseigné'}\n`;
      content += `   Contrat: ${agent.contract_type || 'Non renseigné'}\n`;
      content += `   Observations: ${agent.observations || 'Aucune'}\n`;
      content += `   Créé le: ${new Date(agent.created_at).toLocaleString('fr-FR')}\n`;
      content += '\n' + '-'.repeat(40) + '\n\n';
    });
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="agents_ccrb_${new Date().toISOString().split('T')[0]}.txt"`);
    res.send(content);
    
  } catch (error) {
    console.error('Erreur export agents:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


