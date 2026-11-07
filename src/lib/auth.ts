import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { get, run, uid, now } from './db';

export const SESSION_COOKIE = 'yumera_session';
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  cover_url: string | null;
  pronouns: string;
  locale: string;
  is_private: number;
  email_verified: number;
  role: string;
  soul_color: string;
  created_at: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, saltHex, keyHex] = stored.split('$');
    if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(keyHex, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export async function createSession(userId: string, userAgent = ''): Promise<string> {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  run(
    'INSERT INTO sessions (id, user_id, token_hash, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    uid(),
    userId,
    sha256(token),
    userAgent.slice(0, 300),
    now(),
    expires,
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  }
  jar.delete(SESSION_COOKIE);
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const row = get<SessionUser & { expires_at: string }>(
      `SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
      sha256(token),
    );
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
      return null;
    }
    return row;
  } catch {
    return null;
  }
});

export function publicUser(user: SessionUser | null) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    coverUrl: user.cover_url,
    bio: user.bio,
    pronouns: user.pronouns,
    locale: user.locale,
    isPrivate: !!user.is_private,
    soulColor: user.soul_color,
    role: user.role,
    createdAt: user.created_at,
  };
}

export function isBlocked(a: string, b: string): boolean {
  const row = get(
    'SELECT id FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
    a,
    b,
    b,
    a,
  );
  return !!row;
}
