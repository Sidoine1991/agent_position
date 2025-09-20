// Types de base pour l'application

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'supervisor' | 'agent';

export interface Agent {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  departement: string;
  commune: string;
  arrondissement?: string;
  village?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PresenceRecord {
  id: number;
  agentId: number;
  missionId?: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  photo?: string;
  notes?: string;
  startTime: Date;
  endTime?: Date;
  status: PresenceStatus;
  validated: boolean;
  validatedBy?: number;
  validatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PresenceStatus = 'present' | 'absent' | 'pending' | 'invalid';

export interface Mission {
  id: number;
  agentId: number;
  title: string;
  description?: string;
  departement: string;
  commune: string;
  arrondissement?: string;
  village?: string;
  startDate: Date;
  endDate?: Date;
  status: MissionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type MissionStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  timestamp: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
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

export interface LoginResponse {
  token: string;
  user: Omit<User, 'password'>;
  expiresIn: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
}

export interface CreateAgentRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  departement: string;
  commune: string;
  arrondissement?: string;
  village?: string;
}

export interface UpdateAgentRequest extends Partial<CreateAgentRequest> {
  id: number;
}

export interface PresenceRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
  photo?: File;
  notes?: string;
  missionId?: number;
}

export interface FilterOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  departement?: string;
  commune?: string;
  status?: PresenceStatus;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ValidationResult {
  isValid: boolean;
  distance?: number;
  message?: string;
}

export interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  totalPresences: number;
  todayPresences: number;
  pendingValidations: number;
  recentActivities: Activity[];
}

export interface Activity {
  id: number;
  type: 'presence' | 'mission' | 'agent' | 'validation';
  description: string;
  agentName: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Types pour les erreurs
export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
}

// Types pour les middlewares
export interface AuthenticatedRequest extends Request {
  user?: Omit<User, 'password'>;
}

// Types pour les validations Zod
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Types pour les exports
export interface ExportOptions {
  format: 'excel' | 'csv' | 'pdf';
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: FilterOptions;
}

// Types pour les notifications
export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
}
