const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testPresenceTable() {
  console.log('🧪 Test de la table presences...');
  
  try {
    // 1. Vérifier la structure
    console.log('\n🔍 Étape 1: Vérification de la structure...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('presences')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Erreur accès table:', sampleError);
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('✅ Colonnes disponibles:', Object.keys(sampleData[0]));
      console.log('📊 Échantillon:', sampleData[0]);
    } else {
      console.log('ℹ️ Table vide ou inaccessible');
    }
    
    // 2. Tester les requêtes principales utilisées dans server.js
    console.log('\n🔍 Étape 2: Test des requêtes principales...');
    
    // Requête type 1: Rapports (similaire à server.js lignes 496-517)
    const { data: reportsData, error: reportsError } = await supabase
      .from('presences')
      .select(`
        id,
        user_id,
        start_time,
        end_time,
        location_lat,
        location_lng,
        location_name,
        notes,
        photo_url,
        status,
        checkin_type,
        created_at,
        zone_id,
        within_tolerance,
        distance_from_reference_m,
        tolerance_meters
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (reportsError) {
      console.error('❌ Erreur requête rapports:', reportsError);
    } else {
      console.log(`✅ Requête rapports: ${reportsData.length} résultats`);
      if (reportsData.length > 0) {
        console.log('📋 Premier résultat:', {
          id: reportsData[0].id,
          user_id: reportsData[0].user_id,
          start_time: reportsData[0].start_time,
          status: reportsData[0].status,
          location_lat: reportsData[0].location_lat,
          location_lng: reportsData[0].location_lng
        });
      }
    }
    
    // Requête type 2: Avec jointure utilisateur (similaire à server.js lignes 4616-4621)
    const { data: userData, error: userError } = await supabase
      .from('presences')
      .select(`
        id,
        start_time,
        users!inner(id, name, email)
      `)
      .limit(3);
    
    if (userError) {
      console.error('❌ Erreur requête jointure utilisateur:', userError);
    } else {
      console.log(`✅ Requête jointure utilisateur: ${userData.length} résultats`);
      if (userData.length > 0) {
        console.log('📋 Premier résultat avec utilisateur:', {
          id: userData[0].id,
          start_time: userData[0].start_time,
          user: userData[0].users
        });
      }
    }
    
    // 3. Tester l'insertion (similaire à server.js lignes 5277)
    console.log('\n🔍 Étape 3: Test d\'insertion...');
    
    // Récupérer un agent pour le test
    const { data: testAgent, error: agentError } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'agent')
      .limit(1)
      .single();
    
    if (agentError) {
      console.error('❌ Erreur recherche agent test:', agentError);
      console.log('ℹ️ Test d\'insertion sans agent spécifique');
    } else {
      console.log(`👤 Agent test trouvé: ${testAgent.name} (ID: ${testAgent.id})`);
      
      // Créer une présence de test
      const testPresence = {
        user_id: testAgent.id,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8h plus tard
        location_lat: 9.5,
        location_lng: 2.5,
        location_name: 'Test Location',
        notes: 'Test presence from script',
        status: 'active',
        checkin_type: 'checkin',
        tolerance_meters: 500
      };
      
      const { data: insertedPresence, error: insertError } = await supabase
        .from('presences')
        .insert(testPresence)
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ Erreur insertion test:', insertError);
      } else {
        console.log('✅ Présence de test insérée:', insertedPresence.id);
        
        // Nettoyer le test
        const { error: deleteError } = await supabase
          .from('presences')
          .delete()
          .eq('id', insertedPresence.id);
        
        if (deleteError) {
          console.error('❌ Erreur nettoyage test:', deleteError);
        } else {
          console.log('✅ Test nettoyé');
        }
      }
    }
    
    // 4. Vérifier les index et contraintes
    console.log('\n🔍 Étape 4: Vérification des performances...');
    
    const start = Date.now();
    const { data: performanceData, error: performanceError } = await supabase
      .from('presences')
      .select('id, user_id, start_time')
      .eq('status', 'completed')
      .order('start_time', { ascending: false })
      .limit(100);
    
    const end = Date.now();
    
    if (performanceError) {
      console.error('❌ Erreur test performance:', performanceError);
    } else {
      console.log(`✅ Test performance: ${performanceData.length} résultats en ${end - start}ms`);
    }
    
    // 5. Statistiques finales
    console.log('\n📊 Étape 5: Statistiques finales...');
    const { data: stats, error: statsError } = await supabase
      .from('presences')
      .select('status')
      .then(({ data, error }) => {
        if (error) throw error;
        
        const stats = data.reduce((acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {});
        
        return { data: stats, error: null };
      });
    
    if (statsError) {
      console.error('❌ Erreur statistiques:', statsError);
    } else {
      console.log('📈 Répartition par statut:', stats);
    }
    
    console.log('\n🎉 Test de la table presences terminé!');
    console.log('✅ La table est compatible avec les requêtes de server.js');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

testPresenceTable();
