const jwt = require('jsonwebtoken');
require('dotenv').config();

// Charger la configuration JWT
const config = require('./config');
const JWT_SECRET = config.JWT_SECRET;

// ID d'utilisateur de test (utilisez un ID valide de votre base de données)
const userId = 126; // Remplacer par un ID valide de votre base de données
const userEmail = 'desiboni@yahoo.fr'; // Remplacer par un email valide de votre base de données

// Créer un payload similaire à celui du serveur
const payload = {
  id: userId,
  auth_uuid: `auth0|${userId}`, // Format attendu par le serveur
  email: userEmail,
  role: 'admin',
  name: 'Test User'
};

// Options du token
const options = {
  expiresIn: '24h'
};

// Générer le token
const token = jwt.sign(payload, JWT_SECRET, options);

console.log('Token JWT généré:');
console.log(token);

// Vérifier le token (pour débogage)
try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('\nToken décodé avec succès:');
  console.log(decoded);
} catch (error) {
  console.error('\nErreur lors de la vérification du token:', error.message);
}

console.log('\nPour utiliser ce token, ajoutez-le dans vos en-têtes HTTP:');
console.log('Authorization: Bearer ' + token);
