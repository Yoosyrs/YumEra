import { ApiError, ok, optionalStr, readJson, requireUser, route } from '@/lib/api';
import { all, get, run } from '@/lib/db';
import { findTrack, type MusicTrack } from '@/lib/music';

interface PlaylistRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  is_public: number;
  generated_by: string | null;
  created_at: string;
}

function loadPlaylist(id: string, userId: string): PlaylistRow {
  const row = get<PlaylistRow>(
    'SELECT id, user_id, title, description, cover_url, is_public, generated_by, created_at FROM music_playlists WHERE id = ? AND (user_id = ? OR is_public = 1)',
    id,
    userId,
  );
  if (!row) throw new ApiError(404, 'Playlist not found');
  return row;
}

function playlistTracks(id: string): Array<MusicTrack & { dedication: string }> {
  const rows = all<{ track_id: string; dedication: string | null }>(
    'SELECT track_id, dedication FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC',
    id,
  );
  return rows
    .map((row) => {
      const track = findTrack(row.track_id);
      return track ? { ...track, dedication: row.dedication ?? '' } : null;
    })
    .filter((track): track is MusicTrack & { dedication: string } => Boolean(track));
}

export const GET = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const item = loadPlaylist(id, user.id);
  return ok({ item, tracks: playlistTracks(id), isOwner: item.user_id === user.id });
});

export const PATCH = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const item = loadPlaylist(id, user.id);
  if (item.user_id !== user.id) throw new ApiError(403, 'Only the owner can edit this playlist');

  const body = await readJson<{ title?: unknown; description?: unknown; isPublic?: unknown; trackIds?: unknown }>(req);
  const updates: Record<string, unknown> = {};

  if ('title' in body) updates.title = optionalStr(body.title, 120) || item.title;
  if ('description' in body) updates.description = optionalStr(body.description, 500);
  if ('isPublic' in body) updates.is_public = body.isPublic ? 1 : 0;

  const columns = Object.keys(updates);
  if (columns.length > 0) {
    run(
      `UPDATE music_playlists SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
      ...columns.map((column) => updates[column]),
      id,
    );
  }

  if (Array.isArray(body.trackIds)) {
    const ids = body.trackIds.filter((value): value is string => typeof value === 'string' && Boolean(findTrack(value))).slice(0, 60);
    run('DELETE FROM playlist_tracks WHERE playlist_id = ?', id);
    ids.forEach((trackId, index) => {
      run(
        'INSERT INTO playlist_tracks (id, playlist_id, track_id, position, dedication) VALUES (?, ?, ?, ?, ?)',
        `${id}-${index}-${Date.now().toString(36)}`,
        id,
        trackId,
        index,
        '',
      );
    });
  }

  return ok({ item: loadPlaylist(id, user.id), tracks: playlistTracks(id) });
});

export const DELETE = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const item = loadPlaylist(id, user.id);
  if (item.user_id !== user.id) throw new ApiError(403, 'Only the owner can delete this playlist');
  run('DELETE FROM playlist_tracks WHERE playlist_id = ?', id);
  run('DELETE FROM music_playlists WHERE id = ?', id);
  return ok({ deleted: true });
});
