const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || 'ccrb-secret-key-2024';

// Générer un token JWT
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

// Vérifier un token JWT
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Hasher un mot de passe
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Comparer un mot de passe avec son hash
async function comparePassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

module.exports = {
  signToken,
  verifyToken,
  hashPassword,
  comparePassword
};
