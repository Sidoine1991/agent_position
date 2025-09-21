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

// Inscription avec envoi de code de validation
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, role, phone } = req.body;
    
    // Vérifier si l'email existe déjà
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }
    
    // Générer un code de validation
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Hacher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Créer l'utilisateur (non vérifié)
    await pool.query(`
      INSERT INTO users (email, password_hash, name, role, phone, verification_code, verification_expires)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [email, passwordHash, name, role, phone, verificationCode, expiresAt]);
    
    // Envoyer l'email de validation
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
    
    res.json({
      success: true,
      message: 'Code de validation envoyé par email'
    });
    
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription'
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
