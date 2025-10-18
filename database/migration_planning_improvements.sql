-- Migration pour les améliorations de suivi d'activité des agents
-- Ajout des projets, descriptions d'activités et résultats de journée

-- Table des projets
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'suspended', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de liaison entre utilisateurs et projets
CREATE TABLE IF NOT EXISTS user_projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('manager', 'member', 'observer')),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, project_id)
);

-- Modification de la table planifications pour ajouter les nouveaux champs
ALTER TABLE planifications 
ADD COLUMN IF NOT EXISTS description_activite TEXT,
ADD COLUMN IF NOT EXISTS resultat_journee VARCHAR(20) CHECK (resultat_journee IN ('realise', 'partiellement_realise', 'non_realise', 'en_cours')),
ADD COLUMN IF NOT EXISTS observations TEXT,
ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project_id ON user_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_planifications_project_id ON planifications(project_id);
CREATE INDEX IF NOT EXISTS idx_planifications_resultat_journee ON planifications(resultat_journee);

-- Insertion de projets par défaut
INSERT INTO projects (name, description, status) VALUES 
('Projet Général', 'Projet par défaut pour les activités générales', 'active'),
('Formation Agricole', 'Formation des agriculteurs sur les nouvelles techniques', 'active'),
('Suivi Terrain', 'Suivi et accompagnement des agriculteurs sur le terrain', 'active')
ON CONFLICT DO NOTHING;

-- Assigner tous les utilisateurs existants au projet général
INSERT INTO user_projects (user_id, project_id, role)
SELECT u.id, p.id, 'member'
FROM users u, projects p 
WHERE p.name = 'Projet Général'
ON CONFLICT (user_id, project_id) DO NOTHING;
