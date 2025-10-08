import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ApiResponse, PaginatedResponse, Report, ReportRequest } from '../types';

const supabaseUrl = process.env['SUPABASE_URL'] || 'https://test.supabase.co';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || 'test_key';
const supabase = createClient(supabaseUrl, supabaseKey);

export class ReportController {
  static async generateReport(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const reportData: ReportRequest = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!reportData.title || !reportData.type) {
        return res.status(400).json({
          success: false,
          error: 'Title and type are required',
        });
      }

      // Generate report data based on type and period
      let reportData_content = {};
      
      if (reportData.type === 'daily' || reportData.type === 'weekly' || reportData.type === 'monthly') {
        // Fetch presence data for the specified period
        const { data: presenceData, error: presenceError } = await supabase
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
          .gte('timestamp', reportData.period_start)
          .lte('timestamp', reportData.period_end);

        if (presenceError) {
          return res.status(500).json({
            success: false,
            error: 'Failed to fetch presence data for report',
          });
        }

        // Calculate statistics
        const stats = {
          totalRecords: presenceData?.length || 0,
          present: presenceData?.filter(p => p.status === 'present').length || 0,
          absent: presenceData?.filter(p => p.status === 'absent').length || 0,
          late: presenceData?.filter(p => p.status === 'late').length || 0,
          attendanceRate: 0,
        };

        if (stats.totalRecords > 0) {
          stats.attendanceRate = Math.round((stats.present / stats.totalRecords) * 100);
        }

        reportData_content = {
          statistics: stats,
          presenceData: presenceData,
          period: {
            start: reportData.period_start,
            end: reportData.period_end,
          },
        };
      }

      const { data: report, error } = await supabase
        .from('reports')
        .insert({
          title: reportData.title,
          content: reportData.content,
          type: reportData.type,
          generated_by: userId,
          period_start: reportData.period_start,
          period_end: reportData.period_end,
          data: reportData_content,
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to generate report',
        });
      }

      const response: ApiResponse<Report> = {
        success: true,
        data: report as Report,
        message: 'Report generated successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getAllReports(req: Request, res: Response) {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const offset = (page - 1) * limit;
      const type = req.query['type'] as string;
      const generatedBy = req.query['generated_by'] as string;

      let query = supabase
        .from('reports')
        .select(`
          *,
          profiles:generated_by (
            id,
            name,
            email
          )
        `, { count: 'exact' });

      if (type) {
        query = query.eq('type', type);
      }

      if (generatedBy) {
        query = query.eq('generated_by', generatedBy);
      }

      const { data: reports, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch reports',
        });
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response: PaginatedResponse<Report> = {
        success: true,
        data: reports as Report[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
        message: 'Reports fetched successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getReportById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const { data: report, error } = await supabase
        .from('reports')
        .select(`
          *,
          profiles:generated_by (
            id,
            name,
            email
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        return res.status(404).json({
          success: false,
          error: 'Report not found',
        });
      }

      const response: ApiResponse<Report> = {
        success: true,
        data: report as Report,
        message: 'Report fetched successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async deleteReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      // Check if user has permission to delete this report
      const { data: report, error: fetchError } = await supabase
        .from('reports')
        .select('generated_by')
        .eq('id', id)
        .single();

      if (fetchError) {
        return res.status(404).json({
          success: false,
          error: 'Report not found',
        });
      }

      // Only allow deletion by the creator or admin
      const userRole = (req as any).user?.role;
      if (report.generated_by !== userId && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to delete this report',
        });
      }

      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', id);

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to delete report',
        });
      }

      const response: ApiResponse = {
        success: true,
        message: 'Report deleted successfully',
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
