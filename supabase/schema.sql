-- =====================================================
-- SCHEMA COMPLET POUR PRESENCE CCRB
-- =====================================================
-- Exécuter ce fichier dans Supabase SQL Editor
-- Ce fichier contient TOUTES les tables, index, RLS et politiques

-- =====================================================
-- 1. TABLES PRINCIPALES
-- =====================================================

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  first_name TEXT,
  last_name TEXT,
  name TEXT GENERATED ALWAYS AS (COALESCE(first_name || ' ' || last_name, email)) STORED,
  role TEXT CHECK (role IN ('admin','supervisor','agent')) DEFAULT 'agent',
  phone TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_code TEXT,
  verification_expires TIMESTAMPTZ,
  photo_path TEXT,
  reference_lat NUMERIC(10,8),
  reference_lon NUMERIC(11,8),
  tolerance_radius_meters INTEGER DEFAULT 100,
  departement TEXT,
  commune TEXT,
  arrondissement TEXT,
  village TEXT,
  project_name TEXT,
  expected_days_per_month INTEGER DEFAULT 20,
  expected_hours_per_month INTEGER DEFAULT 160,
  planning_start_date DATE,
  planning_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des missions
CREATE TABLE IF NOT EXISTS missions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  date_start TIMESTAMPTZ,
  date_end TIMESTAMPTZ,
  status TEXT CHECK (status IN ('active','completed','cancelled')) DEFAULT 'active',
  village_id BIGINT,
  departement TEXT,
  commune TEXT,
  arrondissement TEXT,
  village TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des checkins
CREATE TABLE IF NOT EXISTS checkins (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mission_id BIGINT REFERENCES missions(id) ON DELETE CASCADE,
  lat NUMERIC(10,8),
  lon NUMERIC(11,8),
  note TEXT,
  photo_path TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des absences
CREATE TABLE IF NOT EXISTS absences (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des rapports
CREATE TABLE IF NOT EXISTS reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des codes de vérification
CREATE TABLE IF NOT EXISTS verification_codes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des paramètres de l'application
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. TABLES GÉOGRAPHIQUES
-- =====================================================

-- Table des départements
CREATE TABLE IF NOT EXISTS departements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  region VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des communes
CREATE TABLE IF NOT EXISTS communes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  departement_id BIGINT REFERENCES departements(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des arrondissements
CREATE TABLE IF NOT EXISTS arrondissements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  commune_id BIGINT REFERENCES communes(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des villages
CREATE TABLE IF NOT EXISTS villages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  arrondissement_id BIGINT REFERENCES arrondissements(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  population INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. TABLES ADMINISTRATIVES
-- =====================================================

-- Table des unités administratives
CREATE TABLE IF NOT EXISTS admin_units (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'departement', 'commune', 'arrondissement', 'village'
  parent_id BIGINT REFERENCES admin_units(id),
  manager_id BIGINT REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des paramètres système
CREATE TABLE IF NOT EXISTS system_settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category VARCHAR(50) NOT NULL, -- 'general', 'work', 'notifications', 'geolocation'
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, key)
);

-- =====================================================
-- 4. TABLES DE FONCTIONNALITÉS AVANCÉES
-- =====================================================

-- Table des rapports personnalisés
CREATE TABLE IF NOT EXISTS custom_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  report_type VARCHAR(50) NOT NULL, -- 'presence', 'performance', 'geographic', 'custom'
  filters JSONB,
  columns JSONB,
  schedule JSONB, -- pour les rapports programmés
  is_public BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'info', 'warning', 'error', 'success'
  category VARCHAR(50) NOT NULL, -- 'presence', 'system', 'report', 'admin'
  is_read BOOLEAN DEFAULT FALSE,
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des sessions utilisateur
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(500) UNIQUE NOT NULL,
  device_info JSONB,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des logs d'activité
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'user', 'mission', 'checkin', 'report'
  entity_id BIGINT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. INDEX POUR LES PERFORMANCES
-- =====================================================

-- Index pour les tables principales
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(is_verified);
CREATE INDEX IF NOT EXISTS idx_missions_agent ON missions(agent_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_dates ON missions(date_start, date_end);
CREATE INDEX IF NOT EXISTS idx_checkins_mission ON checkins(mission_id);
CREATE INDEX IF NOT EXISTS idx_checkins_timestamp ON checkins(timestamp);
CREATE INDEX IF NOT EXISTS idx_absences_user ON absences(user_id);
CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(date);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);

-- Index pour les tables géographiques
CREATE INDEX IF NOT EXISTS idx_communes_departement ON communes(departement_id);
CREATE INDEX IF NOT EXISTS idx_arrondissements_commune ON arrondissements(commune_id);
CREATE INDEX IF NOT EXISTS idx_villages_arrondissement ON villages(arrondissement_id);

-- Index pour les tables administratives
CREATE INDEX IF NOT EXISTS idx_admin_units_parent ON admin_units(parent_id);
CREATE INDEX IF NOT EXISTS idx_admin_units_manager ON admin_units(manager_id);
CREATE INDEX IF NOT EXISTS idx_admin_units_active ON admin_units(is_active);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_public ON system_settings(is_public);

-- Index pour les fonctionnalités avancées
CREATE INDEX IF NOT EXISTS idx_custom_reports_user ON custom_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_active ON custom_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

-- =====================================================
-- 6. FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction pour extraire l'email du JWT
CREATE OR REPLACE FUNCTION public.jwt_email() 
RETURNS TEXT LANGUAGE SQL STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', '')
$$;

-- Fonction pour vérifier le rôle admin
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = public.jwt_email() AND role = 'admin'
  )
$$;

-- Fonction pour vérifier le rôle superviseur ou admin
CREATE OR REPLACE FUNCTION public.is_supervisor_or_admin() 
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = public.jwt_email() AND role IN ('admin', 'supervisor')
  )
$$;

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Activer RLS pour toutes les tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE departements ENABLE ROW LEVEL SECURITY;
ALTER TABLE communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE arrondissements ENABLE ROW LEVEL SECURITY;
ALTER TABLE villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. POLITIQUES RLS
-- =====================================================

-- Révoquer les permissions par défaut
REVOKE ALL ON TABLE users FROM anon, authenticated, public;
REVOKE ALL ON TABLE missions FROM anon, authenticated, public;
REVOKE ALL ON TABLE checkins FROM anon, authenticated, public;
REVOKE ALL ON TABLE absences FROM anon, authenticated, public;
REVOKE ALL ON TABLE reports FROM anon, authenticated, public;
REVOKE ALL ON TABLE verification_codes FROM anon, authenticated, public;
REVOKE ALL ON TABLE app_settings FROM anon, authenticated, public;

-- Accorder les permissions de base
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE missions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE checkins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE absences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reports TO authenticated;
GRANT SELECT ON TABLE app_settings TO authenticated;

-- Politiques pour la table users
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (email = public.jwt_email());

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (email = public.jwt_email()) WITH CHECK (email = public.jwt_email());

CREATE POLICY "Admins can view all user profiles" ON users
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can create users" ON users
  FOR INSERT USING (public.is_admin());

CREATE POLICY "Admins can update all user profiles" ON users
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (public.is_admin());

-- Politiques pour la table missions
CREATE POLICY "Agents can view their own missions" ON missions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = missions.agent_id AND email = public.jwt_email())
  );

CREATE POLICY "Agents can create their own missions" ON missions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = missions.agent_id AND email = public.jwt_email())
  );

CREATE POLICY "Agents can update their own missions" ON missions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = missions.agent_id AND email = public.jwt_email())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = missions.agent_id AND email = public.jwt_email())
  );

CREATE POLICY "Admins and supervisors can view all missions" ON missions
  FOR SELECT USING (public.is_supervisor_or_admin());

CREATE POLICY "Admins and supervisors can create missions for any agent" ON missions
  FOR INSERT USING (public.is_supervisor_or_admin());

CREATE POLICY "Admins and supervisors can update all missions" ON missions
  FOR UPDATE USING (public.is_supervisor_or_admin());

-- Politiques pour la table checkins
CREATE POLICY "Agents can view their own checkins" ON checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM missions m
      JOIN users u ON u.id = m.agent_id
      WHERE m.id = checkins.mission_id AND u.email = public.jwt_email()
    )
  );

CREATE POLICY "Agents can create their own checkins" ON checkins
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM missions m
      JOIN users u ON u.id = m.agent_id
      WHERE m.id = checkins.mission_id AND u.email = public.jwt_email()
    )
  );

CREATE POLICY "Admins and supervisors can view all checkins" ON checkins
  FOR SELECT USING (public.is_supervisor_or_admin());

-- Politiques pour la table absences
CREATE POLICY "Users can view their own absences" ON absences
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = absences.user_id AND email = public.jwt_email())
  );

CREATE POLICY "Users can create their own absences" ON absences
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = absences.user_id AND email = public.jwt_email())
  );

CREATE POLICY "Admins and supervisors can view all absences" ON absences
  FOR SELECT USING (public.is_supervisor_or_admin());

-- Politiques pour la table reports
CREATE POLICY "Users can view their own reports" ON reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = reports.user_id AND email = public.jwt_email())
  );

CREATE POLICY "Users can create their own reports" ON reports
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = reports.user_id AND email = public.jwt_email())
  );

CREATE POLICY "Admins and supervisors can view all reports" ON reports
  FOR SELECT USING (public.is_supervisor_or_admin());

-- Politiques pour verification_codes (service-role only)
-- Aucune politique publique - accès uniquement via service role

-- Politiques pour app_settings (lecture publique)
CREATE POLICY "App settings are publicly readable" ON app_settings
  FOR SELECT USING (true);

-- Politiques pour les données géographiques (lecture publique)
CREATE POLICY "Geographic data is publicly readable" ON departements
  FOR SELECT USING (true);

CREATE POLICY "Geographic data is publicly readable" ON communes
  FOR SELECT USING (true);

CREATE POLICY "Geographic data is publicly readable" ON arrondissements
  FOR SELECT USING (true);

CREATE POLICY "Geographic data is publicly readable" ON villages
  FOR SELECT USING (true);

-- Politiques pour admin_units
CREATE POLICY "Admin units are publicly readable" ON admin_units
  FOR SELECT USING (true);

CREATE POLICY "Admin units can be managed by admins" ON admin_units
  FOR ALL USING (public.is_admin());

-- Politiques pour system_settings
CREATE POLICY "Public settings are readable by all" ON system_settings
  FOR SELECT USING (is_public = true);

CREATE POLICY "All settings readable by admins" ON system_settings
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Settings can be updated by admins" ON system_settings
  FOR ALL USING (public.is_admin());

-- Politiques pour custom_reports
CREATE POLICY "Users can read their own reports" ON custom_reports
  FOR SELECT USING (user_id = (SELECT id FROM users WHERE email = public.jwt_email()));

CREATE POLICY "Users can manage their own reports" ON custom_reports
  FOR ALL USING (user_id = (SELECT id FROM users WHERE email = public.jwt_email()));

CREATE POLICY "Admins can read all reports" ON custom_reports
  FOR SELECT USING (public.is_supervisor_or_admin());

-- Politiques pour notifications
CREATE POLICY "Users can read their own notifications" ON notifications
  FOR SELECT USING (user_id = (SELECT id FROM users WHERE email = public.jwt_email()));

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = (SELECT id FROM users WHERE email = public.jwt_email()));

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT USING (true);

-- Politiques pour user_sessions
CREATE POLICY "Users can read their own sessions" ON user_sessions
  FOR SELECT USING (user_id = (SELECT id FROM users WHERE email = public.jwt_email()));

CREATE POLICY "Users can manage their own sessions" ON user_sessions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE email = public.jwt_email()));

-- Politiques pour activity_logs
CREATE POLICY "Activity logs readable by admins" ON activity_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Activity logs can be created by system" ON activity_logs
  FOR INSERT USING (true);

-- =====================================================
-- 9. DONNÉES INITIALES
-- =====================================================

-- Insérer les paramètres par défaut
INSERT INTO app_settings (key, value) VALUES
  ('app_name', '"Presence CCRB"'),
  ('version', '"2.0.0"'),
  ('maintenance_mode', 'false'),
  ('registration_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Insérer les paramètres système par défaut
INSERT INTO system_settings (category, key, value, description, is_public) VALUES
  ('general', 'organization_name', '{"value": "CCRB"}', 'Nom de l''organisation', true),
  ('general', 'timezone', '{"value": "Africa/Porto-Novo"}', 'Fuseau horaire par défaut', true),
  ('work', 'work_hours', '{"start": "08:00", "end": "17:00"}', 'Heures de travail par défaut', true),
  ('work', 'tolerance_minutes', '{"value": 15}', 'Tolérance de retard en minutes', true),
  ('work', 'auto_checkout', '{"enabled": true}', 'Déconnexion automatique en fin de journée', true),
  ('geolocation', 'geolocation_required', '{"enabled": true}', 'Géolocalisation obligatoire pour marquer la présence', true),
  ('geolocation', 'default_coordinates', '{"latitude": 6.4969, "longitude": 2.6036}', 'Coordonnées par défaut (Porto-Novo)', true),
  ('notifications', 'email_notifications', '{"enabled": true}', 'Notifications par email activées', true),
  ('notifications', 'push_notifications', '{"enabled": true}', 'Notifications push activées', true),
  ('notifications', 'reminder_time', '{"time": "08:30"}', 'Heure de rappel quotidien', true)
ON CONFLICT (category, key) DO NOTHING;

-- =====================================================
-- FIN DU SCHEMA
-- =====================================================
