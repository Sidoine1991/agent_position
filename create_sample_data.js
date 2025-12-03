/**
 * Script pour créer des check-ins et présences de test
 * À exécuter pour avoir des données dans le tableau de synthèse globale
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables d\'environnement Supabase manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const MOIS_A_GENERER = '2024-12'; // Format YYYY-MM
const NOMBRE_CHECKINS_PAR_JOUR = 3; // Nombre de check-ins par jour
const NOMBRE_JOURS = 20; // Nombre de jours à générer

async function createSampleData() {
    console.log('🔧 Création de données de test pour le tableau de synthèse globale\n');
    console.log(`📅 Mois: ${MOIS_A_GENERER}`);
    console.log(`📊 ${NOMBRE_CHECKINS_PAR_JOUR} check-ins par jour pendant ${NOMBRE_JOURS} jours\n`);

    try {
        // 1. Récupérer les utilisateurs existants
        console.log('👥 Récupération des utilisateurs...');
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, name, email, role')
            .limit(10);

        if (usersError) throw usersError;

        if (!users || users.length === 0) {
            console.error('❌ Aucun utilisateur trouvé dans la base de données');
            console.log('\n💡 Vous devez d\'abord créer des utilisateurs dans Supabase');
            return;
        }

        console.log(`✅ ${users.length} utilisateurs trouvés\n`);
        users.forEach(user => {
            console.log(`   - ID: ${user.id}, Name: ${user.name || 'N/A'}, Email: ${user.email}`);
        });

        // 2. Demander confirmation
        console.log(`\n⚠️  Ce script va créer environ ${users.length * NOMBRE_JOURS * NOMBRE_CHECKINS_PAR_JOUR} check-ins`);
        console.log('   Appuyez sur Ctrl+C pour annuler dans les 3 secondes...\n');

        await new Promise(resolve => setTimeout(resolve, 3000));

        // 3. Générer les check-ins
        const [year, month] = MOIS_A_GENERER.split('-').map(Number);
        let totalCreated = 0;
        let totalErrors = 0;

        console.log('📝 Création des check-ins...\n');

        for (const user of users) {
            console.log(`\n👤 Génération pour ${user.name || user.email}...`);

            for (let day = 1; day <= NOMBRE_JOURS; day++) {
                const date = new Date(Date.UTC(year, month - 1, day));

                // Ignorer les week-ends
                const dayOfWeek = date.getUTCDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) continue;

                for (let checkinNum = 0; checkinNum < NOMBRE_CHECKINS_PAR_JOUR; checkinNum++) {
                    // Heures réalistes : 8h-9h, 12h-13h, 17h-18h
                    const hours = checkinNum === 0 ? 8 + Math.random() :
                        checkinNum === 1 ? 12 + Math.random() :
                            17 + Math.random();

                    const checkinTime = new Date(Date.UTC(year, month - 1, day, Math.floor(hours), Math.floor((hours % 1) * 60)));

                    // Coordonnées aléatoires autour de Yaoundé, Cameroun
                    const lat = 3.8 + (Math.random() - 0.5) * 0.1;
                    const lon = 11.5 + (Math.random() - 0.5) * 0.1;

                    const checkinData = {
                        user_id: user.id,
                        lat: lat,
                        lon: lon,
                        start_time: checkinTime.toISOString(),
                        created_at: checkinTime.toISOString(),
                        type: 'checkin',
                        note: `Check-in de test - ${date.toISOString().split('T')[0]}`,
                        accuracy: 10 + Math.random() * 20
                    };

                    try {
                        const { error } = await supabase
                            .from('checkins')
                            .insert([checkinData]);

                        if (error) {
                            console.error(`   ❌ Erreur: ${error.message}`);
                            totalErrors++;
                        } else {
                            totalCreated++;
                        }
                    } catch (error) {
                        console.error(`   ❌ Erreur insertion: ${error.message}`);
                        totalErrors++;
                    }
                }
            }

            console.log(`   ✅ Check-ins créés pour ${user.name || user.email}`);
        }

        // 4. Créer des planifications
        console.log('\n\n📋 Création des planifications...\n');

        for (const user of users) {
            for (let day = 1; day <= NOMBRE_JOURS; day++) {
                const date = new Date(Date.UTC(year, month - 1, day));
                const dayOfWeek = date.getUTCDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) continue;

                const planificationData = {
                    user_id: user.id,
                    agent_id: user.id,
                    date: date.toISOString().split('T')[0],
                    description_activite: `Activité de test - Jour ${day}`,
                    resultat_journee: Math.random() > 0.3 ? 'realise' : (Math.random() > 0.5 ? 'en_cours' : 'non_realise'),
                    observations: 'Données de test générées automatiquement',
                    planned_start_time: '08:00:00',
                    planned_end_time: '17:00:00',
                    planned_hours: 8
                };

                try {
                    const { error } = await supabase
                        .from('planifications')
                        .insert([planificationData]);

                    if (!error) {
                        totalCreated++;
                    }
                } catch (error) {
                    // Ignorer les erreurs de planifications
                }
            }
        }

        // 5. Résumé
        console.log('\n' + '='.repeat(70));
        console.log('📊 RÉSUMÉ\n');
        console.log(`✅ ${totalCreated} enregistrements créés avec succès`);
        if (totalErrors > 0) {
            console.log(`❌ ${totalErrors} erreurs rencontrées`);
        }
        console.log('\n💡 Vous pouvez maintenant tester le tableau de synthèse globale!');
        console.log(`   URL: http://localhost:3000/web/synthese-globale.html`);
        console.log(`   Sélectionnez le mois: ${MOIS_A_GENERER}\n`);
        console.log('='.repeat(70));

    } catch (error) {
        console.error('\n❌ ERREUR FATALE:');
        console.error(`   Message: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

// Exécuter
createSampleData();
