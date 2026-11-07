import { ApiError, ok, optionalStr, readJson, requireUser, route } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { isBlocked } from '@/lib/auth';

async function requireMember(conversationId: string, userId: string) {
  const membership = get<{ conversation_id: string }>(
    'SELECT conversation_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
    conversationId,
    userId,
  );
  if (!membership) throw new ApiError(403, 'You are not part of this conversation.');
  return membership;
}

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await requireMember(id, user.id);

  const conversation = get<{ id: string; title: string | null; is_group: number }>(
    'SELECT id, title, is_group FROM conversations WHERE id = ?',
    id,
  );
  const items = all(
    `SELECT m.id, m.sender_id, m.body, m.media_url, m.created_at, u.username, u.display_name, u.avatar_url
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? ORDER BY m.created_at ASC LIMIT 500`,
    id,
  );
  const members = all(
    `SELECT u.id, u.username, u.display_name, u.avatar_url FROM conversation_members cm
     JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = ?`,
    id,
  );
  run('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?', now(), id, user.id);
  return ok({ conversation, items, members });
});

export const POST = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await requireMember(id, user.id);
  const body = await readJson(req);
  const text = optionalStr(body.body, 4000);
  const mediaUrl = optionalStr(body.mediaUrl, 500) || null;
  if (!text && !mediaUrl) throw new ApiError(400, 'Write a message first.');

  const messageId = uid();
  run(
    'INSERT INTO messages (id, conversation_id, sender_id, body, media_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    messageId,
    id,
    user.id,
    text,
    mediaUrl,
    now(),
  );
  run('UPDATE conversations SET updated_at = ? WHERE id = ?', now(), id);

  const recipients = all<{ user_id: string }>(
    'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
    id,
    user.id,
  );
  for (const recipient of recipients) {
    if (isBlocked(user.id, recipient.user_id)) continue;
    await notify({
      recipientId: recipient.user_id,
      actorId: user.id,
      type: 'message',
      category: 'social',
      // Never expose private message bodies in the notification title.
      title: `New message from ${user.display_name}`,
      message: 'You have a new message in YumEra.',
      targetType: 'conversation',
      targetId: id,
      preference: 'messages',
      url: `/messages/${id}`,
      pushBody: 'You have a new message in YumEra.',
    });
  }

  const message = get(
    `SELECT m.*, u.username, u.display_name, u.avatar_url FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`,
    messageId,
  );
  return ok({ message }, 201);
});

/** Mark the thread as read. */
export const PUT = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await requireMember(id, user.id);
  run('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?', now(), id, user.id);
  return ok({ read: true });
});
