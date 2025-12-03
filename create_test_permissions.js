const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestPermissions() {
    console.log('🔧 Création de permissions de test...\n');

    // Agents du projet DELTA MONO (d'après les logs précédents)
    const agentIds = [132, 133, 134, 135, 136, 137];
    const month = '2025-11';

    for (const agentId of agentIds) {
        // Créer une permission de 2 jours
        const permission = {
            agent_id: agentId,
            start_date: `${month}-25`,
            end_date: `${month}-26`,
            reason: 'Permission de test générée automatiquement',
            status: 'approved',
            type: 'conges' // ou autre type valide si nécessaire
        };

        const { data, error } = await supabase
            .from('permissions')
            .insert([permission])
            .select();

        if (error) {
            console.error(`❌ Erreur pour agent ${agentId}:`, error.message);
        } else {
            console.log(`✅ Permission créée pour agent ${agentId} (2 jours: 25-26 Nov)`);
        }
    }

    console.log('\n🎉 Terminé ! Rafraîchissez le tableau de synthèse.');
}

createTestPermissions();
