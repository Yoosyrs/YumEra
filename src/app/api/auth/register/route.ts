import { ApiError, ok, readJson, route, str } from '@/lib/api';
import { createSession, hashPassword } from '@/lib/auth';
import { get, now, run, uid } from '@/lib/db';
import { ensurePreferences, notify } from '@/lib/notifications';

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const POST = route(async (req) => {
  const body = await readJson(req);
  const username = str(body.username, 'username', { min: 3, max: 24 }).toLowerCase();
  const email = str(body.email, 'email', { min: 5, max: 200 }).toLowerCase();
  const displayName = str(body.displayName ?? username, 'displayName', { min: 1, max: 60 });
  const password = str(body.password, 'password', { min: 8, max: 200 });

  if (!USERNAME_RE.test(username)) {
    throw new ApiError(400, 'Username must be 3-24 characters: lowercase letters, numbers or underscore.');
  }
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Enter a valid email address.');
  if (get('SELECT id FROM users WHERE username = ?', username)) throw new ApiError(409, 'That username is already taken.');
  if (get('SELECT id FROM users WHERE email = ?', email)) throw new ApiError(409, 'That email is already registered.');

  const id = uid();
  run(
    `INSERT INTO users (id, username, email, password_hash, display_name, bio, avatar_url, cover_url, pronouns, locale, is_private, email_verified, role, soul_color, created_at)
     VALUES (?, ?, ?, ?, ?, '', NULL, NULL, '', ?, 0, 0, 'user', '#b892ff', ?)`,
    id,
    username,
    email,
    hashPassword(password),
    displayName,
    typeof body.locale === 'string' ? body.locale.slice(0, 2) : 'es',
    now(),
  );

  ensurePreferences(id);
  await createSession(id, req.headers.get('user-agent') ?? '');
  await notify({
    recipientId: id,
    type: 'welcome',
    category: 'system',
    title: 'Welcome to YumEra: Eternal Universe',
    message: 'Your universe is ready. Create your yumesona, register your F/O and design your first portrait.',
    url: '/studio/portrait',
    preference: 'announcements',
  });

  return ok({ user: { id, username, displayName } }, 201);
});
