export type Role = 'agent' | 'supervisor' | 'admin';

export interface User {
  id: number;
  name: string;
  phone?: string | null;
  email: string;
  password_hash: string;
  role: Role;
  consent_signed_at?: string | null;
  created_at: string;
}

export interface Mission {
  id: number;
  agent_id: number;
  date_start: string;
  date_end?: string | null;
  status: 'active' | 'ended';
  created_at: string;
}

export interface Checkin {
  id: number;
  mission_id: number;
  lat: number;
  lon: number;
  photo_path?: string | null;
  note?: string | null;
  timestamp: string;
}


