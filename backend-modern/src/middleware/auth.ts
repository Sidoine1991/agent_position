import { Request, Response, NextFunction } from 'express';
// import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { User } from '../types';

const supabaseUrl = process.env['SUPABASE_URL'] || '';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface AuthRequest extends Request {
  user?: User;
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
      });
      return;
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      res.status(401).json({
        success: false,
        error: 'User profile not found',
      });
      return;
    }

    req.user = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      avatar: profile.avatar,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Token verification failed',
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};
