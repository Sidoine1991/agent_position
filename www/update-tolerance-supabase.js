// Script pour mettre à jour les rayons de tolérance dans Supabase
// Ce script peut être exécuté dans la console du navigateur ou intégré dans l'admin

// Configuration des rayons de tolérance par agent
const AGENT_TOLERANCE_UPDATES = [
    // Zone PDA4 (Nord)
    { name: "DJIBRIL ABDEL-HAFIZ", commune: "DJOUGOU", zone: "PDA4", radius: 20000 },
    { name: "GOUKALODE CALIXTE", commune: "DASSA-ZOUMÉ", zone: "PDA4", radius: 17600 },
    { name: "EKPA Chabi Ogoudélé Aimé", commune: "BASSILA", zone: "PDA4", radius: 16000 },
    { name: "KALOA Moukimiou", commune: "OUAKÉ", zone: "PDA4", radius: 20000 },
    { name: "CHERIF FABADE DEKANDE LUC", commune: "SAVALOU", zone: "PDA4", radius: 24000 },
    { name: "FADO kami Macaire", commune: "BANTÈ", zone: "PDA4", radius: 12000 },
    { name: "TCHETAN PRUDENCE", commune: "GLAZOUE", zone: "PDA4", radius: 8000 },
    { name: "AKPO ANOS", commune: "DASSA ZOUMÈ", zone: "PDA4", radius: 16800 },
    { name: "DAGAN Bruno", commune: "Glazoué", zone: "PDA4", radius: 20000 },
    { name: "ADOHO D. THIBURCE", commune: "SAVALOU", zone: "PDA4", radius: 44000 },
    { name: "SERIKI FATAI", commune: "BANTÉ", zone: "PDA4", radius: 17600 },
    
    // Zone SUD
    { name: "DAGNITO Mariano", commune: "Zogbodomey", zone: "SUD", radius: 28000 },
    { name: "GOGAN Ida", commune: "Zogbodomey", zone: "SUD", radius: 28000 },
    { name: "ADJOVI Sabeck", commune: "Zogbodomey", zone: "SUD", radius: 28000 },
    { name: "TOGNON TCHEGNONSI Bernice", commune: "Zogbodomey", zone: "SUD", radius: 28000 }
];

// Fonction pour normaliser les noms (supprimer accents, espaces, etc.)
function normalizeName(name) {
    return name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
        .replace(/\s+/g, ' ') // Normaliser les espaces
        .trim();
}

// Fonction pour trouver un utilisateur par nom
async function findUserByName(name, api) {
    const normalizedSearchName = normalizeName(name);
    
    try {
        // Essayer de récupérer tous les utilisateurs et filtrer côté client
        const response = await api('/users');
        const users = Array.isArray(response) ? response : (response.users || []);
        
        // Chercher par correspondance de nom
        const matches = users.filter(user => {
            const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
            const normalizedFullName = normalizeName(fullName);
            
            // Vérifier si le nom contient des mots-clés de l'agent
            const nameWords = normalizedSearchName.split(' ');
            return nameWords.every(word => 
                word.length > 2 && normalizedFullName.includes(word)
            );
        });
        
        return matches;
    } catch (error) {
        console.error(`Erreur lors de la recherche de ${name}:`, error);
        return [];
    }
}

// Fonction pour mettre à jour un utilisateur
async function updateUserTolerance(userId, agentConfig, api) {
    try {
        const updateData = {
            tolerance_radius_meters: agentConfig.radius,
            custom_tolerance_applied: true,
            tolerance_source: agentConfig.zone,
            tolerance_commune: agentConfig.commune
        };
        
        const response = await api(`/users/${userId}`, {
            method: 'PATCH',
            body: updateData
        });
        
        console.log(`✅ Mis à jour: ${agentConfig.name} - Rayon: ${agentConfig.radius}m`);
        return { success: true, user: response };
    } catch (error) {
        console.error(`❌ Erreur mise à jour ${agentConfig.name}:`, error);
        return { success: false, error: error.message };
    }
}

// Fonction principale pour mettre à jour tous les agents
async function updateAllAgentTolerances() {
    console.log('🚀 Début de la mise à jour des rayons de tolérance...');
    
    const results = {
        success: 0,
        failed: 0,
        notFound: 0,
        details: []
    };
    
    // Simuler l'API (à remplacer par votre vraie API)
    const api = async (endpoint, options = {}) => {
        // Ici, vous devriez utiliser votre vraie API Supabase
        console.log(`API Call: ${endpoint}`, options);
        
        // Simulation de réponse
        if (endpoint === '/users') {
            return {
                users: [
                    // Ajoutez ici vos vrais utilisateurs de la base de données
                    // Exemple:
                    // { id: 1, first_name: "DJIBRIL", last_name: "ABDEL-HAFIZ", email: "djibril@example.com" },
                    // { id: 2, first_name: "GOUKALODE", last_name: "CALIXTE", email: "goukalode@example.com" },
                    // ...
                ]
            };
        }
        
        return { success: true };
    };
    
    for (const agentConfig of AGENT_TOLERANCE_UPDATES) {
        console.log(`\n🔍 Recherche de: ${agentConfig.name}`);
        
        const matches = await findUserByName(agentConfig.name, api);
        
        if (matches.length === 0) {
            console.log(`⚠️ Aucun utilisateur trouvé pour: ${agentConfig.name}`);
            results.notFound++;
            results.details.push({
                agent: agentConfig.name,
                status: 'not_found',
                message: 'Aucun utilisateur correspondant trouvé'
            });
        } else if (matches.length === 1) {
            const user = matches[0];
            const result = await updateUserTolerance(user.id, agentConfig, api);
            
            if (result.success) {
                results.success++;
                results.details.push({
                    agent: agentConfig.name,
                    status: 'success',
                    user: user.email,
                    radius: agentConfig.radius
                });
            } else {
                results.failed++;
                results.details.push({
                    agent: agentConfig.name,
                    status: 'failed',
                    error: result.error
                });
            }
        } else {
            console.log(`⚠️ Plusieurs utilisateurs trouvés pour: ${agentConfig.name}`);
            results.details.push({
                agent: agentConfig.name,
                status: 'multiple_matches',
                matches: matches.map(m => ({ id: m.id, name: `${m.first_name} ${m.last_name}`, email: m.email }))
            });
        }
    }
    
    // Afficher le résumé
    console.log('\n📊 Résumé des mises à jour:');
    console.log(`✅ Succès: ${results.success}`);
    console.log(`❌ Échecs: ${results.failed}`);
    console.log(`⚠️ Non trouvés: ${results.notFound}`);
    
    return results;
}

// Fonction pour mettre à jour les agents sans déclaration avec le rayon par défaut
async function updateDefaultTolerance() {
    console.log('🔄 Mise à jour des agents sans déclaration avec le rayon par défaut (6km)...');
    
    try {
        const api = async (endpoint, options = {}) => {
            console.log(`API Call: ${endpoint}`, options);
            return { success: true };
        };
        
        // Mettre à jour tous les utilisateurs sans rayon personnalisé
        const response = await api('/users/update-default-tolerance', {
            method: 'POST',
            body: {
                tolerance_radius_meters: 6000,
                custom_tolerance_applied: false,
                tolerance_source: 'default'
            }
        });
        
        console.log('✅ Agents sans déclaration mis à jour avec le rayon par défaut');
        return { success: true };
    } catch (error) {
        console.error('❌ Erreur lors de la mise à jour par défaut:', error);
        return { success: false, error: error.message };
    }
}

// Fonction pour vérifier les mises à jour
async function verifyToleranceUpdates() {
    console.log('🔍 Vérification des mises à jour...');
    
    try {
        const api = async (endpoint, options = {}) => {
            console.log(`API Call: ${endpoint}`, options);
            return { success: true };
        };
        
        const response = await api('/users/tolerance-summary');
        
        console.log('📊 Résumé des rayons de tolérance:');
        console.log(response);
        
        return response;
    } catch (error) {
        console.error('❌ Erreur lors de la vérification:', error);
        return { success: false, error: error.message };
    }
}

// Fonction pour exécuter toutes les mises à jour
async function executeAllToleranceUpdates() {
    console.log('🚀 Exécution complète des mises à jour de tolérance...');
    
    try {
        // 1. Mettre à jour les agents avec rayons personnalisés
        const customResults = await updateAllAgentTolerances();
        
        // 2. Mettre à jour les agents sans déclaration
        const defaultResults = await updateDefaultTolerance();
        
        // 3. Vérifier les mises à jour
        const verification = await verifyToleranceUpdates();
        
        console.log('\n🎉 Mise à jour complète terminée!');
        return {
            customUpdates: customResults,
            defaultUpdates: defaultResults,
            verification: verification
        };
    } catch (error) {
        console.error('❌ Erreur lors de l\'exécution complète:', error);
        return { success: false, error: error.message };
    }
}

// Export des fonctions pour utilisation
if (typeof window !== 'undefined') {
    window.updateAllAgentTolerances = updateAllAgentTolerances;
    window.updateDefaultTolerance = updateDefaultTolerance;
    window.verifyToleranceUpdates = verifyToleranceUpdates;
    window.executeAllToleranceUpdates = executeAllToleranceUpdates;
}

// Instructions d'utilisation
console.log(`
📋 Instructions d'utilisation:

1. Pour mettre à jour tous les agents:
   executeAllToleranceUpdates()

2. Pour mettre à jour seulement les agents personnalisés:
   updateAllAgentTolerances()

3. Pour mettre à jour les agents sans déclaration:
   updateDefaultTolerance()

4. Pour vérifier les mises à jour:
   verifyToleranceUpdates()

⚠️  Note: Ce script nécessite une API Supabase fonctionnelle.
    Remplacez les appels API simulés par vos vrais appels Supabase.
`);
