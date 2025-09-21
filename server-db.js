// Serveur avec base de données PostgreSQL
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Inscription avec envoi de code de validation
app.post('/api/register', async (req, res) => {
  try {
    console.log('=== DÉBUT INSCRIPTION ===');
    const { email, password, name, role, phone } = req.body;
    console.log('Données reçues:', { email, name, role, phone });
    
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
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Code de validation - Presence CCRB',
      html: `
        <h2>Validation de votre compte</h2>
        <p>Bonjour ${name},</p>
        <p>Votre code de validation est : <strong>${verificationCode}</strong></p>
        <p>Ce code expire dans 15 minutes.</p>
        <p>Utilisez ce code pour valider votre inscription sur la plateforme.</p>
      `
    });
    console.log('Email envoyé avec succès');
    
    res.json({
      success: true,
      message: 'Code de validation envoyé par email'
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

// Connexion
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Récupérer l'utilisateur
    const result = await pool.query(`
      SELECT id, email, password_hash, name, role, phone, is_verified
      FROM users WHERE email = $1
    `, [email]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }
    
    const user = result.rows[0];
    
    // Vérifier si le compte est validé
    if (!user.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'Compte non validé. Vérifiez votre email.'
      });
    }
    
    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }
    
    // Générer un token (simulation)
    const token = 'jwt-token-' + Date.now();
    
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
    console.error('Erreur connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion'
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

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
