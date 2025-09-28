// Supabase configuration
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

// API endpoints
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// App configuration
export const APP_CONFIG = {
  name: 'Presence CCR-B',
  version: '2.0.0',
  description: 'Système de gestion de présence des agents CCR-B',
  author: 'CCR-B Team',
  supportEmail: 'support@ccrb.bj',
  website: 'https://ccrb.bj',
};

// Feature flags
export const FEATURES = {
  GPS_TRACKING: true,
  OFFLINE_MODE: true,
  PUSH_NOTIFICATIONS: true,
  BIOMETRIC_AUTH: false,
  DARK_MODE: true,
  MULTI_LANGUAGE: false,
};

// Map configuration
export const MAP_CONFIG = {
  defaultCenter: {
    lat: 6.3725, // Cotonou, Benin
    lng: 2.3544,
  },
  defaultZoom: 10,
  maxZoom: 18,
  minZoom: 3,
};

// GPS configuration
export const GPS_CONFIG = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 300000, // 5 minutes
  distanceFilter: 10, // meters
};

// Cache configuration
export const CACHE_CONFIG = {
  maxAge: 5 * 60 * 1000, // 5 minutes
  maxSize: 50, // items
};

// Notification configuration
export const NOTIFICATION_CONFIG = {
  position: 'top-right',
  duration: 4000,
  maxNotifications: 5,
};
