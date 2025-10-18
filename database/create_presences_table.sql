-- Script simple pour créer la table presences manquante
-- Exécutez ce script dans le SQL Editor de Supabase

-- Créer la table presences
CREATE TABLE presences (
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

-- Créer les index pour améliorer les performances (seulement s'ils n'existent pas)
CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);

-- Vérifier que la table a été créée
SELECT 'Table presences créée avec succès!' as message;
SELECT COUNT(*) as count FROM presences;