import { createClient } from '@supabase/supabase-js';
import { User, LoginRequest, RegisterRequest } from '../types';

const supabaseUrl = process.env['SUPABASE_URL'] || '';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class AuthService {
  static async login(credentials: LoginRequest) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        return { success: false, error: 'Failed to fetch user profile' };
      }

      return {
        success: true,
        data: {
          user: profile as User,
          session: data.session,
        },
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
  }

  static async register(userData: RegisterRequest) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            role: userData.role || 'agent',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          user: data.user,
          session: data.session,
        },
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Registration failed' 
      };
    }
  }

  static async logout() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Logout failed' 
      };
    }
  }

  static async refreshToken(refreshToken: string) {
    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          session: data.session,
        },
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Token refresh failed' 
      };
    }
  }

  static async getUserById(userId: string) {
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return { success: false, error: 'User not found' };
      }

      return {
        success: true,
        data: user as User,
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch user' 
      };
    }
  }

  static async verifyToken(token: string) {
    try {
      const { data, error } = await supabase.auth.getUser(token);

      if (error) {
        return { success: false, error: 'Invalid token' };
      }

      return {
        success: true,
        data: data.user,
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Token verification failed' 
      };
    }
  }
}
