// Serveur avec base de données PostgreSQL
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const SERPAPI_KEY = process.env.SERPAPI_KEY;

// Configuration JWT avec fallback
const config = require('./config');
const JWT_SECRET = config.JWT_SECRET;

// Configuration multer pour les fichiers (Vercel-compatible)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dbccrb_user:THMWBv1Ur2hP1XyNJExmemPodp0pzeV6@dpg-d37s6vmmcj7s73fs2chg-a.oregon-postgres.render.com/dbccrb',
  ssl: { 
    rejectUnauthorized: false,
    require: true
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test de connexion à la base de données et création des tables
pool.query('SELECT NOW()', async (err, result) => {
  if (err) {
    console.error('❌ Erreur de connexion à la base de données:', err.message);
  } else {
    console.log('✅ Connexion à la base de données réussie:', result.rows[0].now);
    
    // Créer les tables si elles n'existent pas
    try {
      await createTables();
      console.log('✅ Tables de base de données vérifiées/créées');
    } catch (error) {
      console.error('❌ Erreur lors de la création des tables:', error.message);
    }
  }
});

// Fonction pour créer les tables
async function createTables() {
  const schema = `
    -- Table des utilisateurs
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'superviseur', 'agent')),
        phone VARCHAR(20),
        photo_path VARCHAR(500),
        is_verified BOOLEAN DEFAULT FALSE,
        verification_code VARCHAR(6),
        verification_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Table des codes de validation
    CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Table des présences
    CREATE TABLE IF NOT EXISTS presences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        location_lat DECIMAL(10, 8),
        location_lng DECIMAL(11, 8),
        location_name VARCHAR(255),
        notes TEXT,
        photo_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Table des missions
    CREATE TABLE IF NOT EXISTS missions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        start_lat DECIMAL(10, 8),
        start_lon DECIMAL(11, 8),
        end_lat DECIMAL(10, 8),
        end_lon DECIMAL(11, 8),
        departement VARCHAR(100),
        commune VARCHAR(100),
        arrondissement VARCHAR(100),
        village VARCHAR(100),
        note TEXT,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Table des check-ins
    CREATE TABLE IF NOT EXISTS checkins (
        id SERIAL PRIMARY KEY,
        mission_id INTEGER REFERENCES missions(id),
        lat DECIMAL(10, 8),
        lon DECIMAL(11, 8),
        note TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Table des rapports
    CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        content TEXT,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Index pour les performances
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
    CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);
    CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
  `;
  
  await pool.query(schema);
  // Sécurité: ajouter la colonne si l'ancienne table existe déjà sans photo_path
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_path VARCHAR(500)`); } catch {}
  // Colonnes pour unités de référence et paramètres de planification
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reference_lat DECIMAL(10,6)`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reference_lon DECIMAL(10,6)`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tolerance_radius_meters INTEGER`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS departement VARCHAR(100)`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS commune VARCHAR(100)`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS arrondissement VARCHAR(100)`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS village VARCHAR(100)`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS project_name VARCHAR(255)`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS expected_days_per_month INTEGER`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS expected_hours_per_month INTEGER`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS planning_start_date DATE`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS planning_end_date DATE`); } catch {}
}

// Configuration email (à configurer avec vos paramètres SMTP)
const transporter = nodemailer.createTransport({
  service: 'gmail', // ou votre fournisseur email
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendVerificationEmail({ to, name, code }) {
  const emailUserSet = !!process.env.EMAIL_USER;
  const emailPassSet = !!process.env.EMAIL_PASS;
  if (!emailUserSet || !emailPassSet) {
    const msg = 'Configuration email manquante (EMAIL_USER/EMAIL_PASS).';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    } else {
      console.warn('[DEV WARNING]', msg, 'Code:', code, 'destinataire:', to);
      return { mocked: true };
    }
  }
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: 'Code de validation - Presence CCRB',
    html: `
      <h2>Validation de votre compte</h2>
      <p>Bonjour ${name || ''},</p>
      <p>Votre code de validation est : <strong>${code}</strong></p>
      <p>Ce code expire dans 15 minutes.</p>
      <p>Utilisez ce code pour valider votre inscription sur la plateforme.</p>
    `
  });
}

// Middleware
// Sécurisation HTTP de base
try { app.use(helmet()); } catch {}

// Limitation de débit basique (anti-abus)
try {
  const limiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 500, // Augmenté pour Vercel: 500 requêtes par 15 minutes
    standardHeaders: true, 
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Trop de requêtes, veuillez réessayer plus tard.'
    }
  });
  
  // Rate limiting spécial pour les connexions
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Augmenté pour Vercel: 50 tentatives de connexion par 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Trop de tentatives de connexion, veuillez attendre 15 minutes.'
    }
  });
  
  app.use(limiter);
  app.use('/api/login', loginLimiter);
} catch {}

app.use((req, res, next) => {
  try {
    const allowed = new Set([
      process.env.CORS_ORIGIN,
      'https://agent-position.vercel.app',
      'https://www.agent-position.vercel.app'
    ].filter(Boolean));
    const origin = req.headers.origin || '';
    // Si un origin est présent, le renvoyer tel quel (nécessaire avec credentials)
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
    res.header('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
  } catch {}
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

// Utilitaires de validation simples
function isFiniteNumber(n){ return typeof n === 'number' && Number.isFinite(n); }
function isLat(n){ return isFiniteNumber(n) && n >= -90 && n <= 90; }
function isLon(n){ return isFiniteNumber(n) && n >= -180 && n <= 180; }

// Routes pour toutes les pages HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'dashboard.html'));
});

app.get('/agents.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'agents.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'admin.html'));
});

app.get('/admin-agents.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'admin-agents.html'));
});

app.get('/profile.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'profile.html'));
});

app.get('/reports.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'reports.html'));
});
app.get('/admin-settings.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'admin-settings.html'));
});

// Proxy sécurisé pour la recherche Google Maps via SerpApi (optionnel)
// Utilise SERPAPI_KEY côté serveur; ne jamais exposer la clé au frontend
app.get('/api/geo/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ success: false, message: 'Paramètre q requis' });

    if (!SERPAPI_KEY) {
      return res.status(200).json({ success: true, engine: 'none', results: [] });
    }

    const params = new URLSearchParams({
      engine: 'google_maps',
      q,
      api_key: SERPAPI_KEY,
      hl: 'fr'
    });
    const url = `https://serpapi.com/search?${params.toString()}`;
    const resp = await fetch(url);
    const json = await resp.json();

    const results = [];
    if (json && json.local_results) {
      for (const it of json.local_results) {
        if (it.gps_coordinates && typeof it.gps_coordinates.lat === 'number' && typeof it.gps_coordinates.lng === 'number') {
          results.push({ lat: it.gps_coordinates.lat, lon: it.gps_coordinates.lng, label: it.title || it.address || it.category || q });
        }
      }
    }

    res.json({ success: true, engine: 'serpapi', results });
  } catch (e) {
    console.error('Erreur /api/geo/search:', e);
    res.status(500).json({ success: false, message: 'Erreur recherche lieu' });
  }
});

// API Routes

// Route pour récupérer le profil utilisateur
app.get('/api/profile', async (req, res) => {
  try {
    const email = req.query.email || 'admin@ccrb.local';
    const result = await pool.query('SELECT id, email, name, role, phone, photo_path, is_verified FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }
    const user = result.rows[0];
    return res.json({ success: true, data: { user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      photo_path: user.photo_path || null,
      is_verified: user.is_verified
    } } });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la récupération du profil' });
  }
});

  // API pour les statistiques de présence mensuelles
app.get('/api/presence/stats', async (req, res) => {
  try {
    const { year, month } = req.query;
    const email = req.query.email || 'admin@ccrb.local';
    
    // Récupérer l'ID de l'utilisateur
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    const userId = userResult.rows[0].id;
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    // Compter les jours de présence (jour avec mission démarrée)
    const presenceResult = await pool.query(`
      SELECT COUNT(DISTINCT DATE(start_time)) as days_worked,
             COUNT(*) as total_missions
      FROM missions 
      WHERE user_id = $1 
      AND DATE(start_time) BETWEEN $2 AND $3
      AND status IN ('active','completed')
    `, [userId, startDate, endDate]);
    
    // Calculer les heures travaillées (somme des durées des missions terminées dans la période)
    const hoursResult = await pool.query(`
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (m.end_time - m.start_time))) / 3600.0, 0) AS hours_worked
      FROM missions m
      WHERE m.user_id = $1
        AND DATE(m.start_time) BETWEEN $2 AND $3
        AND m.end_time IS NOT NULL
        AND m.status = 'completed'
    `, [userId, startDate, endDate]);

    // Répartition hebdomadaire dans le mois (bornée au mois demandé)
    // week_start est le lundi de la semaine (selon DateStyle Postgres)
    const weeklyRows = await pool.query(`
      WITH month_bounds AS (
        SELECT $2::date AS month_start, $3::date AS month_end
      )
      SELECT 
        GREATEST(DATE_TRUNC('week', m.start_time)::date, mb.month_start) AS week_start,
        LEAST((DATE_TRUNC('week', m.start_time)::date + INTERVAL '6 day')::date, mb.month_end) AS week_end,
        COUNT(DISTINCT DATE(m.start_time)) FILTER (WHERE m.status IN ('active','completed')) AS days_worked,
        COALESCE(SUM(
          CASE WHEN m.end_time IS NOT NULL AND m.status = 'completed' 
               THEN EXTRACT(EPOCH FROM (m.end_time - m.start_time)) / 3600.0
               ELSE 0 END
        ), 0) AS hours_worked
      FROM missions m
      CROSS JOIN month_bounds mb
      WHERE m.user_id = $1
        AND DATE(m.start_time) BETWEEN mb.month_start AND mb.month_end
      GROUP BY 1,2
      ORDER BY 1
    `, [userId, startDate, endDate]);
    
    // Position actuelle: utiliser l'unité de référence de l'agent si disponible
    const userRef = await pool.query(`
      SELECT departement, commune FROM users WHERE id = $1 LIMIT 1
    `, [userId]);
    
    // Jours planifiés dans le mois: priorité à user.expected_days_per_month, sinon calcul par fenêtre de planification, sinon paramètre global, sinon 22
    let expectedDays = null;
    try {
      const urow = await pool.query(`
        SELECT expected_days_per_month, planning_start_date, planning_end_date, commune, departement
        FROM users WHERE id = $1 LIMIT 1`, [userId]);
      const u = urow.rows[0] || {};
      // Préparer position actuelle (commune de référence)
      var refCommune = u?.commune || null;
      var refDepartement = u?.departement || null;
      // expectedDays priorité utilisateur
      if (u && u.expected_days_per_month && Number(u.expected_days_per_month) > 0) {
        expectedDays = Number(u.expected_days_per_month);
      } else if (u && u.planning_start_date && u.planning_end_date) {
        const ps = new Date(u.planning_start_date);
        const pe = new Date(u.planning_end_date);
        const periodStart = new Date(Number(year), Number(month) - 1, 1);
        const periodEnd = new Date(Number(year), Number(month), 0);
        const overlapStart = ps > periodStart ? ps : periodStart;
        const overlapEnd = pe < periodEnd ? pe : periodEnd;
        if (overlapEnd >= overlapStart) {
          const msPerDay = 24 * 60 * 60 * 1000;
          expectedDays = Math.floor((overlapEnd - overlapStart) / msPerDay) + 1;
        }
      }
      // Fallback app_settings
      if (!expectedDays || expectedDays <= 0) {
      const s = await pool.query(`SELECT value FROM app_settings WHERE key = 'presence.expected_days_per_month' LIMIT 1`);
      const v = s.rows[0]?.value;
      if (v !== undefined) {
        expectedDays = typeof v === 'number' ? v : (typeof v === 'string' ? parseInt(v) : 22);
      }
      }
      if (!expectedDays || Number.isNaN(expectedDays)) expectedDays = 22;
      // Construire stats avec current_position issue des références
      const weekly = (weeklyRows.rows || []).map(r => ({
        week_start: r.week_start,
        week_end: r.week_end,
        days_worked: Number(r.days_worked) || 0,
        hours_worked: Math.round((Number(r.hours_worked) || 0) * 10) / 10
      }));

      const stats = {
        days_worked: parseInt(presenceResult.rows[0].days_worked) || 0,
        hours_worked: Math.round((Number(hoursResult.rows[0]?.hours_worked) || 0) * 10) / 10,
        expected_days: expectedDays,
        current_position: (refCommune || refDepartement) ? [refCommune, refDepartement].filter(Boolean).join(', ') : 'Non disponible',
        weekly
      };
      return res.json({ success: true, stats });
    } catch {}
    
    // Fallback final si erreur inattendue dans le bloc ci-dessus
    return res.json({ success: true, stats: { days_worked: 0, hours_worked: 0, expected_days: 22, current_position: 'Non disponible' } });
  } catch (error) {
    console.error('Error fetching presence stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// API pour vérifier la présence d'aujourd'hui
app.get('/api/presence/check-today', async (req, res) => {
  try {
    const email = req.query.email || 'admin@ccrb.local';
    const today = new Date().toISOString().split('T')[0];
    
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    const userId = userResult.rows[0].id;
    
    const presenceResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM missions 
      WHERE user_id = $1 
      AND DATE(start_time) = $2
      AND status = 'completed'
    `, [userId, today]);
    
    res.json({ 
      success: true, 
      has_presence: parseInt(presenceResult.rows[0].count) > 0 
    });
  } catch (error) {
    console.error('Error checking today presence:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// API pour marquer une absence
app.post('/api/presence/mark-absent', async (req, res) => {
  try {
    const { date } = req.body;
    const email = req.query.email || 'admin@ccrb.local';
    
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    const userId = userResult.rows[0].id;
    
    await pool.query(
      `INSERT INTO absences (user_id, date)
       VALUES ($1, $2)
       ON CONFLICT (user_id, date) DO NOTHING`,
      [userId, date]
    );
    res.json({ success: true, message: 'Absence enregistrée' });
  } catch (error) {
    console.error('Error marking absence:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer quelques paramètres d'application
app.get('/api/settings', async (req, res) => {
  try {
    const rows = await pool.query(`SELECT key, value FROM app_settings WHERE key IN (
      'presence.expected_days_per_month',
      'presence.expected_hours_per_month',
      'geo.default_departement',
      'security.password_min_length'
    )`);
    const settings = {};
    for (const r of rows.rows) settings[r.key] = r.value;
    return res.json({ success: true, data: { settings } });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Erreur chargement paramètres' });
  }
});

// Admin: lire tous les paramètres
app.get('/api/admin/settings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authorization requise' });
    let userId;
    try {
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
      userId = decoded.userId;
    } catch {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    const roleRes = await pool.query('SELECT role FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (roleRes.rows[0]?.role !== 'admin') return res.status(403).json({ success: false, message: 'Réservé aux administrateurs' });

    const rows = await pool.query(`SELECT key, value, updated_at FROM app_settings ORDER BY key`);
    const settings = {};
    for (const r of rows.rows) settings[r.key] = r.value;
    res.json({ success: true, settings });
  } catch (e) {
    console.error('GET /api/admin/settings error:', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Admin: mettre à jour des paramètres
app.put('/api/admin/settings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authorization requise' });
    let userId;
    try {
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
      userId = decoded.userId;
    } catch {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    const roleRes = await pool.query('SELECT role FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (roleRes.rows[0]?.role !== 'admin') return res.status(403).json({ success: false, message: 'Réservé aux administrateurs' });

    const payload = req.body || {};
    const settings = payload.settings || {};
    const entries = Object.entries(settings);
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }
    res.json({ success: true, updated: entries.map(e => e[0]) });
  } catch (e) {
    console.error('PUT /api/admin/settings error:', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Inscription avec envoi de code de validation
app.post('/api/register', async (req, res) => {
  try {
    console.log('=== DÉBUT INSCRIPTION ===');
    const { email, password, name, role, phone } = req.body;
    console.log('Données reçues:', { email, name, role, phone });
    
    // Création automatique de l'admin principal
    if (email === 'syebadokpo@gmail.com') {
      console.log('🔧 Création automatique de l\'administrateur principal...');
      
      // Vérifier si l'admin existe déjà
      const existingAdmin = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingAdmin.rows.length > 0) {
        return res.json({
          success: true,
          message: 'Administrateur principal existe déjà. Vous pouvez vous connecter.',
          admin_exists: true
        });
      }
      
      // Hacher le mot de passe
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Créer l'administrateur principal (vérifié automatiquement)
      await pool.query(`
        INSERT INTO users (email, password_hash, name, role, phone, is_verified)
        VALUES ($1, $2, $3, $4, $5, TRUE)
      `, [email, passwordHash, 'Admin Principal', 'admin', phone || '+229 12345678']);
      
      console.log('✅ Administrateur principal créé avec succès');
      
      return res.json({
        success: true,
        message: 'Administrateur principal créé avec succès. Vous pouvez maintenant vous connecter.',
        admin_created: true
      });
    }
    
    // Vérifier si l'email existe déjà
    console.log('Vérification email existant...');
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      console.log('Email déjà utilisé');
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }
    
    // Générer un code de validation
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    console.log('Code généré:', verificationCode);
    
    // Hacher le mot de passe
    console.log('Hachage du mot de passe...');
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Créer l'utilisateur (non vérifié)
    console.log('Création de l\'utilisateur en base...');
    await pool.query(`
      INSERT INTO users (email, password_hash, name, role, phone, verification_code, verification_expires)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [email, passwordHash, name, role, phone, verificationCode, expiresAt]);
    console.log('Utilisateur créé avec succès');
    
    // Envoyer l'email de validation
    console.log('Envoi de l\'email de validation...');
    console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Défini' : 'Non défini');
    console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Défini' : 'Non défini');
    
    const superAdminEmail = 'syebadokpo@gmail.com';
    const recipient = (role && role.toLowerCase() === 'admin') ? superAdminEmail : email;
    // Pour les admins, envoyer au super admin et inclure l'email demandeur
    await sendVerificationEmail({ to: recipient, name, code: verificationCode });
    console.log('Email envoyé avec succès');
    
    res.json({
      success: true,
      message: (role && role.toLowerCase() === 'admin')
        ? 'Inscription admin: le code a été envoyé au Super Admin pour validation.'
        : 'Code de validation envoyé par email',
      admin_flow: (role && role.toLowerCase() === 'admin') === true,
      super_admin_contact: '+2290196911346'
    });
    
  } catch (error) {
    console.error('=== ERREUR INSCRIPTION ===');
    console.error('Type d\'erreur:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription: ' + error.message
    });
  }
});

// Validation du code d'inscription
app.post('/api/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    // Vérifier le code
    const result = await pool.query(`
      SELECT id, verification_expires FROM users 
      WHERE email = $1 AND verification_code = $2 AND is_verified = FALSE
    `, [email, code]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Code invalide ou expiré'
      });
    }
    
    const user = result.rows[0];
    
    // Vérifier l'expiration
    if (new Date() > new Date(user.verification_expires)) {
      return res.status(400).json({
        success: false,
        message: 'Code expiré'
      });
    }
    
    // Valider l'utilisateur
    await pool.query(`
      UPDATE users 
      SET is_verified = TRUE, verification_code = NULL, verification_expires = NULL
      WHERE id = $1
    `, [user.id]);
    
    res.json({
      success: true,
      message: 'Compte validé avec succès'
    });
    
  } catch (error) {
    console.error('Erreur validation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation'
    });
  }
});

// Renvoi de code de validation
app.post('/api/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

    // Vérifier l'utilisateur non vérifié
    const userRes = await pool.query('SELECT id, name FROM users WHERE email = $1 AND is_verified = FALSE', [email]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Utilisateur introuvable ou déjà vérifié' });
    }

    const user = userRes.rows[0];
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(`
      UPDATE users
      SET verification_code = $1, verification_expires = $2
      WHERE id = $3
    `, [verificationCode, expiresAt, user.id]);

    await sendVerificationEmail({ to: email, name: user.name, code: verificationCode });

    res.json({ success: true, message: 'Nouveau code envoyé' });
  } catch (error) {
    console.error('Erreur renvoi code:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Connexion
app.post('/api/login', async (req, res) => {
  try {
    console.log('🔐 Tentative de connexion reçue');
    const { email, password } = req.body;
    console.log('📧 Email:', email);
    console.log('🔑 Mot de passe fourni:', password ? 'OUI' : 'NON');
    
    // Récupérer l'utilisateur
    console.log('🔍 Recherche de l\'utilisateur dans la base...');
    const result = await pool.query(`
      SELECT id, email, password_hash, name, role, phone, is_verified
      FROM users WHERE email = $1
    `, [email]);
    
    console.log('📊 Nombre d\'utilisateurs trouvés:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('❌ Aucun utilisateur trouvé pour:', email);
      return res.status(400).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }
    
    const user = result.rows[0];
    console.log('👤 Utilisateur trouvé:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_verified: user.is_verified
    });
    
    // Vérifier si le compte est validé
    if (!user.is_verified) {
      console.log('⚠️ Compte non validé pour:', email);
      return res.status(400).json({
        success: false,
        message: 'Compte non validé. Vérifiez votre email.'
      });
    }
    
    // Vérifier le mot de passe
    console.log('🔐 Vérification du mot de passe...');
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('✅ Mot de passe valide:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Mot de passe incorrect pour:', email);
      return res.status(400).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }
    
    // Générer un vrai JWT
    console.log('🎫 Génération du JWT...');
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ Connexion réussie pour:', email);
    res.json({
      success: true,
      message: 'Connexion réussie',
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
    
  } catch (error) {
    console.error('💥 Erreur connexion détaillée:', error);
    console.error('📋 Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Route de test pour vérifier l'authentification
app.get('/api/test-auth', async (req, res) => {
  try {
    const { email, password } = req.query;
    console.log('🧪 Test auth pour:', email);
    
    if (!email || !password) {
      return res.json({
        success: false,
        message: 'Email et mot de passe requis',
        test: 'missing_credentials'
      });
    }
    
    // Test de connexion
    const result = await pool.query(`
      SELECT id, email, password_hash, name, role, phone, is_verified
      FROM users WHERE email = $1
    `, [email]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: 'Utilisateur non trouvé',
        test: 'user_not_found'
      });
    }
    
    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.json({
        success: false,
        message: 'Mot de passe incorrect',
        test: 'invalid_password'
      });
    }
    
    if (!user.is_verified) {
      return res.json({
        success: false,
        message: 'Compte non validé',
        test: 'account_not_verified'
      });
    }
    
    res.json({
      success: true,
      message: 'Authentification réussie',
      test: 'auth_success',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_verified: user.is_verified
      }
    });
    
  } catch (error) {
    console.error('Erreur test auth:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      test: 'server_error',
      error: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is running',
    database: 'connected'
  });
});

// Route pour les unités administratives
app.get('/api/admin-units', async (req, res) => {
  try {
    const { getDepartements } = require('./backend/src/db-cloud');
    const departements = await getDepartements();
    
    res.json({
      success: true,
      data: {
        departements: departements
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des unités administratives:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des unités administratives'
    });
  }
});

// ===== ROUTES GÉOGRAPHIQUES =====

// Route pour obtenir les départements
app.get('/api/geo/departements', (req, res) => {
  const departements = [
    { id: 1, nom: 'Littoral' },
    { id: 2, nom: 'Centre' },
    { id: 3, nom: 'Ouest' },
    { id: 4, nom: 'Nord-Ouest' },
    { id: 5, nom: 'Sud-Ouest' },
    { id: 6, nom: 'Adamaoua' },
    { id: 7, nom: 'Est' },
    { id: 8, nom: 'Extrême-Nord' },
    { id: 9, nom: 'Nord' },
    { id: 10, nom: 'Sud' }
  ];
  res.json(departements);
});

// Route pour obtenir les communes d'un département
app.get('/api/geo/communes/:departementId', (req, res) => {
  const departementId = parseInt(req.params.departementId);
  const communes = {
    1: [ // Littoral
      { id: 1, nom: 'Douala' },
      { id: 2, nom: 'Edéa' },
      { id: 3, nom: 'Nkongsamba' }
    ],
    2: [ // Centre
      { id: 4, nom: 'Yaoundé' },
      { id: 5, nom: 'Mbalmayo' },
      { id: 6, nom: 'Monatélé' }
    ],
    3: [ // Ouest
      { id: 7, nom: 'Bafoussam' },
      { id: 8, nom: 'Bangangté' },
      { id: 9, nom: 'Dschang' }
    ]
  };
  res.json(communes[departementId] || []);
});

// Route pour obtenir les arrondissements d'une commune
app.get('/api/geo/arrondissements/:communeId', (req, res) => {
  const communeId = parseInt(req.params.communeId);
  const arrondissements = {
    1: [ // Douala
      { id: 1, nom: 'Douala I' },
      { id: 2, nom: 'Douala II' },
      { id: 3, nom: 'Douala III' },
      { id: 4, nom: 'Douala IV' },
      { id: 5, nom: 'Douala V' }
    ],
    4: [ // Yaoundé
      { id: 6, nom: 'Yaoundé I' },
      { id: 7, nom: 'Yaoundé II' },
      { id: 8, nom: 'Yaoundé III' },
      { id: 9, nom: 'Yaoundé IV' },
      { id: 10, nom: 'Yaoundé V' },
      { id: 11, nom: 'Yaoundé VI' },
      { id: 12, nom: 'Yaoundé VII' }
    ],
    7: [ // Bafoussam
      { id: 13, nom: 'Bafoussam I' },
      { id: 14, nom: 'Bafoussam II' },
      { id: 15, nom: 'Bafoussam III' }
    ]
  };
  res.json(arrondissements[communeId] || []);
});

// Route pour obtenir les villages d'un arrondissement
app.get('/api/geo/villages/:arrondissementId', (req, res) => {
  const arrondissementId = parseInt(req.params.arrondissementId);
  const villages = {
    1: [ // Douala I
      { id: 1, nom: 'Akwa' },
      { id: 2, nom: 'Bonanjo' },
      { id: 3, nom: 'Deido' }
    ],
    2: [ // Douala II
      { id: 4, nom: 'New Bell' },
      { id: 5, nom: 'Logpom' },
      { id: 6, nom: 'Pk8' }
    ],
    6: [ // Yaoundé I
      { id: 7, nom: 'Bastos' },
      { id: 8, nom: 'Essos' },
      { id: 9, nom: 'Mvog-Ada' }
    ]
  };
  res.json(villages[arrondissementId] || []);
});

// ===== ROUTES DE PRÉSENCE =====

// Démarrer une mission de présence
app.post('/api/presence/start', upload.single('photo'), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token d\'authentification requis' });
    }
    const token = authHeader.substring(7);
    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId;
    } catch (jwtError) {
      return res.status(401).json({ success: false, error: 'Token d\'authentification invalide' });
    }
    
    console.log('Utilisateur authentifié:', userId);
    
    // Multer parse automatiquement les données FormData
    let { lat, lon, departement, commune, arrondissement, village, start_time, note } = req.body;
    
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Body complet:', req.body);
    console.log('Raw body:', req.rawBody);
    
    // Si les données sont vides, essayer de les extraire manuellement
    if (!lat || !lon || !departement || !commune) {
      console.log('Données manquantes, tentative d\'extraction manuelle...');
      
      // Valeurs par défaut pour le test
      if (!lat) lat = '4.0511';
      if (!lon) lon = '9.7679';
      if (!departement) departement = 'Littoral';
      if (!commune) commune = 'Douala';
      if (!arrondissement) arrondissement = 'Douala I';
      if (!village) village = 'Akwa';
      if (!note) note = 'Test automatique';
      
      console.log('Valeurs par défaut appliquées:', { lat, lon, departement, commune, arrondissement, village, note });
    }
    
    console.log('Données finales:', { lat, lon, departement, commune, arrondissement, village, start_time, note });
    console.log('Fichier photo:', req.file);
    
    // Validation des données requises
    if (!lat || !lon || !departement || !commune) {
      return res.status(400).json({
        success: false,
        message: 'Données GPS et géographiques requises',
        received: { lat, lon, departement, commune, arrondissement, village },
        body: req.body,
        headers: req.headers
      });
    }

    // Calculer distance avec point de référence si disponible
    let distance_m = null;
    try {
      const ref = await pool.query('SELECT reference_lat, reference_lon, COALESCE(tolerance_radius_meters, 500) AS tol FROM users WHERE id = $1 LIMIT 1', [userId]);
      const r = ref.rows[0];
      if (r && r.reference_lat && r.reference_lon && lat && lon) {
        const toRad = (v) => (Number(v) * Math.PI) / 180;
        const R = 6371000; // m
        const dLat = toRad(Number(lat) - Number(r.reference_lat));
        const dLon = toRad(Number(lon) - Number(r.reference_lon));
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(r.reference_lat)) * Math.cos(toRad(lat)) * Math.sin(dLon/2)**2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distance_m = Math.round(R * c);
      }
    } catch {}

    // Insérer la mission dans la base de données
    const result = await pool.query(`
      INSERT INTO missions (user_id, start_time, start_lat, start_lon, departement, commune, arrondissement, village, note, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING id
    `, [userId, start_time || new Date().toISOString(), lat, lon, departement, commune, arrondissement, village, note]);

    return res.json({ success: true, data: {
      message: 'Mission démarrée avec succès',
      mission_id: result.rows[0].id,
      distance_from_reference_m: distance_m
    } });
  } catch (error) {
    console.error('Erreur démarrage mission:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors du démarrage de la mission' });
  }
});

// Terminer une mission de présence
app.post('/api/presence/end', upload.single('photo'), async (req, res) => {
  // Auth obligatoire
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization requise' });
  }
  let userId = null;
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
    userId = decoded.userId;
  } catch (e) {
    console.error('Token verification error:', e);
    return res.status(401).json({ success: false, message: 'Token invalide' });
  }

  try {
    const { mission_id, lat, lon, note, end_time, force_end } = req.body || {};
    const nowIso = end_time || new Date().toISOString();
    
    console.log('Fin mission - userId:', userId, 'mission_id:', mission_id, 'lat:', lat, 'lon:', lon, 'force_end:', force_end);

    // Déterminer la mission cible
    let targetId = mission_id;
    
    // Convertir targetId en entier si c'est un tableau ou une chaîne
    if (Array.isArray(targetId)) {
      targetId = targetId[0];
    }
    if (typeof targetId === 'string') {
      targetId = parseInt(targetId);
    }
    
    if (!targetId || isNaN(targetId)) {
      const r = await pool.query(
        `SELECT id FROM missions WHERE user_id = $1 AND status = 'active' ORDER BY start_time DESC LIMIT 1`,
        [userId]
      );
      targetId = r.rows[0]?.id || null;
      console.log('Mission trouvée:', targetId);
    }
    if (!targetId) {
      return res.status(404).json({ success: false, message: 'Aucune mission active' });
    }
    
    // S'assurer que targetId est un entier
    targetId = parseInt(targetId);
    if (isNaN(targetId)) {
      return res.status(400).json({ success: false, message: 'ID de mission invalide' });
    }

    // Vérifier que la mission existe et appartient à l'utilisateur
    const missionCheck = await pool.query(
      `SELECT id, user_id, status FROM missions WHERE id = $1 AND user_id = $2`,
      [targetId, userId]
    );
    
    if (missionCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Mission non trouvée' });
    }

    // Update robuste: si lat/lon fournis, on les stocke; sinon on se contente de clôturer
    if (lat || lon || note) {
      const result = await pool.query(
        `UPDATE missions 
         SET end_time = $1,
             end_lat = COALESCE($2, end_lat),
             end_lon = COALESCE($3, end_lon),
             note = CASE WHEN $4::text IS NOT NULL AND $4::text <> '' THEN CONCAT(COALESCE(note, ''), ' | ', $4::text) ELSE note END,
             status = 'completed'
         WHERE id = $5 AND user_id = $6`,
        [nowIso, lat || null, lon || null, note || '', targetId, userId]
      );
      console.log('Mission updated with coords:', result.rowCount);
    } else {
      const result = await pool.query(
        `UPDATE missions SET end_time = $1, status = 'completed' WHERE id = $2 AND user_id = $3`,
        [nowIso, targetId, userId]
      );
      console.log('Mission updated without coords:', result.rowCount);
    }

    return res.json({ 
      success: true, 
      data: {
        message: force_end ? 'Mission terminée (sans position GPS)' : 'Mission terminée avec succès',
        force_end: force_end || false
      }
    });
  } catch (e) {
    console.error('Erreur fin mission:', e);
    return res.status(500).json({ success: false, error: 'Erreur lors de la fin de la mission: ' + e.message });
  }
});

// Route alternative pour forcer la fin de mission (sans GPS)
app.post('/api/presence/force-end', upload.single('photo'), async (req, res) => {
  // Auth obligatoire
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization requise' });
  }
  let userId = null;
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
    userId = decoded.userId;
  } catch (e) {
    console.error('Token verification error:', e);
    return res.status(401).json({ success: false, message: 'Token invalide' });
  }

  try {
    const { mission_id, note } = req.body || {};
    const nowIso = new Date().toISOString();
    
    console.log('Force fin mission - userId:', userId, 'mission_id:', mission_id, 'note:', note);
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);

    // Déterminer la mission cible
    let targetId = mission_id;
    
    if (!targetId || isNaN(parseInt(targetId))) {
      const r = await pool.query(
        `SELECT id FROM missions WHERE user_id = $1 AND status = 'active' ORDER BY start_time DESC LIMIT 1`,
        [userId]
      );
      targetId = r.rows[0]?.id || null;
    }
    
    if (!targetId) {
      return res.status(404).json({ success: false, message: 'Aucune mission active' });
    }
    
    targetId = parseInt(targetId);

    // Vérifier que la mission existe et appartient à l'utilisateur
    const missionCheck = await pool.query(
      `SELECT id, user_id, status FROM missions WHERE id = $1 AND user_id = $2`,
      [targetId, userId]
    );
    
    if (missionCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Mission non trouvée' });
    }

    // Terminer la mission sans position GPS
    const result = await pool.query(
      `UPDATE missions 
       SET end_time = $1,
           note = CASE WHEN $2::text IS NOT NULL AND $2::text <> '' THEN CONCAT(COALESCE(note, ''), ' | ', $2::text, ' (Fin forcée)') ELSE CONCAT(COALESCE(note, ''), ' (Fin forcée)') END,
           status = 'completed'
       WHERE id = $3 AND user_id = $4`,
      [nowIso, note || '', targetId, userId]
    );

    console.log('Mission forcée terminée:', result.rowCount);

    return res.json({ 
      success: true, 
      data: {
        message: 'Mission terminée (fin forcée - sans position GPS)',
        force_end: true
      }
    });
  } catch (e) {
    console.error('Erreur fin forcée mission:', e);
    return res.status(500).json({ success: false, error: 'Erreur lors de la fin forcée de la mission: ' + e.message });
  }
});

// Admin: derniers check-ins
app.get('/api/admin/checkins/latest', requireAuth(['admin','superviseur']), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const base = `
      SELECT c.id, c.lat, c.lon, c.timestamp,
             m.id AS mission_id, m.start_time, m.end_time,
             u.id AS user_id, u.name AS agent_name, u.role as agent_role,
             u.reference_lat, u.reference_lon, COALESCE(u.tolerance_radius_meters, 500) as tol,
             u.departement, u.commune, u.arrondissement, u.village
      FROM checkins c
      JOIN missions m ON c.mission_id = m.id
      JOIN users u ON m.user_id = u.id
      ORDER BY c.timestamp DESC
      LIMIT $1 OFFSET $2`;

    const rows = await pool.query(base, [limit, offset]);

    const toRad = (v) => (Number(v) * Math.PI) / 180;
    const R = 6371000; // meters

    const itemsCheckins = rows.rows.map(r => {
      let distance_m = null;
      try {
        if (r.reference_lat && r.reference_lon && r.lat && r.lon) {
          const dLat = toRad(Number(r.lat) - Number(r.reference_lat));
          const dLon = toRad(Number(r.lon) - Number(r.reference_lon));
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(toRad(Number(r.reference_lat))) * Math.cos(toRad(Number(r.lat))) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance_m = Math.round(R * c);
        }
      } catch {}
      
      return {
        type: 'checkin',
        id: r.id,
        lat: Number(r.lat),
        lon: Number(r.lon),
        timestamp: r.timestamp,
        mission_id: r.mission_id,
        start_time: r.start_time,
        end_time: r.end_time,
        user_id: r.user_id,
        agent_name: r.agent_name,
        agent_role: r.agent_role,
        departement: r.departement,
        commune: r.commune,
        arrondissement: r.arrondissement,
        village: r.village,
        distance_from_reference_m: distance_m,
        within_tolerance: distance_m !== null ? distance_m <= Number(r.tol) : null
      };
    });

    // Ajouter des points dérivés depuis missions
    const missionsRes = await pool.query(`
      SELECT m.id AS mission_id, m.start_time, m.end_time, m.start_lat, m.start_lon, m.end_lat, m.end_lon,
             u.id AS user_id, u.name AS agent_name, u.role AS agent_role,
             u.reference_lat, u.reference_lon, COALESCE(u.tolerance_radius_meters, 500) as tol,
             u.departement, u.commune, u.arrondissement, u.village
      FROM missions m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.start_time DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const derived = [];
    for (const r of missionsRes.rows) {
      const pushPoint = (lat, lon, ts, labelSuffix) => {
        if (lat == null || lon == null) return;
        let distance_m = null;
        try {
          if (r.reference_lat && r.reference_lon && lat && lon) {
            const dLat = toRad(Number(lat) - Number(r.reference_lat));
            const dLon = toRad(Number(lon) - Number(r.reference_lon));
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(toRad(Number(r.reference_lat))) * Math.cos(toRad(Number(lat))) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance_m = Math.round(R * c);
          }
        } catch {}
        derived.push({
          type: labelSuffix === 'start' ? 'mission_start' : 'mission_end',
          id: `m-${r.mission_id}-${labelSuffix}`,
          lat: Number(lat),
          lon: Number(lon),
          timestamp: ts,
          mission_id: r.mission_id,
          start_time: r.start_time,
          end_time: r.end_time,
          user_id: r.user_id,
          agent_name: r.agent_name,
          agent_role: r.agent_role,
          departement: r.departement,
          commune: r.commune,
          arrondissement: r.arrondissement,
          village: r.village,
          distance_from_reference_m: distance_m,
          within_tolerance: distance_m !== null ? distance_m <= Number(r.tol) : null
        });
      };
      pushPoint(r.start_lat, r.start_lon, r.start_time, 'start');
      pushPoint(r.end_lat, r.end_lon, r.end_time || r.start_time, 'end');
    }

    const combined = [...itemsCheckins, ...derived]
      .filter(p => typeof p.lat === 'number' && typeof p.lon === 'number')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    return res.json({ success: true, data: { items: combined, limit, offset } });
  } catch (error) {
    console.error('Erreur admin checkins latest:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Admin: liste détaillée des check-ins avec distances et filtres
app.get('/api/admin/checkins', requireAuth(['admin','superviseur']), async (req, res) => {
  try {
    const urlObj = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
    const from = urlObj.searchParams.get('from');
    const to = urlObj.searchParams.get('to');
    const agentId = urlObj.searchParams.get('agent_id');
    const limit = Math.min(parseInt(urlObj.searchParams.get('limit')) || 100, 1000);
    const offset = Math.max(parseInt(urlObj.searchParams.get('offset')) || 0, 0);

    const params = [];
    let where = '1=1';
    if (from) { params.push(from); where += ` AND DATE(c.timestamp) >= $${params.length}`; }
    if (to) { params.push(to); where += ` AND DATE(c.timestamp) <= $${params.length}`; }
    if (agentId) { params.push(agentId); where += ` AND m.user_id = $${params.length}`; }

    const q = `
      SELECT c.id, c.lat, c.lon, c.timestamp,
             m.id AS mission_id, m.start_time, m.end_time,
             u.id AS user_id, u.name AS agent_name, u.role as agent_role,
             u.reference_lat, u.reference_lon, COALESCE(u.tolerance_radius_meters, 500) as tol,
             u.departement, u.commune, u.arrondissement, u.village
      FROM checkins c
      JOIN missions m ON c.mission_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE ${where}
      ORDER BY c.timestamp DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const rows = await pool.query(q, [...params, limit, offset]);

    const toRad = (v) => (Number(v) * Math.PI) / 180;
    const R = 6371000; // meters

    const items = rows.rows.map(r => {
      let distance_m = null;
      try {
        if (r.reference_lat && r.reference_lon && r.lat && r.lon) {
          const dLat = toRad(Number(r.lat) - Number(r.reference_lat));
          const dLon = toRad(Number(r.lon) - Number(r.reference_lon));
          const a = Math.sin(dLat/2)**2 + Math.cos(toRad(r.reference_lat)) * Math.cos(toRad(r.lat)) * Math.sin(dLon/2)**2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance_m = Math.round(R * c);
        }
      } catch {}
      const within = (distance_m !== null) ? distance_m <= Number(r.tol || 500) : null;
      return {
        type: 'checkin',
        id: r.id,
        mission_id: r.mission_id,
        timestamp: r.timestamp,
        lat: Number(r.lat),
        lon: Number(r.lon),
        agent_id: r.user_id,
        agent_name: r.agent_name,
        agent_role: r.agent_role,
        departement: r.departement,
        commune: r.commune,
        arrondissement: r.arrondissement,
        village: r.village,
        distance_from_reference_m: distance_m,
        within_tolerance: within
      };
    });

    // Ajouter missions dérivées filtrées
    const paramsM = [];
    let whereM = '1=1';
    if (from) { paramsM.push(from); whereM += ` AND DATE(m.start_time) >= $${paramsM.length}`; }
    if (to) { paramsM.push(to); whereM += ` AND DATE(m.start_time) <= $${paramsM.length}`; }
    if (agentId) { paramsM.push(agentId); whereM += ` AND m.user_id = $${paramsM.length}`; }

    const missionsRes = await pool.query(`
      SELECT m.id AS mission_id, m.start_time, m.end_time, m.start_lat, m.start_lon, m.end_lat, m.end_lon,
             u.id AS user_id, u.name AS agent_name, u.role AS agent_role,
             u.reference_lat, u.reference_lon, COALESCE(u.tolerance_radius_meters, 500) as tol,
             u.departement, u.commune, u.arrondissement, u.village
      FROM missions m
      JOIN users u ON m.user_id = u.id
      WHERE ${whereM}
      ORDER BY m.start_time DESC
      LIMIT $${paramsM.length + 1} OFFSET $${paramsM.length + 2}
    `, [...paramsM, limit, offset]);

    const derived = [];
    for (const r of missionsRes.rows) {
      const addPoint = (lat, lon, ts, suffix) => {
        if (lat == null || lon == null) return;
        let distance_m = null;
        try {
          if (r.reference_lat && r.reference_lon && lat && lon) {
            const dLat = toRad(Number(lat) - Number(r.reference_lat));
            const dLon = toRad(Number(lon) - Number(r.reference_lon));
            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(r.reference_lat)) * Math.cos(toRad(lat)) * Math.sin(dLon/2)**2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance_m = Math.round(R * c);
          }
        } catch {}
        derived.push({
          type: suffix === 'start' ? 'mission_start' : 'mission_end',
          id: `m-${r.mission_id}-${suffix}`,
          mission_id: r.mission_id,
          timestamp: ts,
          lat: Number(lat),
          lon: Number(lon),
          agent_id: r.user_id,
          agent_name: r.agent_name,
          agent_role: r.agent_role,
          departement: r.departement,
          commune: r.commune,
          arrondissement: r.arrondissement,
          village: r.village,
          distance_from_reference_m: distance_m,
          within_tolerance: distance_m !== null ? distance_m <= Number(r.tol || 500) : null
        });
      };
      addPoint(r.start_lat, r.start_lon, r.start_time, 'start');
      addPoint(r.end_lat, r.end_lon, r.end_time || r.start_time, 'end');
    }

    const combined = [...items, ...derived].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json({ success: true, data: { items: combined, limit, offset } });
  } catch (e) {
    console.error('GET /api/admin/checkins error:', e);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Check-in pendant une mission
app.post('/api/mission/checkin', async (req, res) => {
  try {
    const { mission_id, lat, lon, note } = req.body;
    
    // Insérer le check-in
    await pool.query(`
      INSERT INTO checkins (mission_id, lat, lon, note, timestamp)
      VALUES ($1, $2, $3, $4, NOW())
    `, [mission_id, lat, lon, note]);

    res.json({
      success: true,
      message: 'Check-in enregistré avec succès'
    });
  } catch (error) {
    console.error('Erreur check-in:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du check-in'
    });
  }
});

// Upload direct de photo de profil (fallback côté serveur Express)
app.post('/api/profile/photo', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization requise' });
    }
    let userId;
    try {
      const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }
    const body = req.body || {};
    const base64 = (body.photo_base64 || body.photo || '').toString();
    if (!base64 || base64.length < 50) {
      return res.status(400).json({ success: false, message: 'Image invalide' });
    }
    // Sauvegarder localement dans /web/Media/uploads/avatars
    const avatarsDir = path.join(__dirname, 'web', 'Media', 'uploads', 'avatars');
    try { fs.mkdirSync(avatarsDir, { recursive: true }); } catch {}
    const filename = `avatar_${userId}_${Date.now()}.png`;
    const filePath = path.join(avatarsDir, filename);
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);
    const publicBase = process.env.PUBLIC_BASE_URL || 'https://presence-ccrb-v2.onrender.com';
    const relativePath = `/Media/uploads/avatars/${filename}`;
    const photoUrl = `${publicBase}${relativePath}`;
    // Optionnel: persister en base si la colonne existe, sinon ignorer
    try { 
      await pool.query('UPDATE users SET photo_path = $1 WHERE id = $2', [relativePath, userId]); 
    } catch {}
    return res.json({ success: true, photo_url: photoUrl });
  } catch (e) {
    console.error('Erreur upload photo profil (fallback):', e);
    return res.status(500).json({ success: false, message: 'Erreur lors du téléversement' });
  }
});

// Obtenir l'historique des missions
app.get('/api/missions/history', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, start_time, end_time, departement, commune, arrondissement, village, status
      FROM missions 
      WHERE user_id = $1 
      ORDER BY start_time DESC 
      LIMIT 50
    `, [1]);

    res.json({
      success: true,
      data: { missions: result.rows }
    });
  } catch (error) {
    console.error('Erreur historique missions:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération de l\'historique' });
  }
});

// Obtenir les check-ins d'une mission
app.get('/api/missions/:id/checkins', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.lat, c.lon, c.note, c.timestamp,
             u.reference_lat, u.reference_lon, COALESCE(u.tolerance_radius_meters, 500) AS tol
      FROM checkins c
      JOIN missions m ON c.mission_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE c.mission_id = $1
      ORDER BY c.timestamp DESC
    `, [id]);

    const toRad = (v) => (Number(v) * Math.PI) / 180;
    const R = 6371000;
    const items = result.rows.map(r => {
      let distance_m = null;
      try {
        if (r.reference_lat && r.reference_lon && r.lat && r.lon) {
          const dLat = toRad(Number(r.lat) - Number(r.reference_lat));
          const dLon = toRad(Number(r.lon) - Number(r.reference_lon));
          const a = Math.sin(dLat/2)**2 + Math.cos(toRad(r.reference_lat)) * Math.cos(toRad(r.lat)) * Math.sin(dLon/2)**2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance_m = Math.round(R * c);
        }
      } catch {}
      return { lat: r.lat, lon: r.lon, note: r.note, timestamp: r.timestamp, distance_from_reference_m: distance_m, tol: r.tol };
    });

    res.json({ success: true, data: { checkins: items } });
  } catch (error) {
    console.error('Erreur check-ins mission:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des check-ins' });
  }
});

// Route pour récupérer les missions de l'utilisateur connecté
app.get('/api/me/missions', async (req, res) => {
  try {
    // Vérification de l'authentification
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis'
      });
    }
    
    const token = authHeader.substring(7);
    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId;
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification invalide'
      });
    }
    
    // Récupérer les missions de l'utilisateur
    const result = await pool.query(`
      SELECT 
        m.*,
        COUNT(c.id) as checkin_count
      FROM missions m
      LEFT JOIN checkins c ON m.id = c.mission_id
      WHERE m.user_id = $1
      GROUP BY m.id
      ORDER BY m.start_time DESC
    `, [userId]);
    
    res.json({ success: true, data: { missions: result.rows } });
  } catch (error) {
    console.error('Erreur récupération missions:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des missions' });
  }
});

// Route temporaire pour créer l'administrateur principal (À SUPPRIMER APRÈS USAGE)
app.get('/api/admin/create-super-admin', async (req, res) => {
  try {
    console.log('🔧 Création de l\'administrateur principal...');
    
    const email = 'syebadokpo@gmail.com';
    const password = '123456';
    const name = 'Admin Principal';
    const role = 'admin';
    
    // Vérifier si l'admin existe déjà
    const existingAdmin = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingAdmin.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Administrateur principal existe déjà',
        email: email,
        can_login: true
      });
    }
    
    // Hacher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Créer l'administrateur principal (vérifié automatiquement)
    await pool.query(`
      INSERT INTO users (email, password_hash, name, role, phone, is_verified)
      VALUES ($1, $2, $3, $4, $5, TRUE)
    `, [email, passwordHash, name, role, '+229 12345678']);
    
    console.log('✅ Administrateur principal créé avec succès');
    
    res.json({
      success: true,
      message: 'Administrateur principal créé avec succès',
      credentials: {
        email: email,
        password: password,
        role: 'admin'
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création: ' + error.message
    });
  }
});

// PURGE TOTALE DES DONNÉES (ADMIN SEULEMENT) - supprime toutes les données y compris les utilisateurs
app.post('/api/admin/purge-all', async (req, res) => {
  try {
    // Auth obligatoire
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization requise' });
    }
    let userId;
    try {
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
      userId = decoded.userId;
    } catch {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    // Vérifier rôle admin
    const roleRes = await pool.query('SELECT role FROM users WHERE id = $1 LIMIT 1', [userId]);
    const role = roleRes.rows[0]?.role;
    if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Réservé aux administrateurs' });
    }

    // Purge transactionnelle
    await pool.query('BEGIN');
    // Désactiver contraintes référentielles si nécessaire puis TRUNCATE en cascade
    // L'ordre avec CASCADE doit suffire si les FK existent correctement
    await pool.query(`TRUNCATE TABLE 
      verification_codes,
      checkins,
      missions,
      absences,
      reports
      RESTART IDENTITY CASCADE`);

    await pool.query(`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
    await pool.query('COMMIT');

    res.json({ success: true, message: 'Purge complète effectuée (toutes les tables principales ont été vidées).' });
  } catch (e) {
    try { await pool.query('ROLLBACK'); } catch {}
    console.error('Erreur purge-all:', e);
    res.status(500).json({ success: false, message: 'Erreur lors de la purge des données' });
  }
});

// Nettoyer les utilisateurs: supprimer tous les comptes sauf le super admin conservé
app.post('/api/admin/cleanup-users', async (req, res) => {
  try {
    // Auth obligatoire
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization requise' });
    }
    let requesterId;
    try {
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
      requesterId = decoded.userId;
    } catch {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    // Vérifier rôle admin
    const roleRes = await pool.query('SELECT email, role FROM users WHERE id = $1 LIMIT 1', [requesterId]);
    const requester = roleRes.rows[0];
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Réservé aux administrateurs' });
    }

    // Déterminer l'email à conserver (par défaut: super admin principal)
    const keepEmail = (req.query.keep_email || req.body?.keep_email || 'syebadokpo@gmail.com').toString().trim().toLowerCase();

    // Vérifier que le compte à conserver existe; sinon, refuser pour éviter de tout supprimer par erreur
    const keepRes = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [keepEmail]);
    if (keepRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: `Compte à conserver introuvable: ${keepEmail}` });
    }
    const keepUserId = keepRes.rows[0].id;

    await pool.query('BEGIN');

    // Récupérer les utilisateurs à supprimer
    const usersToDelete = await pool.query('SELECT id, email FROM users WHERE id <> $1', [keepUserId]);
    const ids = usersToDelete.rows.map(r => r.id);

    let affected = { users: 0, missions: 0, checkins: 0, absences: 0, reports: 0, verifications: 0 };
    if (ids.length > 0) {
      // Supprimer données associées
      // Checkins liés aux missions de ces utilisateurs
      const missionIdsRes = await pool.query('SELECT id FROM missions WHERE user_id = ANY($1::int[])', [ids]);
      const missionIds = missionIdsRes.rows.map(r => r.id);
      if (missionIds.length > 0) {
        const delCheckins = await pool.query('DELETE FROM checkins WHERE mission_id = ANY($1::int[])', [missionIds]);
        affected.checkins = delCheckins.rowCount || 0;
      }
      const delMissions = await pool.query('DELETE FROM missions WHERE user_id = ANY($1::int[])', [ids]);
      affected.missions = delMissions.rowCount || 0;

      const delAbsences = await pool.query('DELETE FROM absences WHERE user_id = ANY($1::int[])', [ids]);
      affected.absences = delAbsences.rowCount || 0;

      const delReports = await pool.query('DELETE FROM reports WHERE user_id = ANY($1::int[])', [ids]);
      affected.reports = delReports.rowCount || 0;

      // Codes de vérification par email
      const emails = usersToDelete.rows.map(r => r.email.toLowerCase());
      if (emails.length > 0) {
        const delVerif = await pool.query('DELETE FROM verification_codes WHERE LOWER(email) = ANY($1::text[])', [emails]);
        affected.verifications = delVerif.rowCount || 0;
      }

      // Enfin, supprimer les utilisateurs
      const delUsers = await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids]);
      affected.users = delUsers.rowCount || 0;
    }

    await pool.query('COMMIT');

    res.json({ success: true, kept_email: keepEmail, affected });
  } catch (e) {
    try { await pool.query('ROLLBACK'); } catch {}
    console.error('Erreur cleanup-users:', e);
    res.status(500).json({ success: false, message: 'Erreur lors du nettoyage des utilisateurs' });
  }
});

// Mettre à jour le profil de l'utilisateur connecté (auto-service)
app.post('/api/me/profile', async (req, res) => {
  try {
    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization requise' });
    }
    let userId;
    try {
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
      userId = decoded.userId;
    } catch {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    // Champs autorisés à la mise à jour auto-service
    const allowedFields = [
      'first_name','last_name','phone','photo_path',
      'project_name','project_description','planning_start_date','planning_end_date',
      'expected_days_per_month','expected_hours_per_month','work_schedule','contract_type',
      'departement','commune','arrondissement','village','village_id',
      'tolerance_radius_meters','reference_lat','reference_lon','gps_accuracy'
    ];

    const payload = req.body || {};
    const sets = [];
    const params = [];
    let idx = 1;
    for (const key of allowedFields) {
      if (payload[key] !== undefined && payload[key] !== null) {
        sets.push(`${key} = $${idx++}`);
        params.push(payload[key]);
      }
    }

    if (sets.length === 0) {
      return res.json({ success: true, message: 'Aucun champ à mettre à jour' });
    }

    params.push(userId);
    const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id`;
    await pool.query(sql, params);

    res.json({ success: true, message: 'Profil mis à jour' });
  } catch (e) {
    console.error('Erreur update me/profile:', e);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du profil' });
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

// Public: derniers points (check-ins + départ/fin de missions) anonymisés pour la carte publique
app.get('/api/public/checkins/latest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);

    const toRad = (v) => (Number(v) * Math.PI) / 180;
    const R = 6371000; // meters

    // Récupérer check-ins récents
    const rows = await pool.query(`
      SELECT c.id, c.lat, c.lon, c.timestamp,
             m.id AS mission_id, m.start_time, m.end_time,
             u.id AS user_id, u.name AS agent_name,
             u.reference_lat, u.reference_lon, COALESCE(u.tolerance_radius_meters, 500) as tol,
             u.departement, u.commune, u.arrondissement, u.village
      FROM checkins c
      JOIN missions m ON c.mission_id = m.id
      JOIN users u ON m.user_id = u.id
      ORDER BY c.timestamp DESC
      LIMIT $1
    `, [limit]);

    const items = rows.rows.map(r => {
      let distance_m = null;
      try {
        if (r.reference_lat && r.reference_lon && r.lat && r.lon) {
          const dLat = toRad(Number(r.lat) - Number(r.reference_lat));
          const dLon = toRad(Number(r.lon) - Number(r.reference_lon));
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(toRad(Number(r.reference_lat))) * Math.cos(toRad(Number(r.lat))) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance_m = Math.round(R * c);
        }
      } catch {}
      return {
        id: r.id,
        mission_id: r.mission_id,
        timestamp: r.timestamp,
        lat: Number(r.lat),
        lon: Number(r.lon),
        agent_name: r.agent_name,
        departement: r.departement,
        commune: r.commune,
        arrondissement: r.arrondissement,
        village: r.village,
        distance_from_reference_m: distance_m,
        within_tolerance: distance_m !== null ? distance_m <= Number(r.tol || 500) : null
      };
    });

    // Ajouter points dérivés des missions
    const missionsRes = await pool.query(`
      SELECT m.id AS mission_id, m.start_time, m.end_time, m.start_lat, m.start_lon, m.end_lat, m.end_lon,
             u.id AS user_id, u.name AS agent_name,
             u.reference_lat, u.reference_lon, COALESCE(u.tolerance_radius_meters, 500) as tol,
             u.departement, u.commune, u.arrondissement, u.village
      FROM missions m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.start_time DESC
      LIMIT $1
    `, [limit]);

    const derived = [];
    for (const r of missionsRes.rows) {
      const addPoint = (lat, lon, ts, suffix) => {
        if (lat == null || lon == null) return;
        let distance_m = null;
        try {
          if (r.reference_lat && r.reference_lon && lat && lon) {
            const dLat = toRad(Number(lat) - Number(r.reference_lat));
            const dLon = toRad(Number(lon) - Number(r.reference_lon));
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(toRad(Number(r.reference_lat))) * Math.cos(toRad(Number(lat))) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance_m = Math.round(R * c);
          }
        } catch {}
        derived.push({
          id: `m-${r.mission_id}-${suffix}`,
          mission_id: r.mission_id,
          timestamp: ts,
          lat: Number(lat),
          lon: Number(lon),
          agent_name: r.agent_name,
          departement: r.departement,
          commune: r.commune,
          arrondissement: r.arrondissement,
          village: r.village,
          distance_from_reference_m: distance_m,
          within_tolerance: distance_m !== null ? distance_m <= Number(r.tol || 500) : null
        });
      };
      addPoint(r.start_lat, r.start_lon, r.start_time, 'start');
      addPoint(r.end_lat, r.end_lon, r.end_time || r.start_time, 'end');
    }

    const combined = [...items, ...derived]
      .filter(p => typeof p.lat === 'number' && typeof p.lon === 'number')
      .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    res.json({ success: true, data: { checkins: combined } });
  } catch (e) {
    console.error('Erreur /api/public/checkins/latest:', e);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Helper auth middleware
function requireAuth(roles = []) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Authorization requise' });
      }
      let tokenPayload;
      try {
        tokenPayload = jwt.verify(authHeader.substring(7), JWT_SECRET);
      } catch {
        return res.status(401).json({ success: false, error: 'Token invalide' });
      }
      if (roles.length) {
        const roleRes = await pool.query('SELECT role FROM users WHERE id = $1 LIMIT 1', [tokenPayload.userId]);
        const role = roleRes.rows[0]?.role;
        if (!role || !roles.includes(role)) {
          return res.status(403).json({ success: false, error: 'Accès interdit' });
        }
      }
      req.user = tokenPayload;
      next();
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Erreur auth' });
    }
  };
}

// Profil de l'utilisateur courant
app.get('/api/me', requireAuth(), async (req, res) => {
  try {
    const r = await pool.query('SELECT id, email, name, role, phone, photo_path FROM users WHERE id = $1 LIMIT 1', [req.user.userId]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
    return res.json({ success: true, data: { user: r.rows[0] } });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});
