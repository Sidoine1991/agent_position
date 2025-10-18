-- =====================================================
-- Script de test simple pour vérifier les tables créées
-- =====================================================

-- Vérifier que la table users existe
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
ORDER BY table_name;

-- Vérifier les données initiales
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

-- Vérifier les index créés
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes 
WHERE tablename IN (
    'conversations', 'messages', 'emergency_alerts', 'enriched_reports',
    'gps_positions', 'performance_metrics', 'personal_goals', 'leaderboard'
)
ORDER BY tablename, indexname;

-- Vérifier les triggers créés
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
    cmd
FROM pg_policies 
WHERE tablename IN (
    'conversations', 'messages', 'emergency_contacts', 'emergency_alerts',
    'enriched_reports', 'personal_goals', 'user_badges', 'gps_positions',
    'notifications', 'offline_sync'
)
ORDER BY tablename, policyname;

-- Résumé final
SELECT 
    'RÉSUMÉ DE LA BASE DE DONNÉES' as summary,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_schema = 'public') as total_triggers,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies;
