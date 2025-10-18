-- =====================================================
-- Script de test pour vérifier la configuration de la base de données
-- Teste les fonctionnalités principales des systèmes avancés
-- =====================================================

-- =====================================================
-- 1. TEST DES TABLES PRINCIPALES
-- =====================================================

DO $$
DECLARE
    test_user_id UUID;
    test_conversation_id UUID;
    test_report_id UUID;
    test_goal_id UUID;
    test_badge_id UUID;
    test_alert_id UUID;
    test_metric_id UUID;
    test_insight_id UUID;
    test_notification_id UUID;
    test_zone_id UUID;
    test_position_id UUID;
BEGIN
    RAISE NOTICE '🧪 Début des tests de la base de données...';
    
    -- Créer un utilisateur de test
    INSERT INTO users (first_name, last_name, email, password, role, is_active)
    VALUES ('Test', 'User', 'test@ccrb.bj', 'hashed_password', 'agent', true)
    RETURNING id INTO test_user_id;
    
    RAISE NOTICE '✅ Utilisateur de test créé: %', test_user_id;
    
    -- =====================================================
    -- 2. TEST DU SYSTÈME DE MESSAGERIE
    -- =====================================================
    
    -- Créer une conversation de test
    INSERT INTO conversations (name, type, created_by, is_active)
    VALUES ('Test Conversation', 'direct', test_user_id, true)
    RETURNING id INTO test_conversation_id;
    
    -- Ajouter l'utilisateur à la conversation
    INSERT INTO conversation_participants (conversation_id, user_id, is_active)
    VALUES (test_conversation_id, test_user_id, true);
    
    -- Créer un message de test
    INSERT INTO messages (conversation_id, sender_id, content, message_type)
    VALUES (test_conversation_id, test_user_id, 'Message de test', 'text');
    
    RAISE NOTICE '✅ Système de messagerie testé';
    
    -- =====================================================
    -- 3. TEST DU SYSTÈME D'URGENCE
    -- =====================================================
    
    -- Créer un contact d'urgence
    INSERT INTO emergency_contacts (user_id, name, phone, role, priority, is_active)
    VALUES (test_user_id, 'Contact Test', '+22912345678', 'supervisor', 1, true);
    
    -- Créer une alerte d'urgence
    INSERT INTO emergency_alerts (user_id, alert_type, status, latitude, longitude, message)
    VALUES (test_user_id, 'sos', 'active', 7.188506, 2.079116, 'Test d''alerte d''urgence')
    RETURNING id INTO test_alert_id;
    
    RAISE NOTICE '✅ Système d''urgence testé';
    
    -- =====================================================
    -- 4. TEST DU SYSTÈME DE RAPPORTS ENRICHIS
    -- =====================================================
    
    -- Créer un rapport enrichi
    INSERT INTO enriched_reports (user_id, report_type_id, title, description, form_data, status)
    VALUES (
        test_user_id,
        (SELECT id FROM report_types WHERE name = 'mission' LIMIT 1),
        'Rapport de test',
        'Description du rapport de test',
        '{"mission_title": "Test Mission", "description": "Mission de test"}'::jsonb,
        'draft'
    )
    RETURNING id INTO test_report_id;
    
    -- Créer un fichier média
    INSERT INTO report_media (report_id, media_type, file_url, file_name, mime_type)
    VALUES (test_report_id, 'photo', '/test/image.jpg', 'test_image.jpg', 'image/jpeg');
    
    RAISE NOTICE '✅ Système de rapports enrichis testé';
    
    -- =====================================================
    -- 5. TEST DU SYSTÈME DE TABLEAU DE BORD AGENT
    -- =====================================================
    
    -- Créer un objectif personnel
    INSERT INTO personal_goals (user_id, title, description, goal_type, target_value, current_value, unit, status)
    VALUES (test_user_id, 'Test Goal', 'Objectif de test', 'missions', 10, 0, 'missions', 'active')
    RETURNING id INTO test_goal_id;
    
    -- Attribuer un badge
    INSERT INTO user_badges (user_id, badge_id, earned_at, progress)
    VALUES (
        test_user_id,
        (SELECT id FROM badges WHERE name = 'Débutant' LIMIT 1),
        NOW(),
        100
    );
    
    -- Créer une réalisation
    INSERT INTO achievements (user_id, title, description, achievement_type, icon)
    VALUES (test_user_id, 'Test Achievement', 'Réalisation de test', 'milestone', '🎯');
    
    -- Créer une entrée de classement
    INSERT INTO leaderboard (user_id, period, period_start, period_end, score, missions_completed, field_time_hours, attendance_rate, efficiency_score)
    VALUES (test_user_id, 'monthly', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 85, 5, 40, 95, 90);
    
    RAISE NOTICE '✅ Système de tableau de bord agent testé';
    
    -- =====================================================
    -- 6. TEST DU SYSTÈME D'ANALYTICS
    -- =====================================================
    
    -- Créer une métrique de performance
    INSERT INTO performance_metrics (user_id, metric_type, metric_name, metric_value, period_start, period_end, period_type)
    VALUES (test_user_id, 'attendance', 'taux_presence', 95.5, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 'monthly')
    RETURNING id INTO test_metric_id;
    
    -- Créer un insight
    INSERT INTO insights (insight_type, category, title, description, impact, actionable, recommendations, target_users, status)
    VALUES (
        'info',
        'performance',
        'Test Insight',
        'Insight de test pour vérifier le système',
        'medium',
        true,
        '["Recommandation 1", "Recommandation 2"]'::jsonb,
        ARRAY[test_user_id],
        'active'
    )
    RETURNING id INTO test_insight_id;
    
    -- Créer une prédiction
    INSERT INTO predictions (prediction_type, target_date, predicted_value, confidence_score, factors, target_users)
    VALUES (
        'attendance',
        CURRENT_DATE + INTERVAL '7 days',
        98.0,
        85.5,
        '{"factor1": "historique", "factor2": "saison"}'::jsonb,
        ARRAY[test_user_id]
    );
    
    RAISE NOTICE '✅ Système d''analytics testé';
    
    -- =====================================================
    -- 7. TEST DU SYSTÈME DE GÉOLOCALISATION
    -- =====================================================
    
    -- Créer une zone géographique
    INSERT INTO geographic_zones (name, description, zone_type, coordinates, is_active, created_by)
    VALUES (
        'Zone Test',
        'Zone de test pour les fonctionnalités GPS',
        'work',
        '{"type": "circle", "center": [7.188506, 2.079116], "radius": 1000}'::jsonb,
        true,
        test_user_id
    )
    RETURNING id INTO test_zone_id;
    
    -- Créer une position GPS
    INSERT INTO gps_positions (user_id, latitude, longitude, accuracy, timestamp, is_emergency)
    VALUES (test_user_id, 7.188506, 2.079116, 5.0, NOW(), false)
    RETURNING id INTO test_position_id;
    
    -- Créer un événement de géofencing
    INSERT INTO geofencing_events (user_id, zone_id, event_type, latitude, longitude, timestamp)
    VALUES (test_user_id, test_zone_id, 'enter', 7.188506, 2.079116, NOW());
    
    RAISE NOTICE '✅ Système de géolocalisation testé';
    
    -- =====================================================
    -- 8. TEST DU SYSTÈME DE NOTIFICATIONS
    -- =====================================================
    
    -- Créer une notification
    INSERT INTO notifications (user_id, title, body, notification_type, status, data)
    VALUES (
        test_user_id,
        'Test Notification',
        'Notification de test pour vérifier le système',
        'test',
        'sent',
        '{"test": true}'::jsonb
    )
    RETURNING id INTO test_notification_id;
    
    RAISE NOTICE '✅ Système de notifications testé';
    
    -- =====================================================
    -- 9. TEST DU SYSTÈME DE CACHE HORS-LIGNE
    -- =====================================================
    
    -- Créer une entrée de synchronisation
    INSERT INTO offline_sync (user_id, table_name, record_id, action, data, sync_status)
    VALUES (
        test_user_id,
        'test_table',
        'test_record_123',
        'create',
        '{"test": "data"}'::jsonb,
        'pending'
    );
    
    RAISE NOTICE '✅ Système de cache hors-ligne testé';
    
    -- =====================================================
    -- 10. NETTOYAGE DES DONNÉES DE TEST
    -- =====================================================
    
    -- Supprimer les données de test (en ordre inverse des dépendances)
    DELETE FROM offline_sync WHERE user_id = test_user_id;
    DELETE FROM notifications WHERE user_id = test_user_id;
    DELETE FROM geofencing_events WHERE user_id = test_user_id;
    DELETE FROM gps_positions WHERE user_id = test_user_id;
    DELETE FROM geographic_zones WHERE created_by = test_user_id;
    DELETE FROM predictions WHERE target_users @> ARRAY[test_user_id];
    DELETE FROM insights WHERE target_users @> ARRAY[test_user_id];
    DELETE FROM performance_metrics WHERE user_id = test_user_id;
    DELETE FROM leaderboard WHERE user_id = test_user_id;
    DELETE FROM achievements WHERE user_id = test_user_id;
    DELETE FROM user_badges WHERE user_id = test_user_id;
    DELETE FROM personal_goals WHERE user_id = test_user_id;
    DELETE FROM report_media WHERE report_id = test_report_id;
    DELETE FROM enriched_reports WHERE user_id = test_user_id;
    DELETE FROM emergency_notifications WHERE alert_id = test_alert_id;
    DELETE FROM emergency_alerts WHERE user_id = test_user_id;
    DELETE FROM emergency_contacts WHERE user_id = test_user_id;
    DELETE FROM message_read_status WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = test_conversation_id);
    DELETE FROM messages WHERE conversation_id = test_conversation_id;
    DELETE FROM conversation_participants WHERE conversation_id = test_conversation_id;
    DELETE FROM conversations WHERE id = test_conversation_id;
    DELETE FROM users WHERE id = test_user_id;
    
    RAISE NOTICE '✅ Données de test nettoyées';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ====================================================';
    RAISE NOTICE '✅ TOUS LES TESTS DE BASE DE DONNÉES RÉUSSIS!';
    RAISE NOTICE '🎉 ====================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tests effectués:';
    RAISE NOTICE '   ✅ Système de messagerie interne';
    RAISE NOTICE '   ✅ Système d''urgence';
    RAISE NOTICE '   ✅ Système de rapports enrichis';
    RAISE NOTICE '   ✅ Système de tableau de bord agent';
    RAISE NOTICE '   ✅ Système d''analytics et insights';
    RAISE NOTICE '   ✅ Système de géolocalisation avancée';
    RAISE NOTICE '   ✅ Système de notifications push';
    RAISE NOTICE '   ✅ Système de cache hors-ligne';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 La base de données est prête pour la production!';
    RAISE NOTICE '';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Erreur lors des tests: %', SQLERRM;
        RAISE NOTICE '🔧 Veuillez vérifier la configuration de la base de données';
        
        -- Nettoyage en cas d'erreur
        BEGIN
            DELETE FROM users WHERE email = 'test@ccrb.bj';
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;
        
        RAISE;
END $$;

-- =====================================================
-- 11. VÉRIFICATION DES CONTRAINTES ET RELATIONS
-- =====================================================

-- Vérifier que toutes les contraintes de clés étrangères sont respectées
DO $$
DECLARE
    constraint_violations INTEGER;
BEGIN
    -- Compter les violations de contraintes
    SELECT COUNT(*) INTO constraint_violations
    FROM (
        -- Vérifier les contraintes de clés étrangères
        SELECT 1 FROM conversation_participants cp
        LEFT JOIN conversations c ON cp.conversation_id = c.id
        WHERE c.id IS NULL
        
        UNION ALL
        
        SELECT 1 FROM messages m
        LEFT JOIN conversations c ON m.conversation_id = c.id
        WHERE c.id IS NULL
        
        UNION ALL
        
        SELECT 1 FROM emergency_contacts ec
        LEFT JOIN users u ON ec.user_id = u.id
        WHERE u.id IS NULL
        
        UNION ALL
        
        SELECT 1 FROM enriched_reports er
        LEFT JOIN users u ON er.user_id = u.id
        WHERE u.id IS NULL
        
        UNION ALL
        
        SELECT 1 FROM personal_goals pg
        LEFT JOIN users u ON pg.user_id = u.id
        WHERE u.id IS NULL
    ) violations;
    
    IF constraint_violations = 0 THEN
        RAISE NOTICE '✅ Toutes les contraintes de clés étrangères sont respectées';
    ELSE
        RAISE NOTICE '❌ % violations de contraintes détectées', constraint_violations;
    END IF;
END $$;

-- =====================================================
-- 12. VÉRIFICATION DES INDEX
-- =====================================================

-- Vérifier que les index critiques existent
DO $$
DECLARE
    missing_indexes TEXT[] := ARRAY[]::TEXT[];
    index_name TEXT;
BEGIN
    -- Vérifier les index critiques
    FOR index_name IN 
        SELECT unnest(ARRAY[
            'idx_messages_conversation_id',
            'idx_messages_sender_id',
            'idx_emergency_alerts_user_id',
            'idx_enriched_reports_user_id',
            'idx_gps_positions_user_id',
            'idx_performance_metrics_user_id',
            'idx_personal_goals_user_id',
            'idx_leaderboard_user_id'
        ])
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = index_name
        ) THEN
            missing_indexes := array_append(missing_indexes, index_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_indexes, 1) IS NULL THEN
        RAISE NOTICE '✅ Tous les index critiques sont présents';
    ELSE
        RAISE NOTICE '⚠️ Index manquants: %', array_to_string(missing_indexes, ', ');
    END IF;
END $$;

-- =====================================================
-- 13. VÉRIFICATION DES TRIGGERS
-- =====================================================

-- Vérifier que les triggers critiques existent
DO $$
DECLARE
    missing_triggers TEXT[] := ARRAY[]::TEXT[];
    trigger_name TEXT;
BEGIN
    -- Vérifier les triggers critiques
    FOR trigger_name IN 
        SELECT unnest(ARRAY[
            'update_conversations_updated_at',
            'update_messages_updated_at',
            'update_enriched_reports_updated_at',
            'update_personal_goals_updated_at',
            'update_leaderboard_updated_at'
        ])
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = trigger_name
        ) THEN
            missing_triggers := array_append(missing_triggers, trigger_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_triggers, 1) IS NULL THEN
        RAISE NOTICE '✅ Tous les triggers critiques sont présents';
    ELSE
        RAISE NOTICE '⚠️ Triggers manquants: %', array_to_string(missing_triggers, ', ');
    END IF;
END $$;

-- =====================================================
-- 14. RÉSUMÉ FINAL
-- =====================================================

SELECT 
    'RÉSUMÉ FINAL DES TESTS' as test_summary,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_schema = 'public') as total_triggers,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
    (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
    (SELECT COUNT(*) FROM report_types) as report_types,
    (SELECT COUNT(*) FROM badges) as badges,
    (SELECT COUNT(*) FROM tutorials) as tutorials,
    (SELECT COUNT(*) FROM faqs) as faqs;
