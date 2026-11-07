import { ok, readJson, requireUser, route } from '@/lib/api';
import { all, get, now, run } from '@/lib/db';
import { PREFERENCE_KEYS, ensurePreferences, unreadCount } from '@/lib/notifications';

const SOUNDS = ['signature', 'device', 'silent'] as const;

export const GET = route(async () => {
  const user = await requireUser();
  ensurePreferences(user.id);
  const rows = all<{ category: string; enabled: number }>(
    'SELECT category, enabled FROM notification_preferences WHERE user_id = ?',
    user.id,
  );
  const settings = get<{
    muted: number;
    sound: string;
    quiet_start: string;
    quiet_end: string;
    push_enabled: number;
    email_enabled: number;
    email: string;
  }>(
    'SELECT muted, sound, quiet_start, quiet_end, push_enabled, email_enabled, email FROM notification_settings WHERE user_id = ?',
    user.id,
  );
  const devices = get<{ c: number }>('SELECT COUNT(*) AS c FROM push_subscriptions WHERE user_id = ?', user.id);
  return ok({
    preferences: Object.fromEntries(
      PREFERENCE_KEYS.map((key) => [key, Boolean(rows.find((row) => row.category === key)?.enabled ?? 1)]),
    ),
    settings: {
      muted: Boolean(settings?.muted ?? 0),
      sound: settings?.sound ?? 'signature',
      quietStart: settings?.quiet_start ?? '',
      quietEnd: settings?.quiet_end ?? '',
      pushEnabled: Boolean(settings?.push_enabled ?? 1),
      emailEnabled: Boolean(settings?.email_enabled ?? 0),
      email: settings?.email ?? '',
    },
    devices: devices?.c ?? 0,
    sounds: SOUNDS,
    unread: unreadCount(user.id),
  });
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  ensurePreferences(user.id);
  const body = await readJson<{
    preferences?: Record<string, boolean>;
    settings?: Record<string, unknown>;
  }>(req);

  if (body.preferences) {
    for (const key of PREFERENCE_KEYS) {
      if (key in body.preferences) {
        run(
          `INSERT INTO notification_preferences (id, user_id, category, enabled, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id, category) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
          `pref-${user.id}-${key}`,
          user.id,
          key,
          body.preferences[key] ? 1 : 0,
          now(),
        );
      }
    }
  }

  if (body.settings) {
    const s = body.settings;
    const sound = typeof s.sound === 'string' && (SOUNDS as readonly string[]).includes(s.sound) ? s.sound : 'signature';
    run(
      `UPDATE notification_settings SET
         muted = COALESCE(?, muted),
         sound = ?,
         quiet_start = COALESCE(?, quiet_start),
         quiet_end = COALESCE(?, quiet_end),
         push_enabled = COALESCE(?, push_enabled),
         email_enabled = COALESCE(?, email_enabled),
         email = COALESCE(?, email),
         updated_at = ?
       WHERE user_id = ?`,
      typeof s.muted === 'boolean' ? (s.muted ? 1 : 0) : null,
      sound,
      typeof s.quietStart === 'string' ? s.quietStart.slice(0, 5) : null,
      typeof s.quietEnd === 'string' ? s.quietEnd.slice(0, 5) : null,
      typeof s.pushEnabled === 'boolean' ? (s.pushEnabled ? 1 : 0) : null,
      typeof s.emailEnabled === 'boolean' ? (s.emailEnabled ? 1 : 0) : null,
      typeof s.email === 'string' ? s.email.slice(0, 200) : null,
      now(),
      user.id,
    );
  }

  return ok({ saved: true });
});
