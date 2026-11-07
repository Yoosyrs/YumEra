import { ApiError, ok, readJson, requireUser, route } from '@/lib/api';
import { all, get } from '@/lib/db';
import { getVapidKeys, registerSubscription, removeSubscription, sendTestPush } from '@/lib/push';

/** Public VAPID key plus the real subscription state of this account. */
export const GET = route(async () => {
  const user = await requireUser();
  const keys = getVapidKeys();
  const devices = all<{ id: string; endpoint: string; user_agent: string; created_at: string }>(
    'SELECT id, endpoint, user_agent, created_at FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC',
    user.id,
  );
  return ok({
    publicKey: keys.publicKey,
    devices: devices.map((d) => ({
      id: d.id,
      endpointHint: d.endpoint.slice(0, 48),
      userAgent: d.user_agent,
      createdAt: d.created_at,
    })),
    subscribed: devices.length > 0,
  });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  }>(req);
  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
    throw new ApiError(400, 'A complete push subscription is required');
  }
  registerSubscription(
    user.id,
    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    req.headers.get('user-agent') ?? '',
  );
  const count = get<{ c: number }>('SELECT COUNT(*) AS c FROM push_subscriptions WHERE user_id = ?', user.id);
  return ok({ subscribed: true, devices: count?.c ?? 0 });
});

export const PUT = route(async () => {
  const user = await requireUser();
  const delivered = await sendTestPush(user.id);
  const devices = get<{ c: number }>('SELECT COUNT(*) AS c FROM push_subscriptions WHERE user_id = ?', user.id);
  return ok({
    delivered,
    devices: devices?.c ?? 0,
    message:
      delivered > 0
        ? 'Test notification sent to your subscribed devices.'
        : 'No notification was delivered. Enable push on this device and check your preferences.',
  });
});

export const DELETE = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ endpoint?: string }>(req);
  if (!body.endpoint) throw new ApiError(400, 'endpoint is required');
  removeSubscription(user.id, body.endpoint);
  return ok({ subscribed: false });
});
