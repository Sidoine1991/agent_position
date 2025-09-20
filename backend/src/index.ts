import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import { migrate } from './db.js';
import { ensureAdminSeed } from './auth.js';
import { router } from './routes.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Static uploads
const uploadsPath = path.join(process.cwd(), 'data', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Serve organization Media at /Media (project-level Media folder)
const orgMediaPath = path.join(process.cwd(), '..', 'Media');
app.use('/Media', express.static(orgMediaPath));

// Serve PWA static files from ../web
const webPath = path.join(process.cwd(), '..', 'web');
app.use('/', express.static(webPath));

// API routes
app.use('/api', router);

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Configuration CORS pour la production
if (NODE_ENV === 'production') {
  const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    optionsSuccessStatus: 200
  };
  app.use(cors(corsOptions));
} else {
  app.use(cors());
}

// Configuration du logging pour la production
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

migrate();
ensureAdminSeed();

app.listen(port, () => {
  console.log(`API listening on port ${port} (${NODE_ENV})`);
});


