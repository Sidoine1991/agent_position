// Intégration des rayons de tolérance personnalisés dans le système de profil
// Ce script s'intègre avec profile.js pour appliquer automatiquement les rayons par agent

// Fonction pour appliquer le rayon de tolérance personnalisé à un agent
function applyCustomToleranceRadius(agentName, currentRadius) {
    const customRadius = getAgentToleranceRadius(agentName);
    const agentConfig = getAgentConfig(agentName);
    
    console.log(`🔧 Application du rayon personnalisé pour ${agentName}:`);
    console.log(`   - Rayon actuel: ${currentRadius} m`);
    console.log(`   - Rayon personnalisé: ${customRadius} m`);
    console.log(`   - Commune: ${agentConfig.commune}`);
    console.log(`   - Zone: ${agentConfig.zone}`);
    
    return customRadius;
}

// Fonction pour mettre à jour le profil d'un agent avec son rayon personnalisé
async function updateAgentProfileWithCustomTolerance(agentEmail) {
    try {
        // Récupérer le profil de l'agent
        const profile = await api('/profile?email=' + encodeURIComponent(agentEmail));
        
        if (profile && profile.name) {
            const agentName = profile.name;
            const customRadius = getAgentToleranceRadius(agentName);
            const agentConfig = getAgentConfig(agentName);
            
            // Vérifier si le rayon actuel est différent du rayon personnalisé
            const currentRadius = profile.tolerance_radius_meters || 5000; // 5km par défaut
            
            if (currentRadius !== customRadius) {
                console.log(`🔄 Mise à jour du rayon pour ${agentName}: ${currentRadius}m → ${customRadius}m`);
                
                // Mettre à jour le profil avec le rayon personnalisé
                const updateData = {
                    tolerance_radius_meters: customRadius,
                    // Ajouter des informations sur la configuration
                    custom_tolerance_applied: true,
                    tolerance_source: agentConfig.zone || 'default',
                    tolerance_commune: agentConfig.commune || 'Non spécifié'
                };
                
                await api('/me/profile', { 
                    method: 'POST', 
                    body: updateData 
                });
                
                console.log(`✅ Rayon de tolérance mis à jour pour ${agentName}`);
                return true;
            } else {
                console.log(`ℹ️ Rayon déjà à jour pour ${agentName}: ${customRadius}m`);
                return false;
            }
        }
    } catch (error) {
        console.error(`❌ Erreur lors de la mise à jour du rayon pour ${agentEmail}:`, error);
        return false;
    }
}

// Fonction pour appliquer les rayons personnalisés à tous les agents
async function applyCustomToleranceToAllAgents() {
    console.log('🚀 Application des rayons de tolérance personnalisés à tous les agents...');
    
    const agentConfigs = getAllAgentConfigs();
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const agentConfig of agentConfigs) {
        try {
            // Chercher l'email de l'agent par son nom
            // Note: Cette fonction nécessiterait une API pour récupérer l'email par nom
            console.log(`📋 Traitement de ${agentConfig.nom} (${agentConfig.commune})`);
            
            // Pour l'instant, on affiche les informations
            console.log(`   - Zone: ${agentConfig.zone}`);
            console.log(`   - CEP: ${agentConfig.cep}`);
            console.log(`   - Distance déclarée: ${agentConfig.distanceDeclaree} km`);
            console.log(`   - Rayon de tolérance: ${agentConfig.rayonTolerance} km`);
            
        } catch (error) {
            console.error(`❌ Erreur pour ${agentConfig.nom}:`, error);
            errorCount++;
        }
    }
    
    console.log(`✅ Traitement terminé: ${updatedCount} agents mis à jour, ${errorCount} erreurs`);
}

// Fonction pour afficher un résumé des configurations
function displayToleranceSummary() {
    const agentConfigs = getAllAgentConfigs();
    
    console.log('📊 Résumé des configurations de tolérance:');
    console.log('==========================================');
    
    // Grouper par zone
    const byZone = agentConfigs.reduce((acc, agent) => {
        if (!acc[agent.zone]) acc[agent.zone] = [];
        acc[agent.zone].push(agent);
        return acc;
    }, {});
    
    Object.entries(byZone).forEach(([zone, agents]) => {
        console.log(`\n🌍 Zone ${zone}:`);
        agents.forEach(agent => {
            console.log(`   • ${agent.nom} (${agent.commune}): ${agent.rayonTolerance} km`);
        });
    });
    
    // Statistiques
    const totalAgents = agentConfigs.length;
    const avgRadius = agentConfigs.reduce((sum, agent) => sum + agent.rayonTolerance, 0) / totalAgents;
    const minRadius = Math.min(...agentConfigs.map(agent => agent.rayonTolerance));
    const maxRadius = Math.max(...agentConfigs.map(agent => agent.rayonTolerance));
    
    console.log('\n📈 Statistiques:');
    console.log(`   - Total agents: ${totalAgents}`);
    console.log(`   - Rayon moyen: ${avgRadius.toFixed(1)} km`);
    console.log(`   - Rayon minimum: ${minRadius} km`);
    console.log(`   - Rayon maximum: ${maxRadius} km`);
}

// Fonction pour valider les configurations
function validateToleranceConfigs() {
    const agentConfigs = getAllAgentConfigs();
    const issues = [];
    
    agentConfigs.forEach(agent => {
        // Vérifier que le rayon est raisonnable (entre 1km et 100km)
        if (agent.rayonTolerance < 1 || agent.rayonTolerance > 100) {
            issues.push(`${agent.nom}: Rayon ${agent.rayonTolerance} km hors limites (1-100 km)`);
        }
        
        // Vérifier que la distance déclarée est cohérente
        const expectedRadius = calculateToleranceRadius(agent.distanceDeclaree);
        if (Math.abs(agent.rayonTolerance - expectedRadius) > 0.1) {
            issues.push(`${agent.nom}: Rayon ${agent.rayonTolerance} km ne correspond pas à 80% de ${agent.distanceDeclaree} km`);
        }
    });
    
    if (issues.length === 0) {
        console.log('✅ Toutes les configurations sont valides');
    } else {
        console.log('⚠️ Problèmes détectés:');
        issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    return issues;
}

// Fonction utilitaire pour convertir les unités
function convertUnits(value, fromUnit, toUnit) {
    const conversions = {
        'km': { 'm': 1000, 'km': 1 },
        'm': { 'km': 0.001, 'm': 1 }
    };
    
    return value * conversions[fromUnit][toUnit];
}

// Export des fonctions pour utilisation globale
if (typeof window !== 'undefined') {
    window.applyCustomToleranceRadius = applyCustomToleranceRadius;
    window.updateAgentProfileWithCustomTolerance = updateAgentProfileWithCustomTolerance;
    window.applyCustomToleranceToAllAgents = applyCustomToleranceToAllAgents;
    window.displayToleranceSummary = displayToleranceSummary;
    window.validateToleranceConfigs = validateToleranceConfigs;
    window.convertUnits = convertUnits;
}
