-- Migration pour créer la table planifications et ajouter les améliorations demandées
-- Création de la table planifications de base

-- Table des planifications
CREATE TABLE IF NOT EXISTS planifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    planned_start_time TIME,
    planned_end_time TIME,
    description_activite TEXT,
    resultat_journee VARCHAR(20) CHECK (resultat_journee IN ('realise', 'partiellement_realise', 'non_realise', 'en_cours')),
    observations TEXT,
    project_id INTEGER, -- Référence sera ajoutée après création de la table projects
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Table pour le récap des activités planifiées par semaine
CREATE TABLE IF NOT EXISTS weekly_planning_summary (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    total_planned_hours DECIMAL(5,2) DEFAULT 0,
    total_planned_days INTEGER DEFAULT 0,
    activities_summary TEXT, -- JSON ou texte pour regrouper les activités de la semaine
    project_id INTEGER, -- Référence sera ajoutée après création de la table projects
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, week_start_date, project_id)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_planifications_user_id ON planifications(user_id);
CREATE INDEX IF NOT EXISTS idx_planifications_date ON planifications(date);
CREATE INDEX IF NOT EXISTS idx_planifications_project_id ON planifications(project_id);
CREATE INDEX IF NOT EXISTS idx_planifications_resultat_journee ON planifications(resultat_journee);
CREATE INDEX IF NOT EXISTS idx_weekly_planning_summary_user_id ON weekly_planning_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_planning_summary_week_start ON weekly_planning_summary(week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_planning_summary_project_id ON weekly_planning_summary(project_id);

-- Fonction pour calculer automatiquement le récap hebdomadaire
CREATE OR REPLACE FUNCTION update_weekly_planning_summary()
RETURNS TRIGGER AS $$
DECLARE
    week_start DATE;
    week_end DATE;
    total_hours DECIMAL(5,2);
    total_days INTEGER;
    activities_text TEXT;
BEGIN
    -- Calculer le début et la fin de la semaine (lundi à dimanche)
    week_start := DATE_TRUNC('week', NEW.date)::DATE;
    week_end := week_start + INTERVAL '6 days';
    
    -- Calculer le total des heures planifiées pour la semaine
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN planned_start_time IS NOT NULL AND planned_end_time IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (planned_end_time - planned_start_time)) / 3600
                ELSE 0 
            END
        ), 0),
        COUNT(DISTINCT date)
    INTO total_hours, total_days
    FROM planifications 
    WHERE user_id = NEW.user_id 
    AND date >= week_start 
    AND date <= week_end
    AND (project_id = NEW.project_id OR (NEW.project_id IS NULL AND project_id IS NULL));
    
    -- Créer un résumé des activités de la semaine
    SELECT STRING_AGG(
        COALESCE(description_activite, 'Activité sans description'), 
        ' | '
        ORDER BY date
    )
    INTO activities_text
    FROM planifications 
    WHERE user_id = NEW.user_id 
    AND date >= week_start 
    AND date <= week_end
    AND (project_id = NEW.project_id OR (NEW.project_id IS NULL AND project_id IS NULL))
    AND description_activite IS NOT NULL;
    
    -- Insérer ou mettre à jour le récap hebdomadaire
    INSERT INTO weekly_planning_summary (
        user_id, 
        week_start_date, 
        week_end_date, 
        total_planned_hours, 
        total_planned_days, 
        activities_summary, 
        project_id
    )
    VALUES (
        NEW.user_id, 
        week_start, 
        week_end, 
        total_hours, 
        total_days, 
        activities_text, 
        NEW.project_id
    )
    ON CONFLICT (user_id, week_start_date, project_id)
    DO UPDATE SET
        total_planned_hours = EXCLUDED.total_planned_hours,
        total_planned_days = EXCLUDED.total_planned_days,
        activities_summary = EXCLUDED.activities_summary,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement le récap hebdomadaire
DROP TRIGGER IF EXISTS trigger_update_weekly_planning_summary ON planifications;
CREATE TRIGGER trigger_update_weekly_planning_summary
    AFTER INSERT OR UPDATE OR DELETE ON planifications
    FOR EACH ROW
    EXECUTE FUNCTION update_weekly_planning_summary();
