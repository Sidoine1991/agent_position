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
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Configuration email manquante - EMAIL_USER et EMAIL_PASS requis');
    throw new Error('Configuration email manquante');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

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

  await transporter.sendMail(mailOptions);
  console.log(`✅ Email de vérification envoyé à ${email}`);
}

// Middleware CORS
function corsHandler(req, res) {
  const origin = getAllowedOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
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

// Fonction principale de l'API (CommonJS export pour @vercel/node)
module.exports = async (req, res) => {
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
        console.error('Erreur envoi email:', emailError);
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
        console.error('Erreur envoi email:', emailError);
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

    // Routes pour les planifications avec nouvelles fonctionnalités
    if (path === '/api/planifications' && method === 'GET') {
      authenticateToken(req, res, async () => {
        try {
          const { from, to, project_id, agent_id } = req.query;
          
          // Récupérer les planifications sans embedding pour éviter le conflit de relations
          let query = supabaseClient
            .from('planifications')
            .select('*');

          // Si agent_id est spécifié, filtrer par cet agent
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
          if (project_id) query = query.eq('project_name', project_id);

          const { data: planifications, error } = await query.order('date', { ascending: false });

          if (error) throw error;

          // Enrichir avec les données utilisateurs séparément
          if (planifications && planifications.length > 0) {
            const userIds = [...new Set(planifications.map(p => p.user_id).filter(Boolean))];
            const { data: users } = await supabaseClient
              .from('users')
              .select('id, name, email, role, project_name')
              .in('id', userIds);

            // Créer un map pour l'enrichissement
            const usersMap = new Map(users.map(u => [u.id, u]));

            // Enrichir les planifications
            const enrichedPlanifications = planifications.map(plan => ({
              ...plan,
              user: usersMap.get(plan.user_id) || null
            }));

            return res.json({
              success: true,
              items: enrichedPlanifications
            });
          }

          return res.json({
            success: true,
            items: planifications || []
          });
        } catch (error) {
          console.error('Erreur planifications:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
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
            project_id 
          } = req.body;

          if (!date) {
            return res.status(400).json({ error: 'Date requise' });
          }

          const planificationData = {
            user_id: req.user.id,
            agent_id: req.user.id, // Ajouter la colonne agent_id requise
            date,
            planned_start_time: planned_start_time || null,
            planned_end_time: planned_end_time || null,
            description_activite: description_activite || null,
            project_name: project_id || null, // project_id contient en fait le nom du projet
            resultat_journee: null,
            observations: null
          };

          const { data: planification, error } = await supabaseClient
            .from('planifications')
            .upsert([planificationData], { 
              onConflict: 'user_id,date',
              ignoreDuplicates: false 
            })
            .select()
            .single();

          if (error) throw error;

          return res.json({
            success: true,
            planification
          });
        } catch (error) {
          console.error('Erreur création planification:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
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

          if (!date || !resultat_journee) {
            return res.status(400).json({ error: 'Date et résultat requis' });
          }

          const validResults = ['realise', 'partiellement_realise', 'non_realise', 'en_cours'];
          if (!validResults.includes(resultat_journee)) {
            return res.status(400).json({ error: 'Résultat invalide' });
          }

          const { data: planification, error } = await supabaseClient
            .from('planifications')
            .update({
              resultat_journee,
              observations: observations || null
            })
            .eq('user_id', req.user.id)
            .eq('date', date)
            .select()
            .single();

          if (error) throw error;

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

            // Grouper par semaine et agent
            const weeklySummary = {};
            enrichedPlanifications.forEach(plan => {
              const weekKey = `${plan.user_id}_${from}`;
              if (!weeklySummary[weekKey]) {
                weeklySummary[weekKey] = {
                  user_id: plan.user_id,
                  user_name: plan.user ? plan.user.name : `Utilisateur ${plan.user_id}`,
                  week_start_date: from,
                  week_end_date: to,
                  project_name: plan.project_name || 'Aucun',
                  total_planned_hours: 0,
                  planned_days: new Set(),
                  activities: []
                };
              }
              
              // Calculer les heures planifiées
              if (plan.planned_start_time && plan.planned_end_time) {
                const start = new Date(`2000-01-01T${plan.planned_start_time}`);
                const end = new Date(`2000-01-01T${plan.planned_end_time}`);
                const hours = (end - start) / (1000 * 60 * 60);
                weeklySummary[weekKey].total_planned_hours += hours;
              }
              
              weeklySummary[weekKey].planned_days.add(plan.date);
              weeklySummary[weekKey].activities.push({
                date: plan.date,
                activity: plan.description_activite || 'Aucune activité',
                start_time: plan.planned_start_time,
                end_time: plan.planned_end_time
              });
            });

            // Convertir en array
            const summaryArray = Object.values(weeklySummary).map(summary => ({
              ...summary,
              planned_days: Array.from(summary.planned_days).length
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

    // Route non trouvée
    return res.status(404).json({ error: 'Route non trouvée' });

  } catch (error) {
    console.error('Erreur API:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
