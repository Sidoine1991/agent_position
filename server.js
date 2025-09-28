// Serveur avec base de données Supabase uniquement
const express = require('express');
const path = require('path');
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

// Configuration JWT
const config = require('./config');
const JWT_SECRET = config.JWT_SECRET;

// Configuration multer pour les fichiers (Vercel-compatible)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialisation Supabase
let supabaseClient = null;
try {
  const { supabase, supabaseAdmin } = require('./backend/src/supabase');
  supabaseClient = supabaseAdmin; // Utiliser service role pour le backend
  console.log('🔗 Supabase activé (mode exclusif)');
} catch (e) {
  console.error('❌ Supabase requis:', e?.message);
  process.exit(1);
}

// Test de connexion Supabase
(async () => {
  try {
    const { data, error } = await supabaseClient.from('app_settings').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Connexion Supabase établie');
  } catch (err) {
    console.error('❌ Erreur de connexion Supabase:', err.message);
    process.exit(1);
  }
})();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
const cors = require('cors');
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Sécurité
if (process.env.NODE_ENV !== 'test') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.supabase.co"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }));
}

// Rate limiting
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limite augmentée pour éviter "Too Many Requests"
    message: 'Trop de requêtes, veuillez réessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
} else {
  // Bypass rate limiting en mode test
  app.use((req, res, next) => {
    console.log('🧪 Mode test: Rate limiting désactivé');
    next();
  });
}

// Servir les fichiers statiques
app.use(express.static('web'));
app.use('/bootstrap-5.3.8-dist', express.static(path.join(__dirname, 'bootstrap-5.3.8-dist')));

// Headers pour les fichiers statiques
app.use((req, res, next) => {
  if (req.path.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css');
  } else if (req.path.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript');
  } else if (req.path.endsWith('.json')) {
    res.setHeader('Content-Type', 'application/json');
  } else if (req.path.endsWith('.html')) {
    res.setHeader('Content-Type', 'text/html');
  }
  next();
});

// Middleware d'authentification
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token d\'accès requis' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.user = user;
    next();
  });
}

// Middleware d'authentification admin
function authenticateAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  next();
}

// Routes API

// Health check
app.get('/api/test-server', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: 'Supabase',
    timestamp: new Date().toISOString(),
    rate_limiting_disabled: process.env.NODE_ENV === 'test'
  });
});

// Supabase health check
app.get('/api/supabase-health', async (req, res) => {
  try {
    const { data, error } = await supabaseClient.from('app_settings').select('count').limit(1);
    if (error) throw error;
    res.json({ status: 'OK', database: 'Supabase', connected: true });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Rechercher l'utilisateur dans Supabase
    const { data: users, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error) throw error;
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const user = users[0];
    
    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_verified: user.is_verified
      }
    });

  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, role = 'agent' } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, mot de passe et nom requis' });
    }

    // Vérifier si l'utilisateur existe déjà
    const { data: existingUsers, error: checkError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (checkError) throw checkError;
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Générer un code de vérification
    const verificationCode = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Créer l'utilisateur dans Supabase
    const { data: newUser, error: insertError } = await supabaseClient
      .from('users')
      .insert([{
        email,
        password_hash: passwordHash,
        name,
        role,
        is_verified: false,
        verification_code: verificationCode,
        verification_expires: verificationExpires.toISOString()
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // Envoyer l'email de vérification (non-bloquant)
    try {
      await sendVerificationEmail(email, verificationCode);
    } catch (emailError) {
      console.warn('⚠️ Email de vérification non envoyé:', emailError.message);
    }

    res.json({
      success: true,
      message: 'Compte créé avec succès. Vérifiez votre email.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Erreur register:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        is_verified: user.is_verified,
        photo_path: user.photo_path,
        reference_lat: user.reference_lat,
        reference_lon: user.reference_lon,
        tolerance_radius_meters: user.tolerance_radius_meters,
        departement: user.departement,
        commune: user.commune,
        arrondissement: user.arrondissement,
        village: user.village,
        project_name: user.project_name,
        expected_days_per_month: user.expected_days_per_month,
        expected_hours_per_month: user.expected_hours_per_month,
        planning_start_date: user.planning_start_date,
        planning_end_date: user.planning_end_date,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Erreur profile:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Missions
app.get('/api/me/missions', authenticateToken, async (req, res) => {
  try {
    const { data: missions, error } = await supabaseClient
      .from('missions')
      .select('*')
      .eq('agent_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      missions: missions || []
    });

  } catch (error) {
    console.error('Erreur missions:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Settings
app.get('/api/settings', async (req, res) => {
  try {
    const { data: settings, error } = await supabaseClient
      .from('app_settings')
      .select('*');

    if (error) throw error;

    const settingsObj = {};
    (settings || []).forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });

    res.json({
      success: true,
      settings: settingsObj
    });

  } catch (error) {
    console.error('Erreur settings:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Fonction d'envoi d'email
async function sendVerificationEmail(email, code) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Configuration email manquante');
  }

  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Vérification de votre compte',
    html: `
      <h2>Vérification de votre compte</h2>
      <p>Cliquez sur le lien suivant pour vérifier votre compte :</p>
      <a href="${process.env.CORS_ORIGIN || 'http://localhost:3000'}/verify.html?code=${code}">Vérifier mon compte</a>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📊 Base de données: Supabase uniquement`);
});

module.exports = app;
