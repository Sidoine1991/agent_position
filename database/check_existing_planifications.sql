-- Script pour vérifier les planifications existantes dans la table

-- Vérifier la structure de la table planifications
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'planifications' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Vérifier les données existantes
SELECT 
    id,
    user_id,
    date,
    planned_start_time,
    planned_end_time,
    description_activite,
    resultat_journee,
    observations,
    project_name,
    created_at
FROM planifications 
ORDER BY date DESC, user_id
LIMIT 10;

-- Compter le nombre total de planifications
SELECT COUNT(*) as total_planifications FROM planifications;

-- Vérifier les planifications par utilisateur
SELECT 
    u.name as user_name,
    u.email,
    u.role,
    COUNT(p.id) as nb_planifications
FROM users u
LEFT JOIN planifications p ON u.id = p.user_id
GROUP BY u.id, u.name, u.email, u.role
ORDER BY nb_planifications DESC;

-- Vérifier les planifications par projet
SELECT 
    project_name,
    COUNT(*) as nb_planifications
FROM planifications 
WHERE project_name IS NOT NULL
GROUP BY project_name
ORDER BY nb_planifications DESC;
