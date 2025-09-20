import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import type { Role } from './models.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface JwtPayload {
  userId: number;
  role: Role;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function hashPassword(plain: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plain, salt);
}

export function comparePassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function ensureAdminSeed(): void {
  // Ensure Admin account: name "admin", email "admin@local", password "123456"
  const adminEmail = 'admin@ccrb.local';
  const adminName = 'admin';
  const adminPwdHash = hashPassword('123456');
  const adminRow = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail) as { id?: number } | undefined;
  if (!adminRow) {
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(adminName, adminEmail, adminPwdHash, 'admin');
  } else {
    // Keep role as admin and reset password to requested value
    db.prepare("UPDATE users SET name = ?, password_hash = ?, role = 'admin' WHERE email = ?")
      .run(adminName, adminPwdHash, adminEmail);
  }

  // Ensure Supervisor account: name "Superviseur", email "supervisor@local", password "123456"
  const supEmail = 'supervisor@ccrb.local';
  const supName = 'Superviseur';
  const supPwdHash = hashPassword('123456');
  const supRow = db.prepare('SELECT id FROM users WHERE email = ?').get(supEmail) as { id?: number } | undefined;
  if (!supRow) {
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(supName, supEmail, supPwdHash, 'supervisor');
  } else {
    db.prepare("UPDATE users SET name = ?, password_hash = ?, role = 'supervisor' WHERE email = ?")
      .run(supName, supPwdHash, supEmail);
  }
}


