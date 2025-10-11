// Script pour aider les utilisateurs bloqués avec des codes de vérification
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

async function listBlockedUsers() {
  try {
    console.log('🔍 Recherche des utilisateurs bloqués (non vérifiés)...\n');
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, is_verified, verification_code, verification_expires, created_at')
      .eq('is_verified', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('❌ Erreur:', error.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('✅ Aucun utilisateur bloqué trouvé');
      return;
    }

    console.log(`📊 ${users.length} utilisateur(s) bloqué(s) trouvé(s):\n`);

    users.forEach((user, index) => {
      const expires = user.verification_expires ? new Date(user.verification_expires).toLocaleString() : 'Non défini';
      const isExpired = user.verification_expires ? new Date(user.verification_expires) < new Date() : false;
      
      console.log(`${index + 1}. 👤 ${user.name} (${user.email})`);
      console.log(`   🆔 ID: ${user.id}`);
      console.log(`   👔 Rôle: ${user.role}`);
      console.log(`   📅 Créé: ${new Date(user.created_at).toLocaleString()}`);
      console.log(`   🔑 Code: ${user.verification_code || 'Aucun'}`);
      console.log(`   ⏰ Expire: ${expires} ${isExpired ? '(EXPIRÉ)' : ''}`);
      console.log(`   📞 Contact: syebadokpo@gmail.com | +229 01 96 91 13 46`);
      console.log('');
    });

    // Afficher les instructions pour le super admin
    console.log('🛠️  Instructions pour le super admin:');
    console.log('1. Contactez chaque utilisateur par email ou téléphone');
    console.log('2. Donnez-leur leur code de vérification');
    console.log('3. Ou utilisez le script pour les vérifier manuellement:');
    console.log('   node database/admin_verification_helper.js verify email@utilisateur.com');
    console.log('');

  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

async function generateNewCodeForUser(email) {
  try {
    console.log(`🔍 Recherche de l'utilisateur: ${email}`);
    
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error) {
      console.log('❌ Erreur de recherche:', error.message);
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

    // Générer un nouveau code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    console.log(`🔑 Nouveau code généré: ${verificationCode}`);
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
    console.log(`4. Si le problème persiste, contactez: syebadokpo@gmail.com | +229 01 96 91 13 46`);

  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

async function verifyUserManually(email) {
  try {
    console.log(`🔍 Recherche de l'utilisateur: ${email}`);
    
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error) {
      console.log('❌ Erreur de recherche:', error.message);
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

  console.log('🆘 Aide pour les utilisateurs bloqués - Presence CCRB\n');

  switch (command) {
    case 'list':
      await listBlockedUsers();
      break;

    case 'generate':
      if (!email) {
        console.log('❌ Usage: node help_blocked_users.js generate <email>');
        return;
      }
      await generateNewCodeForUser(email);
      break;

    case 'verify':
      if (!email) {
        console.log('❌ Usage: node help_blocked_users.js verify <email>');
        return;
      }
      await verifyUserManually(email);
      break;

    default:
      console.log('📋 Commandes disponibles:');
      console.log('  list                    - Lister tous les utilisateurs bloqués');
      console.log('  generate <email>        - Générer un nouveau code pour un utilisateur');
      console.log('  verify <email>          - Vérifier manuellement un utilisateur');
      console.log('\n📞 Contact super admin: syebadokpo@gmail.com | +229 01 96 91 13 46');
  }
}

main();
