import { ApiError, ok, optionalStr, readJson, requireUser, route, str } from '@/lib/api';
import { all, get, run, uid } from '@/lib/db';

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const playlist = get<{ id: string; user_id: string; is_public: number }>(
    'SELECT id, user_id, is_public FROM music_playlists WHERE id = ?',
    id,
  );
  if (!playlist) throw new ApiError(404, 'Playlist not found');
  if (playlist.user_id !== user.id && !playlist.is_public) throw new ApiError(403, 'This playlist is private');
  const tracks = all(
    'SELECT id, track_id, position, dedication FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC',
    id,
  );
  return ok({ tracks });
});

export const POST = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const playlist = get<{ user_id: string }>('SELECT user_id FROM music_playlists WHERE id = ?', id);
  if (!playlist) throw new ApiError(404, 'Playlist not found');
  if (playlist.user_id !== user.id) throw new ApiError(403, 'Only the owner can edit this playlist');
  const body = await readJson<{ trackId?: string; dedication?: string }>(req);
  const trackId = str(body.trackId, 'trackId', { max: 80 });
  const existing = get('SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', id, trackId);
  if (existing) throw new ApiError(409, 'That song is already in the playlist');
  const next = get<{ n: number }>('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM playlist_tracks WHERE playlist_id = ?', id);
  run(
    'INSERT INTO playlist_tracks (id, playlist_id, track_id, position, dedication) VALUES (?, ?, ?, ?, ?)',
    uid(),
    id,
    trackId,
    next?.n ?? 0,
    optionalStr(body.dedication, 240),
  );
  return ok({ tracks: all('SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC', id) }, 201);
});

export const DELETE = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const playlist = get<{ user_id: string }>('SELECT user_id FROM music_playlists WHERE id = ?', id);
  if (!playlist) throw new ApiError(404, 'Playlist not found');
  if (playlist.user_id !== user.id) throw new ApiError(403, 'Only the owner can edit this playlist');
  const trackId = new URL(req.url).searchParams.get('trackId');
  if (!trackId) throw new ApiError(400, 'trackId is required');
  run('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', id, trackId);
  return ok({ deleted: true });
});
