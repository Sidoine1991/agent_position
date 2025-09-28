export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'supervisor';
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export interface Presence {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: string;
  status: 'present' | 'absent' | 'late';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  start_date: string;
  end_date?: string;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  title: string;
  content: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  generated_by: string;
  period_start: string;
  period_end: string;
  data: any;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'agent' | 'supervisor';
}

export interface PresenceRequest {
  latitude: number;
  longitude: number;
  address?: string;
  status: 'present' | 'absent' | 'late';
  notes?: string;
}

export interface ReportRequest {
  title: string;
  content: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  period_start: string;
  period_end: string;
}
