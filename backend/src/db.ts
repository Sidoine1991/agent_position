import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
const dbFile = path.join(dataDir, 'app.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new sqlite3.Database(dbFile);

export function migrate(): void {
  const sql = `
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    
    -- Geo hierarchy
    CREATE TABLE IF NOT EXISTS departements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS communes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      departement_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(departement_id, name),
      FOREIGN KEY(departement_id) REFERENCES departements(id)
    );
    CREATE TABLE IF NOT EXISTS arrondissements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commune_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(commune_id, name),
      FOREIGN KEY(commune_id) REFERENCES communes(id)
    );
    CREATE TABLE IF NOT EXISTS villages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arrondissement_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(arrondissement_id, name),
      FOREIGN KEY(arrondissement_id) REFERENCES arrondissements(id)
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'agent', -- agent | supervisor | admin
      photo_path TEXT,
      project_name TEXT,
      project_description TEXT,
      planning_start_date TEXT,
      planning_end_date TEXT,
      expected_days_per_month INTEGER DEFAULT 20,
      expected_hours_per_month INTEGER DEFAULT 160,
      work_schedule TEXT,
      contract_type TEXT,
      gps_accuracy TEXT DEFAULT 'medium',
      observations TEXT,
      village_id INTEGER,
      reference_lat REAL,
      reference_lon REAL,
      tolerance_radius_meters INTEGER DEFAULT 100,
      consent_signed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(village_id) REFERENCES villages(id)
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      date_start TEXT NOT NULL,
      date_end TEXT,
      status TEXT NOT NULL DEFAULT 'active', -- active | ended
      village_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(agent_id) REFERENCES users(id),
      FOREIGN KEY(village_id) REFERENCES villages(id)
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      photo_path TEXT,
      note TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(mission_id) REFERENCES missions(id)
    );

    -- Presence validation
    CREATE TABLE IF NOT EXISTS presence_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      checkin_id INTEGER NOT NULL,
      reference_lat REAL NOT NULL,
      reference_lon REAL NOT NULL,
      checkin_lat REAL NOT NULL,
      checkin_lon REAL NOT NULL,
      distance_meters REAL NOT NULL,
      tolerance_radius INTEGER NOT NULL,
      status TEXT NOT NULL, -- present | absent | tolerance
      validated_by INTEGER,
      validated_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(agent_id) REFERENCES users(id),
      FOREIGN KEY(checkin_id) REFERENCES checkins(id),
      FOREIGN KEY(validated_by) REFERENCES users(id)
    );

    -- Monthly reports
    CREATE TABLE IF NOT EXISTS monthly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      month_year TEXT NOT NULL, -- YYYY-MM
      expected_days INTEGER NOT NULL,
      present_days INTEGER NOT NULL,
      absent_days INTEGER NOT NULL,
      tolerance_days INTEGER NOT NULL,
      status TEXT NOT NULL, -- completed | pending | validated
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(agent_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      details TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `;

  db.exec(sql, (err) => {
    if (err) {
      console.error('Erreur lors de la migration:', err);
    } else {
      console.log('✅ Migration de la base de données terminée');
    }
  });
}
