
-- Script SQL pour créer les tables manquantes dans Supabase
-- Copiez ce script dans le SQL Editor de Supabase et exécutez-le

-- 1. Créer la table presences
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

-- 2. Créer les index pour presences
CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);

-- 3. Créer la table projects
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Créer la table user_projects
CREATE TABLE IF NOT EXISTS user_projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  project_id INTEGER REFERENCES projects(id),
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, project_id)
);

-- 5. Corriger la table app_settings
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS description TEXT;

-- 6. Insérer des données de test pour projects
INSERT INTO projects (name, description, status) VALUES
('Projet Riz', 'Projet de développement de la culture du riz', 'active'),
('Projet Maïs', 'Projet de développement de la culture du maïs', 'active'),
('Projet Formation', 'Projet de formation des agriculteurs', 'active')
ON CONFLICT DO NOTHING;

-- 7. Vérifier les tables créées
SELECT 'presences' as table_name, COUNT(*) as count FROM presences
UNION ALL
SELECT 'projects' as table_name, COUNT(*) as count FROM projects
UNION ALL
SELECT 'user_projects' as table_name, COUNT(*) as count FROM user_projects;
