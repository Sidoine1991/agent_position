import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'node:url';

// Import des routes
import { router as apiRouter } from './routes-simple.js';
import { migrate } from './db.js';

// Configuration des chemins
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialisation de l'application Express
const app = express();

// Trust proxy pour les reverse proxies (Vercel, Railway, etc.)
app.set('trust proxy', 1);

// CORS
app.use(cors({
  origin: true,
  credentials: true,
}));

// Parsing des requêtes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques
const webPath = path.join(__dirname, '../../web');
app.use('/', express.static(webPath));

// Servir les uploads
const uploadsPath = path.join(__dirname, '../../data/uploads');
app.use('/uploads', express.static(uploadsPath));

// Servir les médias
const mediaPath = path.join(__dirname, '../../Media');
app.use('/Media', express.static(mediaPath));

// Routes API
app.use('/api', apiRouter);

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Service opérationnel',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0',
  });
});

// Route de métriques (pour le monitoring)
app.get('/metrics', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// Initialiser la base de données
migrate();

// Démarrage du serveur
const port = Number(process.env.PORT) || 3001;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Serveur démarré sur le port ${port}`);
  console.log(`🌍 Environnement: ${process.env['NODE_ENV'] || 'development'}`);
});

// Gestion propre de l'arrêt du serveur
const gracefulShutdown = (signal: string) => {
  console.log(`📴 Signal ${signal} reçu, arrêt du serveur...`);
  
  server.close(() => {
    console.log('✅ Serveur fermé proprement');
    process.exit(0);
  });
  
  // Forcer l'arrêt après 10 secondes
  setTimeout(() => {
    console.error('❌ Arrêt forcé du serveur');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
