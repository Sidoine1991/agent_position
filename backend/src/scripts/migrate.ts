import { getDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';

const db = getDatabase();

// Script de migration de la base de données
export function migrate(): void {
  logger.info('🔄 Début de la migration de la base de données...');

  try {
    // Activer les clés étrangères
    db.pragma('foreign_keys = ON');

    // Table des utilisateurs (version modernisée)
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'agent')),
        phone TEXT,
        avatar TEXT,
        isActive BOOLEAN DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des agents (version modernisée)
    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        phone TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'agent')),
        departement TEXT NOT NULL,
        commune TEXT NOT NULL,
        arrondissement TEXT,
        village TEXT,
        isActive BOOLEAN DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Table des missions
    db.exec(`
      CREATE TABLE IF NOT EXISTS missions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agentId INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        departement TEXT NOT NULL,
        commune TEXT NOT NULL,
        arrondissement TEXT,
        village TEXT,
        startDate DATETIME NOT NULL,
        endDate DATETIME,
        status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agentId) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Table des présences (version modernisée)
    db.exec(`
      CREATE TABLE IF NOT EXISTS presences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agentId INTEGER NOT NULL,
        missionId INTEGER,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL,
        address TEXT,
        photo TEXT,
        notes TEXT,
        startTime DATETIME NOT NULL,
        endTime DATETIME,
        status TEXT DEFAULT 'pending' CHECK (status IN ('present', 'absent', 'pending', 'invalid')),
        validated BOOLEAN DEFAULT 0,
        validatedBy INTEGER,
        validatedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agentId) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (missionId) REFERENCES missions(id) ON DELETE SET NULL,
        FOREIGN KEY (validatedBy) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Table des notifications
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
        isRead BOOLEAN DEFAULT 0,
        metadata TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Table des sessions (pour la gestion des sessions)
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        userId INTEGER NOT NULL,
        data TEXT,
        expiresAt DATETIME NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Index pour les performances
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_agents_userId ON agents(userId);
      CREATE INDEX IF NOT EXISTS idx_agents_departement ON agents(departement);
      CREATE INDEX IF NOT EXISTS idx_agents_commune ON agents(commune);
      CREATE INDEX IF NOT EXISTS idx_presences_agentId ON presences(agentId);
      CREATE INDEX IF NOT EXISTS idx_presences_createdAt ON presences(createdAt);
      CREATE INDEX IF NOT EXISTS idx_presences_status ON presences(status);
      CREATE INDEX IF NOT EXISTS idx_missions_agentId ON missions(agentId);
      CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId);
      CREATE INDEX IF NOT EXISTS idx_notifications_isRead ON notifications(isRead);
      CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
      CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
    `);

    // Triggers pour updatedAt
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_users_updatedAt 
      AFTER UPDATE ON users 
      BEGIN 
        UPDATE users SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_agents_updatedAt 
      AFTER UPDATE ON agents 
      BEGIN 
        UPDATE agents SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_presences_updatedAt 
      AFTER UPDATE ON presences 
      BEGIN 
        UPDATE presences SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_missions_updatedAt 
      AFTER UPDATE ON missions 
      BEGIN 
        UPDATE missions SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);

    logger.info('✅ Migration de la base de données terminée avec succès');

  } catch (error) {
    logger.error('❌ Erreur lors de la migration:', error);
    throw error;
  }
}

// Exécuter la migration si le script est appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}
