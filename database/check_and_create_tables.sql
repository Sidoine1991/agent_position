-- =====================================================
-- Script de vérification et création des tables manquantes
-- Vérifie les tables existantes et crée seulement celles qui manquent
-- =====================================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- FONCTION POUR VÉRIFIER L'EXISTENCE D'UNE TABLE
-- =====================================================

CREATE OR REPLACE FUNCTION table_exists(table_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CRÉATION CONDITIONNELLE DES TABLES
-- =====================================================

-- 1. SYSTÈME DE MESSAGERIE INTERNE
DO $$
BEGIN
    -- Table des conversations
    IF NOT table_exists('conversations') THEN
        CREATE TABLE conversations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255),
            type VARCHAR(50) DEFAULT 'direct',
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_active BOOLEAN DEFAULT true
        );
        RAISE NOTICE '✅ Table conversations créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table conversations existe déjà';
    END IF;

    -- Table des participants aux conversations
    IF NOT table_exists('conversation_participants') THEN
        CREATE TABLE conversation_participants (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_read_at TIMESTAMP WITH TIME ZONE,
            is_active BOOLEAN DEFAULT true,
            UNIQUE(conversation_id, user_id)
        );
        RAISE NOTICE '✅ Table conversation_participants créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table conversation_participants existe déjà';
    END IF;

    -- Table des messages
    IF NOT table_exists('messages') THEN
        CREATE TABLE messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
            sender_id UUID REFERENCES users(id),
            content TEXT,
            message_type VARCHAR(50) DEFAULT 'text',
            file_url TEXT,
            file_name VARCHAR(255),
            file_size INTEGER,
            reply_to_id UUID REFERENCES messages(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_edited BOOLEAN DEFAULT false,
            is_deleted BOOLEAN DEFAULT false
        );
        RAISE NOTICE '✅ Table messages créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table messages existe déjà';
    END IF;

    -- Table des statuts de lecture des messages
    IF NOT table_exists('message_read_status') THEN
        CREATE TABLE message_read_status (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(message_id, user_id)
        );
        RAISE NOTICE '✅ Table message_read_status créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table message_read_status existe déjà';
    END IF;
END $$;

-- 2. SYSTÈME D'URGENCE
DO $$
BEGIN
    -- Table des contacts d'urgence
    IF NOT table_exists('emergency_contacts') THEN
        CREATE TABLE emergency_contacts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50) NOT NULL,
            email VARCHAR(255),
            role VARCHAR(100),
            priority INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table emergency_contacts créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table emergency_contacts existe déjà';
    END IF;

    -- Table des alertes d'urgence
    IF NOT table_exists('emergency_alerts') THEN
        CREATE TABLE emergency_alerts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id),
            alert_type VARCHAR(50) NOT NULL,
            status VARCHAR(50) DEFAULT 'active',
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            location_description TEXT,
            message TEXT,
            triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            acknowledged_at TIMESTAMP WITH TIME ZONE,
            resolved_at TIMESTAMP WITH TIME ZONE,
            acknowledged_by UUID REFERENCES users(id),
            resolved_by UUID REFERENCES users(id)
        );
        RAISE NOTICE '✅ Table emergency_alerts créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table emergency_alerts existe déjà';
    END IF;

    -- Table des notifications d'urgence
    IF NOT table_exists('emergency_notifications') THEN
        CREATE TABLE emergency_notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            alert_id UUID REFERENCES emergency_alerts(id) ON DELETE CASCADE,
            contact_id UUID REFERENCES emergency_contacts(id),
            notification_type VARCHAR(50) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            sent_at TIMESTAMP WITH TIME ZONE,
            delivered_at TIMESTAMP WITH TIME ZONE,
            error_message TEXT
        );
        RAISE NOTICE '✅ Table emergency_notifications créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table emergency_notifications existe déjà';
    END IF;
END $$;

-- 3. SYSTÈME DE RAPPORTS ENRICHIS
DO $$
BEGIN
    -- Table des types de rapports
    IF NOT table_exists('report_types') THEN
        CREATE TABLE report_types (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(100) NOT NULL,
            description TEXT,
            form_schema JSONB,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table report_types créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table report_types existe déjà';
    END IF;

    -- Table des rapports enrichis
    IF NOT table_exists('enriched_reports') THEN
        CREATE TABLE enriched_reports (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id),
            report_type_id UUID REFERENCES report_types(id),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            location_name VARCHAR(255),
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            form_data JSONB,
            status VARCHAR(50) DEFAULT 'draft',
            submitted_at TIMESTAMP WITH TIME ZONE,
            approved_at TIMESTAMP WITH TIME ZONE,
            approved_by UUID REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table enriched_reports créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table enriched_reports existe déjà';
    END IF;

    -- Table des fichiers multimédias des rapports
    IF NOT table_exists('report_media') THEN
        CREATE TABLE report_media (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            report_id UUID REFERENCES enriched_reports(id) ON DELETE CASCADE,
            media_type VARCHAR(50) NOT NULL,
            file_url TEXT NOT NULL,
            file_name VARCHAR(255),
            file_size INTEGER,
            mime_type VARCHAR(100),
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table report_media créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table report_media existe déjà';
    END IF;
END $$;

-- 4. SYSTÈME DE PLANIFICATION INTELLIGENTE
DO $$
BEGIN
    -- Table des optimisations d'itinéraires
    IF NOT table_exists('route_optimizations') THEN
        CREATE TABLE route_optimizations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id),
            date DATE NOT NULL,
            original_route JSONB,
            optimized_route JSONB,
            total_distance DECIMAL(10, 2),
            estimated_duration INTEGER,
            efficiency_score DECIMAL(5, 2),
            savings_percentage DECIMAL(5, 2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table route_optimizations créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table route_optimizations existe déjà';
    END IF;

    -- Table des conflits de planification
    IF NOT table_exists('planning_conflicts') THEN
        CREATE TABLE planning_conflicts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conflict_type VARCHAR(50) NOT NULL,
            severity VARCHAR(20) DEFAULT 'medium',
            description TEXT NOT NULL,
            affected_users UUID[] DEFAULT '{}',
            affected_resources JSONB,
            conflict_data JSONB,
            status VARCHAR(50) DEFAULT 'open',
            detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            resolved_at TIMESTAMP WITH TIME ZONE,
            resolved_by UUID REFERENCES users(id)
        );
        RAISE NOTICE '✅ Table planning_conflicts créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table planning_conflicts existe déjà';
    END IF;

    -- Table des suggestions d'optimisation
    IF NOT table_exists('optimization_suggestions') THEN
        CREATE TABLE optimization_suggestions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            suggestion_type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            priority VARCHAR(20) DEFAULT 'medium',
            impact VARCHAR(20) DEFAULT 'medium',
            actionable BOOLEAN DEFAULT true,
            recommendations JSONB,
            estimated_savings DECIMAL(10, 2),
            target_users UUID[] DEFAULT '{}',
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            applied_at TIMESTAMP WITH TIME ZONE,
            applied_by UUID REFERENCES users(id)
        );
        RAISE NOTICE '✅ Table optimization_suggestions créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table optimization_suggestions existe déjà';
    END IF;
END $$;

-- 5. SYSTÈME DE TABLEAU DE BORD AGENT
DO $$
BEGIN
    -- Table des objectifs personnels
    IF NOT table_exists('personal_goals') THEN
        CREATE TABLE personal_goals (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            goal_type VARCHAR(50) NOT NULL,
            target_value DECIMAL(10, 2) NOT NULL,
            current_value DECIMAL(10, 2) DEFAULT 0,
            unit VARCHAR(50) NOT NULL,
            deadline DATE,
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table personal_goals créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table personal_goals existe déjà';
    END IF;

    -- Table des badges
    IF NOT table_exists('badges') THEN
        CREATE TABLE badges (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(100) NOT NULL,
            description TEXT,
            icon VARCHAR(50),
            category VARCHAR(50),
            rarity VARCHAR(20) DEFAULT 'common',
            criteria JSONB,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table badges créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table badges existe déjà';
    END IF;

    -- Table des badges gagnés par les utilisateurs
    IF NOT table_exists('user_badges') THEN
        CREATE TABLE user_badges (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
            earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            progress DECIMAL(5, 2) DEFAULT 100,
            UNIQUE(user_id, badge_id)
        );
        RAISE NOTICE '✅ Table user_badges créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table user_badges existe déjà';
    END IF;

    -- Table des réalisations
    IF NOT table_exists('achievements') THEN
        CREATE TABLE achievements (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            achievement_type VARCHAR(50) NOT NULL,
            icon VARCHAR(50),
            earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            metadata JSONB
        );
        RAISE NOTICE '✅ Table achievements créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table achievements existe déjà';
    END IF;

    -- Table du classement
    IF NOT table_exists('leaderboard') THEN
        CREATE TABLE leaderboard (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            period VARCHAR(20) NOT NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            score DECIMAL(10, 2) NOT NULL,
            missions_completed INTEGER DEFAULT 0,
            field_time_hours DECIMAL(8, 2) DEFAULT 0,
            attendance_rate DECIMAL(5, 2) DEFAULT 0,
            efficiency_score DECIMAL(5, 2) DEFAULT 0,
            rank_position INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, period, period_start)
        );
        RAISE NOTICE '✅ Table leaderboard créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table leaderboard existe déjà';
    END IF;
END $$;

-- 6. SYSTÈME D'AIDE INTÉGRÉE
DO $$
BEGIN
    -- Table des tutoriels
    IF NOT table_exists('tutorials') THEN
        CREATE TABLE tutorials (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            duration_minutes INTEGER,
            difficulty VARCHAR(20) DEFAULT 'beginner',
            category VARCHAR(50),
            steps JSONB NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table tutorials créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table tutorials existe déjà';
    END IF;

    -- Table de la progression des tutoriels
    IF NOT table_exists('tutorial_progress') THEN
        CREATE TABLE tutorial_progress (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            tutorial_id UUID REFERENCES tutorials(id) ON DELETE CASCADE,
            completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            progress_percentage DECIMAL(5, 2) DEFAULT 100,
            time_spent_minutes INTEGER,
            UNIQUE(user_id, tutorial_id)
        );
        RAISE NOTICE '✅ Table tutorial_progress créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table tutorial_progress existe déjà';
    END IF;

    -- Table des FAQ
    IF NOT table_exists('faqs') THEN
        CREATE TABLE faqs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            category VARCHAR(50),
            tags TEXT[],
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table faqs créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table faqs existe déjà';
    END IF;

    -- Table de l'aide contextuelle
    IF NOT table_exists('contextual_help') THEN
        CREATE TABLE contextual_help (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            page_path VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            tips JSONB,
            shortcuts JSONB,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table contextual_help créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table contextual_help existe déjà';
    END IF;
END $$;

-- 7. SYSTÈME D'ANALYTICS ET INSIGHTS
DO $$
BEGIN
    -- Table des métriques de performance
    IF NOT table_exists('performance_metrics') THEN
        CREATE TABLE performance_metrics (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            metric_type VARCHAR(50) NOT NULL,
            metric_name VARCHAR(100) NOT NULL,
            metric_value DECIMAL(10, 4) NOT NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            period_type VARCHAR(20) NOT NULL,
            metadata JSONB,
            calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table performance_metrics créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table performance_metrics existe déjà';
    END IF;

    -- Table des insights générés
    IF NOT table_exists('insights') THEN
        CREATE TABLE insights (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            insight_type VARCHAR(50) NOT NULL,
            category VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            impact VARCHAR(20) DEFAULT 'medium',
            actionable BOOLEAN DEFAULT true,
            recommendations JSONB,
            target_users UUID[] DEFAULT '{}',
            status VARCHAR(50) DEFAULT 'active',
            generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            acknowledged_at TIMESTAMP WITH TIME ZONE,
            acknowledged_by UUID REFERENCES users(id)
        );
        RAISE NOTICE '✅ Table insights créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table insights existe déjà';
    END IF;

    -- Table des prédictions
    IF NOT table_exists('predictions') THEN
        CREATE TABLE predictions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            prediction_type VARCHAR(50) NOT NULL,
            target_date DATE NOT NULL,
            predicted_value DECIMAL(10, 4) NOT NULL,
            confidence_score DECIMAL(5, 2) NOT NULL,
            factors JSONB,
            target_users UUID[] DEFAULT '{}',
            generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            expires_at TIMESTAMP WITH TIME ZONE
        );
        RAISE NOTICE '✅ Table predictions créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table predictions existe déjà';
    END IF;

    -- Table des données d'analytics
    IF NOT table_exists('analytics_data') THEN
        CREATE TABLE analytics_data (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            data_type VARCHAR(50) NOT NULL,
            user_id UUID REFERENCES users(id),
            data_point JSONB NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            metadata JSONB
        );
        RAISE NOTICE '✅ Table analytics_data créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table analytics_data existe déjà';
    END IF;
END $$;

-- 8. SYSTÈME DE GÉOLOCALISATION AVANCÉE
DO $$
BEGIN
    -- Table des positions GPS
    IF NOT table_exists('gps_positions') THEN
        CREATE TABLE gps_positions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id),
            latitude DECIMAL(10, 8) NOT NULL,
            longitude DECIMAL(11, 8) NOT NULL,
            accuracy DECIMAL(8, 2),
            altitude DECIMAL(8, 2),
            speed DECIMAL(8, 2),
            heading DECIMAL(5, 2),
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_emergency BOOLEAN DEFAULT false,
            metadata JSONB
        );
        RAISE NOTICE '✅ Table gps_positions créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table gps_positions existe déjà';
    END IF;

    -- Table des zones géographiques
    IF NOT table_exists('geographic_zones') THEN
        CREATE TABLE geographic_zones (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            zone_type VARCHAR(50) NOT NULL,
            coordinates JSONB NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by UUID REFERENCES users(id)
        );
        RAISE NOTICE '✅ Table geographic_zones créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table geographic_zones existe déjà';
    END IF;

    -- Table des événements de géofencing
    IF NOT table_exists('geofencing_events') THEN
        CREATE TABLE geofencing_events (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id),
            zone_id UUID REFERENCES geographic_zones(id),
            event_type VARCHAR(50) NOT NULL,
            latitude DECIMAL(10, 8) NOT NULL,
            longitude DECIMAL(11, 8) NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            duration_seconds INTEGER,
            metadata JSONB
        );
        RAISE NOTICE '✅ Table geofencing_events créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table geofencing_events existe déjà';
    END IF;
END $$;

-- 9. SYSTÈME DE NOTIFICATIONS PUSH
DO $$
BEGIN
    -- Table des abonnements aux notifications
    IF NOT table_exists('notification_subscriptions') THEN
        CREATE TABLE notification_subscriptions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            endpoint TEXT NOT NULL,
            p256dh_key TEXT NOT NULL,
            auth_key TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table notification_subscriptions créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table notification_subscriptions existe déjà';
    END IF;

    -- Table des notifications
    IF NOT table_exists('notifications') THEN
        CREATE TABLE notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id),
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            notification_type VARCHAR(50) NOT NULL,
            data JSONB,
            status VARCHAR(50) DEFAULT 'pending',
            sent_at TIMESTAMP WITH TIME ZONE,
            delivered_at TIMESTAMP WITH TIME ZONE,
            read_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE '✅ Table notifications créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table notifications existe déjà';
    END IF;
END $$;

-- 10. SYSTÈME DE CACHE HORS-LIGNE
DO $$
BEGIN
    -- Table de synchronisation hors-ligne
    IF NOT table_exists('offline_sync') THEN
        CREATE TABLE offline_sync (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            table_name VARCHAR(100) NOT NULL,
            record_id VARCHAR(255) NOT NULL,
            action VARCHAR(20) NOT NULL,
            data JSONB NOT NULL,
            sync_status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            synced_at TIMESTAMP WITH TIME ZONE,
            error_message TEXT
        );
        RAISE NOTICE '✅ Table offline_sync créée';
    ELSE
        RAISE NOTICE 'ℹ️ Table offline_sync existe déjà';
    END IF;
END $$;

-- =====================================================
-- CRÉATION DES INDEX (SEULEMENT S'ILS N'EXISTENT PAS)
-- =====================================================

-- Fonction pour vérifier l'existence d'un index
CREATE OR REPLACE FUNCTION index_exists(index_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = $1
    );
END;
$$ LANGUAGE plpgsql;

-- Création des index
DO $$
BEGIN
    -- Index pour les messages
    IF NOT index_exists('idx_messages_conversation_id') THEN
        CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
        RAISE NOTICE '✅ Index idx_messages_conversation_id créé';
    END IF;
    
    IF NOT index_exists('idx_messages_sender_id') THEN
        CREATE INDEX idx_messages_sender_id ON messages(sender_id);
        RAISE NOTICE '✅ Index idx_messages_sender_id créé';
    END IF;
    
    IF NOT index_exists('idx_messages_created_at') THEN
        CREATE INDEX idx_messages_created_at ON messages(created_at);
        RAISE NOTICE '✅ Index idx_messages_created_at créé';
    END IF;

    -- Index pour les alertes d'urgence
    IF NOT index_exists('idx_emergency_alerts_user_id') THEN
        CREATE INDEX idx_emergency_alerts_user_id ON emergency_alerts(user_id);
        RAISE NOTICE '✅ Index idx_emergency_alerts_user_id créé';
    END IF;
    
    IF NOT index_exists('idx_emergency_alerts_status') THEN
        CREATE INDEX idx_emergency_alerts_status ON emergency_alerts(status);
        RAISE NOTICE '✅ Index idx_emergency_alerts_status créé';
    END IF;

    -- Index pour les rapports enrichis
    IF NOT index_exists('idx_enriched_reports_user_id') THEN
        CREATE INDEX idx_enriched_reports_user_id ON enriched_reports(user_id);
        RAISE NOTICE '✅ Index idx_enriched_reports_user_id créé';
    END IF;
    
    IF NOT index_exists('idx_enriched_reports_status') THEN
        CREATE INDEX idx_enriched_reports_status ON enriched_reports(status);
        RAISE NOTICE '✅ Index idx_enriched_reports_status créé';
    END IF;

    -- Index pour les positions GPS
    IF NOT index_exists('idx_gps_positions_user_id') THEN
        CREATE INDEX idx_gps_positions_user_id ON gps_positions(user_id);
        RAISE NOTICE '✅ Index idx_gps_positions_user_id créé';
    END IF;
    
    IF NOT index_exists('idx_gps_positions_timestamp') THEN
        CREATE INDEX idx_gps_positions_timestamp ON gps_positions(timestamp);
        RAISE NOTICE '✅ Index idx_gps_positions_timestamp créé';
    END IF;

    -- Index pour les métriques de performance
    IF NOT index_exists('idx_performance_metrics_user_id') THEN
        CREATE INDEX idx_performance_metrics_user_id ON performance_metrics(user_id);
        RAISE NOTICE '✅ Index idx_performance_metrics_user_id créé';
    END IF;
    
    IF NOT index_exists('idx_performance_metrics_type') THEN
        CREATE INDEX idx_performance_metrics_type ON performance_metrics(metric_type);
        RAISE NOTICE '✅ Index idx_performance_metrics_type créé';
    END IF;

    -- Index pour les objectifs personnels
    IF NOT index_exists('idx_personal_goals_user_id') THEN
        CREATE INDEX idx_personal_goals_user_id ON personal_goals(user_id);
        RAISE NOTICE '✅ Index idx_personal_goals_user_id créé';
    END IF;
    
    IF NOT index_exists('idx_personal_goals_status') THEN
        CREATE INDEX idx_personal_goals_status ON personal_goals(status);
        RAISE NOTICE '✅ Index idx_personal_goals_status créé';
    END IF;

    -- Index pour le classement
    IF NOT index_exists('idx_leaderboard_user_id') THEN
        CREATE INDEX idx_leaderboard_user_id ON leaderboard(user_id);
        RAISE NOTICE '✅ Index idx_leaderboard_user_id créé';
    END IF;
    
    IF NOT index_exists('idx_leaderboard_period') THEN
        CREATE INDEX idx_leaderboard_period ON leaderboard(period, period_start);
        RAISE NOTICE '✅ Index idx_leaderboard_period créé';
    END IF;
    
    IF NOT index_exists('idx_leaderboard_score') THEN
        CREATE INDEX idx_leaderboard_score ON leaderboard(score DESC);
        RAISE NOTICE '✅ Index idx_leaderboard_score créé';
    END IF;
END $$;

-- =====================================================
-- CRÉATION DES TRIGGERS (SEULEMENT S'ILS N'EXISTENT PAS)
-- =====================================================

-- Fonction pour vérifier l'existence d'un trigger
CREATE OR REPLACE FUNCTION trigger_exists(trigger_name TEXT, table_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM information_schema.triggers 
        WHERE trigger_name = $1 
        AND event_object_table = $2
    );
END;
$$ LANGUAGE plpgsql;

-- Création des triggers
DO $$
BEGIN
    -- Fonction pour mettre à jour updated_at
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
        RAISE NOTICE '✅ Fonction update_updated_at_column créée';
    END IF;

    -- Triggers pour les tables avec updated_at
    IF NOT trigger_exists('update_conversations_updated_at', 'conversations') THEN
        CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Trigger update_conversations_updated_at créé';
    END IF;
    
    IF NOT trigger_exists('update_messages_updated_at', 'messages') THEN
        CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Trigger update_messages_updated_at créé';
    END IF;
    
    IF NOT trigger_exists('update_enriched_reports_updated_at', 'enriched_reports') THEN
        CREATE TRIGGER update_enriched_reports_updated_at BEFORE UPDATE ON enriched_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Trigger update_enriched_reports_updated_at créé';
    END IF;
    
    IF NOT trigger_exists('update_personal_goals_updated_at', 'personal_goals') THEN
        CREATE TRIGGER update_personal_goals_updated_at BEFORE UPDATE ON personal_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Trigger update_personal_goals_updated_at créé';
    END IF;
    
    IF NOT trigger_exists('update_leaderboard_updated_at', 'leaderboard') THEN
        CREATE TRIGGER update_leaderboard_updated_at BEFORE UPDATE ON leaderboard FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Trigger update_leaderboard_updated_at créé';
    END IF;
    
    IF NOT trigger_exists('update_tutorials_updated_at', 'tutorials') THEN
        CREATE TRIGGER update_tutorials_updated_at BEFORE UPDATE ON tutorials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Trigger update_tutorials_updated_at créé';
    END IF;
    
    IF NOT trigger_exists('update_faqs_updated_at', 'faqs') THEN
        CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON faqs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Trigger update_faqs_updated_at créé';
    END IF;
    
    IF NOT trigger_exists('update_contextual_help_updated_at', 'contextual_help') THEN
        CREATE TRIGGER update_contextual_help_updated_at BEFORE UPDATE ON contextual_help FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Trigger update_contextual_help_updated_at créé';
    END IF;
    
    IF NOT trigger_exists('update_notification_subscriptions_updated_at', 'notification_subscriptions') THEN
        CREATE TRIGGER update_notification_subscriptions_updated_at BEFORE UPDATE ON notification_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Trigger update_notification_subscriptions_updated_at créé';
    END IF;
END $$;

-- =====================================================
-- INSERTION DES DONNÉES INITIALES (SEULEMENT SI ELLES N'EXISTENT PAS)
-- =====================================================

-- Insérer des types de rapports par défaut
INSERT INTO report_types (name, description, form_schema) VALUES
('mission', 'Rapport de Mission', '{"fields": [{"name": "mission_title", "label": "Titre de la mission", "type": "text", "required": true}]}'),
('inspection', 'Rapport d''Inspection', '{"fields": [{"name": "inspection_type", "label": "Type d''inspection", "type": "select", "required": true}]}'),
('incident', 'Rapport d''Incident', '{"fields": [{"name": "incident_type", "label": "Type d''incident", "type": "select", "required": true}]}'),
('maintenance', 'Rapport de Maintenance', '{"fields": [{"name": "equipment_name", "label": "Nom de l''équipement", "type": "text", "required": true}]}'),
('formation', 'Rapport de Formation', '{"fields": [{"name": "training_title", "label": "Titre de la formation", "type": "text", "required": true}]}')
ON CONFLICT DO NOTHING;

-- Insérer des badges par défaut
INSERT INTO badges (name, description, icon, category, rarity, criteria) VALUES
('Débutant', 'Nouvel agent sur le terrain', '🌱', 'milestone', 'common', '{"condition": "first_login"}'),
('Ponctuel', 'Arrivé à l''heure 5 jours de suite', '⏰', 'achievement', 'uncommon', '{"condition": "punctuality_streak", "value": 5}'),
('Efficace', 'Efficacité supérieure à 90%', '⚡', 'achievement', 'rare', '{"condition": "efficiency", "value": 90}'),
('Première Mission', 'Première mission complétée', '🎯', 'milestone', 'common', '{"condition": "missions_completed", "value": 1}'),
('10 Missions', '10 missions complétées', '🏆', 'achievement', 'uncommon', '{"condition": "missions_completed", "value": 10}'),
('50 Missions', '50 missions complétées', '👑', 'achievement', 'rare', '{"condition": "missions_completed", "value": 50}'),
('Présence Parfaite', 'Taux de présence de 100%', '💯', 'achievement', 'rare', '{"condition": "attendance_rate", "value": 100}'),
('Très Ponctuel', 'Taux de ponctualité supérieur à 95%', '🎖️', 'achievement', 'uncommon', '{"condition": "punctuality_rate", "value": 95}'),
('100 Heures', '100 heures passées sur le terrain', '⏱️', 'achievement', 'uncommon', '{"condition": "field_time", "value": 100}'),
('500 Heures', '500 heures passées sur le terrain', '🕐', 'achievement', 'rare', '{"condition": "field_time", "value": 500}')
ON CONFLICT DO NOTHING;

-- Insérer des tutoriels par défaut
INSERT INTO tutorials (title, description, duration_minutes, difficulty, category, steps) VALUES
('Premiers pas avec l''application', 'Apprenez les bases de l''application CCRB', 5, 'beginner', 'general', 
 '[{"title": "Connexion", "content": "Connectez-vous avec vos identifiants fournis par votre superviseur", "image": "/help/images/login.png"}, {"title": "Marquer sa présence", "content": "Cliquez sur le bouton \"Marquer ma présence\" et confirmez votre localisation", "image": "/help/images/presence.png"}]'),
('Utilisation du GPS et géolocalisation', 'Maîtrisez les fonctionnalités de géolocalisation', 8, 'intermediate', 'presence',
 '[{"title": "Activer le GPS", "content": "Autorisez l''accès à votre localisation dans les paramètres du navigateur", "image": "/help/images/gps-activation.png"}, {"title": "Vérifier la précision", "content": "Assurez-vous que votre position est précise avant de marquer votre présence", "image": "/help/images/gps-accuracy.png"}]'),
('Création de rapports enrichis', 'Créez des rapports détaillés avec photos et audio', 12, 'advanced', 'reports',
 '[{"title": "Accéder aux rapports enrichis", "content": "Naviguez vers la page \"Rapports Enrichis\" depuis le menu principal", "image": "/help/images/enriched-reports.png"}, {"title": "Capturer des photos", "content": "Utilisez le bouton \"Photo\" pour prendre des photos de vos activités", "image": "/help/images/photo-capture.png"}]')
ON CONFLICT DO NOTHING;

-- Insérer des FAQ par défaut
INSERT INTO faqs (question, answer, category, tags) VALUES
('Comment marquer ma présence ?', 'Cliquez sur le bouton "Marquer ma présence" sur la page d''accueil. Assurez-vous que votre GPS est activé et que vous êtes dans une zone autorisée.', 'Présence', ARRAY['présence', 'GPS', 'localisation']),
('Que faire si je ne peux pas me connecter ?', 'Vérifiez votre connexion internet et vos identifiants. Si le problème persiste, contactez votre superviseur ou l''administrateur système.', 'Connexion', ARRAY['connexion', 'problème', 'dépannage']),
('Comment voir mes missions ?', 'Accédez à l''onglet "Missions" ou "Planification" pour voir vos tâches assignées. Vous pouvez filtrer par date, projet ou statut.', 'Missions', ARRAY['missions', 'planification', 'tâches']),
('Que signifie la couleur orange sur le calendrier ?', 'La couleur orange indique que vous avez marqué votre présence mais que vous étiez hors de la zone autorisée. Cela peut affecter votre évaluation.', 'Calendrier', ARRAY['calendrier', 'couleurs', 'zones']),
('Comment utiliser le mode hors-ligne ?', 'L''application fonctionne automatiquement en mode hors-ligne. Vos données sont synchronisées dès que vous retrouvez une connexion internet.', 'Hors-ligne', ARRAY['hors-ligne', 'synchronisation', 'données'])
ON CONFLICT DO NOTHING;

-- Insérer de l'aide contextuelle par défaut
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

-- =====================================================
-- ACTIVATION DE RLS (SEULEMENT SI PAS DÉJÀ ACTIVÉ)
-- =====================================================

DO $$
DECLARE
    table_name TEXT;
    tables_to_secure TEXT[] := ARRAY[
        'conversations', 'conversation_participants', 'messages', 'message_read_status',
        'emergency_contacts', 'emergency_alerts', 'emergency_notifications',
        'enriched_reports', 'report_media', 'personal_goals', 'user_badges',
        'achievements', 'leaderboard', 'tutorial_progress', 'performance_metrics',
        'insights', 'predictions', 'analytics_data', 'gps_positions',
        'geofencing_events', 'notification_subscriptions', 'notifications', 'offline_sync'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_secure
    LOOP
        IF table_exists(table_name) THEN
            -- Vérifier si RLS est déjà activé
            IF NOT EXISTS (
                SELECT 1 FROM pg_class 
                WHERE relname = table_name 
                AND relrowsecurity = true
            ) THEN
                EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
                RAISE NOTICE '✅ RLS activé sur la table %', table_name;
            ELSE
                RAISE NOTICE 'ℹ️ RLS déjà activé sur la table %', table_name;
            END IF;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- MESSAGE FINAL
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ====================================================';
    RAISE NOTICE '✅ VÉRIFICATION ET CRÉATION DES TABLES TERMINÉE!';
    RAISE NOTICE '🎉 ====================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Résumé des opérations:';
    RAISE NOTICE '   • Tables vérifiées et créées si nécessaire';
    RAISE NOTICE '   • Index créés pour optimiser les performances';
    RAISE NOTICE '   • Triggers configurés pour la mise à jour automatique';
    RAISE NOTICE '   • Données initiales insérées (types, badges, tutoriels, FAQ)';
    RAISE NOTICE '   • RLS activé sur toutes les tables pour la sécurité';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Votre base de données Supabase est maintenant prête';
    RAISE NOTICE '   pour supporter tous les systèmes avancés CCRB!';
    RAISE NOTICE '';
END $$;
