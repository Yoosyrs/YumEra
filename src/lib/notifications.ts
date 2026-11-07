import { get, run, uid, now } from './db';
import { sendPushToUser } from './push';
import { isBlocked } from './auth';

export const NOTIFICATION_CATEGORIES = [
  'social',
  'interactions',
  'community',
  'myyume',
  'character',
  'system',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const PREFERENCE_KEYS = [
  'followers',
  'friend_requests',
  'messages',
  'comments',
  'reactions',
  'mentions',
  'stories',
  'events',
  'character_activity',
  'announcements',
] as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

export const PREFERENCE_CATEGORY: Record<PreferenceKey, NotificationCategory> = {
  followers: 'social',
  friend_requests: 'social',
  messages: 'social',
  comments: 'interactions',
  reactions: 'interactions',
  mentions: 'interactions',
  stories: 'myyume',
  events: 'community',
  character_activity: 'character',
  announcements: 'system',
};

interface NotifyInput {
  recipientId: string;
  actorId?: string | null;
  type: string;
  category: NotificationCategory;
  title: string;
  message?: string;
  targetType?: string;
  targetId?: string;
  preference?: PreferenceKey;
  url?: string;
  pushBody?: string;
}

/**
 * Creates the internal notification row and, when the user allows it, dispatches
 * a Web Push message to every subscribed device.
 * Private message content is never placed in the push payload.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const { recipientId, actorId } = input;
  if (!recipientId) return;
  if (actorId && actorId === recipientId) return;
  if (actorId && isBlocked(recipientId, actorId)) return;

  const preference = input.preference ?? defaultPreferenceFor(input.type);
  if (preference) {
    const pref = get<{ enabled: number }>(
      'SELECT enabled FROM notification_preferences WHERE user_id = ? AND category = ?',
      recipientId,
      preference,
    );
    if (pref && !pref.enabled) return;
  }

  // Avoid duplicate rows for the same actor/type/target within a short window.
  const duplicate = get<{ id: string }>(
    `SELECT id FROM notifications
     WHERE recipient_id = ? AND type = ? AND COALESCE(actor_id,'') = COALESCE(?,'')
       AND COALESCE(target_id,'') = COALESCE(?,'')
       AND created_at > ?`,
    recipientId,
    input.type,
    actorId ?? '',
    input.targetId ?? '',
    new Date(Date.now() - 60_000).toISOString(),
  );
  if (duplicate) return;

  run(
    `INSERT INTO notifications (id, recipient_id, actor_id, type, category, title, message, target_type, target_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    uid(),
    recipientId,
    actorId ?? null,
    input.type,
    input.category,
    input.title.slice(0, 200),
    (input.message ?? '').slice(0, 500),
    input.targetType ?? null,
    input.targetId ?? null,
    now(),
  );

  await sendPushToUser(
    recipientId,
    {
      title: 'YumEra',
      body: (input.pushBody ?? input.message ?? input.title).slice(0, 180),
      url: input.url ?? '/notifications',
      tag: `${input.type}-${input.targetId ?? ''}`,
    },
    input.category,
  );
}

export function defaultPreferenceFor(type: string): PreferenceKey | null {
  switch (type) {
    case 'follow':
      return 'followers';
    case 'friend_request':
      return 'friend_requests';
    case 'message':
      return 'messages';
    case 'comment':
    case 'reply':
      return 'comments';
    case 'reaction':
      return 'reactions';
    case 'mention':
      return 'mentions';
    case 'story_comment':
    case 'story_favorite':
      return 'stories';
    case 'community_invite':
    case 'community_event':
      return 'events';
    case 'character_reply':
      return 'character_activity';
    case 'announcement':
      return 'announcements';
    default:
      return null;
  }
}

export function ensurePreferences(userId: string): void {
  for (const key of PREFERENCE_KEYS) {
    run(
      `INSERT INTO notification_preferences (id, user_id, category, enabled, updated_at)
       VALUES (?, ?, ?, 1, ?) ON CONFLICT(user_id, category) DO NOTHING`,
      uid(),
      userId,
      key,
      now(),
    );
  }
  run(
    `INSERT INTO notification_settings (user_id, muted, sound, quiet_start, quiet_end, push_enabled, email_enabled, updated_at)
     VALUES (?, 0, 'signature', '', '', 1, 0, ?) ON CONFLICT(user_id) DO NOTHING`,
    userId,
    now(),
  );
}

export function unreadCount(userId: string): number {
  const row = get<{ c: number }>(
    'SELECT COUNT(*) as c FROM notifications WHERE recipient_id = ? AND is_read = 0',
    userId,
  );
  return row?.c ?? 0;
}
