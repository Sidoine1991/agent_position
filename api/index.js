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
      adminUnit: 'Direction Générale'
    },
    {
      id: 2,
      name: 'Superviseur Principal',
      email: 'supervisor@ccrb.local',
      password: simpleHash('123456'),
      role: 'supervisor',
      status: 'active',
      phone: '+229 12 34 56 79',
      adminUnit: 'Direction des Opérations'
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

    // Route de connexion
    if (pathname === '/api/login' && req.method === 'POST') {
      const { email, password } = req.body;
      console.log('Login attempt:', email);
      
      const user = users.find(u => u.email === email && simpleVerify(password, u.password));
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
      
      // Les tokens peuvent contenir id (api vercel) ou userId (backend sqlite)
      const tokenUserId = (payload && (payload.id || payload.userId)) || null;
      
      // Chercher l'utilisateur dans la mémoire si un id est disponible
      const user = tokenUserId ? users.find(u => u.id === tokenUserId) : null;
      
      if (user) {
        res.status(200).json({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          phone: user.phone,
          adminUnit: user.adminUnit
        });
        return;
      }
      
      // Si pas trouvé en mémoire, retourner le payload minimal du token pour éviter 404
      res.status(200).json({
        id: tokenUserId,
        name: payload.name || 'Utilisateur',
        email: payload.email || '',
        role: payload.role || 'agent',
        status: 'active',
        phone: payload.phone || '',
        adminUnit: payload.adminUnit || ''
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
      
      const usersList = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        phone: u.phone,
        adminUnit: u.adminUnit
      }));
      
      res.status(200).json(usersList);
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
        adminUnit: adminUnit || 'Service Général'
      };
      
      users.push(newUser);
      
      res.status(201).json({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        phone: newUser.phone,
        adminUnit: newUser.adminUnit
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
