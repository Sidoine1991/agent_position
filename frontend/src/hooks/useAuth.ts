import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '../utils/supabase';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'supervisor';
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setUser({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        avatar: data.avatar,
        created_at: data.created_at,
        updated_at: data.updated_at,
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role: string = 'agent') => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
          },
        },
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}
