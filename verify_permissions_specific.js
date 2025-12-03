
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

console.log('SUPABASE_URL:', supabaseUrl ? 'Défini' : 'Non défini');
console.log('SUPABASE_SERVICE_KEY:', supabaseKey ? 'Défini' : 'Non défini');

if (!supabaseUrl || !supabaseKey) {
    console.error('Erreur: SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAgentPermissions() {
    const agentName = 'COUTCHIKA AKPO BERNARD';
    console.log(`Recherche de l'agent: ${agentName}`);

    // 1. Trouver l'agent
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, name, email')
        .ilike('name', `%${agentName}%`);

    if (userError) {
        console.error('Erreur lors de la recherche de l\'agent:', userError);
        return;
    }

    if (!users || users.length === 0) {
        console.error('Aucun agent trouvé avec ce nom.');
        // Lister quelques agents pour voir
        const { data: allUsers } = await supabase.from('users').select('id, name').limit(5);
        console.log('Exemples d\'agents:', allUsers);
        return;
    }

    const agent = users[0];
    console.log(`Agent trouvé: ID ${agent.id}, Nom: ${agent.name}`);

    // 2. Chercher les permissions pour cet agent
    console.log(`\nRecherche des permissions pour l'agent ${agent.id}...`);

    const { data: permissions, error: permError } = await supabase
        .from('permissions')
        .select('*')
        .eq('agent_id', agent.id);

    if (permError) {
        console.error('Erreur lors de la récupération des permissions:', permError);
        return;
    }

    console.log(`${permissions.length} permission(s) trouvée(s) au total.`);

    // 3. Filtrer pour novembre 2025
    const novStart = new Date('2025-11-01T00:00:00Z');
    const novEnd = new Date('2025-11-30T23:59:59Z');

    const novPermissions = permissions.filter(p => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        // Chevauchement avec novembre
        return start <= novEnd && end >= novStart;
    });

    console.log(`\nPermissions chevauchant Novembre 2025: ${novPermissions.length}`);

    novPermissions.forEach(p => {
        console.log(`- ID: ${p.id}`);
        console.log(`  Dates: ${p.start_date} au ${p.end_date}`);
        console.log(`  Statut: ${p.status}`);
        console.log(`  Type: ${p.type}`);
        console.log(`  Motif: ${p.reason}`);
        console.log('---');
    });

    if (novPermissions.length === 0) {
        console.log('Aucune permission trouvée pour novembre 2025.');
    } else {
        const approvedCount = novPermissions.filter(p => p.status === 'approved').length;
        console.log(`\nNombre de permissions 'approved' en novembre: ${approvedCount}`);
    }
}

debugAgentPermissions();
