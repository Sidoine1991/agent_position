import { Router } from 'express';
import { getDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';

export const healthRoutes = Router();

// Route de santé basique
healthRoutes.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Service de santé opérationnel',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Route de santé détaillée
healthRoutes.get('/detailed', async (req, res) => {
  try {
    const db = getDatabase();
    
    // Test de la base de données
    const dbTest = db.prepare('SELECT 1 as test').get() as { test: number };
    const isDbHealthy = dbTest.test === 1;
    
    // Informations système
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const health = {
      success: true,
      message: 'Service de santé détaillé',
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {
        database: {
          status: isDbHealthy ? 'healthy' : 'unhealthy',
          responseTime: Date.now(),
        },
        memory: {
          status: memoryUsage.heapUsed < memoryUsage.heapTotal * 0.9 ? 'healthy' : 'warning',
          usage: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
          },
        },
        uptime: {
          status: 'healthy',
          seconds: Math.round(process.uptime()),
          formatted: formatUptime(process.uptime()),
        },
      },
      version: process.env.npm_package_version || '2.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
    
    // Déterminer le statut global
    const allChecksHealthy = Object.values(health.checks).every(
      (check: any) => check.status === 'healthy'
    );
    
    health.status = allChecksHealthy ? 'healthy' : 'degraded';
    
    const statusCode = allChecksHealthy ? 200 : 503;
    res.status(statusCode).json(health);
    
  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      success: false,
      message: 'Service de santé en échec',
      timestamp: new Date().toISOString(),
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Fonction utilitaire pour formater l'uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);
  
  return parts.join(' ') || '0s';
}
