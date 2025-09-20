import express from 'express';
import { z } from 'zod';
import { db } from './db.js';
import { signToken, comparePassword, hashPassword, verifyToken } from './auth.js';

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
router.get('/me/profile', requireAuth, (req, res) => {
  const user = (req as any).user;
  res.json({ user });
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
  const { getDepartements } = require('./db-cloud.js');
  const departements = getDepartements();
  res.json(departements);
});

router.get('/geo/communes/:departementId', (req, res) => {
  const { getCommunes } = require('./db-cloud.js');
  const departementId = parseInt(req.params.departementId);
  const communes = getCommunes(departementId);
  res.json(communes);
});

router.get('/geo/arrondissements/:communeId', (req, res) => {
  const { getArrondissements } = require('./db-cloud.js');
  const communeId = parseInt(req.params.communeId);
  const arrondissements = getArrondissements(communeId);
  res.json(arrondissements);
});

router.get('/geo/villages/:arrondissementId', (req, res) => {
  const { getVillages } = require('./db-cloud.js');
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
