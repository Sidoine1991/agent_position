-- =====================================================
-- Script de correction des erreurs de syntaxe
-- Corrige les problèmes spécifiques rencontrés
-- =====================================================

-- =====================================================
-- 1. CORRIGER LES ERREURS DE SYNTAXE JSON
-- =====================================================

-- Vérifier si la table contextual_help existe et corriger les données
DO $$
BEGIN
    -- Vérifier si la table existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contextual_help') THEN
        
        -- Supprimer les données incorrectes si elles existent
        DELETE FROM contextual_help WHERE shortcuts IS NULL OR shortcuts = '{}';
        
        -- Insérer les données correctes
        INSERT INTO contextual_help (page_path, title, description, tips, shortcuts) VALUES
        ('index.html', 'Page d''Accueil', 'Tableau de bord principal avec vue d''ensemble des activités', 
         ARRAY['Utilisez le calendrier pour voir votre historique de présence', 'Les couleurs indiquent votre statut : vert (présent), rouge (absent), orange (hors zone)', 'Cliquez sur une date pour voir les détails de votre présence'],
         '[{"key": "Ctrl + P", "action": "Marquer sa présence"}, {"key": "Ctrl + M", "action": "Voir les missions"}, {"key": "Ctrl + C", "action": "Voir le calendrier"}]'::jsonb),
        ('planning.html', 'Planification', 'Gérez votre planning et vos missions',
         ARRAY['Sélectionnez une semaine pour voir votre planning', 'Utilisez les filtres pour afficher des agents ou projets spécifiques', 'Cliquez sur une mission pour voir les détails'],
         '[{"key": "Ctrl + N", "action": "Nouvelle planification"}, {"key": "Ctrl + F", "action": "Filtrer les données"}, {"key": "Ctrl + S", "action": "Sauvegarder les modifications"}]'::jsonb),
        ('reports.html', 'Rapports', 'Générez et consultez les rapports d''activité',
         ARRAY['Utilisez les filtres pour personnaliser vos rapports', 'Exportez vos rapports en PDF pour les partager', 'Les graphiques montrent l''évolution de vos performances'],
         '[{"key": "Ctrl + G", "action": "Générer un rapport"}, {"key": "Ctrl + E", "action": "Exporter en PDF"}, {"key": "Ctrl + R", "action": "Actualiser les données"}]'::jsonb)
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE '✅ Donnees contextual_help corrigees';
    ELSE
        RAISE NOTICE '⚠️ Table contextual_help n''existe pas encore';
    END IF;
END $$;

-- =====================================================
-- 2. CORRIGER LES ERREURS DE BLOCS DO $$
-- =====================================================

-- Vérifier et corriger les fonctions qui pourraient avoir des erreurs
DO $$
BEGIN
    -- Vérifier si la fonction update_updated_at_column existe
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $func$ language 'plpgsql';
        RAISE NOTICE '✅ Fonction update_updated_at_column créée';
    ELSE
        RAISE NOTICE 'ℹ️ Fonction update_updated_at_column existe déjà';
    END IF;
END $$;

-- =====================================================
-- 3. VÉRIFIER ET CORRIGER LES TABLES MANQUANTES
-- =====================================================

-- Créer les tables de base si elles n'existent pas
DO $$
BEGIN
    -- Vérifier si la table users existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE NOTICE '❌ Table users manquante - Création d''une table de base';
        
        -- Créer une table users de base
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            role VARCHAR(50) DEFAULT 'agent',
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE '✅ Table users créée';
    ELSE
        RAISE NOTICE '✅ Table users existe';
    END IF;
END $$;

-- =====================================================
-- 4. VÉRIFIER LES EXTENSIONS
-- =====================================================

-- Vérifier et créer l'extension uuid-ossp
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        RAISE NOTICE '✅ Extension uuid-ossp créée';
    ELSE
        RAISE NOTICE '✅ Extension uuid-ossp existe déjà';
    END IF;
END $$;

-- =====================================================
-- 5. NETTOYER LES DONNÉES CORROMPUES
-- =====================================================

-- Nettoyer les données qui pourraient causer des problèmes
DO $$
DECLARE
    table_name TEXT;
    tables_to_clean TEXT[] := ARRAY[
        'contextual_help', 'tutorials', 'faqs', 'badges', 'report_types'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_clean
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name) THEN
            -- Supprimer les enregistrements avec des données JSON invalides
            EXECUTE format('DELETE FROM %I WHERE shortcuts IS NULL OR shortcuts = ''{}''', table_name);
            EXECUTE format('DELETE FROM %I WHERE steps IS NULL OR steps = ''{}''', table_name);
            EXECUTE format('DELETE FROM %I WHERE criteria IS NULL OR criteria = ''{}''', table_name);
            EXECUTE format('DELETE FROM %I WHERE form_schema IS NULL OR form_schema = ''{}''', table_name);
            
            RAISE NOTICE '✅ Table % nettoyée', table_name;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 6. VÉRIFIER LES CONTRAINTES
-- =====================================================

-- Vérifier et corriger les contraintes de clés étrangères
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
        RAISE NOTICE '⚠️ % violations de contraintes détectées - Nettoyage nécessaire', constraint_violations;
        
        -- Nettoyer les violations
        DELETE FROM conversation_participants WHERE conversation_id NOT IN (SELECT id FROM conversations);
        DELETE FROM messages WHERE conversation_id NOT IN (SELECT id FROM conversations);
        DELETE FROM emergency_contacts WHERE user_id NOT IN (SELECT id FROM users);
        DELETE FROM enriched_reports WHERE user_id NOT IN (SELECT id FROM users);
        DELETE FROM personal_goals WHERE user_id NOT IN (SELECT id FROM users);
        
        RAISE NOTICE '✅ Violations de contraintes nettoyees';
    END IF;
END $$;

-- =====================================================
-- 7. RÉPARER LES INDEX MANQUANTS
-- =====================================================

-- Créer les index manquants
DO $$
DECLARE
    index_name TEXT;
    index_def TEXT;
    missing_indexes TEXT[] := ARRAY[
        'idx_messages_conversation_id',
        'idx_messages_sender_id',
        'idx_emergency_alerts_user_id',
        'idx_enriched_reports_user_id',
        'idx_gps_positions_user_id',
        'idx_performance_metrics_user_id',
        'idx_personal_goals_user_id',
        'idx_leaderboard_user_id'
    ];
BEGIN
    FOREACH index_name IN ARRAY missing_indexes
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = index_name) THEN
            -- Créer l'index manquant
            CASE index_name
                WHEN 'idx_messages_conversation_id' THEN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
                        CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
                        RAISE NOTICE '✅ Index % créé', index_name;
                    END IF;
                WHEN 'idx_messages_sender_id' THEN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
                        CREATE INDEX idx_messages_sender_id ON messages(sender_id);
                        RAISE NOTICE '✅ Index % créé', index_name;
                    END IF;
                WHEN 'idx_emergency_alerts_user_id' THEN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emergency_alerts') THEN
                        CREATE INDEX idx_emergency_alerts_user_id ON emergency_alerts(user_id);
                        RAISE NOTICE '✅ Index % créé', index_name;
                    END IF;
                WHEN 'idx_enriched_reports_user_id' THEN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enriched_reports') THEN
                        CREATE INDEX idx_enriched_reports_user_id ON enriched_reports(user_id);
                        RAISE NOTICE '✅ Index % créé', index_name;
                    END IF;
                WHEN 'idx_gps_positions_user_id' THEN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gps_positions') THEN
                        CREATE INDEX idx_gps_positions_user_id ON gps_positions(user_id);
                        RAISE NOTICE '✅ Index % créé', index_name;
                    END IF;
                WHEN 'idx_performance_metrics_user_id' THEN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'performance_metrics') THEN
                        CREATE INDEX idx_performance_metrics_user_id ON performance_metrics(user_id);
                        RAISE NOTICE '✅ Index % créé', index_name;
                    END IF;
                WHEN 'idx_personal_goals_user_id' THEN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'personal_goals') THEN
                        CREATE INDEX idx_personal_goals_user_id ON personal_goals(user_id);
                        RAISE NOTICE '✅ Index % créé', index_name;
                    END IF;
                WHEN 'idx_leaderboard_user_id' THEN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leaderboard') THEN
                        CREATE INDEX idx_leaderboard_user_id ON leaderboard(user_id);
                        RAISE NOTICE '✅ Index % créé', index_name;
                    END IF;
            END CASE;
        ELSE
            RAISE NOTICE 'ℹ️ Index % existe déjà', index_name;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 8. MESSAGE FINAL
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ====================================================';
    RAISE NOTICE '✅ CORRECTION DES ERREURS TERMINÉE!';
    RAISE NOTICE '🎉 ====================================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Corrections effectuées:';
    RAISE NOTICE '   • Erreurs de syntaxe JSON corrigees';
    RAISE NOTICE '   • Blocs DO $$ verifies et corriges';
    RAISE NOTICE '   • Tables manquantes creees';
    RAISE NOTICE '   • Extensions verifiees';
    RAISE NOTICE '   • Donnees corrompues nettoyees';
    RAISE NOTICE '   • Contraintes verifiees et reparees';
    RAISE NOTICE '   • Index manquants crees';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Votre base de donnees est maintenant prete!';
    RAISE NOTICE '';
END $$;
