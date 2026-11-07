import { ApiError, ok, optionalStr, oneOf, readJson, requireUser, route, str } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';

export const GET = route(async () => {
  const user = await requireUser();
  const blocked = all(
    `SELECT b.id, b.created_at, u.username, u.display_name, u.avatar_url
     FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ?`,
    user.id,
  );
  return ok({ items: blocked });
});

/** Toggle a block. Blocking hides content in both directions. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const username = str(body.username, 'username', { min: 3, max: 24 }).toLowerCase();
  const target = get<{ id: string }>('SELECT id FROM users WHERE username = ?', username);
  if (!target) throw new ApiError(404, 'User not found');
  if (target.id === user.id) throw new ApiError(400, 'You cannot block yourself.');

  const existing = get<{ id: string }>('SELECT id FROM blocks WHERE blocker_id = ? AND blocked_id = ?', user.id, target.id);
  if (existing) {
    run('DELETE FROM blocks WHERE id = ?', existing.id);
    return ok({ blocked: false });
  }
  run('INSERT INTO blocks (id, blocker_id, blocked_id, created_at) VALUES (?, ?, ?, ?)', uid(), user.id, target.id, now());
  run('DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)', user.id, target.id, target.id, user.id);
  return ok({ blocked: true });
});

/** Reports feed the moderation queue. */
export const PUT = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const targetType = oneOf(body.targetType, ['post', 'comment', 'user', 'story', 'community', 'message'] as const, 'post');
  const targetId = str(body.targetId, 'targetId', { min: 1, max: 80 });
  const reason = oneOf(
    body.reason,
    ['harassment', 'spam', 'hate', 'sexual_content', 'minor_safety', 'impersonation', 'other'] as const,
    'other',
  );
  const details = optionalStr(body.details, 1000);
  run(
    'INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    uid(),
    user.id,
    targetType,
    targetId,
    reason,
    details,
    'open',
    now(),
  );
  return ok({ reported: true }, 201);
});
