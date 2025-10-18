-- Script de test pour vérifier que les tables de planification sont correctement créées

-- Vérifier l'existence des tables
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('projects', 'user_projects', 'planifications', 'weekly_planning_summary') 
        THEN '✅ Table créée'
        ELSE '❌ Table manquante'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('projects', 'user_projects', 'planifications', 'weekly_planning_summary')
ORDER BY table_name;

-- Vérifier les colonnes de la table planifications
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'planifications' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Vérifier les colonnes de la table weekly_planning_summary
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'weekly_planning_summary' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Vérifier les contraintes de clés étrangères
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('planifications', 'weekly_planning_summary', 'user_projects')
ORDER BY tc.table_name, tc.constraint_name;

-- Vérifier les index
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('planifications', 'weekly_planning_summary', 'projects', 'user_projects')
ORDER BY tablename, indexname;

-- Vérifier les projets par défaut
SELECT id, name, description, status FROM projects ORDER BY id;

-- Vérifier les utilisateurs assignés au projet général
SELECT 
    up.id,
    u.name as user_name,
    u.email,
    p.name as project_name,
    up.role
FROM user_projects up
JOIN users u ON up.user_id = u.id
JOIN projects p ON up.project_id = p.id
WHERE p.name = 'Projet Général'
ORDER BY u.name;
