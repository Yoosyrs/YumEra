import { ApiError, ok, readJson, requireUser, route, str } from '@/lib/api';
import { get, now, run, uid } from '@/lib/db';
import { isBlocked } from '@/lib/auth';
import { notify } from '@/lib/notifications';

/** Toggle follow state for another user and notify them on a new follow. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const username = str(body.username, 'username', { min: 3, max: 24 }).toLowerCase();
  const target = get<{ id: string; display_name: string; is_private: number }>(
    'SELECT id, display_name, is_private FROM users WHERE username = ?',
    username,
  );
  if (!target) throw new ApiError(404, 'User not found');
  if (target.id === user.id) throw new ApiError(400, 'You cannot follow yourself.');
  if (isBlocked(user.id, target.id)) throw new ApiError(403, 'This profile is unavailable.');

  const existing = get<{ id: string }>('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', user.id, target.id);
  if (existing) {
    run('DELETE FROM follows WHERE id = ?', existing.id);
    return ok({ following: false });
  }

  run('INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (?, ?, ?, ?)', uid(), user.id, target.id, now());
  await notify({
    recipientId: target.id,
    actorId: user.id,
    type: 'follow',
    category: 'social',
    title: `${user.display_name} started following you`,
    message: `@${user.username} is now part of your universe.`,
    targetType: 'user',
    targetId: user.id,
    preference: 'followers',
    url: `/u/${user.username}`,
  });
  return ok({ following: true });
});

export const GET = route(async () => {
  const user = await requireUser();
  const rows = get<{ followers: number; following: number }>(
    `SELECT (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
    user.id,
    user.id,
  );
  return ok(rows);
});
