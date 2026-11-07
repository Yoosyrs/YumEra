import { ApiError, ok, optionalStr, readJson, requireUser, route, str } from '@/lib/api';
import { getSessionUser, hashPassword, publicUser, verifyPassword } from '@/lib/auth';
import { get, now, run } from '@/lib/db';
import { unreadCount } from '@/lib/notifications';

export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) return ok({ user: null });
  const stats = get<{ posts: number; followers: number; following: number }>(
    `SELECT
      (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS posts,
      (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
    user.id,
    user.id,
    user.id,
  );
  return ok({ user: publicUser(user), stats, unread: unreadCount(user.id) });
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const updates: Record<string, unknown> = {};

  if ('displayName' in body) updates.display_name = str(body.displayName, 'displayName', { min: 1, max: 60 });
  if ('bio' in body) updates.bio = optionalStr(body.bio, 600);
  if ('pronouns' in body) updates.pronouns = optionalStr(body.pronouns, 40);
  if ('avatarUrl' in body) updates.avatar_url = optionalStr(body.avatarUrl, 500) || null;
  if ('coverUrl' in body) updates.cover_url = optionalStr(body.coverUrl, 500) || null;
  if ('soulColor' in body) updates.soul_color = optionalStr(body.soulColor, 20) || '#b892ff';
  if ('locale' in body) updates.locale = optionalStr(body.locale, 2) || 'es';
  if ('isPrivate' in body) updates.is_private = body.isPrivate ? 1 : 0;

  const columns = Object.keys(updates);
  if (columns.length === 0) throw new ApiError(400, 'Nothing to update');
  run(
    `UPDATE users SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
    ...columns.map((column) => updates[column]),
    user.id,
  );
  const fresh = await getSessionUser();
  return ok({ user: publicUser(fresh) });
});

export const PUT = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const current = str(body.currentPassword, 'currentPassword', { min: 1, max: 200 });
  const next = str(body.newPassword, 'newPassword', { min: 8, max: 200 });
  const row = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', user.id);
  if (!row || !verifyPassword(current, row.password_hash)) throw new ApiError(403, 'Current password is incorrect.');
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(next), user.id);
  run('DELETE FROM sessions WHERE user_id = ?', user.id);
  return ok({ updated: true, reauth: true });
});

export const POST = route(async () => {
  const user = await requireUser();
  run('UPDATE users SET email_verified = 1 WHERE id = ?', user.id);
  return ok({ verified: true, at: now() });
});
