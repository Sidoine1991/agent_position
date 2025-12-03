const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPermissions() {
    let output = 'Rapport Permissions:\n\n';

    // 1. Lister tous les statuts distincts
    const { data: allPerms, error } = await supabase
        .from('permissions')
        .select('status');

    if (error) {
        output += `❌ Erreur: ${error.message}\n`;
    } else {
        const statuses = [...new Set(allPerms.map(p => p.status))];
        output += `📋 Statuts trouvés dans la DB: ${JSON.stringify(statuses)}\n\n`;
    }

    // 2. Vérifier les permissions de Novembre 2025
    const { data: novPerms } = await supabase
        .from('permissions')
        .select('id, agent_id, status, start_date, end_date')
        .lte('start_date', '2025-11-30')
        .gte('end_date', '2025-11-01');

    output += `📅 Permissions Nov 2025 (${novPerms?.length || 0}):\n`;
    novPerms?.forEach(p => {
        output += `   ID:${p.id} Agent:${p.agent_id} Status:'${p.status}' ${p.start_date}->${p.end_date}\n`;
    });

    fs.writeFileSync('permissions_log.txt', output);
    console.log('Log écrit dans permissions_log.txt');
}

verifyPermissions();
