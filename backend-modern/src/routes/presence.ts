import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireRole } from '../middleware/auth';
// Local lightweight types to avoid coupling
type PresenceRequest = { latitude: number; longitude: number; address?: string; status?: string; notes?: string };
type ApiResponse<T = any> = { success: boolean; data?: T; error?: string; message?: string };
type PaginatedResponse<T = any> = { success: boolean; data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
import { validatePresenceGeo } from '../utils/geo';

const router = express.Router();

const supabaseUrl = process.env['SUPABASE_URL'] || 'https://test.supabase.co';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || 'test_key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Mark presence
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, address, status, notes }: PresenceRequest = req.body;

    if (!latitude || !longitude || !status) {
      res.status(400).json({
        success: false,
        error: 'Latitude, longitude, and status are required',
      });
      return;
    }

    const { data, error } = await supabase
      .from('presences')
      .insert({
        user_id: (req as any).user!.id,
        latitude,
        longitude,
        address,
        status,
        notes,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to mark presence',
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      data,
      message: 'Presence marked successfully',
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Get user's presence records
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, start_date, end_date } = req.query;

    let query = supabase
      .from('presences')
      .select('*', { count: 'exact' })
      .eq('user_id', (req as any).user!.id)
      .order('timestamp', { ascending: false });

    // Filter by date range
    if (start_date && typeof start_date === 'string') {
      query = query.gte('timestamp', start_date);
    }
    if (end_date && typeof end_date === 'string') {
      query = query.lte('timestamp', end_date);
    }

    // Pagination
    const offset = (Number(page) - 1) * Number(limit);
    query = query.range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch presence records',
      });
      return;
    }

    const totalPages = Math.ceil((count || 0) / Number(limit));

    const response: PaginatedResponse = {
      success: true,
      data: data || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages,
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Get all presence records (admin/supervisor only)
router.get('/', authenticateToken, requireRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const { page = 1, limit = 10, user_id, start_date, end_date, status } = req.query;

    let query = supabase
      .from('presences')
      .select(`
        *,
        profiles!inner(name, email, role)
      `, { count: 'exact' })
      .order('timestamp', { ascending: false });

    // Filter by user
    if (user_id && typeof user_id === 'string') {
      query = query.eq('user_id', user_id);
    }

    // Filter by status
    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    // Filter by date range
    if (start_date && typeof start_date === 'string') {
      query = query.gte('timestamp', start_date);
    }
    if (end_date && typeof end_date === 'string') {
      query = query.lte('timestamp', end_date);
    }

    // Pagination
    const offset = (Number(page) - 1) * Number(limit);
    query = query.range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch presence records',
      });
      return;
    }

    const totalPages = Math.ceil((count || 0) / Number(limit));

    const response: PaginatedResponse = {
      success: true,
      data: data || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages,
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Get presence statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const userId = (req as any).user?.role === 'admin' ? undefined : (req as any).user!.id;

    let query = supabase
      .from('presences')
      .select('status, timestamp');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (start_date && typeof start_date === 'string') {
      query = query.gte('timestamp', start_date);
    }
    if (end_date && typeof end_date === 'string') {
      query = query.lte('timestamp', end_date);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
      });
      return;
    }

    // Calculate statistics
    const stats = {
      total: data?.length || 0,
      present: data?.filter(p => p.status === 'present').length || 0,
      absent: data?.filter(p => p.status === 'absent').length || 0,
      late: data?.filter(p => p.status === 'late').length || 0,
    };

    const response: ApiResponse = {
      success: true,
      data: stats,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;

// NEW: Validate presence with geofencing and planning
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const { latitude, longitude }: PresenceRequest = req.body || {};

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({ success: false, error: 'Latitude et longitude sont requis' });
      return;
    }

    // Fetch user reference point and tolerance
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, reference_lat, reference_lon, tolerance_radius_meters')
      .eq('id', userId)
      .single();

    if (userErr || !userRow) {
      res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: planRow } = await supabase
      .from('planifications')
      .select('planned_start_time, planned_end_time')
      .eq('agent_id', userId)
      .eq('date', today)
      .single();

    const result = validatePresenceGeo({
      userId,
      checkinLat: latitude,
      checkinLon: longitude,
      referenceLat: userRow.reference_lat,
      referenceLon: userRow.reference_lon,
      toleranceMeters: userRow.tolerance_radius_meters ?? 100,
      plannedStart: planRow?.planned_start_time ?? null,
      plannedEnd: planRow?.planned_end_time ?? null,
    });

    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  } catch (e) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});
