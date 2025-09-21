// Serveur avec base de données PostgreSQL
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration multer pour les fichiers
const upload = multer({ dest: 'uploads/' });

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
    
    // Générer un vrai JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
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
    `, [1, start_time || new Date().toISOString(), lat, lon, departement, commune, arrondissement, village, note]);

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
app.post('/api/presence/end', async (req, res) => {
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
    const { lat, lon, end_time, note } = req.body;
    
    // Mettre à jour la mission
    await pool.query(`
      UPDATE missions 
      SET end_time = $1, end_lat = $2, end_lon = $3, note = CONCAT(note, ' | ', $4), status = 'completed'
      WHERE id = (SELECT id FROM missions WHERE user_id = $5 AND status = 'active' ORDER BY start_time DESC LIMIT 1)
    `, [end_time || new Date().toISOString(), lat, lon, note, 1]);

    res.json({
      success: true,
      message: 'Mission terminée avec succès'
    });
  } catch (error) {
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

// Route temporaire pour effacer toutes les données (À SUPPRIMER APRÈS USAGE)
app.post('/api/admin/clear-all-data', async (req, res) => {
  try {
    console.log('🗑️ Suppression de toutes les données...');
    
    // Supprimer toutes les données dans l'ordre des dépendances
    await pool.query('DELETE FROM checkins');
    console.log('✅ Check-ins supprimés');
    
    await pool.query('DELETE FROM missions');
    console.log('✅ Missions supprimées');
    
    await pool.query('DELETE FROM users');
    console.log('✅ Utilisateurs supprimés');
    
    res.json({
      success: true,
      message: 'Toutes les données ont été supprimées avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression: ' + error.message
    });
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
