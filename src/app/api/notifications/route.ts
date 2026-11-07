import { ApiError, ok, oneOf, readJson, requireUser, route } from '@/lib/api';
import { all, get, now, run } from '@/lib/db';
import { NOTIFICATION_CATEGORIES, ensurePreferences, unreadCount } from '@/lib/notifications';

const CATEGORY_LABEL: Record<string, string> = {
  social: 'Social',
  interactions: 'Interactions',
  community: 'Yume Community',
  myyume: 'My Yume',
  character: 'Character World',
  system: 'System',
};

/** Internal notification centre: filtered history plus the unread counter. */
export const GET = route(async (req) => {
  const user = await requireUser();
  ensurePreferences(user.id);
  const url = new URL(req.url);
  const category = url.searchParams.get('category') ?? 'all';
  const onlyUnread = url.searchParams.get('unread') === '1';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 40) || 40, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);

  const filters = ['n.recipient_id = ?'];
  const params: unknown[] = [user.id];
  if (category !== 'all' && (NOTIFICATION_CATEGORIES as readonly string[]).includes(category)) {
    filters.push('n.category = ?');
    params.push(category);
  }
  if (onlyUnread) filters.push('n.is_read = 0');
  const where = filters.join(' AND ');

  const items = all(
    `SELECT n.id, n.type, n.category, n.title, n.message, n.target_type, n.target_id, n.is_read, n.created_at,
            a.username AS actor_username, a.display_name AS actor_name, a.avatar_url AS actor_avatar
     FROM notifications n LEFT JOIN users a ON a.id = n.actor_id
     WHERE ${where} ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );
  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM notifications n WHERE ${where}`, ...params);
  const perCategory = all<{ category: string; c: number }>(
    'SELECT category, COUNT(*) AS c FROM notifications WHERE recipient_id = ? GROUP BY category',
    user.id,
  );

  return ok({
    items,
    total: total?.c ?? 0,
    unread: unreadCount(user.id),
    categories: NOTIFICATION_CATEGORIES.map((key) => ({
      key,
      label: CATEGORY_LABEL[key] ?? key,
      count: perCategory.find((row) => row.category === key)?.c ?? 0,
    })),
  });
});

/** Mark one, several or every notification as read. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ ids?: string[]; all?: boolean }>(req);
  if (body.all) {
    run('UPDATE notifications SET is_read = 1 WHERE recipient_id = ? AND is_read = 0', user.id);
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    const placeholders = body.ids.slice(0, 200).map(() => '?').join(',');
    run(
      `UPDATE notifications SET is_read = 1 WHERE recipient_id = ? AND id IN (${placeholders})`,
      user.id,
      ...body.ids.slice(0, 200),
    );
  } else {
    throw new ApiError(400, 'Nothing to mark as read');
  }
  return ok({ unread: unreadCount(user.id) });
});

/** Toggle read state for a single notification. */
export const PATCH = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ id?: string; isRead?: boolean }>(req);
  if (!body.id) throw new ApiError(400, 'id is required');
  run(
    'UPDATE notifications SET is_read = ? WHERE id = ? AND recipient_id = ?',
    body.isRead === false ? 0 : 1,
    body.id,
    user.id,
  );
  return ok({ unread: unreadCount(user.id) });
});

/** Delete a single notification or the whole history. */
export const DELETE = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (url.searchParams.get('all') === '1') {
    run('DELETE FROM notifications WHERE recipient_id = ?', user.id);
  } else if (id) {
    run('DELETE FROM notifications WHERE id = ? AND recipient_id = ?', id, user.id);
  } else {
    throw new ApiError(400, 'id or all=1 is required');
  }
  return ok({ unread: unreadCount(user.id), deletedAt: now() });
});

export const dynamic = 'force-dynamic';
void oneOf;
