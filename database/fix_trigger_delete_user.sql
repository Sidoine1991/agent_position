-- Correction du trigger pour gérer correctement la suppression d'utilisateurs
-- Le problème : le trigger essaie d'insérer des valeurs NULL lors de la suppression

-- Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS trigger_update_weekly_planning_summary ON planifications;

-- Recréer la fonction avec gestion correcte des suppressions
CREATE OR REPLACE FUNCTION update_weekly_planning_summary()
RETURNS TRIGGER AS $$
DECLARE
    week_start DATE;
    week_end DATE;
    total_hours DECIMAL(5,2);
    total_days INTEGER;
    activities_text TEXT;
    target_user_id INTEGER;
    target_date DATE;
    target_project_id INTEGER;
BEGIN
    -- Déterminer les valeurs selon le type d'opération
    IF TG_OP = 'DELETE' THEN
        target_user_id := OLD.user_id;
        target_date := OLD.date;
        target_project_id := OLD.project_id;
    ELSE
        target_user_id := NEW.user_id;
        target_date := NEW.date;
        target_project_id := NEW.project_id;
    END IF;
    
    -- Calculer le début et la fin de la semaine (lundi à dimanche)
    week_start := DATE_TRUNC('week', target_date)::DATE;
    week_end := week_start + INTERVAL '6 days';
    
    -- Pour les suppressions, supprimer directement le récap hebdomadaire
    IF TG_OP = 'DELETE' THEN
        DELETE FROM weekly_planning_summary 
        WHERE user_id = target_user_id 
        AND week_start_date = week_start
        AND (project_id = target_project_id OR (target_project_id IS NULL AND project_id IS NULL));
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
    WHERE user_id = target_user_id 
    AND date >= week_start 
    AND date <= week_end
    AND (project_id = target_project_id OR (target_project_id IS NULL AND project_id IS NULL));
    
    -- Créer un résumé des activités de la semaine
    SELECT STRING_AGG(
        COALESCE(description_activite, 'Activité sans description'), 
        ' | '
        ORDER BY date
    )
    INTO activities_text
    FROM planifications 
    WHERE user_id = target_user_id 
    AND date >= week_start 
    AND date <= week_end
    AND (project_id = target_project_id OR (target_project_id IS NULL AND project_id IS NULL))
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
        target_user_id, 
        week_start, 
        week_end, 
        total_hours, 
        total_days, 
        activities_text, 
        target_project_id
    )
    ON CONFLICT (user_id, week_start_date, project_id)
    DO UPDATE SET
        total_planned_hours = EXCLUDED.total_planned_hours,
        total_planned_days = EXCLUDED.total_days,
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

-- Nettoyer les enregistrements orphelins dans weekly_planning_summary
-- (au cas où il y en aurait déjà)
DELETE FROM weekly_planning_summary 
WHERE user_id NOT IN (SELECT id FROM users);

-- Afficher un message de confirmation
SELECT 'Trigger corrigé avec succès. La suppression d''utilisateurs devrait maintenant fonctionner.' as message;
