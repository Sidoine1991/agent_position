const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration Supabase
const supabaseUrl = 'https://eoamsmtdspedumjmmeui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyNzIzOSwiZXhwIjoyMDc0NjAzMjM5fQ.SrDG8nvNxALqUSqXw3tGWuv9hgLF-bSyUdNmxcoYm_Y';

// Créer le client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQLDirect(sqlQuery) {
    try {
        console.log(`⚡ Exécution: ${sqlQuery.substring(0, 100)}...`);
        
        // Utiliser l'API REST de Supabase pour exécuter du SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey
            },
            body: JSON.stringify({ sql: sqlQuery })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Succès`);
            return { success: true, data: result };
        } else {
            const error = await response.text();
            console.log(`❌ Erreur: ${error}`);
            return { success: false, error: error };
        }
    } catch (error) {
        console.log(`❌ Exception: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function createTablesManually() {
    console.log('🚀 Création des tables manuellement...');
    
    const tables = [
        // 1. Système de messagerie
        `CREATE TABLE IF NOT EXISTS conversations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255),
            type VARCHAR(50) DEFAULT 'direct',
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_active BOOLEAN DEFAULT true
        )`,
        
        `CREATE TABLE IF NOT EXISTS conversation_participants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_read_at TIMESTAMP WITH TIME ZONE,
            is_active BOOLEAN DEFAULT true,
            UNIQUE(conversation_id, user_id)
        )`,
        
        `CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        )`,
        
        // 2. Système d'urgence
        `CREATE TABLE IF NOT EXISTS emergency_contacts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50) NOT NULL,
            email VARCHAR(255),
            role VARCHAR(100),
            priority INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        `CREATE TABLE IF NOT EXISTS emergency_alerts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        )`,
        
        // 3. Système de rapports enrichis
        `CREATE TABLE IF NOT EXISTS report_types (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            description TEXT,
            form_schema JSONB,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        `CREATE TABLE IF NOT EXISTS enriched_reports (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        )`,
        
        // 4. Système de tableau de bord agent
        `CREATE TABLE IF NOT EXISTS personal_goals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        )`,
        
        `CREATE TABLE IF NOT EXISTS badges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            description TEXT,
            icon VARCHAR(50),
            category VARCHAR(50),
            rarity VARCHAR(20) DEFAULT 'common',
            criteria JSONB,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        `CREATE TABLE IF NOT EXISTS user_badges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
            earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            progress DECIMAL(5, 2) DEFAULT 100,
            UNIQUE(user_id, badge_id)
        )`,
        
        // 5. Système d'aide intégrée
        `CREATE TABLE IF NOT EXISTS tutorials (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            duration_minutes INTEGER,
            difficulty VARCHAR(20) DEFAULT 'beginner',
            category VARCHAR(50),
            steps JSONB NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        `CREATE TABLE IF NOT EXISTS faqs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            category VARCHAR(50),
            tags TEXT[],
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        
        `CREATE TABLE IF NOT EXISTS contextual_help (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            page_path VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            tips JSONB,
            shortcuts JSONB,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`
    ];
    
    for (let i = 0; i < tables.length; i++) {
        console.log(`\n📝 Création table ${i + 1}/${tables.length}...`);
        await executeSQLDirect(tables[i]);
    }
    
    console.log('\n🎉 Création des tables terminée!');
}

async function insertInitialData() {
    console.log('📊 Insertion des données initiales...');
    
    // Insérer des types de rapports
    const reportTypes = [
        { name: 'mission', description: 'Rapport de Mission', form_schema: { fields: [{ name: 'mission_title', label: 'Titre de la mission', type: 'text', required: true }] } },
        { name: 'inspection', description: 'Rapport d\'Inspection', form_schema: { fields: [{ name: 'inspection_type', label: 'Type d\'inspection', type: 'select', required: true }] } },
        { name: 'incident', description: 'Rapport d\'Incident', form_schema: { fields: [{ name: 'incident_type', label: 'Type d\'incident', type: 'select', required: true }] } }
    ];
    
    for (const reportType of reportTypes) {
        const { error } = await supabase
            .from('report_types')
            .insert(reportType);
        
        if (error) {
            console.log(`⚠️ Erreur insertion report_type ${reportType.name}:`, error.message);
        } else {
            console.log(`✅ Type de rapport ${reportType.name} inséré`);
        }
    }
    
    // Insérer des badges
    const badges = [
        { name: 'Débutant', description: 'Nouvel agent sur le terrain', icon: '🌱', category: 'milestone', rarity: 'common' },
        { name: 'Ponctuel', description: 'Arrivé à l\'heure 5 jours de suite', icon: '⏰', category: 'achievement', rarity: 'uncommon' },
        { name: 'Efficace', description: 'Efficacité supérieure à 90%', icon: '⚡', category: 'achievement', rarity: 'rare' }
    ];
    
    for (const badge of badges) {
        const { error } = await supabase
            .from('badges')
            .insert(badge);
        
        if (error) {
            console.log(`⚠️ Erreur insertion badge ${badge.name}:`, error.message);
        } else {
            console.log(`✅ Badge ${badge.name} inséré`);
        }
    }
    
    console.log('🎉 Données initiales insérées!');
}

async function main() {
    try {
        console.log('🚀 Connexion à Supabase...');
        
        // Test de connexion
        const { data: testData, error: testError } = await supabase
            .from('users')
            .select('count')
            .limit(1);
            
        if (testError) {
            console.log('⚠️ Table users non trouvée, mais connexion OK');
        } else {
            console.log('✅ Connexion à Supabase réussie');
        }
        
        // Créer les tables
        await createTablesManually();
        
        // Insérer les données initiales
        await insertInitialData();
        
        console.log('\n🎉 Configuration de la base de données terminée!');
        
    } catch (error) {
        console.error('❌ Erreur générale:', error.message);
    }
}

// Exécuter
main();
