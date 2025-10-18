-- =====================================================
-- 1. VÉRIFIER LES TABLES EXISTANTES AVANT SUPPRESSION
-- =====================================================

DO $$
DECLARE
    tbl TEXT;
    tables_to_check TEXT[] := ARRAY[
        'agents', 'projects', 'assignments', 'attendances', 
        'contextual_help', 'tutorials', 'faqs', 'badges', 'report_types'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_check LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_name = tbl) THEN
            RAISE NOTICE '✅ Table % existe', tbl;
        ELSE
            RAISE NOTICE '⚠️ Table % introuvable', tbl;
        END IF;
    END LOOP;
END $$;


-- =====================================================
-- 2. SAUVEGARDE TEMPORAIRE (facultative)
-- =====================================================

DO $$
DECLARE
    tbl TEXT;
    backup_name TEXT;
    tables_to_backup TEXT[] := ARRAY['agents', 'projects', 'assignments', 'attendances'];
BEGIN
    FOREACH tbl IN ARRAY tables_to_backup LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_name = tbl) THEN
            backup_name := tbl || '_backup_' || to_char(NOW(), 'YYYYMMDD_HH24MI');
            EXECUTE format('CREATE TABLE %I AS SELECT * FROM %I', backup_name, tbl);
            RAISE NOTICE '💾 Sauvegarde créée : %', backup_name;
        END IF;
    END LOOP;
END $$;


-- =====================================================
-- 3. SUPPRESSION DES TABLES EN CONFLIT OU OBSOLÈTES
-- =====================================================

DO $$
DECLARE
    tbl TEXT;
    tables_to_drop TEXT[] := ARRAY[
        'contextual_help', 'tutorials', 'faqs', 'badges', 'report_types'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_drop LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_name = tbl) THEN
            EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', tbl);
            RAISE NOTICE '🗑️ Table supprimée : %', tbl;
        ELSE
            RAISE NOTICE '⚠️ Table % non trouvée, rien à supprimer', tbl;
        END IF;
    END LOOP;
END $$;


-- =====================================================
-- 4. RECRÉATION DES TABLES STRUCTURÉES
-- =====================================================

-- Exemple : Contextual Help
CREATE TABLE IF NOT EXISTS contextual_help (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    shortcuts JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exemple : Tutorials
CREATE TABLE IF NOT EXISTS tutorials (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    steps JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exemple : FAQs
CREATE TABLE IF NOT EXISTS faqs (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exemple : Badges
CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    criteria JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exemple : Report Types
CREATE TABLE IF NOT EXISTS report_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    form_schema JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- 5. NETTOYER LES DONNÉES CORROMPUES
-- =====================================================

DO $$
DECLARE
    tbl TEXT;
    col TEXT;
    tables_to_clean TEXT[] := ARRAY[
        'contextual_help', 'tutorials', 'faqs', 'badges', 'report_types'
    ];
    columns_to_clean TEXT[] := ARRAY[
        'shortcuts', 'steps', 'criteria', 'form_schema'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_clean LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables t WHERE t.table_name = tbl
        ) THEN
            FOREACH col IN ARRAY columns_to_clean LOOP
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns c 
                    WHERE c.table_name = tbl AND c.column_name = col
                ) THEN
                    EXECUTE format('DELETE FROM %I WHERE %I IS NULL OR %I = ''{}''', tbl, col, col);
                END IF;
            END LOOP;
            RAISE NOTICE '✅ Table % nettoyée', tbl;
        END IF;
    END LOOP;
END $$;


-- =====================================================
-- 6. AJOUT D’INDEX ET OPTIMISATION
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_contextual_help_title ON contextual_help (title);
CREATE INDEX IF NOT EXISTS idx_tutorials_title ON tutorials (title);
CREATE INDEX IF NOT EXISTS idx_faqs_question ON faqs (question);
CREATE INDEX IF NOT EXISTS idx_badges_name ON badges (name);
CREATE INDEX IF NOT EXISTS idx_report_types_name ON report_types (name);


-- =====================================================
-- 7. VÉRIFICATION FINALE
-- =====================================================

DO $$
DECLARE
    tbl TEXT;
    final_tables TEXT[] := ARRAY[
        'contextual_help', 'tutorials', 'faqs', 'badges', 'report_types'
    ];
BEGIN
    FOREACH tbl IN ARRAY final_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_name = tbl) THEN
            RAISE NOTICE '✅ Table % prête et fonctionnelle', tbl;
        ELSE
            RAISE NOTICE '❌ Table % manquante', tbl;
        END IF;
    END LOOP;
END $$;
