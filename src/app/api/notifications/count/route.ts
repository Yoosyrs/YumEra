import { ok, requireUser, route } from '@/lib/api';
import { unreadCount } from '@/lib/notifications';

/** Lightweight unread counter polled by the shell badge. */
export const GET = route(async () => {
  const user = await requireUser();
  return ok({ unread: unreadCount(user.id) });
});

export const dynamic = 'force-dynamic';
