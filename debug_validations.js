const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_ANON_KEY manquant dans .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugValidations() {
  try {
    console.log('🔍 Vérification des données de validation...');
    
    // 1. Compter le total des validations
    const { count: totalCount, error: countError } = await supabase
      .from('checkin_validations')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Erreur comptage total:', countError);
      return;
    }
    
    console.log(`📊 Total validations dans la table: ${totalCount}`);
    
    // 2. Vérifier les validations pour les dates récentes
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`🔍 Vérification des validations pour aujourd'hui (${today}) et hier (${yesterday})`);
    
    const { data: recentValidations, error: recentError } = await supabase
      .from('checkin_validations')
      .select('*')
      .gte('created_at', `${yesterday}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`)
      .limit(10);
    
    if (recentError) {
      console.error('❌ Erreur validations récentes:', recentError);
      return;
    }
    
    console.log(`📊 Validations récentes trouvées: ${recentValidations?.length || 0}`);
    
    if (recentValidations && recentValidations.length > 0) {
      console.log('🔍 Exemples de validations récentes:');
      recentValidations.forEach((v, i) => {
        console.log(`  ${i + 1}. ID: ${v.id}, Agent: ${v.agent_id}, Valid: ${v.valid}, Created: ${v.created_at}`);
      });
    }
    
    // 3. Vérifier les utilisateurs avec rôle agent/superviseur
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, role, name')
      .in('role', ['agent', 'superviseur'])
      .limit(10);
    
    if (usersError) {
      console.error('❌ Erreur utilisateurs:', usersError);
      return;
    }
    
    console.log(`👥 Utilisateurs agents/superviseurs: ${users?.length || 0}`);
    
    if (users && users.length > 0) {
      console.log('🔍 Exemples d\'utilisateurs:');
      users.forEach((u, i) => {
        console.log(`  ${i + 1}. ID: ${u.id}, Role: ${u.role}, Name: ${u.name}`);
      });
    }
    
    // 4. Vérifier s'il y a des checkins récents
    const { data: recentCheckins, error: checkinsError } = await supabase
      .from('checkins')
      .select('*')
      .gte('timestamp', `${yesterday}T00:00:00.000Z`)
      .lte('timestamp', `${today}T23:59:59.999Z`)
      .limit(5);
    
    if (checkinsError) {
      console.error('❌ Erreur checkins récents:', checkinsError);
      return;
    }
    
    console.log(`📍 Checkins récents: ${recentCheckins?.length || 0}`);
    
    if (recentCheckins && recentCheckins.length > 0) {
      console.log('🔍 Exemples de checkins récents:');
      recentCheckins.forEach((c, i) => {
        console.log(`  ${i + 1}. ID: ${c.id}, Mission: ${c.mission_id}, Timestamp: ${c.timestamp}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

debugValidations();
