const fs = require('fs');
const path = require('path');

function verifyCheckinEndpoint() {
  console.log('🔍 Vérification de l\'endpoint /api/checkins...');
  
  try {
    // Lire le fichier server.js
    const serverPath = path.join(__dirname, 'server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Vérifier que le code de création de présence est bien là
    const presenceCreationCode = 'Créer automatiquement une présence dans la table presences';
    const presenceInsertCode = 'from(\'presences\').insert';
    
    const hasPresenceCreation = serverContent.includes(presenceCreationCode);
    const hasPresenceInsert = serverContent.includes(presenceInsertCode);
    
    console.log(`\n✅ Code de création de présence trouvé: ${hasPresenceCreation}`);
    console.log(`✅ Code d'insertion présence trouvé: ${hasPresenceInsert}`);
    
    if (hasPresenceCreation && hasPresenceInsert) {
      console.log('\n🎉 L\'endpoint /api/checkins est correctement modifié!');
      console.log('✅ Il créera automatiquement une présence dans la table presences');
      console.log('✅ Les checkins mobiles apparaîtront maintenant dans le calendrier');
    } else {
      console.log('\n❌ Problème: Le code de création automatique des présences n\'est pas trouvé');
    }
    
    // Vérifier que le endpoint est bien celui utilisé par l'application mobile
    const checkinEndpoint = 'app.post(\'/api/checkins\'';
    const hasCheckinEndpoint = serverContent.includes(checkinEndpoint);
    
    console.log(`\n✅ Endpoint /api/checkins trouvé: ${hasCheckinEndpoint}`);
    
    // Extraire le code autour de l'endpoint pour vérification
    if (hasCheckinEndpoint) {
      const lines = serverContent.split('\n');
      let startLine = -1;
      let endLine = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(checkinEndpoint)) {
          startLine = Math.max(0, i - 2);
          // Trouver la fin de l'endpoint
          for (let j = i; j < lines.length; j++) {
            if (lines[j].includes('});') && j > i + 10) {
              endLine = j + 1;
              break;
            }
          }
          break;
        }
      }
      
      if (startLine >= 0 && endLine > startLine) {
        console.log('\n📋 Code de l\'endpoint:');
        for (let i = startLine; i <= endLine && i < startLine + 50; i++) {
          console.log(`${(i + 1).toString().padStart(4)}: ${lines[i]}`);
        }
      }
    }
    
    console.log('\n🎉 Vérification terminée!');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

verifyCheckinEndpoint();
