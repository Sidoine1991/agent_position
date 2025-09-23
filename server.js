// Serveur avec base de données PostgreSQL
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration JWT
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  const message = 'JWT_SECRET non défini. Définissez la variable d\'environnement JWT_SECRET sur la plateforme (Vercel/Render).';
  if (process.env.NODE_ENV === 'production') {
    // En production, ne pas démarrer sans secret
    throw new Error(message);
  } else {
    console.warn('[DEV WARNING]', message, 'Un secret temporaire sera utilisé en local.');
    // Secret temporaire uniquement en local/dev pour éviter de casser le dev
    process.env.JWT_SECRET = 'dev-temp-secret-change-me';
  }
}

// Configuration multer pour les fichiers (Vercel-compatible)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/presence_ccrb',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

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

// API Routes

// Route pour récupérer le profil utilisateur
app.get('/api/profile', async (req, res) => {
  try {
    // Pour l'instant, simulation basée sur l'email
    // Dans une vraie app, on vérifierait le JWT
    const email = req.query.email || 'admin@ccrb.local';
    
    const result = await pool.query('SELECT id, email, name, role, phone, is_verified FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        is_verified: user.is_verified
      }
    });
    
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
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
    
    // Compter les jours de présence (utiliser la table missions au lieu de checkins)
    const presenceResult = await pool.query(`
      SELECT COUNT(DISTINCT DATE(start_time)) as days_worked,
             COUNT(*) as total_missions
      FROM missions 
      WHERE user_id = $1 
      AND DATE(start_time) BETWEEN $2 AND $3
      AND status = 'completed'
    `, [userId, startDate, endDate]);
    
    // Calculer les heures travaillées (approximation)
    const hoursResult = await pool.query(`
      SELECT 
        COUNT(*) * 8 as estimated_hours
      FROM (
        SELECT DISTINCT DATE(start_time) 
        FROM missions 
        WHERE user_id = $1 
        AND DATE(start_time) BETWEEN $2 AND $3
        AND status = 'completed'
      ) as work_days
    `, [userId, startDate, endDate]);
    
    // Récupérer la position actuelle (dernière position)
    const positionResult = await pool.query(`
      SELECT start_lat as lat, start_lon as lon
      FROM missions 
      WHERE user_id = $1 
      ORDER BY start_time DESC 
      LIMIT 1
    `, [userId]);
    
    // Récupérer les paramètres attendus (jours attendus)
    let expectedDays = 22;
    try {
      const s = await pool.query(`SELECT value FROM app_settings WHERE key = 'presence.expected_days_per_month' LIMIT 1`);
      const v = s.rows[0]?.value;
      if (v !== undefined) {
        expectedDays = typeof v === 'number' ? v : (typeof v === 'string' ? parseInt(v) : 22);
        if (Number.isNaN(expectedDays)) expectedDays = 22;
      }
    } catch {}

    const stats = {
      days_worked: parseInt(presenceResult.rows[0].days_worked) || 0,
      hours_worked: parseInt(hoursResult.rows[0].estimated_hours) || 0,
      expected_days: expectedDays,
      current_position: positionResult.rows.length > 0 
        ? `${positionResult.rows[0].lat.toFixed(4)}, ${positionResult.rows[0].lon.toFixed(4)}`
        : 'Non disponible'
    };
    
    res.json({ success: true, stats });
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
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur chargement paramètres' });
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is running',
    database: 'connected'
  });
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

    // Insérer la mission dans la base de données
    const result = await pool.query(`
      INSERT INTO missions (user_id, start_time, start_lat, start_lon, departement, commune, arrondissement, village, note, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING id
    `, [userId, start_time || new Date().toISOString(), lat, lon, departement, commune, arrondissement, village, note]);

    res.json({
      success: true,
      message: 'Mission démarrée avec succès',
      mission_id: result.rows[0].id
    });
  } catch (error) {
    console.error('Erreur démarrage mission:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du démarrage de la mission'
    });
  }
});

// Terminer une mission de présence
app.post('/api/presence/end', upload.single('photo'), async (req, res) => {
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
    
    console.log('Utilisateur authentifié pour fin mission:', userId);
    // Multer parse le multipart/form-data; fallback si vide
    let { lat, lon, end_time, note, mission_id } = req.body;
    if (!lat || !lon) {
      // Essayer d'extraire depuis raw body si nécessaire
      // Ou laisser nulls afin de ne pas bloquer l'update
      console.warn('Coordonnées de fin manquantes dans req.body, valeurs reçues:', req.body);
    }

    const nowIso = end_time || new Date().toISOString();

    // Essai 1: mise à jour complète avec coordonnées de fin et concat note
    try {
      let updateResult;
      if (mission_id) {
        updateResult = await pool.query(
          `UPDATE missions 
           SET end_time = $1, end_lat = $2, end_lon = $3, note = CONCAT(COALESCE(note, ''), ' | ', $4), status = 'completed'
           WHERE id = $5
           RETURNING id`,
          [nowIso, lat || null, lon || null, note || '', mission_id]
        );
      } else {
        updateResult = await pool.query(
          `UPDATE missions 
           SET end_time = $1, end_lat = $2, end_lon = $3, note = CONCAT(COALESCE(note, ''), ' | ', $4), status = 'completed'
           WHERE id = (SELECT id FROM missions WHERE user_id = $5 AND status = 'active' ORDER BY start_time DESC LIMIT 1)
           RETURNING id`,
          [nowIso, lat || null, lon || null, note || '', userId]
        );
      }

      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucune mission active trouvée pour cet utilisateur'
        });
      }

      return res.json({
        success: true,
        message: 'Mission terminée avec succès'
      });
    } catch (updateError) {
      console.warn('Update end mission failed (full fields). Retrying with minimal fields...', updateError?.message || updateError);
      // Essai 2: fallback minimal (sans end_lat/end_lon/concat note) pour compatibilité schéma
      let fallbackResult;
      if (mission_id) {
        fallbackResult = await pool.query(
          `UPDATE missions 
           SET end_time = $1, status = 'completed'
           WHERE id = $2
           RETURNING id`,
          [nowIso, mission_id]
        );
      } else {
        fallbackResult = await pool.query(
          `UPDATE missions 
           SET end_time = $1, status = 'completed'
           WHERE id = (SELECT id FROM missions WHERE user_id = $2 AND status = 'active' ORDER BY start_time DESC LIMIT 1)
           RETURNING id`,
          [nowIso, userId]
        );
      }

      if (fallbackResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucune mission active trouvée pour cet utilisateur'
        });
      }

      return res.json({ success: true, message: 'Mission terminée avec succès (fallback)' });
    }
  } catch (error) {
    // Dernier fallback: si une erreur subsiste, tenter la clôture sans end_time
    try {
      const { mission_id } = req.body || {};
      let targetId = mission_id;
      if (!targetId) {
        const r = await pool.query(
          `SELECT id FROM missions WHERE user_id = $1 AND status = 'active' ORDER BY start_time DESC LIMIT 1`,
          [userId]
        );
        targetId = r.rows[0]?.id;
      }
      if (targetId) {
        await pool.query(`UPDATE missions SET status = 'completed' WHERE id = $1`, [targetId]);
        return res.json({ success: true, message: 'Mission terminée (fallback minimal)' });
      }
    } catch (e) {
      console.warn('Ultimate fallback end mission failed:', e?.message || e);
    }
    console.error('Erreur fin mission:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la fin de la mission'
    });
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
      missions: result.rows
    });
  } catch (error) {
    console.error('Erreur historique missions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
});

// Obtenir les check-ins d'une mission
app.get('/api/missions/:id/checkins', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT lat, lon, note, timestamp
      FROM checkins 
      WHERE mission_id = $1 
      ORDER BY timestamp DESC
    `, [id]);

    res.json({
      success: true,
      checkins: result.rows
    });
  } catch (error) {
    console.error('Erreur check-ins mission:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des check-ins'
    });
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
    
    res.json({
      success: true,
      missions: result.rows
    });
  } catch (error) {
    console.error('Erreur récupération missions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des missions'
    });
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
