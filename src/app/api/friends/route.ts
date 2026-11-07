import { ApiError, ok, oneOf, readJson, requireUser, route, str } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';
import { notify } from '@/lib/notifications';

export const GET = route(async () => {
  const user = await requireUser();
  const incoming = all(
    `SELECT f.id, f.created_at, u.username, u.display_name, u.avatar_url
     FROM friend_requests f JOIN users u ON u.id = f.from_id
     WHERE f.to_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`,
    user.id,
  );
  const outgoing = all(
    `SELECT f.id, f.created_at, f.status, u.username, u.display_name, u.avatar_url
     FROM friend_requests f JOIN users u ON u.id = f.to_id
     WHERE f.from_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`,
    user.id,
  );
  const friends = all(
    `SELECT u.username, u.display_name, u.avatar_url
     FROM friend_requests f
     JOIN users u ON u.id = CASE WHEN f.from_id = ? THEN f.to_id ELSE f.from_id END
     WHERE (f.from_id = ? OR f.to_id = ?) AND f.status = 'accepted'`,
    user.id,
    user.id,
    user.id,
  );
  return ok({ incoming, outgoing, friends });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const username = str(body.username, 'username', { min: 3, max: 24 }).toLowerCase();
  const target = get<{ id: string }>('SELECT id FROM users WHERE username = ?', username);
  if (!target) throw new ApiError(404, 'User not found');
  if (target.id === user.id) throw new ApiError(400, 'You cannot send yourself a request.');
  const existing = get<{ id: string; status: string }>(
    'SELECT id, status FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)',
    user.id,
    target.id,
    target.id,
    user.id,
  );
  if (existing) throw new ApiError(409, 'There is already a request between you two.');

  run(
    'INSERT INTO friend_requests (id, from_id, to_id, status, created_at) VALUES (?, ?, ?, ?, ?)',
    uid(),
    user.id,
    target.id,
    'pending',
    now(),
  );
  await notify({
    recipientId: target.id,
    actorId: user.id,
    type: 'friend_request',
    category: 'social',
    title: `${user.display_name} sent you a friend request`,
    message: 'Open your notifications to accept or decline.',
    targetType: 'user',
    targetId: user.id,
    preference: 'friend_requests',
    url: '/notifications?category=social',
  });
  return ok({ requested: true }, 201);
});

export const PUT = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const id = str(body.id, 'id', { min: 5, max: 60 });
  const action = oneOf(body.action, ['accept', 'decline'] as const, 'accept');
  const request = get<{ id: string; from_id: string; to_id: string; status: string }>(
    'SELECT id, from_id, to_id, status FROM friend_requests WHERE id = ?',
    id,
  );
  if (!request) throw new ApiError(404, 'Request not found');
  if (request.to_id !== user.id) throw new ApiError(403, 'This request is not addressed to you.');
  if (request.status !== 'pending') throw new ApiError(409, 'This request was already answered.');

  run('UPDATE friend_requests SET status = ? WHERE id = ?', action === 'accept' ? 'accepted' : 'declined', id);
  if (action === 'accept') {
    await notify({
      recipientId: request.from_id,
      actorId: user.id,
      type: 'friend_accept',
      category: 'social',
      title: `${user.display_name} accepted your friend request`,
      message: 'A new bond in your universe.',
      targetType: 'user',
      targetId: user.id,
      preference: 'friend_requests',
      url: `/u/${user.username}`,
    });
  }
  return ok({ status: action === 'accept' ? 'accepted' : 'declined' });
});
