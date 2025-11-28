// API consolidée pour Vercel - Version Supabase uniquement
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://agent-position.vercel.app';

// Configuration email
const nodemailer = require('nodemailer');

function getAllowedOrigin(req) {
  try {
    const originHeader = req.headers['origin'] || '';
    const list = String(CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    if (list.length === 0) return originHeader || 'https://agent-position.vercel.app';
    if (!originHeader) return list[0];
    // Match by exact string or startsWith to allow subpaths
    const match = list.find(o => originHeader === o || originHeader.startsWith(o));
    return match || list[0];
  } catch {
    return 'https://agent-position.vercel.app';
  }
}

// Initialisation Supabase (directe, sans dépendance backend locale)
const { createClient } = require('@supabase/supabase-js');
const { buildAgentMonthlyReport } = require('../utils/monthlyReport');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  // Ne pas throw immédiatement pour permettre le healthcheck de signaler proprement
}

const supabaseClient = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

// Stockage en mémoire (fallback uniquement)
let users = [];
let missions = [];
let checkins = [];
let adminUnits = [];

// Initialiser les utilisateurs par défaut (fallback)
function initializeUsers() {
  users = [
    {
      id: 1,
      name: 'Super Admin',
      email: 'syebadokpo@gmail.com',
      password: simpleHash(process.env.SUPERADMIN_PASSWORD || '123456'),
      role: 'admin',
      status: 'active',
      is_verified: true,
      created_at: new Date().toISOString()
    }
  ];
}

// Hash simple pour les mots de passe
function simpleHash(password) {
  return require('crypto').createHash('sha256').update(password).digest('hex');
}

// Fonction d'envoi d'email de vérification
async function sendVerificationEmail(email, code, newAccountEmail = null) {
  console.log('📧 Tentative d\'envoi d\'email de vérification à:', email);
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Configuration email manquante - EMAIL_USER et EMAIL_PASS requis');
    throw new Error('Configuration email manquante');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  console.log('🔧 Transporteur email créé, test de connexion...');

  // Tester la connexion d'abord
  try {
    await transporter.verify();
    console.log('✅ Connexion au serveur email réussie');
  } catch (verifyError) {
    console.error('❌ Erreur de connexion au serveur email:', verifyError);
    throw verifyError;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Vérification de compte Presence CCR-B',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Vérification de votre compte</h2>
        <p>Bonjour,</p>
        <p>Veuillez utiliser le code suivant pour vérifier votre adresse email :</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 2px; margin: 20px 0;">
          ${code}
        </div>
        <p>Ce code expirera dans 1 heure.</p>
        ${newAccountEmail ? `<p>Votre compte a été créé avec l'adresse email : <strong>${newAccountEmail}</strong></p>` : ''}
        <p>Si vous n'avez pas demandé cette vérification, vous pouvez ignorer cet email.</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          Ceci est un message automatique, merci de ne pas y répondre.
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé avec succès:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
    throw error;
  }
}

// Middleware CORS
function corsHandler(req, res) {
  const allowedOrigin = getAllowedOrigin(req);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  
  return false;
}

// Middleware d'authentification
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  
  // Vérification simple du token (à remplacer par une vérification JWT réelle)
  if (token !== JWT_SECRET) {
    return res.status(403).json({ error: 'Token invalide' });
  }
  
  // Simuler un utilisateur authentifié
  req.user = { id: 1, email: 'admin@example.com', role: 'admin' };
  next();
}

// Fonction principale de l'API (CommonJS export pour @vercel/node)
module.exports = async (req, res) => {
  try {
    // Extraire le chemin et la méthode de la requête
    const { path = '', method = '' } = req;
    
    // Gestion CORS
    if (corsHandler(req, res)) return;
    
    // Health check
    if (path === '/api/test-server') {
      return res.json({ 
        status: 'OK', 
        database: 'Supabase',
        supabaseConfigured: !!supabaseClient,
        timestamp: new Date().toISOString()
      });
    }

    // Env diagnostics (no secrets leaked)
    if (path === '/api/env-check') {
      const envPresent = {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        JWT_SECRET: !!process.env.JWT_SECRET,
        CORS_ORIGIN: process.env.CORS_ORIGIN || null
      };
      return res.json({ success: true, envPresent, supabaseConfigured: !!supabaseClient });
    }

    // Supabase health check
    if (path === '/api/supabase-health') {
      try {
        if (!supabaseClient) {
          return res.status(200).json({ status: 'OK', database: 'Supabase', connected: false, reason: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' });
        }
        const { error } = await supabaseClient.from('app_settings').select('count', { head: true }).limit(1);
        if (error) {
          return res.status(200).json({ status: 'ERROR', database: 'Supabase', connected: false, reason: error.message || 'unknown' });
        }
        return res.json({ status: 'OK', database: 'Supabase', connected: true });
      } catch (e) {
        return res.status(200).json({ status: 'ERROR', database: 'Supabase', connected: false, reason: e?.message || 'unknown' });
      }
    }

    // ... (autres routes existantes)

    // Objectifs personnels - Créer un objectif
    if (path === '/api/goals' && method === 'POST') {
      return authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { title, description, target_value, target_date, category } = req.body;

          if (!title) {
            return res.status(400).json({ error: 'Titre requis' });
          }

          const { data: goal, error } = await supabaseClient
            .from('personal_goals')
            .insert({
              user_id: req.user.id,
              title,
              description,
              target_value,
              target_date,
              category,
              status: 'active',
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            console.error('Erreur Supabase:', error);
            throw error;
          }

          return res.status(201).json({ success: true, goal });
        } catch (error) {
          console.error('Erreur création objectif:', error);
          return res.status(500).json({ 
            success: false,
            error: 'Erreur lors de la création de l\'objectif',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      });
    }

    // Endpoint pour les objectifs
    if (path === '/api/goals' && method === 'GET') {
      return authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: goals, error } = await supabaseClient
            .from('personal_goals')
            .select('*')
            .eq('user_id', req.user.id);

          if (error) throw error;

          return res.json({ success: true, goals: goals || [] });
        } catch (error) {
          console.error('Erreur récupération objectifs:', error);
          return res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la récupération des objectifs',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      });
    }

    // ... (autres routes existantes)

    // Route non trouvée
    console.log('=== ROUTE NON TROUVÉE ===');
    console.log('Méthode:', method);
    console.log('Chemin:', path);
    console.log('En-têtes:', req.headers);
    console.log('Paramètres de requête:', req.query);
  
    // Réponse d'erreur détaillée
    return res.status(404).json({ 
      success: false,
      error: 'Route non trouvée',
      path: path,
      method: method,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erreur non gérée dans le gestionnaire principal:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur serveur interne',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Initialiser les utilisateurs par défaut si nécessaire
initializeUsers();
