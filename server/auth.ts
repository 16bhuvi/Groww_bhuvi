import jwt from 'jsonwebtoken';
import { Request } from 'express';
import bcrypt from 'bcryptjs';
import { executeQueryOne, executeRun } from './db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'groww_market_watchlist_jwt_secret_key_2025';

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
}

export function generateJwtToken(payload: TokenPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
}

export function verifyJwtToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function getUserIdFromRequest(req: Request): string {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = verifyJwtToken(token);
    if (payload && payload.userId) {
      return payload.userId;
    }
  }

  // Fallback to custom header or default demo user
  return (req.headers['x-user-id'] as string) || 'user_demo_1';
}

export async function authenticateUser(email: string, passwordPlain: string) {
  const user = await executeQueryOne<any>(
    `SELECT id, email, password_hash, name FROM users WHERE email = ?`,
    [email.toLowerCase().trim()]
  );

  if (!user) {
    return null;
  }

  const isMatch = await bcrypt.compare(passwordPlain, user.password_hash);
  if (!isMatch) {
    return null;
  }

  const token = generateJwtToken({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  };
}

export async function registerUser(email: string, passwordPlain: string, name: string) {
  const existing = await executeQueryOne<any>(
    `SELECT id FROM users WHERE email = ?`,
    [email.toLowerCase().trim()]
  );

  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  const now = new Date().toISOString();

  await executeRun(
    `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`,
    [userId, email.toLowerCase().trim(), passwordHash, name.trim(), now]
  );

  // Initialize a default watchlist for the new user
  const watchlistId = `wl_${Date.now()}`;
  await executeRun(
    `INSERT INTO watchlists (id, user_id, name, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [watchlistId, userId, 'My First Watchlist', 1, now, now]
  );

  // Seed default stocks into the new watchlist
  const defaultStockIds = ['stock_tatamotors', 'stock_infosys', 'stock_reliance', 'stock_hdfcbank'];
  for (let i = 0; i < defaultStockIds.length; i++) {
    await executeRun(
      `INSERT INTO watchlist_stocks (watchlist_id, stock_id, display_order, added_at) VALUES (?, ?, ?, ?)`,
      [watchlistId, defaultStockIds[i], i, now]
    );
  }

  const token = generateJwtToken({
    userId,
    email: email.toLowerCase().trim(),
    name: name.trim(),
  });

  return {
    token,
    user: {
      id: userId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
    },
  };
}
