import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration de la base de données
export const dbConfig = {
  path: process.env.DATABASE_PATH || path.join(__dirname, '../../data/app.db'),
  options: {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  },
};

// Instance de la base de données
let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(dbConfig.path, dbConfig.options);
    
    // Configuration des performances
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 1000');
    db.pragma('temp_store = MEMORY');
    
    // Configuration de la sécurité
    db.pragma('foreign_keys = ON');
    
    console.log('✅ Base de données SQLite initialisée');
  }
  
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('✅ Base de données fermée');
  }
}

// Gestion propre de la fermeture
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);
