-- Correction du trigger pour utiliser les bonnes colonnes de la table planifications
-- Le problème : le trigger utilisait project_id qui n'existe pas, il faut utiliser project_name

-- Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS trigger_update_weekly_planning_summary ON planifications;

-- Recréer la fonction avec les bonnes colonnes
CREATE OR REPLACE FUNCTION update_weekly_planning_summary()
RETURNS TRIGGER AS $$
DECLARE
    week_start DATE;
    week_end DATE;
    total_hours DECIMAL(5,2);
    total_days INTEGER;
    activities_text TEXT;
    target_user_id INTEGER;
    target_agent_id INTEGER;
    target_date DATE;
    target_project_name VARCHAR(255);
BEGIN
    -- Déterminer les valeurs selon le type d'opération
    IF TG_OP = 'DELETE' THEN
        target_user_id := OLD.user_id;
        target_agent_id := OLD.agent_id;
        target_date := OLD.date;
        target_project_name := OLD.project_name;
    ELSE
        target_user_id := NEW.user_id;
        target_agent_id := NEW.agent_id;
        target_date := NEW.date;
        target_project_name := NEW.project_name;
    END IF;
    
    -- Calculer le début et la fin de la semaine (lundi à dimanche)
    week_start := DATE_TRUNC('week', target_date)::DATE;
    week_end := week_start + INTERVAL '6 days';
    
    -- Pour les suppressions, supprimer directement le récap hebdomadaire
    IF TG_OP = 'DELETE' THEN
        DELETE FROM weekly_planning_summary 
        WHERE user_id = target_user_id 
        AND week_start_date = week_start
        AND (project_name = target_project_name OR (target_project_name IS NULL AND project_name IS NULL));
        RETURN OLD;
    END IF;
    
    -- Pour INSERT/UPDATE, calculer le total des heures planifiées pour la semaine
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
    WHERE (user_id = target_user_id OR agent_id = target_agent_id)
    AND date >= week_start 
    AND date <= week_end
    AND (project_name = target_project_name OR (target_project_name IS NULL AND project_name IS NULL));
    
    -- Créer un résumé des activités de la semaine
    SELECT STRING_AGG(
        COALESCE(description_activite, 'Activité sans description'), 
        ' | '
        ORDER BY date
    )
    INTO activities_text
    FROM planifications 
    WHERE (user_id = target_user_id OR agent_id = target_agent_id)
    AND date >= week_start 
    AND date <= week_end
    AND (project_name = target_project_name OR (target_project_name IS NULL AND project_name IS NULL))
    AND description_activite IS NOT NULL;
    
    -- Insérer ou mettre à jour le récap hebdomadaire
    -- Utiliser project_name au lieu de project_id
    INSERT INTO weekly_planning_summary (
        user_id, 
        week_start_date, 
        week_end_date, 
        total_planned_hours, 
        total_planned_days, 
        activities_summary, 
        project_name
    )
    VALUES (
        target_user_id, 
        week_start, 
        week_end, 
        total_hours, 
        total_days, 
        activities_text, 
        target_project_name
    )
    ON CONFLICT (user_id, week_start_date, project_name)
    DO UPDATE SET
        total_planned_hours = EXCLUDED.total_planned_hours,
        total_planned_days = EXCLUDED.total_planned_days,
        activities_summary = EXCLUDED.activities_summary,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recréer le trigger
CREATE TRIGGER trigger_update_weekly_planning_summary
    AFTER INSERT OR UPDATE OR DELETE ON planifications
    FOR EACH ROW
    EXECUTE FUNCTION update_weekly_planning_summary();

-- Vérifier que la table weekly_planning_summary a la bonne structure
-- Si elle a encore project_id, la modifier
DO $$
BEGIN
    -- Vérifier si la colonne project_id existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'weekly_planning_summary' 
        AND column_name = 'project_id'
    ) THEN
        -- Ajouter project_name si elle n'existe pas
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'weekly_planning_summary' 
            AND column_name = 'project_name'
        ) THEN
            ALTER TABLE weekly_planning_summary ADD COLUMN project_name VARCHAR(255);
        END IF;
        
        -- Supprimer l'ancienne contrainte unique si elle existe
        ALTER TABLE weekly_planning_summary DROP CONSTRAINT IF EXISTS weekly_planning_summary_user_id_week_start_date_project_id_key;
        
        -- Créer la nouvelle contrainte unique avec project_name
        ALTER TABLE weekly_planning_summary ADD CONSTRAINT weekly_planning_summary_user_id_week_start_date_project_name_key 
        UNIQUE (user_id, week_start_date, project_name);
        
        RAISE NOTICE 'Table weekly_planning_summary mise à jour pour utiliser project_name';
    END IF;
END $$;

-- Nettoyer les enregistrements orphelins dans weekly_planning_summary
DELETE FROM weekly_planning_summary 
WHERE user_id NOT IN (SELECT id FROM users);

-- Afficher un message de confirmation
SELECT 'Trigger corrigé avec succès. Utilise maintenant project_name au lieu de project_id.' as message;
