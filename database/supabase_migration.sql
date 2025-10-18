-- Migration Supabase pour Presence CCRB
-- Ce script crée toutes les tables manquantes dans Supabase

-- Table des utilisateurs (si elle n'existe pas déjà)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'superviseur', 'agent')),
    phone VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(6),
    verification_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Champs supplémentaires pour les agents
    departement VARCHAR(255),
    commune VARCHAR(255),
    arrondissement VARCHAR(255),
    village VARCHAR(255),
    project_name VARCHAR(255),
    expected_days_per_month INTEGER,
    expected_hours_per_month INTEGER,
    contract_start_date DATE,
    contract_end_date DATE,
    years_of_service DECIMAL(4,2),
    reference_lat DECIMAL(10, 8),
    reference_lon DECIMAL(11, 8),
    tolerance_radius_meters INTEGER,
    planning_start_date DATE,
    planning_end_date DATE,
    photo_path VARCHAR(500)
);

-- Table des codes de validation
CREATE TABLE IF NOT EXISTS verification_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des présences
CREATE TABLE IF NOT EXISTS presences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_name VARCHAR(255),
    notes TEXT,
    photo_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    checkin_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des absences
CREATE TABLE IF NOT EXISTS absences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    reason VARCHAR(255) DEFAULT 'Non marquage de présence avant 18h',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Table des rapports
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    content TEXT,
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des missions
CREATE TABLE IF NOT EXISTS missions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    agent_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des check-ins
CREATE TABLE IF NOT EXISTS checkins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    lat DECIMAL(10, 8),
    lon DECIMAL(11, 8),
    type VARCHAR(50),
    notes TEXT,
    photo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des départements
CREATE TABLE IF NOT EXISTS departements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des communes
CREATE TABLE IF NOT EXISTS communes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    departement_id INTEGER REFERENCES departements(id),
    code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des villages
CREATE TABLE IF NOT EXISTS villages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    commune_id INTEGER REFERENCES communes(id),
    code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des projets
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de liaison utilisateurs-projets
CREATE TABLE IF NOT EXISTS user_projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    project_id INTEGER REFERENCES projects(id),
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, project_id)
);

-- Table des planifications
CREATE TABLE IF NOT EXISTS planifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    planned_start_time TIME,
    planned_end_time TIME,
    description_activite TEXT,
    project_name VARCHAR(255),
    project_id INTEGER REFERENCES projects(id),
    resultat_journee VARCHAR(50) CHECK (resultat_journee IN ('realise', 'partiellement_realise', 'non_realise', 'en_cours')),
    observations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Table des récapitulatifs hebdomadaires
CREATE TABLE IF NOT EXISTS weekly_planning_summary (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    project_name VARCHAR(255),
    total_planned INTEGER DEFAULT 0,
    total_completed INTEGER DEFAULT 0,
    total_partial INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    total_in_progress INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, week_start_date, project_name)
);

-- Table des paramètres de l'application
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_missions_user_id ON missions(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_planifications_user_id ON planifications(user_id);
CREATE INDEX IF NOT EXISTS idx_planifications_date ON planifications(date);
CREATE INDEX IF NOT EXISTS idx_weekly_summary_user_id ON weekly_planning_summary(user_id);

-- Insertion des paramètres par défaut
INSERT INTO app_settings (key, value, description) VALUES
('app_name', 'Presence CCRB', 'Nom de l''application'),
('app_version', '1.0.0', 'Version de l''application'),
('default_tolerance_radius', '50000', 'Rayon de tolérance par défaut en mètres'),
('default_latitude', '6.3725', 'Latitude par défaut'),
('default_longitude', '2.3542', 'Longitude par défaut'),
('email_verification_enabled', 'true', 'Activation de la vérification par email'),
('max_verification_attempts', '3', 'Nombre maximum de tentatives de vérification')
ON CONFLICT (key) DO NOTHING;

-- Insertion des départements par défaut (Bénin)
INSERT INTO departements (name, code) VALUES
('Atlantique', 'AT'),
('Borgou', 'BO'),
('Collines', 'CO'),
('Couffo', 'CF'),
('Donga', 'DO'),
('Littoral', 'LI'),
('Mono', 'MO'),
('Ouémé', 'OU'),
('Plateau', 'PL'),
('Zou', 'ZO')
ON CONFLICT DO NOTHING;

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour mettre à jour updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Politique RLS (Row Level Security) pour Supabase
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE planifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Politiques de base (à adapter selon vos besoins)
-- Les utilisateurs peuvent voir leurs propres données
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view own presences" ON presences FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can insert own presences" ON presences FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update own presences" ON presences FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Politiques pour les admins (voir toutes les données)
CREATE POLICY "Admins can view all users" ON users FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::integer AND role = 'admin')
);

CREATE POLICY "Admins can view all presences" ON presences FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::integer AND role IN ('admin', 'superviseur'))
);

-- Commentaires sur les tables
COMMENT ON TABLE users IS 'Table des utilisateurs du système';
COMMENT ON TABLE presences IS 'Table des présences des agents';
COMMENT ON TABLE missions IS 'Table des missions assignées aux agents';
COMMENT ON TABLE checkins IS 'Table des check-ins GPS des agents';
COMMENT ON TABLE planifications IS 'Table des planifications d''activités';
COMMENT ON TABLE reports IS 'Table des rapports générés';
COMMENT ON TABLE app_settings IS 'Table des paramètres de l''application';
