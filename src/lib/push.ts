import webpush from 'web-push';
import { all, get, run, uid, now, getSetting, setSetting } from './db';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  tone?: string;
  icon?: string;
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cachedKeys: VapidKeys | null = null;

/**
 * VAPID keys come from the environment when provided. Otherwise a key pair is
 * generated once and persisted in the database so the server can always sign
 * push messages for the subscriptions it stores.
 */
export function getVapidKeys(): VapidKeys {
  if (cachedKeys) return cachedKeys;
  const envPublic = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;
  if (envPublic && envPrivate) {
    cachedKeys = { publicKey: envPublic, privateKey: envPrivate };
    return cachedKeys;
  }
  const storedPublic = getSetting('vapid_public_key');
  const storedPrivate = getSetting('vapid_private_key');
  if (storedPublic && storedPrivate) {
    cachedKeys = { publicKey: storedPublic, privateKey: storedPrivate };
    return cachedKeys;
  }
  const generated = webpush.generateVAPIDKeys();
  setSetting('vapid_public_key', generated.publicKey);
  setSetting('vapid_private_key', generated.privateKey);
  cachedKeys = generated;
  return cachedKeys;
}

function configure() {
  const keys = getVapidKeys();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:notifications@yumera.app',
    keys.publicKey,
    keys.privateKey,
  );
}

function isQuietHours(start: string, end: string, date = new Date()): boolean {
  if (!start || !end) return false;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const from = sh * 60 + sm;
  const to = eh * 60 + em;
  if (from === to) return false;
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

export function pushAllowedForUser(userId: string): boolean {
  const settings = get<{
    muted: number;
    push_enabled: number;
    quiet_start: string;
    quiet_end: string;
  }>('SELECT muted, push_enabled, quiet_start, quiet_end FROM notification_settings WHERE user_id = ?', userId);
  if (!settings) return true;
  if (settings.muted) return false;
  if (!settings.push_enabled) return false;
  return !isQuietHours(settings.quiet_start, settings.quiet_end);
}

export async function sendPushToUser(userId: string, payload: PushPayload, category?: string): Promise<number> {
  if (!pushAllowedForUser(userId)) return 0;
  if (category) {
    const pref = get<{ enabled: number }>(
      'SELECT enabled FROM notification_preferences WHERE user_id = ? AND category = ?',
      userId,
      category,
    );
    if (pref && !pref.enabled) return 0;
  }
  const subscriptions = all<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
    userId,
  );
  if (subscriptions.length === 0) return 0;
  configure();
  const body = JSON.stringify({
    ...payload,
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
  });
  let delivered = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
        { TTL: 3600, urgency: 'normal' },
      );
      delivered += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        run('DELETE FROM push_subscriptions WHERE id = ?', sub.id);
      } else {
        console.error('[push] delivery failed', status, (error as Error).message);
      }
    }
  }
  if (delivered > 0) {
    run('UPDATE push_subscriptions SET user_agent = user_agent WHERE user_id = ?', userId);
  }
  return delivered;
}

export async function sendTestPush(userId: string): Promise<number> {
  return sendPushToUser(userId, {
    title: 'YumEra',
    body: 'Outside notifications are working. Your universe can reach you.',
    url: '/notifications',
    tag: 'yumera-test',
  });
}

export function registerSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  run(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent`,
    uid(),
    userId,
    sub.endpoint,
    sub.keys.p256dh,
    sub.keys.auth,
    userAgent.slice(0, 300),
    now(),
  );
}

export function removeSubscription(userId: string, endpoint: string) {
  run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', userId, endpoint);
}
