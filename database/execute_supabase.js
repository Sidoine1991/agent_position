const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration Supabase
const supabaseUrl = 'https://eoamsmtdspedumjmmeui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyNzIzOSwiZXhwIjoyMDc0NjAzMjM5fQ.SrDG8nvNxALqUSqXw3tGWuv9hgLF-bSyUdNmxcoYm_Y';

// Créer le client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQLFile(filePath) {
    try {
        console.log(`📁 Lecture du fichier: ${filePath}`);
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        
        // Diviser le contenu en requêtes individuelles
        const queries = sqlContent
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0 && !q.startsWith('--'));
        
        console.log(`🔍 ${queries.length} requêtes trouvées`);
        
        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            if (query.trim()) {
                try {
                    console.log(`\n⚡ Exécution requête ${i + 1}/${queries.length}...`);
                    console.log(`📝 ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
                    
                    const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
                    
                    if (error) {
                        console.error(`❌ Erreur requête ${i + 1}:`, error.message);
                        // Continuer avec les autres requêtes
                    } else {
                        console.log(`✅ Requête ${i + 1} exécutée avec succès`);
                        if (data) {
                            console.log(`📊 Résultat:`, data);
                        }
                    }
                } catch (err) {
                    console.error(`❌ Erreur lors de l'exécution de la requête ${i + 1}:`, err.message);
                }
            }
        }
        
        console.log(`\n🎉 Exécution du fichier ${filePath} terminée!`);
        
    } catch (error) {
        console.error(`❌ Erreur lors de la lecture du fichier ${filePath}:`, error.message);
    }
}

async function executeDirectSQL() {
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
        
        // Exécuter les scripts dans l'ordre
        const scripts = [
            'fix_syntax_errors.sql',
            'create_tables_simple.sql',
            'test_simple.sql'
        ];
        
        for (const script of scripts) {
            const scriptPath = path.join(__dirname, script);
            if (fs.existsSync(scriptPath)) {
                await executeSQLFile(scriptPath);
            } else {
                console.log(`⚠️ Fichier ${script} non trouvé, ignoré`);
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur générale:', error.message);
    }
}

// Exécuter
executeDirectSQL();
