// API consolidée pour Vercel - Version Supabase uniquement
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://agent-position.vercel.app';

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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin-bottom: 10px;">Presence CCR-B</h1>
          <h2 style="color: #374151; margin: 0;">Vérification de compte</h2>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          ${newAccountEmail ? `<p style="margin: 0 0 15px 0; color: #059669;"><strong>Nouveau compte:</strong> ${newAccountEmail}</p>` : ''}
          <p style="margin: 0 0 15px 0; color: #374151;">Votre code de vérification est :</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #2563eb; background: #eff6ff; padding: 15px 25px; border-radius: 8px; letter-spacing: 3px;">${code}</span>
          </div>
          <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 14px;">Entrez ce code dans l'application pour activer votre compte.</p>
        </div>
        
        <div style="text-align: center; color: #6b7280; font-size: 12px;">
          <p>Ce code expire dans 24 heures.</p>
          <p>Si vous n'avez pas demandé ce code, ignorez cet email.</p>
        </div>
      </div>
    `
  };

  try {
    console.log('📤 Envoi de l\'email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé avec succès! Message ID:', info.messageId);
    console.log(`✅ Email de vérification envoyé à ${email}`);
    return info;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
    console.error('Code d\'erreur:', error.code);
    console.error('Message:', error.message);
    throw error;
  }
}

// Middleware CORS
const corsHandler = (req, res) => {
  const origin = getAllowedOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Session-Id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Répondre immédiatement aux requêtes OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  
  // Ajouter des en-têtes de sécurité supplémentaires
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  return false;
};

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

    // Login
    if (path === '/api/login' && method === 'POST') {
      if (!supabaseClient) {
        return res.status(500).json({ error: 'Supabase non configuré. Définissez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.' });
      }
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
      
      // Vérifier le mot de passe (bcryptjs compatible serverless)
      const bcrypt = require('bcryptjs');
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      // VÉRIFICATION OBLIGATOIRE : L'utilisateur doit être vérifié
      if (!user.is_verified) {
        return res.status(403).json({ 
          error: 'Compte non vérifié',
          message: 'Veuillez vérifier votre compte avec le code reçu par email avant de vous connecter. Si vous n\'avez pas reçu le code, contactez le super admin : syebadokpo@gmail.com ou +229 01 96 91 13 46',
          requires_verification: true
        });
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
      if (!supabaseClient) {
        return res.status(500).json({ error: 'Supabase non configuré. Définissez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.' });
      }

      const { email, password, name, role = 'agent', phone, departement, commune, arrondissement, village, project_name, expected_days_per_month, expected_hours_per_month, contract_start_date, contract_end_date, years_of_service, reference_lat, reference_lon, tolerance_radius_meters } = req.body;
      
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

      // Vérifier si c'est un admin et s'il y a déjà un admin principal
      let isAdminFlow = false;
      if (role === 'admin') {
        const { data: adminUsers, error: adminCheckError } = await supabaseClient
          .from('users')
          .select('id')
          .eq('role', 'admin')
          .limit(1);

        if (adminCheckError) throw adminCheckError;
        isAdminFlow = adminUsers && adminUsers.length > 0;
      }

      // Hasher le mot de passe
      const bcrypt = require('bcrypt');
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Générer un code de vérification à 6 chiffres
      const crypto = require('crypto');
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // Code à 6 chiffres
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      // Préparer les données utilisateur
      const userData = {
        email,
        password_hash: passwordHash,
        name,
        role,
        is_verified: false,
        verification_code: verificationCode,
        verification_expires: verificationExpires.toISOString(),
        phone: phone || null,
        departement: departement || null,
        commune: commune || null,
        arrondissement: arrondissement || null,
        village: village || null,
        project_name: project_name || null,
        expected_days_per_month: expected_days_per_month ? parseInt(expected_days_per_month) : null,
        expected_hours_per_month: expected_hours_per_month ? parseInt(expected_hours_per_month) : null,
        contract_start_date: contract_start_date || null,
        contract_end_date: contract_end_date || null,
        years_of_service: years_of_service ? parseFloat(years_of_service) : null,
        reference_lat: reference_lat ? parseFloat(reference_lat) : null,
        reference_lon: reference_lon ? parseFloat(reference_lon) : null,
        tolerance_radius_meters: tolerance_radius_meters ? parseInt(tolerance_radius_meters) : null
      };

      // Créer l'utilisateur dans Supabase
      const { data: newUser, error: insertError } = await supabaseClient
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (insertError) throw insertError;

      // Envoyer l'email de vérification
      try {
        if (isAdminFlow) {
          // Pour les admins, envoyer l'email au super admin
          const superAdminEmail = 'syebadokpo@gmail.com';
          await sendVerificationEmail(superAdminEmail, verificationCode, email);
        } else {
          // Pour les utilisateurs normaux, envoyer l'email à l'utilisateur
          await sendVerificationEmail(email, verificationCode);
        }
      } catch (emailError) {
        console.error('❌ Erreur envoi email:', emailError);
        console.error('Code d\'erreur:', emailError.code);
        console.error('Message:', emailError.message);
        console.error('Stack:', emailError.stack);
        // Ne pas faire échouer l'inscription si l'email échoue
        // L'utilisateur peut demander un renvoi de code
      }

      return res.json({
        success: true,
        message: 'Compte créé avec succès. Vérifiez votre email.',
        admin_flow: isAdminFlow,
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

    // Check-ins de l'utilisateur connecté
    if (path === '/api/checkins' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          let q = supabaseClient
            .from('checkins')
            .select('*, missions!inner(agent_id)')
            .eq('missions.agent_id', req.user.id);
          
          const { from, to } = req.query;
          if (from) q = q.gte('timestamp', from);
          if (to) q = q.lte('timestamp', to);
          
          const { data, error } = await q.order('timestamp', { ascending: false });
          if (error) throw error;
          
          return res.json({ success: true, checkins: data || [] });
        } catch (e) {
          console.error('Erreur récupération checkins:', e);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Verify
    if (path === '/api/verify' && method === 'POST') {
      if (!supabaseClient) {
        return res.status(500).json({ error: 'Supabase non configuré' });
      }

      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ error: 'Email et code requis' });
      }

      // Rechercher l'utilisateur avec le code de vérification
      const { data: users, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('verification_code', code)
        .limit(1);

      if (error) throw error;
      if (!users || users.length === 0) {
        return res.status(400).json({ error: 'Code invalide ou expiré' });
      }

      const user = users[0];
      
      // Vérifier si le code n'est pas expiré
      const now = new Date();
      const expiresAt = new Date(user.verification_expires);
      if (now > expiresAt) {
        return res.status(400).json({ error: 'Code expiré' });
      }

      // Activer le compte
      const { error: updateError } = await supabaseClient
        .from('users')
        .update({ 
          is_verified: true,
          verification_code: null,
          verification_expires: null
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      return res.json({
        success: true,
        message: 'Compte vérifié avec succès'
      });
    }

    // Resend code
    if (path === '/api/resend-code' && method === 'POST') {
      if (!supabaseClient) {
        return res.status(500).json({ error: 'Supabase non configuré' });
      }

      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email requis' });
      }

      // Rechercher l'utilisateur
      const { data: users, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('email', email)
        .limit(1);

      if (error) throw error;
      if (!users || users.length === 0) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      const user = users[0];
      
      if (user.is_verified) {
        return res.status(400).json({ error: 'Compte déjà vérifié' });
      }

      // Générer un nouveau code
      const crypto = require('crypto');
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Mettre à jour le code
      const { error: updateError } = await supabaseClient
        .from('users')
        .update({ 
          verification_code: verificationCode,
          verification_expires: verificationExpires.toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Envoyer le nouveau code par email
      try {
        await sendVerificationEmail(email, verificationCode);
      } catch (emailError) {
        console.error('❌ Erreur envoi email:', emailError);
        console.error('Code d\'erreur:', emailError.code);
        console.error('Message:', emailError.message);
        console.error('Stack:', emailError.stack);
        return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
      }

      return res.json({
        success: true,
        message: 'Nouveau code envoyé par email'
      });
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

    // Routes pour les projets
    if (path === '/api/projects' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          const { data: projects, error } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('status', 'active')
            .order('name');

          if (error) throw error;

          return res.json({
            success: true,
            items: projects || []
          });
        } catch (error) {
          console.error('Erreur projets:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Mettre à jour les jours permissionnaires pour un agent et un mois
    if (path === '/api/planifications/permissions' && method === 'PUT') {
      return authenticateToken(req, res, async () => {
        try {
          const { user_id, mois, jours_permission } = req.body;
          
          if (!user_id || !mois) {
            return res.status(400).json({
              success: false,
              error: 'Les champs user_id et mois sont obligatoires'
            });
          }

          // Vérifier que l'utilisateur a les droits
          if (req.user.role !== 'admin' && req.user.role !== 'superviseur') {
            return res.status(403).json({
              success: false,
              error: 'Non autorisé à modifier les permissions'
            });
          }

          // Vérifier que le mois est valide (premier jour du mois)
          const dateDebutMois = new Date(mois);
          dateDebutMois.setDate(1);
          
          // Mettre à jour ou insérer les jours de permission pour chaque jour du mois
          const joursDansMois = new Date(
            dateDebutMois.getFullYear(), 
            dateDebutMois.getMonth() + 1, 
            0
          ).getDate();

          // Mise à jour des jours de permission pour chaque jour du mois
          const { data: updatedPlanifications, error } = await supabaseClient
            .from('planifications')
            .update({ 
              jours_permission: jours_permission,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user_id)
            .gte('date', dateDebutMois.toISOString().split('T')[0])
            .lte('date', new Date(
              dateDebutMois.getFullYear(), 
              dateDebutMois.getMonth() + 1, 
              0
            ).toISOString().split('T')[0])
            .select('*');

          if (error) throw error;

          return res.json({
            success: true,
            message: 'Jours permissionnaires mis à jour avec succès',
            planifications: updatedPlanifications
          });

        } catch (error) {
          console.error('Erreur mise à jour permissions:', error);
          return res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour des permissions',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      });
    }

    // Récupérer les jours permissionnaires pour un agent et un mois
    if (path === '/api/planifications/permissions' && method === 'GET') {
      return authenticateToken(req, res, async () => {
        try {
          const { user_id, mois } = req.query;
          
          if (!user_id || !mois) {
            return res.status(400).json({
              success: false,
              error: 'Les paramètres user_id et mois sont obligatoires'
            });
          }

          // Vérifier que l'utilisateur a les droits
          if (req.user.role !== 'admin' && req.user.role !== 'superviseur' && req.user.id !== parseInt(user_id)) {
            return res.status(403).json({
              success: false,
              error: 'Non autorisé à consulter ces permissions'
            });
          }

          const dateDebutMois = new Date(mois);
          dateDebutMois.setDate(1);
          
          const dateFinMois = new Date(
            dateDebutMois.getFullYear(),
            dateDebutMois.getMonth() + 1,
            0
          );

          // Récupérer les jours permissionnaires pour le mois
          const { data: planifications, error } = await supabaseClient
            .from('planifications')
            .select('*')
            .eq('user_id', user_id)
            .gte('date', dateDebutMois.toISOString().split('T')[0])
            .lte('date', dateFinMois.toISOString().split('T')[0])
            .order('date', { ascending: true });

          if (error) throw error;

          // Si pas de planifications, retourner un tableau vide
          if (!planifications || planifications.length === 0) {
            return res.json({
              success: true,
              jours_permission: 0,
              planifications: []
            });
          }

          // Prendre la valeur de jours_permission de la première planification
          // (toutes les entrées du mois devraient avoir la même valeur)
          const joursPermission = planifications[0].jours_permission || 0;

          return res.json({
            success: true,
            jours_permission: joursPermission,
            planifications: planifications
          });

        } catch (error) {
          console.error('Erreur récupération permissions:', error);
          return res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des permissions',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      });
    }

    // Routes pour les planifications avec nouvelles fonctionnalités
    if (path === '/api/planifications' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          const { from, to, project_id, project_name, agent_id, departement, commune, resultat_journee, page, limit } = req.query;
          
          // Si page et limit sont spécifiés, utiliser la pagination, sinon récupérer toutes les données
          let usePagination = page && limit;
          const currentPage = parseInt(page) || 1;
          const pageLimit = parseInt(limit) || 1000; // Limite élevée par défaut
          const offset = (currentPage - 1) * pageLimit;
          
          // Récupérer les planifications sans embedding pour éviter le conflit de relations
          let query = supabaseClient
            .from('planifications')
            .select('*');

          // Logique de filtrage par rôle améliorée
          if (agent_id) {
            // Si un agent_id spécifique est demandé, l'utiliser
            query = query.eq('user_id', agent_id);
          } else if (req.user.role === 'admin') {
            // Les admins voient toutes les planifications
            // Pas de filtre par user_id
          } else if (req.user.role === 'superviseur') {
            // Les superviseurs voient seulement leurs propres planifications
            // et celles de leurs agents sous supervision
            query = query.eq('user_id', req.user.id);
          } else {
            // Les agents voient seulement leurs propres planifications
            query = query.eq('user_id', req.user.id);
          }

          if (from) query = query.gte('date', from);
          if (to) query = query.lte('date', to);
          // Supporter project_name (préféré) et project_id (rétro-compat)
          if (project_name) {
            query = query.eq('project_name', project_name);
          } else if (project_id) {
            query = query.eq('project_name', project_id);
          }

          // Filtre par résultat de journée si fourni
          if (resultat_journee) {
            query = query.eq('resultat_journee', resultat_journee);
          }

          // Filtres par département/commune via table users
          if (departement || commune) {
            // Récupérer les ids utilisateurs correspondant aux filtres
            let usersQ = supabaseClient.from('users').select('id');
            if (departement) usersQ = usersQ.eq('departement', departement);
            if (commune) usersQ = usersQ.eq('commune', commune);
            const { data: filteredUsers, error: usersError } = await usersQ;
            if (usersError) throw usersError;
            const userIds = (filteredUsers || []).map(u => u.id);
            // Si aucun utilisateur ne correspond, retourner vide immédiatement
            if (userIds.length === 0) {
              return res.json({
                success: true,
                items: [],
                pagination: {
                  current_page: currentPage,
                  total_pages: 0,
                  total_items: 0,
                  items_per_page: pageLimit,
                  has_next_page: false,
                  has_prev_page: false,
                  next_page: null,
                  prev_page: null
                }
              });
            }
            query = query.in('user_id', userIds);
          }

          // Si pagination demandée, compter le total
          let totalCount = null;
          if (usePagination) {
            const { count, error: countError } = await query
              .select('*', { count: 'exact', head: true });
            
            if (countError) throw countError;
            totalCount = count;
          }

          // Récupérer les données avec ou sans pagination
          let dataQuery = query.order('date', { ascending: false });
          
          if (usePagination) {
            dataQuery = dataQuery.range(offset, offset + pageLimit - 1);
          }
          
          const { data: planifications, error } = await dataQuery;

          if (error) throw error;

          // Enrichir avec les données utilisateurs séparément
          if (planifications && planifications.length > 0) {
            const userIds = [...new Set(planifications.map(p => p.user_id).filter(Boolean))];
            const { data: users, error: usersError } = await supabaseClient
              .from('users')
              .select('id, name, email, role')
              .in('id', userIds);

            if (usersError) {
              console.error('Erreur lors du chargement des utilisateurs:', usersError);
            }

            // Créer un map pour l'enrichissement
            const usersMap = new Map();
            (users || []).forEach(user => {
              // Utiliser directement la colonne name de la table users
              const displayName = user.name || user.email || `Agent ${user.id}`;
              
              usersMap.set(user.id, {
                ...user,
                name: displayName
              });
            });

            // Enrichir les planifications
            const enrichedPlanifications = planifications.map(plan => ({
              ...plan,
              user: usersMap.get(plan.user_id) || {
                id: plan.user_id,
                name: `Agent ${plan.user_id}`,
                email: '',
                role: 'agent',
                project_name: plan.project_name || 'Projet Général'
              }
            }));

            const totalPages = Math.ceil(totalCount / pageLimit);
            const hasNextPage = currentPage < totalPages;
            const hasPrevPage = currentPage > 1;

            return res.json({
              success: true,
              items: enrichedPlanifications,
              pagination: {
                current_page: currentPage,
                total_pages: totalPages,
                total_items: totalCount,
                items_per_page: pageLimit,
                has_next_page: hasNextPage,
                has_prev_page: hasPrevPage,
                next_page: hasNextPage ? currentPage + 1 : null,
                prev_page: hasPrevPage ? currentPage - 1 : null
              }
            });
          }

          // Retourner la réponse selon le mode (pagination ou non)
          if (usePagination) {
            const totalPages = Math.ceil(totalCount / pageLimit);
            const hasNextPage = currentPage < totalPages;
            const hasPrevPage = currentPage > 1;

            return res.json({
              success: true,
              items: enrichedPlanifications,
              pagination: {
                current_page: currentPage,
                total_pages: totalPages,
                total_items: totalCount,
                items_per_page: pageLimit,
                has_next_page: hasNextPage,
                has_prev_page: hasPrevPage,
                next_page: hasNextPage ? currentPage + 1 : null,
                prev_page: hasPrevPage ? currentPage - 1 : null
              }
            });
          } else {
            // Mode sans pagination - retourner directement les données
            return res.json(enrichedPlanifications);
          }
        } catch (error) {
          console.error('Erreur planifications:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Rapport mensuel IA pour un agent
    if (path === '/api/agents/monthly-report' && method === 'GET') {
      console.log('=== DÉBUT TRAITEMENT RAPPORT MENSUEL ===');
      console.log('Requête reçue avec les paramètres:', req.query);
      
      authenticateToken(req, res, async () => {
        try {
          const query = req.query || {};
          const agentId = query.agentId || query.agent_id;
          const monthValue = query.month || query.period || new Date().toISOString().slice(0, 7);
          
          console.log(`Génération du rapport pour l'agent ${agentId}, mois ${monthValue}`);
          
          // Valider l'ID de l'agent
          if (!agentId) {
            console.error('Erreur: Aucun ID agent fourni');
            return res.status(400).json({ 
              success: false, 
              error: 'ID agent requis dans les paramètres de requête' 
            });
          }
          
          // Vérifier que l'utilisateur a le droit d'accéder à ce rapport
          const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superviseur';
          const isOwnReport = String(req.user?.id) === String(agentId);
          
          if (!isAdmin && !isOwnReport) {
            console.error('Erreur: Accès non autorisé', { 
              userId: req.user?.id, 
              agentId,
              role: req.user?.role 
            });
            return res.status(403).json({ 
              success: false, 
              error: 'Accès non autorisé à ce rapport' 
            });
          }
          
          console.log('Récupération des données du rapport...');
          
          try {
            const projectName = (req.query.project_name || req.query.project || '')
              .toString()
              .trim() || null;
            const report = await buildAgentMonthlyReport({
              supabaseClient,
              agentId,
              monthValue,
              projectName,
              includeAiSummary: true,
              geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
              requester: req.user
            });
            
            console.log('Rapport généré avec succès');
            return res.json(report);
            
          } catch (reportError) {
            console.error('Erreur lors de la génération du rapport:', reportError);
            
            // Envoyer une réponse d'erreur plus détaillée en développement
            const errorResponse = {
              success: false,
              error: reportError.message || 'Erreur lors de la génération du rapport',
              stack: process.env.NODE_ENV === 'development' ? reportError.stack : undefined
            };
            
            // Ajouter des détails supplémentaires pour les erreurs connues
            if (reportError.message.includes('Agent introuvable')) {
              errorResponse.details = `Aucun agent trouvé avec l'ID: ${agentId}`;
            } else if (reportError.message.includes('données de présence')) {
              errorResponse.details = 'Aucune donnée de présence trouvée pour cette période';
            }
            
            return res.status(reportError.statusCode || 500).json(errorResponse);
          }
          
        } catch (error) {
          console.error('Erreur inattendue dans le gestionnaire de rapport mensuel:', error);
          
          // Envoyer une réponse d'erreur générique
          return res.status(500).json({
            success: false,
            error: 'Une erreur inattendue est survenue',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        } finally {
          console.log('=== FIN TRAITEMENT RAPPORT MENSUEL ===\n');
        }
      });
      return;
    }

    if (path === '/api/planifications' && method === 'POST') {
      authenticateToken(req, res, async () => {
        try {
          const { 
            date, 
            planned_start_time, 
            planned_end_time, 
            description_activite, 
            project_id,
            project_name,
            user_id
          } = req.body;

          if (!date) {
            return res.status(400).json({ error: 'Date requise' });
          }

          // Déterminer l'utilisateur cible: un admin/superviseur peut planifier pour un autre agent
          const targetUserId = (user_id && (req.user.role === 'admin' || req.user.role === 'superviseur'))
            ? user_id
            : req.user.id;

          const planificationData = {
            user_id: targetUserId,
            date,
            planned_start_time: planned_start_time || null,
            planned_end_time: planned_end_time || null,
            description_activite: description_activite || null,
            // Supporter project_name natif et rétro-compat project_id
            project_name: (project_name || project_id) || null,
            resultat_journee: null,
            observations: null
          };

          console.log('API /api/planifications POST: Données reçues:', req.body);
          console.log('API /api/planifications POST: Utilisateur authentifié:', req.user);
          console.log('API /api/planifications POST: Données de planification:', planificationData);

          // Vérifier que l'utilisateur cible existe
          const { data: targetUser, error: userError } = await supabaseClient
            .from('users')
            .select('id, name, role')
            .eq('id', targetUserId)
            .single();

          if (userError || !targetUser) {
            console.error('API /api/planifications POST: Utilisateur cible non trouvé:', targetUserId, userError);
            return res.status(400).json({ 
              error: 'Utilisateur cible non trouvé',
              details: `L'utilisateur avec l'ID ${targetUserId} n'existe pas`
            });
          }

          console.log('API /api/planifications POST: Utilisateur cible trouvé:', targetUser);

          // Solution directe : utiliser insert simple
          console.log('API /api/planifications POST: Tentative avec insert simple');
          const { data: planification, error } = await supabaseClient
            .from('planifications')
            .insert([planificationData])
            .select()
            .single();

          if (error) {
            console.error('API /api/planifications POST: Erreur Supabase:', error);
            console.error('API /api/planifications POST: Code d\'erreur:', error.code);
            console.error('API /api/planifications POST: Message d\'erreur:', error.message);
            console.error('API /api/planifications POST: Détails:', error.details);
            throw error;
          }

          console.log('API /api/planifications POST: Planification créée:', planification);

          return res.json({
            success: true,
            planification
          });
        } catch (error) {
          console.error('Erreur création planification:', error);
          return res.status(500).json({ 
            error: 'Erreur serveur',
            details: error.message,
            code: error.code
          });
        }
      });
      return;
    }

    // Route pour mettre à jour le résultat de journée
    if (path === '/api/planifications/result' && method === 'PUT') {
      authenticateToken(req, res, async () => {
        try {
          const { 
            date, 
            resultat_journee, 
            observations 
          } = req.body;

          if (!date) {
            return res.status(400).json({ error: 'Date requise' });
          }

          // Validation des résultats si fourni
          if (resultat_journee) {
            const validResults = ['realise', 'partiellement_realise', 'non_realise', 'en_cours'];
            if (!validResults.includes(resultat_journee)) {
              return res.status(400).json({ error: 'Résultat invalide' });
            }
          }

          const { data: planification, error } = await supabaseClient
            .from('planifications')
            .update({
              resultat_journee: resultat_journee || null,
              observations: observations || null,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', req.user.id)
            .eq('date', date)
            .select()
            .single();

          if (error) {
            console.error('Erreur Supabase:', error);
            throw error;
          }

          return res.json({
            success: true,
            planification
          });
        } catch (error) {
          console.error('Erreur mise à jour résultat:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Récupérer les utilisateurs par rôle (accessible avec authentification)
    if (path === '/api/users' && method === 'GET') {
      console.log('API /api/users: Requête reçue');
      
      // Vérifier si l'utilisateur est authentifié
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      console.log('API /api/users: Auth header:', authHeader ? 'Présent' : 'Absent');
      console.log('API /api/users: Token:', token ? 'Présent' : 'Absent');
      
      // Pour le debug, permettre l'accès sans token en mode développement
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      if (!token && !isDevelopment) {
        console.log('API /api/users: Aucun token fourni, retour 401');
        return res.status(401).json({ error: 'Token d\'accès requis' });
      }

      if (token) {
        try {
          // Vérifier le token JWT
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, JWT_SECRET);
          req.user = decoded;
          console.log('API /api/users: Token valide, utilisateur:', decoded.id);
        } catch (err) {
          console.log('API /api/users: Token invalide:', err.message);
          if (!isDevelopment) {
            return res.status(403).json({ error: 'Token invalide' });
          } else {
            console.log('API /api/users: Mode développement - continuation sans token valide');
          }
        }
      } else {
        console.log('API /api/users: Mode développement - accès sans token');
      }

      try {
        const { role } = req.query;
        
        console.log(`API /api/users: Début du chargement avec filtre role=${role || 'tous'}`);
        
        // D'abord, compter le total d'utilisateurs pour vérifier
        let countQuery = supabaseClient
          .from('users')
          .select('*', { count: 'exact', head: true });
        if (role) {
          countQuery = countQuery.eq('role', role);
        }
        
        const { count: totalUsers, error: countError } = await countQuery;
        if (countError) {
          console.error('Erreur lors du comptage des utilisateurs:', countError);
        } else {
          console.log(`API /api/users: Total d'utilisateurs dans la base: ${totalUsers}`);
        }
        
        // Récupérer tous les utilisateurs avec pagination
        let allUsers = [];
        let page = 0;
        const pageSize = 1000; // Taille de page importante pour réduire le nombre de requêtes
        let hasMore = true;
        
        while (hasMore) {
          const start = page * pageSize;
          const end = start + pageSize - 1;
          
          console.log(`API /api/users: Chargement page ${page + 1} (${start}-${end})`);
          
          let query = supabaseClient
            .from('users')
            .select('id, name, email, role, project_name, departement, commune, status, is_verified, photo_path')
            .order('id', { ascending: true })
            .range(start, end);
            
          if (role) {
            query = query.eq('role', role);
            console.log(`API /api/users: Filtre role appliqué: ${role}`);
          }
          
          const { data: users, error } = await query;
          
          if (error) {
            console.error(`API /api/users: Erreur page ${page + 1}:`, error);
            throw error;
          }
          
          console.log(`API /api/users: Page ${page + 1} - ${users?.length || 0} utilisateurs récupérés`);
          
          if (users && users.length > 0) {
            allUsers = [...allUsers, ...users];
            console.log(`API /api/users: Total cumulé: ${allUsers.length} utilisateurs`);
            
            // Si on a moins d'utilisateurs que la taille de page, on a atteint la fin
            hasMore = users.length === pageSize;
            console.log(`API /api/users: hasMore = ${hasMore} (${users.length} === ${pageSize})`);
            page++;
          } else {
            console.log(`API /api/users: Aucun utilisateur trouvé sur la page ${page + 1}, arrêt de la pagination`);
            hasMore = false;
          }
        }
        
        console.log(`API /api/users: Chargement terminé - ${allUsers.length} utilisateurs récupérés au total`);
        
        // Vérifier si on a récupéré tous les utilisateurs attendus
        if (totalUsers && allUsers.length < totalUsers) {
          console.warn(`⚠️ ATTENTION: Seulement ${allUsers.length} utilisateurs récupérés sur ${totalUsers} attendus`);
        }
        
        if (allUsers.length > 0) {
          const roleCounts = allUsers.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
          }, {});
          console.log('Répartition des rôles:', roleCounts);
          
          // Afficher quelques exemples d'utilisateurs pour debug
          console.log('Exemples d\'utilisateurs récupérés:');
          allUsers.slice(0, 5).forEach((user, index) => {
            console.log(`  ${index + 1}. ID: ${user.id}, Name: ${user.name}, Role: ${user.role}, Email: ${user.email}`);
          });
        }
        
        return res.json(allUsers);
        
      } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        return res.status(500).json({ 
          error: 'Erreur serveur lors de la récupération des utilisateurs',
          details: error.message 
        });
      }
    }

    // Routes pour les utilisateurs par projet
    if (path === '/api/projects/users' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          const { project_id } = req.query;
          
          if (!project_id) {
            return res.status(400).json({ error: 'ID du projet requis' });
          }

          const { data: users, error } = await supabaseClient
            .from('user_projects')
            .select(`
              *,
              users(id, name, email, role),
              projects(name)
            `)
            .eq('project_id', project_id);

          if (error) throw error;

          return res.json({
            success: true,
            items: users || []
          });
        } catch (error) {
          console.error('Erreur utilisateurs projet:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Route pour obtenir les projets d'un utilisateur
    if (path === '/api/user/projects' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          const { data: userProjects, error } = await supabaseClient
            .from('user_projects')
            .select(`
              *,
              projects(id, name, description, status)
            `)
            .eq('user_id', req.user.id);

          if (error) throw error;

          return res.json({
            success: true,
            items: userProjects || []
          });
        } catch (error) {
          console.error('Erreur projets utilisateur:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Route pour les statistiques par projet
    if (path === '/api/projects/stats' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          const { project_id, from, to } = req.query;
          
          if (!project_id) {
            return res.status(400).json({ error: 'ID du projet requis' });
          }

          let query = supabaseClient
            .from('planifications')
            .select(`
              *,
              users(name, email)
            `)
            .eq('project_id', project_id);

          if (from) query = query.gte('date', from);
          if (to) query = query.lte('date', to);

          const { data: planifications, error } = await query;

          if (error) throw error;

          // Calculer les statistiques
          const stats = {
            total_planifiees: planifications.length,
            realisees: planifications.filter(p => p.resultat_journee === 'realise').length,
            partiellement_realisees: planifications.filter(p => p.resultat_journee === 'partiellement_realise').length,
            non_realisees: planifications.filter(p => p.resultat_journee === 'non_realise').length,
            en_cours: planifications.filter(p => p.resultat_journee === 'en_cours').length,
            sans_resultat: planifications.filter(p => !p.resultat_journee).length
          };

          return res.json({
            success: true,
            stats,
            planifications: planifications || []
          });
        } catch (error) {
          console.error('Erreur statistiques projet:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Route pour le récap hebdomadaire des planifications
    if (path === '/api/planifications/weekly-summary' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          const { from, to, project_name, agent_id } = req.query;
          
          // Générer le récap hebdomadaire depuis les planifications
          let query = supabaseClient
            .from('planifications')
            .select('*');

          // Filtrer par utilisateur si agent_id est spécifié
          if (agent_id) {
            query = query.eq('user_id', agent_id);
          } else if (req.user.role === 'admin' || req.user.role === 'superviseur') {
            // Les admins et superviseurs voient toutes les planifications
            // Pas de filtre par user_id
          } else {
            // Les agents voient seulement leurs propres planifications
            query = query.eq('user_id', req.user.id);
          }

          if (from) query = query.gte('date', from);
          if (to) query = query.lte('date', to);
          if (project_name) {
            query = query.eq('project_name', project_name);
          }

          const { data: planifications, error } = await query.order('date', { ascending: false });

          if (error) throw error;

          // Enrichir avec les données utilisateurs séparément
          if (planifications && planifications.length > 0) {
            const userIds = [...new Set(planifications.map(p => p.user_id).filter(Boolean))];
            const { data: users } = await supabaseClient
              .from('users')
              .select('id, name, email, role, project_name')
              .in('id', userIds);

            const usersMap = new Map(users.map(u => [u.id, u]));
            const enrichedPlanifications = planifications.map(plan => ({
              ...plan,
              user: usersMap.get(plan.user_id) || null
            }));

            // Fonction pour calculer le début de semaine
            function startOfWeek(date) {
              const d = new Date(date);
              const day = d.getDay();
              const diff = (day === 0 ? -6 : 1) - day;
              d.setDate(d.getDate() + diff);
              return d;
            }

            // Grouper par semaine et agent
            const weeklySummary = {};
            enrichedPlanifications.forEach(plan => {
              const planDate = new Date(plan.date);
              const weekStart = startOfWeek(planDate);
              const weekKey = `${plan.user_id}_${weekStart.toISOString().split('T')[0]}`;
              
              if (!weeklySummary[weekKey]) {
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                
                weeklySummary[weekKey] = {
                  user_id: plan.user_id,
                  users: {
                    name: plan.user ? plan.user.name : `Utilisateur ${plan.user_id}`,
                    email: plan.user ? plan.user.email : ''
                  },
                  week_start_date: weekStart.toISOString().split('T')[0],
                  week_end_date: weekEnd.toISOString().split('T')[0],
                  project_name: plan.project_name || 'Aucun',
                  total_planned_hours: 0,
                  total_planned_days: new Set(),
                  activities_summary: []
                };
              }
              
              // Calculer les heures planifiées
              if (plan.planned_start_time && plan.planned_end_time) {
                const start = new Date(`2000-01-01T${plan.planned_start_time}`);
                const end = new Date(`2000-01-01T${plan.planned_end_time}`);
                const hours = (end - start) / (1000 * 60 * 60);
                weeklySummary[weekKey].total_planned_hours += hours;
              }
              
              weeklySummary[weekKey].total_planned_days.add(plan.date);
              
              // Ajouter l'activité au résumé
              if (plan.description_activite) {
                const dateStr = new Date(plan.date).toLocaleDateString('fr-FR', { 
                  weekday: 'short', 
                  day: 'numeric' 
                });
                weeklySummary[weekKey].activities_summary.push(`${dateStr}: ${plan.description_activite}`);
              }
            });

            // Convertir en array et formater
            const summaryArray = Object.values(weeklySummary).map(summary => ({
              user_id: summary.user_id,
              users: summary.users,
              week_start_date: summary.week_start_date,
              week_end_date: summary.week_end_date,
              project_name: summary.project_name,
              total_planned_hours: Math.round(summary.total_planned_hours * 10) / 10, // Arrondir à 1 décimale
              total_planned_days: summary.total_planned_days.size,
              activities_summary: summary.activities_summary.join(' | ')
            }));

            return res.json({
              success: true,
              items: summaryArray
            });
          }

          return res.json({
            success: true,
            items: []
          });
        } catch (error) {
          console.error('Erreur récap hebdomadaire:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Rapports - Validations de présence (endpoint supprimé - utiliser server.js à la place)
    // Cet endpoint est géré par server.js avec checkin_validations

    // Admin - Liste des agents avec pagination
    if (path === '/api/admin/agents' && method === 'GET') {
      console.log('🔍 Endpoint /api/admin/agents appelé');
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          // Vérifier que l'utilisateur est admin ou superviseur
          if (req.user.role !== 'admin' && req.user.role !== 'superviseur') {
            return res.status(403).json({ error: 'Accès refusé' });
          }

          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 50;
          const offset = (page - 1) * limit;

          // Compter le total d'agents
          const { count: totalCount, error: countError } = await supabaseClient
            .from('users')
            .select('*', { count: 'exact', head: true });

          if (countError) throw countError;

          // Récupérer les agents avec pagination
          const { data: agents, error } = await supabaseClient
            .from('users')
            .select(`
              id, name, email, role, phone, status, created_at, is_verified
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (error) throw error;

          const totalPages = Math.ceil(totalCount / limit);
          const hasNextPage = page < totalPages;
          const hasPrevPage = page > 1;

          return res.json({
            success: true,
            data: agents || [],
            pagination: {
              current_page: page,
              total_pages: totalPages,
              total_items: totalCount,
              items_per_page: limit,
              has_next_page: hasNextPage,
              has_prev_page: hasPrevPage,
              next_page: hasNextPage ? page + 1 : null,
              prev_page: hasPrevPage ? page - 1 : null
            }
          });
        } catch (error) {
          console.error('Erreur récupération agents:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Admin - Créer un agent
    if (path === '/api/admin/agents' && method === 'POST') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          // Vérifier que l'utilisateur est admin
          if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Accès refusé' });
          }

          const { 
            name, email, password, first_name, last_name, phone, role = 'agent',
            project_name, project_description, planning_start_date, planning_end_date,
            expected_days_per_month, expected_hours_per_month, work_schedule, contract_type,
            ref_lat, ref_lon, tolerance, gps_accuracy, observations,
            departement, commune, arrondissement, village
          } = req.body;

          if (!email || !name) {
            return res.status(400).json({ error: 'Email et nom requis' });
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
          const passwordHash = await bcrypt.hash(password || '123456', 10);

          const { data: newAgent, error: insertError } = await supabaseClient
            .from('users')
            .insert([{
              name,
              email,
              password_hash: passwordHash,
              first_name,
              last_name,
              phone,
              role,
              project_name,
              project_description,
              planning_start_date,
              planning_end_date,
              expected_days_per_month: expected_days_per_month ? parseInt(expected_days_per_month) : null,
              expected_hours_per_month: expected_hours_per_month ? parseInt(expected_hours_per_month) : null,
              work_schedule,
              contract_type,
              reference_lat: ref_lat ? parseFloat(ref_lat) : null,
              reference_lon: ref_lon ? parseFloat(ref_lon) : null,
              tolerance_radius_meters: tolerance ? parseInt(tolerance) : null,
              gps_accuracy,
              observations,
              departement,
              commune,
              arrondissement,
              village,
              is_verified: true,
              status: 'active'
            }])
            .select()
            .single();

          if (insertError) throw insertError;

          return res.json({
            success: true,
            data: newAgent
          });
        } catch (error) {
          console.error('Erreur création agent:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Admin - Modifier un agent
    if (path.startsWith('/api/admin/agents/') && method === 'PUT') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          // Vérifier que l'utilisateur est admin
          if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Accès refusé' });
          }

          const agentId = path.split('/').pop();
          const { 
            name, email, password, first_name, last_name, phone, role,
            project_name, project_description, planning_start_date, planning_end_date,
            expected_days_per_month, expected_hours_per_month, work_schedule, contract_type,
            ref_lat, ref_lon, tolerance, gps_accuracy, observations,
            departement, commune, arrondissement, village
          } = req.body;

          const updateData = {
            name,
            email,
            first_name,
            last_name,
            phone,
            role,
            project_name,
            project_description,
            planning_start_date,
            planning_end_date,
            expected_days_per_month: expected_days_per_month ? parseInt(expected_days_per_month) : null,
            expected_hours_per_month: expected_hours_per_month ? parseInt(expected_hours_per_month) : null,
            work_schedule,
            contract_type,
            reference_lat: ref_lat ? parseFloat(ref_lat) : null,
            reference_lon: ref_lon ? parseFloat(ref_lon) : null,
            tolerance_radius_meters: tolerance ? parseInt(tolerance) : null,
            gps_accuracy,
            observations,
            departement,
            commune,
            arrondissement,
            village
          };

          // Ajouter le mot de passe seulement s'il est fourni
          if (password) {
            const bcrypt = require('bcrypt');
            updateData.password_hash = await bcrypt.hash(password, 10);
          }

          const { data: updatedAgent, error: updateError } = await supabaseClient
            .from('users')
            .update(updateData)
            .eq('id', agentId)
            .select()
            .single();

          if (updateError) throw updateError;

          return res.json({
            success: true,
            data: updatedAgent
          });
        } catch (error) {
          console.error('Erreur modification agent:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Admin - Supprimer un agent
    if (path.startsWith('/api/admin/agents/') && method === 'DELETE') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          // Vérifier que l'utilisateur est admin
          if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Accès refusé' });
          }

          const agentId = path.split('/').pop();

          const { error: deleteError } = await supabaseClient
            .from('users')
            .delete()
            .eq('id', agentId);

          if (deleteError) throw deleteError;

          return res.json({
            success: true,
            message: 'Agent supprimé avec succès'
          });
        } catch (error) {
          console.error('Erreur suppression agent:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // ===== NOUVELLES FONCTIONNALITÉS AVANCÉES =====

    // Messages - Récupérer les messages
    if (path === '/api/messages' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: messages, error } = await supabaseClient
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(name, email),
              recipient:users!messages_receiver_id_fkey(name, email)
            `)
            .or(`sender_id.eq.${req.user.id},receiver_id.eq.${req.user.id}`)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return res.json({ success: true, messages });
        } catch (error) {
          console.error('Erreur récupération messages:', error);
          // Return the actual error message for debugging
          return res.status(500).json({ error: 'Erreur serveur', details: error.message });
        }
      });
      return;
    }

    // Messages - Envoyer un message
    if (path === '/api/messages' && method === 'POST') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { recipient_id, content, message_type = 'text', forum_category_id } = req.body;

          if (!content) {
            return res.status(400).json({ error: 'Contenu du message requis' });
          }

          // Determine if it's a direct message or a forum message
          let messagePayload = {
            sender_id: req.user.id,
            content,
            message_type,
            status: 'sent'
          };

          if (message_type === 'forum') {
            if (!forum_category_id) {
              return res.status(400).json({ error: 'ID de catégorie de forum requis pour les messages de forum' });
            }
            messagePayload.forum_category_id = forum_category_id;
            messagePayload.receiver_id = null; // Explicitly set to null for forum messages
          } else { // Default to direct message
            if (!recipient_id) {
              return res.status(400).json({ error: 'Destinataire requis pour les messages directs' });
            }
            messagePayload.receiver_id = recipient_id;
          }

          const { data: message, error } = await supabaseClient
            .from('messages')
            .insert([messagePayload])
            .select()
            .single();

          if (error) throw error;

          return res.json({ success: true, message });
        } catch (error) {
          console.error('Erreur envoi message:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Notifications - Récupérer les notifications
    if (path === '/api/notifications' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: notifications, error } = await supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return res.json({ success: true, notifications });
        } catch (error) {
          console.error('Erreur récupération notifications:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Notifications - Marquer comme lu
    if (path.startsWith('/api/notifications/') && method === 'PUT') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const notificationId = path.split('/').pop();

          const { data: notification, error } = await supabaseClient
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .eq('user_id', req.user.id)
            .select()
            .single();

          if (error) throw error;

          return res.json({ success: true, notification });
        } catch (error) {
          console.error('Erreur marquage notification:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Badges - Récupérer les badges de l'utilisateur
    if (path === '/api/badges' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: userBadges, error } = await supabaseClient
            .from('user_badges')
            .select(`
              *,
              badge:badges(*)
            `)
            .eq('user_id', req.user.id)
            .order('earned_at', { ascending: false });

          if (error) throw error;

          return res.json({ success: true, badges: userBadges });
        } catch (error) {
          console.error('Erreur récupération badges:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Objectifs personnels - Récupérer les objectifs
    if (path === '/api/goals' && method === 'GET') {
      return authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: goals, error } = await supabaseClient
            .from('personal_goals')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return res.json({ success: true, goals });
        } catch (error) {
          console.error('Erreur récupération objectifs:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
    }

    // Récupérer la liste des agents et superviseurs
    if (path === '/api/agents' && method === 'GET') {
      // Utiliser le middleware d'authentification
      return authenticateToken(req, res, async () => {
        console.log('=== ROUTE /api/agents APPELÉE ===');
        console.log('Méthode:', method);
        console.log('Utilisateur authentifié:', req.user);
        console.log('Récupération des agents et superviseurs...');
        
        try {
        // Vérifier la configuration de Supabase
        if (!supabaseClient) {
          console.error('❌ Supabase non configuré - Vérifiez les variables d\'environnement');
          return res.status(500).json({ 
            success: false, 
            error: 'Configuration de la base de données manquante',
            details: process.env.NODE_ENV === 'development' ? 'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis' : undefined
          });
        }

        // Vérifier la connexion à Supabase
        const { data: healthCheck, error: healthError } = await supabaseClient
          .from('users')
          .select('count', { count: 'exact', head: true });
          
        if (healthError) {
          console.error('❌ Erreur de connexion à Supabase:', healthError);
          return res.status(500).json({
            success: false,
            error: 'Impossible de se connecter à la base de données',
            details: process.env.NODE_ENV === 'development' ? healthError.message : undefined
          });
        }

        // Récupérer les utilisateurs avec le rôle 'agent', 'superviseur' ou sans rôle défini
        const { data: users, error } = await supabaseClient
          .from('users')
          .select('*')
          .or('role.eq.agent,role.eq.superviseur,role.eq.supervisor,role.is.null')
          .order('role', { ascending: true })
          .order('name', { ascending: true });

        if (error) {
          console.error('❌ Erreur lors de la récupération des utilisateurs:', error);
          return res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la récupération des utilisateurs',
            code: 'DB_QUERY_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }

        if (!users || users.length === 0) {
          console.warn('ℹ️ Aucun utilisateur trouvé dans la base de données');
          return res.json([]);
        }

        console.log(`✅ ${users.length} utilisateurs récupérés avec succès`);

        // Formater les données des utilisateurs
        const formattedUsers = users
          .filter(user => user && user.id) // Filtrer les entrées invalides
          .map(user => {
            try {
              // Normaliser le rôle
              const role = (user.role || 'agent').toLowerCase().trim();
              const normalizedRole = role === 'supervisor' ? 'superviseur' :
                                  role === 'admin' ? 'admin' : 'agent';

              const email = user.email || '';
              const name = user.name || email.split('@')[0] || `Utilisateur ${user.id}`;

              // S'assurer que les champs requis existent
              const formattedUser = {
                id: Number(user.id) || 0,
                name: name,
                email: email,
                role: normalizedRole,
                status: user.status || 'active',
                is_verified: Boolean(user.is_verified),
                created_at: user.created_at || new Date().toISOString()
              };

              // Ajouter des champs supplémentaires si disponibles
              if (user.phone) formattedUser.phone = user.phone;

              return formattedUser;
              
            } catch (formatError) {
              console.error('⚠️ Erreur de formatage utilisateur:', formatError, 'Données utilisateur:', user);
              return null;
            }
          })
          .filter(Boolean); // Filtrer les entrées nulles en cas d'erreur de formatage

        console.log(`✅ ${formattedUsers.length} utilisateurs formatés avec succès`);
        return res.json(formattedUsers);
        
      } catch (error) {
        console.error('❌ Erreur inattendue lors du traitement de la requête:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Erreur serveur inattendue',
          code: 'INTERNAL_SERVER_ERROR',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });
    return;
    }
    
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

  // Vérifier la présence pour aujourd'hui
  if (path === '/api/presence/check-today' && method === 'GET') {
      console.log('=== ENDPOINT /api/presence/check-today APPELÉ ===');
      
      try {
        const { email } = req.query;
        
        // Validation de l'email
        if (!email) {
          console.warn('❌ Email manquant dans la requête');
          return res.status(200).json({ 
            success: true,
            has_presence: false,
            _debug: 'Email manquant, présence non vérifiée'
          });
        }

        console.log(`🔍 Vérification de la présence pour l'email: ${email}`);

        // Vérification de la configuration de Supabase
        if (!supabaseClient) {
          console.warn('⚠️ Supabase non configuré, retour de l\'état par défaut (non présent)');
          return res.status(200).json({ 
            success: true, 
            has_presence: false,
            _debug: 'Supabase non configuré, état par défaut utilisé'
          });
        }

        try {
          // Vérifier d'abord si l'utilisateur existe
          const { data: user, error: userError } = await supabaseClient
            .from('users')
            .select('id, email, name')
            .eq('email', email)
            .single();
            
          if (userError || !user) {
            console.warn(`⚠️ Utilisateur non trouvé avec l'email: ${email}`);
            return res.status(200).json({
              success: true,
              has_presence: false,
              _debug: 'Utilisateur non trouvé',
              user: { email }
            });
          }

          console.log(`👤 Utilisateur trouvé: ${user.name} (${user.email})`);
          
          // Définir la plage de temps pour aujourd'hui (00:00:00 à 23:59:59.999)
          const now = new Date();
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          
          const todayEnd = new Date(now);
          todayEnd.setHours(23, 59, 59, 999);
          
          console.log(`📅 Vérification des présences entre ${todayStart.toISOString()} et ${todayEnd.toISOString()}`);
          
          try {
            // Vérifier les présences pour aujourd'hui
            const { data: presence, error: presenceError } = await supabaseClient
              .from('presence')
              .select('id, check_in, check_out, status, location')
              .eq('user_id', user.id)
              .gte('check_in', todayStart.toISOString())
              .lte('check_in', todayEnd.toISOString())
              .order('check_in', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (presenceError) {
              console.error('❌ Erreur lors de la vérification de la présence:', presenceError);
              return res.status(200).json({
                success: true,
                has_presence: false,
                _debug: 'Erreur lors de la vérification de la présence',
                user: {
                  id: user.id,
                  name: user.name,
                  email: user.email
                }
              });
            }

            // Vérifier si une présence a été trouvée
            const hasPresence = !!presence && !!presence.id;
            
            return res.status(200).json({
              success: true,
              has_presence: hasPresence,
              checkin_data: hasPresence ? presence : null,
              user: {
                id: user.id,
                name: user.name,
                email: user.email
              },
              _debug: hasPresence ? 'Présence trouvée' : 'Aucune présence trouvée pour aujourd\'hui'
            });
            
          } catch (dbError) {
            console.error('Erreur base de données:', dbError);
            return res.status(200).json({
              success: true,
              has_presence: false,
              _debug: 'Erreur lors de l\'accès à la base de données',
              error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
            });
          }
          
        } catch (userError) {
          console.error('Erreur lors de la récupération de l\'utilisateur:', userError);
          return res.status(200).json({
            success: true,
            has_presence: false,
            _debug: 'Erreur lors de la vérification de l\'utilisateur'
          });
        }
        
      } catch (error) {
        console.error('Erreur serveur lors de la vérification de la présence:', error);
        return res.status(200).json({
          success: true,
          has_presence: false,
          _debug: 'Erreur serveur lors de la vérification de la présence',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }

    // Marquer un agent comme absent pour une date donnée
    // POST /api/presence/mark-absent
    // Body: { 
    //   date: '2023-11-26',
    //   email: 'user@example.com'
    // }
    if (path === '/api/presence/mark-absent' && method === 'POST') {
      return authenticateToken(req, res, async () => {
        try {
          console.log('🔵 POST /api/presence/mark-absent - Début du traitement');

          // Récupération des données du corps de la requête
          let bodyData = {};
          try {
            if (req.body && typeof req.body === 'string') {
              bodyData = JSON.parse(req.body);
            } else if (req.body) {
              bodyData = req.body;
            }
          } catch (e) {
            console.warn('Erreur parsing body:', e);
            return res.status(400).json({
              success: false,
              error: 'Format de requête invalide. Le corps doit être un JSON valide.'
            });
          }
          
          const { date, email } = bodyData;

          console.log('🔍 Données reçues:', { email, date });

          // Validation de l'email
          if (!email || typeof email !== 'string' || !email.includes('@')) {
            console.log('❌ Email invalide ou manquant dans le corps de la requête');
            return res.status(400).json({
              success: false,
              error: 'Un email valide est requis dans le corps de la requête (champ "email")'
            });
          }

          // Validation de la date
          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            console.log('❌ Date manquante ou format invalide (attendu: YYYY-MM-DD)');
            return res.status(400).json({
              success: false,
              error: 'Une date valide est requise dans le corps de la requête (format: YYYY-MM-DD)'
            });
          }

          // Vérification de la date (ne pas permettre les dates futures)
          const today = new Date().toISOString().split('T')[0];
          if (date > today) {
            console.log('❌ Date future non autorisée');
            return res.status(400).json({
              success: false,
              error: 'La date ne peut pas être dans le futur'
            });
          }

          // Vérifier si l'utilisateur existe
          console.log(`🔍 Recherche de l'utilisateur avec l'email: ${email}`);
          const { data: user, error: userError } = await supabaseClient
            .from('users')
            .select('id, email, name')
            .eq('email', email)
            .maybeSingle();

          // Gestion des erreurs de requête
          if (userError) {
            console.error('❌ Erreur lors de la recherche de l\'utilisateur:', userError);
            return res.status(500).json({
              success: false,
              error: 'Erreur serveur lors de la recherche de l\'utilisateur',
              details: process.env.NODE_ENV === 'development' ? userError.message : undefined
            });
          }

          // Vérification de l'existence de l'utilisateur
          if (!user) {
            console.log(`❌ Aucun utilisateur trouvé avec l'email: ${email}`);
            return res.status(404).json({
              success: false,
              error: 'Aucun utilisateur trouvé avec cet email',
              details: process.env.NODE_ENV === 'development' ? `Email: ${email}` : undefined
            });
          }

          console.log(`✅ Utilisateur trouvé:`, {
            id: user.id,
            name: user.name || 'Non renseigné',
            email: user.email
          });

          // Vérifier si une entrée existe déjà pour cette date
          console.log(`🔍 Vérification des entrées existantes pour le ${date}`);
          const { data: existing, error: existingError } = await supabaseClient
            .from('presences')
            .select('id, status, notes')
            .eq('user_id', user.id)
            .eq('date', date)
            .maybeSingle();

          if (existingError) {
            console.error('❌ Erreur lors de la vérification des entrées existantes:', existingError);
            return res.status(500).json({
              success: false,
              error: 'Erreur lors de la vérification des entrées existantes',
              details: process.env.NODE_ENV === 'development' ? existingError.message : undefined
            });
          }

          // Si une entrée existe déjà
          if (existing) {
            console.log(`ℹ️ Une entrée existe déjà pour cette date (ID: ${existing.id}, Statut: ${existing.status})`);
            return res.status(409).json({
              success: false,
              error: 'Une entrée existe déjà pour cette date',
              data: {
                id: existing.id,
                status: existing.status,
                notes: existing.notes,
                date: date
              },
              message: 'Utilisez la méthode PUT pour mettre à jour cette entrée'
            });
          }

          // Créer une nouvelle entrée d'absence
          console.log(`➕ Création d'une nouvelle entrée d'absence pour le ${date}`);

          const newAbsenceData = {
            user_id: user.id,
            date,
            status: 'absent',
            check_in: null,
            check_out: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            notes: 'Marqué comme absent automatiquement',
            validated: false,
            created_by: req.user?.id || 'system'
          };

          console.log('📝 Données de l\'absence:', newAbsenceData);

          const { data: newAbsence, error: createError } = await supabaseClient
            .from('presences')
            .insert(newAbsenceData)
            .select()
            .single();

          if (createError) {
            console.error('❌ Erreur lors de la création de l\'absence:', createError);

            // Gestion spécifique des erreurs de contrainte
            if (createError.code === '23505') {
              return res.status(409).json({
                success: false,
                error: 'Une entrée existe déjà pour cette date et cet utilisateur',
                details: process.env.NODE_ENV === 'development' ? createError.message : undefined
              });
            }

            // Autres erreurs
            return res.status(500).json({
              success: false,
              error: 'Erreur lors de la création de l\'absence',
              details: process.env.NODE_ENV === 'development' ? createError.message : undefined,
              code: createError.code
            });
          }

          console.log('✅ Absence enregistrée avec succès:', newAbsence?.id);
          return res.status(201).json({
            success: true,
            message: 'Absence enregistrée avec succès',
            data: newAbsence
          });

        } catch (error) {
          console.error('❌ Erreur inattendue dans /api/presence/mark-absent:', {
            message: error.message,
            stack: error.stack,
            query: req.query,
            body: req.body,
            timestamp: new Date().toISOString()
          });

          const errorResponse = {
            success: false,
            error: 'Une erreur inattendue est survenue',
            timestamp: new Date().toISOString()
          };

          if (process.env.NODE_ENV === 'development') {
            errorResponse.details = {
              message: error.message,
              name: error.name,
              stack: error.stack,
              code: error.code
            };
          }

          return res.status(500).json(errorResponse);
        }
      });
    }

    // Rapports enrichis - Récupérer les rapports
    if (path === '/api/enriched-reports' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: reports, error } = await supabaseClient
            .from('enriched_reports')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return res.json({ success: true, reports });
        } catch (error) {
          console.error('Erreur récupération rapports enrichis:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Tutoriels - Récupérer les tutoriels
    if (path === '/api/tutorials' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: tutorials, error } = await supabaseClient
            .from('tutorials')
            .select('*')
            .order('order_index', { ascending: true });

          if (error) throw error;

          return res.json({ success: true, tutorials });
        } catch (error) {
          console.error('Erreur récupération tutoriels:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Progression des tutoriels - Récupérer la progression
    if (path === '/api/tutorial-progress' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: progress, error } = await supabaseClient
            .from('tutorial_progress')
            .select(`
              *,
              tutorial:tutorials(*)
            `)
            .eq('user_id', req.user.id);

          if (error) throw error;

          return res.json({ success: true, progress });
        } catch (error) {
          console.error('Erreur récupération progression:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Progression des tutoriels - Mettre à jour la progression
    if (path === '/api/tutorial-progress' && method === 'POST') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { tutorial_id, completed, completion_percentage } = req.body;

          if (!tutorial_id) {
            return res.status(400).json({ error: 'ID tutoriel requis' });
          }

          const { data: progress, error } = await supabaseClient
            .from('tutorial_progress')
            .upsert({
              user_id: req.user.id,
              tutorial_id,
              completed: completed || false,
              completion_percentage: completion_percentage || 0,
              last_accessed_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) throw error;

          return res.json({ success: true, progress });
        } catch (error) {
          console.error('Erreur mise à jour progression:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Alertes d'urgence - Récupérer les alertes
    if (path === '/api/emergency/alerts' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: alerts, error } = await supabaseClient
            .from('emergency_alerts')
            .select(`
              *,
              user:users(name, email, phone)
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return res.json({ success: true, alerts });
        } catch (error) {
          console.error('Erreur récupération alertes:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Alertes d'urgence - Créer une alerte
if (path === '/api/emergency/alerts' && method === 'POST') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { alert_type, message, location, priority = 'high' } = req.body;

          if (!alert_type || !message) {
            return res.status(400).json({ error: 'Type et message requis' });
          }

          const { data: alert, error } = await supabaseClient
            .from('emergency_alerts')
            .insert({
              user_id: req.user.id,
              alert_type,
              message,
              location,
              priority,
              status: 'active'
            })
            .select()
            .single();

          if (error) throw error;

          return res.json({ success: true, alert });
        } catch (error) {
          console.error('Erreur création alerte:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Contacts d'urgence - Récupérer les contacts
    if (path === '/api/emergency/contacts' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: contacts, error } = await supabaseClient
            .from('emergency_contacts')
            .select('*')
            .eq('user_id', req.user.id)
            .order('name');

          if (error) throw error;

          return res.json({ success: true, contacts });
        } catch (error) {
          console.error('Erreur récupération contacts:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Prédictions - Récupérer les prédictions
    if (path === '/api/predictions' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: predictions, error } = await supabaseClient
            .from('predictions')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return res.json({ success: true, predictions });
        } catch (error) {
          console.error('Erreur récupération prédictions:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Synchronisation hors-ligne - Récupérer les données
    if (path === '/api/offline-sync' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: syncData, error } = await supabaseClient
            .from('offline_sync')
            .select('*')
            .eq('user_id', req.user.id)
            .order('last_sync', { ascending: false });

          if (error) throw error;

          return res.json({ success: true, syncData });
        } catch (error) {
          console.error('Erreur récupération sync:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Types de rapports - Récupérer les types
    if (path === '/api/report-types' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: reportTypes, error } = await supabaseClient
            .from('report_types')
            .select('*')
            .order('name');

          if (error) throw error;

          return res.json({ success: true, reportTypes });
        } catch (error) {
          console.error('Erreur récupération types rapports:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Messages - Récupérer les messages du forum
if (path.startsWith('/api/messages/forum/') && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const categoryId = path.split('/').pop(); // Extract categoryId from URL

          const { data: messages, error } = await supabaseClient
            .from('messages')
            .select(`
              *,
              sender:agents!messages_sender_id_fkey(first_name, last_name, email)
            `)
            .eq('message_type', 'forum')
            .eq('forum_category_id', categoryId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return res.json({ success: true, messages });
        } catch (error) {
          console.error('Erreur récupération messages du forum:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      });
      return;
    }

    // ===== ENDPOINTS MANQUANTS POUR MESSAGERIE =====

    // Endpoint pour le statut en ligne des utilisateurs
    if (path === '/api/users/online' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: users, error } = await supabaseClient
            .from('users')
            .select('id, name, email, last_seen, is_online')
            .eq('is_online', true)
            .order('last_seen', { ascending: false });

          if (error) throw error;

          return res.json({ success: true, users });
        } catch (error) {
          console.error('Erreur récupération utilisateurs en ligne:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour mettre à jour le statut en ligne
    if (path === '/api/users/online' && method === 'POST') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { is_online } = req.body;
          
          const { error } = await supabaseClient
            .from('users')
            .update({ 
              is_online: is_online || false,
              last_seen: new Date().toISOString()
            })
            .eq('id', req.user.id);

          if (error) throw error;

          return res.json({ success: true });
        } catch (error) {
          console.error('Erreur mise à jour statut en ligne:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les catégories de forum
    if (path === '/api/forum/categories' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          // Pour l'instant, retourner des catégories fictives
          const categories = [
            {
              id: 1,
              name: 'Général',
              description: 'Discussions générales',
              message_count: 0,
              last_message: null
            },
            {
              id: 2,
              name: 'Annonces',
              description: 'Annonces importantes',
              message_count: 0,
              last_message: null
            },
            {
              id: 3,
              name: 'Support',
              description: 'Aide et support technique',
              message_count: 0,
              last_message: null
            }
          ];
          
          return res.json({ success: true, categories });
        } catch (error) {
          console.error('Erreur récupération catégories forum:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les messages (GET)
    if (path === '/api/messages' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: messages, error } = await supabaseClient
            .from('messages')
            .select(`
              *,
              sender:agents!messages_sender_id_fkey(first_name, last_name, email),
              recipient:agents!messages_recipient_id_fkey(first_name, last_name, email)
            `)
            .or(`sender_id.eq.${req.user.id},recipient_id.eq.${req.user.id}`)
            .order('created_at', { ascending: false })
            .limit(50);

          if (error) throw error;

          return res.json({ success: true, messages });
        } catch (error) {
          console.error('Erreur récupération messages:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les messages (POST)
    if (path === '/api/messages' && method === 'POST') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { content, recipient_id, message_type = 'direct' } = req.body;

          if (!content || !recipient_id) {
            return res.status(400).json({ error: 'Contenu et destinataire requis' });
          }

          const { data: message, error } = await supabaseClient
            .from('messages')
            .insert({
              content,
              sender_id: req.user.id,
              recipient_id,
              message_type,
              created_at: new Date().toISOString()
            })
            .select(`
              *,
              sender:agents!messages_sender_id_fkey(first_name, last_name, email),
              recipient:agents!messages_recipient_id_fkey(first_name, last_name, email)
            `)
            .single();

          if (error) throw error;

          return res.json({ success: true, message });
        } catch (error) {
          console.error('Erreur envoi message:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // ===== ENDPOINTS MANQUANTS POUR DASHBOARD =====

    // Endpoint pour les zones de travail
    if (path === '/api/work-zones' && method === 'GET') {
      try {
          // Retourner des zones de travail fictives pour l'instant
          const workZones = [
            { id: 1, name: 'Zone Nord', description: 'Zone de travail au nord' },
            { id: 2, name: 'Zone Sud', description: 'Zone de travail au sud' },
            { id: 3, name: 'Zone Est', description: 'Zone de travail à l\'est' },
            { id: 4, name: 'Zone Ouest', description: 'Zone de travail à l\'ouest' }
          ];
          return res.json({ success: true, workZones });
        } catch (error) {
          console.error('Erreur récupération zones de travail:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    // Endpoint pour les contacts
    if (path === '/api/contacts' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: contacts, error } = await supabaseClient
            .from('users')
            .select('id, name, email, phone')
            .eq('role', 'agent')
            .order('name');

          if (error) throw error;

          return res.json({ success: true, contacts: contacts || [] });
        } catch (error) {
          console.error('Erreur récupération contacts:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les contacts d'urgence
    if (path === '/api/emergency-contacts' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          // Retourner des contacts d'urgence fictifs pour l'instant
          const emergencyContacts = [
            { id: 1, name: 'Urgences Médicales', phone: '118' },
            { id: 2, name: 'Police', phone: '117' },
            { id: 3, name: 'Pompiers', phone: '118' },
            { id: 4, name: 'Support Technique', phone: '+229 12345678' }
          ];
          return res.json({ success: true, emergencyContacts });
        } catch (error) {
          console.error('Erreur récupération contacts d\'urgence:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour le contenu d'aide
if (path === '/api/help/content' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          const helpContent = {
            sections: [
              {
                id: 1,
                title: 'Guide de démarrage',
                content: 'Comment utiliser l\'application CCRB'
              },
              {
                id: 2,
                title: 'Planification',
                content: 'Comment planifier vos activités'
              },
              {
                id: 3,
                title: 'Rapports',
                content: 'Comment générer et consulter les rapports'
              }
            ]
          };
          return res.json({ success: true, helpContent });
        } catch (error) {
          console.error('Erreur récupération contenu d\'aide:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les missions
    if (path === '/api/missions' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: missions, error } = await supabaseClient
            .from('missions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (error) throw error;

          return res.json({ success: true, missions: missions || [] });
        } catch (error) {
          console.error('Erreur récupération missions:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les localisations
    if (path === '/api/locations' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          // Retourner des localisations fictives pour l'instant
          const locations = [
            { id: 1, name: 'Cotonou', type: 'ville', lat: 6.3667, lon: 2.4333 },
            { id: 2, name: 'Porto-Novo', type: 'ville', lat: 6.4969, lon: 2.6036 },
            { id: 3, name: 'Parakou', type: 'ville', lat: 9.3500, lon: 2.6167 }
          ];
          return res.json({ success: true, locations });
        } catch (error) {
          console.error('Erreur récupération localisations:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les checkins
    if (path === '/api/checkins' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { from, to, agent_id } = req.query;
          let query = supabaseClient
            .from('checkins')
            .select('*')
            .order('created_at', { ascending: false });

          if (from) {
            query = query.gte('created_at', from);
          }
          if (to) {
            query = query.lte('created_at', to);
          }
          if (agent_id) {
            query = query.eq('user_id', agent_id);
          }

          const { data: checkins, error } = await query.limit(100);

          if (error) throw error;

          return res.json({ success: true, checkins: checkins || [] });
        } catch (error) {
          console.error('Erreur récupération checkins:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les checkins personnels
    if (path === '/api/checkins/mine' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { from, to } = req.query;
          let query = supabaseClient
            .from('checkins')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

          if (from) {
            query = query.gte('created_at', from);
          }
          if (to) {
            query = query.lte('created_at', to);
          }

          const { data: checkins, error } = await query.limit(100);

          if (error) throw error;

          return res.json({ success: true, checkins: checkins || [] });
        } catch (error) {
          console.error('Erreur récupération checkins personnels:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les validations personnelles
if (path === '/api/validations/mine' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { from, to } = req.query;
          let query = supabaseClient
            .from('presence_validations')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

          if (from) {
            query = query.gte('created_at', from);
          }
          if (to) {
            query = query.lte('created_at', to);
          }

          const { data: validations, error } = await query.limit(100);

          if (error) throw error;

          return res.json({ success: true, validations: validations || [] });
        } catch (error) {
          console.error('Erreur récupération validations personnelles:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les planifications personnelles
    if (path === '/api/planifications' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { from, to, agent_id } = req.query;
          let query = supabaseClient
            .from('planifications')
            .select('*')
            .order('date', { ascending: false });

          if (agent_id) {
            query = query.eq('user_id', agent_id);
          } else {
            query = query.eq('user_id', req.user.id);
          }

          if (from) {
            query = query.gte('date', from);
          }
          if (to) {
            query = query.lte('date', to);
          }

          const { data: planifications, error } = await query.limit(100);

          if (error) throw error;

          return res.json({ success: true, planifications: planifications || [] });
        } catch (error) {
          console.error('Erreur récupération planifications:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les missions personnelles
    if (path === '/api/me/missions' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const { data: missions, error } = await supabaseClient
            .from('missions')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (error) throw error;

          return res.json({ success: true, missions: missions || [] });
        } catch (error) {
          console.error('Erreur récupération missions personnelles:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les checkins d'une mission
    if (path.startsWith('/api/missions/') && path.endsWith('/checkins') && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          if (!supabaseClient) {
            return res.status(500).json({ error: 'Supabase non configuré' });
          }

          const missionId = path.split('/')[3];
          const { data: checkins, error } = await supabaseClient
            .from('checkins')
            .select('*')
            .eq('mission_id', missionId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return res.json({ success: true, checkins: checkins || [] });
        } catch (error) {
          console.error('Erreur récupération checkins mission:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les analytics (retourner des données fictives)
    if (path.startsWith('/api/analytics/') && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          const analyticsData = {
            presence: { total: 0, percentage: 0 },
            missions: { completed: 0, pending: 0 },
            performance: { score: 0, trend: 'stable' }
          };
          return res.json({ success: true, data: analyticsData });
        } catch (error) {
          console.error('Erreur récupération analytics:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
      return;
    }

    // Endpoint pour les achievements d'agent
if (path.startsWith('/api/agent/achievements') && method === 'GET') {
      console.log('=== DÉBUT TRAITEMENT ACHIEVEMENTS AGENT ===');
      
      // Données de démonstration par défaut
      const demoAchievements = [
        {
          id: 1,
          title: 'Premier jour',
          description: 'Première connexion à l\'application',
          icon: '🎯',
          date: new Date().toISOString(),
          type: 'milestone',
          points: 10
        },
        {
          id: 2,
          title: 'Première mission',
          description: 'Mission complétée avec succès',
          icon: '✅',
          date: new Date().toISOString(),
          type: 'mission',
          points: 20
        },
        {
          id: 3,
          title: 'Assiduité',
          description: 'Présence vérifiée aujourd\'hui',
          icon: '📅',
          date: new Date().toISOString(),
          type: 'attendance',
          points: 15
        }
      ];

      // Utiliser le middleware d'authentification
      return authenticateToken(req, res, async () => {
        try {
          // Récupérer l'ID de l'agent depuis les paramètres de requête ou l'utilisateur connecté
          const agentId = req.query.agent_id || (req.user && req.user.id);
          
          console.log(`🔍 Récupération des réalisations pour l'agent ID: ${agentId}`);
          
          // Validation de l'ID de l'agent
          if (!agentId) {
            console.warn('❌ ID d\'agent manquant dans la requête');
            return res.status(400).json({ 
              success: false, 
              error: 'ID agent requis',
              _debug: 'ID agent manquant dans la requête ou utilisateur non connecté'
            });
          }

          // Vérifier que l'utilisateur a le droit d'accéder à ces données
          const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superviseur';
          const isOwnData = String(req.user?.id) === String(agentId);
          
          if (!isAdmin && !isOwnData) {
            console.warn('⛔ Accès non autorisé', { 
              userId: req.user?.id, 
              requestedAgentId: agentId,
              role: req.user?.role 
            });
            return res.status(403).json({ 
              success: false, 
              error: 'Accès non autorisé à ces données',
              _debug: 'L\'utilisateur n\'a pas les droits pour accéder à ces données'
            });
          }

          // Vérification de la configuration de Supabase
          if (!supabaseClient) {
            console.error('❌ Erreur: Supabase non configuré');
            return res.status(500).json({ 
              success: false, 
              error: 'Erreur de configuration serveur',
              _debug: 'Supabase non configuré correctement'
            });
          }

          try {
            console.log(`🔍 Tentative de récupération des réalisations depuis Supabase pour l'agent ${agentId}`);
            
            // Essayer d'abord avec la table agent_achievements
            let achievements = [];
            let tableName = 'agent_achievements';
            
            const { data, error } = await supabaseClient
              .from(tableName)
              .select('*')
              .eq('agent_id', agentId)
              .order('date', { ascending: false });

            if (error) {
              // Si la table n'existe pas, essayer avec une autre table potentielle
              if (error.code === '42P01') { // Table does not exist
                console.warn(`Table ${tableName} non trouvée, tentative avec une autre table...`);
                tableName = 'achievements';
                
                const retryResult = await supabaseClient
                  .from(tableName)
                  .select('*')
                  .eq('agent_id', agentId)
                  .order('date', { ascending: false });
                  
                if (retryResult.error) throw retryResult.error;
                achievements = retryResult.data || [];
              } else {
                throw error;
              }
            } else {
              achievements = data || [];
            }

            console.log(`✅ ${achievements.length} réalisations trouvées pour l'agent ${agentId}`);
            
            // Si pas de réalisations, utiliser les données de démonstration
            const result = achievements.length > 0 ? achievements : demoAchievements;
            const usedDemoData = achievements.length === 0;
            
            return res.status(200).json({
              success: true,
              achievements: result,
              _debug: usedDemoData 
                ? 'Aucune donnée trouvée, données de démonstration utilisées' 
                : `Données récupérées depuis la table ${tableName}`,
              demoDataUsed: usedDemoData
            });
            
          } catch (dbError) {
            console.error('❌ Erreur base de données:', dbError);
            
            // En cas d'erreur, retourner les données de démonstration avec un message d'erreur
            return res.status(200).json({
              success: true,
              achievements: demoAchievements,
              _debug: 'Erreur base de données, données de démonstration utilisées',
              error: process.env.NODE_ENV === 'development' ? dbError.message : undefined,
              demoDataUsed: true
            });
          }
          
        } catch (error) {
          console.error('❌ Erreur inattendue:', error);
          return res.status(500).json({
            success: false,
            error: 'Une erreur inattendue est survenue',
            _debug: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        } finally {
          console.log('=== FIN TRAITEMENT ACHIEVEMENTS AGENT ===\n');
        }
      });
    }

    // Classement - Récupérer le classement des agents du projet
    if (path.startsWith('/api/agent/leaderboard') && method === 'GET') {
      return authenticateToken(req, res, async () => {
        try {
          const { email, project } = req.query;

          if (!email) {
            return res.status(400).json({ success: false, error: 'Email requis' });
          }

          if (!supabaseClient) {
            return res.status(500).json({ success: false, error: 'Supabase non configuré' });
          }

          // Récupérer l'utilisateur actuel
          const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('id, project_name')
            .eq('email', email)
            .single();

          if (userError || !userData) {
            console.warn('Utilisateur non trouvé:', email);
            return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
          }

          const projectName = project || userData.project_name || 'PARSAD';
          console.log(`📊 Chargement du classement pour le projet: ${projectName}`);

          // Récupérer le mois actuel
          const now = new Date();
          const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
          const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          // Récupérer tous les agents du même projet
          const { data: projectAgents, error: agentsError } = await supabaseClient
            .from('users')
            .select('id, name, email')
            .eq('role', 'agent')
            .order('name', { ascending: true });

          if (agentsError) throw agentsError;

          if (!projectAgents || projectAgents.length === 0) {
            return res.json({
              success: true,
              leaderboard: [],
              month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
              project: projectName
            });
          }

          // Calculer les statistiques pour chaque agent
          const leaderboardData = [];

          for (const agent of projectAgents) {
            try {
              // Récupérer les présences
              const { data: presences, error: presError } = await supabaseClient
                .from('presences')
                .select('checkin_time, checkout_time')
                .eq('user_id', agent.id)
                .gte('checkin_time', dateFrom.toISOString())
                .lte('checkin_time', dateTo.toISOString());

              // Récupérer les planifications
              const { data: planifications, error: planError } = await supabaseClient
                .from('planifications')
                .select('status, resultat_journee')
                .eq('user_id', agent.id)
                .gte('date', dateFrom.toISOString().split('T')[0])
                .lte('date', dateTo.toISOString().split('T')[0]);

              // Calculer les statistiques
              const presentDays = new Set(
                (presences || []).map(p => new Date(p.checkin_time).toISOString().split('T')[0])
              ).size;

              // Compter les jours ouvrables (lundi-vendredi)
              let workingDays = 0;
              for (let d = new Date(dateFrom); d <= dateTo; d.setDate(d.getDate() + 1)) {
                if (d.getDay() !== 0 && d.getDay() !== 6) {
                  workingDays++;
                }
              }

              const presenceRate = workingDays > 0 ? (presentDays / workingDays) * 100 : 0;

              // Calculer le temps terrain (en heures)
              let fieldTimeHours = 0;
              (presences || []).forEach(p => {
                if (p.checkin_time && p.checkout_time) {
                  const checkin = new Date(p.checkin_time);
                  const checkout = new Date(p.checkout_time);
                  fieldTimeHours += (checkout - checkin) / (1000 * 60 * 60);
                }
              });

              // Calculer les statistiques d'activités
              const totalActivities = planifications?.length || 0;
              const realizedActivities = (planifications || []).filter(
                p => p.resultat_journee === 'realise' || p.resultat_journee === 'REALISE'
              ).length;
              const partialActivities = (planifications || []).filter(
                p => p.resultat_journee === 'partiellement_realise' || p.resultat_journee === 'PARTIELLEMENT_REALISE'
              ).length;
              const notRealizedActivities = (planifications || []).filter(
                p => p.resultat_journee === 'non_realise' || p.resultat_journee === 'PLANIFIE'
              ).length;

              const executionRate = totalActivities > 0 ? (realizedActivities / totalActivities) * 100 : 0;

              // Score composite
              const compositeScore = (presenceRate * 0.7) + (executionRate * 0.15) +
                                    (Math.min(fieldTimeHours / 20, 100) * 0.15);

              leaderboardData.push({
                agentId: agent.id,
                name: agent.name,
                firstName: agent.first_name,
                lastName: agent.last_name,
                projectName: agent.project_name,
                presenceRate: Math.round(presenceRate * 10) / 10,
                tep: Math.round(executionRate * 10) / 10,
                executionRate: Math.round(executionRate * 10) / 10,
                fieldTimeHours: Math.round(fieldTimeHours * 10) / 10,
                compositeScore: Math.round(compositeScore * 10) / 10,
                workedDays: presentDays,
                workingDays: workingDays,
                totalActivities,
                realizedActivities,
                partiallyRealized: partialActivities,
                notRealized: notRealizedActivities
              });
            } catch (error) {
              console.error(`Erreur calcul stats pour agent ${agent.id}:`, error);
            }
          }

          // Trier par score composite (décroissant)
          leaderboardData.sort((a, b) => b.compositeScore - a.compositeScore);

          // Ajouter les rangs
          const leaderboard = leaderboardData.map((agent, index) => ({
            ...agent,
            rank: index + 1
          }));

          console.log(`✅ Classement retourné: ${leaderboard.length} agents du projet "${projectName}"`);
          return res.json({
            success: true,
            leaderboard,
            month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
            project: projectName
          });
        } catch (error) {
          console.error('Erreur récupération leaderboard:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur', details: error.message });
        }
      });
    }

    // Endpoint pour les objectifs
    if (path === '/api/goals' && method === 'GET') {
      return authenticateToken(req, res, async () => {
        try {
          const goals = [];
          return res.json({ success: true, goals });
        } catch (error) {
          console.error('Erreur récupération objectifs:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
    }

        // Endpoint pour les badges
    if (path === '/api/badges' && method === 'GET') {
      return authenticateToken(req, res, async () => {
        try {
          const badges = [];
          return res.json({ success: true, badges });
        } catch (error) {
          console.error('Erreur récupération badges:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
      });
    }

    // Endpoint pour récupérer les données de présence par agent et période
    if (path === '/api/presences' && method === 'GET') {
      return authenticateToken(req, res, async () => {
        try {
          const { agent_id, date_from, date_to } = req.query;

          if (!agent_id || !date_from || !date_to) {
            return res.status(400).json({
              success: false,
              error: 'Paramètres requis: agent_id, date_from, date_to'
            });
          }

          if (!supabaseClient) {
            return res.status(500).json({ success: false, error: 'Supabase non configuré' });
          }

          // Vérifier les droits d'accès
          const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superviseur';
          const isOwnData = String(req.user?.id) === String(agent_id);

          if (!isAdmin && !isOwnData) {
            return res.status(403).json({
              success: false,
              error: 'Accès non autorisé à ces données'
            });
          }

          // Récupérer les présences
          const { data: presences, error } = await supabaseClient
            .from('presences')
            .select('*')
            .eq('user_id', agent_id)
            .gte('checkin_time', date_from)
            .lte('checkin_time', date_to)
            .order('checkin_time', { ascending: false });

          if (error) throw error;

          return res.json({
            success: true,
            data: presences || []
          });
        } catch (error) {
          console.error('Erreur récupération presences:', error);
          return res.status(500).json({
            success: false,
            error: 'Erreur serveur',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      });
    }

    // Endpoint pour récupérer les données de planification par agent et période
    if (path === '/api/planifications' && method === 'GET' && req.query.agent_id && req.query.date_from) {
      return authenticateToken(req, res, async () => {
        try {
          const { agent_id, date_from, date_to } = req.query;

          if (!agent_id || !date_from || !date_to) {
            return res.status(400).json({
              success: false,
              error: 'Paramètres requis: agent_id, date_from, date_to'
            });
          }

          if (!supabaseClient) {
            return res.status(500).json({ success: false, error: 'Supabase non configuré' });
          }

          // Vérifier les droits d'accès
          const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superviseur';
          const isOwnData = String(req.user?.id) === String(agent_id);

          if (!isAdmin && !isOwnData) {
            return res.status(403).json({
              success: false,
              error: 'Accès non autorisé à ces données'
            });
          }

          // Récupérer les planifications
          const { data: planifications, error } = await supabaseClient
            .from('planifications')
            .select('*')
            .eq('user_id', agent_id)
            .gte('date', date_from)
            .lte('date', date_to)
            .order('date', { ascending: false });

          if (error) throw error;

          return res.json({
            success: true,
            data: planifications || []
          });
        } catch (error) {
          console.error('Erreur récupération planifications:', error);
          return res.status(500).json({
            success: false,
            error: 'Erreur serveur',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      });
    }

    // Endpoint pour générer le rapport mensuel (POST)
    if (path === '/api/agent/monthly-report' && method === 'POST') {
      return authenticateToken(req, res, async () => {
        try {
          const { agentId, month, year } = req.body;

          if (!agentId || !month || !year) {
            return res.status(400).json({
              success: false,
              error: 'Paramètres requis: agentId, month, year'
            });
          }

          if (!supabaseClient) {
            return res.status(500).json({ success: false, error: 'Supabase non configuré' });
          }

          // Vérifier les droits d'accès
          const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superviseur';
          const isOwnReport = String(req.user?.id) === String(agentId);

          if (!isAdmin && !isOwnReport) {
            return res.status(403).json({
              success: false,
              error: 'Accès non autorisé à ce rapport'
            });
          }

          // Construire les dates
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0);

          const dateFrom = startDate.toISOString().split('T')[0];
          const dateTo = endDate.toISOString().split('T')[0];

          console.log(`📊 Génération du rapport pour l'agent ${agentId}, ${month}/${year}`);

          // Utiliser buildAgentMonthlyReport si disponible
          try {
            const report = await buildAgentMonthlyReport({
              supabaseClient,
              agentId,
              monthValue: `${year}-${String(month).padStart(2, '0')}`,
              includeAiSummary: true,
              geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
              requester: req.user
            });

            return res.json({ success: true, report });
          } catch (reportError) {
            console.error('Erreur génération rapport:', reportError);
            return res.status(500).json({
              success: false,
              error: 'Erreur lors de la génération du rapport',
              details: process.env.NODE_ENV === 'development' ? reportError.message : undefined
            });
          }
        } catch (error) {
          console.error('Erreur endpoint rapport mensuel:', error);
          return res.status(500).json({
            success: false,
            error: 'Erreur serveur',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      });
    }

    // Vérification de présence du jour
    if (path === '/api/presence/check-today' && method === 'GET') {
      try {
        const { email } = req.query;
        
        if (!email) {
          return res.status(400).json({ success: false, error: 'Email requis' });
        }

        if (!supabaseClient) {
          return res.status(500).json({ success: false, error: 'Supabase non configuré' });
        }

        // Vérifier si l'utilisateur a une entrée de présence pour aujourd'hui
        const today = new Date().toISOString().split('T')[0];
        const { data: presence, error } = await supabaseClient
          .from('presences')
          .select('*')
          .eq('email', email)
          .gte('checkin_time', `${today}T00:00:00.000Z`)
          .lte('checkin_time', `${today}T23:59:59.999Z`)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Erreur lors de la vérification de présence:', error);
          return res.status(500).json({ success: false, error: 'Erreur serveur' });
        }

        return res.json({ 
          success: true, 
          has_presence: !!presence,
          presence_data: presence || null
        });
      } catch (error) {
        console.error('Erreur lors de la vérification de présence:', error);
        return res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    }

    // Gestion des jours de permission
    if (path === '/api/permission-days' && method === 'GET') {
      return authenticateToken(req, res, async () => {
        try {
          const { agent_id, month } = req.query;
          
          if (!supabaseClient) {
            return res.status(500).json({ success: false, error: 'Supabase non configuré' });
          }

          // Construire la requête de base sur la table permissions
          let query = supabaseClient
            .from('permissions')
            .select('*')
            .eq('status', 'approved'); // Ne prendre que les permissions approuvées

          // Filtrer par agent_id si fourni
          if (agent_id) {
            query = query.eq('agent_id', agent_id);
          }

          // Filtrer par mois si fourni
          if (month) {
            const startDate = new Date(month);
            const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            
            // Inclure les permissions qui chevauchent le mois
            query = query
              .or(`start_date.lte.${endDate.toISOString().split('T')[0]},end_date.gte.${startDate.toISOString().split('T')[0]}`)
              .order('start_date', { ascending: false });
          }

          // Exécuter la requête
          const { data: permissions, error } = await query;

          if (error) {
            console.error('Erreur récupération des permissions:', error);
            return res.status(500).json({ success: false, error: 'Erreur serveur' });
          }

          // Si on a un agent_id et un mois, calculer le nombre total de jours de permission
          let totalDays = 0;
          if (agent_id && month) {
            const startDate = new Date(month);
            const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            
            permissions?.forEach(perm => {
              const permStart = new Date(perm.start_date);
              const permEnd = new Date(perm.end_date);
              
              // Calculer l'intersection avec le mois demandé
              const effectiveStart = permStart < startDate ? startDate : permStart;
              const effectiveEnd = permEnd > endDate ? endDate : permEnd;
              
              if (effectiveStart <= effectiveEnd) {
                // Compter uniquement les jours ouvrés (lundi à vendredi)
                let days = 0;
                let current = new Date(effectiveStart);
                while (current <= effectiveEnd) {
                  const day = current.getDay();
                  if (day !== 0 && day !== 6) { // 0 = dimanche, 6 = samedi
                    days++;
                  }
                  current.setDate(current.getDate() + 1);
                }
                totalDays += days;
              }
            });
          }

          return res.json({ 
            success: true, 
            permission_days: permissions || [],
            total_days: totalDays,
            count: permissions?.length || 0
          });
        } catch (error) {
          console.error('Erreur lors de la récupération des permissions:', error);
          return res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la récupération des permissions',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      });
    }

    // Créer ou mettre à jour un jour de permission
    if (path === '/api/permission-days' && (method === 'POST' || method === 'PUT')) {
      return authenticateToken(req, res, async () => {
        try {
          const { id, user_id, start_date, end_date, reason, status } = req.body;
          
          if (!user_id || !start_date || !end_date) {
            return res.status(400).json({ 
              success: false, 
              error: 'Tous les champs sont obligatoires (user_id, start_date, end_date)' 
            });
          }

          if (!supabaseClient) {
            return res.status(500).json({ success: false, error: 'Supabase non configuré' });
          }

          const permissionData = {
            user_id,
            start_date,
            end_date,
            reason: reason || null,
            status: status || 'pending',
            updated_at: new Date().toISOString()
          };

          let data, error;

          if (method === 'POST') {
            // Création d'un nouveau jour de permission
            permissionData.created_by = req.user.id;
            const result = await supabaseClient
              .from('permission_days')
              .insert([permissionData])
              .select();
            
            data = result.data;
            error = result.error;
          } else {
            // Mise à jour d'un jour de permission existant
            if (!id) {
              return res.status(400).json({ 
                success: false, 
                error: 'ID du jour de permission requis pour la mise à jour' 
              });
            }

            const result = await supabaseClient
              .from('permission_days')
              .update(permissionData)
              .eq('id', id)
              .select();
            
            data = result.data;
            error = result.error;
          }

          if (error) throw error;

          return res.json({ 
            success: true, 
            message: method === 'POST' ? 'Jour de permission créé avec succès' : 'Jour de permission mis à jour avec succès',
            permission_day: data ? data[0] : null
          });

        } catch (error) {
          console.error('Erreur lors de la sauvegarde du jour de permission:', error);
          return res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la sauvegarde du jour de permission',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      });
    }

    // Supprimer un jour de permission
    if (path.startsWith('/api/permission-days/') && method === 'DELETE') {
      return authenticateToken(req, res, async () => {
        try {
          const permissionId = path.split('/').pop();
          
          if (!permissionId) {
            return res.status(400).json({ 
              success: false, 
              error: 'ID du jour de permission requis' 
            });
          }

          if (!supabaseClient) {
            return res.status(500).json({ success: false, error: 'Supabase non configuré' });
          }

          const { error } = await supabaseClient
            .from('permission_days')
            .delete()
            .eq('id', permissionId);

          if (error) throw error;

          return res.json({ 
            success: true, 
            message: 'Jour de permission supprimé avec succès' 
          });

        } catch (error) {
          console.error('Erreur lors de la suppression du jour de permission:', error);
          return res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la suppression du jour de permission',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      });
    }

    console.log('=== ROUTE NON TROUVÉE ===');
    console.log('Méthode:', method);
    console.log('Chemin:', path);
    console.log('En-têtes:', req.headers);
    console.log('Paramètres de requête:', req.query);
  
  } catch (error) {
    console.error('Erreur non gérée dans le gestionnaire principal:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur serveur interne',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

