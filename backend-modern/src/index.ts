import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { version } from '../package.json'; // Import version from package.json

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import presenceRoutes from './routes/presence.js';
import reportRoutes from './routes/reports.js';
import missionRoutes from './routes/missions.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env['PORT'] || '3001', 10); // Parse PORT as integer

// Supabase client will be initialized in individual route files

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env['FRONTEND_URL'] || 'http://localhost:3000', // Use bracket notation for env access
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: version || '1.0.0' // Use imported version
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/missions', missionRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
});

export default app;