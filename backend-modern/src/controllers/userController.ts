import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ApiResponse, PaginatedResponse, User } from '../types';

const supabaseUrl = process.env['SUPABASE_URL'] || '';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class UserController {
  static async getAllUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const offset = (page - 1) * limit;

      const { data: users, error, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch users',
        });
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response: PaginatedResponse<User> = {
        success: true,
        data: users as User[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
        message: 'Users fetched successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const { data: user, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const response: ApiResponse<User> = {
        success: true,
        data: user as User,
        message: 'User fetched successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Remove sensitive fields that shouldn't be updated directly
      delete updates.id;
      delete updates.created_at;
      delete updates.updated_at;

      const { data: user, error } = await supabase
        .from('profiles')
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
          error: 'Failed to update user',
        });
      }

      const response: ApiResponse<User> = {
        success: true,
        data: user as User,
        message: 'User updated successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to delete user',
        });
      }

      const response: ApiResponse = {
        success: true,
        message: 'User deleted successfully',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getCurrentUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { data: user, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const response: ApiResponse<User> = {
        success: true,
        data: user as User,
        message: 'Current user fetched successfully',
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
