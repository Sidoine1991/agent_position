import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, requireRole } from '../middleware/auth';
import { ApiResponse, PaginatedResponse } from '../types';

const router = express.Router();

const supabaseUrl = process.env['SUPABASE_URL'] || 'https://test.supabase.co';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || 'test_key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Get all users (admin only)
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    // Filter by role
    if (role && typeof role === 'string') {
      query = query.eq('role', role);
    }

    // Search by name or email
    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Pagination
    const offset = (Number(page) - 1) * Number(limit);
    query = query.range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users',
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

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      res.status(404).json({
        success: false,
        error: 'User not found',
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

// Update user profile
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, avatar } = req.body;

    // Check if user can update this profile
    if ((req as any).user?.id !== id && (req as any).user?.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        name,
        avatar,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update user',
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      data,
      message: 'User updated successfully',
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete user',
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'User deleted successfully',
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
