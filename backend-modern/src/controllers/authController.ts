import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { LoginRequest, RegisterRequest, ApiResponse } from '../types';

const supabaseUrl = process.env['SUPABASE_URL'] || '';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password }: LoginRequest = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required',
        });
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(401).json({
          success: false,
          error: error.message,
        });
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch user profile',
        });
      }

      const response: ApiResponse = {
        success: true,
        data: {
          user: {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role,
            avatar: profile.avatar,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
          },
          session: data.session,
        },
        message: 'Login successful',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const { email, password, name, role }: RegisterRequest = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          error: 'Email, password, and name are required',
        });
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: role || 'agent',
          },
        },
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      const response: ApiResponse = {
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
        message: 'Registration successful. Please check your email to confirm your account.',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async logout(_req: Request, res: Response) {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }

      const response: ApiResponse = {
        success: true,
        message: 'Logout successful',
      };

      return res.json(response);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async refreshToken(req: Request, res: Response) {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required',
        });
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token,
      });

      if (error) {
        return res.status(401).json({
          success: false,
          error: error.message,
        });
      }

      const response: ApiResponse = {
        success: true,
        data: {
          session: data.session,
        },
        message: 'Token refreshed successfully',
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
