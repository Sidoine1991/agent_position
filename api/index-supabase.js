// API consolidée pour Vercel - Version Supabase uniquement
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://agent-position.vercel.app';

// Initialisation Supabase
let supabaseClient = null;
try {
  const { supabase, supabaseAdmin } = require('../backend/src/supabase');
  supabaseClient = supabaseAdmin; // Utiliser service role pour le backend
  console.log('🔗 Supabase activé (API Vercel)');
} catch (e) {
  console.error('❌ Supabase requis:', e?.message);
  throw e;
}

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

// Middleware CORS
function corsHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
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
    return res.status(401).json({ error: 'Token d\'accès requis' });
  }

  try {
    const decoded = require('jsonwebtoken').verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token invalide' });
  }
}

// Fonction principale de l'API
export default async function handler(req, res) {
  // Gestion CORS
  if (corsHandler(req, res)) return;

  const { method, url } = req;
  const path = url.split('?')[0];

  try {
    // Health check
    if (path === '/api/test-server') {
      return res.json({ 
        status: 'OK', 
        database: 'Supabase',
        timestamp: new Date().toISOString()
      });
    }

    // Supabase health check
    if (path === '/api/supabase-health') {
      const { data, error } = await supabaseClient.from('app_settings').select('count').limit(1);
      if (error) throw error;
      return res.json({ status: 'OK', database: 'Supabase', connected: true });
    }

    // Login
    if (path === '/api/login' && method === 'POST') {
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
      const bcrypt = require('bcrypt');
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      // Générer le token JWT
      const jwt = require('jsonwebtoken');
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

      return res.json({
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
    }

    // Register
    if (path === '/api/register' && method === 'POST') {
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
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Générer un code de vérification
      const crypto = require('crypto');
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

      return res.json({
        success: true,
        message: 'Compte créé avec succès. Vérifiez votre email.',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role
        }
      });
    }

    // Profile
    if (path === '/api/profile' && method === 'GET') {
      // Authentification requise
      authenticateToken(req, res, async () => {
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

          return res.json({
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
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Missions
    if (path === '/api/me/missions' && method === 'GET') {
      // Authentification requise
      authenticateToken(req, res, async () => {
        try {
          const { data: missions, error } = await supabaseClient
            .from('missions')
            .select('*')
            .eq('agent_id', req.user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return res.json({
            success: true,
            missions: missions || []
          });
        } catch (error) {
          console.error('Erreur missions:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Settings
    if (path === '/api/settings' && method === 'GET') {
      try {
        const { data: settings, error } = await supabaseClient
          .from('app_settings')
          .select('*');

        if (error) throw error;

        const settingsObj = {};
        (settings || []).forEach(setting => {
          settingsObj[setting.key] = setting.value;
        });

        return res.json({
          success: true,
          settings: settingsObj
        });
      } catch (error) {
        console.error('Erreur settings:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
    }

    // Route non trouvée
    return res.status(404).json({ error: 'Route non trouvée' });

  } catch (error) {
    console.error('Erreur API:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
