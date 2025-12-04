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
} catch { }
const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { buildAgentMonthlyReport } = require('./utils/monthlyReport');

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
  ? supabaseUrlRaw.trim().replace(/\/+$/, '')
  : '';
const supabaseKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseKey = typeof supabaseKeyRaw === 'string' ? supabaseKeyRaw.trim() : '';

let supabaseClient = null;
// Configuration Supabase avec timeout et retry
const supabaseConfig = {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'Connection': 'keep-alive'
    }
  }
};

try {
  supabaseClient = createClient(supabaseUrl, supabaseKey, supabaseConfig);
  console.log('🔗 Supabase activé (mode exclusif)');
} catch (e) {
  console.error('❌ Supabase requis:', e?.message);
  process.exit(1);
}

// Wrapper pour les requêtes Supabase avec retry et timeout
async function safeSupabaseQuery(queryFn, maxRetries = 3, timeoutMs = 10000) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Ajouter un timeout à la requête
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout Supabase')), timeoutMs);
      });

      const queryPromise = queryFn();
      const result = await Promise.race([queryPromise, timeoutPromise]);

      // Si c'est la dernière tentative et qu'il y a une erreur, la logger
      if (result.error && attempt === maxRetries) {
        console.error(`❌ Erreur Supabase après ${maxRetries} tentatives:`, result.error);
      }

      return result;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Tentative ${attempt}/${maxRetries} échouée:`, error.message);

      // Attendre avant de réessayer (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
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

// Fonction utilitaire pour convertir des degrés en radians
function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Fonction utilitaire pour calculer la distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;

  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = toRad(lat1); // φ, λ en radians
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function getUserDisplayName(user = {}) {
  if (!user) return 'Agent';
  if (user.name && user.name.trim()) return user.name.trim();
  const fragments = [user.first_name, user.last_name].filter(Boolean).map(part => String(part).trim());
  if (fragments.length > 0) return fragments.join(' ');
  if (user.email) return user.email.split('@')[0];
  if (user.id) return `Agent ${user.id}`;
  return 'Agent';
}

function computeDurationHours(start, end) {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / 3600000) * 100) / 100;
}

function clampDays(value, { fallback = 30, min = 7, max = 120 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function isMissingTable(error) {
  if (!error) return false;
  // PostgreSQL error code for missing table
  if (error.code === '42P01') return true;
  // PostgREST error code for missing table
  if (error.code === 'PGRST205') return true;
  // PostgREST error code for missing relationship (table might exist but no FK)
  if (error.code === 'PGRST200') return true;
  if (typeof error.message === 'string') {
    return /relation .* does not exist/i.test(error.message) ||
      /Could not find the table/i.test(error.message) ||
      /table .* in the schema cache/i.test(error.message) ||
      /Could not find a relationship/i.test(error.message);
  }
  return false;
}

/**
 * Récupère l'UUID d'un utilisateur à partir de son ID numérique ou UUID
 * @param {string|number} id - ID numérique ou UUID de l'utilisateur
 * @returns {Promise<string|null>} UUID de l'utilisateur ou null si non trouvé
 */
async function getUserId(id) {
  console.log('🔍 getUserId called with ID:', { id, type: typeof id });

  if (!id) {
    const error = new Error('Aucun ID fourni à getUserId');
    console.error('❌', error.message);
    throw error;
  }

  const idStr = String(id).trim();
  if (!idStr) {
    const error = new Error('ID vide fourni à getUserId');
    console.error('❌', error.message);
    throw error;
  }

  try {
    console.log(`🔍 Vérification de l'existence de l'utilisateur avec l'ID: ${idStr}`);

    // Vérification UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idStr);
    if (isUuid) {
      console.log('🔍 ID est un UUID, vérification dans auth.users...');

      try {
        const { data: authUser, error: authError } = await supabaseClient.auth.admin.getUserById(idStr);
        if (authUser && !authError) {
          console.log('✅ UUID trouvé dans auth.users:', idStr);
          return idStr;
        }
      } catch (e) {
        console.error('❌ Erreur lors de la vérification dans auth.users:', e.message);
        // On continue même en cas d'erreur
      }

      console.log('⚠️ UUID non trouvé dans auth.users, recherche dans la table users...');

      // Recherche dans la table users par auth_uuid
      const { data: user, error: userError } = await supabaseClient
        .from('users')
        .select('id, auth_uuid, email')
        .eq('auth_uuid', idStr)
        .single();

      if (user && !userError) {
        console.log('✅ Utilisateur trouvé dans la table users avec cet auth_uuid:', {
          id: user.id,
          email: user.email
        });
        return user.id;
      }

      console.log('❌ Aucun utilisateur trouvé avec cet auth_uuid');
      throw new Error(`Aucun utilisateur trouvé avec l'UUID: ${idStr}`);
    }

    // Vérification ID numérique
    const isNumeric = /^\d+$/.test(idStr);
    if (isNumeric) {
      console.log('🔢 ID numérique détecté, recherche par ID...');
      const numericId = Number(idStr);

      // D'abord, essayer de trouver l'utilisateur directement par son ID
      const { data: user, error: userError } = await supabaseClient
        .from('users')
        .select('id, auth_uuid, email')
        .eq('id', numericId)
        .single();

      if (user && !userError) {
        console.log('✅ Utilisateur trouvé par ID numérique:', {
          id: numericId,
          email: user.email,
          hasAuthUuid: !!user.auth_uuid
        });

        // Si l'utilisateur a un auth_uuid, vérifier qu'il existe dans auth.users
        if (user.auth_uuid) {
          try {
            const { data: authUser } = await supabaseClient.auth.admin.getUserById(user.auth_uuid);
            if (authUser) {
              console.log('✅ UUID associé trouvé dans auth.users:', user.auth_uuid);
              return user.auth_uuid; // Retourner l'UUID pour la cohérence
            } else {
              console.log('⚠️ UUID non trouvé dans auth.users, utilisation de l\'ID numérique');
              return user.id;
            }
          } catch (e) {
            console.error('❌ Erreur lors de la vérification de l\'UUID dans auth.users:', e.message);
            // En cas d'erreur, on retourne quand même l'ID numérique
            return user.id;
          }
        }

        return user.id;
      }

      // Si on arrive ici, l'utilisateur n'a pas été trouvé par son ID
      console.log('❌ Aucun utilisateur trouvé avec cet ID numérique');
      throw new Error(`Aucun utilisateur trouvé avec l'ID: ${numericId}`);
    }

    // Si on arrive ici, l'ID n'est ni un UUID ni un nombre
    console.log('❌ Format d\'ID non reconnu:', idStr);
    throw new Error(`Format d'identifiant non valide: ${idStr}`);

  } catch (error) {
    console.error('❌ Erreur dans getUserId:', {
      id: idStr,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    // Propager l'erreur pour une gestion plus haut niveau
    throw error;
  }
}

function isoDateOnly(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function calculateRecentStreak(dateList = [], windowDays = 30) {
  if (!Array.isArray(dateList) || dateList.length === 0) return 0;
  const daySet = new Set(dateList.map(isoDateOnly).filter(Boolean));
  if (daySet.size === 0) return 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < windowDays; i++) {
    const cursor = new Date(today);
    cursor.setUTCDate(today.getUTCDate() - i);
    const key = cursor.toISOString().split('T')[0];
    if (daySet.has(key)) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function getStaticHelpSections() {
  return [
    {
      id: 'getting-started',
      title: 'Guide de démarrage',
      content: 'Découvrez comment vous connecter, enregistrer vos présences et envoyer vos premiers rapports.',
      category: 'start'
    },
    {
      id: 'planning',
      title: 'Planification des missions',
      content: 'Créez votre planification quotidienne, indiquez les objectifs et suivez vos activités terrain.',
      category: 'planning'
    },
    {
      id: 'reports',
      title: 'Rapports et preuves terrain',
      content: 'Générez des rapports détaillés, joignez des photos et partagez vos résultats avec votre superviseur.',
      category: 'reports'
    }
  ];
}

/**
 * Vérifie si l'utilisateur a les privilèges nécessaires
 * @param {object} req - Requête Express
 * @returns {boolean} true si l'utilisateur a les privilèges, false sinon
 */
function isPrivilegedRequest(req) {
  try {
    // Vérification complète de l'objet utilisateur
    if (!req || typeof req !== 'object' || !req.user) {
      console.log('⚠️ Aucun utilisateur dans la requête', {
        hasReq: !!req,
        reqType: typeof req,
        hasUser: req ? !!req.user : 'N/A'
      });
      return false;
    }

    // Vérification du rôle
    const userRole = req.user.role;
    if (userRole === undefined || userRole === null) {
      console.log('⚠️ Rôle utilisateur manquant', {
        userId: req.user.id,
        userEmail: req.user.email
      });
      return false;
    }

    const role = String(userRole).trim().toLowerCase();
    const privilegedRoles = new Set(['admin', 'superadmin', 'superviseur', 'supervisor']);
    const isPrivileged = privilegedRoles.has(role);

    console.log(`🔑 Vérification des privilèges - `, {
      userId: req.user.id,
      email: req.user.email,
      role: role,
      isPrivileged: isPrivileged
    });

    return isPrivileged;
  } catch (error) {
    console.error('❌ Erreur dans isPrivilegedRequest:', error);
    return false; // En cas d'erreur, on refuse l'accès par sécurité
  }
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function normalizeMonthValue(input) {
  if (!input) return null;
  if (typeof input === 'string' && /^\d{4}-\d{2}$/.test(input)) {
    return input;
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

function formatMonthKey(date) {
  if (!(date instanceof Date)) return '';
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

async function buildFallbackLocations() {
  try {
    const { data, error } = await supabaseClient
      .from('presences')
      .select('id, location_name, location_lat, location_lng, start_time')
      .order('start_time', { ascending: false })
      .limit(2000);

    if (error) throw error;

    const presences = Array.isArray(data) ? data : [];
    const map = new Map();

    presences.forEach(presence => {
      const lat = Number(presence.location_lat);
      const lon = Number(presence.location_lng);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
      const label = presence.location_name?.trim();
      const key = label ? label.toLowerCase() : (hasCoords ? `${lat.toFixed(3)}_${lon.toFixed(3)}` : null);
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: label || `Coordonnées ${lat.toFixed(3)}, ${lon.toFixed(3)}`,
          lat: hasCoords ? lat : null,
          lon: hasCoords ? lon : null,
          type: label ? 'named' : 'coordinate',
          usage: 0
        });
      }
      map.get(key).usage += 1;
    });

    return Array.from(map.values())
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 200)
      .map(({ usage, ...rest }) => rest);
  } catch (error) {
    console.warn('buildFallbackLocations error:', error.message);
    return [];
  }
}

// Route pour récupérer les validations
app.get('/api/reports/validations', authenticateToken, async (req, res) => {
  console.log('🔍 /api/reports/validations called with query:', req.query);

  try {
    console.log('🔍 Headers:', req.headers);
    console.log('🔍 User from token:', req.user);

    const { from, to, agent_id, supervisor_id } = req.query;

    // Log the request details for debugging
    console.log('📝 Request details:', {
      from,
      to,
      agent_id,
      supervisor_id,
      user: req.user
    });

    // Vérifier que Supabase est correctement initialisé
    if (!supabaseClient) {
      console.error('❌ Erreur: Supabase n\'est pas initialisé');
      return res.status(500).json({
        success: false,
        error: 'Erreur de configuration du serveur',
        details: 'Supabase non initialisé'
      });
    }

    try {
      // Construire la requête de base
      let query = supabaseClient
        .from('checkin_validations')
        .select(`
          id,
          checkin_id,
          agent_id,
          valid,
          distance_m,
          reference_lat,
          reference_lon,
          tolerance_m,
          created_at,
          checkins!inner(
            id,
            mission_id,
            user_id,
            lat,
            lon,
            start_time,
            end_time,
            note,
            photo_url
          ),
          users!inner(
            id,
            first_name,
            last_name,
            project_name,
            departement,
            commune,
            arrondissement,
            village,
            tolerance_radius_meters,
            reference_lat,
            reference_lon
          )
        `)
        .order('start_time', { ascending: false, referencedTable: 'checkins' });

      console.log('🔍 Requête Supabase construite');

      // Format date helper function
      const formatDateForQuery = (dateStr, isEndOfDay = false) => {
        try {
          // Handle different date string formats
          let date = new Date(dateStr);

          // If the date string is in format 'YYYY-MM-DD', parse it manually
          if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
            date = new Date(Date.UTC(year, month - 1, day));
          }

          if (isNaN(date.getTime())) {
            console.warn(`⚠️ Format de date invalide: ${dateStr}`);
            return null;
          }

          if (isEndOfDay) {
            date.setUTCHours(23, 59, 59, 999);
          } else {
            date.setUTCHours(0, 0, 0, 0);
          }

          // Return ISO string without timezone (PostgreSQL will interpret as UTC)
          return date.toISOString().replace('Z', '+00:00');
        } catch (e) {
          console.warn(`⚠️ Erreur de formatage de date (${dateStr}):`, e.message);
          return null;
        }
      };

      // Appliquer les filtres
      if (from) {
        const fromDateStr = formatDateForQuery(from);
        if (fromDateStr) {
          console.log(`📅 Filtre from: ${fromDateStr}`);
          query = query.gte('checkins.start_time', fromDateStr);
        }
      }

      if (to) {
        const toDateStr = formatDateForQuery(to, true); // true = end of day
        if (toDateStr) {
          console.log(`📅 Filtre to: ${toDateStr}`);
          query = query.lte('checkins.start_time', toDateStr);
        }
      }

      if (agent_id) {
        console.log(`👤 Filtre agent_id: ${agent_id}`);
        query = query.eq('agent_id', agent_id);
      }

      // Si un superviseur est spécifié, filtrer les agents supervisés
      if (supervisor_id) {
        console.log(`👨‍💼 Filtre supervisor_id: ${supervisor_id}`);
        // D'abord, récupérer la liste des agents supervisés
        const { data: supervisedAgents, error: supervisedError } = await supabaseClient
          .from('users')
          .select('id')
          .eq('supervisor_id', supervisor_id);

        if (supervisedError) throw supervisedError;

        const agentIds = supervisedAgents.map(a => a.id);
        if (agentIds.length > 0) {
          query = query.in('agent_id', agentIds);
        } else {
          // Aucun agent trouvé pour ce superviseur, retourner un tableau vide
          console.log('ℹ️ Aucun agent trouvé pour ce superviseur');
          return res.json([]);
        }
      }

      console.log('⚡ Exécution de la requête Supabase...');
      const { data, error } = await query;

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        throw error;
      }

      console.log(`✅ ${data ? data.length : 0} enregistrements trouvés`);

      // Formater la réponse
      const formattedData = data.map(item => {
        const distance = item.distance_m !== null
          ? item.distance_m
          : calculateDistance(
            item.users.reference_lat,
            item.users.reference_lon,
            item.checkins.lat,
            item.checkins.lon
          );

        const isWithinTolerance = distance <= (item.tolerance_m || item.users.tolerance_radius_meters || 0);

        return {
          id: item.id,
          user_id: item.agent_id,
          agent: `${item.users.first_name || ''} ${item.users.last_name || ''}`.trim() || `Utilisateur #${item.agent_id}`,
          projet: item.users.project_name || 'Non spécifié',
          localisation: [
            item.users.departement,
            item.users.commune,
            item.users.arrondissement,
            item.users.village
          ].filter(Boolean).join(' / ') || 'Non spécifiée',
          rayon_m: item.tolerance_m || item.users.tolerance_radius_meters || 0,
          ref_lat: item.reference_lat || item.users.reference_lat,
          ref_lon: item.reference_lon || item.users.reference_lon,
          lat: item.checkins.lat,
          lon: item.checkins.lon,
          ts: item.checkins.start_time,
          distance_m: distance,
          statut: item.valid !== null
            ? (item.valid ? 'Présent' : 'Hors zone')
            : (isWithinTolerance ? 'Présent' : 'Hors zone'),
          note: item.checkins.note,
          photo_url: item.checkins.photo_url,
          mission_duration: item.checkins.end_time
            ? (new Date(item.checkins.end_time) - new Date(item.checkins.start_time)) / 60000
            : null
        };
      }).filter(Boolean); // Filtrer les entrées nulles en cas d'erreur

      console.log(`📊 ${formattedData.length} entrées valides après traitement`);
      res.json(formattedData);

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des validations:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des données',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } catch (outerError) {
    console.error('❌ Erreur globale du gestionnaire de route:', outerError);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? outerError.message : undefined
    });
  }
});

// Route pour marquer un agent comme absent
app.post('/api/presence/mark-absent', authenticateToken, async (req, res) => {
  try {
    const { email } = req.query;
    const requester = req.user;

    console.log('🚫 /api/presence/mark-absent called', { email, requester: requester.email });

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email requis' });
    }

    // Vérifier les permissions (admin ou superviseur)
    const isPrivileged = ['admin', 'superviseur', 'supervisor'].includes(requester.role);
    if (!isPrivileged) {
      return res.status(403).json({ success: false, error: 'Non autorisé' });
    }

    // Trouver l'utilisateur cible
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    // Vérifier s'il y a déjà une présence aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const { data: existing, error: checkError } = await supabaseClient
      .from('checkins')
      .select('id')
      .eq('user_id', user.id)
      .gte('timestamp', `${today}T00:00:00`)
      .lte('timestamp', `${today}T23:59:59`);

    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Présence déjà enregistrée pour ce jour' });
    }

    // Créer une entrée d'absence (checkin avec statut spécial ou note)
    // Note: On utilise une note spécifique pour marquer l'absence
    const { error: insertError } = await supabaseClient
      .from('checkins')
      .insert({
        user_id: user.id,
        timestamp: new Date().toISOString(),
        checkin_time: new Date().toISOString(),
        lat: 0,
        lon: 0,
        note: 'ABSENT - Marqué par administrateur',
        is_valide: false,
        validation_status: 'rejected'
      });

    if (insertError) {
      throw insertError;
    }

    res.json({ success: true, message: 'Absence enregistrée' });

  } catch (error) {
    console.error('❌ Erreur mark-absent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route pour récupérer les planifications
app.get('/api/planifications', authenticateToken, async (req, res) => {
  try {
    const { from, to, agent_id, project_name } = req.query;
    console.log('📅 /api/planifications called', { from, to, agent_id, project_name });

    let query = supabaseClient
      .from('planifications')
      .select('*');

    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    if (agent_id) query = query.eq('user_id', agent_id);
    if (project_name) query = query.eq('project_name', project_name);

    const { data, error } = await query;

    if (error) {
      console.error('❌ Erreur Supabase planifications:', error);
      throw error;
    }

    res.json(data || []);
  } catch (error) {
    console.error('❌ Erreur /api/planifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fonction utilitaire pour récupérer toutes les pages d'une requête Supabase
// Supabase limite par défaut à 1000 résultats, cette fonction parcourt toutes les pages
async function fetchAllPages(queryBuilder, pageSize = 1000) {
  const allData = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await queryBuilder.range(from, to);

    if (error) {
      console.error(`❌ Erreur lors de la récupération de la page ${page}:`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allData.push(...data);
      // Si on a récupéré moins que pageSize, c'est la dernière page
      hasMore = data.length === pageSize;
      page++;
      console.log(`📄 Page ${page} récupérée: ${data.length} enregistrements (total: ${allData.length})`);
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Total récupéré: ${allData.length} enregistrements sur ${page} page(s)`);
  return allData;
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
const cors = require('cors');
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Middleware de suivi de présence
app.use(async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const user = jwt.verify(token, JWT_SECRET);
      if (user && user.id) {
        const now = new Date().toISOString();
        // Mise à jour ou création de l'entrée de présence
        const { error } = await supabaseClient
          .from('user_presence')
          .upsert(
            {
              user_id: user.id,
              last_seen: now,
              status: 'online'
            },
            { onConflict: 'user_id' }
          );

        if (error) {
          console.error('Erreur de suivi de présence:', error);
        }
      }
    } catch (e) {
      // Le token est invalide ou expiré, on ne fait rien
      console.error('Erreur de vérification du token de présence:', e.message);
    }
  }
  next();
});

// Tâche planifiée pour marquer les utilisateurs inactifs comme hors ligne
setInterval(async () => {
  try {
    const inactiveTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes d'inactivité

    const { error } = await supabaseClient
      .from('user_presence')
      .update({ status: 'offline' })
      .lt('last_seen', inactiveTime)
      .eq('status', 'online');

    if (error) {
      console.error('Erreur lors de la mise à jour des utilisateurs inactifs:', error);
    }
  } catch (e) {
    console.error('Erreur dans la tâche planifiée de présence:', e);
  }
}, 60000); // Toutes les minutes

// Sécurité
if (process.env.NODE_ENV !== 'test') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", 'https://cdn.dhtmlx.com', "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://huggingface.co"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://maps.googleapis.com", "https://huggingface.co"],
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
          "https://*.supabase.co",
          // Autoriser les images de Hugging Face
          "https://huggingface.co",
          "https://*.huggingface.co"
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
          // Autoriser Hugging Face pour les connexions WebSocket/API
          "https://huggingface.co",
          "https://*.huggingface.co",
          "wss://*.huggingface.co",
          "data:",
          "blob:",
          "ws:",
          "wss:"
        ],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://huggingface.co"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'", "https://huggingface.co", "https://*.huggingface.co"],
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

// API endpoint pour les administrateurs - gestion des agents - SUPPRIMÉ (utilise l'endpoint plus complet ci-dessous)

// API endpoint pour les utilisateurs (agents) - Supprimé car doublon avec l'endpoint plus complet plus bas

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
    } catch { }

    // Check-ins today (UTC day)
    let checkinsToday = 0;
    try {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date();
      end.setUTCHours(23, 59, 59, 999);
      const { count: cCount, error: cErr } = await supabaseClient
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString());
      if (cErr) throw cErr;
      checkinsToday = cCount || 0;
    } catch { }

    res.json({
      success: true, data: {
        totalUsers: totalUsers || 0,
        activeAgents: activeAgents || 0,
        activeMissions,
        checkinsToday,
      }
    });
  } catch (error) {
    console.error('Erreur API admin/stats:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des statistiques' });
  }
});

// ===== ENDPOINTS POUR SAUVEGARDE/SUPPRESSION FILTRÉE =====

// Prévisualiser les données selon les filtres
app.post('/api/admin/filtered-data/preview', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { startDate, endDate, projects, agentIds, dataTypes } = req.body || {};
    
    const counts = {};
    
    // Construire les filtres de base
    let dateFilter = {};
    if (startDate) {
      dateFilter.gte = startDate;
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      dateFilter.lte = endDateTime.toISOString();
    }
    
    // Compter les checkins
    if (dataTypes.includes('checkins')) {
      let checkinsQuery = supabaseClient
        .from('checkins')
        .select('id', { count: 'exact', head: true });
      
      if (startDate || endDate) {
        if (startDate) checkinsQuery = checkinsQuery.gte('start_time', startDate);
        if (endDate) {
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          checkinsQuery = checkinsQuery.lte('start_time', endDateTime.toISOString());
        }
      }
      
      if (agentIds && agentIds.length > 0) {
        checkinsQuery = checkinsQuery.in('user_id', agentIds);
      }
      
      const { count, error } = await checkinsQuery;
      if (!error) counts.checkins = count || 0;
    }
    
    // Compter les missions
    if (dataTypes.includes('missions')) {
      let missionsQuery = supabaseClient
        .from('missions')
        .select('id', { count: 'exact', head: true });
      
      if (startDate || endDate) {
        if (startDate) missionsQuery = missionsQuery.gte('start_time', startDate);
        if (endDate) {
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          missionsQuery = missionsQuery.lte('start_time', endDateTime.toISOString());
        }
      }
      
      if (agentIds && agentIds.length > 0) {
        missionsQuery = missionsQuery.in('agent_id', agentIds);
      }
      
      const { count, error } = await missionsQuery;
      if (!error) counts.missions = count || 0;
    }
    
    // Compter les presences
    if (dataTypes.includes('presences')) {
      let presencesQuery = supabaseClient
        .from('presences')
        .select('id', { count: 'exact', head: true });
      
      if (startDate || endDate) {
        if (startDate) presencesQuery = presencesQuery.gte('start_time', startDate);
        if (endDate) {
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          presencesQuery = presencesQuery.lte('start_time', endDateTime.toISOString());
        }
      }
      
      if (agentIds && agentIds.length > 0) {
        presencesQuery = presencesQuery.in('user_id', agentIds);
      }
      
      const { count, error } = await presencesQuery;
      if (!error) counts.presences = count || 0;
    }
    
    // Compter les permissions
    if (dataTypes.includes('permissions')) {
      let permissionsQuery = supabaseClient
        .from('permissions')
        .select('id', { count: 'exact', head: true });
      
      if (startDate || endDate) {
        if (startDate) permissionsQuery = permissionsQuery.gte('start_date', startDate);
        if (endDate) permissionsQuery = permissionsQuery.lte('end_date', endDate);
      }
      
      if (agentIds && agentIds.length > 0) {
        permissionsQuery = permissionsQuery.in('agent_id', agentIds);
      }
      
      const { count, error } = await permissionsQuery;
      if (!error) counts.permissions = count || 0;
    }
    
    // Filtrer par projet si nécessaire (nécessite une jointure avec users)
    if (projects && projects.length > 0) {
      // Pour les checkins et missions, filtrer via user_id/agent_id
      const { data: usersInProjects } = await supabaseClient
        .from('users')
        .select('id')
        .in('project_name', projects);
      
      const userIdsInProjects = (usersInProjects || []).map(u => u.id);
      
      if (userIdsInProjects.length > 0) {
        // Recompter avec filtrage par projet
        if (dataTypes.includes('checkins')) {
          let checkinsQuery = supabaseClient
            .from('checkins')
            .select('id', { count: 'exact', head: true })
            .in('user_id', userIdsInProjects);
          
          if (startDate) checkinsQuery = checkinsQuery.gte('start_time', startDate);
          if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            checkinsQuery = checkinsQuery.lte('start_time', endDateTime.toISOString());
          }
          
          if (agentIds && agentIds.length > 0) {
            checkinsQuery = checkinsQuery.in('user_id', agentIds.filter(id => userIdsInProjects.includes(id)));
          }
          
          const { count } = await checkinsQuery;
          counts.checkins = count || 0;
        }
        
        if (dataTypes.includes('missions')) {
          let missionsQuery = supabaseClient
            .from('missions')
            .select('id', { count: 'exact', head: true })
            .in('agent_id', userIdsInProjects);
          
          if (startDate) missionsQuery = missionsQuery.gte('start_time', startDate);
          if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            missionsQuery = missionsQuery.lte('start_time', endDateTime.toISOString());
          }
          
          if (agentIds && agentIds.length > 0) {
            missionsQuery = missionsQuery.in('agent_id', agentIds.filter(id => userIdsInProjects.includes(id)));
          }
          
          const { count } = await missionsQuery;
          counts.missions = count || 0;
        }
      } else {
        // Aucun utilisateur dans ces projets
        if (dataTypes.includes('checkins')) counts.checkins = 0;
        if (dataTypes.includes('missions')) counts.missions = 0;
      }
    }
    
    res.json({ success: true, counts });
  } catch (error) {
    console.error('Erreur prévisualisation données filtrées:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Exporter les données selon les filtres
app.post('/api/admin/filtered-data/export', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { startDate, endDate, projects, agentIds, dataTypes } = req.body || {};
    
    const exportData = {};
    
    // Construire les filtres de date
    const buildDateFilter = (field) => {
      let query = supabaseClient.from('checkins').select('*');
      if (startDate) query = query.gte(field, startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query = query.lte(field, endDateTime.toISOString());
      }
      return query;
    };
    
    // Récupérer les IDs d'utilisateurs si filtrage par projet
    let userIdsInProjects = null;
    if (projects && projects.length > 0) {
      const { data: usersInProjects } = await supabaseClient
        .from('users')
        .select('id')
        .in('project_name', projects);
      userIdsInProjects = (usersInProjects || []).map(u => u.id);
    }
    
    // Exporter checkins
    if (dataTypes.includes('checkins')) {
      let query = supabaseClient.from('checkins').select('*');
      if (startDate) query = query.gte('start_time', startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query = query.lte('start_time', endDateTime.toISOString());
      }
      if (agentIds && agentIds.length > 0) {
        query = query.in('user_id', agentIds);
      } else if (userIdsInProjects) {
        query = query.in('user_id', userIdsInProjects);
      }
      const { data, error } = await query;
      if (!error) exportData.checkins = data || [];
    }
    
    // Exporter missions
    if (dataTypes.includes('missions')) {
      let query = supabaseClient.from('missions').select('*');
      if (startDate) query = query.gte('start_time', startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query = query.lte('start_time', endDateTime.toISOString());
      }
      if (agentIds && agentIds.length > 0) {
        query = query.in('agent_id', agentIds);
      } else if (userIdsInProjects) {
        query = query.in('agent_id', userIdsInProjects);
      }
      const { data, error } = await query;
      if (!error) exportData.missions = data || [];
    }
    
    // Exporter presences
    if (dataTypes.includes('presences')) {
      let query = supabaseClient.from('presences').select('*');
      if (startDate) query = query.gte('start_time', startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query = query.lte('start_time', endDateTime.toISOString());
      }
      if (agentIds && agentIds.length > 0) {
        query = query.in('user_id', agentIds);
      } else if (userIdsInProjects) {
        query = query.in('user_id', userIdsInProjects);
      }
      const { data, error } = await query;
      if (!error) exportData.presences = data || [];
    }
    
    // Exporter permissions
    if (dataTypes.includes('permissions')) {
      let query = supabaseClient.from('permissions').select('*');
      if (startDate) query = query.gte('start_date', startDate);
      if (endDate) query = query.lte('end_date', endDate);
      if (agentIds && agentIds.length > 0) {
        query = query.in('agent_id', agentIds);
      } else if (userIdsInProjects) {
        query = query.in('agent_id', userIdsInProjects);
      }
      const { data, error } = await query;
      if (!error) exportData.permissions = data || [];
    }
    
    // Ajouter les métadonnées d'export
    exportData.metadata = {
      exportDate: new Date().toISOString(),
      filters: { startDate, endDate, projects, agentIds, dataTypes },
      counts: {}
    };
    
    Object.keys(exportData).forEach(key => {
      if (key !== 'metadata' && Array.isArray(exportData[key])) {
        exportData.metadata.counts[key] = exportData[key].length;
      }
    });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="export_donnees_${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Erreur export données filtrées:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Supprimer les données selon les filtres
app.post('/api/admin/filtered-data/delete', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { startDate, endDate, projects, agentIds, dataTypes } = req.body || {};
    
    const deleted = {};
    
    // Récupérer les IDs d'utilisateurs si filtrage par projet
    let userIdsInProjects = null;
    if (projects && projects.length > 0) {
      const { data: usersInProjects } = await supabaseClient
        .from('users')
        .select('id')
        .in('project_name', projects);
      userIdsInProjects = (usersInProjects || []).map(u => u.id);
    }
    
    // Supprimer checkins
    if (dataTypes.includes('checkins')) {
      // Compter d'abord
      let countQuery = supabaseClient.from('checkins').select('id', { count: 'exact', head: true });
      if (startDate) countQuery = countQuery.gte('start_time', startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        countQuery = countQuery.lte('start_time', endDateTime.toISOString());
      }
      if (agentIds && agentIds.length > 0) {
        countQuery = countQuery.in('user_id', agentIds);
      } else if (userIdsInProjects) {
        countQuery = countQuery.in('user_id', userIdsInProjects);
      }
      const { count: countBefore } = await countQuery;
      
      // Puis supprimer
      let deleteQuery = supabaseClient.from('checkins').delete();
      if (startDate) deleteQuery = deleteQuery.gte('start_time', startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        deleteQuery = deleteQuery.lte('start_time', endDateTime.toISOString());
      }
      if (agentIds && agentIds.length > 0) {
        deleteQuery = deleteQuery.in('user_id', agentIds);
      } else if (userIdsInProjects) {
        deleteQuery = deleteQuery.in('user_id', userIdsInProjects);
      }
      const { error } = await deleteQuery;
      if (!error) deleted.checkins = countBefore || 0;
    }
    
    // Supprimer missions
    if (dataTypes.includes('missions')) {
      // Compter d'abord
      let countQuery = supabaseClient.from('missions').select('id', { count: 'exact', head: true });
      if (startDate) countQuery = countQuery.gte('start_time', startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        countQuery = countQuery.lte('start_time', endDateTime.toISOString());
      }
      if (agentIds && agentIds.length > 0) {
        countQuery = countQuery.in('agent_id', agentIds);
      } else if (userIdsInProjects) {
        countQuery = countQuery.in('agent_id', userIdsInProjects);
      }
      const { count: countBefore } = await countQuery;
      
      // Puis supprimer
      let deleteQuery = supabaseClient.from('missions').delete();
      if (startDate) deleteQuery = deleteQuery.gte('start_time', startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        deleteQuery = deleteQuery.lte('start_time', endDateTime.toISOString());
      }
      if (agentIds && agentIds.length > 0) {
        deleteQuery = deleteQuery.in('agent_id', agentIds);
      } else if (userIdsInProjects) {
        deleteQuery = deleteQuery.in('agent_id', userIdsInProjects);
      }
      const { error } = await deleteQuery;
      if (!error) deleted.missions = countBefore || 0;
    }
    
    // Supprimer presences
    if (dataTypes.includes('presences')) {
      // Compter d'abord
      let countQuery = supabaseClient.from('presences').select('id', { count: 'exact', head: true });
      if (startDate) countQuery = countQuery.gte('start_time', startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        countQuery = countQuery.lte('start_time', endDateTime.toISOString());
      }
      if (agentIds && agentIds.length > 0) {
        countQuery = countQuery.in('user_id', agentIds);
      } else if (userIdsInProjects) {
        countQuery = countQuery.in('user_id', userIdsInProjects);
      }
      const { count: countBefore } = await countQuery;
      
      // Puis supprimer
      let deleteQuery = supabaseClient.from('presences').delete();
      if (startDate) deleteQuery = deleteQuery.gte('start_time', startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        deleteQuery = deleteQuery.lte('start_time', endDateTime.toISOString());
      }
      if (agentIds && agentIds.length > 0) {
        deleteQuery = deleteQuery.in('user_id', agentIds);
      } else if (userIdsInProjects) {
        deleteQuery = deleteQuery.in('user_id', userIdsInProjects);
      }
      const { error } = await deleteQuery;
      if (!error) deleted.presences = countBefore || 0;
    }
    
    // Supprimer permissions
    if (dataTypes.includes('permissions')) {
      // Compter d'abord
      let countQuery = supabaseClient.from('permissions').select('id', { count: 'exact', head: true });
      if (startDate) countQuery = countQuery.gte('start_date', startDate);
      if (endDate) countQuery = countQuery.lte('end_date', endDate);
      if (agentIds && agentIds.length > 0) {
        countQuery = countQuery.in('agent_id', agentIds);
      } else if (userIdsInProjects) {
        countQuery = countQuery.in('agent_id', userIdsInProjects);
      }
      const { count: countBefore } = await countQuery;
      
      // Puis supprimer
      let deleteQuery = supabaseClient.from('permissions').delete();
      if (startDate) deleteQuery = deleteQuery.gte('start_date', startDate);
      if (endDate) deleteQuery = deleteQuery.lte('end_date', endDate);
      if (agentIds && agentIds.length > 0) {
        deleteQuery = deleteQuery.in('agent_id', agentIds);
      } else if (userIdsInProjects) {
        deleteQuery = deleteQuery.in('agent_id', userIdsInProjects);
      }
      const { error } = await deleteQuery;
      if (!error) deleted.permissions = countBefore || 0;
    }
    
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('Erreur suppression données filtrées:', error);
    res.status(500).json({ success: false, error: error.message });
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
        .gte('date', fromISO.slice(0, 10))
        .lte('date', toISO.slice(0, 10));
      if (pErr) { /* silencieux si table absente */ }
      else plans = planRows || [];
    } catch { }

    const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
    const todayKey = new Date().toISOString().slice(0, 10);

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
    //    Exception: ne pas marquer les dimanches (jour de repos)
    for (const p of plans) {
      const k = String(p.date);
      if (!result[k] && k < todayKey) {
        const d = new Date(k);
        const dayOfWeek = d.getDay(); // 0 = dimanche
        const isSunday = dayOfWeek === 0;
        if (isSunday) continue;
        result[k] = { status: 'absent', color: 'red', tooltip: 'Planifié, non pointé' };
      }
    }

    return res.json({ success: true, days: result });
  } catch (error) {
    console.error('Erreur API attendance/day-status:', error);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// API endpoint pour les rapports de présence - utilise la logique qui fonctionne
app.get('/api/reports', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    console.log('🔍 API /api/reports appelée');

    // Fonction pour normaliser les dates au format YYYY-MM-DD
    const normalizeDate = (dateString) => {
      if (!dateString) return dateString;

      // Si la date est déjà au format YYYY-MM-DD, la retourner telle quelle
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
      }

      // Si la date est au format ISO complet, extraire YYYY-MM-DD
      if (dateString.includes('T')) {
        return dateString.split('T')[0];
      }

      // Sinon, essayer de parser et formater
      try {
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
      } catch (e) {
        return dateString; // En cas d'erreur, retourner l'original
      }
    };

    // Extraire les paramètres de requête
    const { from, to, page, limit, agent_id } = req.query;

    // Normaliser les dates
    const normalizedFrom = normalizeDate(from);
    const normalizedTo = normalizeDate(to);

    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 2000;
    const offset = (currentPage - 1) * pageLimit;

    console.log('📋 Paramètres de requête:', {
      from: normalizedFrom,
      to: normalizedTo,
      page,
      limit,
      agent_id
    });

    // 1. Récupérer les validations avec leurs checkins
    console.log('📊 Récupération des validations...');

    // Construire la requête de base avec filtres
    let baseQuery = supabaseClient
      .from('checkin_validations')
      .select('*', { count: 'exact', head: true });

    // Appliquer les filtres de date sur created_at (approximation)
    // Note: Le filtrage exact par timestamp du checkin sera fait après
    if (normalizedFrom) {
      baseQuery = baseQuery.gte('created_at', new Date(normalizedFrom + 'T00:00:00.000Z').toISOString());
    }
    if (normalizedTo) {
      baseQuery = baseQuery.lte('created_at', new Date(normalizedTo + 'T23:59:59.999Z').toISOString());
    }

    // Filtrer par agent_id si fourni
    if (agent_id) {
      baseQuery = baseQuery.eq('agent_id', agent_id);
    }

    // Compter le total avant la pagination
    const { count, error: countError } = await baseQuery;

    if (countError) {
      console.error('❌ Erreur lors du comptage:', countError);
      throw countError;
    }

    const totalCount = count || 0;
    console.log('📊 Total de validations:', totalCount);

    // Si aucune validation trouvée, essayer les tables checkins et presences
    if (totalCount === 0) {
      console.log('⚠️ Aucune validation dans checkin_validations, recherche dans checkins/presences...');

      try {
        // Essayer la table presences d'abord
        let presencesQuery = supabaseClient
          .from('presences')
          .select('*', { count: 'exact', head: true });

        if (normalizedFrom) {
          presencesQuery = presencesQuery.gte('created_at', new Date(normalizedFrom + 'T00:00:00.000Z').toISOString());
        }
        if (normalizedTo) {
          presencesQuery = presencesQuery.lte('created_at', new Date(normalizedTo + 'T23:59:59.999Z').toISOString());
        }
        if (agent_id) {
          presencesQuery = presencesQuery.eq('user_id', agent_id);
        }

        const { count: presencesCount, error: presencesCountError } = await presencesQuery;

        if (!presencesCountError && presencesCount > 0) {
          console.log(`📊 ${presencesCount} presences trouvées, utilisation de cette table...`);

          // Récupérer les données des presences
          let presencesDataQuery = supabaseClient
            .from('presences')
            .select(`
              id,
              user_id,
              start_time,
              end_time,
              location_lat,
              location_lng,
              location_name,
              notes,
              photo_url,
              created_at,
              users!left(
                id,
                name,
                email,
                phone,
                role,
                project_name,
                supervisor_id,
                reference_lat,
                reference_lon,
                tolerance_radius_meters
              )
            `);

          if (normalizedFrom) {
            presencesDataQuery = presencesDataQuery.gte('created_at', new Date(normalizedFrom + 'T00:00:00.000Z').toISOString());
          }
          if (normalizedTo) {
            presencesDataQuery = presencesDataQuery.lte('created_at', new Date(normalizedTo + 'T23:59:59.999Z').toISOString());
          }
          if (agent_id) {
            presencesDataQuery = presencesDataQuery.eq('user_id', agent_id);
          }

          const { data: presencesData, error: presencesDataError } = await presencesDataQuery;

          console.log('🔍 Debug presences:');
          console.log('  - Error:', presencesDataError);
          console.log('  - Data length:', presencesData?.length || 0);
          console.log('  - Data sample:', presencesData?.[0] ? 'ID: ' + presencesData[0].id + ', User: ' + presencesData[0].user_id : 'None');

          if (!presencesDataError && presencesData && presencesData.length > 0) {
            console.log(`📊 ${presencesData.length} presences récupérées`);

            // Transformer les données de presences en format de rapports
            const reports = presencesData.map(presence => {
              const user = presence.users || {};
              return {
                id: presence.id,
                agent_id: presence.user_id,
                agent: user.name || 'Agent inconnu',
                role: user.role || 'agent',
                projet: user.project_name || 'Non spécifié',
                localisation: presence.location_name || 'Non spécifiée',
                date: new Date(presence.start_time || presence.created_at).toLocaleDateString('fr-FR'),
                heure_arrivee: presence.start_time ? new Date(presence.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
                heure_depart: presence.end_time ? new Date(presence.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
                mission_duration: presence.start_time && presence.end_time ?
                  Math.round((new Date(presence.end_time) - new Date(presence.start_time)) / 60000) : null,
                status_presence: 'Présent',
                distance_m: presence.location_lat && presence.location_lng && user.reference_lat && user.reference_lon ?
                  calculateDistance(presence.location_lat, presence.location_lng, user.reference_lat, user.reference_lon) : null,
                tolerance_m: user.tolerance_radius_meters || 500,
                note: presence.notes || '',
                photo_url: presence.photo_url,
                validation_id: presence.id,
                checkin_id: presence.id,
                created_at: presence.created_at,
                lat: presence.location_lat,
                lon: presence.location_lng,
                ref_lat: user.reference_lat,
                ref_lon: user.reference_lon,
                user: user
              };
            });

            console.log(`📊 ${reports.length} rapports générés depuis presences`);

            // Pagination
            const startIndex = (page - 1) * limit;
            const paginatedReports = reports.slice(startIndex, startIndex + limit);

            return res.json({
              success: true,
              data: paginatedReports,
              pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: reports.length,
                totalPages: Math.ceil(reports.length / limit)
              }
            });
          }
        }

        // Si pas de presences, essayer checkins
        console.log('⚠️ Pas de presences, recherche dans checkins...');

        let checkinsQuery = supabaseClient
          .from('checkins')
          .select('*', { count: 'exact', head: true });

        if (normalizedFrom) {
          checkinsQuery = checkinsQuery.gte('created_at', new Date(normalizedFrom + 'T00:00:00.000Z').toISOString());
        }
        if (normalizedTo) {
          checkinsQuery = checkinsQuery.lte('created_at', new Date(normalizedTo + 'T23:59:59.999Z').toISOString());
        }
        if (agent_id) {
          checkinsQuery = checkinsQuery.eq('user_id', agent_id);
        }

        const { count: checkinsCount, error: checkinsCountError } = await checkinsQuery;

        if (!checkinsCountError && checkinsCount > 0) {
          console.log(`📊 ${checkinsCount} checkins trouvés, utilisation de cette table...`);

          // Récupérer les données des checkins
          let checkinsDataQuery = supabaseClient
            .from('checkins')
            .select(`
              id,
              user_id,
              lat,
              lng,
              timestamp,
              photo_url,
              mission_id,
              created_at,
              users!left(
                id,
                full_name,
                email,
                phone,
                role,
                project_name,
                supervisor_id,
                reference_lat,
                reference_lon,
                tolerance_radius_meters
              )
            `);

          if (normalizedFrom) {
            checkinsDataQuery = checkinsDataQuery.gte('created_at', new Date(normalizedFrom + 'T00:00:00.000Z').toISOString());
          }
          if (normalizedTo) {
            checkinsDataQuery = checkinsDataQuery.lte('created_at', new Date(normalizedTo + 'T23:59:59.999Z').toISOString());
          }
          if (agent_id) {
            checkinsDataQuery = checkinsDataQuery.eq('user_id', agent_id);
          }

          const { data: checkinsData, error: checkinsDataError } = await checkinsDataQuery;

          if (!checkinsDataError && checkinsData.length > 0) {
            console.log(`📊 ${checkinsData.length} checkins récupérés`);

            // Transformer les données de checkins en format de rapports
            const reports = checkinsData.map(checkin => {
              const user = checkin.users || {};
              return {
                id: checkin.id,
                agent_id: checkin.user_id,
                agent: user.full_name || 'Agent inconnu',
                role: user.role || 'agent',
                projet: user.project_name || 'Non spécifié',
                localisation: 'Non spécifiée',
                date: new Date(checkin.timestamp || checkin.created_at).toLocaleDateString('fr-FR'),
                heure_arrivee: checkin.timestamp ? new Date(checkin.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
                heure_depart: 'N/A',
                mission_duration: null,
                status_presence: 'Présent',
                distance_m: checkin.lat && checkin.lng && user.reference_lat && user.reference_lon ?
                  calculateDistance(checkin.lat, checkin.lng, user.reference_lat, user.reference_lon) : null,
                tolerance_m: user.tolerance_radius_meters || 500,
                note: '',
                photo_url: checkin.photo_url,
                validation_id: checkin.id,
                checkin_id: checkin.id,
                created_at: checkin.created_at,
                lat: checkin.lat,
                lon: checkin.lng,
                ref_lat: user.reference_lat,
                ref_lon: user.reference_lon,
                user: user
              };
            });

            console.log(`📊 ${reports.length} rapports générés depuis checkins`);

            // Pagination
            const startIndex = (page - 1) * limit;
            const paginatedReports = reports.slice(startIndex, startIndex + limit);

            return res.json({
              success: true,
              data: paginatedReports,
              pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: reports.length,
                totalPages: Math.ceil(reports.length / limit)
              }
            });
          }
        }

        console.log('❌ Aucune donnée trouvée dans checkins ou presences');

      } catch (fallbackError) {
        console.error('❌ Erreur dans le fallback checkins/presences:', fallbackError);
      }
    }

    // Construire la requête de données avec les mêmes filtres
    let dataQuery = supabaseClient
      .from('checkin_validations')
      .select(`
        id,
        checkin_id,
        agent_id,
        valid,
        distance_m,
        tolerance_m,
        reference_lat,
        reference_lon,
        created_at,
        checkins!left(
          id,
          mission_id,
          user_id,
          lat,
          lon,
          start_time,
          note,
          photo_url
        )
      `);

    // Appliquer les mêmes filtres
    if (normalizedFrom) {
      dataQuery = dataQuery.gte('created_at', new Date(normalizedFrom + 'T00:00:00.000Z').toISOString());
    }
    if (normalizedTo) {
      dataQuery = dataQuery.lte('created_at', new Date(normalizedTo + 'T23:59:59.999Z').toISOString());
    }
    if (agent_id) {
      dataQuery = dataQuery.eq('agent_id', agent_id);
    }


    // Filtrer les agents selon le rôle de l'utilisateur connecté
    let filteredAgentIds = agentIds;
    if (req.user.role === 'superviseur') {
      // Pour les superviseurs, récupérer seulement les agents sous leur supervision
      const { data: supervisedAgents, error: supervisedError } = await supabaseClient
        .from('users')
        .select('id')
        .eq('supervisor_id', req.user.id)
      // Pour les admins, filtrer pour ne garder que les agents et superviseurs (rôles 'agent' et 'superviseur')
      const { data: fieldUsers, error: fieldError } = await supabaseClient
        .from('users')
        .select('id')
    }

    const usersMap = new Map();
    (users || []).forEach(user => {
      usersMap.set(user.id, user);
    });

    // 3. Filtrer les validations selon les agents autorisés
    let filteredValidations = validations.filter(validation =>
      filteredAgentIds.includes(validation.agent_id)
    );
    console.log(`🔍 Validations filtrées: ${filteredValidations.length} sur ${validations.length}`);

    // 4. Filtrer par timestamp du checkin si from/to sont fournis (filtrage précis)
    if (normalizedFrom || normalizedTo) {
      filteredValidations = filteredValidations.filter(validation => {
        const checkinTimestamp = validation.checkins?.start_time || validation.created_at;
        // Si pas de timestamp, on garde la validation (pour ne pas perdre de données)
        if (!checkinTimestamp) {
          console.log(`⚠️ Validation ${validation.id} sans timestamp, conservée par défaut`);
          return true;
        }

        const timestamp = new Date(checkinTimestamp);
        if (normalizedFrom && timestamp < new Date(normalizedFrom + 'T00:00:00.000Z')) return false;
        if (normalizedTo && timestamp > new Date(normalizedTo + 'T23:59:59.999Z')) return false;
        return true;
      });
      console.log(`🔍 Validations filtrées par timestamp: ${filteredValidations.length}`);
    }

    console.log('🔄 Construction des rapports...');
    console.log('📊 filteredValidations length:', filteredValidations.length);
    console.log('👥 usersMap size:', usersMap.size);
    if (filteredValidations.length > 0) {
      console.log('🔍 Sample validation ID:', filteredValidations[0].id, 'agent_id:', filteredValidations[0].agent_id);
      console.log('🔍 Sample validation checkins:', filteredValidations[0].checkins);
    }

    const reports = filteredValidations.map(validation => {
      const checkin = validation.checkins;
      const user = usersMap.get(validation.agent_id);

      // Log de débogage pour chaque validation
      console.log(`🔍 Validation ${validation.id}: agent_id=${validation.agent_id}, user_found=${!!user}, checkin_found=${!!checkin}`);

      if (!user) {
        console.log(`⚠️ Utilisateur non trouvé pour agent_id ${validation.agent_id}`);
        return null;
      }

      // Calculer la distance si elle n'est pas déjà calculée
      let distance_m = validation.distance_m;
      const refLat = validation.reference_lat || user?.reference_lat;
      const refLon = validation.reference_lon || user?.reference_lon;

      if ((distance_m === null || distance_m === undefined) && refLat && refLon && checkin?.lat && checkin?.lon) {
        distance_m = calculateDistance(refLat, refLon, checkin.lat, checkin.lon);
      }

      // Déterminer le statut - utiliser uniquement le rayon de tolérance de l'utilisateur
      const tolerance = user?.tolerance_radius_meters || 5000; // Valeur par défaut si non définie
      const isWithinTolerance = distance_m ? distance_m <= tolerance : validation.valid;

      // Calculer la durée de mission si disponible
      let mission_duration = null;
      if (checkin?.mission_duration !== null && checkin?.mission_duration !== undefined) {
        mission_duration = checkin.mission_duration;
      } else if (checkin?.start_time) {
        // Si pas de durée stockée, on peut essayer de calculer approximativement
        // Pour l'instant, on laisse null jusqu'à ce que la colonne soit ajoutée
        mission_duration = null;
      }

      const result = {
        agent_id: validation.agent_id,
        agent: user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || `Agent #${validation.agent_id}`,
        role: user?.role || 'non-spécifié',
        projet: user?.project_name || 'Non spécifié',
        localisation: `${user?.departement || ''} ${user?.commune || ''} ${user?.arrondissement || ''} ${user?.village || ''}`.trim() || 'Non spécifié',
        date: checkin?.start_time ? new Date(checkin.start_time).toLocaleDateString('fr-FR') : new Date(validation.created_at).toLocaleDateString('fr-FR'),
        heure_arrivee: checkin?.start_time ? new Date(checkin.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        heure_depart: checkin?.end_time ? new Date(checkin.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        mission_duration: mission_duration,
        status_presence: isWithinTolerance ? 'Présent' : 'Absent',
        distance_m: distance_m,
        tolerance_m: tolerance,
        note: checkin?.note || validation.reason || '',
        photo_url: checkin?.photo_url || null,
        validation_id: validation.id,
        checkin_id: checkin?.id || null,
        created_at: validation.created_at,
        // Coordonnées de référence (depuis la table users)
        ref_lat: refLat,
        ref_lon: refLon,
        // Coordonnées actuelles (depuis le checkin)
        lat: checkin?.lat,
        lon: checkin?.lon
      };

      // Log de débogage pour vérifier les coordonnées
      if (validation.id === validations[0]?.id) {
        console.log('📍 Coordonnées du premier rapport:', {
          agent: result.agent,
          ref_lat: result.ref_lat,
          ref_lon: result.ref_lon,
          lat: result.lat,
          lon: result.lon,
          refLat_source: refLat,
          refLon_source: refLon,
          checkin_lat: checkin?.lat,
          checkin_lon: checkin?.lon
        });
      }

      return result;
    });

    // Filtrer les rapports null (où l'utilisateur n'a pas été trouvé)
    const validReports = reports.filter(report => report !== null);
    console.log('📊 Rapports valides après filtrage:', validReports.length, 'sur', reports.length);

    if (validReports.length > 0) {
      console.log('📋 Premier rapport valide:', validReports[0]);
    }

    // Calculer les métadonnées de pagination
    const totalPages = Math.ceil(totalCount / pageLimit);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    res.json({
      success: true,
      data: validReports,
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
  } catch (error) {
    console.error('❌ Erreur API reports:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ error: 'Erreur interne du serveur', message: error.message });
  }
});
app.get('/api/reports/activity-follow-up', authenticateToken, async (req, res) => {
  console.log(' /api/reports/activity-follow-up called with query:', req.query);

  try {
    const { from, to } = req.query;

    // Validation des paramètres
    if (!from || !to) {
      return res.status(400).json({
        error: 'Les paramètres from et to sont obligatoires',
        message: 'Veuillez fournir une période valide (from et to)'
      });
    }

    // Fonction pour formater les dates
    const formatDateForQuery = (dateStr, isEndOfDay = false) => {
      try {
        let date = new Date(dateStr);

        // Si la date string est en format 'YYYY-MM-DD', la parser manuellement
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
          date = new Date(Date.UTC(year, month - 1, day));
        }

        if (isNaN(date.getTime())) {
          console.warn(`⚠️ Format de date invalide: ${dateStr}`);
          return null;
        }

        if (isEndOfDay) {
          date.setUTCHours(23, 59, 59, 999);
        } else {
          date.setUTCHours(0, 0, 0, 0);
        }

        return date.toISOString().replace('Z', '+00:00');
      } catch (e) {
        console.warn(`⚠️ Erreur de formatage de date (${dateStr}):`, e.message);
        return null;
      }
    };

    // 1. Récupérer les agents
    const { data: agents, error: agentsError } = await supabaseClient
      .from('users')
      .select('id, name, first_name, last_name, email, role, project_name, departement, commune')
      .eq('role', 'agent');

    if (agentsError || !agents) {
      console.error('❌ Erreur lors de la récupération des agents:', agentsError);
      return res.status(500).json({ error: 'Erreur lors de la récupération des agents' });
    }

    console.log(`👥 ${agents?.length || 0} agents trouvés`);

    // 2. Récupérer les planifications pour la période
    const fromDateStr = formatDateForQuery(from, false);
    const toDateStr = formatDateForQuery(to, true);

    if (!fromDateStr || !toDateStr) {
      return res.status(400).json({ error: 'Format de date invalide' });
    }

    const { data: planifications, error: planificationsError } = await supabaseClient
      .from('planifications')
      .select('id, user_id, date, description_activite, resultat_journee, planned_start_time, planned_end_time')
      .gte('date', fromDateStr)
      .lte('date', toDateStr);

    if (planificationsError || !planifications) {
      console.error('❌ Erreur lors de la récupération des planifications:', planificationsError);
      return res.status(500).json({ error: 'Erreur lors de la récupération des planifications' });
    }

    console.log(`📋 ${planifications?.length || 0} planifications trouvées`);

    // 3. Grouper les planifications par agent et calculer les statistiques
    const agentsMap = new Map();
    agents.forEach(agent => {
      agentsMap.set(agent.id, {
        agent_id: agent.id,
        agent_name: agent.name || `${agent.first_name || ''} ${agent.last_name || ''} `.trim() || agent.email,
        role: agent.role,
        project_name: agent.project_name,
        departement: agent.departement,
        commune: agent.commune,
        total_activities: 0,
        realized_activities: 0,
        not_realized_activities: 0,
        in_progress_activities: 0,
        partially_realized_activities: 0,
        not_realized_list: []
      });
    });

    // Traiter chaque planification
    planifications.forEach(planification => {
      const agent = agentsMap.get(planification.user_id);
      if (!agent) {
        console.warn(`⚠️ Agent ${planification.user_id} non trouvé pour la planification ${planification.id} `);
        return;
      }

      agent.total_activities++;

      // Compter par statut
      switch (planification.resultat_journee) {
        case 'realise':
          agent.realized_activities++;
          break;
        case 'non_realise':
          agent.not_realized_activities++;
          agent.not_realized_list.push({
            name: planification.description_activite,
            date: planification.date,
            id: planification.id
          });
          break;
        case 'en_cours':
          agent.in_progress_activities++;
          break;
        case 'partiellement_realise':
          agent.partially_realized_activities++;
          break;
        default:
          // Statut non défini, on ne compte pas dans les catégories
          break;
      }
    });

    // 4. Convertir en tableau et filtrer les agents sans activités
    const activityReports = Array.from(agentsMap.values())
      .filter(agent => agent.total_activities > 0)
      .sort((a, b) => a.agent_name.localeCompare(b.agent_name));

    console.log(`📊 ${activityReports.length} agents avec des activités trouvés`);

    res.json({
      success: true,
      data: activityReports,
      period: {
        from: fromDateStr.split('T')[0],
        to: toDateStr.split('T')[0]
      },
      summary: {
        total_agents: activityReports.length,
        total_activities: activityReports.reduce((sum, agent) => sum + agent.total_activities, 0),
        total_realized: activityReports.reduce((sum, agent) => sum + agent.realized_activities, 0),
        total_not_realized: activityReports.reduce((sum, agent) => sum + agent.not_realized_activities, 0)
      }
    });

  } catch (error) {
    console.error('❌ Erreur dans /api/reports/activity-follow-up:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      message: error.message
    });
  }
});

// Endpoint de test sans authentification pour diagnostiquer
app.get('/api/test-activity-follow-up', async (req, res) => {
  console.log(' /api/test-activity-follow-up called with query:', req.query);

  try {
    const { from, to } = req.query;

    // Validation des paramètres
    if (!from || !to) {
      return res.status(400).json({
        error: 'Les paramètres from et to sont obligatoires',
        message: 'Veuillez fournir une période valide (from et to)'
      });
    }

    console.log(` Période: ${from} à ${to} `);

    // Test simple: récupérer les agents
    const { data: agents, error: agentsError } = await supabaseClient
      .from('users')
      .select('id, name, role, project_name')
      .eq('role', 'agent')
      .limit(5);

    if (agentsError) {
      console.error('Erreur test agents:', agentsError);
      return res.status(500).json({ error: 'Erreur test agents', details: agentsError });
    }

    // Test simple: récupérer les planifications
    const { data: planifications, error: planificationsError } = await supabaseClient
      .from('planifications')
      .select('id, user_id, date, description_activite, resultat_journee, planned_start_time, planned_end_time')
      .gte('date', from)
      .lte('date', to)
      .limit(5);

    if (planificationsError) {
      console.error('Erreur test planifications:', planificationsError);
      return res.status(500).json({ error: 'Erreur test planifications', details: planificationsError });
    }

    console.log(` ${agents?.length || 0} agents, ${planifications?.length || 0} planifications`);

    res.json({
      success: true,
      test: true,
      agents: agents,
      planifications: planifications,
      period: { from, to }
    });

  } catch (error) {
    console.error('Erreur test:', error);
    console.error('Stack trace test:', error.stack);
    res.status(500).json({
      error: 'Erreur interne du serveur (test)',
      message: error.message,
      stack: error.stack
    });
  }
});

// Fonction pour calculer la distance entre deux points (formule de Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance en mètres
}

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
app.use(express.static('www')); // Servir aussi le dossier www
// Servir bootstrap depuis node_modules ou CDN (si le dossier local n'existe pas)
const bootstrapPath = path.join(__dirname, 'bootstrap-5.3.8-dist');
if (require('fs').existsSync(bootstrapPath)) {
  app.use('/bootstrap-5.3.8-dist', express.static(bootstrapPath));
} else {
  // Si bootstrap n'existe pas localement, on utilisera le CDN dans le HTML
  console.warn('⚠️ Dossier bootstrap-5.3.8-dist non trouvé, utilisez le CDN dans le HTML');
}
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
async function authenticateToken(req, res, next) {
  console.log('🔍 Middleware authenticateToken appelé');
  const authHeader = req.headers['authorization'];
  console.log('🔍 Authorization header:', authHeader ? 'Présent' : 'Manquant');

  const token = authHeader && authHeader.split(' ')[1];
  console.log('🔍 Token extrait:', token ? `${token.substring(0, 10)}...` : 'non fourni');

  if (!token) {
    console.log('❌ Aucun token fourni');
    return res.status(401).json({
      error: 'Token d\'accès requis',
      code: 'MISSING_TOKEN'
    });
  }

  console.log('🔍 Vérification du token...');

  try {
    // Vérifier le token JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('🔍 Token décodé avec succès:', {
      id: decoded.id,
      auth_uuid: decoded.auth_uuid,
      email: decoded.email ? decoded.email.substring(0, 10) + '...' : 'N/A',
      role: decoded.role,
      exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'N/A'
    });

    // Vérifier si le token est expiré
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      console.log('❌ Token expiré le:', new Date(decoded.exp * 1000).toISOString());
      return res.status(401).json({
        error: 'Token expiré',
        code: 'TOKEN_EXPIRED'
      });
    }

    let user = null;

    // Essayer de trouver l'utilisateur par auth_uuid (nouveau système) ou par ID (ancien système)
    if (decoded.auth_uuid) {
      console.log('🔍 Recherche utilisateur par auth_uuid:', decoded.auth_uuid);
      try {
        const { data: userByUuid, error: uuidError } = await safeSupabaseQuery(() =>
          supabaseClient
            .from('users')
            .select('*')
            .eq('auth_uuid', decoded.auth_uuid)
            .single()
        );

        if (uuidError) {
          if (uuidError.code === 'PGRST116') {
            console.log('⚠️ Aucun utilisateur trouvé avec cet auth_uuid, essai par ID');
          } else {
            console.error('❌ Erreur recherche par auth_uuid:', uuidError);
            throw uuidError;
          }
        } else {
          user = userByUuid;
          console.log('✅ Utilisateur trouvé par auth_uuid:', { id: user.id, email: user.email, role: user.role });
        }
      } catch (uuidQueryError) {
        console.warn('⚠️ Erreur requête auth_uuid:', uuidQueryError.message);
      }
    }

    // Si pas trouvé par auth_uuid, essayer par ID
    if (!user && decoded.id) {
      console.log('🔍 Recherche utilisateur par ID:', decoded.id);
      try {
        const { data: userById, error: idError } = await safeSupabaseQuery(() =>
          supabaseClient
            .from('users')
            .select('*')
            .eq('id', decoded.id)
            .single()
        );

        if (idError) {
          console.error('❌ Erreur recherche par ID:', idError);
          throw idError;
        } else {
          user = userById;
          console.log('✅ Utilisateur trouvé par ID:', { id: user.id, email: user.email, role: user.role });
        }
      } catch (idQueryError) {
        console.warn('⚠️ Erreur requête ID:', idQueryError.message);
        throw idQueryError;
      }
    }

    if (!user) {
      console.log('❌ Utilisateur non trouvé dans la base de données');
      return res.status(401).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    // Vérifier si le compte est actif
    if (user.status === 'inactive' || user.status === 'suspended') {
      console.log('❌ Compte utilisateur inactif:', user.status);
      return res.status(403).json({
        error: 'Compte désactivé',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Ajouter les informations utilisateur à la requête
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      auth_uuid: user.auth_uuid,
      project_name: user.project_name
    };

    console.log('✅ Authentification réussie pour:', {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    });

    next();
  } catch (err) {
    console.error('❌ Erreur authentification:', {
      name: err.name,
      message: err.message,
      code: err.code
    });

    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({
        error: 'Token invalide',
        code: 'INVALID_TOKEN'
      });
    } else if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expiré',
        code: 'TOKEN_EXPIRED'
      });
    } else if (err.code === 'USER_NOT_FOUND') {
      return res.status(401).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    } else {
      return res.status(500).json({
        error: 'Erreur serveur lors de l\'authentification',
        code: 'SERVER_ERROR'
      });
    }
  }
}

// Middleware d'authentification admin
function authenticateAdmin(req, res, next) {
  if (!req.user) {
    console.log('❌ Utilisateur non authentifié');
    return res.status(401).json({ error: 'Authentification requise' });
  }
  const role = (req.user.role || '').toLowerCase();
  const email = req.user.email || 'inconnu';
  console.log(`🔍 Vérification accès admin - Email: ${email}, Rôle: ${role}`);
  
  if (role !== 'admin' && role !== 'superadmin') {
    console.log(`❌ Accès administrateur requis - Email: ${email}, Rôle actuel: ${role}`);
    return res.status(403).json({ 
      error: 'Accès administrateur requis',
      currentRole: role,
      email: email
    });
  }
  console.log(`✅ Accès admin autorisé pour ${email} (rôle: ${role})`);
  next();
}

// Middleware d'authentification superviseur ou admin
function authenticateSupervisorOrAdmin(req, res, next) {
  const role = (req.user && req.user.role) ? String(req.user.role).toLowerCase() : '';
  const isAllowed = role === 'admin' || role === 'supervisor' || role === 'superviseur';
  if (!isAllowed) {
    return res.status(403).json({ error: 'Accès superviseur ou administrateur requis' });
  }
  next();
}

// Routes API
// const apiHandler = require('./api');
// app.use('/api', apiHandler);

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

    // Récupérer checkins + missions + users
    let checkinsQuery = supabaseClient
      .from('checkins')
      .select('id, mission_id, lat, lon, note, photo_url, created_at');
    if (from) checkinsQuery = checkinsQuery.gte('created_at', from.toISOString());
    if (to) checkinsQuery = checkinsQuery.lte('created_at', to.toISOString());
    const { data: checkins, error: cErr } = await checkinsQuery;
    if (cErr) throw cErr;

    // Missions
    const missionIds = Array.from(new Set((checkins || []).map(c => c.mission_id).filter(Boolean)));
    const { data: missions, error: mErr } = await supabaseClient
      .from('missions')
      .select('id, agent_id, departement, commune, arrondissement, village')
      .in('id', missionIds.length ? missionIds : [0]);
    if (mErr) throw mErr;
    const missionById = new Map((missions || []).map(m => [m.id, m]));

    // Users
    const agentIds = Array.from(new Set((missions || []).map(m => m.agent_id).filter(Boolean)));
    const { data: users, error: uErr } = await supabaseClient
      .from('users')
      .select('id, first_name, last_name, name, project_name');
    if (uErr) throw uErr;
    const usersById = new Map((users || []).map(u => [u.id, u]));

    // Grouper par agent+jour pour déterminer début/fin de journée
    const byAgentDay = new Map();
    for (const c of (checkins || [])) {
      const m = missionById.get(c.mission_id) || {};
      const agentId = m.agent_id;
      if (!agentId) continue;
      const day = new Date(c.created_at);
      const dayKey = day.toISOString().slice(0, 10);
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
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c);
    }

    // Construire lignes
    const rows = [];
    for (const [key, list] of byAgentDay.entries()) {
      list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const [agentIdStr, dayKey] = key.split('|');
      const agentId = Number(agentIdStr);
      const first = list[0];
      const last = list[list.length - 1];
      const mission = missionById.get(first.mission_id) || {};
      const user = usersById.get(agentId) || {};

      const refLat = 0;
      const refLon = 0;
      const tol = 5000;
      const curLat = Number(last.lat);
      const curLon = Number(last.lon);
      const dist = distanceMeters(refLat, refLon, curLat, curLon);
      const status = dist === null ? '' : (dist <= tol ? 'Présent' : 'Hors_zone');

      rows.push([
        user.last_name || (user.name || '').split(' ').slice(-1)[0] || '',
        user.first_name || (user.name || '').split(' ').slice(0, -1).join(' ') || '',
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
        new Date(first.timestamp).toLocaleTimeString('fr-FR', { hour12: false }),
        new Date(last.timestamp).toLocaleTimeString('fr-FR', { hour12: false }),
        last.note || '',
        last.photo_url || '',
        status,
        String(dist ?? '')
      ]);
    }

    // CSV
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="presence-export.csv"');
    const header = [
      'Nom Animateur/agent', 'Prénom Animateur/Agent', 'Projet', 'Departement', 'Commune', 'Arrondissement', 'Village',
      'Longitude_reference', 'Latitude_reference', 'Rayon tolere (metre)', 'Latitude_actuelle', 'Longitude_actuelle', 'Date',
      'Heure debut journee', 'Heure fin journee', 'Note', 'Photo', 'Statut_Presence', 'Distance_Reference_M'
    ];
    const toCsv = (v) => {
      const s = String(v ?? '');
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [header.map(toCsv).join(';')].concat(rows.map(r => r.map(toCsv).join(';'))).join('\n');
    res.send(csv);
  } catch (e) {
    console.error('export/presence.csv error:', e);
    res.status(500).send('Erreur export');
  }
});

app.get('/api/admin/export/presence.txt', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  // Réutilise le CSV puis remplace le séparateur par des tabulations
  req.url = req.url.replace('/presence.txt', '/presence.csv');
  try {
    const fakeRes = {
      _chunks: '',
      setHeader: () => { },
      send: (s) => { fakeRes._chunks = s; }
    };
    // Simuler l'appel à la route CSV
    // Note: C'est une simplification, idéalement on refactoriserait la logique d'export
    // Pour l'instant on renvoie 501 car l'appel interne est complexe
    res.status(501).send('Non implémenté - Utilisez l\'export CSV');
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
    } catch { }
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
    const date = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString().slice(0, 10);
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

    const { date, planned_start_time, planned_end_time, description_activite, project_name, user_id } = req.body || {};
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
    } catch { }

    // Déterminer l'utilisateur cible: un admin/superviseur peut planifier pour un autre agent
    // Récupérer les informations de l'utilisateur depuis la base de données
    let userRole = 'agent'; // Par défaut
    try {
      const { data: userData } = await supabaseClient
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      if (userData) {
        userRole = userData.role;
      }
    } catch (err) {
      console.log('Erreur récupération rôle utilisateur:', err.message);
    }

    const targetUserId = (user_id && (userRole === 'admin' || userRole === 'superviseur')) ? user_id : userId;

    const payload = {
      user_id: targetUserId,
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
      .eq('user_id', targetUserId)
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
app.get('/api/planifications', authenticateToken, async (req, res) => {
  try {
    const { from, to, project_name, agent_id, departement, commune, resultat_journee } = req.query;

    let query = supabaseClient
      .from('planifications')
      .select('*');

    // Logique de filtrage par rôle améliorée
    if (agent_id) {
      // Si un agent_id spécifique est demandé, l'utiliser sur les deux colonnes possibles
      const normalizedAgentId = Number(agent_id);
      if (!Number.isFinite(normalizedAgentId)) {
        return res.status(400).json({ success: false, error: 'agent_id invalide' });
      }

      // Utiliser une approche plus robuste : deux requêtes séparées puis fusion
      // Construire les requêtes de base avec les filtres communs
      let userQuery = supabaseClient
        .from('planifications')
        .select('*')
        .eq('user_id', normalizedAgentId);

      let agentQuery = supabaseClient
        .from('planifications')
        .select('*')
        .eq('agent_id', normalizedAgentId);

      // Appliquer les filtres communs aux deux requêtes
      if (project_name) {
        userQuery = userQuery.eq('project_name', project_name);
        agentQuery = agentQuery.eq('project_name', project_name);
      }
      if (from) {
        userQuery = userQuery.gte('date', String(from));
        agentQuery = agentQuery.gte('date', String(from));
      }
      if (to) {
        userQuery = userQuery.lte('date', String(to));
        agentQuery = agentQuery.lte('date', String(to));
      }
      if (resultat_journee) {
        userQuery = userQuery.eq('resultat_journee', resultat_journee);
        agentQuery = agentQuery.eq('resultat_journee', resultat_journee);
      }

      try {
        // Exécuter les deux requêtes en parallèle
        const [userResult, agentResult] = await Promise.all([
          userQuery.order('date', { ascending: false }),
          agentQuery.order('date', { ascending: false })
        ]);

        // Fusionner les résultats et supprimer les doublons
        const allData = [
          ...(userResult.data || []),
          ...(agentResult.data || [])
        ];
        const uniqueData = Array.from(
          new Map(allData.map(item => [item.id, item])).values()
        );

        // Enrichir avec les données utilisateurs si nécessaire
        let enrichedData = uniqueData;
        if (enrichedData.length > 0) {
          const userIds = [...new Set(enrichedData.map(p => p.user_id).filter(Boolean))];
          const { data: users } = await supabaseClient
            .from('users')
            .select('id, name, first_name, last_name, email, role, project_name, departement, commune')
            .in('id', userIds);

          if (users) {
            const usersMap = new Map(users.map(user => [user.id, user]));
            enrichedData = enrichedData.map(plan => ({
              ...plan,
              user: usersMap.get(plan.user_id) || null
            }));
          }
        }

        return res.json({ success: true, items: enrichedData });
      } catch (queryError) {
        // Si les requêtes parallèles échouent, utiliser la méthode simple
        console.warn('Requêtes parallèles échouées, utilisation de user_id uniquement:', queryError);
        query = query.eq('user_id', normalizedAgentId);
      }
    } else if (req.user.role === 'admin') {
      // Les admins voient toutes les planifications
      // Pas de filtre par user_id
    } else if (req.user.role === 'superviseur') {
      // Les superviseurs voient seulement leurs propres planifications
      query = query.eq('user_id', req.user.id);
    } else if (req.user.role === 'agent') {
      // Les agents voient seulement leurs propres planifications
      query = query.eq('user_id', req.user.id);
    }

    // Filtrer par projet
    if (project_name) {
      query = query.eq('project_name', project_name);
    }

    if (from) query = query.gte('date', String(from));
    if (to) query = query.lte('date', String(to));
    if (resultat_journee) query = query.eq('resultat_journee', resultat_journee);

    // Filtres par département/commune via la table users
    if (departement || commune) {
      let usersQ = supabaseClient.from('users').select('id');
      if (departement) usersQ = usersQ.eq('departement', departement);
      if (commune) usersQ = usersQ.eq('commune', commune);
      const { data: filteredUsers, error: usersError } = await usersQ;
      if (usersError) throw usersError;
      const userIds = (filteredUsers || []).map(u => u.id);
      if (userIds.length === 0) {
        return res.json({ success: true, items: [] });
      }
      query = query.in('user_id', userIds);
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) throw error;

    // Enrichir avec les données utilisateurs si nécessaire
    let enrichedData = data || [];
    if (enrichedData.length > 0) {
      const userIds = [...new Set(enrichedData.map(p => p.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: users } = await supabaseClient
          .from('users')
          .select('id, name, first_name, last_name, email, role, project_name, departement, commune')
          .in('id', userIds);

        if (users) {
          const usersMap = new Map(users.map(user => [user.id, user]));
          enrichedData = enrichedData.map(plan => ({
            ...plan,
            user: usersMap.get(plan.user_id) || {
              id: plan.user_id,
              name: `Agent ${plan.user_id}`,
              email: '',
              role: 'agent',
              project_name: plan.project_name || 'Projet Général'
            }
          }));
        }
      }
    }

    return res.json({ success: true, items: enrichedData });

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

    // Validation des résultats si fourni
    if (resultat_journee) {
      const validResults = ['realise', 'partiellement_realise', 'non_realise', 'en_cours'];
      if (!validResults.includes(resultat_journee)) {
        return res.status(400).json({ success: false, error: 'Résultat invalide' });
      }
    }

    const { data, error } = await supabaseClient
      .from('planifications')
      .update({
        resultat_journee: resultat_journee || null,
        observations: observations || null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.user.id)
      .eq('date', date)
      .select();

    if (error) {
      console.error('Erreur Supabase:', error);
      throw error;
    }

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

// Échanger le token Supabase contre notre JWT
app.post('/api/auth/exchange', async (req, res) => {
  try {
    const { supabase_token } = req.body;

    if (!supabase_token) {
      return res.status(400).json({ error: 'Token Supabase requis' });
    }

    // Vérifier le token Supabase
    const { data: { user }, error } = await supabaseClient.auth.getUser(supabase_token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token Supabase invalide' });
    }

    // Chercher l'utilisateur dans notre table par auth_uuid (des métadonnées)
    const authUuid = user.user_metadata?.auth_uuid || user.id;

    const { data: users, error: userError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('auth_uuid', authUuid)
      .limit(1);

    if (userError) throw userError;
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Utilisateur non trouvé dans la base de données' });
    }

    const dbUser = users[0];

    // VÉRIFICATION OBLIGATOIRE : L'utilisateur doit être vérifié
    if (!dbUser.is_verified) {
      return res.status(403).json({
        error: 'Compte non vérifié',
        message: 'Veuillez vérifier votre compte avant de vous connecter',
        requires_verification: true
      });
    }

    // Générer notre token JWT
    const token = jwt.sign(
      {
        id: dbUser.id,
        auth_uuid: dbUser.auth_uuid,
        email: dbUser.email,
        role: dbUser.role,
        name: dbUser.name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        name: dbUser.name,
        project_name: dbUser.project_name
      }
    });

  } catch (error) {
    console.error('Erreur exchange token:', error);
    res.status(500).json({ error: 'Erreur serveur' });
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
        auth_uuid: user.auth_uuid, // Ajouter auth_uuid au token
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
    const {
      email,
      password,
      name,
      role = 'agent',
      phone,
      departement,
      commune,
      arrondissement,
      village,
      project_name,
      reference_lat,
      reference_lon,
      tolerance_radius_meters,
      expected_days_per_month,
      expected_hours_per_month,
      contract_start_date,
      contract_end_date,
      years_of_service
    } = req.body;
    // Normaliser le rôle pour correspondre au CHECK de la base ('admin', 'superviseur', 'agent')
    const role_db = role === 'supervisor' ? 'superviseur' : role;

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
        role: role_db,
        phone,
        departement,
        commune,
        arrondissement,
        village,
        project_name,
        reference_lat: reference_lat ? parseFloat(reference_lat) : null,
        reference_lon: reference_lon ? parseFloat(reference_lon) : null,
        tolerance_radius_meters: tolerance_radius_meters ? parseInt(tolerance_radius_meters) : 5000,
        expected_days_per_month: expected_days_per_month ? parseInt(expected_days_per_month) : null,
        expected_hours_per_month: expected_hours_per_month ? parseInt(expected_hours_per_month) : null,
        contract_start_date,
        contract_end_date,
        years_of_service: years_of_service ? parseFloat(years_of_service) : null,
        supervisor_id: role === 'agent' ? null : null, // Les agents auront besoin d'un superviseur assigné plus tard
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
        const recipient = (role_db === 'admin') ? superAdmin : email;
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
// Récupère le récapitulatif des présences validées par agent pour un mois/année donné
app.get('/api/presence-summary', (req, res, next) => {
  console.log('🔍 Endpoint /api/presence-summary appelé');
  next();
}, authenticateToken, async (req, res) => {
  try {
    const { month, year, project_name } = req.query;
    const monthNum = parseInt(month) || new Date().getMonth() + 1;
    const yearNum = parseInt(year) || new Date().getFullYear();
    const projectFilter = project_name && project_name !== 'all' ? project_name : null;

    // Calculer les dates de début et fin du mois
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0);

    // Formater les dates pour la requête
    const startDateStr = startDate.toISOString();
    const endDateStr = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59).toISOString();

    console.log(`📅 Récupération des validations du ${startDateStr} au ${endDateStr}`);

    // 1. Récupérer les presences pour la période (nouvelle table)
    console.log('🔍 Tentative de récupération des presences depuis la table presences...');
    let presences = [];
    let presencesError = null;

    try {
      const presencesQuery = supabaseClient
        .from('presences')
        .select(`
        id,
  user_id,
  start_time,
  checkin_type,
  within_tolerance,
  status,
  users(id, name, first_name, last_name, email, role, project_name, departement, commune)
    `)
        .gte('start_time', startDateStr)
        .lte('start_time', endDateStr)
        .order('start_time', { ascending: false });

      presences = await fetchAllPages(presencesQuery);
    } catch (error) {
      console.error('Erreur inattendue lors de la récupération des presences:', error);
      presences = [];
    }

    console.log(`✅ ${presences?.length || 0} presences trouvées`);

    // 2. Récupérer les présences validées depuis la table presence_validations
    let holidays = [];
    try {
      const holidaysResult = await supabaseClient
        .from('holidays')
        .select('date')
        .gte('date', startDateStr.split('T')[0])
        .lte('date', endDateStr.split('T')[0]);

      holidays = holidaysResult.data || [];

      if (holidaysResult.error) {
        console.error('Erreur lors de la récupération des jours fériés:', holidaysResult.error);
        holidays = [];
      }
    } catch (error) {
      console.error('Erreur inattendue lors de la récupération des jours fériés:', error);
      holidays = [];
    }

    const holidayDates = new Set(holidays.map(h => h.date));

    // 3. Initialiser les statistiques par utilisateur
    const statsByUser = {};

    // 4. Construire une map unifiée des jours de présence depuis toutes les sources
    // On combine presences, presence_validations et checkin_validations pour avoir un comptage complet
    let presenceDaysMap = {}; // Map: userId -> Set de dates (YYYY-MM-DD)

    // 4a. Traiter les presences de la table presences
    if (presences && presences.length > 0) {
      console.log(`📊 Traitement de ${presences.length} presences depuis la table presences...`);
      presences.forEach(presence => {
        const user = presence.users;
        if (!user || !['agent', 'field_agent', 'supervisor', 'superviseur'].includes(user.role)) return;

        const userId = user.id;
        const date = new Date(presence.start_time).toISOString().split('T')[0];

        if (!presenceDaysMap[userId]) {
          presenceDaysMap[userId] = new Set();
        }

        // Utiliser checkin_type pour déterminer le statut
        const checkinType = presence.checkin_type ? String(presence.checkin_type).toLowerCase().trim() : '';
        const isValidated = checkinType === 'validated' ||
          (presence.within_tolerance === true || presence.status === 'present' || presence.status === 'completed');

        if (isValidated) {
          presenceDaysMap[userId].add(date);
        }
      });
      console.log(`✅ Jours de présence extraits depuis presences pour ${Object.keys(presenceDaysMap).length} utilisateurs`);
    }

    // 4b. Ajouter les validations depuis presence_validations (combine avec les données existantes)
    try {
      console.log('🔍 Récupération de toutes les pages de presence_validations...');
      const validationsQuery = supabaseClient
        .from('presence_validations')
        .select('user_id, checkin_timestamp')
        .eq('validation_status', 'validated')
        .gte('checkin_timestamp', startDateStr)
        .lte('checkin_timestamp', endDateStr);

      const validationsData = await fetchAllPages(validationsQuery);

      if (validationsData && Array.isArray(validationsData)) {
        let addedCount = 0;
        validationsData.forEach(validation => {
          const userId = validation.user_id;
          if (!userId) return;
          const date = new Date(validation.checkin_timestamp).toISOString().split('T')[0];
          if (!presenceDaysMap[userId]) {
            presenceDaysMap[userId] = new Set();
          }
          const wasNew = !presenceDaysMap[userId].has(date);
          presenceDaysMap[userId].add(date);
          if (wasNew) addedCount++;
        });
        console.log(`✅ ${validationsData.length} validations trouvées dans presence_validations, ${addedCount} nouveaux jours ajoutés`);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des présences validées depuis presence_validations:', error);
    }

    // 4c. Ajouter les validations depuis checkin_validations (combine avec les données existantes)
    // IMPORTANT: Utiliser le timestamp du check-in, pas created_at de la validation
    try {
      console.log('🔍 Récupération de toutes les pages de checkin_validations avec timestamp des check-ins...');
      const checkinValidationsQuery = supabaseClient
        .from('checkin_validations')
        .select('agent_id, created_at, checkins(created_at)')
        .eq('valid', true)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr);

      const checkinValidationsData = await fetchAllPages(checkinValidationsQuery);

      if (checkinValidationsData && Array.isArray(checkinValidationsData)) {
        let addedCount = 0;
        let skippedCount = 0;
        let debugSample = null; // Pour déboguer la structure

        checkinValidationsData.forEach((validation, index) => {
          const userId = validation.agent_id;
          if (!userId) {
            skippedCount++;
            return;
          }

          // Utiliser le timestamp du check-in si disponible, sinon created_at de la validation
          // Note: checkins peut être un objet ou un tableau selon Supabase
          let checkinTimestamp = null;
          if (validation.checkins) {
            if (Array.isArray(validation.checkins) && validation.checkins.length > 0) {
              checkinTimestamp = validation.checkins[0].created_at;
            } else if (validation.checkins.created_at) {
              checkinTimestamp = validation.checkins.created_at;
            }
          }

          // Fallback sur created_at si pas de timestamp de check-in
          if (!checkinTimestamp) {
            checkinTimestamp = validation.created_at;
          }

          if (!checkinTimestamp) {
            skippedCount++;
            if (index === 0) {
              debugSample = { validation, structure: 'no_timestamp' };
            }
            return;
          }

          const date = new Date(checkinTimestamp).toISOString().split('T')[0];

          // Vérifier que la date est dans la période (au cas où created_at et timestamp diffèrent)
          if (date < startDateStr.split('T')[0] || date > endDateStr.split('T')[0]) {
            skippedCount++;
            return;
          }

          if (!presenceDaysMap[userId]) {
            presenceDaysMap[userId] = new Set();
          }
          const wasNew = !presenceDaysMap[userId].has(date);
          presenceDaysMap[userId].add(date);
          if (wasNew) addedCount++;

          // Log de débogage pour les premiers enregistrements
          if (index < 3 && !debugSample) {
            debugSample = {
              userId,
              checkinTimestamp,
              date,
              checkinsStructure: Array.isArray(validation.checkins) ? 'array' : typeof validation.checkins,
              wasNew
            };
          }
        });

        if (debugSample) {
          console.log(`🔍[DEBUG checkin_validations] Échantillon: `, JSON.stringify(debugSample, null, 2));
        }

        console.log(`✅ ${checkinValidationsData.length} validations trouvées dans checkin_validations, ${addedCount} nouveaux jours ajoutés, ${skippedCount} ignorés`);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des présences validées depuis checkin_validations:', error);
      // Fallback: essayer sans la jointure si la jointure échoue
      try {
        console.log('⚠️ Tentative de récupération sans jointure checkins...');
        const checkinValidationsQueryFallback = supabaseClient
          .from('checkin_validations')
          .select('agent_id, created_at')
          .eq('valid', true)
          .gte('created_at', startDateStr)
          .lte('created_at', endDateStr);

        const checkinValidationsDataFallback = await fetchAllPages(checkinValidationsQueryFallback);

        if (checkinValidationsDataFallback && Array.isArray(checkinValidationsDataFallback)) {
          let addedCount = 0;
          checkinValidationsDataFallback.forEach(validation => {
            const userId = validation.agent_id;
            if (!userId) return;
            const date = new Date(validation.created_at).toISOString().split('T')[0];
            if (!presenceDaysMap[userId]) {
              presenceDaysMap[userId] = new Set();
            }
            const wasNew = !presenceDaysMap[userId].has(date);
            presenceDaysMap[userId].add(date);
            if (wasNew) addedCount++;
          });
          console.log(`✅[Fallback] ${checkinValidationsDataFallback.length} validations trouvées, ${addedCount} nouveaux jours ajoutés`);
        }
      } catch (fallbackError) {
        console.error('Erreur lors du fallback checkin_validations:', fallbackError);
      }
    }

    // 4d. Construire les stats pour tous les utilisateurs
    try {
      console.log('🔍 Récupération de toutes les pages de users...');
      let usersQuery = supabaseClient
        .from('users')
        .select('id, name, first_name, last_name, email, role, project_name, departement, commune')
        .in('role', ['agent', 'field_agent', 'supervisor', 'superviseur']);

      // Appliquer le filtre projet si fourni
      if (projectFilter) {
        usersQuery = usersQuery.eq('project_name', projectFilter);
      }

      const users = await fetchAllPages(usersQuery);
      users.forEach(user => {
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || user.email || `Agent ${user.id}`;
        const presentDays = presenceDaysMap[user.id] ? presenceDaysMap[user.id].size : 0;

        // Log de débogage pour les agents avec peu de jours de présence ou pour le débogage
        if (presentDays > 0 && presentDays < 10) {
          const dates = Array.from(presenceDaysMap[user.id] || []).sort();
          console.log(`🔍 Agent ${user.id}(${fullName}): ${presentDays} jour(s) de présence: ${dates.join(', ')}`);
        }

        // Log supplémentaire pour les agents avec un nom spécifique (débogage)
        if (fullName && (fullName.includes('AGBANI') || fullName.includes('BABATOUNDE') || fullName.includes('KOTCHIKPA') || fullName.includes('EPHREM') || fullName.includes('CONSTANTIN'))) {
          const dates = Array.from(presenceDaysMap[user.id] || []).sort();
          console.log(`\n🔍[DEBUG] ===== Agent ${user.id}(${fullName}) ===== `);
          console.log(`🔍[DEBUG] Jours de présence: ${presentDays}`);
          console.log(`🔍[DEBUG] Dates de présence: ${dates.length > 0 ? dates.join(', ') : 'Aucune'}`);
          console.log(`🔍[DEBUG] Projet: ${user.project_name}`);
          console.log(`🔍[DEBUG] Email: ${user.email}`);
          console.log(`🔍[DEBUG] Période: ${startDateStr.split('T')[0]} à ${endDateStr.split('T')[0]}`);
          console.log(`🔍[DEBUG] ===========================================\n`);
        }

        statsByUser[user.id] = {
          name: fullName,
          email: user.email,
          project: user.project_name,
          departement: user.departement,
          commune: user.commune,
          present_days: presentDays
        };
      });
      console.log(`✅ Stats construites pour ${users.length} utilisateurs(agents et superviseurs)`);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
    }


    // 5. Récupérer les jours planifiés pour chaque agent depuis la table planifications
    const plannedDaysByUser = {}; // Tous les jours planifiés du mois
    const plannedPastDaysByUser = {}; // Seulement les jours planifiés qui sont déjà passés

    console.log('🔍 Récupération des planifications...');

    // Obtenir la date d'aujourd'hui pour séparer passé et futur
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // Format YYYY-MM-DD

    try {
      // Récupérer les planifications pour la période avec pagination complète
      console.log('🔍 Récupération de toutes les pages de planifications...');
      const planificationsQuery = supabaseClient
        .from('planifications')
        .select('user_id, date')
        .gte('date', startDateStr.split('T')[0])
        .lte('date', endDateStr.split('T')[0]);

      const planificationsData = await fetchAllPages(planificationsQuery);

      if (planificationsData && Array.isArray(planificationsData)) {
        // Compter les jours planifiés distincts par utilisateur
        planificationsData.forEach(plan => {
          const userId = plan.user_id;
          const date = plan.date;

          // Tous les jours planifiés (pour l'affichage)
          if (!plannedDaysByUser[userId]) {
            plannedDaysByUser[userId] = new Set();
          }
          plannedDaysByUser[userId].add(date);

          // Seulement les jours planifiés qui sont dans le passé (pour calcul absences)
          if (date < todayStr) {
            if (!plannedPastDaysByUser[userId]) {
              plannedPastDaysByUser[userId] = new Set();
            }
            plannedPastDaysByUser[userId].add(date);
          }
        });
        console.log(`✅ ${planificationsData.length} planifications trouvées`);
      } else {
        console.log('Aucune planification trouvée ou données invalides');
      }
    } catch (error) {
      console.error('Erreur inattendue lors de la récupération des planifications:', error);
    }

    // 6. Calculer les statistiques finales
    const DAYS_REQUIRED = 20; // Nombre de jours requis par mois

    const result = Object.entries(statsByUser)
      .map(([userId, data]) => {
        const plannedDays = plannedDaysByUser[userId] ? plannedDaysByUser[userId].size : 0; // Tous les jours planifiés du mois
        const plannedPastDays = plannedPastDaysByUser[userId] ? plannedPastDaysByUser[userId].size : 0; // Seulement les jours planifiés dans le passé

        // S'assurer que present_days est toujours un nombre
        const presentDays = (data.present_days !== undefined && data.present_days !== null)
          ? parseInt(data.present_days) || 0
          : 0;

        // Calculer les absences: jours planifiés passés - présences validées
        // On ne compte comme absents que les jours planifiés dans le passé où l'agent n'était pas présent
        const absentDays = Math.max(plannedPastDays - presentDays, 0);

        // Calculer le taux de présence global mensuel: (nombre de jours présents / 20 jours attendus) × 100
        const presenceRate = Math.round((presentDays / DAYS_REQUIRED) * 100);

        return {
          user_id: parseInt(userId),
          name: data.name,
          email: data.email,
          project: data.project,
          departement: data.departement,
          commune: data.commune,
          present_days: presentDays,
          absent_days: absentDays,
          planned_days: plannedDays, // Nombre de jours planifiés enregistrés (sans /20)
          expected_days: DAYS_REQUIRED, // Nombre de jours attendus par mois (20)
          total_days: presentDays,
          presence_rate: presenceRate,
          status: getStatusFromPresenceRate(presenceRate)
        };
      })
      .sort((a, b) => {
        // Trier d'abord par projet, puis par taux de présence décroissant, puis par nom
        const projectCompare = (a.project || '').localeCompare(b.project || '');
        if (projectCompare !== 0) return projectCompare;

        const rateCompare = b.presence_rate - a.presence_rate;
        return rateCompare !== 0 ? rateCompare : a.name.localeCompare(b.name);
      });

    // Fonction utilitaire pour déterminer le statut en fonction du taux de présence
    function getStatusFromPresenceRate(rate) {
      if (rate >= 90) return 'excellent';
      if (rate >= 80) return 'good';
      if (rate >= 70) return 'warning';
      return 'critical';
    }

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('Erreur récupération récapitulatif présence:', error);
    console.error('Stack trace:', error.stack);

    // Retourner un tableau vide en cas d'erreur plutôt qu'une erreur 500
    res.json({
      success: true,
      data: [],
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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
        id, mission_id, lat, lon, created_at, note, photo_url,
  missions!inner(id, agent_id, status, date_start, date_end,
    users!inner(id, email, name)
  )
  `)
      .order('created_at', { ascending: false })
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

// Liste des agents pour l'admin - SUPPRIMÉ (utilise l'endpoint plus complet ci-dessous)

// Récapitulatif mensuel validé par agent (admin)
app.get('/api/admin/attendance', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    if (!from || !to) {
      return res.status(400).json({ error: "Paramètres 'from' et 'to' requis (YYYY-MM-DD)" });
    }

    const fromISO = new Date(from + 'T00:00:00.000Z').toISOString();
    const toISO = new Date(new Date(to + 'T00:00:00.000Z').getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Récupérer les missions dans l'intervalle, avec l'agent
    const { data: missions, error: missionsErr } = await supabaseClient
      .from('missions')
      .select('id, agent_id, date_start, date_end, status, users!inner(id, name, project_name)')
      .gte('date_start', fromISO)
      .lt('date_start', toISO);
    if (missionsErr) throw missionsErr;

    // Récupérer les planifications (jours planifiés) dans l'intervalle avec pagination complète
    // On sélectionne toutes les colonnes pour être tolérant aux variations de schéma
    // Utilise le schéma fourni: id, agent_id, date
    let plans = null;
    {
      try {
        console.log('🔍 Récupération de toutes les pages de planifications pour /api/admin/attendance...');
        const plansQuery = supabaseClient
          .from('planifications')
          .select('id, agent_id, date')
          .gte('date', from)
          .lte('date', to);

        plans = await fetchAllPages(plansQuery);
      } catch (plansErr) {
        // Fallback tolérant si la colonne 'date' a un autre nom
        console.log('⚠️ Tentative avec fallback pour planifications...');
        try {
          const plansQueryAll = supabaseClient
            .from('planifications')
            .select('*');

          const plansAll = await fetchAllPages(plansQueryAll);
          plans = Array.isArray(plansAll) ? plansAll.filter(p => {
            const raw = p.date || p.date_planned || p.planned_date || p.date_start || p.jour || p.day;
            if (!raw) return false;
            const day = (raw + '').slice(0, 10);
            return day >= from && day <= to;
          }) : [];
        } catch (plansAllErr) {
          console.error('❌ Erreur lors de la récupération des planifications:', plansAllErr);
          throw plansAllErr;
        }
      }
    }

    // Récupérer les check-ins liés à ces missions (via join) dans l'intervalle
    const { data: checkins, error: checkinsErr } = await supabaseClient
      .from('checkins')
      .select('id, created_at, missions!inner(id, agent_id, users!inner(id, name, project_name))')
      .gte('created_at', fromISO)
      .lt('created_at', toISO);
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
      if (c.created_at) {
        const day = new Date(c.created_at).toISOString().slice(0, 10);
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

// Synthèse par projet: agrège depuis Supabase (users, missions, planifications, checkins)
app.get('/api/admin/project-summary', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    if (!from || !to) {
      return res.status(400).json({ error: "Paramètres 'from' et 'to' requis (YYYY-MM-DD)" });
    }

    const fromISO = new Date(from + 'T00:00:00.000Z').toISOString();
    const toISO = new Date(new Date(to + 'T00:00:00.000Z').getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Charger les utilisateurs (agents) avec leur projet
    const { data: users, error: usersErr } = await supabaseClient
      .from('users')
      .select('id, role, name, project_name')
      .in('role', ['agent']);
    if (usersErr) throw usersErr;

    const agents = (users || []).filter(u => (u.role || '').toLowerCase() === 'agent');
    const agentIds = agents.map(a => a.id);

    // Missions sur la période
    const { data: missions, error: missionsErr } = await supabaseClient
      .from('missions')
      .select('id, agent_id, status, date_start, date_end')
      .gte('date_start', fromISO)
      .lt('date_start', toISO)
      .in('agent_id', agentIds);
    if (missionsErr) throw missionsErr;

    // Checkins liés à la période (via mission)
    const { data: checkins, error: checkinsErr } = await supabaseClient
      .from('checkins')
      .select('id, mission_id, created_at')
      .gte('created_at', fromISO)
      .lt('created_at', toISO);
    if (checkinsErr) throw checkinsErr;

    // Planifications (jours planifiés) sur la période (tolérant au schéma)
    let plans;
    {
      const { data: plansTry, error: plansTryErr } = await supabaseClient
        .from('planifications')
        .select('id, agent_id, date')
        .gte('date', from)
        .lte('date', to);
      if (!plansTryErr) {
        plans = plansTry;
      } else {
        const { data: plansAll, error: plansAllErr } = await supabaseClient
          .from('planifications')
          .select('*');
        if (plansAllErr) throw plansAllErr;
        plans = Array.isArray(plansAll) ? plansAll.filter(p => {
          const raw = p.date || p.date_planned || p.planned_date || p.date_start || p.jour || p.day;
          if (!raw) return false;
          const day = (String(raw)).slice(0, 10);
          return day >= from && day <= to;
        }) : [];
      }
    }

    const missionsByAgent = new Map();
    (missions || []).forEach(m => {
      if (!missionsByAgent.has(m.agent_id)) missionsByAgent.set(m.agent_id, []);
      missionsByAgent.get(m.agent_id).push(m);
    });

    const plansByAgent = new Map();
    (plans || []).forEach(p => {
      if (!plansByAgent.has(p.agent_id)) plansByAgent.set(p.agent_id, new Set());
      const raw = p.date || p.date_planned || p.planned_date || p.date_start || p.jour || p.day;
      if (!raw) return;
      const day = (String(raw)).slice(0, 10);
      plansByAgent.get(p.agent_id).add(day);
    });

    const checkinsByMission = new Map();
    (checkins || []).forEach(c => {
      if (!checkinsByMission.has(c.mission_id)) checkinsByMission.set(c.mission_id, []);
      checkinsByMission.get(c.mission_id).push(c);
    });

    // Agréger par projet
    const byProject = new Map();
    const ensure = (project) => {
      if (!byProject.has(project)) {
        byProject.set(project, {
          project_name: project || '—',
          agent_count: 0,
          planned_days: 0,
          present_days: 0,
          missions_count: 0,
          checkins_count: 0
        });
      }
      return byProject.get(project);
    };

    agents.forEach(a => {
      const project = (a.project_name || '').trim();
      if (!project) return; // ignorer les agents sans nom de projet
      const bucket = ensure(project);
      bucket.agent_count += 1;

      // Jours planifiés
      const plannedSet = plansByAgent.get(a.id) || new Set();
      bucket.planned_days += plannedSet.size;

      // Missions et présence (jours avec checkins ou missions)
      const amissions = missionsByAgent.get(a.id) || [];
      bucket.missions_count += amissions.length;

      const presentDays = new Set();
      amissions.forEach(m => {
        const cks = checkinsByMission.get(m.id) || [];
        cks.forEach(ck => {
          const day = new Date(ck.created_at).toISOString().slice(0, 10);
          presentDays.add(day);
        });
      });
      bucket.present_days += presentDays.size;

      // Compte de check-ins
      const totalCheckins = amissions.reduce((acc, m) => acc + ((checkinsByMission.get(m.id) || []).length), 0);
      bucket.checkins_count += totalCheckins;
    });

    const items = Array.from(byProject.values()).sort((a, b) => a.project_name.localeCompare(b.project_name));
    res.json({ success: true, from, to, items });

  } catch (error) {
    console.error('❌ Erreur project-summary:', error);
    res.status(500).json({ error: 'Erreur serveur' });
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
    if (uerr || !u) return res.status(200).json({ success: true, has_presence: false });

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
    if (!req.user?.id) {
      console.error('❌ ID utilisateur manquant dans le token');
      return res.status(400).json({
        error: 'Identifiant utilisateur manquant',
        code: 'MISSING_USER_ID'
      });
    }

    console.log(`🔍 Récupération du profil pour l'utilisateur: ${req.user.id}`);

    // Récupération des informations utilisateur
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (userError) {
      console.error('❌ Erreur récupération utilisateur:', userError.message, userError);
      return res.status(500).json({
        error: 'Erreur lors de la récupération de l\'utilisateur',
        details: userError.message,
        code: 'USER_FETCH_ERROR'
      });
    }

    if (!user) {
      console.error('❌ Utilisateur non trouvé:', req.user.id);
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    // Récupération du profil
    let profile = null;
    try {
      const { data: p, error: profileError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = pas de lignes
        console.error('⚠️ Erreur récupération profil:', profileError.message);
      }

      profile = p || null;
      console.log(`✅ Profil récupéré:`, profile ? 'Oui' : 'Non');
    } catch (profileErr) {
      console.error('⚠️ Exception lors de la récupération du profil:', profileErr.message);
    }

    // Réponse avec les données de l'utilisateur et du profil
    return res.json({
      success: true,
      user: {
        ...user,
        profile
      }
    });

  } catch (error) {
    console.error('❌ Erreur critique dans /api/profile:', error.message, error);
    return res.status(500).json({
      error: 'Erreur serveur',
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
      try { await supabaseClient.from('users').update(usersUpdate).eq('id', userId); } catch { }
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
      contract_start_date,
      contract_end_date,
      years_of_service,
      expected_days_per_month,
      expected_hours_per_month,
      planning_start_date,
      planning_end_date
    } = req.body || {};

    // Validation des coordonnées GPS
    const lat = reference_lat === undefined || reference_lat === null || reference_lat === '' ? null : Number(reference_lat);
    const lon = reference_lon === undefined || reference_lon === null || reference_lon === '' ? null : Number(reference_lon);
    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      return res.status(400).json({ success: false, error: 'Latitude de référence invalide' });
    }
    if (lon !== null && (!Number.isFinite(lon) || lon < -180 || lon > 180)) {
      return res.status(400).json({ success: false, error: 'Longitude de référence invalide' });
    }

    const tol = tolerance_radius_meters === undefined || tolerance_radius_meters === null || tolerance_radius_meters === '' ? null : Math.max(0, parseInt(String(tolerance_radius_meters), 10) || 0);

    // Préparer les données pour la mise à jour de la table users
    const updateData = {};

    // Champs de base
    if (typeof photo_path !== 'undefined') updateData.photo_path = photo_path || null;
    if (typeof first_name !== 'undefined') updateData.first_name = first_name || null;
    if (typeof last_name !== 'undefined') updateData.last_name = last_name || null;
    if (typeof phone !== 'undefined') updateData.phone = phone || null;

    // Localisation
    if (typeof departement !== 'undefined') updateData.departement = departement || null;
    if (typeof commune !== 'undefined') updateData.commune = commune || null;
    if (typeof arrondissement !== 'undefined') updateData.arrondissement = arrondissement || null;
    if (typeof village !== 'undefined') updateData.village = village || null;

    // Projet
    if (typeof project_name !== 'undefined') updateData.project_name = project_name || null;

    // GPS
    if (typeof reference_lat !== 'undefined') updateData.reference_lat = lat;
    if (typeof reference_lon !== 'undefined') updateData.reference_lon = lon;
    if (typeof tolerance_radius_meters !== 'undefined') updateData.tolerance_radius_meters = tol || 5000;

    // Contrat
    if (typeof contract_start_date !== 'undefined') updateData.contract_start_date = contract_start_date || null;
    if (typeof contract_end_date !== 'undefined') updateData.contract_end_date = contract_end_date || null;
    if (typeof years_of_service !== 'undefined') updateData.years_of_service = years_of_service ? Number(years_of_service) : null;

    // Planification
    if (typeof expected_days_per_month !== 'undefined') updateData.expected_days_per_month = expected_days_per_month ? Number(expected_days_per_month) : null;
    if (typeof expected_hours_per_month !== 'undefined') updateData.expected_hours_per_month = expected_hours_per_month ? Number(expected_hours_per_month) : null;
    if (typeof planning_start_date !== 'undefined') updateData.planning_start_date = planning_start_date || null;
    if (typeof planning_end_date !== 'undefined') updateData.planning_end_date = planning_end_date || null;

    // Mettre à jour la table users directement
    const { data, error } = await supabaseClient
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      console.error('Erreur mise à jour users:', error);
      throw error;
    }

    console.log('✅ Profil utilisateur mis à jour dans la table users:', userId);
    return res.json({ success: true, user: data });
  } catch (error) {
    console.error('Erreur upsert me/profile:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Missions
app.get('/api/me/missions', authenticateToken, async (req, res) => {
  try {
    const requestedAgentId = Number(req.query.agent_id);
    const currentUserId = Number(req.user.id);
    let targetAgentId = currentUserId;

    if (Number.isFinite(requestedAgentId)) {
      if (requestedAgentId !== currentUserId && !isPrivilegedRequest(req)) {
        return res.status(403).json({ error: 'Accès interdit pour cet agent' });
      }
      targetAgentId = requestedAgentId;
    }

    const { data: missions, error } = await supabaseClient
      .from('missions')
      .select('*')
      .eq('agent_id', targetAgentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    let enriched = missions || [];
    res.json({ success: true, missions: enriched });

  } catch (error) {
    console.error('Erreur missions:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Conversations - Trouver ou créer une conversation
app.post('/api/conversations', authenticateToken, async (req, res) => {
  try {
    if (!supabaseClient) {
      return res.status(500).json({ error: 'Supabase non configuré' });
    }

    const { type, user2_id, forum_category_id } = req.body;
    // Debug: afficher le body complet
    console.log('📥 Body reçu:', JSON.stringify(req.body));
    console.log('🔍 user2_id brut:', user2_id, 'Type:', typeof user2_id);

    // Utiliser l'ID numérique de l'utilisateur (pas UUID)
    const user1_id = Number(req.user.id);
    const user2_id_num = user2_id ? Number(user2_id) : null;

    console.log('🔢 Après conversion - User1:', user1_id, 'User2:', user2_id_num);

    if (!user1_id) {
      console.error('❌ ID utilisateur manquant dans le token');
      return res.status(400).json({ error: 'Identifiant utilisateur manquant' });
    }

    if (!type) {
      return res.status(400).json({ error: 'Type de conversation requis (direct ou forum)' });
    }

    console.log(`📨 Création/récupération conversation - Type: ${type}, User1 ID: ${user1_id}, User2 ID: ${user2_id_num}`);

    let conversation;
    let error;

    if (type === 'direct') {
      if (!user2_id_num || isNaN(user2_id_num)) {
        console.error('❌ user2_id invalide:', { user2_id, user2_id_num, isNaN: isNaN(user2_id_num) });
        return res.status(400).json({
          error: 'ID du second utilisateur requis et doit être un nombre valide',
          details: `Reçu: ${user2_id} (type: ${typeof user2_id})`,
          debug: { user2_id, user2_id_num }
        });
      }

      // Vérifier que l'utilisateur cible existe
      const { data: targetUser, error: userCheckError } = await supabaseClient
        .from('users')
        .select('id')
        .eq('id', user2_id_num)
        .single();

      if (userCheckError || !targetUser) {
        console.error('❌ Utilisateur cible non trouvé:', user2_id_num);
        return res.status(404).json({ error: 'Utilisateur destinataire non trouvé' });
      }

      // Ensure consistent order for unique constraint
      const [p1, p2] = [user1_id, user2_id_num].sort((a, b) => a - b);

      console.log(`🔍 Recherche conversation entre ${p1} et ${p2}`);

      // Try to find existing direct conversation - utiliser user1_id et user2_id
      ({ data: conversation, error } = await supabaseClient
        .from('conversations')
        .select('*')
        .eq('type', 'direct')
        .eq('user1_id', p1)
        .eq('user2_id', p2)
        .single());

      if (error && error.code !== 'PGRST116') { // PGRST116 means 'no rows found'
        console.error('❌ Erreur recherche conversation:', error);
        throw error;
      }

      // If not found, create new direct conversation
      if (!conversation) {
        console.log(`➕ Création nouvelle conversation entre ${p1} et ${p2}`);
        ({ data: conversation, error } = await supabaseClient
          .from('conversations')
          .insert({ type: 'direct', user1_id: p1, user2_id: p2, created_at: new Date().toISOString() })
          .select('*')
          .single());
        if (error) {
          console.error('❌ Erreur création conversation:', error);
          throw error;
        }
        console.log('✅ Conversation créée:', conversation.id);
      } else {
        console.log('✅ Conversation existante trouvée:', conversation.id);
      }
    } else if (type === 'forum') {
      if (!forum_category_id) {
        return res.status(400).json({ error: 'ID de catégorie de forum requis pour conversation de forum' });
      }
      // Try to find existing forum conversation
      ({ data: conversation, error } = await supabaseClient
        .from('conversations')
        .select('*')
        .eq('type', 'forum')
        .eq('forum_category_id', forum_category_id)
        .single());

      if (error && error.code !== 'PGRST116') { // PGRST116 means 'no rows found'
        throw error;
      }

      // If not found, create new forum conversation
      if (!conversation) {
        ({ data: conversation, error } = await supabaseClient
          .from('conversations')
          .insert({ type: 'forum', forum_category_id: forum_category_id })
          .select('*')
          .single());
        if (error) throw error;
      }
    } else {
      return res.status(400).json({ error: 'Type de conversation invalide' });
    }

    return res.json({ success: true, conversation });
  } catch (error) {
    console.error('Erreur trouver/créer conversation:', error);
    return res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// Récupérer les derniers messages de toutes les conversations
app.get('/api/conversations/last-messages', authenticateToken, async (req, res) => {
  try {
    if (!supabaseClient) {
      return res.status(500).json({ error: 'Supabase non configuré' });
    }

    const userId = Number(req.user.id);

    // Récupérer toutes les conversations de l'utilisateur
    const { data: conversations, error: convError } = await supabaseClient
      .from('conversations')
      .select('id, user1_id, user2_id')
      .eq('type', 'direct')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (convError) {
      console.error('❌ Erreur récupération conversations:', convError);
      return res.status(500).json({ error: 'Erreur récupération conversations' });
    }

    if (!conversations || conversations.length === 0) {
      return res.json({ success: true, lastMessages: [] });
    }

    // Pour chaque conversation, récupérer le dernier message
    const lastMessages = [];

    for (const conv of conversations) {
      const { data: messages, error: msgError } = await supabaseClient
        .from('messages')
        .select('id, content, created_at, sender_user_id')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!msgError && messages && messages.length > 0) {
        const lastMsg = messages[0];
        // Déterminer l'ID du contact (l'autre personne dans la conversation)
        const contactId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;

        lastMessages.push({
          contact_id: contactId,
          content: lastMsg.content,
          created_at: lastMsg.created_at,
          is_from_me: lastMsg.sender_user_id === userId
        });
      }
    }

    return res.json({ success: true, lastMessages });
  } catch (error) {
    console.error('Erreur récupération derniers messages:', error);
    return res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// Envoyer un message
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    if (!supabaseClient) {
      return res.status(500).json({ error: 'Supabase non configuré' });
    }

    const { conversation_id, recipient_id, content, message_type = 'text' } = req.body;
    const userId = Number(req.user.id);
    const userUuid = req.user.auth_uuid;

    let convId = conversation_id;
    // Compatibilité front: si recipient_id est fourni, créer/trouver une conversation directe
    if (!convId && recipient_id) {
      // Récupérer l'uuid auth du destinataire
      const { data: recipientUser, error: recipientErr } = await supabaseClient
        .from('users')
        .select('id, auth_uuid')
        .eq('id', Number(recipient_id))
        .single();
      if (recipientErr || !recipientUser) {
        return res.status(400).json({ error: 'Destinataire invalide' });
      }
      const recipientUuid = recipientUser.auth_uuid;

      // Chercher une conversation directe existante entre les deux UUID
      let foundConv = null;
      try {
        const { data: convs, error: convErr } = await supabaseClient
          .from('conversations')
          .select('id')
          .eq('type', 'direct')
          .limit(200);
        if (!convErr && convs && convs.length) {
          for (const c of convs) {
            const { data: parts } = await supabaseClient
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', c.id);
            const ids = (parts || []).map(p => p.user_id);
            if (ids.includes(userUuid) && ids.includes(recipientUuid) && ids.length === 2) {
              foundConv = c.id;
              break;
            }
          }
        }
      } catch { }

      if (!foundConv) {
        // Créer la conversation et ajouter les participants
        const { data: newConv, error: createConvErr } = await supabaseClient
          .from('conversations')
          .insert({ type: 'direct', created_by: userUuid })
          .select('id')
          .single();
        if (createConvErr) return res.status(500).json({ error: 'Création conversation échouée' });

        const convIdNew = newConv.id;
        const { error: partErr1 } = await supabaseClient
          .from('conversation_participants')
          .insert({ conversation_id: convIdNew, user_id: userUuid });
        const { error: partErr2 } = await supabaseClient
          .from('conversation_participants')
          .insert({ conversation_id: convIdNew, user_id: recipientUuid });
        if (partErr1 || partErr2) return res.status(500).json({ error: 'Ajout participants échoué' });
        convId = convIdNew;
      } else {
        convId = foundConv;
      }
    }

    if (!convId) {
      return res.status(400).json({ error: 'ID de conversation ou destinataire requis' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Contenu du message requis' });
    }

    console.log(`📤 Envoi message - Conversation: ${convId}, User: ${userId}, Type: ${message_type}`);

    // Insérer le message dans la base de données
    const { data: message, error } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: convId,
        content: content.trim(),
        message_type,
        sender_id: userUuid,
        sender_user_id: userId,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      console.error('❌ Erreur insertion message:', error);
      throw error;
    }

    console.log('✅ Message envoyé:', message.id);

    // Mettre à jour la date de dernière activité de la conversation
    await supabaseClient
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId);

    // Diffuser en temps réel aux clients WebSocket
    try {
      broadcastRealtime({
        type: 'message', payload: {
          id: message.id,
          conversation_id: message.conversation_id,
          content: message.content,
          message_type: message.message_type,
          sender_id: message.sender_id,
          sender_user_id: message.sender_user_id,
          created_at: message.created_at
        }
      });
    } catch (e) {
      console.warn('Broadcast message failed:', e?.message);
    }

    return res.json({ success: true, message });
  } catch (error) {
    console.error('Erreur envoi message:', error);
    return res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// Récupérer les messages d'une conversation
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    if (!supabaseClient) {
      return res.status(500).json({ error: 'Supabase non configuré' });
    }

    const { conversation_id } = req.query;
    const userUuid = req.user.auth_uuid;

    if (!conversation_id) {
      // Compat: retourner les messages récents de l'utilisateur (toutes conversations)
      // Récupérer les conversations où l'utilisateur est participant
      try {
        const { data: parts, error: partsErr } = await supabaseClient
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', userUuid);
        if (partsErr) {
          console.warn('conversation_participants error:', partsErr.message);
          // fallback: retourner 0 message si la table n'existe pas
          return res.json({ success: true, messages: [] });
        }
        const convIds = (parts || []).map(p => p.conversation_id);
        if (convIds.length === 0) return res.json({ success: true, messages: [] });

        // Récupérer les derniers messages de ces conversations
        const { data: msgs, error: msgsErr } = await supabaseClient
          .from('messages')
          .select('*')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(100);
        if (msgsErr) {
          console.warn('messages list error:', msgsErr.message);
          return res.json({ success: true, messages: [] });
        }
        return res.json({ success: true, messages: msgs || [] });
      } catch (e) {
        console.warn('GET /api/messages fallback:', e?.message);
        return res.json({ success: true, messages: [] });
      }
    }

    console.log(`📬 Récupération messages - Conversation: ${conversation_id}`);

    // Récupérer tous les messages de la conversation
    const { data: messages, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Erreur récupération messages:', error);
      throw error;
    }

    console.log(`✅ ${messages?.length || 0} messages récupérés`);

    return res.json({ success: true, messages: messages || [] });
  } catch (error) {
    console.error('Erreur récupération messages:', error);
    return res.status(500).json({ error: 'Erreur serveur', details: error.message });
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

// ===== FORUM ENDPOINTS =====
// Liste des catégories de forum (table optionnelle, sinon valeurs par défaut)
app.get('/api/forum/categories', async (req, res) => {
  try {
    let categories = [];
    try {
      const { data, error } = await supabaseClient
        .from('forum_categories')
        .select('id, name, description, icon, order_index')
        .order('order_index', { ascending: true });
      if (!error && Array.isArray(data)) categories = data;
    } catch { }

    if (!categories || categories.length === 0) {
      categories = [
        { id: 'general', name: 'Général', description: 'Discussions générales', icon: '💬' },
        { id: 'annonces', name: 'Annonces', description: 'Informations officielles', icon: '📢' },
        { id: 'entraide', name: 'Entraide', description: 'Aide et conseils', icon: '🤝' }
      ];
    }
    return res.json({ success: true, categories });
  } catch (e) {
    console.error('Erreur /api/forum/categories:', e);
    return res.status(200).json({ success: true, categories: [] });
  }
});

// Récupérer messages d'une catégorie de forum (utilise conversations type=forum)
app.get('/api/forum/messages', authenticateToken, async (req, res) => {
  try {
    const categoryId = String(req.query.category_id || '').trim();
    if (!categoryId) return res.status(400).json({ success: false, error: 'category_id requis' });

    // Trouver ou créer la conversation forum
    let convId = null;
    try {
      const { data: conv, error: convErr } = await supabaseClient
        .from('conversations')
        .select('id')
        .eq('type', 'forum')
        .eq('name', categoryId)
        .single();
      if (!convErr && conv) convId = conv.id;
    } catch { }
    if (!convId) {
      const { data: newConv, error: createErr } = await supabaseClient
        .from('conversations')
        .insert({ type: 'forum', name: categoryId, created_by: req.user.auth_uuid || null })
        .select('id')
        .single();
      if (createErr) return res.json({ success: true, messages: [] });
      convId = newConv.id;
    }

    const { data: messages, error: msgsErr } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    if (msgsErr) return res.json({ success: true, messages: [] });
    return res.json({ success: true, conversation_id: convId, messages: messages || [] });
  } catch (e) {
    console.error('Erreur /api/forum/messages:', e);
    return res.status(200).json({ success: true, messages: [] });
  }
});

// Envoyer message forum
app.post('/api/forum/messages', authenticateToken, async (req, res) => {
  try {
    const { category_id, content } = req.body || {};
    if (!category_id || !content || !String(content).trim()) {
      return res.status(400).json({ success: false, error: 'category_id et content requis' });
    }
    const userId = Number(req.user.id);
    const userUuid = req.user.auth_uuid;

    // Trouver ou créer conversation forum
    let convId = null;
    try {
      const { data: conv, error: convErr } = await supabaseClient
        .from('conversations')
        .select('id')
        .eq('type', 'forum')
        .eq('name', category_id)
        .single();
      if (!convErr && conv) convId = conv.id;
    } catch { }
    if (!convId) {
      const { data: newConv } = await supabaseClient
        .from('conversations')
        .insert({ type: 'forum', name: category_id, created_by: userUuid })
        .select('id')
        .single();
      convId = newConv?.id;
    }
    if (!convId) return res.status(500).json({ success: false, error: 'conversation forum introuvable' });

    // Insérer message
    const { data: message, error } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: convId,
        content: String(content).trim(),
        message_type: 'text',
        sender_id: userUuid,
        sender_user_id: userId,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();
    if (error) throw error;

    // Broadcast temps réel
    try {
      broadcastRealtime({
        type: 'message', payload: {
          id: message.id,
          conversation_id: message.conversation_id,
          content: message.content,
          message_type: message.message_type,
          sender_id: message.sender_id,
          sender_user_id: message.sender_user_id,
          created_at: message.created_at
        }
      });
    } catch { }

    return res.json({ success: true, message, conversation_id: convId });
  } catch (e) {
    console.error('Erreur POST /api/forum/messages:', e);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
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

// ===== PERMISSIONS ENDPOINTS =====
// GET /api/permissions - Récupérer les demandes de permission
app.get('/api/permissions', authenticateToken, async (req, res) => {
  try {
    if (!supabaseClient) {
      return res.status(500).json({ success: false, error: 'Supabase non configuré' });
    }

    const requesterId = Number(req.user?.id);
    const isPrivileged = isPrivilegedRequest(req);
    const status = req.query.status; // Filtrer par statut si fourni

    console.log('GET /api/permissions - Débogage:', {
      requesterId,
      isPrivileged,
      status,
      userRole: req.user?.role
    });

    // Essayer de récupérer les permissions
    let query = supabaseClient
      .from('permissions')
      .select('*')
      .order('created_at', { ascending: false });

    // Si l'utilisateur n'est pas privilégié, ne montrer que ses propres permissions
    if (!isPrivileged) {
      query = query.eq('agent_id', requesterId);
      console.log('Filtrage permissions pour agent:', requesterId);
    } else {
      console.log('Récupération de toutes les permissions (utilisateur privilégié)');
    }

    // Filtrer par statut si fourni
    if (status && status !== 'all') {
      query = query.eq('status', status);
      console.log('Filtrage par statut:', status);
    }

    // Essayer d'exécuter la requête avec gestion d'erreur complète
    let data = null;
    let error = null;

    try {
      const result = await query;
      data = result.data;
      error = result.error;

      console.log('Résultat permissions:', {
        totalFound: data?.length || 0,
        hasError: !!error,
        sampleData: data?.slice(0, 2) || []
      });
    } catch (queryError) {
      // Capturer les erreurs lancées par Supabase
      error = queryError;
      console.error('Erreur requête permissions:', queryError);
    }

    // Gérer toutes les erreurs possibles (table manquante, relation manquante, etc.)
    if (error) {
      const errorCode = String(error.code || '');
      const errorMessage = String(error.message || '');
      const errorDetails = String(error.details || '');

      // Vérifier tous les types d'erreurs possibles
      const isTableOrRelationError =
        isMissingTable(error) ||
        errorCode === 'PGRST200' ||
        errorCode === 'PGRST205' ||
        errorCode === '42P01' ||
        errorMessage.toLowerCase().includes('could not find') ||
        errorMessage.toLowerCase().includes('relationship') ||
        errorMessage.toLowerCase().includes('schema cache') ||
        errorMessage.toLowerCase().includes('does not exist') ||
        errorDetails.toLowerCase().includes('relationship') ||
        errorDetails.toLowerCase().includes('schema cache');

      if (isTableOrRelationError) {
        console.warn('Table permissions non trouvée ou relation manquante, retour d\'un tableau vide:', {
          code: errorCode,
          message: errorMessage,
          details: errorDetails
        });
        return res.json({ success: true, permissions: [] });
      }

      // Si ce n'est pas une erreur de table/relation, la logger et la relancer
      console.error('Erreur API permissions (GET) - erreur non gérée:', {
        code: errorCode,
        message: errorMessage,
        details: errorDetails,
        error: error
      });
      throw error;
    }

    // Enrichir avec les données utilisateurs
    let enrichedPermissions = data || [];
    if (enrichedPermissions.length > 0) {
      const agentIds = [...new Set(enrichedPermissions.map(p => p.agent_id).filter(Boolean))];

      // Récupérer les utilisateurs seulement s'il y a des IDs valides
      if (agentIds.length > 0) {
        try {
          const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('id, name, first_name, last_name, email, project_name')
            .in('id', agentIds);

          if (!usersError && users && users.length > 0) {
            const usersMap = new Map();
            users.forEach(user => {
              usersMap.set(user.id, user);
            });

            enrichedPermissions = enrichedPermissions.map(perm => ({
              ...perm,
              agent: usersMap.get(perm.agent_id) || null
            }));
          } else {
            // Si erreur lors de la récupération des users, continuer sans enrichir
            enrichedPermissions = enrichedPermissions.map(perm => ({
              ...perm,
              agent: null
            }));
          }
        } catch (userFetchError) {
          console.warn('Erreur lors de la récupération des utilisateurs pour enrichir les permissions:', userFetchError);
          // Continuer sans enrichir en cas d'erreur
          enrichedPermissions = enrichedPermissions.map(perm => ({
            ...perm,
            agent: null
          }));
        }
      } else {
        // Pas d'IDs utilisateurs, retourner sans enrichir
        enrichedPermissions = enrichedPermissions.map(perm => ({
          ...perm,
          agent: null
        }));
      }
    }

    console.log(`✅ API permissions (GET): ${enrichedPermissions.length} permission(s) retournée(s)`);
    if (enrichedPermissions.length > 0) {
      console.log('📋 Exemple de permission retournée:', {
        id: enrichedPermissions[0].id,
        agent_id: enrichedPermissions[0].agent_id,
        has_agent: !!enrichedPermissions[0].agent,
        status: enrichedPermissions[0].status
      });
    }
    res.json({ success: true, permissions: enrichedPermissions });
  } catch (error) {
    console.error('Erreur API permissions (GET) dans le catch:', error);

    // Vérifier à nouveau si c'est une erreur de table/relation manquante
    const errorCode = String(error.code || '');
    const errorMessage = String(error.message || '');
    const errorDetails = String(error.details || '');

    const isTableOrRelationError =
      isMissingTable(error) ||
      errorCode === 'PGRST200' ||
      errorCode === 'PGRST205' ||
      errorCode === '42P01' ||
      errorMessage.toLowerCase().includes('could not find') ||
      errorMessage.toLowerCase().includes('relationship') ||
      errorMessage.toLowerCase().includes('schema cache') ||
      errorMessage.toLowerCase().includes('does not exist') ||
      errorDetails.toLowerCase().includes('relationship') ||
      errorDetails.toLowerCase().includes('schema cache');

    if (isTableOrRelationError) {
      console.warn('Erreur de table/relation dans le catch, retour d\'un tableau vide:', {
        code: errorCode,
        message: errorMessage,
        details: errorDetails
      });
      return res.json({ success: true, permissions: [] });
    }

    res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

// POST /api/permissions - Créer une nouvelle demande de permission
app.post('/api/permissions', authenticateToken, upload.single('justification'), async (req, res) => {
  try {
    if (!supabaseClient) {
      return res.status(500).json({ success: false, error: 'Supabase non configuré' });
    }

    const requesterId = Number(req.user?.id);
    const { start_date, end_date, status = 'pending', reason, agent_id } = req.body || {};

    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, error: 'start_date et end_date sont requis' });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ success: false, error: 'La date de fin doit être supérieure ou égale à la date de début' });
    }

    // Déterminer pour quel agent la demande est créée
    const isPrivileged = isPrivilegedRequest(req);
    let targetAgentId = requesterId;
    if (isPrivileged && agent_id !== undefined && agent_id !== null && agent_id !== '') {
      const parsedAgentId = Number(agent_id);
      if (Number.isFinite(parsedAgentId) && parsedAgentId > 0) {
        targetAgentId = parsedAgentId;
      }
    }

    // Gérer l'upload de la pièce justificative (stockée éventuellement dans Supabase Storage)
    let proofUrl = null;
    if (req.file && supabaseClient) {
      try {
        const fileExt = (req.file.originalname || '').split('.').pop() || 'bin';
        const fileName = `proofs/permission_${targetAgentId}_${Date.now()}.${fileExt}`;

        const { data: storageResult, error: storageError } = await supabaseClient.storage
          .from('presence-files')
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype || 'application/octet-stream',
            upsert: false
          });

        if (storageError) {
          console.error('Erreur lors de l’upload de la pièce justificative:', storageError);
        } else if (storageResult && storageResult.path) {
          // Construire l'URL publique (en supposant le bucket public ou via getPublicUrl)
          const { data: publicUrlData } = supabaseClient
            .storage
            .from('presence-files')
            .getPublicUrl(storageResult.path);

          proofUrl = publicUrlData?.publicUrl || null;
        }
      } catch (uploadErr) {
        console.error('Exception lors de l’upload de la pièce justificative:', uploadErr);
      }
    }

    const permissionData = {
      agent_id: targetAgentId,
      start_date,
      end_date,
      status,
      rejection_reason: reason || null,
      proof_url: proofUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertedData, error } = await supabaseClient
      .from('permissions')
      .insert([permissionData])
      .select('*')
      .single();

    if (error && isMissingTable(error)) {
      return res.status(404).json({ success: false, error: 'Table permissions non trouvée' });
    }

    if (error) throw error;

    // Enrichir avec les données utilisateur
    let data = insertedData;
    if (data && data.agent_id) {
      const { data: user, error: userError } = await supabaseClient
        .from('users')
        .select('id, name, first_name, last_name, email, project_name')
        .eq('id', data.agent_id)
        .single();

      if (!userError && user) {
        data = {
          ...data,
          agent: user
        };
      }
    }

    res.json({ success: true, permission: data });
  } catch (error) {
    console.error('Erreur API permissions (POST):', error);
    res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

// PUT /api/permissions/:id - Mettre à jour une demande de permission
app.put('/api/permissions/:id', authenticateToken, async (req, res) => {
  try {
    if (!supabaseClient) {
      return res.status(500).json({ success: false, error: 'Supabase non configuré' });
    }

    const permissionId = Number(req.params.id);
    const requesterId = Number(req.user?.id);
    const isPrivileged = isPrivilegedRequest(req);
    const { start_date, end_date, status, reason } = req.body;

    if (!Number.isFinite(permissionId)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }

    // Vérifier que la permission existe et que l'utilisateur a le droit de la modifier
    const { data: existing, error: fetchError } = await supabaseClient
      .from('permissions')
      .select('agent_id, status')
      .eq('id', permissionId)
      .single();

    if (fetchError && isMissingTable(fetchError)) {
      return res.status(404).json({ success: false, error: 'Table permissions non trouvée' });
    }

    if (fetchError || !existing) {
      return res.status(404).json({ success: false, error: 'Permission non trouvée' });
    }

    // Vérifier les droits d'accès
    if (!isPrivileged && Number(existing.agent_id) !== requesterId) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Construire l'objet de mise à jour
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (start_date) updateData.start_date = start_date;
    if (end_date) updateData.end_date = end_date;
    if (status) updateData.status = status;
    if (reason !== undefined) updateData.rejection_reason = reason;

    // Vérifier les dates si fournies
    const finalStartDate = updateData.start_date || existing.start_date;
    const finalEndDate = updateData.end_date || existing.end_date;
    if (new Date(finalEndDate) < new Date(finalStartDate)) {
      return res.status(400).json({ success: false, error: 'La date de fin doit être supérieure ou égale à la date de début' });
    }

    const { data: updatedData, error } = await supabaseClient
      .from('permissions')
      .update(updateData)
      .eq('id', permissionId)
      .select('*')
      .single();

    if (error && isMissingTable(error)) {
      return res.status(404).json({ success: false, error: 'Table permissions non trouvée' });
    }

    if (error) throw error;

    // Enrichir avec les données utilisateur
    let data = updatedData;
    if (data && data.agent_id) {
      const { data: user, error: userError } = await supabaseClient
        .from('users')
        .select('id, name, first_name, last_name, email, project_name')
        .eq('id', data.agent_id)
        .single();

      if (!userError && user) {
        data = {
          ...data,
          agent: user
        };
      }
    }

    res.json({ success: true, permission: data });
  } catch (error) {
    console.error('Erreur API permissions (PUT):', error);
    res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

// DELETE /api/permissions/:id - Supprimer une demande de permission
app.delete('/api/permissions/:id', authenticateToken, async (req, res) => {
  try {
    if (!supabaseClient) {
      return res.status(500).json({ success: false, error: 'Supabase non configuré' });
    }

    const permissionId = Number(req.params.id);
    const requesterId = Number(req.user?.id);
    const isPrivileged = isPrivilegedRequest(req);

    if (!Number.isFinite(permissionId)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }

    // Vérifier que la permission existe et que l'utilisateur a le droit de la supprimer
    const { data: existing, error: fetchError } = await supabaseClient
      .from('permissions')
      .select('agent_id')
      .eq('id', permissionId)
      .single();

    if (fetchError && isMissingTable(fetchError)) {
      return res.status(404).json({ success: false, error: 'Table permissions non trouvée' });
    }

    if (fetchError || !existing) {
      return res.status(404).json({ success: false, error: 'Permission non trouvée' });
    }

    // Vérifier les droits d'accès (seulement si draft ou pending pour les agents)
    if (!isPrivileged) {
      if (Number(existing.agent_id) !== requesterId) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }
    }

    const { error } = await supabaseClient
      .from('permissions')
      .delete()
      .eq('id', permissionId);

    if (error) throw error;

    res.json({ success: true, message: 'Permission supprimée avec succès' });
  } catch (error) {
    console.error('Erreur API permissions (DELETE):', error);
    res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

// PUT /api/permissions/:id/approve - Approuver une demande de permission
app.put('/api/permissions/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (!isPrivilegedRequest(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    if (!supabaseClient) {
      return res.status(500).json({ success: false, error: 'Supabase non configuré' });
    }

    const permissionId = Number(req.params.id);
    if (!Number.isFinite(permissionId)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }

    const { data: updatedData, error } = await supabaseClient
      .from('permissions')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', permissionId)
      .select('*')
      .single();

    if (error && isMissingTable(error)) {
      return res.status(404).json({ success: false, error: 'Table permissions non trouvée' });
    }

    if (error) throw error;

    // Enrichir avec les données utilisateur
    let data = updatedData;
    if (data && data.agent_id) {
      const { data: user, error: userError } = await supabaseClient
        .from('users')
        .select('id, name, first_name, last_name, email, project_name')
        .eq('id', data.agent_id)
        .single();

      if (!userError && user) {
        data = {
          ...data,
          agent: user
        };
      }
    }

    if (error && isMissingTable(error)) {
      return res.status(404).json({ success: false, error: 'Table permissions non trouvée' });
    }

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Permission non trouvée' });
    }

    res.json({ success: true, permission: data });
  } catch (error) {
    console.error('Erreur API permissions (APPROVE):', error);
    res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

// PUT /api/permissions/:id/reject - Rejeter une demande de permission
app.put('/api/permissions/:id/reject', authenticateToken, async (req, res) => {
  try {
    if (!isPrivilegedRequest(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    if (!supabaseClient) {
      return res.status(500).json({ success: false, error: 'Supabase non configuré' });
    }

    const permissionId = Number(req.params.id);
    const { reason, rejection_reason } = req.body;
    const rejectionReason = reason || rejection_reason;

    if (!Number.isFinite(permissionId)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }

    if (!rejectionReason || !String(rejectionReason).trim()) {
      return res.status(400).json({ success: false, error: 'Le motif de rejet est obligatoire' });
    }

    const { data: updatedData, error } = await supabaseClient
      .from('permissions')
      .update({
        status: 'rejected',
        rejection_reason: String(rejectionReason).trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', permissionId)
      .select('*')
      .single();

    if (error && isMissingTable(error)) {
      return res.status(404).json({ success: false, error: 'Table permissions non trouvée' });
    }

    if (error) throw error;

    // Enrichir avec les données utilisateur
    let data = updatedData;
    if (data && data.agent_id) {
      const { data: user, error: userError } = await supabaseClient
        .from('users')
        .select('id, name, first_name, last_name, email, project_name')
        .eq('id', data.agent_id)
        .single();

      if (!userError && user) {
        data = {
          ...data,
          agent: user
        };
      }
    }

    if (error && isMissingTable(error)) {
      return res.status(404).json({ success: false, error: 'Table permissions non trouvée' });
    }

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Permission non trouvée' });
    }

    res.json({ success: true, permission: data });
  } catch (error) {
    console.error('Erreur API permissions (REJECT):', error);
    res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

// Helper function to ensure we always have a valid date range
function ensureDateRange(record) {
  // If we have both start_date and end_date, ensure they're valid
  if (record.start_date && record.end_date) {
    const start = new Date(record.start_date);
    const end = new Date(record.end_date);

    // If end_date is before start_date, swap them
    if (end < start) {
      [record.start_date, record.end_date] = [record.end_date, record.start_date];
    }

    // Calculate days if not set
    if (!record.days) {
      const diffTime = Math.abs(end - start);
      record.days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    }

    // Ensure month is set
    if (!record.month && record.start_date) {
      record.month = record.start_date.substring(0, 7); // YYYY-MM format
    }
  }
  // If we have month but no dates, set default dates
  else if (record.month) {
    const monthStart = new Date(record.month + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    record.start_date = monthStart.toISOString().split('T')[0];
    record.end_date = monthEnd.toISOString().split('T')[0];

    // Calculate days if not set
    if (!record.days) {
      const diffTime = Math.abs(monthEnd - monthStart);
      record.days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  return record;
}

// GET /api/permission-days - Get permission days for a user
app.get('/api/permission-days', authenticateToken, async (req, res) => {
  try {
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    const requesterId = req.user?.id;
    const isPrivileged = isPrivilegedRequest(req);
    const agentId = req.query.agent_id;
    const month = req.query.month ? normalizeMonthValue(req.query.month) : null;

    // Determine target agent ID
    let targetAgentId = agentId || requesterId;

    // Authorization check
    if (!isPrivileged && agentId && agentId !== requesterId) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    if (!targetAgentId) {
      return res.status(400).json({ success: false, error: 'Agent ID manquant' });
    }

    // Convert the ID to UUID if needed
    const userId = await getUserId(targetAgentId);
    if (!userId) {
      return res.status(404).json({
        success: false,
        error: `Utilisateur avec l'ID ${targetAgentId} non trouvé`,
        details: process.env.NODE_ENV === 'development' ? `ID type: ${typeof targetAgentId}` : undefined
      });
    }

    // Use the resolved UUID
    targetAgentId = userId;

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);

    // First, check if the table exists
    const { data: tableInfo, error: tableError } = await supabaseClient
      .rpc('table_exists', { table_name: 'permission_days' });

    if (tableError || !tableInfo) {
      console.warn('Table permission_days non trouvée, retour d\'un tableau vide');
      return res.json({ success: true, data: [] });
    }

    // Get the table columns to determine the schema
    const { data: columns, error: columnsError } = await supabaseClient
      .rpc('get_columns', { table_name: 'permission_days' });

    if (columnsError) {
      console.error('Erreur lors de la récupération des colonnes:', columnsError);
      return res.status(500).json({ success: false, error: 'Erreur de configuration de la base de données' });
    }

    const hasDaysColumn = columns.some(col => col.column_name === 'days');
    const hasStartDateColumn = columns.some(col => col.column_name === 'start_date');

    // Build the base query
    let query = supabaseClient
      .from('permission_days')
      .select('*')
      .eq('user_id', targetAgentId);

    // Only order by start_date if the column exists
    if (hasStartDateColumn) {
      query = query.order('start_date', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Apply month filter if provided
    if (month) {
      query = query.eq('month', month);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching permission days:', error);
      if (isMissingTable(error)) {
        // If table doesn't exist, return empty array
        return res.json({ success: true, data: [] });
      }
      throw error;
    }

    // Transform and validate data
    const transformedData = [];

    for (const item of data || []) {
      try {
        // Ensure we have all required fields
        const record = {
          id: item.id,
          user_id: item.user_id,
          month: item.month || null,
          days: item.days ? parseInt(item.days, 10) : null,
          start_date: item.start_date || null,
          end_date: item.end_date || null,
          reason: item.reason || null,
          status: item.status || 'pending',
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
          created_by: item.created_by || null,
          approved_by: item.approved_by || null
        };

        // Ensure we have valid dates and calculated fields
        const validatedRecord = ensureDateRange(record);
        transformedData.push(validatedRecord);
      } catch (err) {
        console.error('Error processing permission day record:', err);
        // Skip invalid records
        continue;
      }
    }

    res.json({
      success: true,
      data: transformedData,
      count: transformedData.length
    });
  } catch (error) {
    console.error('Error in GET /api/permission-days:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        query: req.query
      } : undefined
    });
  }
});

/**
 * POST /api/permission-days - Crée ou met à jour des jours de permission
 * Nécessite un token JWT valide et des privilèges d'administration
 */
app.post('/api/permission-days', authenticateToken, async (req, res) => {
  const requestId = 'req_' + Math.random().toString(36).substr(2, 9);

  const log = (message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      requestId,
      ...data
    };
    console.log(`[${timestamp}] [${requestId}] ${message}`, JSON.stringify(logData, null, 2));
  };

  // Réponse d'erreur standardisée
  const sendError = (status, message, errorDetails = {}) => {
    log(`❌ Erreur ${status}: ${message}`, errorDetails);
    return res.status(status).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && { details: errorDetails })
    });
  };

  log('🔵 Début du traitement de la requête', {
    method: 'POST',
    url: '/api/permission-days',
    body: req.body
  });

  try {
    log('🔵 Début du traitement de la requête', {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      user: req.user ? { id: req.user.id, role: req.user.role } : 'non authentifié'
    });

    // Vérification des privilèges
    log('🔍 Vérification des privilèges...');
    if (!isPrivilegedRequest(req)) {
      return sendError(403, 'Accès refusé. Privilèges insuffisants.', {
        user: req.user ? { id: req.user.id, role: req.user.role } : 'non authentifié'
      });
    }

    // Vérification du client Supabase
    log('🔍 Vérification du client Supabase...');
    if (!supabaseClient) {
      return sendError(500, 'Erreur serveur: client Supabase non initialisé');
    }

    // Extraction et validation des données de la requête
    log('🔍 Extraction des données de la requête...');
    const {
      id,
      agent_id,
      user_id,
      month,
      days,
      start_date,
      end_date,
      reason = 'Jours de permission',
      status = 'pending',
      ...rest
    } = req.body || {};

    log('📦 Données extraites', {
      id,
      agent_id,
      user_id,
      month,
      days,
      start_date,
      end_date,
      reason,
      status
    });

    // Validation de l'utilisateur authentifié
    if (!req.user?.id) {
      return sendError(401, 'Erreur d\'authentification: token invalide', {
        hasUser: !!req.user,
        userId: req.user?.id
      });
    }

    // Récupération de l'UUID de l'utilisateur authentifié
    log('🔄 Récupération des informations de l\'utilisateur authentifié...');
    let authenticatedUserUuid;
    try {
      authenticatedUserUuid = await getUserId(req.user.id);
      log('✅ Utilisateur authentifié', {
        id: req.user.id,
        uuid: authenticatedUserUuid,
        role: req.user.role
      });
    } catch (authError) {
      log('❌ Erreur lors de la récupération de l\'utilisateur authentifié', {
        error: authError.message,
        userId: req.user.id
      });
      return res.status(400).json({
        success: false,
        error: 'Erreur d\'authentification: ' + authError.message
      });
    }

    // Détermination de l'ID de l'utilisateur cible
    const targetUserId = user_id || agent_id;
    if (!targetUserId) {
      return sendError(400, 'ID utilisateur cible requis (user_id ou agent_id)');
    }
    log('🎯 ID utilisateur cible fourni', { targetUserId });

    // Récupération de l'UUID de l'utilisateur cible
    log('🔄 Résolution de l\'ID utilisateur cible...');
    let targetUserUuid;
    try {
      targetUserUuid = await getUserId(targetUserId);
      log('✅ Utilisateur cible résolu', {
        input: targetUserId,
        uuid: targetUserUuid
      });
    } catch (userError) {
      return sendError(404, `Utilisateur non trouvé: ${userError.message}`, {
        targetUserId,
        error: userError.message
      });
    }

    // Validation et calcul des dates
    let startDate = start_date;
    let endDate = end_date;

    // Validation du format du mois si fourni (YYYY-MM)
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return sendError(400, 'Format de mois invalide. Utilisez le format YYYY-MM.', {
        monthProvided: month,
        expectedFormat: 'YYYY-MM'
      });
    }

    // Si le mois est fourni mais pas la date de début, utiliser le premier jour du mois
    if (month && !startDate) {
      startDate = `${month}-01`;
      log('📅 Date de début déduite du mois', { month, startDate });
    } else if (!startDate && !endDate) {
      // Si aucune date n'est fournie, utiliser aujourd'hui
      startDate = new Date().toISOString().split('T')[0];
      endDate = startDate;
      log('📅 Aucune date fournie, utilisation de la date du jour', { startDate, endDate });
    }

    // Si le nombre de jours est fourni mais pas la date de fin, la calculer
    if (startDate && days && !endDate) {
      try {
        const date = new Date(startDate);
        if (isNaN(date.getTime())) {
          throw new Error(`Date de début invalide: ${startDate}`);
        }

        // S'assurer que days est un nombre valide
        const daysNum = parseInt(days, 10);
        if (isNaN(daysNum) || daysNum < 1) {
          throw new Error(`Nombre de jours invalide: ${days}`);
        }

        // Calculer la date de fin (début + jours - 1)
        date.setDate(date.getDate() + (daysNum - 1));
        endDate = date.toISOString().split('T')[0];

        log('📅 Date de fin calculée', {
          startDate,
          days: daysNum,
          endDate
        });

      } catch (dateError) {
        return sendError(400, 'Format de date ou de nombre de jours invalide', {
          error: dateError.message,
          startDate,
          days,
          endDate
        });
      }
    }

    // Si la date de fin est fournie mais pas la date de début, utiliser la même date
    if (endDate && !startDate) {
      startDate = endDate;
      log('📅 Date de début définie comme date de fin', { startDate, endDate });
    }

    // S'assurer que les dates sont valides
    let startDateObj, endDateObj;
    try {
      startDateObj = new Date(startDate);
      endDateObj = new Date(endDate || startDate);

      if (isNaN(startDateObj.getTime())) {
        throw new Error(`Date de début invalide: ${startDate}`);
      }
      if (isNaN(endDateObj.getTime())) {
        throw new Error(`Date de fin invalide: ${endDate}`);
      }

      // Vérifier que la date de début est avant ou égale à la date de fin
      if (startDateObj > endDateObj) {
        throw new Error('La date de début doit être antérieure ou égale à la date de fin');
      }

      // Formater les dates au format YYYY-MM-DD
      startDate = startDateObj.toISOString().split('T')[0];
      endDate = endDateObj.toISOString().split('T')[0];

    } catch (dateError) {
      return sendError(400, dateError.message, {
        startDate,
        endDate,
        error: dateError.message
      });
    }



    // Validation du nombre de jours
    let daysCount = 1;
    if (days) {
      daysCount = parseInt(days, 10);
      if (isNaN(daysCount) || daysCount < 1) {
        return sendError(400, 'Le nombre de jours doit être un entier positif', {
          daysProvided: days,
          daysParsed: daysCount
        });
      }

      // Vérifier la cohérence entre les dates et le nombre de jours
      const diffTime = Math.abs(endDateObj - startDateObj);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 pour inclure le premier jour

      if (diffDays !== daysCount) {
        log('⚠️ Incohérence détectée entre les dates et le nombre de jours', {
          startDate,
          endDate,
          daysProvided: daysCount,
          daysCalculated: diffDays
        });

        // Mettre à jour le nombre de jours pour refléter la réalité des dates
        daysCount = diffDays;
        log('ℹ️ Nombre de jours ajusté pour correspondre aux dates', { daysCount });
      }
    }

    // Création du payload pour la base de données
    const payload = {
      user_id: targetUserUuid,
      month: month || startDate.substring(0, 7), // Format YYYY-MM
      days: daysCount,
      start_date: startDate,
      end_date: endDate,
      reason: reason,
      status: status,
      created_by: authenticatedUserUuid,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Si c'est une mise à jour, inclure l'ID
    if (id) {
      payload.id = id;
      log('🔄 Préparation de la mise à jour', { permissionId: id });
    } else {
      log('➕ Préparation de la création d\'une nouvelle entrée');
    }

    // Validation finale du payload
    if (!payload.user_id) {
      return sendError(400, 'ID utilisateur manquant', { payload });
    }

    if (!payload.start_date || !payload.end_date) {
      return sendError(400, 'Dates de début et de fin requises', { payload });
    }

    if (payload.days < 1) {
      return sendError(400, 'Le nombre de jours doit être supérieur à 0', { payload });
    }

    log('📦 Payload pour Supabase', payload);

    try {
      // Vérifier d'abord si l'utilisateur existe
      log('🔍 Vérification de l\'existence de l\'utilisateur cible...');
      const { data: userCheck, error: userCheckError } = await supabaseClient
        .from('users')
        .select('id')
        .eq('id', targetUserUuid)
        .single();

      if (userCheckError || !userCheck) {
        return sendError(404, 'L\'utilisateur spécifié n\'existe pas', {
          targetUserId,
          targetUserUuid,
          error: userCheckError?.message || 'Utilisateur non trouvé'
        });
      }

      // Vérifier les conflits de dates
      log('🔍 Vérification des conflits de dates...');
      const { data: conflicts, error: conflictError } = await supabaseClient
        .from('permission_days')
        .select('id, start_date, end_date')
        .eq('user_id', targetUserUuid)
        .not('id', 'eq', id || '')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

      if (conflictError) {
        log('⚠️ Erreur lors de la vérification des conflits', {
          error: conflictError.message
        });
      } else if (conflicts && conflicts.length > 0) {
        return sendError(409, 'Conflit de dates avec une autre période de permission existante', {
          conflicts,
          requested: { startDate, endDate }
        });
      }

      // Construction de la requête d'upsert
      log('⚡ Préparation de la requête d\'upsert...');
      const query = supabaseClient
        .from('permission_days')
        .upsert(payload, {
          onConflict: 'id',
          returning: 'representation'
        });

      log('⚡ Exécution de la requête...');
      const { data, error } = await query.select().single();

      if (error) {
        // Gestion des erreurs spécifiques
        let errorMessage = 'Erreur lors de l\'enregistrement dans la base de données';
        let statusCode = 500;

        switch (error.code) {
          case '23503': // foreign_key_violation
            statusCode = 400;
            if (error.message.includes('user_id')) {
              errorMessage = 'L\'utilisateur spécifié n\'existe pas';
            } else if (error.message.includes('created_by')) {
              errorMessage = 'Erreur d\'authentification';
              statusCode = 401;
            } else {
              errorMessage = 'Violation de contrainte de clé étrangère';
            }
            break;

          case '23505': // unique_violation
            statusCode = 409;
            errorMessage = 'Une entrée similaire existe déjà pour cette période';
            break;

          case '22P02': // invalid_text_representation
            statusCode = 400;
            errorMessage = 'Format de données invalide';
            break;

          case '23514': // check_violation
            statusCode = 400;
            errorMessage = 'Données invalides: ' + (error.message || 'contrainte non respectée');
            break;

          default:
            // Utiliser le message d'erreur de la base de données si disponible
            if (error.message) {
              errorMessage = error.message;
            }
        }

        return sendError(statusCode, errorMessage, {
          code: error.code,
          hint: error.hint,
          details: error.details,
          ...(process.env.NODE_ENV === 'development' && {
            message: error.message,
            stack: error.stack
          })
        });
      }

      log('✅ Permission enregistrée avec succès', {
        id: data.id,
        user_id: data.user_id,
        status: data.status,
        start_date: data.start_date,
        end_date: data.end_date,
        days: data.days
      });

      // Récupérer les données complètes pour la réponse
      log('🔍 Récupération des données complètes...');
      let fullData = null;
      const { data: fetchedData, error: fetchError } = await supabaseClient
        .from('permission_days')
        .select('*')
        .eq('id', data.id)
        .single();

      if (fetchError || !fetchedData) {
        log('⚠️ Impossible de récupérer les données complètes, utilisation des données partielles', {
          error: fetchError?.message || 'Données non trouvées'
        });
        // Utiliser les données partielles si la récupération échoue
        fullData = data;
      } else {
        fullData = fetchedData;
      }

      // Formatage de la réponse
      const responseData = {
        id: fullData.id,
        user_id: fullData.user_id,
        month: fullData.month || (fullData.start_date ? fullData.start_date.substring(0, 7) : null),
        days: fullData.days || 1,
        start_date: fullData.start_date,
        end_date: fullData.end_date,
        reason: fullData.reason || 'Jours de permission',
        status: fullData.status || 'pending',
        created_at: fullData.created_at,
        updated_at: fullData.updated_at || new Date().toISOString(),
        created_by: fullData.created_by
      };

      log('📤 Envoi de la réponse', {
        success: true,
        permissionId: responseData.id,
        userId: responseData.user_id,
        period: `${responseData.start_date} - ${responseData.end_date}`
      });

      return res.json({
        success: true,
        data: responseData
      });

    } catch (error) {
      // Gestion des erreurs inattendues
      const errorId = `err_${Math.random().toString(36).substr(2, 9)}`;
      const errorDetails = {
        errorId,
        name: error.name,
        message: error.message,
        code: error.code,
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack,
          payload,
          targetUserId,
          targetUserUuid,
          authenticatedUserUuid
        })
      };

      log(`❌ [${errorId}] Erreur inattendue lors de l'enregistrement`, errorDetails);

      return sendError(500, 'Une erreur inattendue est survenue lors de l\'enregistrement', {
        errorId,
        ...(process.env.NODE_ENV === 'development' && {
          details: errorDetails
        })
      });
    }

  } catch (error) {
    // Gestion des erreurs globales de la route
    const errorId = `global_${Math.random().toString(36).substr(2, 9)}`;
    const errorDetails = {
      errorId,
      name: error.name,
      message: error.message,
      code: error.code,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        request: {
          method: req.method,
          url: req.originalUrl,
          headers: req.headers,
          body: req.body
        },
        user: req.user ? {
          id: req.user.id,
          role: req.user.role,
          email: req.user.email
        } : 'non authentifié'
      })
    };

    log(`❌ [${errorId}] Erreur inattendue dans /api/permission-days`, errorDetails);

    res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement de la demande',
      errorId,
      ...(process.env.NODE_ENV === 'development' && {
        details: errorDetails
      })
    });

    // En production, vous pourriez vouloir logger cette erreur dans un service externe
    if (process.env.NODE_ENV === 'production') {
      // Exemple: envoyer l'erreur à un service de suivi comme Sentry
      // Sentry.captureException(error, { extra: { requestId, ... } });
    }
  }
});

app.put('/api/permission-days/:id', authenticateToken, async (req, res) => {
  try {
    if (!isPrivilegedRequest(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    const permissionId = req.params.id;
    if (!permissionId) {
      return res.status(400).json({ success: false, error: 'ID de permission requis' });
    }

    // Get the table columns to determine the schema
    const { data: columns, error: columnsError } = await supabaseClient
      .rpc('get_columns', { table_name: 'permission_days' });

    if (columnsError) {
      console.error('Erreur lors de la récupération des colonnes:', columnsError);
      return res.status(500).json({ success: false, error: 'Erreur de configuration de la base de données' });
    }

    const hasDaysColumn = columns.some(col => col.column_name === 'days');
    const hasStartDateColumn = columns.some(col => col.column_name === 'start_date');

    // First, get the existing record to preserve any fields not in the update
    const { data: existingRecord, error: fetchError } = await supabaseClient
      .from('permission_days')
      .select('*')
      .eq('id', permissionId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // Not found
        return res.status(404).json({ success: false, error: 'Permission non trouvée' });
      }
      throw fetchError;
    }

    const {
      id, // Don't allow updating the ID
      agent_id,
      user_id,
      month,
      days,
      start_date,
      end_date,
      reason,
      status,
      ...rest
    } = req.body || {};

    // Build the update payload
    const updatePayload = {
      ...existingRecord,
      ...rest,
      updated_at: new Date().toISOString()
    };

    // Only update these fields if they are provided in the request
    if (reason !== undefined) updatePayload.reason = reason;
    if (status !== undefined) updatePayload.status = status;

    // Handle schema-specific fields
    if (hasStartDateColumn) {
      // New schema with start_date and end_date
      const startDate = start_date || updatePayload.start_date || new Date().toISOString().split('T')[0];
      let endDate = end_date || updatePayload.end_date || startDate;

      // If days is provided but end_date is not, calculate end_date
      if (days !== undefined && !end_date) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + (parseInt(days, 10) - 1));
        endDate = date.toISOString().split('T')[0];
      }

      updatePayload.start_date = startDate;
      updatePayload.end_date = endDate;

      // Keep month for backward compatibility if not provided
      if (month) {
        updatePayload.month = normalizeMonthValue(month) || startDate.substring(0, 7);
      } else if (!updatePayload.month) {
        updatePayload.month = startDate.substring(0, 7);
      }

      if (hasDaysColumn) {
        // Calculate days if not provided
        if (days === undefined) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          updatePayload.days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        } else {
          updatePayload.days = Math.max(0, parseInt(days, 10) || 0);
        }
      }
    } else if (hasDaysColumn) {
      // Old schema with month and days
      if (month !== undefined) {
        const effectiveMonth = normalizeMonthValue(month);
        if (!effectiveMonth) {
          return res.status(400).json({ success: false, error: 'Format de mois invalide' });
        }
        updatePayload.month = effectiveMonth;
      }

      if (days !== undefined) {
        updatePayload.days = Math.max(0, parseInt(days, 10) || 0);
      }

      // Ensure start_date and end_date are set for backward compatibility
      const effectiveMonth = updatePayload.month || new Date().toISOString().substring(0, 7);
      updatePayload.start_date = updatePayload.start_date || `${effectiveMonth}-01`;
      updatePayload.end_date = updatePayload.end_date || `${effectiveMonth}-${new Date(effectiveMonth).getDate()}`;
    }

    // Update the record in the database
    const { data: updatedRecord, error: updateError } = await supabaseClient
      .from('permission_days')
      .update(updatePayload)
      .eq('id', permissionId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Prepare the response data with all required fields
    const responseData = {
      id: updatedRecord.id,
      user_id: updatedRecord.user_id,
      month: updatedRecord.month || (updatedRecord.start_date ? updatedRecord.start_date.substring(0, 7) : null),
      days: updatedRecord.days || 1,
      start_date: updatedRecord.start_date || `${updatedRecord.month}-01`,
      end_date: updatedRecord.end_date || updatedRecord.start_date || `${updatedRecord.month}-01`,
      reason: updatedRecord.reason || null,
      status: updatedRecord.status || 'pending',
      created_at: updatedRecord.created_at,
      updated_at: updatedRecord.updated_at
    };

    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('Erreur API permission-days (PUT):', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// DELETE /api/permission-days/:id
app.delete('/api/permission-days/:id', authenticateToken, async (req, res) => {
  try {
    if (!isPrivilegedRequest(req)) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    const permissionId = Number(req.params.id);
    if (!Number.isFinite(permissionId)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }

    const { error } = await supabaseClient
      .from('permission_days')
      .delete()
      .eq('id', permissionId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur API permission-days (DELETE):', error);
    res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || '').trim();
    const status = String(req.query.status || '').trim();
    const sortBy = String(req.query.sortBy || 'name').trim();
    const sortDir = (String(req.query.sortDir || 'asc').toLowerCase() === 'desc') ? 'desc' : 'asc';

    // Vérifier si pagination est demandée
    const page = req.query.page ? Math.max(1, parseInt(req.query.page, 10)) : null;
    const limit = req.query.limit ? Math.max(1, Math.min(100, parseInt(req.query.limit, 10))) : null;

    if (!supabaseClient) {
      return res.status(500).json({ success: false, error: 'Supabase client not initialized' });
    }

    let query = supabaseClient
      .from('users')
      .select('id,auth_uuid,name,first_name,last_name,email,role,phone,departement,commune,arrondissement,village,project_name,status,photo_path,last_activity');

    if (search) {
      query = query.ilike('name', `%${search}%`).or(`email.ilike.%${search}%`);
    }
    if (role) {
      if (role.includes(',')) {
        const roles = role.split(',').map(r => r.trim());
        query = query.in('role', roles);
      } else {
        query = query.eq('role', role);
      }
    }
    if (status) query = query.eq('status', status);

    query = query.order(sortBy, { ascending: sortDir === 'asc' });

    // Appliquer la pagination seulement si demandée
    if (page && limit) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      // Compter le total pour la pagination
      let countQuery = supabaseClient.from('users').select('*', { count: 'exact', head: true });
      if (search) countQuery = countQuery.ilike('name', `%${search}%`).or(`email.ilike.%${search}%`);
      if (role) {
        if (role.includes(',')) {
          const roles = role.split(',').map(r => r.trim());
          countQuery = countQuery.in('role', roles);
        } else {
          countQuery = countQuery.eq('role', role);
        }
      }
      if (status) countQuery = countQuery.eq('status', status);

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      const { data, error } = await query;
      if (error) throw error;

      res.json({ success: true, items: data || [], total: count || 0, page, limit });
    } else {
      // Pas de pagination - retourner tous les utilisateurs
      const { data, error } = await query;
      if (error) throw error;

      res.json(data || []);
    }
  } catch (error) {
    console.error('Erreur users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/dashboard-filters', authenticateToken, async (req, res) => {
  try {
    const privileged = isPrivilegedRequest(req);
    const requesterId = Number(req.user?.id);

    let query = supabaseClient
      .from('users')
      .select('id, name, first_name, last_name, email, role, project_name, photo_path')
      .order('name', { ascending: true });

    // Pour les utilisateurs non privilégiés, ne montrer que leur propre profil
    // Pour les admins et superviseurs, montrer TOUS les utilisateurs
    if (!privileged && Number.isFinite(requesterId)) {
      query = query.eq('id', requesterId);
    } else if (privileged) {
      // Pour les privilégiés, ne pas filtrer - récupérer tous les utilisateurs
      // Optionnel: filtrer les utilisateurs inactifs si nécessaire
      // query = query.eq('status', 'active'); // Décommentez si vous avez un champ status
    }

    const { data, error } = await query;
    if (error) throw error;

    const normalizeDisplayName = (user) => {
      const composed = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
      if (composed) return composed;
      if (user.name && user.name.trim()) return user.name.trim();
      if (user.email) return user.email.split('@')[0];
      return `Utilisateur ${user.id}`;
    };

    const normalizeProject = (value) => {
      const raw = String(value || '').trim();
      return raw || 'Projet non attribué';
    };

    const normalizedUsers = (data || []).map(user => ({
      id: user.id,
      name: normalizeDisplayName(user),
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      role: String(user.role || 'agent').toLowerCase(),
      project_name: normalizeProject(user.project_name),
      photo_url: user.photo_path || ''
    }));

    const supervisorRoles = new Set(['superviseur', 'supervisor', 'manager', 'admin', 'administrateur']);
    const supervisors = normalizedUsers.filter(user => supervisorRoles.has(user.role));

    // Pour les utilisateurs privilégiés, récupérer TOUS les projets distincts depuis la base de données
    let allProjects = [];
    if (privileged) {
      try {
        const { data: projectsData, error: projectsError } = await supabaseClient
          .from('users')
          .select('project_name')
          .not('project_name', 'is', null);

        if (!projectsError && projectsData && Array.isArray(projectsData)) {
          allProjects = Array.from(
            new Set(
              projectsData
                .map(row => {
                  const project = String(row.project_name || '').trim();
                  return project && project !== 'Projet non attribué' && project !== 'Non attribué' ? project : null;
                })
                .filter(Boolean)
            )
          ).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
        }
      } catch (error) {
        console.warn('Erreur lors de la récupération de tous les projets:', error);
      }
    }

    // Si on n'a pas réussi à récupérer tous les projets ou si l'utilisateur n'est pas privilégié,
    // utiliser ceux des utilisateurs normalisés
    if (allProjects.length === 0) {
      allProjects = Array.from(
        new Set(
          normalizedUsers
            .map(user => {
              const project = String(user.project_name || '').trim();
              return project && project !== 'Projet non attribué' && project !== 'Non attribué' ? project : null;
            })
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    }

    const projects = allProjects;

    res.json({
      success: true,
      privileged,
      agents: normalizedUsers,
      supervisors,
      projects,
    });
  } catch (error) {
    console.error('Erreur dashboard/filters:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

app.get('/api/agents/monthly-report', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  let report = null;

  try {
    const query = req.query || {};
    const aiParam = query.ai ?? query.include_ai ?? query.includeAi ?? query.generate_ai;
    const includeAiSummary = typeof aiParam === 'undefined'
      ? true
      : ['1', 'true', 'yes', 'on'].includes(String(aiParam).toLowerCase());

    const agentId = query.agentId || query.agent_id;
    const monthValue = query.month || query.period;

    console.log('Génération rapport mensuel:', {
      agentId,
      monthValue,
      includeAiSummary,
      requesterId: req.user?.id,
      requesterRole: req.user?.role
    });

    // Tenter de générer le rapport complet
    try {
      // Utiliser la clé API de l'utilisateur si fournie, sinon celle du serveur
      const userApiKey = query.user_api_key;
      const geminiModel = query.gemini_model;

      report = await buildAgentMonthlyReport({
        supabaseClient,
        agentId,
        monthValue,
        includeAiSummary,
        geminiApiKey: userApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        geminiModel: geminiModel,
        requester: req.user
      });

      const duration = Date.now() - startTime;
      console.log(`Rapport mensuel généré avec succès en ${duration}ms:`, {
        agentId,
        monthValue,
        checkins: report?.dataSources?.checkins || 0,
        planifications: report?.dataSources?.planifications || 0,
        goals: report?.dataSources?.goals || 0
      });

      return res.json(report);
    } catch (buildError) {
      // Si la génération échoue, essayer de créer un rapport minimal
      console.error('Erreur lors de la génération du rapport complet:', {
        message: buildError.message,
        stack: buildError.stack,
        statusCode: buildError.statusCode,
        name: buildError.name,
        agentId,
        monthValue
      });

      // Si c'est une erreur d'authentification ou d'autorisation, la retourner directement
      if (buildError.statusCode === 401 || buildError.statusCode === 403 || buildError.statusCode === 404) {
        return res.status(buildError.statusCode).json({
          success: false,
          error: buildError.message || 'Erreur lors de la génération du rapport',
          details: process.env.NODE_ENV === 'development' ? buildError.stack : undefined
        });
      }

      // Pour les autres erreurs, essayer de créer un rapport minimal avec les données disponibles
      try {
        // Créer un contexte de mois simple
        let monthContext = null;
        if (monthValue && typeof monthValue === 'string' && /^\d{4}-\d{2}$/.test(monthValue)) {
          const [y, m] = monthValue.split('-').map(Number);
          if (y >= 2000 && m >= 1 && m <= 12) {
            const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
            const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
            const monthsFr = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
            monthContext = {
              value: monthValue,
              label: `${monthsFr[m - 1] || 'Mois'} ${y}`,
              startIso: start.toISOString(),
              endIso: end.toISOString()
            };
          }
        }

        if (monthContext && Number.isFinite(Number(agentId))) {
          // Récupérer au moins les informations de base de l'agent
          const { data: agent } = await supabaseClient
            .from('users')
            .select('id, name, first_name, last_name, email, role, project_name')
            .eq('id', Number(agentId))
            .single();

          if (agent) {
            // Essayer de générer au moins le classement du projet
            let projectRanking = [];
            try {
              const { buildProjectRanking } = require('./utils/monthlyReport');
              projectRanking = await buildProjectRanking(supabaseClient, Number(agentId), monthContext);
            } catch (rankingError) {
              console.warn('Erreur lors de la génération du classement minimal:', rankingError.message);
              projectRanking = [];
            }

            report = {
              success: true,
              meta: {
                agent: {
                  id: agent.id,
                  name: agent.name || [agent.first_name, agent.last_name].filter(Boolean).join(' ') || `Agent ${agent.id}`,
                  email: agent.email || null,
                  role: agent.role || 'agent',
                  project_name: agent.project_name || null
                },
                month: {
                  value: monthContext.value,
                  label: monthContext.label,
                  start: monthContext.startIso,
                  end: monthContext.endIso
                }
              },
              objectives: [],
              presence: { totalCheckins: 0, workedDays: 0, workingDays: 0, presenceRate: 0 },
              activities: { total: 0, breakdown: [], list: [], plannedDays: 0, totalPlannedHours: 0, validatedPlannedHours: 0, performance: {} },
              locations: [],
              photos: [],
              projectRanking, // Ajouter le classement même dans le rapport minimal
              comments: {
                aiSummary: null,
                aiSummaryStatus: 'error',
                aiModel: null,
                aiSummaryError: 'Erreur lors de la génération du rapport complet. Données partielles uniquement.',
                fallbackSummary: `${agent.name || 'Agent'} — Synthèse ${monthContext.label}. Données limitées en raison d'une erreur serveur.`,
                suggestions: ['Veuillez réessayer plus tard ou contacter le support si le problème persiste.']
              },
              dataSources: {
                goals: 0,
                checkins: 0,
                planifications: 0
              }
            };

            console.warn('Rapport minimal généré en raison d\'une erreur:', {
              agentId,
              monthValue,
              originalError: buildError.message
            });

            return res.json(report);
          }
        }
      } catch (fallbackError) {
        console.error('Erreur lors de la génération du rapport minimal:', fallbackError);
      }

      // Si même le rapport minimal échoue, retourner l'erreur originale
      return res.status(buildError.statusCode || 500).json({
        success: false,
        error: buildError.message || 'Erreur serveur lors de la génération du rapport. Veuillez réessayer.',
        details: process.env.NODE_ENV === 'development' ? buildError.stack : undefined
      });
    }
  } catch (error) {
    // Erreur inattendue au niveau du handler
    console.error('Erreur inattendue dans le handler monthly-report:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    return res.status(500).json({
      success: false,
      error: 'Erreur serveur inattendue lors de la génération du rapport. Veuillez réessayer.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.get('/api/agents', authenticateToken, async (req, res) => {
  try {
    const { search, role } = req.query || {};
    const privileged = isPrivilegedRequest(req);
    const requesterId = Number(req.user?.id);

    console.log(`📋 GET /api/agents - Requester ID: ${requesterId}, Privileged: ${privileged}, Search: ${search || 'none'}, Role: ${role || 'none'}`);

    let query = supabaseClient
      .from('users')
      .select('id, name, first_name, last_name, email, role, project_name, departement, commune, arrondissement, village, status, photo_path')
      .order('name', { ascending: true });

    if (search) {
      const sanitized = `%${search}%`;
      query = query.or(`name.ilike.${sanitized},email.ilike.${sanitized}`);
    }

    if (role) {
      query = query.eq('role', role);
    }

    if (!privileged && Number.isFinite(requesterId)) {
      query = query.eq('id', requesterId);
      console.log(`🔒 Non-privileged user, filtering to own ID: ${requesterId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    console.log(`✅ Agents récupérés: ${data?.length || 0} utilisateurs`);
    if (data && data.length > 0) {
      console.log(`📊 Premier agent: ID=${data[0].id}, Name="${data[0].name}", FirstName="${data[0].first_name}", LastName="${data[0].last_name}", Project="${data[0].project_name}"`);
    }

    res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('❌ Erreur API agents:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
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
    } catch { }
    if (!profileId) {
      // Créer/assurer le profil minimal pour récupérer un id
      try {
        const { data: created } = await supabaseClient
          .from('profiles')
          .upsert({ user_id: userId }, { onConflict: 'user_id' })
          .select('id')
          .single();
        if (created && created.id) profileId = created.id;
      } catch { }
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
        try { await supabaseClient.storage.createBucket('avatars', { public: true }); } catch { }
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
      try { fs.mkdirSync(avatarsDir, { recursive: true }); } catch { }
      const filePath = path.join(avatarsDir, keyName);
      fs.writeFileSync(filePath, buffer);
      const publicBase = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
      const relativePath = `/Media/uploads/avatars/${keyName}`;
      photoUrl = publicBase ? `${publicBase}${relativePath}` : relativePath;
    }

    // 4) Mettre à jour le chemin dans profiles et users
    try { await supabaseClient.from('profiles').update({ photo_path: photoUrl }).eq('user_id', userId); } catch { }
    try { await supabaseClient.from('users').update({ photo_path: photoUrl }).eq('id', userId); } catch { }

    return res.json({ success: true, photo_url: photoUrl });
  } catch (e) {
    console.error('Erreur upload photo profil (server.js):', e);
    return res.status(500).json({ success: false, message: 'Erreur lors du téléversement' });
  }
});

// ===== OFFLINE SYNC =====

// Endpoint pour synchroniser les checkins en cache depuis le client
app.post('/api/sync/offline-checkins', authenticateToken, async (req, res) => {
  try {
    const { checkins } = req.body || {};

    if (!Array.isArray(checkins) || checkins.length === 0) {
      return res.json({ success: true, message: 'Aucun checkin à synchroniser', synced: 0 });
    }

    console.log(`🔄 Synchronisation de ${checkins.length} checkins hors-ligne pour user ${req.user.id}...`);

    let syncedCount = 0;
    const errors = [];

    for (const checkin of checkins) {
      try {
        // Préparer les données pour Supabase
        const checkinData = {
          user_id: req.user.id,
          lat: Number(checkin.lat),
          lon: Number(checkin.lon),
          type: checkin.type || 'checkin',
          start_time: checkin.start_time || checkin.timestamp || new Date().toISOString(),
          accuracy: checkin.accuracy ? Number(checkin.accuracy) : null,
          note: checkin.note || null,
          photo_url: checkin.photo_url || checkin.photo_path || null,
          mission_id: checkin.mission_id || null
        };

        // Insérer dans Supabase
        const { data, error } = await supabaseClient
          .from('checkins')
          .insert([checkinData])
          .select()
          .single();

        if (error) {
          console.error(`❌ Erreur insertion checkin ${checkin.id || 'unknown'}:`, error);
          errors.push({ checkin: checkin.id || 'unknown', error: error.message });
        } else {
          console.log(`✅ Checkin synchronisé: ID ${data.id}`);
          syncedCount++;
        }
      } catch (e) {
        console.error(`❌ Erreur traitement checkin:`, e);
        errors.push({ checkin: checkin.id || 'unknown', error: e.message });
      }
    }

    console.log(`🎉 Synchronisation terminée: ${syncedCount}/${checkins.length} checkins synchronisés`);

    return res.json({
      success: true,
      message: `${syncedCount} checkins synchronisés avec succès`,
      synced: syncedCount,
      total: checkins.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Erreur générale synchronisation checkins:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la synchronisation',
      error: error.message
    });
  }
});

// Endpoint pour synchroniser les missions en attente (démarrage et fin)
app.post('/api/sync/pending-missions', authenticateToken, async (req, res) => {
  try {
    const { missions } = req.body || {};

    if (!Array.isArray(missions) || missions.length === 0) {
      return res.json({ success: true, message: 'Aucune mission à synchroniser', synced: 0 });
    }

    console.log(`🔄 Synchronisation de ${missions.length} mission(s) en attente pour user ${req.user.id}...`);

    let syncedCount = 0;
    const errors = [];
    const syncedMissions = [];

    for (const mission of missions) {
      try {
        const missionType = mission.type; // 'start' ou 'end'
        const missionData = mission.data || {};

        if (missionType === 'start') {
          // Démarrer une mission
          // Vérifier s'il y a déjà une mission active
          const { data: activeMission } = await supabaseClient
            .from('missions')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('status', 'active')
            .single();

          if (activeMission) {
            // Mission déjà active, utiliser celle-ci
            syncedMissions.push({ id: mission.id, missionId: activeMission.id, type: 'start' });
            syncedCount++;
            continue;
          }

          // Créer une nouvelle mission
          const { data: newMission, error: missionError } = await supabaseClient
            .from('missions')
            .insert([{
              user_id: req.user.id,
              status: 'active',
              start_time: missionData.captured_at || new Date().toISOString(),
              start_lat: missionData.lat ? Number(missionData.lat) : null,
              start_lon: missionData.lon ? Number(missionData.lon) : null
            }])
            .select()
            .single();

          if (missionError) {
            throw missionError;
          }

          // Créer le check-in de début
          const { error: checkinError } = await supabaseClient
            .from('checkins')
            .insert([{
              user_id: req.user.id,
              mission_id: newMission.id,
              lat: missionData.lat ? Number(missionData.lat) : null,
              lon: missionData.lon ? Number(missionData.lon) : null,
              type: 'checkin',
              start_time: missionData.captured_at || new Date().toISOString(),
              accuracy: missionData.accuracy ? Number(missionData.accuracy) : null,
              note: missionData.note || 'Début de mission (synchronisé)'
            }]);

          if (checkinError) {
            console.warn('Erreur création check-in:', checkinError);
          }

          syncedMissions.push({ id: mission.id, missionId: newMission.id, type: 'start' });
          syncedCount++;

        } else if (missionType === 'end') {
          // Terminer une mission
          const missionId = missionData.mission_id || null;

          if (!missionId) {
            // Essayer de trouver la mission active
            const { data: activeMission } = await supabaseClient
              .from('missions')
              .select('id')
              .eq('user_id', req.user.id)
              .eq('status', 'active')
              .single();

            if (!activeMission) {
              throw new Error('Aucune mission active trouvée');
            }

            const finalMissionId = activeMission.id;

            // Mettre à jour la mission
            const { error: updateError } = await supabaseClient
              .from('missions')
              .update({
                status: 'completed',
                end_time: new Date().toISOString(),
                end_lat: missionData.lat ? Number(missionData.lat) : null,
                end_lon: missionData.lon ? Number(missionData.lon) : null
              })
              .eq('id', finalMissionId);

            if (updateError) {
              throw updateError;
            }

            // Créer le check-in de fin
            const { error: checkinError } = await supabaseClient
              .from('checkins')
              .insert([{
                user_id: req.user.id,
                mission_id: finalMissionId,
                lat: missionData.lat ? Number(missionData.lat) : null,
                lon: missionData.lon ? Number(missionData.lon) : null,
                type: 'checkout',
                start_time: new Date().toISOString(),
                accuracy: missionData.accuracy ? Number(missionData.accuracy) : null,
                note: missionData.note || 'Fin de mission (synchronisé)'
              }]);

            if (checkinError) {
              console.warn('Erreur création check-in:', checkinError);
            }

            syncedMissions.push({ id: mission.id, missionId: finalMissionId, type: 'end' });
            syncedCount++;
          } else {
            // Mission ID fourni
            const { error: updateError } = await supabaseClient
              .from('missions')
              .update({
                status: 'completed',
                end_time: new Date().toISOString(),
                end_lat: missionData.lat ? Number(missionData.lat) : null,
                end_lon: missionData.lon ? Number(missionData.lon) : null
              })
              .eq('id', missionId)
              .eq('user_id', req.user.id);

            if (updateError) {
              throw updateError;
            }

            syncedMissions.push({ id: mission.id, missionId: missionId, type: 'end' });
            syncedCount++;
          }
        }
      } catch (e) {
        console.error(`❌ Erreur synchronisation mission ${mission.id || 'unknown'}:`, e);
        errors.push({ missionId: mission.id || 'unknown', type: mission.type, error: e.message });
      }
    }

    console.log(`🎉 Synchronisation terminée: ${syncedCount}/${missions.length} mission(s) synchronisée(s)`);

    return res.json({
      success: true,
      message: `${syncedCount} mission(s) synchronisée(s) avec succès`,
      synced: syncedCount,
      total: missions.length,
      syncedMissions: syncedMissions,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Erreur générale synchronisation missions:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la synchronisation',
      error: error.message
    });
  }
});

// Endpoint pour récupérer les checkins en cache depuis IndexedDB (via un script client)
app.get('/api/sync/get-offline-checkins', authenticateToken, async (req, res) => {
  try {
    // Cet endpoint retourne un script JavaScript qui sera exécuté côté client
    // pour récupérer les checkins depuis IndexedDB et les envoyer à /api/sync/offline-checkins

    const syncScript = `
(async function() {
  try {
    console.log('🔍 Récupération des checkins hors-ligne depuis IndexedDB...');
    
    // Ouvrir la base de données IndexedDB
    const dbName = 'offlineDB';
    const dbVersion = 1;
    
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('checkins')) {
          const store = db.createObjectStore('checkins', { keyPath: 'id', autoIncrement: true });
          store.createIndex('user_id', 'user_id', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };
    });
    
    // Récupérer tous les checkins non synchronisés
    const transaction = db.transaction(['checkins'], 'readonly');
    const store = transaction.objectStore('checkins');
    const index = store.index('synced');
    
    const checkins = await new Promise((resolve, reject) => {
      const request = index.getAll(false); // false = non synchronisés
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
    
    console.log(\`📊 Trouvé \${checkins.length} checkins non synchronisés\`);
    
    if (checkins.length > 0) {
      // Envoyer les checkins au serveur
      const response = await fetch('/api/sync/offline-checkins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('jwt')
        },
        body: JSON.stringify({ checkins })
      });
      
      const result = await response.json();
      console.log('📤 Résultat de la synchronisation:', result);
      
      // Marquer comme synchronisés si succès
      if (result.success && result.synced > 0) {
        const syncTransaction = db.transaction(['checkins'], 'readwrite');
        const syncStore = syncTransaction.objectStore('checkins');
        
        for (const checkin of checkins) {
          await new Promise((resolve, reject) => {
            const updateRequest = syncStore.put({ ...checkin, synced: true });
            updateRequest.onerror = () => reject(updateRequest.error);
            updateRequest.onsuccess = () => resolve();
          });
        }
        
        console.log(\`✅ \${result.synced} checkins marqués comme synchronisés\`);
      }
      
      return result;
    } else {
      console.log('ℹ️ Aucun checkin à synchroniser');
      return { success: true, message: 'Aucun checkin à synchroniser' };
    }
    
  } catch (error) {
    console.error('❌ Erreur synchronisation automatique:', error);
    return { success: false, error: error.message };
  }
})();
`;

    res.setHeader('Content-Type', 'application/javascript');
    res.send(syncScript);

  } catch (error) {
    console.error('❌ Erreur génération script sync:', error);
    res.status(500).json({ success: false, error: error.message });
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
      accuracy,
      note,
      photo_url,
      battery_level,
      network_type,
      device_info,
      start_time,
      mission_id,
      commune,
      arrondissement,
      village
    } = req.body || {};

    if (!lat || !lon) {
      return res.status(400).json({ success: false, message: 'Latitude et longitude requis' });
    }

    // Vérifier si l'agent a une planification pour ce jour
    const checkinTime = start_time || new Date().toISOString();
    const hasPlanification = await hasPlanificationForDay(req.user.id, checkinTime);
    if (!hasPlanification) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pas faire de check-in. Aucune planification trouvée pour ce jour. Veuillez d\'abord enregistrer votre planification quotidienne.',
        code: 'NO_PLANIFICATION_FOUND'
      });
    }

    // Vérifier que l'utilisateur existe
    const { data: userExists, error: userCheckError } = await supabaseClient
      .from('users')
      .select('id, name, role')
      .eq('id', req.user.id)
      .single();

    if (userCheckError || !userExists) {
      console.error('❌ Utilisateur inexistant pour checkin:', req.user.id);
      return res.status(400).json({
        success: false,
        message: 'Utilisateur non trouvé. Veuillez vous reconnecter avec vos vrais identifiants.'
      });
    }

    const row = {
      user_id: req.user.id,
      lat: Number(lat),
      lon: Number(lon),
      type: type || 'checkin',
      start_time: start_time ? new Date(start_time).toISOString() : new Date().toISOString(),
      end_time: null,
      accuracy: accuracy ? Number(accuracy) : null,
      note: note || null,
      photo_url: photo_url || null,
      battery_level: battery_level ? Number(battery_level) : null,
      network_type: network_type || null,
      device_info: {
        ...device_info,
        // Champs de compatibilité géographique stockés dans device_info
        commune: commune || null,
        arrondissement: arrondissement || null,
        village: village || null
      },
      mission_id: mission_id || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient.from('checkins').insert([row]).select().single();
    if (error) throw error;

    // Créer automatiquement une présence dans la table presences
    try {
      const presenceData = {
        user_id: req.user.id,
        start_time: row.start_time,
        end_time: null,
        location_lat: row.lat,
        location_lng: row.lon,
        location_name: commune || null,
        notes: row.note || 'Checkin mobile',
        photo_url: null,
        status: 'completed',
        checkin_type: type,
        created_at: row.start_time,
        zone_id: null,
        within_tolerance: true,
        distance_from_reference_m: null,
        tolerance_meters: 500
      };

      const { data: presenceResult, error: presenceError } = await supabaseClient
        .from('presences')
        .insert(presenceData)
        .select()
        .single();

      if (presenceError) {
        console.error('⚠️ Erreur création présence:', presenceError);
        // Ne pas échouer le checkin si la présence échoue
      } else {
        console.log('✅ Présence créée:', presenceResult.id);
      }
    } catch (presenceErr) {
      console.error('⚠️ Erreur traitement présence:', presenceErr);
      // Ne pas échouer le checkin si la présence échoue
    }

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
        id, mission_id, lat, lon, created_at, note, photo_url,
        missions!inner(id, agent_id, status, date_start, date_end,
          users!inner(id, email, name)
        )
      `)
      .order('created_at', { ascending: false })
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
        id, mission_id, lat, lon, created_at, note, photo_url,
        missions!inner(id, agent_id, status, date_start, date_end,
          users!inner(id, email, name)
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (from) {
      query = query.gte('created_at', from.toISOString());
    }
    if (to) {
      query = query.lte('created_at', to.toISOString());
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

// Récupérer les agents (auth facultative)
// - Admin/Superviseur (si token valide): liste complète enrichie
// - Autres / sans token: liste limitée (contacts) pour la messagerie
app.get('/api/admin/agents', async (req, res) => {
  try {
    // Décoder token si présent, sans bloquer
    let role = '';
    let userId = null;
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        role = decoded && decoded.role ? String(decoded.role).toLowerCase() : '';
        userId = decoded && decoded.id ? Number(decoded.id) : null;
      }
    } catch { }
    const isPrivileged = role === 'admin' || role === 'superviseur' || role === 'supervisor';

    if (isPrivileged) {
      const { data: agents, error } = await supabaseClient
        .from('users')
        .select('*, auth_uuid')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const enrichedAgents = (agents || []).map(agent => ({
        ...agent,
        auth_uuid: agent.auth_uuid || agent.auth_uuid,
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
      return res.json({ success: true, data: enrichedAgents });
    }

    // Agent standard: renvoyer des contacts minimaux (exclure soi-même)
    const { data: contacts, error: contactsErr } = await supabaseClient
      .from('users')
      .select('id, name, email, role, auth_uuid, phone, project_name, departement, commune, arrondissement, village')
      .neq('id', userId || -1)
      .order('name', { ascending: true })
      .limit(200);
    if (contactsErr) throw contactsErr;

    return res.json({ success: true, data: contacts || [] });
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
        .select('lat, lon, created_at')
        .eq('mission_id', m.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      if (checkErr || !firstCheck) continue;
      items.push({
        mission_id: m.id,
        agent_id: m.agent_id,
        agent_name: agentMap.get(m.agent_id) || 'Agent',
        lat: firstCheck.lat,
        lon: firstCheck.lon,
        timestamp: firstCheck.created_at,
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
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(refLat)) * Math.cos(toRad(latitude)) * Math.sin(dLon / 2) ** 2;
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
      .order('created_at', { ascending: false })
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
        .select('id, mission_id, lat, lon, created_at')
        .in('mission_id', missionIds)
        .order('created_at', { ascending: false })
        .limit(500);

      if (from) q = q.gte('created_at', new Date(String(from)).toISOString());
      if (to) q = q.lte('created_at', new Date(String(to)).toISOString());

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
        .select('id, lat, lon, created_at')
        .in('mission_id', missionIds)
        .order('created_at', { ascending: false })
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

// Alias pour compatibilité avec le frontend - /api/me/checkins
app.get('/api/me/checkins', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 /api/me/checkins appelé pour user:', req.user.id);

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

    const missionIds = (missions || []).map(m => m.id);
    console.log('Missions trouvées:', missionIds.length);

    if (missionIds.length === 0) {
      return res.json({ success: true, items: [] });
    }

    // 2) Récupérer les check-ins liés à ces missions
    let query = supabaseClient
      .from('checkins')
      .select('id, lat, lon, accuracy, address, created_at, mission_id, photo_url, notes, status')
      .in('mission_id', missionIds)
      .order('created_at', { ascending: false })
      .limit(500);

    // Appliquer les filtres de date si fournis
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        query = query.gte('created_at', fromDate.toISOString());
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        query = query.lte('created_at', toDate.toISOString());
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erreur requête checkins:', error);
      throw error;
    }

    console.log('Check-ins trouvés:', (data || []).length);
    return res.json({ success: true, items: data || [] });

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

    console.log(`🔍 Checkins mission ${missionId} demandé par user ${req.user.id} (role: ${req.user.role})`);

    // Vérifier accès: admin/superviseur ou mission appartenant à l'utilisateur
    let allowed = false;
    try {
      if (req.user && (req.user.role === 'admin' || req.user.role === 'supervisor' || req.user.role === 'superviseur')) {
        allowed = true;
        console.log(`✅ Accès autorisé pour ${req.user.role}`);
      } else {
        console.log(`🔍 Vérification propriété mission pour user ${req.user.id}`);
        const { data: m } = await supabaseClient
          .from('missions')
          .select('agent_id')
          .eq('id', missionId)
          .single();
        if (m && m.agent_id === req.user.id) {
          allowed = true;
          console.log(`✅ Mission appartient à l'utilisateur ${req.user.id}`);
        }
      }
    } catch (e) {
      console.error('❌ Erreur vérification accès:', e);
    }
    if (!allowed) {
      console.log(`❌ Accès refusé pour user ${req.user.id} (role: ${req.user.role})`);
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    // Utiliser seulement les colonnes essentielles pour éviter les erreurs
    console.log(`📊 Requête checkins pour mission ${missionId}`);
    let q = supabaseClient
      .from('checkins')
      .select('id, mission_id, lat, lon, created_at')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: false })
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
    } catch { }
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

// Note: Route /api/reports/validations est déjà définie plus haut dans le fichier
// Le code de la route a été déplacé plus haut dans le fichier pour éviter les doublons

// Vérifier si l'agent a une planification pour aujourd'hui
app.get('/api/planifications/today/check', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const hasPlanification = await hasPlanificationForDay(req.user.id, today);

    return res.json({
      success: true,
      has_planification: hasPlanification,
      date: today,
      message: hasPlanification ? 'Planification trouvée pour aujourd\'hui' : 'Aucune planification pour aujourd\'hui'
    });
  } catch (error) {
    console.error('Erreur vérification planification aujourd\'hui:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Vérifier si l'agent a une planification pour une date spécifique
app.get('/api/planifications/:date/check', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;

    // Valider le format de la date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Format de date invalide. Utilisez YYYY-MM-DD'
      });
    }

    const hasPlanification = await hasPlanificationForDay(req.user.id, date);

    return res.json({
      success: true,
      has_planification: hasPlanification,
      date: date,
      message: hasPlanification ? `Planification trouvée pour le ${date}` : `Aucune planification pour le ${date}`
    });
  } catch (error) {
    console.error('Erreur vérification planification date:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Vérifier si l'agent a une planification pour le jour donné
async function hasPlanificationForDay(userId, date) {
  try {
    const targetDate = new Date(date);
    const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log(`🔍 Vérification planification pour utilisateur ${userId} le ${dateStr}`);

    const { data: planification, error } = await supabaseClient
      .from('planifications')
      .select('id, description_activite, date')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .maybeSingle(); // maybeSingle() pour ne pas générer d'erreur si non trouvé

    if (error) {
      console.error('❌ Erreur vérification planification:', error);
      return false;
    }

    const hasPlanification = !!planification;
    console.log(`📋 Planification trouvée pour ${userId} le ${dateStr}: ${hasPlanification}`);

    if (hasPlanification) {
      console.log(`✅ Activité planifiée: ${planification.description_activite}`);
    } else {
      console.log(`⚠️ Aucune planification trouvée pour ${userId} le ${dateStr}`);
    }

    return hasPlanification;
  } catch (error) {
    console.error('❌ Erreur dans hasPlanificationForDay:', error);
    return false;
  }
}

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

    // Vérifier si l'agent a une planification pour ce jour
    const hasPlanification = await hasPlanificationForDay(userId, start_time);
    if (!hasPlanification) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pas commencer votre présence. Aucune planification trouvée pour ce jour. Veuillez d\'abord enregistrer votre planification quotidienne.',
        code: 'NO_PLANIFICATION_FOUND'
      });
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
          note: note || 'Début de mission',
          start_lat: latitude,
          start_lon: longitude
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
        try { await supabaseClient.storage.createBucket('photos', { public: true }); } catch { }
        const ts = Date.now();
        const key = `checkins/${userId}/${missionId || 'no_mission'}/start_${ts}.jpg`;
        const contentType = (req.file.mimetype && typeof req.file.mimetype === 'string') ? req.file.mimetype : 'image/jpeg';
        await supabaseClient.storage.from('photos').upload(key, req.file.buffer, { upsert: true, contentType });
        const { data: pub } = await supabaseClient.storage.from('photos').getPublicUrl(key);
        startPhotoUrl = pub && pub.publicUrl ? pub.publicUrl : null;
      }
    } catch { }

    // 3) Insérer le premier check-in lié à la mission (si mission créée) et enregistrer la validation
    let insertedCheckinId = null;
    const locationInfo = {
      departement: departement || null,
      commune: commune || null,
      arrondissement: arrondissement || null,
      village: village || null
    };
    try {
      const { data: chk, error: chkErr } = await supabaseClient
        .from('checkins')
        .insert([{
          mission_id: missionId,
          user_id: userId,
          lat: latitude,
          lon: longitude,
          note: note || 'Début de mission',
          photo_url: startPhotoUrl || null,
          start_time: start_time,
          ...locationInfo,
          device_info: locationInfo
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
        // Charger point de référence et tolérance (depuis users car profiles n'existe pas)
        const { data: userRef } = await supabaseClient
          .from('users')
          .select('reference_lat, reference_lon, tolerance_radius_meters')
          .eq('id', userId)
          .single();

        const refLat = userRef?.reference_lat ?? null;
        const refLon = userRef?.reference_lon ?? null;
        const tol = Number(userRef?.tolerance_radius_meters ?? 100);

        // Charger planification du jour
        const dayIso = new Date(start_time);
        const todayDate = `${dayIso.getFullYear()}-${String(dayIso.getMonth() + 1).padStart(2, '0')}-${String(dayIso.getDate()).padStart(2, '0')}`;
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
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(Number(refLat))) * Math.cos(toRad(latitude)) * Math.sin(dLon / 2) ** 2;
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

        // Insérer aussi dans la table presences
        try {
          await supabaseClient.from('presences').insert([{
            user_id: userId,
            start_time: start_time,
            end_time: plan?.planned_end_time || null,
            location_lat: latitude,
            location_lng: longitude,
            location_name: commune || village || departement || null,
            notes: note || 'Début de mission',
            photo_url: startPhotoUrl || null,
            status: 'completed',
            checkin_type: valid ? 'validated' : 'rejected',
            created_at: start_time,
            within_tolerance: valid,
            distance_from_reference_m: distance,
            tolerance_meters: tol
          }]);
        } catch (presenceError) {
          console.warn('Insertion dans presences échouée (non bloquant):', presenceError?.message);
        }
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

    // Vérifier si l'agent a une planification pour ce jour
    const hasPlanification = await hasPlanificationForDay(userId, end_time);
    if (!hasPlanification) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pas terminer votre présence. Aucune planification trouvée pour ce jour. Veuillez d\'abord enregistrer votre planification quotidienne.',
        code: 'NO_PLANIFICATION_FOUND'
      });
    }

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
      } catch { }
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
      } catch { }
    }
    if (!targetMissionId) {
      return res.status(404).json({ success: false, message: 'Aucune mission active' });
    }

    // Si une photo est fournie, l'uploader vers Supabase Storage et garder l'URL
    let endPhotoUrl = null;
    try {
      if (req.file && req.file.buffer && supabaseClient) {
        try { await supabaseClient.storage.createBucket('photos', { public: true }); } catch { }
        const ts = Date.now();
        const key = `checkins/${userId}/${targetMissionId || 'no_mission'}/end_${ts}.jpg`;
        const contentType = (req.file.mimetype && typeof req.file.mimetype === 'string') ? req.file.mimetype : 'image/jpeg';
        await supabaseClient.storage.from('photos').upload(key, req.file.buffer, { upsert: true, contentType });
        const { data: pub } = await supabaseClient.storage.from('photos').getPublicUrl(key);
        endPhotoUrl = pub && pub.publicUrl ? pub.publicUrl : null;
      }
    } catch { }

    // Clôturer la mission
    try {
      let upd = supabaseClient
        .from('missions')
        .update({
          date_end: end_time,
          status: 'completed',
          updated_at: new Date().toISOString(),
          end_lat: latitude,
          end_lon: longitude
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
          user_id: userId,
          lat: latitude,
          lon: longitude,
          note: note || 'Fin de mission',
          photo_url: endPhotoUrl || null,
          start_time: end_time
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
    } catch { }

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
        user_id: req.user.id,
        lat: latitude,
        lon: longitude,
        note: note || 'Fin de mission (forcée)',
        start_time: end_time
      }]);
    }

    return res.json({ success: true });
  } catch (e) {
    console.error('Erreur /api/missions/:id/complete:', e);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ===== FONCTIONS EMAIL =====

// Transport Gmail robuste avec SNI et fallback SSL465 -> STARTTLS587
async function createGmailTransport() {
  const nodemailerBase = {
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    connectionTimeout: 15000,
    socketTimeout: 20000,
    tls: { servername: (process.env.SMTP_HOST || 'smtp.gmail.com') }
  };

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';

  // 1) SSL implicite 465
  try {
    const t465 = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true',
      ...nodemailerBase
    });
    await t465.verify();
    return t465;
  } catch (_) {
    // 2) Fallback STARTTLS 587 + requireTLS
    const t587 = nodemailer.createTransport({
      host,
      port: 587,
      secure: false,
      requireTLS: true,
      ...nodemailerBase
    });
    await t587.verify();
    return t587;
  }
}

async function sendMailRobust(mailOptions) {
  const transient = new Set(['ETIMEDOUT', 'ESOCKET', 'ECONNECTION']);
  let transporter = await createGmailTransport();
  try {
    return await transporter.sendMail(mailOptions);
  } catch (e) {
    if (transient.has(e?.code)) {
      transporter = await createGmailTransport();
      return await transporter.sendMail(mailOptions);
    }
    throw e;
  }
}

// Fonction pour envoyer un email de récupération de mot de passe
async function sendRecoveryEmail(email, name, recoveryCode) {
  try {
    const transporter = await createGmailTransport();
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
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      connectionTimeout: 15000,
      socketTimeout: 20000
    });
    await transporter.verify();
    return res.json({ success: true, message: 'SMTP OK', user: process.env.EMAIL_USER });
  } catch (e) {
    console.error('SMTP verify error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'smtp_error' });
  }
});

// ===== ENDPOINTS MANQUANTS POUR MESSAGERIE =====

// Endpoint pour le statut en ligne des utilisateurs
app.get('/api/users/online', authenticateToken, async (req, res) => {
  try {
    const { data: users, error } = await supabaseClient
      .from('users')
      .select('id, name, email, last_seen, is_online')
      .eq('is_online', true)
      .order('last_seen', { ascending: false });

    if (error) throw error;

    res.json({ success: true, users: users || [] });
  } catch (error) {
    console.error('Erreur récupération utilisateurs en ligne:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Endpoint pour mettre à jour le statut en ligne
app.post('/api/users/online', authenticateToken, async (req, res) => {
  try {
    const { is_online } = req.body;

    const { error } = await supabaseClient
      .from('users')
      .update({
        is_online: is_online || false,
        last_seen: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur mise à jour statut en ligne:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Endpoint pour les catégories de forum
app.get('/api/forum/categories', authenticateToken, async (req, res) => {
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

    res.json({ success: true, categories });
  } catch (error) {
    console.error('Erreur récupération catégories forum:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Envoyer un email de test (admin uniquement)
app.post('/api/debug/email/send', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const to = (req.body && req.body.to) || process.env.SUPERADMIN_EMAIL || process.env.EMAIL_USER;
    const subject = (req.body && req.body.subject) || 'Test Email Presence CCR-B';
    const text = (req.body && req.body.text) || 'Ceci est un email de test.';
    await sendMailRobust({ from: process.env.EMAIL_USER, to, subject, text });
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

// ===== MISSING API ENDPOINTS =====

// Work zones endpoint - returns geographical data for presence forms
app.get('/api/work-zones', authenticateToken, async (req, res) => {
  try {
    // Return all geographical data needed for presence forms
    const [departements, communes, arrondissements, villages] = await Promise.all([
      supabaseClient.from('departements').select('id, nom').order('nom'),
      supabaseClient.from('communes').select('id, nom, departement_id').order('nom'),
      supabaseClient.from('arrondissements').select('id, nom, commune_id').order('nom'),
      supabaseClient.from('villages').select('id, nom, arrondissement_id').order('nom')
    ]);

    // Check for errors and fallback to empty arrays if tables don't exist
    const workZones = {
      departements: departements.error ? [] : (departements.data || []),
      communes: communes.error ? [] : (communes.data || []),
      arrondissements: arrondissements.error ? [] : (arrondissements.data || []),
      villages: villages.error ? [] : (villages.data || [])
    };

    res.json({ success: true, data: workZones });
  } catch (error) {
    console.error('Erreur API work-zones:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Contacts endpoint
app.get('/api/contacts', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id, name, first_name, last_name, email, phone, role, project_name, departement, commune')
      .in('role', ['agent', 'superviseur', 'supervisor'])
      .order('name', { ascending: true });

    if (error && !isMissingTable(error)) throw error;

    let contacts = Array.isArray(data) ? data : [];
    contacts = contacts.map(user => ({
      id: user.id,
      name: getUserDisplayName(user),
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'agent',
      project: user.project_name || null,
      departement: user.departement || null,
      commune: user.commune || null
    }));

    if (contacts.length === 0) {
      contacts = [
        {
          id: 'support',
          name: 'Support CCRB',
          email: 'support@ccrb.local',
          phone: '+229 01 96 91 13 46',
          role: 'support',
          project: null,
          departement: null,
          commune: null
        }
      ];
    }

    res.json(contacts);
  } catch (error) {
    console.error('Erreur API contacts:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Emergency contacts endpoint
app.get('/api/emergency-contacts', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('emergency_contacts')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erreur API emergency-contacts:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Help content endpoint
app.get('/api/help/content', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('help_content')
      .select('id, title, content, category')
      .order('title');

    // Handle missing table gracefully
    if (error && isMissingTable(error)) {
      console.warn('Table help_content non trouvée, utilisation des sections statiques');
      const sections = getStaticHelpSections();
      const structuredContent = {};
      sections.forEach((section, index) => {
        const key = section.id || `section-${index + 1}`;
        structuredContent[key] = {
          title: section.title,
          description: section.content,
          tips: [],
          shortcuts: []
        };
      });
      return res.json({ success: true, content: structuredContent, tutorials: [], faqs: [] });
    }

    if (error) throw error;

    let sections = Array.isArray(data) ? data : [];
    sections = sections.map(section => ({
      id: section.id,
      title: section.title || 'Section',
      content: section.content || '',
      category: section.category || 'general'
    }));

    if (sections.length === 0) {
      sections = getStaticHelpSections();
    }

    const structuredContent = {};
    sections.forEach((section, index) => {
      const key = section.id || `section-${index + 1}`;
      structuredContent[key] = {
        title: section.title,
        description: section.content,
        tips: [],
        shortcuts: []
      };
    });

    res.json({ success: true, content: structuredContent, tutorials: [], faqs: [] });
  } catch (error) {
    console.error('Erreur API help/content:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Missions endpoint
app.get('/api/missions', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('missions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erreur API missions:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// AI Summary endpoint pour le rapport mensuel
app.post('/api/generate-ai-summary', authenticateToken, async (req, res) => {
  try {
    const { type, reportData } = req.body;

    if (!reportData) {
      return res.status(400).json({ error: 'Données du rapport requises' });
    }

    // Générer un résumé basé sur les données du rapport
    let summary = '';

    if (type === 'concise') {
      summary = generateConciseSummary(reportData);
    } else if (type === 'detailed') {
      summary = generateDetailedSummary(reportData);
    } else {
      summary = generateStandardSummary(reportData);
    }

    res.json({
      success: true,
      summary: summary,
      type: type || 'standard'
    });

  } catch (error) {
    console.error('Erreur génération résumé IA:', error);
    res.status(500).json({ error: 'Erreur lors de la génération du résumé' });
  }
});

// Fonctions utilitaires pour générer les résumés
function generateConciseSummary(data) {
  const agent = data.agent || {};
  const presence = data.presence || {};
  const activities = data.activities?.performance || {};

  return `Rapport mensuel pour ${agent.name || 'Agent'} - ${data.period || 'Période'}:
• Présence: ${presence.presenceRate || 0}% (${presence.workedDays || 0} jours)
• Taux d'exécution: ${activities.executionRate || 0}%
• Activités réalisées: ${activities.realized || 0}
• Temps terrain: ${data.fieldTimeHours || 0}h

Performance globale: ${data.compositeScore || 0}/100`;
}

function generateDetailedSummary(data) {
  const agent = data.agent || {};
  const presence = data.presence || {};
  const activities = data.activities?.performance || {};

  return `Rapport mensuel détaillé - ${agent.name || 'Agent'}
Période: ${data.period || 'Non spécifiée'}

INDICATEURS DE PRÉSENCE:
- Taux de présence: ${presence.presenceRate || 0}%
- Jours travaillés: ${presence.workedDays || 0} / ${presence.workingDays || 0}
- Check-ins totaux: ${presence.totalCheckins || 0}
- Moyenne par jour: ${presence.averageCheckinsPerDay || 0}

PERFORMANCE ACTIVITÉS:
- Taux d'exécution: ${activities.executionRate || 0}%
- Activités réalisées: ${activities.realized || 0}
- Activités partiellement réalisées: ${activities.partiallyRealized || 0}
- Activités en cours: ${activities.inProgress || 0}

TEMPS TERRAIN:
- Total: ${data.fieldTimeHours || 0} heures
- Moyenne par jour: ${presence.avgFieldTimePerDay || 0} heures
- Missions: ${presence.missionsCount || 0}

ÉVALUATION GLOBALE:
Score composite: ${data.compositeScore || 0}/100
${data.compositeScore >= 80 ? 'Performance excellente' : data.compositeScore >= 60 ? 'Performance satisfaisante' : 'Performance à améliorer'}`;
}

function generateStandardSummary(data) {
  return generateConciseSummary(data) + `

Recommandations:
- Maintenir les efforts de présence régulière
- Améliorer le taux d'exécution des activités planifiées
- Optimiser le temps terrain pour une meilleure efficacité`;
}

// Analytics endpoints
app.get('/api/analytics/presence', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const days = clampDays(req.query.days, { fallback: 30, min: 7, max: 120 });
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const [presencesResult, absencesResult] = await Promise.all([
      supabaseClient
        .from('presences')
        .select('id, user_id, start_time, end_time, status, location_name, location_lat, location_lng, users(id, name, first_name, last_name, email)')
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true })
        .limit(5000),
      supabaseClient
        .from('absences')
        .select('id, user_id, date, reason, users(id, name, first_name, last_name, email)')
        .gte('date', isoDateOnly(startDate))
        .lte('date', isoDateOnly(endDate))
        .order('date', { ascending: true })
        .limit(2000)
    ]);

    if (presencesResult.error && !isMissingTable(presencesResult.error)) throw presencesResult.error;
    if (absencesResult.error && !isMissingTable(absencesResult.error)) throw absencesResult.error;

    const presences = Array.isArray(presencesResult.data) ? presencesResult.data : [];
    const absences = Array.isArray(absencesResult.data) ? absencesResult.data : [];

    const dataset = [];
    const presenceDays = new Set();

    presences.forEach(presence => {
      const dayKey = isoDateOnly(presence.start_time);
      if (dayKey) {
        presenceDays.add(dayKey);
      }
      dataset.push({
        id: `presence-${presence.id}`,
        user_id: presence.user_id,
        user_name: getUserDisplayName(presence.users),
        date: dayKey,
        type: 'arrival',
        timestamp: presence.start_time,
        present: true,
        status: presence.status || 'completed',
        location: presence.location_name || null,
        lat: presence.location_lat || null,
        lon: presence.location_lng || null,
        duration_hours: computeDurationHours(presence.start_time, presence.end_time) || null
      });

      if (presence.end_time) {
        dataset.push({
          id: `presence-${presence.id}-departure`,
          user_id: presence.user_id,
          user_name: getUserDisplayName(presence.users),
          date: isoDateOnly(presence.end_time) || dayKey,
          type: 'departure',
          timestamp: presence.end_time,
          present: true,
          status: presence.status || 'completed',
          location: presence.location_name || null,
          lat: presence.location_lat || null,
          lon: presence.location_lng || null
        });
      }
    });

    absences.forEach(absence => {
      dataset.push({
        id: `absence-${absence.id}`,
        user_id: absence.user_id,
        user_name: getUserDisplayName(absence.users),
        date: absence.date,
        type: 'absence',
        timestamp: absence.date ? `${absence.date}T12:00:00Z` : null,
        present: false,
        status: 'absence',
        reason: absence.reason || 'Absence déclarée'
      });
    });

    // Ajouter des entrées pour les jours sans présence détectée
    for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = cursor.toISOString().split('T')[0];
      if (!presenceDays.has(key)) {
        dataset.push({
          id: `absence-day-${key}`,
          user_id: null,
          user_name: 'Aucun agent',
          date: key,
          type: 'absence',
          timestamp: `${key}T00:00:00Z`,
          present: false,
          status: 'absence',
          reason: 'Aucune présence enregistrée'
        });
      }
    }

    dataset.sort((a, b) => {
      const timeA = new Date(a.timestamp || `${a.date || '1970-01-01'}T00:00:00Z`).getTime();
      const timeB = new Date(b.timestamp || `${b.date || '1970-01-01'}T00:00:00Z`).getTime();
      return timeA - timeB;
    });

    res.json(dataset);
  } catch (error) {
    console.error('Erreur API analytics/presence:', error);
    res.status(500).json([]);
  }
});

app.get('/api/analytics/missions', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const days = clampDays(req.query.days, { fallback: 60, min: 7, max: 180 });
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const { data, error } = await supabaseClient
      .from('missions')
      .select('id, agent_id, status, date_start, date_end, created_at, updated_at, total_distance_m')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(5000);

    if (error) throw error;

    const missions = Array.isArray(data) ? data : [];
    const dataset = missions.map(mission => {
      const start = mission.date_start || mission.created_at;
      const end = mission.date_end || mission.updated_at || start;
      return {
        id: mission.id,
        agent_id: mission.agent_id,
        status: mission.status || 'pending',
        start_time: start,
        end_time: end,
        date: isoDateOnly(start),
        duration_hours: computeDurationHours(start, end) || null,
        total_distance_m: mission.total_distance_m || null
      };
    });

    res.json(dataset);
  } catch (error) {
    console.error('Erreur API analytics/missions:', error);
    res.status(500).json([]);
  }
});

app.get('/api/analytics/performance', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const days = clampDays(req.query.days, { fallback: 30, min: 7, max: 120 });
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const [missionsResult, presencesResult] = await Promise.all([
      supabaseClient
        .from('missions')
        .select('id, status, date_start, date_end, created_at, updated_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })
        .limit(5000),
      supabaseClient
        .from('presences')
        .select('id, user_id, start_time, end_time, status')
        .gte('start_time', startDate.toISOString())
        .order('start_time', { ascending: true })
        .limit(5000)
    ]);

    if (missionsResult.error) throw missionsResult.error;
    if (presencesResult.error) throw presencesResult.error;

    const missions = Array.isArray(missionsResult.data) ? missionsResult.data : [];
    const presences = Array.isArray(presencesResult.data) ? presencesResult.data : [];

    const dailyMap = new Map();
    const ensureDay = (date) => {
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, hoursWorked: 0, missionsCompleted: 0, missionsTotal: 0, presenceCount: 0 });
      }
      return dailyMap.get(date);
    };

    presences.forEach(presence => {
      const day = isoDateOnly(presence.start_time);
      if (!day) return;
      const bucket = ensureDay(day);
      bucket.presenceCount += 1;
      bucket.hoursWorked += computeDurationHours(presence.start_time, presence.end_time) || 0;
    });

    missions.forEach(mission => {
      const day = isoDateOnly(mission.date_start || mission.created_at);
      if (!day) return;
      const bucket = ensureDay(day);
      bucket.missionsTotal += 1;
      if (['completed', 'realise', 'terminée', 'terminé'].includes(String(mission.status || '').toLowerCase())) {
        bucket.missionsCompleted += 1;
        bucket.hoursWorked += computeDurationHours(mission.date_start || mission.created_at, mission.date_end || mission.updated_at) || 0;
      }
    });

    // Garantir une entrée pour chaque jour de la période
    for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = cursor.toISOString().split('T')[0];
      ensureDay(key);
    }

    const maxPresence = Array.from(dailyMap.values()).reduce((acc, item) => Math.max(acc, item.presenceCount), 1);
    const sortedDays = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    const dataset = sortedDays.map(entry => {
      const attendanceRate = maxPresence > 0
        ? Math.round((entry.presenceCount / maxPresence) * 100)
        : 0;
      const missionSuccessRate = entry.missionsTotal > 0
        ? Math.round((entry.missionsCompleted / entry.missionsTotal) * 100)
        : 0;
      const value = Math.round(attendanceRate * 0.6 + missionSuccessRate * 0.4);

      return {
        date: entry.date,
        value,
        attendanceRate,
        missionSuccessRate,
        hoursWorked: Math.round(entry.hoursWorked * 10) / 10,
        missionsCompleted: entry.missionsCompleted,
        missionsTotal: entry.missionsTotal,
        presenceCount: entry.presenceCount
      };
    });

    res.json(dataset);
  } catch (error) {
    console.error('Erreur API analytics/performance:', error);
    res.status(500).json([]);
  }
});

// Agent achievements endpoint
app.get('/api/agent/achievements', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 /api/agent/achievements called with query:', req.query);

    // Get the agent ID from query params or the authenticated user
    const agentId = req.query.agent_id || req.user?.id;

    if (!agentId) {
      console.error('❌ No agent ID provided');
      return res.status(400).json({ success: false, error: 'Agent ID requis' });
    }

    console.log('🔢 Processing agent ID:', { agentId, type: typeof agentId });

    // Convert the ID to UUID if needed
    const userId = await getUserId(agentId);

    if (!userId) {
      console.error('❌ User not found for ID:', agentId);
      return res.status(404).json({
        success: false,
        error: `Utilisateur avec l'ID ${agentId} non trouvé`,
        details: process.env.NODE_ENV === 'development' ? `ID type: ${typeof agentId}` : undefined
      });
    }

    console.log('✅ Using user ID:', { originalId: agentId, resolvedId: userId });

    // Initialize empty arrays for each data type
    let checkins = [];
    let missions = [];
    let presences = [];

    // Try to fetch checkins if the table exists
    try {
      const { data: checkinsData, error: checkinsError } = await supabaseClient
        .from('checkins')
        .select('id, user_id, start_time, created_at, timestamp, mission_id')
        .eq('user_id', userId)  // Use the resolved UUID
        .order('created_at', { ascending: true })
        .limit(500);

      if (checkinsError && !isMissingTable(checkinsError)) {
        console.error('Error fetching checkins:', checkinsError);
      } else if (checkinsData) {
        checkins = checkinsData;
      }
    } catch (e) {
      console.error('Exception when fetching checkins:', e);
    }

    // Try to fetch missions if the table exists
    try {
      const { data: missionsData, error: missionsError } = await supabaseClient
        .from('missions')
        .select('id, status, date_start, date_end, created_at, agent_id')
        .eq('agent_id', agentId)  // Use the original integer ID
        .order('created_at', { ascending: true })
        .limit(500);

      if (missionsError && !isMissingTable(missionsError)) {
        console.error('Error fetching missions:', missionsError);
      } else if (missionsData) {
        missions = missionsData;
      }
    } catch (e) {
      console.error('Exception when fetching missions:', e);
    }

    // Try to fetch presences if the table exists
    try {
      const { data: presencesData, error: presencesError } = await supabaseClient
        .from('presences')
        .select('id, start_time, end_time, user_id')
        .eq('user_id', agentId)  // Use the original integer ID
        .order('start_time', { ascending: true })
        .limit(500);

      if (presencesError && !isMissingTable(presencesError)) {
        console.error('Error fetching presences:', presencesError);
      } else if (presencesData) {
        presences = presencesData;
      }
    } catch (e) {
      console.error('Exception when fetching presences:', e);
    }

    const achievements = [];
    const pushAchievement = (id, payload) => {
      if (!achievements.find(item => item.id === id)) {
        achievements.push({ id, ...payload });
      }
    };
    const firstCheckin = checkins[0];
    if (firstCheckin) {
      const date = firstCheckin.start_time || firstCheckin.created_at || firstCheckin.timestamp;
      pushAchievement('first-checkin', {
        title: 'Premier check-in',
        description: 'Vous avez enregistré votre première présence sur le terrain.',
        icon: '📍',
        date: date || new Date().toISOString()
      });
    }

    const totalCheckins = checkins.length;
    if (totalCheckins >= 5) {
      pushAchievement('checkins-5', {
        title: 'Routine installée',
        description: `Déjà ${totalCheckins} check-ins réalisés, continuez !`,
        icon: '✅',
        date: checkins[Math.min(4, totalCheckins - 1)].start_time || new Date().toISOString()
      });
    }
    if (totalCheckins >= 25) {
      pushAchievement('checkins-25', {
        title: 'Explorateur confirmé',
        description: `${totalCheckins} points de présence saisis.`,
        icon: '🧭',
        date: checkins[Math.min(24, totalCheckins - 1)].start_time || new Date().toISOString()
      });
    }

    const missionsCompleted = missions.filter(m => ['completed', 'realise', 'terminée'].includes(String(m.status || '').toLowerCase())).length;
    if (missionsCompleted >= 1) {
      pushAchievement('mission-first', {
        title: 'Première mission',
        description: 'Une mission a été clôturée avec succès.',
        icon: '🎯',
        date: missions.find(m => ['completed', 'realise', 'terminée'].includes(String(m.status || '').toLowerCase()))?.date_end || new Date().toISOString()
      });
    }
    const lastCompletedMission = (() => {
      for (let i = missions.length - 1; i >= 0; i -= 1) {
        const mission = missions[i];
        if (['completed', 'realise', 'terminée'].includes(String(mission.status || '').toLowerCase())) {
          return mission;
        }
      }
      return null;
    })();

    if (missionsCompleted >= 10) {
      pushAchievement('mission-10', {
        title: 'Série de missions',
        description: `${missionsCompleted} missions finalisées.`,
        icon: '🏆',
        date: lastCompletedMission?.date_end || new Date().toISOString()
      });
    }

    const totalHours = presences.reduce((acc, presence) => acc + (computeDurationHours(presence.start_time, presence.end_time) || 0), 0);
    if (totalHours >= 100) {
      pushAchievement('hours-100', {
        title: '100 heures terrain',
        description: 'Vous avez passé plus de 100 heures sur le terrain.',
        icon: '⏱️',
        date: new Date().toISOString()
      });
    }

    const streak = calculateRecentStreak(checkins.map(c => c.start_time || c.created_at || c.timestamp));
    if (streak >= 5) {
      pushAchievement('streak-5', {
        title: 'Série de 5 jours',
        description: 'Présence enregistrée cinq jours de suite.',
        icon: '🔥',
        date: new Date().toISOString()
      });
    }

    if (achievements.length === 0) {
      pushAchievement('onboarding', {
        title: 'Bienvenue sur Presence CCRB',
        description: 'Connectez-vous et réalisez vos premières activités pour débloquer des distinctions.',
        icon: '👋',
        date: new Date().toISOString()
      });
    }

    achievements.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    res.json({ success: true, achievements: achievements.slice(0, 20) });
  } catch (error) {
    console.error('Erreur API agent/achievements:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Agent leaderboard endpoint
app.get('/api/agent/leaderboard', authenticateToken, async (req, res) => {
  try {
    const days = clampDays(req.query.days, { fallback: 45, min: 7, max: 180 });
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const { data: agentsData, error: agentsError } = await supabaseClient
      .from('users')
      .select('id, name, email, project_name, role')
      .eq('role', 'agent')
      .order('name', { ascending: true })
      .limit(500);

    if (agentsError) throw agentsError;

    const agents = Array.isArray(agentsData) ? agentsData : [];
    if (agents.length === 0) {
      return res.json({ success: true, leaderboard: [], data: [] });
    }

    const [missionsResult, presencesResult, checkinsResult, planificationsResult] = await Promise.all([
      supabaseClient
        .from('missions')
        .select('id, agent_id, status, date_start, date_end, created_at, updated_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })
        .limit(5000),
      supabaseClient
        .from('presences')
        .select('id, user_id, start_time, end_time')
        .gte('start_time', startDate.toISOString())
        .order('start_time', { ascending: true })
        .limit(5000),
      supabaseClient
        .from('checkins')
        .select('id, user_id, created_at, start_time')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })
        .limit(5000),
      supabaseClient
        .from('planifications')
        .select('id, user_id, date, resultat_journee, created_at')
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(5000)
    ]);

    if (missionsResult.error) throw missionsResult.error;
    if (presencesResult.error) throw presencesResult.error;
    if (checkinsResult.error) throw checkinsResult.error;
    if (planificationsResult.error) throw planificationsResult.error;

    const stats = new Map();
    const ensureStats = (agentId) => {
      if (!stats.has(agentId)) {
        stats.set(agentId, {
          missionsCompleted: 0,
          missionsTotal: 0,
          activitiesPlanned: 0,
          activitiesRealized: 0,
          checkins: 0,
          hours: 0,
          presenceDays: new Set(),
          permissionDays: 0
        });
      }
      return stats.get(agentId);
    };

    const missions = Array.isArray(missionsResult.data) ? missionsResult.data : [];
    missions.forEach(mission => {
      if (!mission.agent_id) return;
      const bucket = ensureStats(mission.agent_id);
      bucket.missionsTotal += 1;
      if (['completed', 'realise', 'terminée'].includes(String(mission.status || '').toLowerCase())) {
        bucket.missionsCompleted += 1;
      }
      bucket.hours += computeDurationHours(mission.date_start || mission.created_at, mission.date_end || mission.updated_at) || 0;
    });

    const presences = Array.isArray(presencesResult.data) ? presencesResult.data : [];
    presences.forEach(presence => {
      if (!presence.user_id) return;
      const bucket = ensureStats(presence.user_id);
      bucket.hours += computeDurationHours(presence.start_time, presence.end_time) || 0;
      const day = isoDateOnly(presence.start_time);
      if (day) {
        bucket.presenceDays.add(day);
      }
    });

    const checkins = Array.isArray(checkinsResult.data) ? checkinsResult.data : [];
    checkins.forEach(checkin => {
      if (!checkin.user_id) return;
      const bucket = ensureStats(checkin.user_id);
      bucket.checkins += 1;
    });

    // Traiter les planifications (activités)
    const planifications = Array.isArray(planificationsResult.data) ? planificationsResult.data : [];
    planifications.forEach(plan => {
      if (!plan.user_id) return;
      const bucket = ensureStats(plan.user_id);
      bucket.activitiesPlanned += 1;
      // Compter comme réalisée si resultat_journee indique une réalisation
      if (['realise', 'partiellement_realise', 'completed', 'réalisée', 'partiellement réalisée'].includes(String(plan.resultat_journee || '').toLowerCase())) {
        bucket.activitiesRealized += 1;
      }
    });

    try {
      // Récupérer les jours de permission pour la période demandée
      const { data: permissionRows, error: permissionError } = await supabaseClient
        .from('permission_days')
        .select('user_id, start_date, end_date, status')
        .or(`and(start_date.lte.${endDate.toISOString()},end_date.gte.${startDate.toISOString()})`)
        .eq('status', 'approved'); // Seulement les permissions approuvées

      if (permissionError) {
        console.warn('Erreur lors de la récupération des permissions:', permissionError);
        throw permissionError;
      }

      (permissionRows || []).forEach(row => {
        if (!row || !row.user_id) return;

        // S'assurer que les dates sont valides
        const start = new Date(row.start_date);
        const end = new Date(row.end_date);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          console.warn('Date de permission invalide pour user_id:', row.user_id);
          return;
        }

        // Ajuster les dates pour être dans la période demandée
        const periodStart = start < startDate ? startDate : start;
        const periodEnd = end > endDate ? endDate : end;

        // Calculer le nombre de jours dans la période
        const diffTime = Math.max(0, periodEnd - periodStart);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 pour inclure le jour de fin

        if (diffDays > 0) {
          const bucket = ensureStats(row.user_id);
          bucket.permissionDays = (bucket.permissionDays || 0) + diffDays;
        }
      });
    } catch (permissionError) {
      console.warn('Erreur récupération permission_days (leaderboard):', permissionError.message || permissionError);
      // En cas d'erreur, on continue sans les données de permission
      // plutôt que de faire échouer toute la requête
    }

    const leaderboard = agents.map(agent => {
      const stat = stats.get(agent.id) || {
        missionsCompleted: 0,
        missionsTotal: 0,
        activitiesPlanned: 0,
        activitiesRealized: 0,
        checkins: 0,
        hours: 0,
        presenceDays: new Set(),
        permissionDays: 0
      };
      const fieldTime = Math.round(stat.hours * 10) / 10;
      const permissionDays = stat.permissionDays || 0;
      // Calculer le score incluant les activités planifiées
      const tep = stat.activitiesPlanned > 0 ? Math.round((stat.activitiesRealized / stat.activitiesPlanned) * 100) : 0;
      const score = Math.round(
        stat.missionsCompleted * 5 +
        stat.checkins * 1 +
        fieldTime * 0.5 +
        tep * 0.1  // Inclure le TEP dans le score
      );
      return {
        id: agent.id,
        name: getUserDisplayName(agent),
        project: agent.project_name || null,
        score,
        missions: stat.missionsCompleted,
        totalMissions: stat.missionsTotal,
        checkins: stat.checkins,
        fieldTime,
        permissionDays,
        attendanceDays: stat.presenceDays.size,
        activitiesPlanned: stat.activitiesPlanned,
        activitiesRealized: stat.activitiesRealized,
        tep
      };
    });

    leaderboard.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.missions !== a.missions) return b.missions - a.missions;
      return b.checkins - a.checkins;
    });

    // Inclure TOUS les agents, pas limité à 50
    const withRanks = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

    console.log(`✅ Leaderboard retourné: ${withRanks.length} agents`);
    res.json({ success: true, leaderboard: withRanks, data: withRanks });
  } catch (error) {
    console.error('Erreur API agent/leaderboard:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Checkins endpoint (GET)
app.get('/api/checkins', authenticateToken, async (req, res) => {
  try {
    const { from, to, user_id } = req.query;
    let targetUserId = null;

    console.log('📥 GET /api/checkins - Paramètres:', { from, to, user_id, requesterId: req.user?.id });

    if (typeof user_id !== 'undefined') {
      const parsed = Number(user_id);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ success: false, error: 'user_id invalide' });
      }
      if (parsed !== Number(req.user?.id) && !isPrivilegedRequest(req)) {
        return res.status(403).json({ success: false, error: 'Accès non autorisé à cet utilisateur' });
      }
      targetUserId = parsed;
    }

    // Normalisation des dates pour les requêtes
    const fromIso = from ? String(from) : null;
    const toIso = to ? String(to) : null;
    const fromDateStr = fromIso ? fromIso.split('T')[0] : null; // YYYY-MM-DD
    const toDateStr = toIso ? toIso.split('T')[0] : null;       // YYYY-MM-DD

    // 1) Checkins
    let query = supabaseClient
      .from('checkins')
      .select('*')
      .order('start_time', { ascending: false }); // Utiliser start_time au lieu de created_at

    if (fromIso && toIso) {
      query = query.gte('start_time', fromIso).lte('start_time', toIso);
      console.log('📅 Filtrage par dates:', { from: fromIso, to: toIso });
    }

    if (targetUserId !== null) {
      query = query.eq('user_id', targetUserId);
      console.log('👤 Filtrage par user_id:', targetUserId);
    } else if (!isPrivilegedRequest(req)) {
      query = query.eq('user_id', req.user.id);
      console.log('👤 Filtrage par requester id:', req.user.id);
    }

    const { data: checkins, error: checkinsError } = await query;
    if (checkinsError) throw checkinsError;
    console.log(`✅ Checkins trouvés: ${checkins?.length || 0} enregistrements`);
    if (checkins && checkins.length > 0) {
      console.log('📊 Premier checkin:', { id: checkins[0].id, user_id: checkins[0].user_id, start_time: checkins[0].start_time });
    }

    // 2) Planifications de la période (user_id et agent_id), filtrées par projet de l'agent si connu
    let planifications = [];
    try {
      if (fromDateStr && toDateStr) {
        const normalizedAgentId = targetUserId !== null ? Number(targetUserId) : Number(req.user.id);

        // Déterminer le projet effectif: priorité au query param, sinon projet de l'agent
        let effectiveProject = (req.query.project_name || req.query.project || '').toString().trim() || null;
        if (!effectiveProject && Number.isFinite(normalizedAgentId)) {
          try {
            const { data: agentRow } = await supabaseClient
              .from('users')
              .select('project_name')
              .eq('id', normalizedAgentId)
              .maybeSingle();
            if (agentRow && agentRow.project_name) effectiveProject = agentRow.project_name;
          } catch (e) {
            console.warn('⚠️ Impossible de récupérer le projet de l\'agent:', e.message || e);
          }
        }

        // Deux requêtes parallèles pour couvrir user_id et agent_id
        let userQuery = supabaseClient
          .from('planifications')
          .select('*')
          .gte('date', fromDateStr)
          .lte('date', toDateStr);
        let agentQuery = supabaseClient
          .from('planifications')
          .select('*')
          .gte('date', fromDateStr)
          .lte('date', toDateStr);

        if (Number.isFinite(normalizedAgentId)) {
          userQuery = userQuery.eq('user_id', normalizedAgentId);
          agentQuery = agentQuery.eq('agent_id', normalizedAgentId);
        }

        // Ne pas filtrer en SQL par project_name pour éviter les divergences de casse/espaces
        // On filtrera côté JS après fusion avec une normalisation

        const [userResult, agentResult] = await Promise.all([
          userQuery.order('date', { ascending: false }),
          agentQuery.order('date', { ascending: false })
        ]);

        const allData = [...(userResult.data || []), ...(agentResult.data || [])];
        // Fusion + dédoublonnage
        planifications = Array.from(new Map(allData.map(p => [p.id, p])).values());

        // Filtre projet côté JS avec normalisation
        const norm = v => String(v || '').trim().toLowerCase();
        if (effectiveProject) {
          const projNorm = norm(effectiveProject);
          planifications = planifications.filter(p => norm(p.project_name) === projNorm);
        }
        console.log(`📊 Planifications récupérées: user=${userResult.data?.length || 0}, agent=${agentResult.data?.length || 0}, fusionnées=${planifications.length}`);
      }
    } catch (e) {
      if (!isMissingTable(e)) {
        console.warn('⚠️ Planifications indisponibles:', e.message || e);
      }
      planifications = [];
    }

    // Résumé des activités (TEP)
    const activitiesSummary = (() => {
      const total = planifications.length;
      const norm = v => String(v || '').toLowerCase();
      const realise = planifications.filter(p => norm(p.resultat_journee) === 'realise').length;
      const partiel = planifications.filter(p => norm(p.resultat_journee) === 'partiellement_realise').length;
      const non = planifications.filter(p => norm(p.resultat_journee) === 'non_realise').length;
      const encours = planifications.filter(p => norm(p.resultat_journee) === 'en_cours').length;
      const sans = planifications.filter(p => !p.resultat_journee).length;
      const tep = total > 0 ? Math.round((realise / total) * 1000) / 10 : 0;
      return {
        total_planifiees: total,
        realisees: realise,
        partiellement_realisees: partiel,
        non_realisees: non,
        en_cours: encours,
        sans_resultat: sans,
        tep_percent: tep
      };
    })();

    // 3) Jours permissionnaires (permission_days) sur la période
    let permissionDays = [];
    let permissionDaysTotal = 0;
    try {
      // Construire la liste des mois couverts (YYYY-MM)
      const months = [];
      if (fromDateStr && toDateStr) {
        const start = new Date(fromDateStr + 'T00:00:00');
        const end = new Date(toDateStr + 'T00:00:00');
        const cur = new Date(start.getFullYear(), start.getMonth(), 1);
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        while (cur <= endMonth) {
          const ym = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
          months.push(ym);
          cur.setMonth(cur.getMonth() + 1);
        }
      }

      // Convertir l'ID agent en UUID si nécessaire
      let uuid = null;
      try {
        const rawId = targetUserId !== null ? targetUserId : req.user?.id;
        uuid = await getUserId(rawId);
      } catch (e) {
        console.warn('⚠️ Conversion user_id -> UUID échouée:', e.message || e);
      }

      if (uuid && months.length > 0) {
        let permQuery = supabaseClient
          .from('permission_days')
          .select('*')
          .eq('user_id', uuid)
          .in('month', months)
          .order('start_date', { ascending: false });

        const { data: permData, error: permError } = await permQuery;
        if (permError && !isMissingTable(permError)) throw permError;

        // Calculer le total de jours (en s'appuyant sur ensureDateRange si dispo)
        permissionDays = (permData || []).map(item => {
          try {
            const base = {
              id: item.id,
              user_id: item.user_id,
              month: item.month || null,
              days: item.days || null,
              start_date: item.start_date || null,
              end_date: item.end_date || null,
              reason: item.reason || null,
              status: item.status || 'pending',
              created_at: item.created_at || null,
              updated_at: item.updated_at || null
            };
            const validated = typeof ensureDateRange === 'function' ? ensureDateRange({ ...base }) : base;
            const daysVal = Number(validated.days || 0);
            if (Number.isFinite(daysVal)) permissionDaysTotal += daysVal;
            return validated;
          } catch {
            return item;
          }
        });
      }
    } catch (e) {
      if (!isMissingTable(e)) {
        console.warn('⚠️ Permission days indisponibles:', e.message || e);
      }
      permissionDays = [];
      permissionDaysTotal = 0;
    }

    // Réponse enrichie
    res.json({
      success: true,
      data: checkins || [],
      planifications: planifications || [],
      activities_summary: activitiesSummary,
      permission_days: {
        items: permissionDays || [],
        total_days: permissionDaysTotal
      }
    });
  } catch (error) {
    console.error('❌ Erreur API checkins:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Missions endpoint (GET) - Pour calculer le temps terrain
app.get('/api/missions', authenticateToken, async (req, res) => {
  try {
    const { from, to, agent_id, status } = req.query;
    let targetAgentId = null;

    console.log('📥 GET /api/missions - Paramètres:', { from, to, agent_id, status, requesterId: req.user?.id });

    if (typeof agent_id !== 'undefined') {
      const parsed = Number(agent_id);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ success: false, error: 'agent_id invalide' });
      }
      if (parsed !== Number(req.user?.id) && !isPrivilegedRequest(req)) {
        return res.status(403).json({ success: false, error: 'Accès non autorisé à cet agent' });
      }
      targetAgentId = parsed;
    }

    let query = supabaseClient
      .from('missions')
      .select('id, agent_id, date_start, date_end, start_time, end_time, status, village, commune, departement, note, created_at')
      .order('date_start', { ascending: false });

    if (from && to) {
      query = query.gte('date_start', from).lte('date_start', to);
      console.log('📅 Filtrage par dates:', { from, to });
    }

    if (targetAgentId !== null) {
      query = query.eq('agent_id', targetAgentId);
      console.log('👤 Filtrage par agent_id:', targetAgentId);
    } else if (!isPrivilegedRequest(req)) {
      query = query.eq('agent_id', req.user.id);
      console.log('👤 Filtrage par requester id:', req.user.id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    console.log(`✅ Missions trouvées: ${data?.length || 0} enregistrements`);
    if (data && data.length > 0) {
      console.log('📊 Première mission:', { id: data[0].id, agent_id: data[0].agent_id, date_start: data[0].date_start, start_time: data[0].start_time, end_time: data[0].end_time });
    }
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('❌ Erreur API missions:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Goals endpoint
app.get('/api/goals', authenticateToken, async (req, res) => {
  try {
    // Pour l'instant, retourner des données vides car la table goals n'existe pas
    // Vous pouvez créer cette table plus tard si nécessaire
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error('Erreur API goals:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Badges endpoint
app.get('/api/badges', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('badges')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erreur API badges:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Departments endpoint (alias for departements)
app.get('/api/departments', async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('departements')
      .select('*')
      .order('nom');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Erreur API departments:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Locations endpoint
app.get('/api/locations', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('locations')
      .select('*')
      .order('name');

    // Handle missing table gracefully
    if (error && isMissingTable(error)) {
      console.warn('Table locations non trouvée, utilisation des localisations de secours');
      const locations = await buildFallbackLocations();
      return res.json({ success: true, data: locations });
    }

    if (error) throw error;

    let locations = Array.isArray(data) ? data : [];
    if (locations.length === 0) {
      locations = await buildFallbackLocations();
    }

    res.json({ success: true, data: locations });
  } catch (error) {
    console.error('Erreur API locations:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Users projects endpoint
app.get('/api/users/projects', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id, name, project_name')
      .not('project_name', 'is', null)
      .order('project_name');

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erreur API users/projects:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Validations endpoint
app.get('/api/validations', authenticateToken, async (req, res) => {
  try {
    const { from, to, user_id } = req.query;
    let query = supabaseClient
      .from('checkin_validations') // Utiliser la bonne table
      .select('*')
      .order('created_at', { ascending: false });

    if (from && to) {
      query = query.gte('created_at', from).lte('created_at', to);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erreur API validations:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Fonction d'envoi d'email
async function sendVerificationEmail(email, code, newAccountEmail) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Configuration email manquante - EMAIL_USER et EMAIL_PASS requis');
    throw new Error('Configuration email manquante');
  }

  const transporter = await createGmailTransport();

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

  await sendMailRobust(mailOptions);
}

// Endpoint pour récupérer les presences (admin/superviseur)
app.get('/api/presences', authenticateToken, authenticateSupervisorOrAdmin, async (req, res) => {
  try {
    const { from, to, user_id } = req.query;

    let query = supabaseClient
      .from('presences')
      .select(`
        id,
        user_id,
        start_time,
        end_time,
        location_lat,
        location_lng,
        location_name,
        notes,
        photo_url,
        status,
        checkin_type,
        created_at,
        within_tolerance,
        distance_from_reference_m,
        tolerance_meters,
        users (
          id,
          name,
          email,
          project_name,
          departement,
          commune,
          arrondissement,
          village
        )
      `)
      .order('start_time', { ascending: false });

    if (user_id) {
      query = query.eq('user_id', Number(user_id));
    }

    if (from) {
      query = query.gte('start_time', new Date(String(from)).toISOString());
    }

    if (to) {
      query = query.lte('start_time', new Date(String(to)).toISOString());
    }

    const { data: presences, error } = await query;

    if (error) throw error;

    return res.json({ success: true, items: presences || [] });
  } catch (error) {
    console.error('Erreur /api/presences:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Endpoint pour récupérer les validations de présence (nouvelle table centralisée)
app.get('/api/presence-validations', authenticateToken, async (req, res) => {
  try {
    const { from, to, user_id, status, checkin_type } = req.query;

    let query = supabaseClient
      .from('presence_validations')
      .select(`
        id,
        user_id,
        presence_id,
        validation_status,
        checkin_type,
        checkin_lat,
        checkin_lng,
        checkin_location_name,
        reference_lat,
        reference_lng,
        distance_from_reference_m,
        tolerance_meters,
        within_tolerance,
        validated_by,
        validation_reason,
        validation_notes,
        validation_method,
        photo_url,
        checkin_timestamp,
        validation_timestamp,
        created_at,
        users!presence_validations_user_id_fkey (
          id,
          name,
          first_name,
          last_name,
          email,
          project_name,
          departement,
          commune,
          arrondissement,
          village
        )
      `);

    // Appliquer les filtres
    if (from) {
      query = query.gte('checkin_timestamp', from);
    }
    if (to) {
      query = query.lte('checkin_timestamp', to);
    }
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (status) {
      query = query.eq('validation_status', status);
    }
    if (checkin_type) {
      query = query.eq('checkin_type', checkin_type);
    }

    // Ordonner par timestamp décroissant
    query = query.order('checkin_timestamp', { ascending: false });

    console.log('Exécution de la requête avec les paramètres:', {
      from,
      to,
      agent_id,
      supervisor_id,
      query: query
    });

    const { data: validations, error } = await query;

    if (error) throw error;

    return res.json({ success: true, data: validations || [] });
  } catch (error) {
    console.error('Erreur /api/presence-validations:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Endpoint pour créer une validation de présence
app.post('/api/presence-validations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      presence_id,
      validation_status,
      checkin_type = 'manual',
      checkin_lat,
      checkin_lng,
      checkin_location_name,
      validation_reason,
      validation_notes,
      validation_method = 'gps',
      photo_url,
      checkin_timestamp
    } = req.body;

    // Validation des données requises
    if (!validation_status || !['validated', 'rejected', 'pending'].includes(validation_status)) {
      return res.status(400).json({
        success: false,
        message: 'validation_status requis: validated, rejected, ou pending'
      });
    }

    if (!checkin_lat || !checkin_lng) {
      return res.status(400).json({
        success: false,
        message: 'checkin_lat et checkin_lng requis'
      });
    }

    // Récupérer les informations de l'utilisateur pour les coordonnées de référence
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('reference_lat, reference_lon, tolerance_radius_meters')
      .eq('id', userId)
      .single();

    if (userError) {
      return res.status(500).json({ success: false, message: 'Erreur lors de la récupération du profil utilisateur' });
    }

    // Calculer la distance si les coordonnées de référence sont disponibles
    let distance_from_reference_m = null;
    let within_tolerance = false;

    if (user.reference_lat && user.reference_lon) {
      // Calcul de distance Haversine
      const toRad = (v) => (Number(v) * Math.PI) / 180;
      const R = 6371000; // Rayon de la Terre en mètres
      const dLat = toRad(checkin_lat - Number(user.reference_lat));
      const dLon = toRad(checkin_lng - Number(user.reference_lon));
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(user.reference_lat)) * Math.cos(toRad(checkin_lat)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance_from_reference_m = Math.round(R * c);

      const tolerance = user.tolerance_radius_meters || 500;
      within_tolerance = distance_from_reference_m <= tolerance;
    }

    // Créer l'enregistrement de validation
    const validationData = {
      user_id: userId,
      presence_id: presence_id || null,
      validation_status,
      checkin_type,
      checkin_lat: Number(checkin_lat),
      checkin_lng: Number(checkin_lng),
      checkin_location_name: checkin_location_name || null,
      reference_lat: user.reference_lat,
      reference_lng: user.reference_lon,
      distance_from_reference_m,
      tolerance_meters: user.tolerance_radius_meters || 500,
      within_tolerance,
      validated_by: req.user.role === 'admin' || req.user.role === 'superviseur' ? userId : null,
      validation_reason: validation_reason || null,
      validation_notes: validation_notes || null,
      validation_method,
      photo_url: photo_url || null,
      checkin_timestamp: checkin_timestamp || new Date().toISOString(),
      device_info: {
        user_agent: req.headers['user-agent'],
        ip_address: req.ip,
        timestamp: new Date().toISOString()
      }
    };

    const { data: validation, error: insertError } = await supabaseClient
      .from('presence_validations')
      .insert(validationData)
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return res.json({
      success: true,
      data: validation,
      message: 'Validation de présence créée avec succès'
    });

  } catch (error) {
    console.error('Erreur /api/presence-validations POST:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Endpoint pour synchroniser les validations vers presences (admin seulement)
app.post('/api/sync/presences', authenticateToken, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Accès refusé - Admin seulement' });
    }

    console.log('🔄 Synchronisation des validations vers presences...');

    // Récupérer toutes les validations avec leurs checkins
    const { data: validations, error: validationsError } = await supabaseClient
      .from('checkin_validations')
      .select(`
        id,
        checkin_id,
        agent_id,
        valid,
        distance_m,
        tolerance_m,
        reference_lat,
        reference_lon,
        planned_start_time,
        planned_end_time,
        created_at,
        checkins (
          id,
          lat,
          lon,
          note,
          photo_url,
          timestamp
        )
      `)
      .order('created_at', { ascending: true });

    if (validationsError) throw validationsError;

    if (!validations || validations.length === 0) {
      return res.json({ success: true, message: 'Aucune validation à synchroniser', count: 0 });
    }

    // Récupérer les presences existantes
    const { data: existingPresences } = await supabaseClient
      .from('presences')
      .select('id, user_id, start_time, created_at');

    const existingSet = new Set();
    if (existingPresences) {
      existingPresences.forEach(p => {
        const key = `${p.user_id}_${p.start_time}`;
        existingSet.add(key);
      });
    }

    // Préparer les données à insérer
    const presencesToInsert = [];
    for (const validation of validations) {
      const checkin = validation.checkins;
      if (!checkin) continue;

      const key = `${validation.agent_id}_${validation.planned_start_time || validation.created_at}`;
      if (existingSet.has(key)) continue;

      presencesToInsert.push({
        user_id: validation.agent_id,
        start_time: validation.planned_start_time || validation.created_at,
        end_time: validation.planned_end_time || null,
        location_lat: Number(checkin.lat) || null,
        location_lng: Number(checkin.lon) || null,
        notes: checkin.note || null,
        photo_url: checkin.photo_path || null,
        status: 'completed',
        checkin_type: validation.valid ? 'validated' : 'rejected',
        created_at: validation.created_at,
        within_tolerance: validation.valid,
        distance_from_reference_m: validation.distance_m || null,
        tolerance_meters: validation.tolerance_m || null
      });
    }

    if (presencesToInsert.length === 0) {
      return res.json({ success: true, message: 'Toutes les presences sont déjà synchronisées', count: 0 });
    }

    // Insérer par lots
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < presencesToInsert.length; i += batchSize) {
      const batch = presencesToInsert.slice(i, i + batchSize);
      const { data, error } = await supabaseClient
        .from('presences')
        .insert(batch)
        .select('id');

      if (error) {
        console.error('Erreur lors de l\'insertion du lot:', error);
        continue;
      }

      totalInserted += data ? data.length : 0;
    }

    return res.json({
      success: true,
      message: `Synchronisation terminée: ${totalInserted} presences insérées`,
      count: totalInserted
    });

  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la synchronisation' });
  }
});

// Route par défaut - redirection vers index.html
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// Endpoint pour les alertes d'urgence
app.post('/api/emergency/alert', authenticateToken, async (req, res) => {
  try {
    console.log('🚨 POST /api/emergency/alert - Réception alerte urgence');

    const { alert_type, message, location, priority = 'high' } = req.body;
    const userId = req.user?.id;

    if (!alert_type || !message) {
      return res.status(400).json({
        success: false,
        error: 'Type et message requis'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié'
      });
    }

    // Enregistrer l'alerte dans la base de données
    const alertData = {
      user_id: userId,
      alert_type,
      message,
      location: location || null,
      priority,
      created_at: new Date().toISOString(),
      status: 'active'
    };

    const { data, error } = await supabaseClient
      .from('emergency_alerts')
      .insert(alertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur enregistrement alerte:', error);
      throw error;
    }

    //Notifier via WebSocket si disponible
    if (wssInstance) {
      wssInstance.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({
            type: 'emergency_alert',
            data: alertData
          }));
        }
      });
    }

    console.log('✅ Alerte d\'urgence enregistrée:', alertData);
    res.json({
      success: true,
      data: alertData,
      message: 'Alerte d\'urgence envoyée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur dans /api/emergency/alert:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors du traitement de l\'alerte'
    });
  }
});

// Endpoint pour récupérer les badges
app.get('/api/badges', authenticateToken, async (req, res) => {
  try {
    console.log('🏆 GET /api/badges - Récupération badges');

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non authentifié'
      });
    }

    // Récupérer les badges de l'utilisateur
    const { data, error } = await supabaseClient
      .from('user_badges')
      .select(`
        *,
        badges(id, name, description, icon, color)
      `)
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération badges:', error);
      // Retourner un tableau vide si la table n'existe pas
      if (error.code === 'PGRST116') {
        return res.json({ success: true, data: [] });
      }
      throw error;
    }

    const badges = (data || []).map(badge => ({
      id: badge.id,
      name: badge.badges?.name || 'Badge inconnu',
      description: badge.badges?.description || '',
      icon: badge.badges?.icon || '🏆',
      color: badge.badges?.color || '#gold',
      awarded_at: badge.awarded_at
    }));

    console.log(`✅ ${badges.length} badges récupérés pour l'utilisateur ${userId}`);
    res.json({
      success: true,
      data: badges
    });

  } catch (error) {
    console.error('❌ Erreur dans /api/badges:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la récupération des badges'
    });
  }
});

// Route par défaut - redirection vers index.html
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Endpoint pour sauvegarder les observations des activités
app.post('/api/activities/observation', authenticateToken, async (req, res) => {
  try {
    console.log('📝 POST /api/activities/observation - Sauvegarde observation');

    const { activityId, observation, agentId } = req.body;
    const userId = req.user?.id;

    if (!activityId || !agentId) {
      return res.status(400).json({
        success: false,
        error: 'ID activité et ID agent requis'
      });
    }

    // Vérifier que l'utilisateur peut modifier cette activité (soit son activité, soit admin/superviseur)
    if (userId !== agentId && req.user?.role !== 'admin' && req.user?.role !== 'supervisor') {
      return res.status(403).json({
        success: false,
        error: 'Non autorisé à modifier cette activité'
      });
    }

    // Mettre à jour l'observation dans la base de données
    // Pour l'instant, nous allons simuler la sauvegarde
    // En production, cela devrait mettre à jour la table appropriée (planifications, activities, etc.)

    console.log(`Observation sauvegardée pour activité ${activityId} par agent ${agentId}: ${observation}`);

    res.json({
      success: true,
      message: 'Observation sauvegardée avec succès'
    });

  } catch (error) {
    console.error('Erreur sauvegarde observation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la sauvegarde'
    });
  }
});

// Endpoint pour tester la connexion à l'API Gemini
app.post('/api/test-gemini', async (req, res) => {
  try {
    console.log('🧪 POST /api/test-gemini - Test connexion Gemini');

    const { apiKey, model = 'gemini-1.5-flash' } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Clé API requise'
      });
    }

    // Tester la connexion avec une requête simple
    const testPayload = {
      contents: [{
        parts: [{
          text: "Réponds simplement 'OK' pour tester la connexion."
        }]
      }]
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000) // Timeout de 10 secondes
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erreur API Gemini:', errorData);

      return res.status(400).json({
        success: false,
        error: `Erreur API (${response.status}): ${errorData}`
      });
    }

    const result = await response.json();

    if (result.candidates && result.candidates.length > 0) {
      console.log(`✅ Connexion Gemini réussie avec modèle: ${model}`);
      res.json({
        success: true,
        message: `Connexion réussie avec le modèle ${model}`,
        model: model
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Réponse invalide de l\'API Gemini'
      });
    }

  } catch (error) {
    console.error('Erreur test Gemini:', error);

    if (error.name === 'AbortError') {
      res.status(408).json({
        success: false,
        error: 'Timeout: le serveur Gemini ne répond pas'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Démarrer le serveur HTTP
const server = app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});

// WebSocket Server (for real-time features like messaging)
const WebSocket = require('ws');

// Initialiser le serveur WebSocket avec le serveur HTTP
const wss = new WebSocket.Server({ server });
// Expose instance for other handlers
const wssInstance = wss;

// Simple broadcast helper
function broadcastRealtime(event) {
  if (!event || !event.type) return;

  try {
    const payload = JSON.stringify(event);
    wssInstance.clients.forEach(client => {
      if (client && client.readyState === WebSocket.OPEN) {
        try { client.send(payload); } catch (e) { console.error('Error sending WebSocket message:', e); }
      }
    });
  } catch (e) {
    console.error('Broadcast error:', e);
  }
};

wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket');

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(String(raw || '{}'));
      if (msg && msg.type === 'message' && msg.payload) {
        // Optionnel: prise en charge d'envoi via WS (fallback REST existe déjà)
        broadcastRealtime({ type: 'message', payload: msg.payload });
      } else if (msg && msg.type === 'ping') {
        try {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        } catch (e) {
          console.error('Error sending pong:', e);
        }
      }
    } catch (e) {
      console.error('Error processing WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Export the app and WebSocket server for testing and other modules
module.exports = { app, server, wss, wssInstance };

// End of file
