const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addPermission() {
  try {
    console.log('Ajout d\'une permission pour Goukalodé Calixte (ID 91)...');
    
    const permissionData = {
      agent_id: 91,
      start_date: '2024-11-12',
      end_date: '2024-11-20',
      reason: 'Permission personnelle',
      status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('permissions')
      .insert([permissionData])
      .select();

    if (error) {
      console.error('Erreur lors de l\'ajout de la permission:', error);
      return;
    }

    console.log('✅ Permission ajoutée avec succès:', data);
    console.log(`📅 Période: 12 novembre 2024 - 20 novembre 2024 (8 jours)`);
    console.log(`👤 Agent: Goukalodé Calixte (ID: 91)`);
    
  } catch (error) {
    console.error('Erreur:', error.message);
  }
}

addPermission();
