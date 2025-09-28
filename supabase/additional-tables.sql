-- Tables supplémentaires pour Presence CCRB
-- Exécuter dans Supabase SQL Editor

-- 1. Table des départements
CREATE TABLE IF NOT EXISTS departements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  region VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des communes
CREATE TABLE IF NOT EXISTS communes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  departement_id BIGINT REFERENCES departements(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table des arrondissements
CREATE TABLE IF NOT EXISTS arrondissements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  commune_id BIGINT REFERENCES communes(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table des villages
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

-- 5. Table des unités administratives
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

-- 6. Table des paramètres système
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

-- 7. Table des rapports personnalisés
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

-- 8. Table des notifications
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

-- 9. Table des sessions utilisateur
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

-- 10. Table des logs d'activité
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

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_communes_departement ON communes(departement_id);
CREATE INDEX IF NOT EXISTS idx_arrondissements_commune ON arrondissements(commune_id);
CREATE INDEX IF NOT EXISTS idx_villages_arrondissement ON villages(arrondissement_id);
CREATE INDEX IF NOT EXISTS idx_admin_units_parent ON admin_units(parent_id);
CREATE INDEX IF NOT EXISTS idx_admin_units_manager ON admin_units(manager_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

-- RLS pour les nouvelles tables
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

-- Politiques RLS pour les tables géographiques (lecture publique)
CREATE POLICY "Geographic data is publicly readable" ON departements FOR SELECT USING (true);
CREATE POLICY "Geographic data is publicly readable" ON communes FOR SELECT USING (true);
CREATE POLICY "Geographic data is publicly readable" ON arrondissements FOR SELECT USING (true);
CREATE POLICY "Geographic data is publicly readable" ON villages FOR SELECT USING (true);

-- Politiques RLS pour les unités administratives
CREATE POLICY "Admin units are publicly readable" ON admin_units FOR SELECT USING (true);
CREATE POLICY "Admin units can be managed by admins" ON admin_units FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Politiques RLS pour les paramètres système
CREATE POLICY "Public settings are readable by all" ON system_settings FOR SELECT USING (is_public = true);
CREATE POLICY "All settings readable by admins" ON system_settings FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Settings can be updated by admins" ON system_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Politiques RLS pour les rapports personnalisés
CREATE POLICY "Users can read their own reports" ON custom_reports FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage their own reports" ON custom_reports FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins can read all reports" ON custom_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
);

-- Politiques RLS pour les notifications
CREATE POLICY "Users can read their own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON notifications FOR INSERT USING (true);

-- Politiques RLS pour les sessions
CREATE POLICY "Users can read their own sessions" ON user_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage their own sessions" ON user_sessions FOR ALL USING (user_id = auth.uid());

-- Politiques RLS pour les logs d'activité
CREATE POLICY "Activity logs readable by admins" ON activity_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Activity logs can be created by system" ON activity_logs FOR INSERT USING (true);
