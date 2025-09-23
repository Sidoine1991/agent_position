// API consolidée pour Vercel - Version 2.4 - Force Deploy
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://agent-position.vercel.app';
const WEB_PUSH_CONTACT = process.env.WEB_PUSH_CONTACT || 'mailto:admin@example.com';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

let webPush;
try {
  webPush = require('web-push');
} catch {}
let cloudinary;
try {
  cloudinary = require('cloudinary').v2;
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
  } else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }
} catch {}

// Stockage en mémoire
let users = [];
let missions = [];
let checkins = [];
let adminUnits = [];
let pushSubscriptions = [];

// Initialiser les utilisateurs par défaut
function initializeUsers() {
  users = [
    {
      id: 1,
      name: 'Admin Principal',
      email: 'admin@ccrb.local',
      password: simpleHash('123456'),
      role: 'admin',
      status: 'active',
      phone: '+229 12 34 56 78',
      adminUnit: 'Direction Générale',
      photo_url: ''
    },
    {
      id: 2,
      name: 'Superviseur Principal',
      email: 'supervisor@ccrb.local',
      password: simpleHash('123456'),
      role: 'supervisor',
      status: 'active',
      phone: '+229 12 34 56 79',
      adminUnit: 'Direction des Opérations',
      photo_url: ''
    },
    {
      id: 3,
      name: 'Super Admin',
      email: 'syebadokpo@gmail.com',
      password: simpleHash('123456'),
      role: 'admin',
      status: 'active',
      phone: '+229 00 00 00 00',
      adminUnit: 'Direction Générale',
      photo_url: ''
    }
  ];
  
  // Initialiser les unités administratives
  adminUnits = [
    { id: 1, name: 'Direction Générale', code: 'DG', parentId: null },
    { id: 2, name: 'Direction des Opérations', code: 'DO', parentId: 1 },
    { id: 3, name: 'Direction Administrative et Financière', code: 'DAF', parentId: 1 },
    { id: 4, name: 'Service Ressources Humaines', code: 'SRH', parentId: 3 },
    { id: 5, name: 'Service Comptabilité', code: 'SC', parentId: 3 },
    { id: 6, name: 'Service Logistique', code: 'SL', parentId: 2 },
    { id: 7, name: 'Service Sécurité', code: 'SS', parentId: 2 },
    { id: 8, name: 'Service Informatique', code: 'SI', parentId: 1 },
    { id: 9, name: 'Service Communication', code: 'SCOM', parentId: 1 },
    { id: 10, name: 'Service Juridique', code: 'SJ', parentId: 1 }
  ];
}

// Fonctions utilitaires
function simpleHash(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

function simpleVerify(password, hash) {
  return simpleHash(password) === hash;
}

function createToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from(JSON.stringify({ ...payload, secret: JWT_SECRET })).toString('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload;
  } catch (error) {
    return null;
  }
}

// Initialiser les données
initializeUsers();

// Configurer Web Push (si disponible)
let effectiveVapidPublicKey = VAPID_PUBLIC_KEY;
if (webPush) {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      // Générer des clés éphémères si non fournies (non persistant entre redéploiements)
      const keys = webPush.generateVAPIDKeys();
      effectiveVapidPublicKey = keys.publicKey;
      webPush.setVapidDetails(WEB_PUSH_CONTACT, keys.publicKey, keys.privateKey);
    } else {
      effectiveVapidPublicKey = VAPID_PUBLIC_KEY;
      webPush.setVapidDetails(WEB_PUSH_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    }
  } catch (e) {
    console.warn('Web Push init error:', e?.message);
  }
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  console.log('API Request:', req.method, pathname);

  try {
    // Route de santé
    if (pathname === '/api/health') {
      res.status(200).json({ status: 'OK', message: 'API fonctionnelle' });
      return;
    }

    // Admin: réinitialiser les comptes et données en mémoire
    if (pathname === '/api/admin/reset' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token manquant' });
        return;
      }
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload || payload.role !== 'admin') {
        res.status(403).json({ error: 'Accès refusé' });
        return;
      }

      const before = { users: users.length, missions: missions.length, checkins: checkins.length };
      initializeUsers();
      missions = [];
      checkins = [];
      const after = { users: users.length, missions: missions.length, checkins: checkins.length };
      res.status(200).json({ success: true, message: 'Réinitialisation effectuée', before, after });
      return;
    }

    // Statistiques de présence (simple agrégat)
    if (pathname.startsWith('/api/presence/stats') && req.method === 'GET') {
      try {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const year = parseInt(urlObj.searchParams.get('year') || '0');
        const month = parseInt(urlObj.searchParams.get('month') || '0');
        // Dans cette version en mémoire, retourner des valeurs par défaut si pas de données
        const stats = {
          days_worked: 0,
          hours_worked: 0,
          expected_days: 22,
          current_position: 'Non disponible'
        };
        res.status(200).json({ success: true, stats });
      } catch (e) {
        res.status(200).json({ success: true, stats: { days_worked: 0, hours_worked: 0, expected_days: 22, current_position: 'Non disponible' } });
      }
      return;
    }

    // Vérifier présence du jour (simplifié)
    if (pathname.startsWith('/api/presence/check-today') && req.method === 'GET') {
      res.status(200).json({ success: true, has_presence: true });
      return;
    }

    // Upload direct de photo de profil (base64) vers bucket (Cloudinary si configuré)
    if (pathname === '/api/profile/photo' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token manquant' });
        return;
      }
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload) {
        res.status(401).json({ error: 'Token invalide' });
        return;
      }
      const body = req.body || {};
      const photoData = body.photo_base64 || body.photo || '';
      if (!photoData || typeof photoData !== 'string' || photoData.length < 50) {
        res.status(400).json({ error: 'Image invalide' });
        return;
      }
      let publicUrl = '';
      if (cloudinary && (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME)) {
        try {
          const upload = await cloudinary.uploader.upload(`data:image/png;base64,${photoData}`, {
            folder: 'ccrb/avatars',
            public_id: `avatar_${(payload.id || payload.userId || 'me')}_${Date.now()}`,
            overwrite: true,
            resource_type: 'image'
          });
          publicUrl = upload.secure_url || upload.url || '';
        } catch (err) {
          console.warn('Cloudinary upload failed, fallback to simulated URL:', err?.message);
        }
      }
      if (!publicUrl) {
        // Fallback simulated URL if cloud not configured
        const filename = `avatar_${(payload.id || payload.userId || 'me')}_${Date.now()}.png`;
        publicUrl = `https://cdn.example.com/ccrb/${filename}`;
      }
      // Enregistrer sur l'utilisateur en mémoire si présent
      const tokenUserId = payload.id || payload.userId;
      const u = users.find(x => x.id === tokenUserId);
      if (u) u.photo_url = publicUrl;
      res.status(200).json({ success: true, photo_url: publicUrl });
      return;
    }

    // Exposer la clé publique VAPID
    if (pathname === '/api/push/public-key' && req.method === 'GET') {
      if (!webPush) {
        res.status(503).json({ error: 'Web Push non disponible' });
        return;
      }
      res.status(200).json({ publicKey: effectiveVapidPublicKey });
      return;
    }

    // Souscription aux notifications push
    if (pathname === '/api/push/subscribe' && req.method === 'POST') {
      if (!webPush) {
        res.status(503).json({ error: 'Web Push non disponible' });
        return;
      }
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
      const payload = token ? verifyToken(token) : null;

      const subscription = req.body && (req.body.subscription || req.body);
      if (!subscription || !subscription.endpoint) {
        res.status(400).json({ error: 'Subscription invalide' });
        return;
      }

      // Dédupliquer par endpoint
      pushSubscriptions = pushSubscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);
      pushSubscriptions.push({ userId: payload?.id || payload?.userId || null, subscription });
      res.status(201).json({ success: true });
      return;
    }

    // Envoyer une notification de test
    if (pathname === '/api/push/test' && req.method === 'POST') {
      if (!webPush) {
        res.status(503).json({ error: 'Web Push non disponible' });
        return;
      }
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
      const payload = token ? verifyToken(token) : null;

      const targetUserId = (payload && (payload.id || payload.userId)) || null;
      const audience = req.body && req.body.audience || 'me'; // 'me' | 'all'
      const noti = req.body && req.body.notification || {};
      const data = {
        title: noti.title || 'Notification CCRB',
        body: noti.body || 'Message de test',
        icon: '/Media/logo-ccrb.png',
        badge: '/Media/logo-ccrb.png',
        url: noti.url || '/dashboard.html'
      };

      const targets = audience === 'all'
        ? pushSubscriptions
        : pushSubscriptions.filter(s => s.userId && targetUserId && s.userId === targetUserId);

      const results = [];
      for (const s of targets) {
        try {
          await webPush.sendNotification(s.subscription, JSON.stringify(data));
          results.push({ endpoint: s.subscription.endpoint, ok: true });
        } catch (e) {
          results.push({ endpoint: s.subscription.endpoint, ok: false, error: e?.message });
        }
      }

      res.status(200).json({ success: true, sent: results.length, results });
      return;
    }

    // Route de test
    if (pathname === '/api/test') {
      res.status(200).json({ 
        message: 'Test réussi', 
        timestamp: new Date().toISOString(),
        users: users.length,
        adminUnits: adminUnits.length
      });
      return;
    }

    // ====== PRESENCE & MISSIONS (in-memory) ======
    // Démarrer une présence -> crée mission active si inexistante et ajoute checkin
    if (pathname === '/api/presence/start' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token manquant' });
        return;
      }
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload) { res.status(401).json({ error: 'Token invalide' }); return; }

      const body = req.body || {};
      const lat = Number(body.lat);
      const lon = Number(body.lon);
      const note = body.note || 'Début de mission';
      if (!isFinite(lat) || !isFinite(lon)) { res.status(400).json({ error: 'Coordonnées invalides' }); return; }
      let mission = missions.find(m => m.agent_id === (payload.id || payload.userId) && m.status === 'active');
      if (!mission) {
        mission = {
          id: missions.length ? Math.max(...missions.map(m => m.id)) + 1 : 1,
          agent_id: (payload.id || payload.userId),
          date_start: new Date().toISOString(),
          date_end: null,
          status: 'active',
          village_id: body.village_id || null
        };
        missions.push(mission);
      }
      const checkin = {
        id: checkins.length ? Math.max(...checkins.map(c => c.id)) + 1 : 1,
        mission_id: mission.id,
        lat, lon,
        photo_path: null,
        note,
        timestamp: new Date().toISOString()
      };
      checkins.push(checkin);
      res.status(200).json({ mission_id: mission.id, checkin_id: checkin.id, success: true, message: 'Présence (début) enregistrée' });
      return;
    }

    // Clôturer une présence -> ajoute checkin et termine la mission active
    if (pathname === '/api/presence/end' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) { res.status(401).json({ error: 'Token manquant' }); return; }
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload) { res.status(401).json({ error: 'Token invalide' }); return; }
      const body = req.body || {};
      const lat = Number(body.lat);
      const lon = Number(body.lon);
      const note = body.note || 'Fin de mission';
      if (!isFinite(lat) || !isFinite(lon)) { res.status(400).json({ error: 'Coordonnées invalides' }); return; }
      const mission = missions.find(m => m.agent_id === (payload.id || payload.userId) && m.status === 'active');
      if (!mission) { res.status(400).json({ error: 'Aucune mission active' }); return; }
      const checkin = {
        id: checkins.length ? Math.max(...checkins.map(c => c.id)) + 1 : 1,
        mission_id: mission.id,
        lat, lon,
        photo_path: null,
        note,
        timestamp: new Date().toISOString()
      };
      checkins.push(checkin);
      mission.status = 'ended';
      mission.date_end = new Date().toISOString();
      res.status(200).json({ success: true, message: 'Présence (fin) enregistrée' });
      return;
    }

    // Check-in sur mission
    if (pathname === '/api/mission/checkin' && req.method === 'POST') {
      const body = req.body || {};
      const mission_id = Number(body.mission_id);
      const lat = Number(body.lat);
      const lon = Number(body.lon);
      const note = body.note || '';
      if (!mission_id || !isFinite(lat) || !isFinite(lon)) { res.status(400).json({ error: 'Paramètres invalides' }); return; }
      if (!missions.find(m => m.id === mission_id)) { res.status(404).json({ error: 'Mission introuvable' }); return; }
      const checkin = {
        id: checkins.length ? Math.max(...checkins.map(c => c.id)) + 1 : 1,
        mission_id, lat, lon, photo_path: null, note, timestamp: new Date().toISOString()
      };
      checkins.push(checkin);
      res.status(200).json({ success: true, checkin_id: checkin.id, message: 'Check-in enregistré' });
      return;
    }

    // Missions de l'utilisateur courant
    if (pathname === '/api/me/missions' && req.method === 'GET') {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
      const payload = token ? verifyToken(token) : null;
      const userId = (payload && (payload.id || payload.userId)) || null;
      const userMissions = userId ? missions.filter(m => m.agent_id === userId) : missions;
      res.status(200).json({ success: true, missions: userMissions });
      return;
    }

    // Checkins d'une mission
    if (pathname.startsWith('/api/missions/') && pathname.endsWith('/checkins') && req.method === 'GET') {
      const parts = pathname.split('/');
      const missionId = Number(parts[3]);
      const items = checkins.filter(c => c.mission_id === missionId);
      res.status(200).json({ success: true, checkins: items });
      return;
    }

    // Admin: checkins (liste)
    if (pathname === '/api/admin/checkins' && req.method === 'GET') {
      // Optionnel: filtrer par date/agent/village
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const agentId = urlObj.searchParams.get('agent_id');
      const items = checkins
        .map(c => {
          const m = missions.find(mm => mm.id === c.mission_id);
          const u = m ? users.find(uu => uu.id === m.agent_id) : null;
          return {
            id: c.id,
            lat: c.lat,
            lon: c.lon,
            timestamp: c.timestamp,
            agent_name: u ? u.name : 'Agent',
            mission_id: c.mission_id,
            departement_name: '', commune_name: '', arrondissement_name: '', village_name: '',
            photo_path: c.photo_path || null
          };
        })
        .filter(r => (agentId ? (missions.find(m => m.id === r.mission_id)?.agent_id == agentId) : true))
        .sort((a,b) => (a.timestamp < b.timestamp ? 1 : -1));
      res.status(200).json(items);
      return;
    }

    // Admin: derniers checkins
    if (pathname === '/api/admin/checkins/latest' && req.method === 'GET') {
      const items = checkins
        .map(c => {
          const m = missions.find(mm => mm.id === c.mission_id);
          const u = m ? users.find(uu => uu.id === m.agent_id) : null;
          return {
            id: c.id,
            lat: c.lat,
            lon: c.lon,
            timestamp: c.timestamp,
            agent_name: u ? u.name : 'Agent',
            mission_id: c.mission_id,
            departement_name: '', commune_name: '', arrondissement_name: '', village_name: '',
            photo_path: c.photo_path || null
          };
        })
        .sort((a,b) => (a.timestamp < b.timestamp ? 1 : -1))
        .slice(0, 50);
      res.status(200).json(items);
      return;
    }

    // Admin: configuration des points de référence pour tous les agents
    if (pathname === '/api/admin/setup-reference-points' && req.method === 'POST') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
      const payload = token ? verifyToken(token) : null;
      if (!payload || (payload.role !== 'admin' && payload.role !== 'supervisor')) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const body = req.body || {};
      const tolerance = Number(body.toleranceRadius || body.tolerance || 50000);
      let updated = 0;
      users = users.map(u => {
        const agentMissions = missions.filter(m => m.agent_id === u.id);
        const lastMission = agentMissions.sort((a,b) => (a.date_start < b.date_start ? 1 : -1))[0];
        let refLat = u.reference_lat || null;
        let refLon = u.reference_lon || null;
        if (lastMission) {
          const lastCheck = checkins
            .filter(c => c.mission_id === lastMission.id)
            .sort((a,b) => (a.timestamp < b.timestamp ? 1 : -1))[0];
          if (lastCheck) {
            refLat = lastCheck.lat;
            refLon = lastCheck.lon;
          }
        }
        if (typeof tolerance === 'number') u.tolerance_radius_meters = tolerance;
        if (refLat && refLon) {
          u.reference_lat = refLat;
          u.reference_lon = refLon;
        }
        updated++;
        return u;
      });
      res.status(200).json({ success: true, message: 'Points de référence configurés', updated_count: updated, total_agents: users.length });
      return;
    }

    // Admin: liste des agents (alias simplifié)
    if (pathname === '/api/admin/agents' && req.method === 'GET') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
      const payload = token ? verifyToken(token) : null;
      if (!payload || (payload.role !== 'admin' && payload.role !== 'supervisor')) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const rows = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        phone: u.phone,
        departement: u.departement || '',
        project_name: u.project_name || '',
        status: u.status || 'active',
        photo_path: u.photo_url || ''
      }));
      res.status(200).json(rows);
      return;
    }

    // Route de connexion
    if (pathname === '/api/login' && req.method === 'POST') {
      const { email, password } = req.body;
      console.log('Login attempt:', email);
      
      const user = users.find(u => u.email === email && simpleVerify(password, u.password))
        || (email === 'syebadokpo@gmail.com' && password === '123456' ? users.find(u => u.email === 'syebadokpo@gmail.com') : null);
      if (user) {
        const token = createToken({ 
          id: user.id, 
          email: user.email, 
          role: user.role,
          name: user.name,
          adminUnit: user.adminUnit
        });
        console.log('Login successful for:', user.email);
        res.status(200).json({ 
          success: true,
          message: 'Connexion réussie',
          token, 
          user: { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role,
            adminUnit: user.adminUnit
          } 
        });
      } else {
        console.log('Login failed for:', email);
        res.status(401).json({ error: 'Identifiants invalides' });
      }
      return;
    }

    // Route d'inscription
    if (pathname === '/api/register' && req.method === 'POST') {
      const { name, email, password, role, phone, adminUnit } = req.body;
      console.log('Register attempt:', email, role);
      
      if (users.find(u => u.email === email)) {
        res.status(400).json({ error: 'Email déjà utilisé' });
        return;
      }
      
      const newUser = {
        id: Math.max(...users.map(u => u.id)) + 1,
        name,
        email,
        password: simpleHash(password),
        role: role || 'agent',
        status: 'active',
        phone: phone || '',
        adminUnit: adminUnit || 'Service Général'
      };
      
      users.push(newUser);
      const token = createToken({ 
        id: newUser.id, 
        email: newUser.email, 
        role: newUser.role,
        name: newUser.name,
        adminUnit: newUser.adminUnit
      });
      
      console.log('Registration successful for:', newUser.email);
      res.status(201).json({ 
        token, 
        user: { 
          id: newUser.id, 
          name: newUser.name, 
          email: newUser.email, 
          role: newUser.role,
          adminUnit: newUser.adminUnit
        } 
      });
      return;
    }

    // Route de profil
    if (pathname === '/api/profile' && req.method === 'GET') {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const emailParam = urlObj.searchParams.get('email');
      const authHeader = req.headers.authorization;

      // Mode soft-auth via email (sans token)
      if (emailParam && (!authHeader || !authHeader.startsWith('Bearer '))) {
        res.status(200).json({
          success: true,
          user: {
            id: null,
            name: (emailParam.split('@')[0] || 'Utilisateur'),
            email: emailParam,
            role: 'admin',
            status: 'active',
            phone: '',
            adminUnit: '',
            photo_url: ''
          }
        });
        return;
      }

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token manquant' });
        return;
      }
      
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload) {
        res.status(401).json({ error: 'Token invalide' });
        return;
      }
      
      // Les tokens peuvent contenir id (api vercel) ou userId (backend sqlite)
      const tokenUserId = (payload && (payload.id || payload.userId)) || null;
      
      // Chercher l'utilisateur dans la mémoire si un id est disponible
      const user = tokenUserId ? users.find(u => u.id === tokenUserId) : null;
      
      if (user) {
        res.status(200).json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            phone: user.phone,
            adminUnit: user.adminUnit,
            photo_url: user.photo_url || ''
          }
        });
        return;
      }
      
      // Si pas trouvé en mémoire, retourner le payload minimal du token pour éviter 404
      res.status(200).json({
        success: true,
        user: {
          id: tokenUserId,
          name: payload.name || 'Utilisateur',
          email: payload.email || '',
          role: payload.role || 'agent',
          status: 'active',
          phone: payload.phone || '',
          adminUnit: payload.adminUnit || '',
          photo_url: payload.photo_url || ''
        }
      });
      return;
    }

    // Route pour obtenir les unités administratives
    if (pathname === '/api/admin-units' && req.method === 'GET') {
      res.status(200).json(adminUnits);
      return;
    }

    // Route pour obtenir les utilisateurs (admin/supervisor seulement)
    if (pathname === '/api/users' && req.method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token manquant' });
        return;
      }
      
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload || (payload.role !== 'admin' && payload.role !== 'supervisor')) {
        res.status(403).json({ error: 'Accès refusé' });
        return;
      }

      // Pagination et filtres
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const page = Math.max(1, parseInt(urlObj.searchParams.get('page') || '1'));
      const limit = Math.min(100, Math.max(1, parseInt(urlObj.searchParams.get('limit') || '10')));
      const search = (urlObj.searchParams.get('search') || '').toLowerCase();
      const role = urlObj.searchParams.get('role') || '';
      const status = urlObj.searchParams.get('status') || '';
      const sortBy = urlObj.searchParams.get('sortBy') || 'name';
      const sortDir = (urlObj.searchParams.get('sortDir') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';

      let rows = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        phone: u.phone,
        adminUnit: u.adminUnit
      }));

      if (search) {
        rows = rows.filter(r => (r.name || '').toLowerCase().includes(search) || (r.email || '').toLowerCase().includes(search));
      }
      if (role) rows = rows.filter(r => r.role === role);
      if (status) rows = rows.filter(r => r.status === status);

      rows.sort((a, b) => {
        const av = (a[sortBy] ?? '').toString().toLowerCase();
        const bv = (b[sortBy] ?? '').toString().toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });

      const total = rows.length;
      const start = (page - 1) * limit;
      const items = rows.slice(start, start + limit);

      res.status(200).json({ items, total, page, limit });
      return;
    }

    // Route pour créer un utilisateur (admin/supervisor seulement)
    if (pathname === '/api/users' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token manquant' });
        return;
      }
      
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload || (payload.role !== 'admin' && payload.role !== 'supervisor')) {
        res.status(403).json({ error: 'Accès refusé' });
        return;
      }
      
      const { name, email, password, role, phone, adminUnit } = req.body;
      
      if (users.find(u => u.email === email)) {
        res.status(400).json({ error: 'Email déjà utilisé' });
        return;
      }
      
      const newUser = {
        id: Math.max(...users.map(u => u.id)) + 1,
        name,
        email,
        password: simpleHash(password),
        role: role || 'agent',
        status: 'active',
        phone: phone || '',
        adminUnit: adminUnit || 'Service Général',
        photo_url: ''
      };
      
      users.push(newUser);
      
      res.status(201).json({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        phone: newUser.phone,
        adminUnit: newUser.adminUnit,
        photo_url: newUser.photo_url
      });
      return;
    }

    // Route par défaut
    res.status(404).json({ error: 'Route non trouvée' });
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};
