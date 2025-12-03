const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Créer un token admin pour tester
const adminToken = jwt.sign(
    { id: 1, userId: 1, role: 'admin', email: 'admin@example.com' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

async function testMonthlyReport() {
    try {
        const baseUrl = 'http://localhost:3000';

        // 1. Récupérer les agents
        console.log('📋 1. Récupération des agents...');
        const agentsResponse = await fetch(`${baseUrl}/api/agents`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!agentsResponse.ok) {
            throw new Error(`Erreur récupération agents: ${agentsResponse.status} ${agentsResponse.statusText}`);
        }

        const agents = await agentsResponse.json();
        console.log(`✅ ${agents.length} agents récupérés`);

        if (agents.length === 0) {
            console.log('⚠️ Aucun agent trouvé');
            return;
        }

        const firstAgent = agents[0];
        console.log(`\n📊 Agent sélectionné: ID=${firstAgent.id}, Name="${firstAgent.name}", Project="${firstAgent.project_name}"`);

        // 2. Récupérer le rapport mensuel pour cet agent
        const currentMonth = new Date().toISOString().substring(0, 7); // Format YYYY-MM
        console.log(`\n📅 2. Récupération du rapport mensuel pour ${currentMonth}...`);

        const reportUrl = `${baseUrl}/api/agents/monthly-report?agentId=${firstAgent.id}&month=${currentMonth}&ai=0`;
        console.log(`📡 URL: ${reportUrl}`);

        const reportResponse = await fetch(reportUrl, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            throw new Error(`Erreur récupération rapport: ${reportResponse.status} ${reportResponse.statusText}\n${errorText}`);
        }

        const report = await reportResponse.json();

        console.log('\n📄 Structure de la réponse:');
        console.log('- success:', report.success);
        console.log('- meta:', report.meta ? 'présent' : 'absent');
        console.log('- presence:', report.presence ? 'présent' : 'absent');
        console.log('- activities:', report.activities ? 'présent' : 'absent');

        if (report.presence) {
            console.log('\n✅ Données de présence:');
            console.log('  - totalCheckins:', report.presence.totalCheckins);
            console.log('  - workedDays:', report.presence.workedDays);
            console.log('  - workingDays:', report.presence.workingDays);
            console.log('  - presenceRate:', report.presence.presenceRate);
            console.log('  - fieldTimeHours:', report.presence.fieldTimeHours);
            console.log('  - avgCheckinsPerDay:', report.presence.averageCheckinsPerDay);
        } else {
            console.log('\n❌ Pas de données de présence');
        }

        if (report.activities) {
            console.log('\n✅ Données d\'activités:');
            console.log('  - total:', report.activities.total);
            console.log('  - performance:', report.activities.performance);
        } else {
            console.log('\n❌ Pas de données d\'activités');
        }

        // 3. Tester l'extraction comme dans synthese-globale.html
        console.log('\n🔍 3. Test de l\'extraction des données (comme dans synthese-globale.html)...');
        const data = report.data || report;
        const presence = data.presence || data.meta?.presence || {};
        const activities = data.activities || data.meta?.activities || {};

        console.log('Après extraction:');
        console.log('  - presence.totalCheckins:', presence.totalCheckins || 0);
        console.log('  - presence.presenceRate:', presence.presenceRate || 0);
        console.log('  - activities.total:', activities.total || 0);
        console.log('  - activities.performance?.executionRate:', activities.performance?.executionRate || 0);

        // 4. Simuler le calcul comme dans synthese-globale.html
        const presenceRate = Number(presence.presenceRate || 0);
        const tepRate = Number(activities.performance?.executionRate || 0);
        const fieldTimeHours = Number(presence.fieldTimeHours || 0);

        console.log('\n📊 Valeurs calculées pour le tableau:');
        console.log('  - Taux de présence:', presenceRate.toFixed(1) + '%');
        console.log('  - Taux TEP:', tepRate.toFixed(1) + '%');
        console.log('  - Temps terrain:', fieldTimeHours.toFixed(1) + 'h');
        console.log('  - Jours travaillés:', presence.workedDays || 0);
        console.log('  - Check-ins total:', presence.totalCheckins || 0);

        if (presenceRate === 0 && tepRate === 0 && fieldTimeHours === 0) {
            console.log('\n⚠️ PROBLÈME DÉTECTÉ: Toutes les valeurs sont à 0!');
            console.log('Vérification du rapport complet...');
            console.log(JSON.stringify(report, null, 2));
        } else {
            console.log('\n✅ Les données semblent correctes!');
        }

    } catch (error) {
        console.error('\n❌ Erreur:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

// Exécuter le test
testMonthlyReport();
