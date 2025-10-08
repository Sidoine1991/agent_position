import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken } from '../middleware/auth';
import { ReportRequest, ApiResponse, PaginatedResponse } from '../types';

const router = express.Router();

const supabaseUrl = process.env['SUPABASE_URL'] || 'https://test.supabase.co';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || 'test_key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate report
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, content, type, period_start, period_end }: ReportRequest = req.body;

    if (!title || !content || !type || !period_start || !period_end) {
      res.status(400).json({
        success: false,
        error: 'All fields are required',
      });
      return;
    }

    // Generate report data based on type
    let reportData = {};

    switch (type) {
      case 'daily':
        reportData = await generateDailyReport(period_start, period_end);
        break;
      case 'weekly':
        reportData = await generateWeeklyReport(period_start, period_end);
        break;
      case 'monthly':
        reportData = await generateMonthlyReport(period_start, period_end);
        break;
      default:
        reportData = await generateCustomReport(period_start, period_end);
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        title,
        content,
        type,
        generated_by: (req as any).user!.id,
        period_start,
        period_end,
        data: reportData,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      data,
      message: 'Report generated successfully',
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Get reports
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, type, start_date, end_date } = req.query;

    let query = supabase
      .from('reports')
      .select(`
        *,
        profiles!inner(name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filter by type
    if (type && typeof type === 'string') {
      query = query.eq('type', type);
    }

    // Filter by date range
    if (start_date && typeof start_date === 'string') {
      query = query.gte('created_at', start_date);
    }
    if (end_date && typeof end_date === 'string') {
      query = query.lte('created_at', end_date);
    }

    // Non-admin users can only see their own reports
    if ((req as any).user?.role !== 'admin') {
      query = query.eq('generated_by', (req as any).user!.id);
    }

    // Pagination
    const offset = (Number(page) - 1) * Number(limit);
    query = query.range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch reports',
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

// Get report by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    let query = supabase
      .from('reports')
      .select(`
        *,
        profiles!inner(name, email)
      `)
      .eq('id', id);

    // Non-admin users can only see their own reports
    if ((req as any).user?.role !== 'admin') {
      query = query.eq('generated_by', (req as any).user!.id);
    }

    const { data, error } = await query.single();

    if (error) {
      res.status(404).json({
        success: false,
        error: 'Report not found',
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      data,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Delete report
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user can delete this report
    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('generated_by')
      .eq('id', id)
      .single();

    if (fetchError) {
      res.status(404).json({
        success: false,
        error: 'Report not found',
      });
      return;
    }

    if ((req as any).user?.id !== report.generated_by && (req as any).user?.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete report',
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Report deleted successfully',
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Helper functions for generating reports
async function generateDailyReport(startDate: string, endDate: string) {
  const { data } = await supabase
    .from('presences')
    .select('status, timestamp')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate);

  return {
    total_presences: data?.length || 0,
    present: data?.filter(p => p.status === 'present').length || 0,
    absent: data?.filter(p => p.status === 'absent').length || 0,
    late: data?.filter(p => p.status === 'late').length || 0,
  };
}

async function generateWeeklyReport(startDate: string, endDate: string) {
  const { data } = await supabase
    .from('presences')
    .select('status, timestamp, user_id')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate);

  // Group by user and calculate statistics
  const userStats = data?.reduce((acc, presence) => {
    const userId = presence.user_id;
    if (!acc[userId]) {
      acc[userId] = { total: 0, present: 0, absent: 0, late: 0 };
    }
    acc[userId].total++;
    if (presence.status in acc[userId]) {
      acc[userId][presence.status]++;
    }
    return acc;
  }, {} as Record<string, any>) || {};

  return {
    total_users: Object.keys(userStats).length,
    user_stats: userStats,
  };
}

async function generateMonthlyReport(startDate: string, endDate: string) {
  const { data } = await supabase
    .from('presences')
    .select('status, timestamp, user_id')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate);

  // Calculate monthly statistics
  const monthlyStats: Record<string, any> = {};
  if (data) {
    data.forEach(presence => {
      if (!presence.timestamp || !presence.status) return;
      const date = new Date(presence.timestamp).toISOString().split('T')[0];
      if (date && !monthlyStats[date]) {
        monthlyStats[date] = { total: 0, present: 0, absent: 0, late: 0 };
      }
      if (date) {
        monthlyStats[date].total++;
        const status = presence.status as string;
        if (status && status in monthlyStats[date]) {
          monthlyStats[date][status]++;
        }
      }
    });
  }

  return {
    daily_breakdown: monthlyStats,
    total_days: Object.keys(monthlyStats).length,
  };
}

async function generateCustomReport(startDate: string, endDate: string) {
  const { data } = await supabase
    .from('presences')
    .select('*')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate);

  return {
    raw_data: data || [],
    summary: {
      total_records: data?.length || 0,
      date_range: { start: startDate, end: endDate },
    },
  };
}

export default router;
