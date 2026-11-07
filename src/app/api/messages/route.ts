import { ApiError, ok, optionalStr, readJson, requireUser, route, str } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { isBlocked } from '@/lib/auth';

/** Conversation list with last message and unread count. */
export const GET = route(async () => {
  const user = await requireUser();
  const items = all(
    `SELECT c.id, c.title, c.is_group, c.updated_at,
      (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
      (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id
        AND m.sender_id != ? AND m.created_at > COALESCE(cm.last_read_at, '')) AS unread,
      (SELECT u.username FROM conversation_members cm2 JOIN users u ON u.id = cm2.user_id
        WHERE cm2.conversation_id = c.id AND cm2.user_id != ? LIMIT 1) AS other_username,
      (SELECT u.display_name FROM conversation_members cm2 JOIN users u ON u.id = cm2.user_id
        WHERE cm2.conversation_id = c.id AND cm2.user_id != ? LIMIT 1) AS other_name,
      (SELECT u.avatar_url FROM conversation_members cm2 JOIN users u ON u.id = cm2.user_id
        WHERE cm2.conversation_id = c.id AND cm2.user_id != ? LIMIT 1) AS other_avatar,
      (SELECT COUNT(*) FROM conversation_members cm3 WHERE cm3.conversation_id = c.id) AS member_count
     FROM conversations c
     JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
     ORDER BY COALESCE(c.updated_at, c.created_at) DESC LIMIT 100`,
    user.id,
    user.id,
    user.id,
    user.id,
    user.id,
  );
  return ok({ items });
});

/** Create a 1:1 or group conversation. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const usernames = Array.isArray(body.usernames)
    ? body.usernames.filter((value: unknown): value is string => typeof value === 'string').slice(0, 25)
    : [];
  if (usernames.length === 0) throw new ApiError(400, 'Choose at least one person.');

  const members: string[] = [];
  for (const raw of usernames) {
    const username = raw.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) continue;
    const found = get<{ id: string }>('SELECT id FROM users WHERE username = ?', username);
    if (!found) throw new ApiError(404, `User @${username} not found.`);
    if (found.id === user.id) continue;
    if (isBlocked(user.id, found.id)) throw new ApiError(403, `You cannot message @${username}.`);
    members.push(found.id);
  }
  if (members.length === 0) throw new ApiError(400, 'No valid recipients.');

  const isGroup = members.length > 1 ? 1 : 0;
  if (!isGroup) {
    const existing = get<{ id: string }>(
      `SELECT c.id FROM conversations c
       WHERE c.is_group = 0
         AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ?)
         AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ?)
         AND (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) = 2`,
      user.id,
      members[0],
    );
    if (existing) return ok({ id: existing.id, existing: true });
  }

  const id = uid();
  const title = optionalStr(body.title, 80) || null;
  run(
    'INSERT INTO conversations (id, title, is_group, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    title,
    isGroup,
    user.id,
    now(),
    now(),
  );
  for (const memberId of [user.id, ...members]) {
    run(
      'INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, ?)',
      id,
      memberId,
      now(),
    );
  }
  return ok({ id, created: true }, 201);
});
