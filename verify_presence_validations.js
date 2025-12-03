const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables d\'environnement Supabase manquantes');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPresenceValidations() {
    console.log('🔍 Vérification de la table presence_validations\n');
    console.log('='.repeat(70));

    try {
        // 1. Compter total
        const { count: totalCount, error: countError } = await supabase
            .from('presence_validations')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('❌ Erreur:', countError.message);
            throw countError;
        }

        console.log(`\n📊 Total presence_validations : ${totalCount || 0}`);

        // 2. Par statut
        console.log('\n📋 Répartition par statut :');
        const statuses = ['validated', 'rejected', 'pending'];

        for (const status of statuses) {
            const { count, error } = await supabase
                .from('presence_validations')
                .select('*', { count: 'exact', head: true })
                .eq('validation_status', status);

            if (!error) {
                const emoji = status === 'validated' ? '✅' : status === 'rejected' ? '❌' : '⏳';
                console.log(`   ${emoji} ${status.padEnd(10)} : ${count || 0}`);
            }
        }

        // 3. Exemples récents
        console.log('\n📝 Exemples récents (10 derniers) :');
        const { data: samples, error: samplesError } = await supabase
            .from('presence_validations')
            .select('id, user_id, checkin_timestamp, validation_status, checkin_location_name, photo_url')
            .order('checkin_timestamp', { ascending: false })
            .limit(10);

        if (samplesError) {
            console.error('❌ Erreur:', samplesError.message);
        } else if (samples && samples.length > 0) {
            samples.forEach(pv => {
                const emoji = pv.validation_status === 'validated' ? '✅' :
                    pv.validation_status === 'rejected' ? '❌' : '⏳';
                console.log(`   ${emoji} User ${pv.user_id} - ${pv.checkin_timestamp} - ${pv.validation_status} - ${pv.checkin_location_name || 'N/A'}`);
            });
        } else {
            console.log('   ⚠️  Aucune donnée trouvée');
        }

        // 4. Vérifier pour novembre 2025
        console.log('\n📅 Vérification pour NOVEMBRE 2025 :');
        const { count: novCount, error: novError } = await supabase
            .from('presence_validations')
            .select('*', { count: 'exact', head: true })
            .gte('checkin_timestamp', '2025-11-01T00:00:00.000Z')
            .lte('checkin_timestamp', '2025-11-30T23:59:59.999Z');

        if (!novError) {
            console.log(`   Total novembre 2025: ${novCount || 0}`);
        }

        const { count: novValidated, error: novValError } = await supabase
            .from('presence_validations')
            .select('*', { count: 'exact', head: true })
            .eq('validation_status', 'validated')
            .gte('checkin_timestamp', '2025-11-01T00:00:00.000Z')
            .lte('checkin_timestamp', '2025-11-30T23:59:59.999Z');

        if (!novValError) {
            console.log(`   ✅ Validées novembre 2025: ${novValidated || 0}`);
        }

        // 5. Par utilisateur pour novembre 2025
        console.log('\n👥 Par utilisateur (Novembre 2025 VALIDÉES) :');
        const { data: userStats, error: userError } = await supabase
            .from('presence_validations')
            .select('user_id')
            .eq('validation_status', 'validated')
            .gte('checkin_timestamp', '2025-11-01T00:00:00.000Z')
            .lte('checkin_timestamp', '2025-11-30T23:59:59.999Z');

        if (!userError && userStats && userStats.length > 0) {
            const userCounts = {};
            userStats.forEach(row => {
                userCounts[row.user_id] = (userCounts[row.user_id] || 0) + 1;
            });

            Object.entries(userCounts)
                .sort((a, b) => b[1] - a[1])
                .forEach(([userId, count]) => {
                    console.log(`   User ID ${userId}: ${count} présences validées`);
                });
        } else {
            console.log('   ⚠️  Aucune présence validée pour novembre 2025');
        }

        // 6. Vérifier les users pertinents
        console.log('\n👤 Utilisateurs du projet DELTA MONO :');
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, name, email, project_name')
            .eq('project_name', 'DELTA MONO')
            .order('id', { ascending: true });

        if (!usersError && users && users.length > 0) {
            console.log(`   ${users.length} utilisateurs trouvés :`);
            users.forEach(user => {
                console.log(`      - ID: ${user.id}, Name: ${user.name}, Email: ${user.email}`);
            });
        }

        // 7. DIAGNOSTIC FINAL
        console.log('\n' + '='.repeat(70));
        console.log('🔍 DIAGNOSTIC FINAL\n');

        if (!totalCount || totalCount === 0) {
            console.log('❌ PROBLÈME: Table presence_validations VIDE');
            console.log('   → Aucune donnée de présence dans le système');
            console.log('   → Les agents doivent enregistrer leurs présences');
            console.log('   → Ou importer des données historiques');
        } else if (!novValidated || novValidated === 0) {
            console.log('⚠️  PROBLÈME: Aucune présence VALIDÉE pour novembre 2025');
            if (novCount && novCount > 0) {
                console.log(`   → Il y a ${novCount} présences NON VALIDÉES`);
                console.log('   → Un admin doit VALIDER ces présences');
                console.log('   → Ou modifier validation_status = \'validated\'');
            } else {
                console.log('   → Aucune présence du tout pour novembre 2025');
                console.log('   → Sélectionner un autre mois avec des données');
            }
        } else {
            console.log(`✅ SUCCÈS: ${novValidated} présences validées trouvées pour novembre 2025`);
            console.log('   → Les données existent dans la base');
            console.log('   → Le serveur doit être redémarré pour voir les changements');
            console.log('   → Vérifier les logs du serveur et du navigateur');
        }

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('\n❌ ERREUR FATALE:');
        console.error(`   Message: ${error.message}`);
        if (error.details) {
            console.error(`   Détails: ${error.details}`);
        }
    }
}

verifyPresenceValidations();
