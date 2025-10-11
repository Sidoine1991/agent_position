// Script pour vérifier la configuration email
const nodemailer = require('nodemailer');

async function checkEmailConfig() {
  console.log('🔍 Vérification de la configuration email...\n');
  
  // Vérifier les variables d'environnement
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  console.log('📧 Configuration email:');
  console.log(`   EMAIL_USER: ${emailUser ? '✅ Configuré' : '❌ Manquant'}`);
  console.log(`   EMAIL_PASS: ${emailPass ? '✅ Configuré' : '❌ Manquant'}`);
  
  if (!emailUser || !emailPass) {
    console.log('\n❌ Configuration email manquante!');
    console.log('📋 Instructions:');
    console.log('1. Créez un fichier .env à la racine du projet');
    console.log('2. Ajoutez les variables suivantes:');
    console.log('   EMAIL_USER=votre-email@gmail.com');
    console.log('   EMAIL_PASS=votre-app-password');
    console.log('3. Redémarrez le serveur');
    return;
  }
  
  // Tester la connexion Gmail
  console.log('\n🧪 Test de connexion Gmail...');
  
  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });
    
    // Vérifier la connexion
    await transporter.verify();
    console.log('✅ Connexion Gmail réussie!');
    
    // Test d'envoi (optionnel)
    console.log('\n📤 Test d\'envoi d\'email...');
    const testEmail = {
      from: emailUser,
      to: emailUser, // Envoyer à soi-même pour test
      subject: 'Test de configuration email - Presence CCRB',
      html: `
        <h2>Test de configuration email</h2>
        <p>Si vous recevez cet email, la configuration fonctionne correctement.</p>
        <p>Date: ${new Date().toLocaleString()}</p>
      `
    };
    
    await transporter.sendMail(testEmail);
    console.log('✅ Email de test envoyé avec succès!');
    console.log('📧 Vérifiez votre boîte email (et le dossier spam)');
    
  } catch (error) {
    console.log('❌ Erreur de configuration email:');
    console.log(`   ${error.message}`);
    
    if (error.message.includes('Invalid login')) {
      console.log('\n🔧 Solution:');
      console.log('1. Activez la validation en 2 étapes sur votre compte Google');
      console.log('2. Générez un "App Password" dans les paramètres de sécurité');
      console.log('3. Utilisez ce mot de passe dans EMAIL_PASS');
    }
  }
}

checkEmailConfig();
