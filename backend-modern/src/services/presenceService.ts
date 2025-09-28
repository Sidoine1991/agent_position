import { createClient } from '@supabase/supabase-js';
import { Presence, PresenceRequest } from '../types';

const supabaseUrl = process.env['SUPABASE_URL'] || '';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class PresenceService {
  static async markPresence(userId: string, presenceData: PresenceRequest) {
    try {
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
        return { success: false, error: 'Failed to mark presence' };
      }

      return {
        success: true,
        data: presence as Presence,
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to mark presence' 
      };
    }
  }

  static async getUserPresence(userId: string, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;

      const { data: presence, error, count } = await supabase
        .from('presence')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .range(offset, offset + limit - 1)
        .order('timestamp', { ascending: false });

      if (error) {
        return { success: false, error: 'Failed to fetch presence records' };
      }

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        success: true,
        data: presence as Presence[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch presence records' 
      };
    }
  }

  static async getAllPresence(filters: {
    userId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const { page = 1, limit = 10, userId, status, startDate, endDate } = filters;
      const offset = (page - 1) * limit;

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
        return { success: false, error: 'Failed to fetch presence records' };
      }

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        success: true,
        data: presence as Presence[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch presence records' 
      };
    }
  }

  static async getPresenceStats(filters: {
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    try {
      const { userId, startDate, endDate } = filters;

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
        return { success: false, error: 'Failed to fetch presence statistics' };
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

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch presence statistics' 
      };
    }
  }

  static async getPresenceById(presenceId: string) {
    try {
      const { data: presence, error } = await supabase
        .from('presence')
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            email,
            role
          )
        `)
        .eq('id', presenceId)
        .single();

      if (error) {
        return { success: false, error: 'Presence record not found' };
      }

      return {
        success: true,
        data: presence as Presence,
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch presence record' 
      };
    }
  }
}
