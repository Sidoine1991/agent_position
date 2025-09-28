import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ApiResponse, PaginatedResponse, Presence, PresenceRequest } from '../types';

const supabaseUrl = process.env['SUPABASE_URL'] || '';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class PresenceController {
  static async markPresence(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const presenceData: PresenceRequest = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!presenceData.latitude || !presenceData.longitude) {
        return res.status(400).json({
          success: false,
          error: 'Latitude and longitude are required',
        });
      }

      const { data: presence, error } = await supabase
        .from('presence')
        .insert({
          user_id: userId,
          latitude: presenceData.latitude,
          longitude: presenceData.longitude,
          address: presenceData.address,
          status: presenceData.status,
          notes: presenceData.notes,
          timestamp: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to mark presence',
        });
      }

      const response: ApiResponse<Presence> = {
        success: true,
        data: presence as Presence,
        message: 'Presence marked successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getMyPresence(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const offset = (page - 1) * limit;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { data: presence, error, count } = await supabase
        .from('presence')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .range(offset, offset + limit - 1)
        .order('timestamp', { ascending: false });

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch presence records',
        });
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response: PaginatedResponse<Presence> = {
        success: true,
        data: presence as Presence[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
        message: 'Presence records fetched successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getAllPresence(req: Request, res: Response) {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const offset = (page - 1) * limit;
      const userId = req.query['user_id'] as string;
      const status = req.query['status'] as string;
      const startDate = req.query['start_date'] as string;
      const endDate = req.query['end_date'] as string;

      let query = supabase
        .from('presence')
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            email,
            role
          )
        `, { count: 'exact' });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }

      if (endDate) {
        query = query.lte('timestamp', endDate);
      }

      const { data: presence, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('timestamp', { ascending: false });

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch presence records',
        });
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response: PaginatedResponse<Presence> = {
        success: true,
        data: presence as Presence[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
        message: 'Presence records fetched successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getPresenceStats(req: Request, res: Response) {
    try {
      const userId = req.query['user_id'] as string;
      const startDate = req.query['start_date'] as string;
      const endDate = req.query['end_date'] as string;

      let query = supabase
        .from('presence')
        .select('status, timestamp');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }

      if (endDate) {
        query = query.lte('timestamp', endDate);
      }

      const { data: presence, error } = await query;

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch presence statistics',
        });
      }

      const stats = {
        total: presence?.length || 0,
        present: presence?.filter(p => p.status === 'present').length || 0,
        absent: presence?.filter(p => p.status === 'absent').length || 0,
        late: presence?.filter(p => p.status === 'late').length || 0,
        attendanceRate: 0,
      };

      if (stats.total > 0) {
        stats.attendanceRate = Math.round((stats.present / stats.total) * 100);
      }

      const response: ApiResponse = {
        success: true,
        data: stats,
        message: 'Presence statistics fetched successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
