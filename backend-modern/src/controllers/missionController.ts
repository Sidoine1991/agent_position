import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ApiResponse, PaginatedResponse, Mission } from '../types';

const supabaseUrl = process.env['SUPABASE_URL'] || 'https://test.supabase.co';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || 'test_key';
const supabase = createClient(supabaseUrl, supabaseKey);

export class MissionController {
  static async createMission(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const missionData = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!missionData.title || !missionData.description) {
        return res.status(400).json({
          success: false,
          error: 'Title and description are required',
        });
      }

      const { data: mission, error } = await supabase
        .from('missions')
        .insert({
          title: missionData.title,
          description: missionData.description,
          assigned_to: missionData.assigned_to || userId,
          status: missionData.status || 'pending',
          start_date: missionData.start_date || new Date().toISOString(),
          end_date: missionData.end_date,
          location: missionData.location,
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to create mission',
        });
      }

      const response: ApiResponse<Mission> = {
        success: true,
        data: mission as Mission,
        message: 'Mission created successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getAllMissions(req: Request, res: Response) {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const offset = (page - 1) * limit;
      const status = req.query['status'] as string;
      const assignedTo = req.query['assigned_to'] as string;

      let query = supabase
        .from('missions')
        .select(`
          *,
          profiles:assigned_to (
            id,
            name,
            email,
            role
          )
        `, { count: 'exact' });

      if (status) {
        query = query.eq('status', status);
      }

      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo);
      }

      const { data: missions, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch missions',
        });
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response: PaginatedResponse<Mission> = {
        success: true,
        data: missions as Mission[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
        message: 'Missions fetched successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getMissionById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const { data: mission, error } = await supabase
        .from('missions')
        .select(`
          *,
          profiles:assigned_to (
            id,
            name,
            email,
            role
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        return res.status(404).json({
          success: false,
          error: 'Mission not found',
        });
      }

      const response: ApiResponse<Mission> = {
        success: true,
        data: mission as Mission,
        message: 'Mission fetched successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async updateMission(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      // Check if user has permission to update this mission
      const { data: mission, error: fetchError } = await supabase
        .from('missions')
        .select('assigned_to')
        .eq('id', id)
        .single();

      if (fetchError) {
        return res.status(404).json({
          success: false,
          error: 'Mission not found',
        });
      }

      // Only allow update by the assigned user or admin
      const userRole = (req as any).user?.role;
      if (mission.assigned_to !== userId && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to update this mission',
        });
      }

      // Remove fields that shouldn't be updated directly
      delete updates.id;
      delete updates.created_at;
      delete updates.updated_at;

      const { data: updatedMission, error } = await supabase
        .from('missions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to update mission',
        });
      }

      const response: ApiResponse<Mission> = {
        success: true,
        data: updatedMission as Mission,
        message: 'Mission updated successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async deleteMission(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      // Check if user has permission to delete this mission
      const { data: mission, error: fetchError } = await supabase
        .from('missions')
        .select('assigned_to')
        .eq('id', id)
        .single();

      if (fetchError) {
        return res.status(404).json({
          success: false,
          error: 'Mission not found',
        });
      }

      // Only allow deletion by the assigned user or admin
      const userRole = (req as any).user?.role;
      if (mission.assigned_to !== userId && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to delete this mission',
        });
      }

      const { error } = await supabase
        .from('missions')
        .delete()
        .eq('id', id);

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to delete mission',
        });
      }

      const response: ApiResponse = {
        success: true,
        message: 'Mission deleted successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getMyMissions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const offset = (page - 1) * limit;
      const status = req.query['status'] as string;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      let query = supabase
        .from('missions')
        .select(`
          *,
          profiles:assigned_to (
            id,
            name,
            email,
            role
          )
        `, { count: 'exact' })
        .eq('assigned_to', userId);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: missions, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch missions',
        });
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response: PaginatedResponse<Mission> = {
        success: true,
        data: missions as Mission[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
        message: 'Missions fetched successfully',
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
