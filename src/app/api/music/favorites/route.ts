import { ApiError, ok, readJson, requireUser, route } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';
import { findTrack } from '@/lib/music';

export const GET = route(async () => {
  const user = await requireUser();
  const rows = all<{ track_id: string; created_at: string }>(
    'SELECT track_id, created_at FROM music_favorites WHERE user_id = ? ORDER BY created_at DESC',
    user.id,
  );
  return ok({ favorites: rows.map((row) => row.track_id) });
});

/** Toggles a favourite on an original YumEra track. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ trackId?: string }>(req);
  const trackId = String(body.trackId ?? '');
  if (!findTrack(trackId)) throw new ApiError(404, 'Track not found');
  const existing = get<{ id: string }>('SELECT id FROM music_favorites WHERE user_id = ? AND track_id = ?', user.id, trackId);
  if (existing) {
    run('DELETE FROM music_favorites WHERE id = ?', existing.id);
    return ok({ favorited: false });
  }
  run(
    'INSERT INTO music_favorites (id, user_id, track_id, created_at) VALUES (?, ?, ?, ?)',
    uid(),
    user.id,
    trackId,
    now(),
  );
  return ok({ favorited: true });
});
