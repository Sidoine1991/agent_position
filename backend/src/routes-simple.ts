import express from 'express';
import { z } from 'zod';
import { db } from './db.js';
import { signToken, comparePassword, hashPassword, verifyToken } from './auth.js';
import { upload, getPublicPhotoPath } from './storage.js';
import { getDepartements, getCommunes, getArrondissements, getVillages } from './db-cloud.js';

export const router = express.Router();

// Auth middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = header.slice(7);
  
  try {
    const payload = verifyToken(token);
    (req as any).user = payload;
    next();
  } catch (error) {
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
    role: z.enum(['agent', 'supervisor', 'admin']).default('agent')
  });
  
  try {
    const data = schema.parse(req.body);
    const passwordHash = hashPassword(data.password);
    
    const sql = `INSERT INTO users (name, email, password_hash, first_name, last_name, phone, role) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [data.name, data.email, passwordHash, data.first_name, data.last_name, data.phone, data.role], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      
      const token = signToken({ userId: this.lastID, role: data.role });
      res.json({ token, user: { id: this.lastID, name: data.name, email: data.email, role: data.role } });
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

router.post('/auth/login', (req, res) => {
  const schema = z.object({ 
    email: z.string().email(), 
    password: z.string().min(1) 
  });
  
  try {
    const data = schema.parse(req.body);
    
    const sql = 'SELECT id, name, email, password_hash, role FROM users WHERE email = ?';
    
    db.get(sql, [data.email], (err, row: any) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row || !comparePassword(data.password, row.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const token = signToken({ userId: row.id, role: row.role });
      res.json({ 
        token, 
        user: { 
          id: row.id, 
          name: row.name, 
          email: row.email, 
          role: row.role 
        } 
      });
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// Profile endpoint
router.get('/profile', requireAuth, (req, res) => {
  const user = (req as any).user;
  res.json(user);
});

// Login endpoint (alias for auth/login)
router.post('/login', (req, res) => {
  const schema = z.object({ 
    email: z.string().email(), 
    password: z.string().min(1) 
  });
  
  try {
    const data = schema.parse(req.body);
    
    const sql = 'SELECT id, name, email, password_hash, role FROM users WHERE email = ?';
    
    db.get(sql, [data.email], (err, row: any) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row || !comparePassword(data.password, row.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const token = signToken({ userId: row.id, role: row.role });
      res.json({ 
        token, 
        user: { 
          id: row.id, 
          name: row.name, 
          email: row.email, 
          role: row.role 
        } 
      });
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// Admin agents endpoint
router.get('/admin/agents', requireAuth, requireRole(['admin', 'supervisor']), (req, res) => {
  const sql = `SELECT id, name, email, role, first_name, last_name, phone, 
               project_name, project_description, planning_start_date, planning_end_date,
               expected_days_per_month, expected_hours_per_month, work_schedule, contract_type,
               reference_lat, reference_lon, tolerance_radius_meters, gps_accuracy, observations, photo_path,
               created_at
               FROM users ORDER BY name`;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Geo endpoints
router.get('/geo/departements', (req, res) => {
  const departements = getDepartements();
  res.json(departements);
});

router.get('/geo/communes/:departementId', (req, res) => {
  const departementId = parseInt(req.params.departementId);
  const communes = getCommunes(departementId);
  res.json(communes);
});

router.get('/geo/arrondissements/:communeId', (req, res) => {
  const communeId = parseInt(req.params.communeId);
  const arrondissements = getArrondissements(communeId);
  res.json(arrondissements);
});

router.get('/geo/villages/:arrondissementId', (req, res) => {
  const arrondissementId = parseInt(req.params.arrondissementId);
  const villages = getVillages(arrondissementId);
  res.json(villages);
});

// Health endpoint
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// Presence endpoints
router.post('/presence/start', requireAuth, upload.single('photo'), (req, res) => {
  try {
    const userId = (req as any).user.userId as number;
    const schema = z.object({ 
      lat: z.coerce.number(), 
      lon: z.coerce.number(), 
      note: z.string().optional(), 
      village_id: z.coerce.number().optional() 
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.format() });
    const { lat, lon, note, village_id } = parse.data;

    // Ensure there is an active mission or create one
    db.get('SELECT id FROM missions WHERE agent_id = ? AND status = ?', [userId, 'active'], (err, mission: any) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      let missionId: number;
      if (!mission) {
        // Create new mission
        db.run(`
          INSERT INTO missions (agent_id, date_start, status, village_id) 
          VALUES (?, datetime('now'), 'active', ?)
        `, [userId, village_id || null], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          missionId = this.lastID;
          processCheckin();
        });
      } else {
        missionId = mission.id;
        processCheckin();
      }
      
      function processCheckin() {
        const filename = (req.file && req.file.filename) || null;
        const photo_path = filename ? getPublicPhotoPath(filename) : null;

        // Record the check-in
        db.run(`
          INSERT INTO checkins (mission_id, lat, lon, photo_path, note, timestamp) 
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `, [missionId, lat, lon, photo_path, note || ''], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.json({ 
            mission_id: missionId, 
            checkin_id: this.lastID,
            message: 'Présence (début) enregistrée avec succès' 
          });
        });
      }
    });
  } catch (error) {
    console.error('Presence start error:', error);
    res.status(500).json({ error: 'Erreur lors de la prise de présence (début): ' + ((error as any)?.message || 'Unknown') });
  }
});

router.post('/presence/end', requireAuth, upload.single('photo'), (req, res) => {
  try {
    const userId = (req as any).user.userId as number;
    const schema = z.object({ 
      lat: z.coerce.number(), 
      lon: z.coerce.number(), 
      note: z.string().optional() 
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.format() });
    const { lat, lon, note } = parse.data;

    // Require an active mission
    db.get('SELECT id FROM missions WHERE agent_id = ? AND status = ?', [userId, 'active'], (err, mission: any) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!mission) {
        return res.status(400).json({ error: 'Aucune mission active pour clôturer la présence' });
      }

      const filename = (req.file && req.file.filename) || null;
      const photo_path = filename ? getPublicPhotoPath(filename) : null;

      // Record the check-in
      db.run(`
        INSERT INTO checkins (mission_id, lat, lon, photo_path, note, timestamp) 
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `, [mission.id, lat, lon, photo_path, note || ''], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // End the mission
        db.run("UPDATE missions SET status='ended', date_end = datetime('now') WHERE id = ?", [mission.id], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.json({ 
            message: 'Présence (fin) enregistrée avec succès' 
          });
        });
      });
    });
  } catch (error) {
    console.error('Presence end error:', error);
    res.status(500).json({ error: 'Erreur lors de la prise de présence (fin): ' + ((error as any)?.message || 'Unknown') });
  }
});

// Mission checkin endpoint
router.post('/mission/checkin', requireAuth, upload.single('photo'), (req, res) => {
  try {
    const schema = z.object({ 
      mission_id: z.coerce.number(), 
      lat: z.coerce.number(), 
      lon: z.coerce.number(), 
      note: z.string().optional() 
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.format() });
    const { mission_id, lat, lon, note } = parse.data;
    const filename = (req.file && req.file.filename) || null;
    const photo_path = filename ? getPublicPhotoPath(filename) : null;
    
    // Enregistrer le check-in
    db.run(`
      INSERT INTO checkins (mission_id, lat, lon, photo_path, note, timestamp) 
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `, [mission_id, lat, lon, photo_path, note || ''], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ 
        checkin_id: this.lastID,
        message: 'Check-in enregistré avec succès' 
      });
    });
  } catch (error) {
    console.error('Checkin error:', error);
    res.status(500).json({ error: 'Erreur lors du check-in' });
  }
});

// Get user missions
router.get('/me/missions', requireAuth, (req, res) => {
  try {
    const userId = (req as any).user.userId as number;
    db.all(`
      SELECT id, date_start, date_end, status, village_id 
      FROM missions 
      WHERE agent_id = ? 
      ORDER BY date_start DESC
    `, [userId], (err, missions) => {
      if (err) {
        console.error('Get missions error:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des missions' });
      }
      res.json(missions);
    });
  } catch (error) {
    console.error('Get missions error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des missions' });
  }
});

// Get mission checkins
router.get('/me/checkins', requireAuth, (req, res) => {
  try {
    const userId = (req as any).user.userId as number;
    db.all(`
      SELECT c.id, c.lat, c.lon, c.photo_path, c.note, c.timestamp, m.id as mission_id
      FROM checkins c
      JOIN missions m ON c.mission_id = m.id
      WHERE m.agent_id = ?
      ORDER BY c.timestamp DESC
    `, [userId], (err, checkins) => {
      if (err) {
        console.error('Get checkins error:', err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des check-ins' });
      }
      res.json(checkins);
    });
  } catch (error) {
    console.error('Get checkins error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des check-ins' });
  }
});
