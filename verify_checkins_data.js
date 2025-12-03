const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log('🔧 Configuration Supabase:');
console.log(`   URL: ${supabaseUrl ? '✅ Présent' : '❌ Manquant'}`);
console.log(`   Key: ${supabaseKey ? '✅ Présent' : '❌ Manquant'}\n`);

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables d\'environnement Supabase manquantes');
    console.error('   Vérifiez votre fichier .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCheckinsData() {
    console.log('🔍 Vérification des données de check-ins\n');

    try {
        // 1. Compter total des check-ins
        console.log('📊 Comptage des check-ins totaux...');
        const { count: totalCheckins, error: countError } = await supabase
            .from('checkins')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error(`❌ Erreur lors du comptage: ${countError.message}`);
            throw countError;
        }
        console.log(`   Total check-ins dans la base : ${totalCheckins || 0}\n`);

        // 2. Récupérer quelques exemples
        console.log('📋 Récupération d\'exemples récents...');
        const { data: samples, error: samplesError } = await supabase
            .from('checkins')
            .select('id, user_id, created_at, start_time, end_time, type, lat, lon')
            .order('created_at', { ascending: false })
            .limit(5);

        if (samplesError) {
            console.error(`❌ Erreur lors de la récupération des exemples: ${samplesError.message}`);
        } else if (samples && samples.length > 0) {
            console.log(`   ✅ ${samples.length} check-ins récents trouvés:`);
            samples.forEach(checkin => {
                const displayDate = checkin.created_at || checkin.start_time || 'N/A';
                console.log(`      - ID: ${checkin.id}, User: ${checkin.user_id}, Date: ${displayDate}, Type: ${checkin.type || 'checkin'}`);
            });
        } else {
            console.log('   ⚠️  Aucun check-in trouvé dans la base');
        }

        // 3. Vérifier par mois
        const currentMonth = new Date().toISOString().substring(0, 7);
        const [year, month] = currentMonth.split('-').map(Number);
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).toISOString();
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();

        console.log(`\n📅 Vérification pour le mois en cours (${currentMonth}) :`);
        console.log(`   Plage de dates : ${startOfMonth} à ${endOfMonth}`);

        const { count: monthCheckins, error: monthError } = await supabase
            .from('checkins')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfMonth)
            .lte('created_at', endOfMonth);

        if (monthError) {
            console.error(`❌ Erreur: ${monthError.message}`);
        } else {
            console.log(`   Check-ins ce mois : ${monthCheckins || 0}`);
        }

        // 4. Vérifier par utilisateur
        console.log(`\n👥 Statistiques par utilisateur pour ${currentMonth}...`);
        const { data: userStats, error: userError } = await supabase
            .from('checkins')
            .select('user_id')
            .gte('created_at', startOfMonth)
            .lte('created_at', endOfMonth);

        if (userError) {
            console.error(`❌ Erreur: ${userError.message}`);
        } else if (userStats && userStats.length > 0) {
            const userCounts = {};
            userStats.forEach(row => {
                userCounts[row.user_id] = (userCounts[row.user_id] || 0) + 1;
            });

            console.log(`   Check-ins par utilisateur:`);
            Object.entries(userCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .forEach(([userId, count]) => {
                    console.log(`      User ID ${userId}: ${count} check-ins`);
                });
        } else {
            console.log('   Aucun check-in trouvé pour ce mois');
        }

        // 5. Vérifier les utilisateurs
        console.log(`\n👤 Liste des utilisateurs (10 premiers)...`);
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, name, email, role, project_name')
            .order('id', { ascending: true })
            .limit(10);

        if (usersError) {
            console.error(`❌ Erreur: ${usersError.message}`);
        } else if (users && users.length > 0) {
            console.log(`   ${users.length} utilisateurs trouvés:`);
            users.forEach(user => {
                console.log(`      ID: ${user.id}, Name: ${user.name || 'N/A'}, Email: ${user.email || 'N/A'}, Project: ${user.project_name || 'N/A'}`);
            });
        } else {
            console.log('   Aucun utilisateur trouvé');
        }

        // 6. Vérifier les planifications
        console.log(`\n📋 Vérification des planifications pour ${currentMonth}...`);
        const { count: totalPlanifications, error: planError } = await supabase
            .from('planifications')
            .select('*', { count: 'exact', head: true })
            .gte('date', startOfMonth.split('T')[0])
            .lte('date', endOfMonth.split('T')[0]);

        if (planError) {
            console.log(`   ⚠️  Erreur: ${planError.message}`);
        } else {
            console.log(`   Planifications ce mois : ${totalPlanifications || 0}`);
        }

        // 7. Résumé et recommandations
        console.log('\n' + '='.repeat(70));
        console.log('📊 RÉSUMÉ ET DIAGNOSTIC\n');

        if (!totalCheckins || totalCheckins === 0) {
            console.log('❌ PROBLÈME CRITIQUE: Aucun check-in dans la base de données');
            console.log('   → Les agents doivent utiliser l\'application mobile pour faire des check-ins');
            console.log('   → Vérifiez que la synchronisation fonctionne correctement');
            console.log('   → Le tableau de synthèse globale sera VIDE');
        } else if (!monthCheckins || monthCheckins === 0) {
            console.log('⚠️  AVERTISSEMENT: Aucun check-in pour le mois en cours');
            console.log(`   → Il y a ${totalCheckins} check-ins au total, mais aucun pour ${currentMonth}`);
            console.log('   → Les agents doivent faire des check-ins ce mois-ci');
            console.log('   → Le tableau de synthèse globale sera VIDE pour ce mois');
            console.log('\n💡 SOLUTION: Sélectionnez un autre mois avec des données dans le filtre');
        } else {
            console.log(`✅ DONNÉES DISPONIBLES: ${monthCheckins} check-ins trouvés pour ${currentMonth}`);
            console.log('   → Le tableau de synthèse devrait afficher des données');
            console.log('   → Si le problème persiste après correction du code:');
            console.log('      1. Vérifiez les logs dans la console du navigateur (F12)');
            console.log('      2. Redémarrez le serveur Node.js');
            console.log('      3. Videz le cache du navigateur (Ctrl+F5)');
        }

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('\n❌ ERREUR FATALE:');
        console.error(`   Message: ${error.message}`);
        if (error.details) {
            console.error(`   Détails: ${error.details}`);
        }
        if (error.hint) {
            console.error(`   Suggestion: ${error.hint}`);
        }
    }
}

verifyCheckinsData();
