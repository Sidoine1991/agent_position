// Script d'aide pour le super admin - Génération de codes de vérification alternatifs
const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  console.log('📋 Configurez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function generateVerificationCode(email) {
  try {
    console.log(`🔍 Recherche de l'utilisateur: ${email}`);
    
    // Rechercher l'utilisateur
    const { data: users, error: searchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (searchError) {
      console.log('❌ Erreur de recherche:', searchError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ Utilisateur non trouvé');
      return;
    }

    const user = users[0];
    console.log(`✅ Utilisateur trouvé: ${user.name} (ID: ${user.id})`);
    console.log(`📊 Statut de vérification: ${user.is_verified ? 'Vérifié' : 'Non vérifié'}`);

    if (user.is_verified) {
      console.log('⚠️  Cet utilisateur est déjà vérifié');
      return;
    }

    // Générer un nouveau code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    console.log(`🔑 Code généré: ${verificationCode}`);
    console.log(`⏰ Expire le: ${verificationExpires.toLocaleString()}`);

    // Mettre à jour l'utilisateur
    const { error: updateError } = await supabase
      .from('users')
      .update({
        verification_code: verificationCode,
        verification_expires: verificationExpires.toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.log('❌ Erreur de mise à jour:', updateError.message);
      return;
    }

    console.log('✅ Code de vérification mis à jour avec succès!');
    console.log('\n📋 Instructions pour l\'utilisateur:');
    console.log(`1. Allez sur la page de vérification`);
    console.log(`2. Entrez le code: ${verificationCode}`);
    console.log(`3. Le code expire dans 24 heures`);

    return verificationCode;

  } catch (error) {
    console.log('❌ Erreur générale:', error.message);
  }
}

async function listUnverifiedUsers() {
  try {
    console.log('📋 Liste des utilisateurs non vérifiés:\n');
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at, verification_expires')
      .eq('is_verified', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('❌ Erreur:', error.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('✅ Aucun utilisateur non vérifié');
      return;
    }

    users.forEach((user, index) => {
      const expires = user.verification_expires ? new Date(user.verification_expires).toLocaleString() : 'Non défini';
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   Rôle: ${user.role}`);
      console.log(`   Créé: ${new Date(user.created_at).toLocaleString()}`);
      console.log(`   Code expire: ${expires}`);
      console.log('');
    });

  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

async function verifyUserManually(email) {
  try {
    console.log(`🔍 Recherche de l'utilisateur: ${email}`);
    
    const { data: users, error: searchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (searchError) {
      console.log('❌ Erreur de recherche:', searchError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ Utilisateur non trouvé');
      return;
    }

    const user = users[0];
    
    if (user.is_verified) {
      console.log('✅ Cet utilisateur est déjà vérifié');
      return;
    }

    // Marquer comme vérifié
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_verified: true,
        verification_code: null,
        verification_expires: null
      })
      .eq('id', user.id);

    if (updateError) {
      console.log('❌ Erreur de mise à jour:', updateError.message);
      return;
    }

    console.log('✅ Utilisateur vérifié manuellement avec succès!');
    console.log(`📧 ${user.name} (${user.email}) peut maintenant se connecter`);

  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

// Interface en ligne de commande
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const email = args[1];

  console.log('🛠️  Outil d\'aide pour le super admin - Presence CCRB\n');

  switch (command) {
    case 'generate':
      if (!email) {
        console.log('❌ Usage: node admin_verification_helper.js generate <email>');
        return;
      }
      await generateVerificationCode(email);
      break;

    case 'verify':
      if (!email) {
        console.log('❌ Usage: node admin_verification_helper.js verify <email>');
        return;
      }
      await verifyUserManually(email);
      break;

    case 'list':
      await listUnverifiedUsers();
      break;

    default:
      console.log('📋 Commandes disponibles:');
      console.log('  generate <email>  - Générer un nouveau code de vérification');
      console.log('  verify <email>    - Vérifier manuellement un utilisateur');
      console.log('  list              - Lister les utilisateurs non vérifiés');
      console.log('\n📞 Contact: syebadokpo@gmail.com | +229 01 96 91 13 46');
  }
}

main();
