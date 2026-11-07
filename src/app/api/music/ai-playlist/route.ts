import { ApiError, ok, readJson, requireUser, route } from '@/lib/api';
import { all, now, run, uid } from '@/lib/db';
import { AiNotConfiguredError, aiComplete, isAiConfigured } from '@/lib/ai';
import { MUSIC_TRACKS, findTrack } from '@/lib/music';

function keywordPick(prompt: string): string[] {
  const text = prompt.toLowerCase();
  const scored = MUSIC_TRACKS.map((track) => {
    let score = 0;
    for (const tag of track.tags) if (text.includes(tag.toLowerCase())) score += 3;
    if (text.includes(track.mood)) score += 2;
    if (text.includes(track.language)) score += 1;
    for (const word of track.title.toLowerCase().split(/\s+/)) if (word.length > 3 && text.includes(word)) score += 2;
    if (text.includes(track.artist.toLowerCase())) score += 2;
    return { id: track.id, score };
  });
  const positive = scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  const rest = MUSIC_TRACKS.filter((track) => !positive.some((item) => item.id === track.id)).map((track) => track.id);
  return [...positive.map((item) => item.id), ...rest].slice(0, 10);
}

/**
 * Builds a playlist from the original YumEra catalogue.
 * With an AI provider configured the model curates by mood, language and theme;
 * without one the server uses transparent keyword matching and says so.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ prompt?: string; save?: boolean; title?: string }>(req);
  const prompt = (body.prompt ?? '').toString().trim().slice(0, 500);
  if (!prompt) throw new ApiError(400, 'Describe the playlist you want');

  let ids: string[] = [];
  let source: 'ai' | 'keywords' = 'keywords';
  let note = '';

  if (isAiConfigured()) {
    const catalogue = MUSIC_TRACKS.map((t) => `${t.id} | ${t.title} | ${t.artist} | ${t.language} | ${t.mood} | ${t.tags.join(', ')}`).join('\n');
    try {
      const answer = await aiComplete(
        [
          {
            role: 'system',
            content:
              'You are a music curator for YumEra. Pick songs ONLY from the provided catalogue. Reply with a JSON array of 8 to 10 track ids, nothing else.',
          },
          { role: 'user', content: `Catalogue:\n${catalogue}\n\nRequest: ${prompt}` },
        ],
        { temperature: 0.7, maxTokens: 400 },
      );
      const match = answer.match(/\[[\s\S]*\]/);
      const parsed = match ? (JSON.parse(match[0]) as unknown[]) : [];
      ids = parsed.filter((id): id is string => typeof id === 'string' && Boolean(findTrack(id))).slice(0, 12);
      if (ids.length >= 4) source = 'ai';
    } catch (error) {
      if (!(error instanceof AiNotConfiguredError)) {
        console.error('[ai-playlist]', (error as Error).message);
      }
      note = 'The AI provider did not answer, so YumEra curated this playlist by mood and keyword matching instead.';
    }
  } else {
    note = 'No AI provider is configured, so this playlist was curated by mood and keyword matching over the original YumEra catalogue.';
  }

  if (ids.length === 0) ids = keywordPick(prompt);

  const tracks = ids.map((id) => findTrack(id)).filter((track): track is NonNullable<typeof track> => Boolean(track));

  if (body.save === false) return ok({ tracks, source, note });

  const title = (body.title ?? '').toString().trim().slice(0, 120) || `Playlist · ${prompt.slice(0, 60)}`;
  const playlistId = uid();
  run(
    `INSERT INTO music_playlists (id, user_id, title, description, cover_url, is_public, generated_by, created_at)
     VALUES (?, ?, ?, ?, NULL, 0, ?, ?)`,
    playlistId,
    user.id,
    title,
    `Curated from the prompt: ${prompt}`,
    source === 'ai' ? 'ai' : 'keywords',
    now(),
  );
  ids.forEach((trackId, index) => {
    run(
      'INSERT INTO playlist_tracks (id, playlist_id, track_id, position, dedication) VALUES (?, ?, ?, ?, ?)',
      uid(),
      playlistId,
      trackId,
      index,
      '',
    );
  });

  return ok({ playlistId, title, tracks, source, note }, 201);
});

export const GET = route(async () => {
  const user = await requireUser();
  const playlists = all(
    'SELECT id, title, description, is_public, generated_by, created_at FROM music_playlists WHERE user_id = ? ORDER BY created_at DESC',
    user.id,
  );
  return ok({ playlists, aiConfigured: isAiConfigured() });
});
