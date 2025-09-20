import { Router } from 'express';
import { authRoutes } from './auth.js';
import { agentRoutes } from './agents.js';
import { presenceRoutes } from './presence.js';
import { dashboardRoutes } from './dashboard.js';
import { geoRoutes } from './geo.js';
import { healthRoutes } from './health.js';

// Création du routeur principal
export const router = Router();

// Routes de base
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/agents', agentRoutes);
router.use('/presence', presenceRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/geo', geoRoutes);

// Route de test pour l'API
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Presence CCRB v2.0.0',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      agents: '/api/agents',
      presence: '/api/presence',
      dashboard: '/api/dashboard',
      geo: '/api/geo',
    },
  });
});

export default router;
