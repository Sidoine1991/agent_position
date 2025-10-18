-- =====================================================
-- Script de vérification des tables existantes
-- Affiche l'état actuel de la base de données
-- =====================================================

-- Vérifier l'existence de la table users (table de base)
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') 
        THEN '✅ Table users existe'
        ELSE '❌ Table users manquante - CRITIQUE'
    END as status_users;

-- Vérifier les tables des systèmes avancés
WITH required_tables AS (
    SELECT unnest(ARRAY[
        -- Système de messagerie
        'conversations', 'conversation_participants', 'messages', 'message_read_status',
        -- Système d'urgence
        'emergency_contacts', 'emergency_alerts', 'emergency_notifications',
        -- Système de rapports enrichis
        'report_types', 'enriched_reports', 'report_media',
        -- Système de planification intelligente
        'route_optimizations', 'planning_conflicts', 'optimization_suggestions',
        -- Système de tableau de bord agent
        'personal_goals', 'badges', 'user_badges', 'achievements', 'leaderboard',
        -- Système d'aide intégrée
        'tutorials', 'tutorial_progress', 'faqs', 'contextual_help',
        -- Système d'analytics et insights
        'performance_metrics', 'insights', 'predictions', 'analytics_data',
        -- Système de géolocalisation avancée
        'gps_positions', 'geographic_zones', 'geofencing_events',
        -- Système de notifications push
        'notification_subscriptions', 'notifications',
        -- Système de cache hors-ligne
        'offline_sync'
    ]) as table_name
)
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = rt.table_name) 
        THEN '✅ Existe'
        ELSE '❌ Manquante'
    END as status
FROM required_tables rt
ORDER BY 
    CASE 
        WHEN table_name IN ('conversations', 'messages', 'emergency_contacts', 'emergency_alerts') THEN 1
        WHEN table_name IN ('enriched_reports', 'report_media', 'personal_goals', 'badges') THEN 2
        WHEN table_name IN ('tutorials', 'faqs', 'performance_metrics', 'insights') THEN 3
        WHEN table_name IN ('gps_positions', 'notifications', 'offline_sync') THEN 4
        ELSE 5
    END,
    table_name;

-- Vérifier les index existants
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN (
    'conversations', 'messages', 'emergency_alerts', 'enriched_reports',
    'gps_positions', 'performance_metrics', 'personal_goals', 'leaderboard'
)
ORDER BY tablename, indexname;

-- Vérifier les triggers existants
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE event_object_table IN (
    'conversations', 'messages', 'enriched_reports', 'personal_goals',
    'leaderboard', 'tutorials', 'faqs', 'contextual_help', 'notification_subscriptions'
)
ORDER BY event_object_table, trigger_name;

-- Vérifier les politiques RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN (
    'conversations', 'messages', 'emergency_contacts', 'emergency_alerts',
    'enriched_reports', 'personal_goals', 'user_badges', 'gps_positions',
    'notifications', 'offline_sync'
)
ORDER BY tablename, policyname;

-- Vérifier les données initiales (seulement si les tables existent)
DO $$
BEGIN
    -- Vérifier et compter les types de rapports
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_types') THEN
        RAISE NOTICE 'Types de rapports: %', (SELECT COUNT(*) FROM report_types);
    ELSE
        RAISE NOTICE 'Table report_types: Non créée';
    END IF;
    
    -- Vérifier et compter les badges
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'badges') THEN
        RAISE NOTICE 'Badges: %', (SELECT COUNT(*) FROM badges);
    ELSE
        RAISE NOTICE 'Table badges: Non créée';
    END IF;
    
    -- Vérifier et compter les tutoriels
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tutorials') THEN
        RAISE NOTICE 'Tutoriels: %', (SELECT COUNT(*) FROM tutorials);
    ELSE
        RAISE NOTICE 'Table tutorials: Non créée';
    END IF;
    
    -- Vérifier et compter les FAQ
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faqs') THEN
        RAISE NOTICE 'FAQ: %', (SELECT COUNT(*) FROM faqs);
    ELSE
        RAISE NOTICE 'Table faqs: Non créée';
    END IF;
    
    -- Vérifier et compter l'aide contextuelle
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contextual_help') THEN
        RAISE NOTICE 'Aide contextuelle: %', (SELECT COUNT(*) FROM contextual_help);
    ELSE
        RAISE NOTICE 'Table contextual_help: Non créée';
    END IF;
END $$;

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
    AND tc.table_name IN (
        'conversations', 'conversation_participants', 'messages', 'message_read_status',
        'emergency_contacts', 'emergency_alerts', 'emergency_notifications',
        'enriched_reports', 'report_media', 'personal_goals', 'user_badges',
        'achievements', 'leaderboard', 'tutorial_progress', 'performance_metrics',
        'insights', 'predictions', 'analytics_data', 'gps_positions',
        'geofencing_events', 'notification_subscriptions', 'notifications', 'offline_sync'
    )
ORDER BY tc.table_name, tc.constraint_name;

-- Statistiques des tables
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename IN (
    'conversations', 'messages', 'emergency_alerts', 'enriched_reports',
    'gps_positions', 'performance_metrics', 'personal_goals', 'leaderboard'
)
ORDER BY tablename, attname;

-- Vérifier l'espace utilisé par les tables
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename IN (
    'conversations', 'messages', 'emergency_alerts', 'enriched_reports',
    'gps_positions', 'performance_metrics', 'personal_goals', 'leaderboard'
)
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Résumé final
SELECT 
    'RÉSUMÉ DE LA BASE DE DONNÉES' as summary,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_schema = 'public') as total_triggers,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies;