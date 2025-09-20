import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import des configurations
import { config } from './config/environment.js';
import { getDatabase } from './config/database.js';

// Import des middlewares
import { errorHandler, notFoundHandler, handleUncaughtException, handleUnhandledRejection } from './middleware/errorHandler.js';
import { logger, logRequest } from './utils/logger.js';

// Import des routes
import { router as apiRouter } from './routes/index.js';

// Gestion des erreurs non capturées
handleUncaughtException();
handleUnhandledRejection();

// Configuration des chemins
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialisation de l'application Express
const app = express();

// Trust proxy pour les reverse proxies (Vercel, etc.)
app.set('trust proxy', 1);

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://api.bigdatacloud.net"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Compression des réponses
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer plus tard',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// CORS
app.use(cors(config.cors));

// Parsing des requêtes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging des requêtes
if (config.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(logRequest);
}

// Initialisation de la base de données
getDatabase();

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
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '2.0.0',
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

// Gestion des routes non trouvées
app.use(notFoundHandler);

// Gestionnaire d'erreurs global
app.use(errorHandler);

// Démarrage du serveur
const server = app.listen(config.server.port, config.server.host, () => {
  logger.info(`🚀 Serveur démarré sur le port ${config.server.port}`);
  logger.info(`🌍 Environnement: ${config.NODE_ENV}`);
  logger.info(`📊 Mode: ${config.isDevelopment ? 'Développement' : 'Production'}`);
});

// Gestion propre de l'arrêt du serveur
const gracefulShutdown = (signal: string) => {
  logger.info(`📴 Signal ${signal} reçu, arrêt du serveur...`);
  
  server.close(() => {
    logger.info('✅ Serveur fermé proprement');
    process.exit(0);
  });
  
  // Forcer l'arrêt après 10 secondes
  setTimeout(() => {
    logger.error('❌ Arrêt forcé du serveur');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;