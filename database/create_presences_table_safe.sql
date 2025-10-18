-- Script sécurisé pour créer les tables presences et les liens
-- Presence CCRB - Création sécurisée des tables

-- 1. Créer la table presences si elle n'existe pas
CREATE TABLE IF NOT EXISTS presences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_name VARCHAR(255),
    location_address TEXT,
    notes TEXT,
    photo_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    checkin_type VARCHAR(50) DEFAULT 'checkin' CHECK (checkin_type IN ('checkin', 'checkout', 'start_mission', 'end_mission', 'break_start', 'break_end')),
    mission_id INTEGER,
    project_id INTEGER,
    village_id INTEGER,
    commune_id INTEGER,
    departement_id INTEGER,
    distance_from_office DECIMAL(8, 2),
    accuracy DECIMAL(8, 2),
    battery_level INTEGER,
    network_type VARCHAR(20),
    device_info JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Créer la table missions si elle n'existe pas
CREATE TABLE IF NOT EXISTS missions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'suspended')),
    project_id INTEGER,
    village_id INTEGER,
    commune_id INTEGER,
    departement_id INTEGER,
    expected_start_time TIME,
    expected_end_time TIME,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Créer la table checkins si elle n'existe pas
CREATE TABLE IF NOT EXISTS checkins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    mission_id INTEGER,
    lat DECIMAL(10, 8) NOT NULL,
    lon DECIMAL(11, 8) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50) DEFAULT 'checkin' CHECK (type IN ('checkin', 'checkout', 'start_mission', 'end_mission', 'break_start', 'break_end')),
    note TEXT,
    photo_url VARCHAR(500),
    accuracy DECIMAL(8, 2),
    battery_level INTEGER,
    network_type VARCHAR(20),
    device_info JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Créer les tables géographiques si elles n'existent pas
CREATE TABLE IF NOT EXISTS departements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    population INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    departement_id INTEGER,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    population INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS villages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    commune_id INTEGER,
    departement_id INTEGER,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    population INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Ajouter les contraintes de clés étrangères de manière sécurisée
-- Contrainte presences -> users
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE presences 
        ADD CONSTRAINT fk_presences_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Contrainte missions -> users
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE missions 
        ADD CONSTRAINT fk_missions_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Contrainte checkins -> users
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE checkins 
        ADD CONSTRAINT fk_checkins_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Contrainte checkins -> missions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'missions') THEN
        ALTER TABLE checkins 
        ADD CONSTRAINT fk_checkins_mission 
        FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Contraintes géographiques
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communes') THEN
        ALTER TABLE villages 
        ADD CONSTRAINT fk_villages_commune 
        FOREIGN KEY (commune_id) REFERENCES communes(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departements') THEN
        ALTER TABLE villages 
        ADD CONSTRAINT fk_villages_departement 
        FOREIGN KEY (departement_id) REFERENCES departements(id) ON DELETE SET NULL;
        
        ALTER TABLE communes 
        ADD CONSTRAINT fk_communes_departement 
        FOREIGN KEY (departement_id) REFERENCES departements(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Créer les index de manière sécurisée
-- Index pour presences
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presences' AND column_name = 'user_id') THEN
        CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presences' AND column_name = 'start_time') THEN
        CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presences' AND column_name = 'end_time') THEN
        CREATE INDEX IF NOT EXISTS idx_presences_end_time ON presences(end_time);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presences' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_presences_status ON presences(status);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presences' AND column_name = 'checkin_type') THEN
        CREATE INDEX IF NOT EXISTS idx_presences_checkin_type ON presences(checkin_type);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presences' AND column_name = 'mission_id') THEN
        CREATE INDEX IF NOT EXISTS idx_presences_mission_id ON presences(mission_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presences' AND column_name = 'village_id') THEN
        CREATE INDEX IF NOT EXISTS idx_presences_village_id ON presences(village_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presences' AND column_name = 'commune_id') THEN
        CREATE INDEX IF NOT EXISTS idx_presences_commune_id ON presences(commune_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presences' AND column_name = 'departement_id') THEN
        CREATE INDEX IF NOT EXISTS idx_presences_departement_id ON presences(departement_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presences' AND column_name = 'location_lat') THEN
        CREATE INDEX IF NOT EXISTS idx_presences_location ON presences(location_lat, location_lng);
    END IF;
END $$;

-- Index pour missions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'missions' AND column_name = 'user_id') THEN
        CREATE INDEX IF NOT EXISTS idx_missions_user_id ON missions(user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'missions' AND column_name = 'start_date') THEN
        CREATE INDEX IF NOT EXISTS idx_missions_start_date ON missions(start_date);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'missions' AND column_name = 'end_date') THEN
        CREATE INDEX IF NOT EXISTS idx_missions_end_date ON missions(end_date);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'missions' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
    END IF;
END $$;

-- Index pour checkins
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checkins' AND column_name = 'user_id') THEN
        CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON checkins(user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checkins' AND column_name = 'mission_id') THEN
        CREATE INDEX IF NOT EXISTS idx_checkins_mission_id ON checkins(mission_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checkins' AND column_name = 'timestamp') THEN
        CREATE INDEX IF NOT EXISTS idx_checkins_timestamp ON checkins(timestamp);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checkins' AND column_name = 'type') THEN
        CREATE INDEX IF NOT EXISTS idx_checkins_type ON checkins(type);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checkins' AND column_name = 'lat') THEN
        CREATE INDEX IF NOT EXISTS idx_checkins_location ON checkins(lat, lon);
    END IF;
END $$;

-- Index pour les tables géographiques
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'villages' AND column_name = 'commune_id') THEN
        CREATE INDEX IF NOT EXISTS idx_villages_commune_id ON villages(commune_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'villages' AND column_name = 'departement_id') THEN
        CREATE INDEX IF NOT EXISTS idx_villages_departement_id ON villages(departement_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'villages' AND column_name = 'name') THEN
        CREATE INDEX IF NOT EXISTS idx_villages_name ON villages(name);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communes' AND column_name = 'departement_id') THEN
        CREATE INDEX IF NOT EXISTS idx_communes_departement_id ON communes(departement_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communes' AND column_name = 'name') THEN
        CREATE INDEX IF NOT EXISTS idx_communes_name ON communes(name);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departements' AND column_name = 'code') THEN
        CREATE INDEX IF NOT EXISTS idx_departements_code ON departements(code);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departements' AND column_name = 'name') THEN
        CREATE INDEX IF NOT EXISTS idx_departements_name ON departements(name);
    END IF;
END $$;

-- 7. Insérer des données de base pour les départements
INSERT INTO departements (name, code) VALUES 
('Alibori', 'AL'),
('Atacora', 'AT'),
('Atlantique', 'AQ'),
('Borgou', 'BO'),
('Collines', 'CO'),
('Couffo', 'CF'),
('Donga', 'DO'),
('Littoral', 'LI'),
('Mono', 'MO'),
('Ouémé', 'OU'),
('Plateau', 'PL'),
('Zou', 'ZO')
ON CONFLICT (code) DO NOTHING;

-- 8. Créer les triggers pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer les triggers de manière sécurisée
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presences') THEN
        DROP TRIGGER IF EXISTS update_presences_updated_at ON presences;
        CREATE TRIGGER update_presences_updated_at 
        BEFORE UPDATE ON presences 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'missions') THEN
        DROP TRIGGER IF EXISTS update_missions_updated_at ON missions;
        CREATE TRIGGER update_missions_updated_at 
        BEFORE UPDATE ON missions 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 9. Créer les vues de manière sécurisée
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presences') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        
        DROP VIEW IF EXISTS presences_summary;
        CREATE VIEW presences_summary AS
        SELECT 
            p.id,
            u.name as user_name,
            u.email,
            u.role,
            p.start_time,
            p.end_time,
            p.location_name,
            p.status,
            p.checkin_type,
            m.title as mission_title,
            v.name as village_name,
            c.name as commune_name,
            d.name as departement_name,
            EXTRACT(EPOCH FROM (p.end_time - p.start_time))/3600 as duration_hours
        FROM presences p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN missions m ON p.mission_id = m.id
        LEFT JOIN villages v ON p.village_id = v.id
        LEFT JOIN communes c ON p.commune_id = c.id
        LEFT JOIN departements d ON p.departement_id = d.id;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checkins') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        
        DROP VIEW IF EXISTS checkins_summary;
        CREATE VIEW checkins_summary AS
        SELECT 
            c.id,
            u.name as user_name,
            u.email,
            u.role,
            c.timestamp,
            c.lat,
            c.lon,
            c.type,
            c.note,
            m.title as mission_title,
            v.name as village_name,
            co.name as commune_name,
            d.name as departement_name
        FROM checkins c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN missions m ON c.mission_id = m.id
        LEFT JOIN villages v ON m.village_id = v.id
        LEFT JOIN communes co ON m.commune_id = co.id
        LEFT JOIN departements d ON m.departement_id = d.id;
    END IF;
END $$;

-- 10. Ajouter les commentaires
COMMENT ON TABLE presences IS 'Table des présences des agents avec géolocalisation et informations de mission';
COMMENT ON TABLE missions IS 'Table des missions assignées aux agents';
COMMENT ON TABLE checkins IS 'Table des points de contrôle (check-ins) des agents';
COMMENT ON TABLE villages IS 'Table des villages pour la géolocalisation';
COMMENT ON TABLE communes IS 'Table des communes pour la géolocalisation';
COMMENT ON TABLE departements IS 'Table des départements pour la géolocalisation';

-- Message de confirmation
SELECT 'Tables créées avec succès!' as message;
