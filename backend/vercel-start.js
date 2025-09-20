// Script de démarrage pour Vercel utilisant tsx
const { spawn } = require('child_process');
const path = require('path');

// Démarrer l'application avec tsx
const child = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || 3001
  }
});

child.on('error', (error) => {
  console.error('Erreur lors du démarrage:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Application arrêtée avec le code ${code}`);
  process.exit(code);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});
