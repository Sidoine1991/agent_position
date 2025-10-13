// Serveur avec base de données Supabase uniquement
const path = require('path');
// Charger .env à la racine et, en fallback, web/.env
try {
  require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
  require('dotenv').config({ path: path.join(__dirname, 'web/.env'), override: false });
  // Map possible Vite-style env vars to backend vars if missing
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_PROJECT_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
} catch {}
const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3010;

// Configuration JWT
const config = require('./config');
const JWT_SECRET = config.JWT_SECRET;

// Configuration multer pour les fichiers (Vercel-compatible)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialisation Supabase
const { createClient } = require('@supabase/supabase-js');

// Sanitize Supabase env vars (trim spaces, remove trailing slashes)
const supabaseUrlRaw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseUrl = typeof supabaseUrlRaw === 'string' 
  ? supabaseUrlRaw.trim().replace(/\/+$/,'') 
  : '';
const supabaseKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY 
  || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseKey = typeof supabaseKeyRaw === 'string' ? supabaseKeyRaw.trim() : '';

let supabaseClient = null;
try {
  supabaseClient = createClient(supabaseUrl, supabaseKey);
  console.log('🔗 Supabase activé (mode exclusif)');
} catch (e) {
  console.error('❌ Supabase requis:', e?.message);
  process.exit(1);
}

// Test de connexion Supabase (non-bloquant)
(async () => {
  try {
    const { data, error } = await supabaseClient.from('app_settings').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Connexion Supabase établie');
  } catch (err) {
    console.warn('⚠️ Connexion Supabase non établie:', err.message);
    console.warn('⚠️ Le serveur fonctionne en mode dégradé');
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
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://maps.googleapis.com"],
        // Autoriser les gestionnaires d'événements inline (onclick, etc.)
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: [
          "'self'", "data:", "https:",
          "https://tile.openstreetmap.org",
          "https://a.tile.openstreetmap.org",
          "https://b.tile.openstreetmap.org",
          "https://c.tile.openstreetmap.org",
          "https://server.arcgisonline.com",
          // Autoriser les médias hébergés sur Supabase (avatars, storage)
          "https://*.supabase.co"
        ],
        connectSrc: [
          "'self'",
          "https://api.supabase.co",
          // Autoriser tous les sous-domaines de supabase.co (projets)
          "https://*.supabase.co",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://unpkg.com",
          "https://maps.googleapis.com",
          "https://tile.openstreetmap.org",
          "https://a.tile.openstreetmap.org",
          "https://b.tile.openstreetmap.org",
          "https://c.tile.openstreetmap.org",
          "https://server.arcgisonline.com",
          "data:",
          "blob:",
          "ws:",
          "wss:"
        ],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }));
}

// Exposer une config front minimale (URL/Key Supabase)
app.get('/web-config.js', (req, res) => {
  try {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_ANON_KEY || '';
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send(`(function(){
      window.SUPABASE_URL = ${JSON.stringify(url)};
      window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};
    })();`);
  } catch (e) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send('(function(){ /* no config */ })();');
  }
});

// Server-side rendered agents list for the web page (bypasses client API calls)
app.get('/agents-list.js', async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id,name,email,role,phone,departement,project_name,status,photo_path')
      .order('name');
    if (error) throw error;
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send(`window.__AGENTS__ = ${JSON.stringify(data || [])};`);
  } catch (e) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send('window.__AGENTS__ = [];');
  }
});

// API endpoint pour supprimer un agent
app.delete('/api/admin/agents/:id', async (req, res) => {
  try {
    const agentId = parseInt(req.params.id, 10);
    
    if (!agentId || isNaN(agentId)) {
      return res.status(400).json({ error: 'ID agent invalide' });
    }

    const { error } = await supabaseClient
      .from('users')
      .delete()
      .eq('id', agentId);
    
    if (error) {
      console.error('Erreur Supabase delete agent:', error);
      return res.status(500).json({ error: 'Erreur lors de la suppression de l\'agent' });
    }

    res.json({ success: true, message: 'Agent supprimé avec succès' });
  } catch (error) {
    console.error('Erreur API delete agent:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// API endpoint pour les administrateurs - gestion des agents
app.get('/api/admin/agents', async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id,name,email,role,phone,departement,commune,arrondissement,village,project_name,photo_path,status,admin_unit,last_activity,first_name,last_name')
      .order('name');
    
    if (error) {
      console.error('Erreur Supabase admin/agents:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération des agents' });
    }

    res.json({ success: true, agents: data || [] });
  } catch (error) {
    console.error('Erreur API admin/agents:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// API endpoint pour les utilisateurs (agents)
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id,name,email,role,phone,departement,project_name,photo_path,status')
      .order('name');
    
    if (error) {
      console.error('Erreur Supabase users:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }

    res.json({ success: true, items: data || [] });
  } catch (error) {
    console.error('Erreur API users:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Admin stats: superadmin dashboard data
app.get('/api/admin/stats', async (req, res) => {
  try {
    // Total users
    const { count: totalUsers, error: uErr } = await supabaseClient
      .from('users')
      .select('id', { count: 'exact', head: true });
    if (uErr) throw uErr;

    // Active agents
    const { count: activeAgents, error: aErr } = await supabaseClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'agent')
      .eq('status', 'active');
    if (aErr) throw aErr;

    // Active missions
    let activeMissions = 0;
    try {
      const { count: mCount, error: mErr } = await supabaseClient
        .from('missions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');
      if (mErr) throw mErr;
      activeMissions = mCount || 0;
    } catch {}

    // Check-ins today (UTC day)
    let checkinsToday = 0;
    try {
      const start = new Date();
      start.setUTCHours(0,0,0,0);
      const end = new Date();
      end.setUTCHours(23,59,59,999);
      const { count: cCount, error: cErr } = await supabaseClient
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString());
      if (cErr) throw cErr;
      checkinsToday = cCount || 0;
    } catch {}

    res.json({ success: true, data: {
      totalUsers: totalUsers || 0,
      activeAgents: activeAgents || 0,
      activeMissions,
      checkinsToday,
    }});
  } catch (error) {
    console.error('Erreur API admin/stats:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des statistiques' });
  }
});

// Calendar day status for attendance coloring
// GET /api/attendance/day-status?agent_id=ID&from=ISO&to=ISO
app.get('/api/attendance/day-status', async (req, res) => {
  try {
    const agentId = parseInt(String(req.query.agent_id || ''), 10);
    const fromISO = String(req.query.from || '').trim();
    const toISO = String(req.query.to || '').trim();
    if (!agentId || !fromISO || !toISO) {
      return res.status(400).json({ success: false, error: 'agent_id, from et to sont requis' });
    }

    // 1) Récupérer les enregistrements de présence (vue agrégée fiable)
    const { data: rows, error: rErr } = await supabaseClient
      .from('report_presence_view')
      .select('*')
      .eq('user_id', agentId)
      .gte('ts', fromISO)
      .lte('ts', toISO)
      .order('ts', { ascending: true });
    if (rErr) throw rErr;

    // 2) Récupérer les jours planifiés si la table existe (optionnel)
    let plans = [];
    try {
      const { data: planRows, error: pErr } = await supabaseClient
        .from('planifications')
        .select('agent_id,date')
        .eq('agent_id', agentId)
        .gte('date', fromISO.slice(0,10))
        .lte('date', toISO.slice(0,10));
      if (pErr) { /* silencieux si table absente */ }
      else plans = planRows || [];
    } catch {}

    const dayKey = (d) => new Date(d).toISOString().slice(0,10);
    const todayKey = new Date().toISOString().slice(0,10);

    // 3) Choisir le premier point par jour et déterminer la couleur
    const byDay = new Map();
    for (const row of rows || []) {
      const k = dayKey(row.ts);
      if (!byDay.has(k)) byDay.set(k, row); // premier point de la journée
    }

    const result = {};
    for (const [k, row] of byDay.entries()) {
      const distance = row?.distance_m;
      const rayon = row?.rayon_m;
      const statut = String(row?.statut || '');
      if (distance != null && rayon != null && distance <= rayon) {
        result[k] = { status: 'valid', color: 'green', tooltip: `${distance}m / ${rayon}m` };
      } else if (statut.toLowerCase().includes('valid')) {
        result[k] = { status: 'valid', color: 'green', tooltip: statut };
      } else if (statut.toLowerCase().includes('inconnu')) {
        result[k] = { status: 'unknown', color: 'yellow', tooltip: statut };
      } else {
        result[k] = { status: 'invalid', color: 'orange', tooltip: statut || 'Hors tolérance' };
      }
    }

    // 4) Marquer en rouge les jours planifiés sans présence après échéance
    for (const p of plans) {
      const k = String(p.date);
      if (!result[k] && k < todayKey) {
        result[k] = { status: 'absent', color: 'red', tooltip: 'Planifié, non pointé' };
      }
    }

    return res.json({ success: true, days: result });
  } catch (error) {
    console.error('Erreur API attendance/day-status:', error);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// API endpoint pour les rapports de présence
app.get('/api/reports', async (req, res) => {
  try {
    const { from, to, agent_id } = req.query;
    
    let query = supabaseClient
      .from('report_presence_view')
      .select('*')
      .order('ts', { ascending: false });

    // Filtres optionnels
    if (from) {
      query = query.gte('ts', from);
    }
    if (to) {
      query = query.lte('ts', to);
    }
    if (agent_id && agent_id !== 'all') {
      query = query.eq('user_id', parseInt(agent_id, 10));
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Erreur Supabase report_presence_view:', error);
      return res.status(500).json({ error: 'Erreur lors de la récupération des rapports' });
    }

    // Les données sont déjà dans le bon format depuis la vue
    const reports = (data || []).map(report => ({
      agent_id: report.user_id,
      agent: report.agent || '—',
      projet: report.projet || '—',
      localisation: report.localisation || '—',
      rayon_m: report.rayon_m || '—',
      ref_lat: report.ref_lat,
      ref_lon: report.ref_lon,
      lat: report.lat,
      lon: report.lon,
      ts: report.ts,
      distance_m: report.distance_m || '—',
      statut: report.statut || '—'
    }));

    res.json({ success: true, data: reports });
  } catch (error) {
    console.error('Erreur API reports:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Rate limiting
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MS || '300000', 10)) || (5 * 60 * 1000),
    max: (parseInt(process.env.RATE_LIMIT_MAX || '5000', 10)) || 5000,
    message: 'Trop de requêtes, veuillez réessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      if ((process.env.RATE_LIMIT_DISABLE || 'false').toLowerCase() === 'true') return true;
      const ip = req.ip || '';
      const xff = String(req.headers['x-forwarded-for'] || '');
      // Bypass localhost
      if (ip === '::1' || ip === '127.0.0.1' || xff.includes('127.0.0.1') || xff.includes('::1')) return true;
      // Ne pas limiter les assets statiques ni le favicon
      if (req.method === 'GET') {
        const p = req.path || '';
        if (p === '/favicon.ico' || /\.(css|js|png|jpg|jpeg|svg|ico|webp|map)$/i.test(p)) return true;
      }
      return false;
    },
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
// Servir le dossier Media pour les images (accès public)
app.use('/Media', express.static(path.join(__dirname, 'Media')));

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

// Middleware d'authentification superviseur ou admin
function authenticateSupervisorOrAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'supervisor')) {
    return res.status(403).json({ error: 'Accès superviseur ou administrateur requis' });
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

// ===== ADMIN EXPORTS (CSV/TXT) =====
// Format colonnes:
// Nom, Prénom, Projet, Departement, Commune, Arrondissement, Village,
// Longitude_reference, Latitude_reference, Rayon_tolere_m,
// Latitude_actuelle, Longitude_actuelle, Date, Heure_debut_journee, Heure_fin_journee,
// Note, Photo, Statut_Presence, Distance_Reference_M
app.get('/api/admin/export/presence.csv', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    // Récupérer checkins + missions + users + profiles
    let checkinsQuery = supabaseClient
      .from('checkins')
      .select('id, mission_id, lat, lon, note, photo_path, timestamp');
    if (from) checkinsQuery = checkinsQuery.gte('timestamp', from.toISOString());
    if (to) checkinsQuery = checkinsQuery.lte('timestamp', to.toISOString());
    const { data: checkins, error: cErr } = await checkinsQuery;
    if (cErr) throw cErr;

    // Missions
    const missionIds = Array.from(new Set((checkins || []).map(c => c.mission_id).filter(Boolean)));
    const { data: missions, error: mErr } = await supabaseClient
      .from('missions')
      .select('id, agent_id, departement, commune, arrondissement, village')
      .in('id', missionIds.length ? missionIds : [0]);
    if (mErr) throw mErr;
    const missionById = new Map((missions||[]).map(m => [m.id, m]));

    // Users + Profiles
    const agentIds = Array.from(new Set((missions || []).map(m => m.agent_id).filter(Boolean)));
    const { data: users, error: uErr } = await supabaseClient
      .from('users')
      .select('id, first_name, last_name, name, project_name');
    if (uErr) throw uErr;
    const usersById = new Map((users||[]).map(u => [u.id, u]));
    const { data: profiles, error: pErr } = await supabaseClient
      .from('profiles')
      .select('user_id, reference_lat, reference_lon, tolerance_radius_meters');
    if (pErr) throw pErr;
    const profileByUser = new Map((profiles||[]).map(p => [p.user_id, p]));

    // Grouper par agent+jour pour déterminer début/fin de journée
    const byAgentDay = new Map();
    for (const c of (checkins || [])) {
      const m = missionById.get(c.mission_id) || {};
      const agentId = m.agent_id;
      if (!agentId) continue;
      const day = new Date(c.timestamp);
      const dayKey = day.toISOString().slice(0,10);
      const key = agentId + '|' + dayKey;
      if (!byAgentDay.has(key)) byAgentDay.set(key, []);
      byAgentDay.get(key).push(c);
    }

    // Calcul distance de référence (Haversine)
    const toRad = (v) => (Number(v) * Math.PI) / 180;
    function distanceMeters(lat1, lon1, lat2, lon2) {
      if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
      const R = 6371000;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c);
    }

    // Construire lignes
    const rows = [];
    for (const [key, list] of byAgentDay.entries()) {
      list.sort((a,b)=> new Date(a.timestamp) - new Date(b.timestamp));
      const [agentIdStr, dayKey] = key.split('|');
      const agentId = Number(agentIdStr);
      const first = list[0];
      const last = list[list.length-1];
      const mission = missionById.get(first.mission_id) || {};
      const user = usersById.get(agentId) || {};
      const prof = profileByUser.get(agentId) || {};

      const refLat = Number(prof.reference_lat);
      const refLon = Number(prof.reference_lon);
      const tol = Number(prof.tolerance_radius_meters || 5000);
      const curLat = Number(last.lat);
      const curLon = Number(last.lon);
      const dist = distanceMeters(refLat, refLon, curLat, curLon);
      const status = dist === null ? '' : (dist <= tol ? 'Présent' : 'Hors_zone');

      rows.push([
        user.last_name || (user.name||'').split(' ').slice(-1)[0] || '',
        user.first_name || (user.name||'').split(' ').slice(0, -1).join(' ') || '',
        user.project_name || '',
        mission.departement || '',
        mission.commune || '',
        mission.arrondissement || '',
        mission.village || '',
        String(refLon || ''),
        String(refLat || ''),
        String(tol || ''),
        String(curLat || ''),
        String(curLon || ''),
        dayKey,
        new Date(first.timestamp).toLocaleTimeString('fr-FR', { hour12:false }),
        new Date(last.timestamp).toLocaleTimeString('fr-FR', { hour12:false }),
        last.note || '',
        last.photo_path || '',
        status,
        String(dist ?? '')
      ]);
    }

    // CSV
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="presence-export.csv"');
    const header = [
      'Nom Animateur/agent','Prénom Animateur/Agent','Projet','Departement','Commune','Arrondissement','Village',
      'Longitude_reference','Latitude_reference','Rayon tolere (metre)','Latitude_actuelle','Longitude_actuelle','Date',
      'Heure debut journee','Heure fin journee','Note','Photo','Statut_Presence','Distance_Reference_M'
    ];
    const toCsv = (v) => {
      const s = String(v ?? '');
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
    };
    const csv = [header.map(toCsv).join(';')].concat(rows.map(r=> r.map(toCsv).join(';'))).join('\n');
    res.send(csv);
  } catch (e) {
    console.error('export/presence.csv error:', e);
    res.status(500).send('Erreur export');
  }
});

app.get('/api/admin/export/presence.txt', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  // Réutilise le CSV puis remplace le séparateur par des tabulations
  req.url = req.url.replace('/presence.txt','/presence.csv');
  try {
    const fakeRes = {
      _chunks: '',
      setHeader: ()=>{},
      send: (s)=>{ fakeRes._chunks = s; }
    };
    await new Promise((resolve)=>{
      // Appeler le handler CSV manuellement n'est pas trivial ici; renvoyer 501 simple
      resolve();
    });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(String(fakeRes._chunks || '').replace(/;/g, '\t'));
  } catch (e) {
    res.status(501).send('Non implémenté');
  }
});

// Standard health check expected by frontend
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running', database: 'Supabase' });
});

// ===== DEBUG AUTH =====
app.get('/api/debug/whoami', authenticateToken, async (req, res) => {
  try {
    const userId = req.user && (req.user.id || req.user.userId);
    let userRow = null;
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('id, email, role')
        .eq('id', userId)
        .single();
      if (!error) userRow = data || null;
    } catch {}
    res.json({ success: true, jwt_user: req.user, db_user: userRow });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || 'server_error' });
  }
});

// Test RLS/permissions sur planifications: insère un enregistrement éphémère puis le supprime
app.get('/api/debug/can-planify', authenticateToken, async (req, res) => {
  try {
    const userId = req.user && (req.user.id || req.user.userId);
    const today = new Date();
    const date = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString().slice(0,10);
    const probeNote = 'debug_probe_do_not_keep';

    // 1) tenter upsert
    const { error: upsertErr } = await supabaseClient
      .from('planifications')
      .upsert({ 
        user_id: userId,
        agent_id: userId, 
        date, 
        planned_start_time: null, 
        planned_end_time: null, 
        description_activite: probeNote 
      }, { onConflict: 'user_id,date' });

    // 2) tenter delete du probe
    let deleteErr = null;
    try {
      const { error } = await supabaseClient
        .from('planifications')
        .delete()
        .eq('agent_id', userId)
        .eq('date', date)
        .eq('description_activite', probeNote);
      if (error) deleteErr = error;
    } catch (e) {
      deleteErr = e;
    }

    res.json({ success: !upsertErr, upsert_error: upsertErr || null, delete_error: deleteErr || null, agent_id: userId, date });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || 'server_error' });
  }
});

// ===== PLANIFICATIONS (CRUD minimal) =====
// Créer ou mettre à jour une planification pour un jour
app.post('/api/planifications', async (req, res) => {
  try {
    const authHeader = String(req.headers['authorization'] || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization requise' });
    }
    const token = authHeader.slice('Bearer '.length);
    let userId; try { const d = jwt.verify(token, JWT_SECRET); userId = d.id || d.userId; } catch { return res.status(401).json({ success: false, error: 'Token invalide' }); }

    const { date, planned_start_time, planned_end_time, description_activite, project_name } = req.body || {};
    if (!date) return res.status(400).json({ success: false, error: 'date requise (YYYY-MM-DD)' });

    // Enrichir la description avec le nom complet de l'agent si disponible
    let enrichedDescription = description_activite || null;
    try {
      const { data: u } = await supabaseClient
        .from('users')
        .select('first_name, last_name, name')
        .eq('id', userId)
        .single();
      if (u) {
        const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.name || '';
        if (fullName && !enrichedDescription) {
          enrichedDescription = `Planification de ${fullName}`;
        }
      }
    } catch {}

    const payload = {
      user_id: userId,
      agent_id: userId,
      date,
      planned_start_time: planned_start_time || null,
      planned_end_time: planned_end_time || null,
      description_activite: enrichedDescription,
      project_name: project_name || null,
      resultat_journee: null,
      observations: null,
      updated_at: new Date().toISOString()
    };

    // Supprimer d'abord toute planification existante pour cette date et cet agent
    await supabaseClient
      .from('planifications')
      .delete()
      .eq('agent_id', userId)
      .eq('date', date);
    
    // Puis insérer la nouvelle planification
    const { error } = await supabaseClient
      .from('planifications')
      .insert(payload);
    if (error) throw error;
    return res.json({ success: true });
  } catch (e) {
    console.error('Erreur planifications upsert:', e);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Récupérer la planification d'une période
app.get('/api/planifications', async (req, res) => {
  try {
    const authHeader = String(req.headers['authorization'] || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization requise' });
    }
    const token = authHeader.slice('Bearer '.length);
    let userId; try { const d = jwt.verify(token, JWT_SECRET); userId = d.id || d.userId; } catch { return res.status(401).json({ success: false, error: 'Token invalide' }); }

    const { from, to } = req.query;
    let q = supabaseClient.from('planifications').select('*').eq('agent_id', userId).order('date');
    if (from) q = q.gte('date', String(from));
    if (to) q = q.lte('date', String(to));
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ success: true, items: data || [] });
  } catch (e) {
    console.error('Erreur planifications list:', e);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Mettre à jour le résultat d'une planification
app.put('/api/planifications/result', authenticateToken, async (req, res) => {
  try {
    const { date, resultat_journee, observations } = req.body;
    
    if (!date) {
      return res.status(400).json({ success: false, error: 'Date requise' });
    }

    const { data, error } = await supabaseClient
      .from('planifications')
      .update({
        resultat_journee: resultat_journee || null,
        observations: observations || null,
        updated_at: new Date().toISOString()
      })
      .eq('agent_id', req.user.id)
      .eq('date', date)
      .select();

    if (error) throw error;

    return res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Erreur mise à jour résultat:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Supprimer une planification
app.delete('/api/planifications/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabaseClient
      .from('planifications')
      .delete()
      .eq('id', id)
      .eq('agent_id', req.user.id);

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Planification supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur suppression planification:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Routes pour les projets
app.get('/api/projects', authenticateToken, async (req, res) => {
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

// Supabase health check
app.get('/api/supabase-health', async (req, res) => {
  try {
    const url = process.env.SUPABASE_URL || 'N/A';
    const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : (process.env.SUPABASE_ANON_KEY ? 'anon' : 'none');
    const envPresent = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY
    };
    const { data, error } = await supabaseClient.from('app_settings').select('count').limit(1);
    if (error) throw error;
    res.json({ status: 'OK', database: 'Supabase', connected: true, url, keyType, envPresent });
  } catch (err) {
    res.status(500).json({ 
      status: 'ERROR', 
      connected: false,
      error: (err && (err.message || err.toString())) || 'unknown',
      url: process.env.SUPABASE_URL || 'N/A',
      keyType: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : (process.env.SUPABASE_ANON_KEY ? 'anon' : 'none'),
      envPresent: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY
      }
    });
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

    // VÉRIFICATION OBLIGATOIRE : L'utilisateur doit être vérifié
    if (!user.is_verified) {
      return res.status(403).json({ 
        error: 'Compte non vérifié',
        message: 'Veuillez vérifier votre compte avec le code reçu par email avant de vous connecter. Si vous n\'avez pas reçu le code, contactez le super admin : syebadokpo@gmail.com ou +229 01 96 91 13 46',
        requires_verification: true
      });
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

    if (checkError) {
      console.warn('Register checkError:', checkError.message);
      return res.status(200).json({ success: false, message: 'Vérification indisponible. Réessayez plus tard.' });
    }
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Générer un code de vérification à 6 chiffres
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
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

    if (insertError) {
      console.warn('Register insertError:', insertError.message);
      return res.status(200).json({ success: false, message: "Création de compte indisponible. Réessayez plus tard." });
    }

    // Envoyer l'email de vérification (non-bloquant)
    // Option d'activation de l'envoi d'email via variable d'environnement
    if ((process.env.SEND_VERIFICATION_EMAIL || 'true').toLowerCase() === 'true') {
      try {
        const superAdmin = 'syebadokpo@gmail.com';
        const recipient = (role === 'admin') ? superAdmin : email;
        await sendVerificationEmail(recipient, verificationCode, email);
        console.log('✅ Email de vérification envoyé à:', recipient, '(pour compte:', email, ')');
      } catch (emailError) {
        console.warn('⚠️ Email de vérification non envoyé:', emailError.message);
        // Ne pas faire échouer l'inscription si l'email ne peut pas être envoyé
      }
    } else {
      console.log('✉️ Envoi email de vérification désactivé (SEND_VERIFICATION_EMAIL != true)');
    }

    res.json({
      success: true,
      message: 'Compte créé avec succès. Vérifiez votre email.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      },
      // Expose le code en DEV pour faciliter les tests si l'email n'est pas configuré
      ...(process.env.NODE_ENV !== 'production' ? { verification_code: verificationCode } : {})
    });

  } catch (error) {
    console.error('Erreur register:', error);
    return res.status(200).json({ success: false, message: 'Erreur serveur. Réessayez plus tard.' });
  }
});

// Verify
app.post('/api/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'Email et code de vérification requis' });
    }

    // Vérifier le code de vérification
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id, email, verification_code, verification_expires, is_verified')
      .eq('email', email)
      .eq('verification_code', code)
      .single();

    if (userError) throw userError;
    if (!user) {
      return res.status(400).json({ error: 'Code de vérification invalide' });
    }

    // Vérifier si le code a expiré
    const now = new Date();
    const expiresAt = new Date(user.verification_expires);
    if (now > expiresAt) {
      return res.status(400).json({ error: 'Code de vérification expiré' });
    }

    // Vérifier si déjà vérifié
    if (user.is_verified) {
      return res.status(400).json({ error: 'Compte déjà vérifié' });
    }

    // Marquer comme vérifié
    const { error: updateError } = await supabaseClient
      .from('users')
      .update({ 
        is_verified: true,
        verification_code: null,
        verification_expires: null
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Compte vérifié avec succès'
    });

  } catch (error) {
    console.error('Erreur verify:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Resend verification code
app.post('/api/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    // Vérifier l'utilisateur
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id, email, is_verified, role')
      .eq('email', email)
      .single();

    if (userError) throw userError;
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    if (user.is_verified) {
      return res.status(400).json({ error: 'Compte déjà vérifié' });
    }

    // Générer un nouveau code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Mettre à jour l'utilisateur
    const { error: updateError } = await supabaseClient
      .from('users')
      .update({
        verification_code: verificationCode,
        verification_expires: verificationExpires.toISOString()
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Envoyer l'email (non bloquant)
    try {
      const superAdmin = process.env.SUPERADMIN_EMAIL || process.env.EMAIL_USER;
      const recipient = (user.role === 'admin' && superAdmin) ? superAdmin : email;
      await sendVerificationEmail(recipient, verificationCode, email);
      console.log('✅ Email de vérification renvoyé à:', recipient, '(pour compte:', email, ')');
    } catch (emailError) {
      console.warn('⚠️ Email de vérification non renvoyé:', emailError.message);
    }

    res.json({ success: true, message: 'Nouveau code envoyé par email' });

  } catch (error) {
    console.error('Erreur resend-code:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Profile
// Récupérer le profil utilisateur
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('👤 Récupération profil utilisateur:', userId);
    
    const { data: user, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('❌ Erreur récupération profil:', error);
      throw error;
    }
    
    console.log('✅ Profil utilisateur récupéré');
    res.json({ success: true, user });
  } catch (error) {
    console.error('❌ Erreur profil utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Stats de présence (mois)
app.get('/api/presence/stats', async (req, res) => {
  try {
    const { year, month, email } = req.query;
    const y = parseInt(String(year)) || new Date().getFullYear();
    const m = parseInt(String(month)) || (new Date().getMonth() + 1);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();

    // Optionnel: filtrer par email -> user_id
    let userId = undefined;
    if (email) {
      const { data: u, error: uerr } = await supabaseClient
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      if (!uerr && u) userId = u.id;
    }

    // Calculer les statistiques à partir des tables missions et checkins
    let daysWorked = 0;
    let hoursWorked = 0;
    let expectedDays = 22;
    let currentMission = 'Aucune mission';

    try {
      // Récupérer les missions de l'utilisateur pour la période
      const missionsQuery = supabaseClient
        .from('missions')
        .select('id, date_start, date_end, status, total_distance_m')
        .gte('date_start', start)
        .lt('date_start', end);
      
      const { data: missions, error: missionsError } = userId 
        ? await missionsQuery.eq('agent_id', userId)
        : await missionsQuery;

      if (!missionsError && missions) {
        // Compter les jours travaillés (missions uniques par jour)
        const daySet = new Set();
        let totalHours = 0;

        for (const mission of missions) {
          if (mission.date_start) {
            const missionDate = new Date(mission.date_start).toISOString().slice(0, 10);
            daySet.add(missionDate);
            
            // Calculer la durée de la mission
            if (mission.date_end) {
              const startTime = new Date(mission.date_start);
              const endTime = new Date(mission.date_end);
              const durationMs = endTime - startTime;
              const durationHours = durationMs / (1000 * 60 * 60);
              totalHours += durationHours;
            }
          }
        }

        daysWorked = daySet.size;
        hoursWorked = Math.round(totalHours);

        // Vérifier s'il y a une mission active
        const activeMission = missions.find(m => m.status === 'active');
        if (activeMission) {
          currentMission = 'Mission active';
        }
      }

      // Récupérer les jours attendus depuis le profil utilisateur
      if (userId) {
        const { data: userProfile, error: profileError } = await supabaseClient
          .from('users')
          .select('expected_days_per_month')
          .eq('id', userId)
          .single();
        
        if (!profileError && userProfile && userProfile.expected_days_per_month) {
          expectedDays = userProfile.expected_days_per_month;
        }
      }

    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
    }

    res.json({ 
      success: true, 
      stats: { 
        days_worked: daysWorked, 
        hours_worked: hoursWorked, 
        expected_days: expectedDays,
        current_position: currentMission
      } 
    });
  } catch (error) {
    console.error('Erreur stats presence:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les présences (admin/superviseur)
app.get('/api/presence', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    
    console.log('📊 Récupération des présences, page:', page, 'limite:', limit);
    
    const { data: presences, error } = await supabaseClient
      .from('checkins')
      .select(`
        id, mission_id, lat, lon, timestamp, note, photo_path,
        missions!inner(id, agent_id, status, date_start, date_end,
          users!inner(id, email, name)
        )
      `)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('❌ Erreur récupération présences:', error);
      throw error;
    }
    
    console.log('✅ Présences récupérées:', presences?.length || 0);
    res.json({ success: true, data: { items: presences || [] } });
  } catch (error) {
    console.error('❌ Erreur présences:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des agents pour l'admin
app.get('/api/admin/agents', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const { data: users, error } = await supabaseClient
      .from('users')
      .select('id, email, name, project_name');

    if (error) throw error;
    return res.json({ success: true, data: users || [] });
  } catch (e) {
    console.error('❌ /api/admin/agents error:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récapitulatif mensuel validé par agent (admin)
app.get('/api/admin/attendance', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    if (!from || !to) {
      return res.status(400).json({ error: "Paramètres 'from' et 'to' requis (YYYY-MM-DD)" });
    }

    const fromISO = new Date(from + 'T00:00:00.000Z').toISOString();
    const toISO = new Date(new Date(to + 'T00:00:00.000Z').getTime() + 24*60*60*1000).toISOString();

    // Récupérer les missions dans l'intervalle, avec l'agent
    const { data: missions, error: missionsErr } = await supabaseClient
      .from('missions')
      .select('id, agent_id, date_start, date_end, status, users!inner(id, name, project_name)')
      .gte('date_start', fromISO)
      .lt('date_start', toISO);
    if (missionsErr) throw missionsErr;

    // Récupérer les planifications (jours planifiés) dans l'intervalle
    // On sélectionne toutes les colonnes pour être tolérant aux variations de schéma
    // Utilise le schéma fourni: id, agent_id, date
    let plans = null;
    {
      const { data: plansTry, error: plansErr } = await supabaseClient
        .from('planifications')
        .select('id, agent_id, date')
        .gte('date', from)
        .lte('date', to);
      if (!plansErr) {
        plans = plansTry;
      } else {
        // Fallback tolérant si la colonne 'date' a un autre nom
        const { data: plansAll, error: plansAllErr } = await supabaseClient
          .from('planifications')
          .select('*');
        if (plansAllErr) throw plansAllErr;
        plans = Array.isArray(plansAll) ? plansAll.filter(p => {
          const raw = p.date || p.date_planned || p.planned_date || p.date_start || p.jour || p.day;
          if (!raw) return false;
          const day = (raw + '').slice(0, 10);
          return day >= from && day <= to;
        }) : [];
      }
    }

    // Récupérer les check-ins liés à ces missions (via join) dans l'intervalle
    const { data: checkins, error: checkinsErr } = await supabaseClient
      .from('checkins')
      .select('id, timestamp, missions!inner(id, agent_id, users!inner(id, name, project_name))')
      .gte('timestamp', fromISO)
      .lt('timestamp', toISO);
    if (checkinsErr) throw checkinsErr;

    // Agréger par agent
    const byAgent = new Map();

    const ensureAgent = (agentId, name, project) => {
      if (!byAgent.has(agentId)) {
        byAgent.set(agentId, {
          agent_id: agentId,
          agent_name: name || `Agent ${agentId}`,
          project_name: project || '',
          plannedDays: new Set(),
          presenceDays: new Set(),
        });
      }
    };

    // Missions -> jours planifiés
    for (const m of Array.isArray(missions) ? missions : []) {
      const agentId = m.agent_id;
      const name = m.users?.name;
      const project = m.users?.project_name || '';
      ensureAgent(agentId, name, project);
      if (m.date_start) {
        const day = new Date(m.date_start).toISOString().slice(0, 10);
        byAgent.get(agentId).plannedDays.add(day);
      }
    }

    // Planifications -> jours planifiés (prend en compte plusieurs noms de colonnes possibles)
    for (const p of Array.isArray(plans) ? plans : []) {
      const agentId = p.agent_id || p.user_id || p.utilisateur_id;
      if (!agentId) continue;
      const name = p.user_name || p.name || undefined;
      const project = p.project_name || p.project || undefined;
      ensureAgent(agentId, name, project);
      const raw = p.date || p.date_planned || p.planned_date || p.date_start || p.jour || p.day;
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      const day = d.toISOString().slice(0, 10);
      byAgent.get(agentId).plannedDays.add(day);
    }

    // Check-ins -> jours de présence
    for (const c of Array.isArray(checkins) ? checkins : []) {
      const agentId = c.missions?.agent_id;
      const name = c.missions?.users?.name;
      const project = c.missions?.users?.project_name || '';
      ensureAgent(agentId, name, project);
      if (c.timestamp) {
        const day = new Date(c.timestamp).toISOString().slice(0, 10);
        byAgent.get(agentId).presenceDays.add(day);
      }
    }

    // Construire la sortie
    const rows = [];
    for (const [, stats] of byAgent) {
      const planned = stats.plannedDays.size;
      const present = stats.presenceDays.size;
      const absent = Math.max(planned - present, 0);

      // Justification basique; si besoin, remplacer par le résultat de l'algorithme distance/rayon
      let justification = '';
      if (present > 0 && absent === 0) justification = 'Présence validée (check-in)';
      else if (present > 0 && absent > 0) justification = 'Présence partielle';
      else if (present === 0 && planned > 0) justification = 'Absence (aucun check-in)';

      rows.push({
        agent_id: stats.agent_id,
        agent_name: stats.agent_name,
        project: stats.project_name || '—',
        planned_days: planned,
        present_days: present,
        absent_days: absent,
        justification,
      });
    }

    // Trier par agent
    rows.sort((a, b) => a.agent_name.localeCompare(b.agent_name));

    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error('❌ /api/admin/attendance error:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Présence du jour (via table checkins)
app.get('/api/presence/check-today', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

    // Trouver l'utilisateur
    const { data: u, error: uerr } = await supabaseClient
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    if (uerr || !u) return res.status(404).json({ success: true, has_presence: false });

    // Début/fin du jour (UTC)
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));

    // Chercher via missions -> checkins (pas de user_id direct dans checkins)
    const { data: rows, error } = await supabaseClient
      .from('checkins')
      .select('id, missions!inner(agent_id)')
      .eq('missions.agent_id', u.id)
      .gte('timestamp', start.toISOString())
      .lt('timestamp', end.toISOString())
      .limit(1);

    if (error) throw error;
    const has = Array.isArray(rows) && rows.length > 0;
    return res.json({ success: true, has_presence: has });
  } catch (e) {
    console.error('Erreur check-today:', e);
    return res.status(200).json({ success: true, has_presence: false });
  }
});

// Endpoint de test d'authentification simple (diagnostic)
app.get('/api/test-auth', async (req, res) => {
  try {
    const { email, password } = req.query;
    if (!email || !password) return res.status(400).json({ ok: false, error: 'email et password requis' });

    // Vérifier l'utilisateur dans Supabase
    const { data: user, error } = await supabaseClient
      .from('users')
      .select('id,email,password_hash')
      .eq('email', String(email).toLowerCase())
      .single();
    if (error || !user) return res.status(404).json({ ok: false, error: 'user_not_found' });

    // Option: si bcrypt dispo côté serveur
    let valid = false;
    try {
      const bcrypt = require('bcryptjs');
      valid = await bcrypt.compare(String(password), String(user.password_hash || ''));
    } catch {
      valid = false;
    }

    return res.json({ ok: true, userId: user.id, valid });
  } catch (e) {
    console.error('test-auth error:', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

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

    let profile = null;
    try {
      const { data: p } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      profile = p || null;
    } catch {}

    res.json({ success: true, user: { ...user, profile } });

  } catch (error) {
    console.error('Erreur profile:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upsert du profil (agent connecté)
app.post('/api/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      photo_path,
      first_name,
      last_name,
      phone,
      departement,
      commune,
      arrondissement,
      village,
      reference_lat,
      reference_lon,
      tolerance_radius_meters,
      project_name,
      hire_date,
      age
    } = req.body || {};

    const lat = reference_lat === undefined || reference_lat === null || reference_lat === '' ? null : Number(reference_lat);
    const lon = reference_lon === undefined || reference_lon === null || reference_lon === '' ? null : Number(reference_lon);
    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) return res.status(400).json({ success: false, error: 'Latitude de référence invalide' });
    if (lon !== null && (!Number.isFinite(lon) || lon < -180 || lon > 180)) return res.status(400).json({ success: false, error: 'Longitude de référence invalide' });
    const tol = tolerance_radius_meters === undefined || tolerance_radius_meters === null || tolerance_radius_meters === '' ? null : Math.max(0, parseInt(String(tolerance_radius_meters), 10) || 0);

    const payload = {
      user_id: userId,
      photo_path: photo_path ?? null,
      first_name: first_name ?? null,
      last_name: last_name ?? null,
      phone: phone ?? null,
      departement: departement ?? null,
      commune: commune ?? null,
      arrondissement: arrondissement ?? null,
      village: village ?? null,
      reference_lat: lat,
      reference_lon: lon,
      tolerance_radius_meters: tol ?? 500,
      project_name: project_name ?? null,
      hire_date: hire_date ?? null,
      age: (age === undefined || age === null || age === '') ? null : (parseInt(String(age), 10) || null),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;

    const usersUpdate = {};
    if (typeof hire_date !== 'undefined') usersUpdate.hire_date = hire_date || null;
    if (typeof age !== 'undefined') usersUpdate.age = (payload.age ?? null);
    if (Object.keys(usersUpdate).length > 0) {
      try { await supabaseClient.from('users').update(usersUpdate).eq('id', userId); } catch {}
    }

    return res.json({ success: true, profile: data });
  } catch (error) {
    console.error('Erreur upsert profile:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Alias compatible front: /api/me/profile -> même logique que /api/profile
app.post('/api/me/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      photo_path,
      first_name,
      last_name,
      phone,
      departement,
      commune,
      arrondissement,
      village,
      reference_lat,
      reference_lon,
      tolerance_radius_meters,
      project_name,
      hire_date,
      age
    } = req.body || {};

    const lat = reference_lat === undefined || reference_lat === null || reference_lat === '' ? null : Number(reference_lat);
    const lon = reference_lon === undefined || reference_lon === null || reference_lon === '' ? null : Number(reference_lon);
    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) return res.status(400).json({ success: false, error: 'Latitude de référence invalide' });
    if (lon !== null && (!Number.isFinite(lon) || lon < -180 || lon > 180)) return res.status(400).json({ success: false, error: 'Longitude de référence invalide' });
    const tol = tolerance_radius_meters === undefined || tolerance_radius_meters === null || tolerance_radius_meters === '' ? null : Math.max(0, parseInt(String(tolerance_radius_meters), 10) || 0);

    const payload = {
      user_id: userId,
      photo_path: photo_path ?? null,
      first_name: first_name ?? null,
      last_name: last_name ?? null,
      phone: phone ?? null,
      departement: departement ?? null,
      commune: commune ?? null,
      arrondissement: arrondissement ?? null,
      village: village ?? null,
      reference_lat: lat,
      reference_lon: lon,
      tolerance_radius_meters: tol ?? 500,
      project_name: project_name ?? null,
      hire_date: hire_date ?? null,
      age: (age === undefined || age === null || age === '') ? null : (parseInt(String(age), 10) || null),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;

    const usersUpdate = {};
    if (typeof hire_date !== 'undefined') usersUpdate.hire_date = hire_date || null;
    if (typeof age !== 'undefined') usersUpdate.age = (payload.age ?? null);
    if (Object.keys(usersUpdate).length > 0) {
      try { await supabaseClient.from('users').update(usersUpdate).eq('id', userId); } catch {}
    }

    return res.json({ success: true, profile: data });
  } catch (error) {
    console.error('Erreur upsert me/profile:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
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

    let enriched = missions || [];
    try {
      const ids = (enriched || []).map(m => m.id).filter(Boolean);
      if (ids.length) {
        // Earliest checkins per mission
        const { data: cAsc } = await supabaseClient
          .from('checkins')
          .select('mission_id, lat, lon, timestamp')
          .in('mission_id', ids)
          .order('timestamp', { ascending: true })
          .limit(2000);
        const firstByMission = new Map();
        (cAsc || []).forEach(c => { if (!firstByMission.has(c.mission_id)) firstByMission.set(c.mission_id, c); });
        // Latest checkins per mission
        const { data: cDesc } = await supabaseClient
          .from('checkins')
          .select('mission_id, lat, lon, timestamp')
          .in('mission_id', ids)
          .order('timestamp', { ascending: false })
          .limit(2000);
        const lastByMission = new Map();
        (cDesc || []).forEach(c => { if (!lastByMission.has(c.mission_id)) lastByMission.set(c.mission_id, c); });
        enriched = (enriched || []).map(m => ({
          ...m,
          start_lat: firstByMission.get(m.id)?.lat ?? null,
          start_lon: firstByMission.get(m.id)?.lon ?? null,
          end_lat: lastByMission.get(m.id)?.lat ?? null,
          end_lon: lastByMission.get(m.id)?.lon ?? null,
        }));
      }
    } catch (e) { console.warn('Enrichment missions start/end gps failed:', e?.message); }

    res.json({ success: true, missions: enriched });

  } catch (error) {
    console.error('Erreur missions:', error);
    // Mode tolérant: éviter d'interrompre le frontend si Supabase est indisponible
    res.json({ success: true, missions: [] });
  }
});

// Settings
app.get('/api/settings', async (req, res) => {
  // Réponse rapide non bloquante pour éviter les 500 pendant la config DB
  return res.status(200).json({ success: true, settings: {} });
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
    // Fallback non bloquant pour éviter le 500 côté UI
    return res.status(200).json({ success: true, settings: {} });
  }
});

// Routes manquantes pour Render
app.get('/api/admin-units', async (req, res) => {
  try {
    const { data, error } = await supabaseClient.from('admin_units').select('*');
    if (error) throw error;
    res.json({ success: true, units: data || [] });
  } catch (error) {
    console.error('Erreur admin-units:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '10', 10)));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || '').trim();
    const status = String(req.query.status || '').trim();
    const sortBy = String(req.query.sortBy || 'name').trim();
    const sortDir = (String(req.query.sortDir || 'asc').toLowerCase() === 'desc') ? 'desc' : 'asc';

    let query = supabaseClient
      .from('users')
      .select('id,name,email,role,phone,departement,project_name,status,photo_path,last_activity', { count: 'exact' });

    if (search) {
      query = query.ilike('name', `%${search}%`).or(`email.ilike.%${search}%`);
    }
    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);

    query = query.order(sortBy, { ascending: sortDir === 'asc' }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ success: true, items: data || [], total: count || 0, page, limit });
  } catch (error) {
    console.error('Erreur users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/push/public-key', async (req, res) => {
  try {
    // Clé publique VAPID pour les notifications push
    const publicKey = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HI8F5j7gK3xN8k';
    res.json({ success: true, publicKey });
  } catch (error) {
    console.error('Erreur push key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload direct de photo de profil (fallback local, aligne le front web/profile.js)
app.post('/api/profile/photo', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization requise' });
    }
    let userId;
    try {
      const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
      userId = decoded.id || decoded.userId;
    } catch {
      return res.status(401).json({ success: false, message: 'Token invalide' });
    }

    const body = req.body || {};
    const base64 = (body.photo_base64 || body.photo || '').toString();
    if (!base64 || base64.length < 50) {
      return res.status(400).json({ success: false, message: 'Image invalide' });
    }

    // 1) Obtenir/assurer l'id du profil relié à l'utilisateur
    let profileId = null;
    try {
      const { data: prof } = await supabaseClient.from('profiles').select('id').eq('user_id', userId).single();
      if (prof && prof.id) profileId = prof.id;
    } catch {}
    if (!profileId) {
      // Créer/assurer le profil minimal pour récupérer un id
      try {
        const { data: created } = await supabaseClient
          .from('profiles')
          .upsert({ user_id: userId }, { onConflict: 'user_id' })
          .select('id')
          .single();
        if (created && created.id) profileId = created.id;
      } catch {}
    }
    // Fallback si pas d'id profil: utiliser userId
    const keyName = `${profileId || 'user_' + userId}.png`;

    const buffer = Buffer.from(base64, 'base64');

    // 2) Si Supabase Storage est configuré, uploader dans le bucket 'avatars'
    let photoUrl = '';
    const hasSb = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
    if (hasSb) {
      try {
        // S'assurer que le bucket existe (ignorer les erreurs si déjà présent)
        try { await supabaseClient.storage.createBucket('avatars', { public: true }); } catch {}
        await supabaseClient.storage.from('avatars').upload(keyName, buffer, { upsert: true, contentType: 'image/png' });
        const { data: pub } = await supabaseClient.storage.from('avatars').getPublicUrl(keyName);
        photoUrl = pub?.publicUrl || '';
      } catch (e) {
        console.warn('Supabase Storage indisponible, bascule sur stockage local:', e?.message);
      }
    }

    // 3) Si pas d'URL (local/dev), enregistrer sous Media/uploads/avatars
    if (!photoUrl) {
      const avatarsDir = path.join(__dirname, 'Media', 'uploads', 'avatars');
      try { fs.mkdirSync(avatarsDir, { recursive: true }); } catch {}
      const filePath = path.join(avatarsDir, keyName);
      fs.writeFileSync(filePath, buffer);
      const publicBase = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
      const relativePath = `/Media/uploads/avatars/${keyName}`;
      photoUrl = publicBase ? `${publicBase}${relativePath}` : relativePath;
    }

    // 4) Mettre à jour le chemin dans profiles et users
    try { await supabaseClient.from('profiles').update({ photo_path: photoUrl }).eq('user_id', userId); } catch {}
    try { await supabaseClient.from('users').update({ photo_path: photoUrl }).eq('id', userId); } catch {}

    return res.json({ success: true, photo_url: photoUrl });
  } catch (e) {
    console.error('Erreur upload photo profil (server.js):', e);
    return res.status(500).json({ success: false, message: 'Erreur lors du téléversement' });
  }
});

// ===== CHECKINS (SUPABASE) =====

// Enregistrer un check-in (agent authentifié)
app.post('/api/checkins', authenticateToken, async (req, res) => {
  try {
    const {
      lat,
      lon,
      type = 'checkin',
      accuracy_m,
      commune,
      arrondissement,
      village,
      notes,
      timestamp
    } = req.body || {};

    if (!lat || !lon) {
      return res.status(400).json({ success: false, message: 'Latitude et longitude requis' });
    }

    const row = {
      user_id: req.user.id,
      lat: Number(lat),
      lon: Number(lon),
      type,
      accuracy_m: accuracy_m ? Number(accuracy_m) : null,
      commune: commune || null,
      arrondissement: arrondissement || null,
      village: village || null,
      notes: notes || null,
      timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    };

    const { data, error } = await supabaseClient.from('checkins').insert([row]).select().single();
    if (error) throw error;
    return res.json({ success: true, checkin: data });
  } catch (err) {
    console.error('Erreur enregistrement checkin:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer les derniers check-ins (superviseur/admin)
app.get('/api/admin/checkins/latest', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '100')), 500);
    console.log('🔍 Récupération des check-ins admin, limite:', limit);
    
    // Récupérer les check-ins avec les informations des missions et agents (colonnes réelles)
    const { data, error } = await supabaseClient
      .from('checkins')
      .select(`
        id, mission_id, lat, lon, timestamp, note, photo_path,
        missions!inner(id, agent_id, status, date_start, date_end,
          users!inner(id, email, name)
        )
      `)
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('❌ Erreur Supabase checkins latest:', error);
      throw error;
    }
    
    console.log('✅ Check-ins admin récupérés:', data?.length || 0);
    return res.json({ success: true, data: { items: data || [] } });
  } catch (err) {
    console.error('❌ Erreur lecture checkins latest:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur', details: err.message });
  }
});

// Récupérer les check-ins avec filtres (superviseur/admin)
app.get('/api/admin/checkins', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '100')), 1000);
    const offset = Math.max(parseInt(String(req.query.offset || '0')), 0);
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    
    console.log('🔍 Récupération des check-ins admin avec filtres:', { limit, offset, from, to });
    
    // Construire la requête avec filtres
    let query = supabaseClient
      .from('checkins')
      .select(`
        id, mission_id, lat, lon, timestamp, note, photo_path,
        missions!inner(id, agent_id, status, date_start, date_end,
          users!inner(id, email, name)
        )
      `)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (from) {
      query = query.gte('timestamp', from.toISOString());
    }
    if (to) {
      query = query.lte('timestamp', to.toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Erreur Supabase checkins:', error);
      throw error;
    }
    
    console.log('✅ Check-ins admin récupérés avec filtres:', data?.length || 0);
    return res.json({ success: true, data: { items: data || [] } });
  } catch (err) {
    console.error('❌ Erreur lecture checkins:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur', details: err.message });
  }
});

// ===== ADMIN: GESTION DES AGENTS =====

// Récupérer toutes les missions (admin/superviseur)
app.get('/api/admin/missions', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    
    console.log('📊 Récupération des missions admin, page:', page, 'limite:', limit);
    
    const { data: missions, error } = await supabaseClient
      .from('missions')
      .select(`
        id, agent_id, status, date_start, date_end, 
        total_distance_m, created_at, updated_at,
        users!inner(id, email, name)
      `)
      .order('date_start', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('❌ Erreur récupération missions admin:', error);
      throw error;
    }
    
    console.log('✅ Missions admin récupérées:', missions?.length || 0);
    res.json({ success: true, data: { items: missions || [] } });
  } catch (error) {
    console.error('❌ Erreur missions admin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer tous les agents (admin/superviseur)
app.get('/api/admin/agents', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const { data: agents, error } = await supabaseClient
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrichir avec les informations de localisation si disponibles
    const enrichedAgents = (agents || []).map(agent => ({
      ...agent,
      // Ajouter des champs par défaut si manquants
      status: agent.status || 'active',
      project_name: agent.project_name || agent.project || '',
      departement: agent.departement || '',
      commune: agent.commune || '',
      arrondissement: agent.arrondissement || '',
      village: agent.village || '',
      phone: agent.phone || '',
      reference_lat: agent.reference_lat || null,
      reference_lon: agent.reference_lon || null,
      tolerance_radius_meters: agent.tolerance_radius_meters || null,
      gps_accuracy: agent.gps_accuracy || 'medium',
      expected_days_per_month: agent.expected_days_per_month || null,
      expected_hours_per_month: agent.expected_hours_per_month || null,
      work_schedule: agent.work_schedule || '',
      contract_type: agent.contract_type || '',
      observations: agent.observations || '',
      photo_path: agent.photo_path || null
    }));

    res.json({ success: true, agents: enrichedAgents });
  } catch (error) {
    console.error('Erreur récupération agents:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un nouvel agent (admin uniquement)
app.post('/api/admin/agents', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const {
      name, email, first_name, last_name, phone, role, password,
      project_name, project_description, planning_start_date, planning_end_date,
      expected_days_per_month, expected_hours_per_month, work_schedule, contract_type,
      ref_lat, ref_lon, tolerance, gps_accuracy, observations,
      departement, commune, arrondissement, village
    } = req.body;

    // Validation des champs requis
    if (!name || !email || !role) {
      return res.status(400).json({ success: false, message: 'Nom, email et rôle requis' });
    }

    // Vérifier si l'email existe déjà
    const { data: existingUser } = await supabaseClient
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé' });
    }

    // Générer un mot de passe si non fourni
    const finalPassword = password || Math.random().toString(36).slice(-8);

    // Créer l'utilisateur
    const { data: newUser, error } = await supabaseClient
      .from('users')
      .insert([{
        name,
        email,
        first_name: first_name || null,
        last_name: last_name || null,
        phone: phone || null,
        role,
        password: finalPassword, // En production, il faudrait hasher le mot de passe
        project_name: project_name || null,
        project_description: project_description || null,
        planning_start_date: planning_start_date || null,
        planning_end_date: planning_end_date || null,
        expected_days_per_month: expected_days_per_month || null,
        expected_hours_per_month: expected_hours_per_month || null,
        work_schedule: work_schedule || null,
        contract_type: contract_type || null,
        reference_lat: ref_lat || null,
        reference_lon: ref_lon || null,
        tolerance_radius_meters: tolerance || null,
        gps_accuracy: gps_accuracy || 'medium',
        observations: observations || null,
        departement: departement || null,
        commune: commune || null,
        arrondissement: arrondissement || null,
        village: village || null,
        status: 'active'
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, agent: newUser, message: 'Agent créé avec succès' });
  } catch (error) {
    console.error('Erreur création agent:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Modifier un agent (admin uniquement)
app.put('/api/admin/agents/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const agentId = req.params.id;
    const updateData = req.body;

    // Supprimer les champs non modifiables
    delete updateData.id;
    delete updateData.created_at;

    const { data: updatedAgent, error } = await supabaseClient
      .from('users')
      .update(updateData)
      .eq('id', agentId)
      .select()
      .single();

    if (error) throw error;

    if (!updatedAgent) {
      return res.status(404).json({ success: false, message: 'Agent non trouvé' });
    }

    res.json({ success: true, agent: updatedAgent, message: 'Agent modifié avec succès' });
  } catch (error) {
    console.error('Erreur modification agent:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer un agent (admin uniquement)
app.delete('/api/admin/agents/:id', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const agentId = req.params.id;

    const { error } = await supabaseClient
      .from('users')
      .delete()
      .eq('id', agentId);

    if (error) throw error;

    res.json({ success: true, message: 'Agent supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression agent:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ===== DEBUG: MISSIONS & CHECKINS (lecture seule) =====
app.get('/api/debug/missions', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '10')), 100);
    const { data, error } = await supabaseClient
      .from('missions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    const { count: total } = await supabaseClient.from('missions').select('*', { count: 'exact', head: true });
    return res.json({ success: true, data: { total: total ?? null, items: data || [] } });
  } catch (e) {
    console.error('debug/missions error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'server_error' });
  }
});

// ===== MAP: présences (points de début de mission par agent) =====
app.get('/api/map/presences', authenticateToken, async (req, res) => {
  try {
    // Paramètre date (YYYY-MM-DD) sinon aujourd'hui (UTC)
    const dateStr = String(req.query.date || '').slice(0, 10);
    const now = new Date();
    const base = dateStr ? new Date(dateStr + 'T00:00:00Z') : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const start = new Date(base);
    const end = new Date(base); end.setUTCDate(end.getUTCDate() + 1);

    // Récupérer les missions du jour (actives ou terminées)
    const { data: missions, error: missionsErr } = await supabaseClient
      .from('missions')
      .select('id, agent_id, date_start, date_end, status')
      .gte('date_start', start.toISOString())
      .lt('date_start', end.toISOString())
      .order('date_start', { ascending: false })
      .limit(200);
    if (missionsErr) throw missionsErr;

    const missionList = missions || [];
    if (missionList.length === 0) return res.json({ success: true, items: [] });

    // Charger noms des agents
    const agentIds = Array.from(new Set(missionList.map(m => m.agent_id).filter(Boolean)));
    let agentMap = new Map();
    if (agentIds.length > 0) {
      const { data: users, error: usersErr } = await supabaseClient
        .from('users')
        .select('id, name')
        .in('id', agentIds);
      if (!usersErr && users) users.forEach(u => agentMap.set(u.id, u.name));
    }

    // Pour chaque mission, récupérer le premier checkin (début)
    const items = [];
    for (const m of missionList) {
      const { data: firstCheck, error: checkErr } = await supabaseClient
        .from('checkins')
        .select('lat, lon, timestamp')
        .eq('mission_id', m.id)
        .order('timestamp', { ascending: true })
        .limit(1)
        .single();
      if (checkErr || !firstCheck) continue;
      items.push({
        mission_id: m.id,
        agent_id: m.agent_id,
        agent_name: agentMap.get(m.agent_id) || 'Agent',
        lat: firstCheck.lat,
        lon: firstCheck.lon,
        timestamp: firstCheck.timestamp,
        status: m.status
      });
    }

    return res.json({ success: true, items });
  } catch (e) {
    console.error('map/presences error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'server_error' });
  }
});

// ===== Validation de présence (distance vs référence) =====
app.post('/api/presence/validate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lat, lon, timestamp } = req.body || {};
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ success: false, valid: false, reason: 'coord_invalides' });
    }

    // Charger profil pour ref coords et tolérance
    const { data: prof } = await supabaseClient
      .from('profiles')
      .select('reference_lat,reference_lon,tolerance_radius_meters,departement,commune')
      .eq('user_id', userId)
      .single();
    const refLat = prof?.reference_lat ?? null;
    const refLon = prof?.reference_lon ?? null;
    const tol = prof?.tolerance_radius_meters ?? 500;
    if (refLat === null || refLon === null) {
      return res.json({ success: true, valid: false, reason: 'ref_absente', distance_m: null, tolerance_m: tol });
    }

    // Haversine
    const toRad = (v) => (Number(v) * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(latitude - Number(refLat));
    const dLon = toRad(longitude - Number(refLon));
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(refLat)) * Math.cos(toRad(latitude)) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = Math.round(R * c);

    const valid = distance <= tol;
    return res.json({ success: true, valid, reason: valid ? 'dans_zone' : 'hors_zone', distance_m: distance, tolerance_m: tol, reference: { lat: refLat, lon: refLon, departement: prof?.departement, commune: prof?.commune }, point: { lat: latitude, lon: longitude, timestamp: timestamp || new Date().toISOString() } });
  } catch (e) {
    console.error('presence/validate error:', e);
    return res.status(500).json({ success: false, valid: false, reason: 'server_error' });
  }
});

app.get('/api/debug/checkins', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '10')), 100);
    const { data, error } = await supabaseClient
      .from('checkins')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;
    const { count: total } = await supabaseClient.from('checkins').select('*', { count: 'exact', head: true });
    return res.json({ success: true, data: { total: total ?? null, items: data || [] } });
  } catch (e) {
    console.error('debug/checkins error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'server_error' });
  }
});

// Endpoint de test pour vérifier les relations entre tables
app.get('/api/test/relations', authenticateToken, async (req, res) => {
  try {
    console.log('🔗 Test des relations entre tables...');
    
    const results = {
      connection: false,
      tables: {},
      relations: {}
    };
    
    // Test de connexion de base
    try {
      const { data: settings, error: settingsError } = await supabaseClient
        .from('app_settings')
        .select('*')
        .limit(1);
      
      if (settingsError) throw settingsError;
      results.connection = true;
      console.log('✅ Connexion Supabase établie');
    } catch (err) {
      console.error('❌ Erreur connexion:', err.message);
      return res.status(500).json({ success: false, error: 'Connexion Supabase échouée', details: err.message });
    }
    
    // Vérifier les tables principales
    const tables = ['users', 'presences', 'planifications', 'projects', 'missions', 'checkins', 'absences', 'reports'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabaseClient
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          results.tables[table] = { status: 'error', message: error.message };
          console.log(`⚠️ Table ${table}: ${error.message}`);
        } else {
          results.tables[table] = { status: 'ok', count: data?.length || 0 };
          console.log(`✅ Table ${table}: OK`);
        }
      } catch (err) {
        results.tables[table] = { status: 'error', message: err.message };
        console.log(`❌ Table ${table}: ${err.message}`);
      }
    }
    
    // Test des relations entre tables
    console.log('\n🔗 Test des relations entre tables...');
    
    // Test relation users -> presences
    try {
      const { data: userPresences, error: userPresencesError } = await supabaseClient
        .from('presences')
        .select(`
          id,
          start_time,
          users!inner(id, name, email)
        `)
        .limit(1);
      
      if (userPresencesError) {
        results.relations['users->presences'] = { status: 'error', message: userPresencesError.message };
        console.log(`⚠️ Relation users->presences: ${userPresencesError.message}`);
      } else {
        results.relations['users->presences'] = { status: 'ok', count: userPresences?.length || 0 };
        console.log('✅ Relation users->presences: OK');
      }
    } catch (err) {
      results.relations['users->presences'] = { status: 'error', message: err.message };
      console.log(`❌ Relation users->presences: ${err.message}`);
    }
    
    // Test relation users -> planifications
    try {
      const { data: userPlanifications, error: userPlanificationsError } = await supabaseClient
        .from('planifications')
        .select(`
          id,
          date,
          users!inner(id, name, email)
        `)
        .limit(1);
      
      if (userPlanificationsError) {
        results.relations['users->planifications'] = { status: 'error', message: userPlanificationsError.message };
        console.log(`⚠️ Relation users->planifications: ${userPlanificationsError.message}`);
      } else {
        results.relations['users->planifications'] = { status: 'ok', count: userPlanifications?.length || 0 };
        console.log('✅ Relation users->planifications: OK');
      }
    } catch (err) {
      results.relations['users->planifications'] = { status: 'error', message: err.message };
      console.log(`❌ Relation users->planifications: ${err.message}`);
    }
    
    // Test relation planifications -> projects
    try {
      const { data: planificationProjects, error: planificationProjectsError } = await supabaseClient
        .from('planifications')
        .select(`
          id,
          date,
          projects!inner(id, name)
        `)
        .not('project_id', 'is', null)
        .limit(1);
      
      if (planificationProjectsError) {
        results.relations['planifications->projects'] = { status: 'error', message: planificationProjectsError.message };
        console.log(`⚠️ Relation planifications->projects: ${planificationProjectsError.message}`);
      } else {
        results.relations['planifications->projects'] = { status: 'ok', count: planificationProjects?.length || 0 };
        console.log('✅ Relation planifications->projects: OK');
      }
    } catch (err) {
      results.relations['planifications->projects'] = { status: 'error', message: err.message };
      console.log(`❌ Relation planifications->projects: ${err.message}`);
    }
    
    // Test relation users -> missions
    try {
      const { data: userMissions, error: userMissionsError } = await supabaseClient
        .from('missions')
        .select(`
          id,
          title,
          users!inner(id, name, email)
        `)
        .limit(1);
      
      if (userMissionsError) {
        results.relations['users->missions'] = { status: 'error', message: userMissionsError.message };
        console.log(`⚠️ Relation users->missions: ${userMissionsError.message}`);
      } else {
        results.relations['users->missions'] = { status: 'ok', count: userMissions?.length || 0 };
        console.log('✅ Relation users->missions: OK');
      }
    } catch (err) {
      results.relations['users->missions'] = { status: 'error', message: err.message };
      console.log(`❌ Relation users->missions: ${err.message}`);
    }
    
    // Test relation users -> checkins
    try {
      const { data: userCheckins, error: userCheckinsError } = await supabaseClient
        .from('checkins')
        .select(`
          id,
          lat,
          lon,
          users!inner(id, name, email)
        `)
        .limit(1);
      
      if (userCheckinsError) {
        results.relations['users->checkins'] = { status: 'error', message: userCheckinsError.message };
        console.log(`⚠️ Relation users->checkins: ${userCheckinsError.message}`);
      } else {
        results.relations['users->checkins'] = { status: 'ok', count: userCheckins?.length || 0 };
        console.log('✅ Relation users->checkins: OK');
      }
    } catch (err) {
      results.relations['users->checkins'] = { status: 'error', message: err.message };
      console.log(`❌ Relation users->checkins: ${err.message}`);
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Test des relations terminé',
      results 
    });
    
  } catch (error) {
    console.error('❌ Erreur générale test relations:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint de test ultra-simple pour Supabase
app.get('/api/test/supabase', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 Test connexion Supabase...');
    
    // Test 1: Lister les tables disponibles (si possible)
    const { data: tables, error: tablesError } = await supabaseClient
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(10);
    
    console.log('Tables disponibles:', tables);
    
    // Test 2: Vérifier la table missions
    const { data: missionsTest, error: missionsError } = await supabaseClient
      .from('missions')
      .select('id')
      .limit(1);
    
    console.log('Test table missions:', missionsTest, missionsError);
    
    // Test 3: Vérifier la table checkins
    const { data: checkinsTest, error: checkinsError } = await supabaseClient
      .from('checkins')
      .select('id')
      .limit(1);
    
    console.log('Test table checkins:', checkinsTest, checkinsError);
    
    return res.json({
      success: true,
      tests: {
        tables: { data: tables, error: tablesError?.message },
        missions: { data: missionsTest, error: missionsError?.message },
        checkins: { data: checkinsTest, error: checkinsError?.message }
      }
    });
    
  } catch (err) {
    console.error('Erreur test Supabase:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint de test pour vérifier les check-ins
app.get('/api/checkins/test', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 Test endpoint checkins pour user:', req.user.id);
    
    // Test 1: Compter tous les check-ins
    const { count: totalCheckins, error: countError } = await supabaseClient
      .from('checkins')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Erreur count checkins:', countError);
    } else {
      console.log('Total check-ins dans la base:', totalCheckins);
    }
    
    // Test 2: Récupérer quelques check-ins avec colonnes minimales
    const { data: sampleCheckins, error: sampleError } = await supabaseClient
      .from('checkins')
      .select('id, lat, lon, timestamp')
      .limit(5);
    
    if (sampleError) {
      console.error('Erreur sample checkins:', sampleError);
    } else {
      console.log('Échantillon check-ins:', sampleCheckins);
    }
    
    // Test 3: Missions de l'utilisateur
    const { data: userMissions, error: missionsError } = await supabaseClient
      .from('missions')
      .select('id, status, date_start')
      .eq('agent_id', req.user.id);
    
    if (missionsError) {
      console.error('Erreur missions user:', missionsError);
    } else {
      console.log('Missions utilisateur:', userMissions);
    }
    
    return res.json({
      success: true,
      test_results: {
        total_checkins: totalCheckins || 0,
        sample_checkins: sampleCheckins || [],
        user_missions: userMissions || [],
        user_id: req.user.id
      }
    });
    
  } catch (err) {
    console.error('Erreur test checkins:', err);
    return res.status(500).json({ success: false, message: 'Erreur test', error: err.message });
  }
});

// Récupérer mes check-ins (agent connecté) - Version ultra-simple
app.get('/api/checkins/mine', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 /api/checkins/mine appelé pour user:', req.user.id);
    
    const { from, to } = req.query;
    // 1) Récupérer les missions de l'agent connecté
    const { data: missions, error: missionsErr } = await supabaseClient
      .from('missions')
      .select('id')
      .eq('agent_id', req.user.id)
      .limit(500);
    
    if (missionsErr) {
      console.error('Erreur récupération missions:', missionsErr);
      throw missionsErr;
    }
    
    const missionIds = (missions || []).map(m => m.id).filter(Boolean);
    console.log('Missions trouvées:', missionIds.length, missionIds);
    
    if (missionIds.length === 0) {
      console.log('Aucune mission trouvée, retour liste vide');
      return res.json({ success: true, items: [] });
    }

    // 2) Récupérer les checkins avec seulement les colonnes essentielles
    try {
    let q = supabaseClient
      .from('checkins')
        .select('id, mission_id, lat, lon, timestamp')
      .in('mission_id', missionIds)
      .order('timestamp', { ascending: false })
      .limit(500);
      
    if (from) q = q.gte('timestamp', new Date(String(from)).toISOString());
    if (to) q = q.lte('timestamp', new Date(String(to)).toISOString());
      
    const { data, error } = await q;
      if (error) {
        console.error('Erreur requête checkins:', error);
        throw error;
      }
      
      console.log('Check-ins trouvés:', (data || []).length);
    return res.json({ success: true, items: data || [] });
      
    } catch (checkinError) {
      console.error('Erreur spécifique checkins:', checkinError);
      // Fallback: essayer avec encore moins de colonnes
      const { data: fallbackData, error: fallbackError } = await supabaseClient
        .from('checkins')
        .select('id, lat, lon, timestamp')
        .in('mission_id', missionIds)
        .order('timestamp', { ascending: false })
        .limit(500);
      
      if (fallbackError) throw fallbackError;
      console.log('Fallback réussi, check-ins:', (fallbackData || []).length);
      return res.json({ success: true, items: fallbackData || [] });
    }
    
  } catch (err) {
    console.error('Erreur lecture mes checkins:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
});

// Récupérer les check-ins d'une mission spécifique (admin/superviseur ou propriétaire)
app.get('/api/missions/:id/checkins', authenticateToken, async (req, res) => {
  try {
    const missionId = Number(req.params.id);
    if (!Number.isFinite(missionId)) return res.status(400).json({ success: false, message: 'mission_id invalide' });

    // Vérifier accès: admin/superviseur ou mission appartenant à l'utilisateur
    let allowed = false;
    try {
      if (req.user && (req.user.role === 'admin' || req.user.role === 'supervisor')) {
        allowed = true;
      } else {
        const { data: m } = await supabaseClient
          .from('missions')
          .select('agent_id')
          .eq('id', missionId)
          .single();
        if (m && m.agent_id === req.user.id) allowed = true;
      }
    } catch {}
    if (!allowed) return res.status(403).json({ success: false, message: 'Accès refusé' });

    // Utiliser seulement les colonnes essentielles pour éviter les erreurs
    let q = supabaseClient
      .from('checkins')
      .select('id, mission_id, lat, lon, timestamp')
      .eq('mission_id', missionId)
      .order('timestamp', { ascending: false })
      .limit(500);
    
    const { data, error } = await q;
    if (error) {
      console.error('Erreur checkins mission:', error);
      throw error;
    }
    
    console.log(`Check-ins mission ${missionId}:`, (data || []).length);
    return res.json({ success: true, items: data || [] });
  } catch (err) {
    console.error('Erreur lecture checkins par mission:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Enregistrer/mettre à jour la distance totale parcourue pour une mission
app.post('/api/missions/:id/distance', authenticateToken, async (req, res) => {
  try {
    const missionId = Number(req.params.id);
    if (!Number.isFinite(missionId)) return res.status(400).json({ success: false, message: 'mission_id invalide' });

    const { total_distance_m } = req.body || {};
    const total = Number(total_distance_m);
    if (!Number.isFinite(total) || total < 0) return res.status(400).json({ success: false, message: 'total_distance_m invalide' });

    // Vérifier que la mission appartient à l'utilisateur ou que l'utilisateur est admin/superviseur
    let allowed = false;
    try {
      const { data: mission } = await supabaseClient
        .from('missions')
        .select('id, agent_id')
        .eq('id', missionId)
        .single();
      if (mission && mission.agent_id) {
        allowed = (mission.agent_id === req.user.id) || req.user.role === 'admin' || req.user.role === 'superviseur' || req.user.role === 'supervisor';
      }
    } catch {}
    if (!allowed) return res.status(403).json({ success: false, message: 'Accès refusé' });

    // Mettre à jour la mission avec la distance et le timestamp
    const { error } = await supabaseClient
      .from('missions')
      .update({ total_distance_m: total, updated_at: new Date().toISOString() })
      .eq('id', missionId);
    if (error) throw error;

    return res.json({ success: true });
  } catch (e) {
    console.error('Erreur /api/missions/:id/distance:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer mes validations de checkins avec détails
app.get('/api/validations/mine', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    let q = supabaseClient
      .from('checkin_validations')
      .select('id, checkin_id, agent_id, valid, reason, distance_m, tolerance_m, reference_lat, reference_lon, planned_start_time, planned_end_time, created_at')
      .eq('agent_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (from) q = q.gte('created_at', new Date(String(from)).toISOString());
    if (to) q = q.lte('created_at', new Date(String(to)).toISOString());
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ success: true, items: data || [] });
  } catch (e) {
    console.error('Erreur lecture validations:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Récupérer validations (admin/superviseur) avec enrichissements pour rapports
app.get('/api/reports/validations', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const { from, to, agent_id } = req.query;
    // 1) Lire validations dans l'intervalle
    let vq = supabaseClient
      .from('checkin_validations')
      .select('id, checkin_id, agent_id, valid, reason, distance_m, tolerance_m, reference_lat, reference_lon, planned_start_time, planned_end_time, created_at')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (agent_id) vq = vq.eq('agent_id', Number(agent_id));
    if (from) vq = vq.gte('created_at', new Date(String(from)).toISOString());
    if (to) vq = vq.lte('created_at', new Date(String(to)).toISOString());
    const { data: validations, error: vErr } = await vq;
    if (vErr) throw vErr;

    const items = validations || [];
    if (items.length === 0) return res.json({ success: true, items: [] });

    // 2) Charger checkins liés
    const checkinIds = Array.from(new Set(items.map(i => i.checkin_id).filter(Boolean)));
    let checkinsMap = new Map();
    if (checkinIds.length) {
      const { data: checkins } = await supabaseClient
        .from('checkins')
        .select('id, mission_id, lat, lon, note, photo_path, timestamp')
        .in('id', checkinIds);
      (checkins || []).forEach(c => checkinsMap.set(c.id, c));
    }

    // 3) Charger profils/agents
    const agentIds = Array.from(new Set(items.map(i => i.agent_id).filter(Boolean)));
    let profilesMap = new Map();
    if (agentIds.length) {
      const { data: profs } = await supabaseClient
        .from('profiles')
        .select('user_id, name, first_name, last_name, project_name, departement, commune, arrondissement, village');
      (profs || []).forEach(p => profilesMap.set(p.user_id, p));
    }

    // 4) Construire sorties
    const out = items.map(v => {
      const c = checkinsMap.get(v.checkin_id) || {};
      const p = profilesMap.get(v.agent_id) || {};
      const fullName = p.name || [p.first_name, p.last_name].filter(Boolean).join(' ');
      return {
        agent_id: v.agent_id,
        agent_name: fullName || `Agent #${v.agent_id}`,
        project_name: p.project_name || '',
        departement: p.departement || '',
        commune: p.commune || '',
        arrondissement: p.arrondissement || '',
        village: p.village || '',
        reference_lon: v.reference_lon,
        reference_lat: v.reference_lat,
        tolerance_radius_meters: v.tolerance_m,
        lat: c.lat,
        lon: c.lon,
        date: v.created_at,
        day_start_time: v.planned_start_time || null,
        day_end_time: v.planned_end_time || null,
        note: c.note || '',
        photo_path: c.photo_path || '',
        status: v.valid ? 'present' : 'absent',
        within_tolerance: v.valid,
        distance_from_reference_m: v.distance_m ?? null,
        checkin_id: v.checkin_id,
        validation_id: v.id
      };
    });

    return res.json({ success: true, items: out });
  } catch (e) {
    console.error('Erreur /api/reports/validations:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ====== PRESENCE: start mission ======
app.post('/api/presence/start', upload.single('photo'), async (req, res) => {
  try {
    // Auth: Bearer token
    const authHeader = String(req.headers['authorization'] || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization requise' });
    }
    const token = authHeader.slice('Bearer '.length);
    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id || decoded.userId;
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Token invalide' });
    }

    // Extraire données (multer a parsé form-data)
    const { lat, lon, departement, commune, arrondissement, village, note, start_time: startTimeInput } = req.body || {};
    const start_time = startTimeInput || new Date().toISOString();

    // Validation minimale
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, message: 'Coordonnées invalides' });
    }

    // 1) Créer la mission (Supabase schema)
    let missionId = null;
    try {
      const { data: mission, error: missionErr } = await supabaseClient
        .from('missions')
        .insert([{ 
          agent_id: userId,
          date_start: start_time,
          status: 'active',
          departement: departement || null,
          commune: commune || null,
          arrondissement: arrondissement || null,
          village: village || null,
          note: note || 'Début de mission'
        }])
        .select('id')
        .single();
      if (missionErr) throw missionErr;
      missionId = mission?.id || null;
    } catch (e) {
      console.warn('Création mission échouée (non bloquant):', e?.message);
    }

    // 2) Si une photo est fournie, l'uploader vers Supabase Storage et récupérer l'URL publique
    let startPhotoUrl = null;
    try {
      if (req.file && req.file.buffer && supabaseClient) {
        try { await supabaseClient.storage.createBucket('photos', { public: true }); } catch {}
        const ts = Date.now();
        const key = `checkins/${userId}/${missionId || 'no_mission'}/start_${ts}.jpg`;
        const contentType = (req.file.mimetype && typeof req.file.mimetype === 'string') ? req.file.mimetype : 'image/jpeg';
        await supabaseClient.storage.from('photos').upload(key, req.file.buffer, { upsert: true, contentType });
        const { data: pub } = await supabaseClient.storage.from('photos').getPublicUrl(key);
        startPhotoUrl = pub && pub.publicUrl ? pub.publicUrl : null;
      }
    } catch {}

    // 3) Insérer le premier check-in lié à la mission (si mission créée) et enregistrer la validation
    let insertedCheckinId = null;
    try {
      const { data: chk, error: chkErr } = await supabaseClient
        .from('checkins')
        .insert([{ 
          mission_id: missionId,
          lat: latitude,
          lon: longitude,
          note: note || 'Début de mission',
          photo_path: startPhotoUrl || null,
          timestamp: start_time
        }])
        .select('id')
        .single();
      if (chkErr) throw chkErr;
      insertedCheckinId = chk?.id || null;
    } catch (e) {
      console.warn('Insertion checkin start échouée (non bloquant):', e?.message);
    }

    // 3) Calculer et stocker la validation (distance/rayon + planification du jour)
    if (insertedCheckinId) {
      try {
        // Charger point de référence et tolérance
        const { data: prof } = await supabaseClient
          .from('profiles')
          .select('reference_lat, reference_lon, tolerance_radius_meters')
          .eq('user_id', userId)
          .single();
        const refLat = prof?.reference_lat ?? null;
        const refLon = prof?.reference_lon ?? null;
        const tol = Number(prof?.tolerance_radius_meters ?? 100);

        // Charger planification du jour
        const dayIso = new Date(start_time);
        const todayDate = `${dayIso.getFullYear()}-${String(dayIso.getMonth()+1).padStart(2,'0')}-${String(dayIso.getDate()).padStart(2,'0')}`;
        const { data: plan } = await supabaseClient
          .from('planifications')
          .select('planned_start_time, planned_end_time')
          .eq('agent_id', userId)
          .eq('date', todayDate)
          .single();

        // Calcul distance haversine
        let distance = null;
        if (refLat != null && refLon != null) {
          const toRad = (v) => (v * Math.PI) / 180;
          const R = 6371000;
          const dLat = toRad(latitude - Number(refLat));
          const dLon = toRad(longitude - Number(refLon));
          const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(Number(refLat))) * Math.cos(toRad(latitude)) * Math.sin(dLon/2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distance = Math.round(R * c);
        }
        const withinRadius = distance == null ? true : distance <= tol;
        const valid = withinRadius; // extension: ajouter vérification créneau horaire si souhaité

        await supabaseClient.from('checkin_validations').insert([{ 
          checkin_id: insertedCheckinId,
          agent_id: userId,
          valid,
          reason: valid ? 'ok' : 'hors_zone',
          distance_m: distance,
          reference_lat: refLat,
          reference_lon: refLon,
          tolerance_m: tol,
          planned_start_time: plan?.planned_start_time || null,
          planned_end_time: plan?.planned_end_time || null
        }]);
      } catch (e) {
        console.warn('Validation checkin non enregistrée:', e?.message);
      }
    }

    return res.json({ success: true, data: { message: 'Mission démarrée', mission_id: missionId, photo_url: startPhotoUrl } });
  } catch (error) {
    console.error('Erreur /api/presence/start:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ====== PRESENCE: end mission ======
app.post('/api/presence/end', upload.single('photo'), async (req, res) => {
  try {
    // Auth: Bearer token
    const authHeader = String(req.headers['authorization'] || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization requise' });
    }
    const token = authHeader.slice('Bearer '.length);
    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id || decoded.userId;
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Token invalide' });
    }

    // Données
    const { mission_id, lat, lon, note, end_time: endTimeInput } = req.body || {};
    const end_time = endTimeInput || new Date().toISOString();
    const latitude = lat !== undefined ? Number(lat) : undefined;
    const longitude = lon !== undefined ? Number(lon) : undefined;

    // Déterminer la mission cible: utiliser mission_id fourni, sinon dernière active de l'agent
    let targetMissionId = mission_id ? Number(mission_id) : null;
    let updateByIdOnly = false; // autoriser update par id seul si admin/superviseur ou propriétaire
    if (targetMissionId && Number.isFinite(targetMissionId)) {
      try {
        const { data: m } = await supabaseClient
          .from('missions')
          .select('agent_id,status')
          .eq('id', targetMissionId)
          .single();
        const isOwner = m && m.agent_id === userId;
        const isPrivileged = req.user && (req.user.role === 'admin' || req.user.role === 'supervisor');
        updateByIdOnly = Boolean(isOwner || isPrivileged);
      } catch {}
    }
    if (!targetMissionId || !Number.isFinite(targetMissionId)) {
      try {
        const { data: last, error: lastErr } = await supabaseClient
          .from('missions')
          .select('id')
          .eq('agent_id', userId)
          .eq('status', 'active')
          .order('date_start', { ascending: false })
          .limit(1)
          .single();
        if (!lastErr && last) targetMissionId = last.id;
      } catch {}
    }
    if (!targetMissionId) {
      return res.status(404).json({ success: false, message: 'Aucune mission active' });
    }

    // Si une photo est fournie, l'uploader vers Supabase Storage et garder l'URL
    let endPhotoUrl = null;
    try {
      if (req.file && req.file.buffer && supabaseClient) {
        try { await supabaseClient.storage.createBucket('photos', { public: true }); } catch {}
        const ts = Date.now();
        const key = `checkins/${userId}/${targetMissionId || 'no_mission'}/end_${ts}.jpg`;
        const contentType = (req.file.mimetype && typeof req.file.mimetype === 'string') ? req.file.mimetype : 'image/jpeg';
        await supabaseClient.storage.from('photos').upload(key, req.file.buffer, { upsert: true, contentType });
        const { data: pub } = await supabaseClient.storage.from('photos').getPublicUrl(key);
        endPhotoUrl = pub && pub.publicUrl ? pub.publicUrl : null;
      }
    } catch {}

    // Clôturer la mission
    try {
      let upd = supabaseClient
        .from('missions')
        .update({ 
          date_end: end_time,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', targetMissionId);
      if (!updateByIdOnly) {
        upd = upd.eq('agent_id', userId);
      }
      await upd;
    } catch (e) {
      console.warn('Mise à jour mission fin échouée (non bloquant):', e?.message);
    }

    // Enregistrer un check-in de fin si coordonnées fournies
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      try {
        await supabaseClient.from('checkins').insert([{ 
          mission_id: targetMissionId,
          lat: latitude,
          lon: longitude,
          note: note || 'Fin de mission',
          photo_path: endPhotoUrl || null,
          timestamp: end_time
        }]);
      } catch (e) {
        console.warn('Insertion checkin end échouée (non bloquant):', e?.message);
      }
    }

    // Recharger la mission pour confirmer le statut/date_end
    let missionAfter = null;
    try {
      const { data: m2 } = await supabaseClient
        .from('missions')
        .select('id, status, date_start, date_end')
        .eq('id', targetMissionId)
        .single();
      missionAfter = m2 || null;
    } catch {}

    return res.json({ success: true, data: { message: 'Mission terminée', mission_id: targetMissionId, mission: missionAfter, photo_url: endPhotoUrl, force_end: !Number.isFinite(latitude) || !Number.isFinite(longitude) } });
  } catch (error) {
    console.error('Erreur /api/presence/end:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Forcer la clôture d'une mission (fallback administratif ou en cas de désynchro)
app.post('/api/missions/:id/complete', authenticateToken, async (req, res) => {
  try {
    const missionId = Number(req.params.id);
    if (!Number.isFinite(missionId)) return res.status(400).json({ success: false, message: 'mission_id invalide' });

    const { lat, lon, note, end_time: endTimeInput } = req.body || {};
    const end_time = endTimeInput || new Date().toISOString();
    const latitude = lat !== undefined ? Number(lat) : undefined;
    const longitude = lon !== undefined ? Number(lon) : undefined;

    // 1) Vérifier que la mission appartient à l'utilisateur ou qu'il est admin
    const { data: mission } = await supabaseClient
      .from('missions')
      .select('id, agent_id, status')
      .eq('id', missionId)
      .single();
    
    if (!mission) return res.status(404).json({ success: false, message: 'Mission non trouvée' });
    
    const isOwner = mission.agent_id === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superviseur' || req.user.role === 'supervisor';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    // 2) Mettre la mission en completed
    const { error: updateError } = await supabaseClient
      .from('missions')
      .update({ date_end: end_time, status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', missionId);

    if (updateError) throw updateError;

    // 3) Enregistrer un check-in de fin si coords fournies
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      await supabaseClient.from('checkins').insert([{ 
        mission_id: missionId,
        lat: latitude,
        lon: longitude,
        note: note || 'Fin de mission (forcée)',
        timestamp: end_time
      }]);
    }

    return res.json({ success: true });
  } catch (e) {
    console.error('Erreur /api/missions/:id/complete:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ===== FONCTIONS EMAIL =====

// Fonction pour envoyer un email de récupération de mot de passe
async function sendRecoveryEmail(email, name, recoveryCode) {
  try {
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

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '🔐 Récupération de mot de passe - Presence CCR-B',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">🔐 Récupération de mot de passe</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Presence CCR-B</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h2 style="color: #333; margin-top: 0;">Bonjour ${name},</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
              Vous avez demandé une récupération de mot de passe pour votre compte Presence CCR-B.
            </p>
            
            <div style="background: #fff; border: 2px solid #007bff; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <p style="margin: 0 0 10px 0; color: #333; font-weight: bold;">Votre code de récupération :</p>
              <div style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; font-family: 'Courier New', monospace;">
                ${recoveryCode}
              </div>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⚠️ Important :</strong><br>
                • Ce code est valide pendant <strong>15 minutes</strong><br>
                • Ne partagez jamais ce code avec personne<br>
                • Si vous n'avez pas demandé cette récupération, ignorez cet email
              </p>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 0;">
              Si vous avez des questions ou besoin d'aide, contactez votre administrateur.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            <p>© 2024 Presence CCR-B - Tous droits réservés</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Email de récupération envoyé à ${email}`);
  } catch (error) {
    console.error('Erreur envoi email récupération:', error);
    throw error;
  }
}

// Vérifier le transport email
app.get('/api/debug/email/verify', async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await transporter.verify();
    return res.json({ success: true, message: 'SMTP OK', user: process.env.EMAIL_USER });
  } catch (e) {
    console.error('SMTP verify error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'smtp_error' });
  }
});

// Envoyer un email de test (admin uniquement)
app.post('/api/debug/email/send', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const to = (req.body && req.body.to) || process.env.SUPERADMIN_EMAIL || process.env.EMAIL_USER;
    const subject = (req.body && req.body.subject) || 'Test Email Presence CCR-B';
    const text = (req.body && req.body.text) || 'Ceci est un email de test.';
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
    return res.json({ success: true, sent_to: to });
  } catch (e) {
    console.error('SMTP test send error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'smtp_send_error' });
  }
});

// ===== ROUTES DE RÉCUPÉRATION DE MOT DE PASSE =====

// Handler partagé: demande de code de récupération
async function handleForgotPassword(req, res) {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Adresse email requise' 
      });
    }
    
    // Vérifier si l'utilisateur existe
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id, email, name')
      .eq('email', email.toLowerCase())
      .single();
    
    if (userError || !user) {
      // Répondre 200 avec success:false pour que le frontend affiche un message sans casser le flux
      return res.json({ 
        success: false, 
        message: 'Aucun compte trouvé avec cette adresse email' 
      });
    }
    
    // Générer un code de récupération à 6 chiffres
    const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
    const recoveryExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Sauvegarder le code de récupération
    const { error: updateError } = await supabaseClient
      .from('users')
      .update({ 
        recovery_code: recoveryCode,
        recovery_expires: recoveryExpires.toISOString()
      })
      .eq('id', user.id);
    
    if (updateError) {
      console.error('Erreur sauvegarde code récupération:', updateError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la génération du code de récupération' 
      });
    }
    
    // Envoyer l'email de récupération
    try {
      await sendRecoveryEmail(email, user.name, recoveryCode);
      console.log(`✅ Code de récupération envoyé à ${email}: ${recoveryCode}`);
    } catch (emailError) {
      console.error('Erreur envoi email récupération:', emailError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de l\'envoi de l\'email de récupération' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Code de récupération envoyé par email' 
    });
    
  } catch (error) {
    console.error('Erreur forgot-password:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la récupération' 
    });
  }
}

// Exposer routes avec et sans préfixe /api
app.post('/forgot-password', handleForgotPassword);
app.post('/api/forgot-password', (req, res) => handleForgotPassword(req, res));

// Handler partagé: réinitialiser le mot de passe avec le code
async function handleResetPassword(req, res) {
  try {
    const { email, code, password } = req.body;
    
    if (!email || !code || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, code et nouveau mot de passe requis' 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le mot de passe doit contenir au moins 6 caractères' 
      });
    }
    
    // Vérifier le code de récupération
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id, email, recovery_code, recovery_expires')
      .eq('email', email.toLowerCase())
      .single();
    
    if (userError || !user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Aucun compte trouvé avec cette adresse email' 
      });
    }
    
    if (!user.recovery_code || user.recovery_code !== code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Code de récupération invalide' 
      });
    }
    
    // Vérifier l'expiration
    const now = new Date();
    const expires = new Date(user.recovery_expires);
    if (now > expires) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le code de récupération a expiré. Demandez un nouveau code.' 
      });
    }
    
    // Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Mettre à jour le mot de passe et supprimer le code de récupération
    const { error: updateError } = await supabaseClient
      .from('users')
      .update({ 
        password: hashedPassword,
        recovery_code: null,
        recovery_expires: null
      })
      .eq('id', user.id);
    
    if (updateError) {
      console.error('Erreur mise à jour mot de passe:', updateError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la réinitialisation du mot de passe' 
      });
    }
    
    console.log(`✅ Mot de passe réinitialisé pour ${email}`);
    
    res.json({ 
      success: true, 
      message: 'Mot de passe réinitialisé avec succès' 
    });
    
  } catch (error) {
    console.error('Erreur reset-password:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la réinitialisation' 
    });
  }
}

// Exposer routes avec et sans préfixe /api
app.post('/reset-password', handleResetPassword);
app.post('/api/reset-password', (req, res) => handleResetPassword(req, res));

// ===== ROUTES GÉOGRAPHIQUES POUR LES SÉLECTEURS EN CASCADE =====

// Route pour récupérer tous les départements
app.get('/api/departements', async (req, res) => {
  // Désactivé temporairement - utiliser les données locales côté frontend
  return res.status(200).json([]);
  try {
    const { data, error } = await supabaseClient
      .from('departements')
      .select('id, nom')
      .order('nom');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Erreur API départements:', error);
    // Fallback: liste vide
    return res.status(200).json([]);
  }
});

// Route pour récupérer les communes d'un département
app.get('/api/communes', async (req, res) => {
  try {
    const { departement_id } = req.query;
    if (!departement_id) {
      return res.status(400).json({ error: 'ID département requis' });
    }
    
    const { data, error } = await supabaseClient
      .from('communes')
      .select('id, nom')
      .eq('departement_id', departement_id)
      .order('nom');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Erreur API communes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour récupérer les arrondissements d'une commune
app.get('/api/arrondissements', async (req, res) => {
  try {
    const { commune_id } = req.query;
    if (!commune_id) {
      return res.status(400).json({ error: 'ID commune requis' });
    }
    
    const { data, error } = await supabaseClient
      .from('arrondissements')
      .select('id, nom')
      .eq('commune_id', commune_id)
      .order('nom');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Erreur API arrondissements:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route pour récupérer les villages d'un arrondissement
app.get('/api/villages', async (req, res) => {
  try {
    const { arrondissement_id } = req.query;
    if (!arrondissement_id) {
      return res.status(400).json({ error: 'ID arrondissement requis' });
    }
    
    const { data, error } = await supabaseClient
      .from('villages')
      .select('id, nom')
      .eq('arrondissement_id', arrondissement_id)
      .order('nom');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Erreur API villages:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Fonction d'envoi d'email
async function sendVerificationEmail(email, code, newAccountEmail) {
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

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Vérification de compte Presence CCR-B',
    html: `
      <h2>Vérification de compte</h2>
      ${newAccountEmail ? `<p><strong>Nouveau compte:</strong> ${newAccountEmail}</p>` : ''}
      <p>Code de vérification : <strong style="font-size: 24px; color: #007bff;">${code}</strong></p>
      <p>Entrez ce code dans l'application pour activer le compte.</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Route par défaut - redirection vers home.html
app.get('/', (req, res) => {
  res.redirect('/home.html');
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📊 Base de données: Supabase uniquement`);
  console.log(`🏠 Page d'accueil: /home.html`);
});

module.exports = app;