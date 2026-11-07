import { ApiError, ok, readJson, requireUser, route, str } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';

const GAME_IDS = [
  'starfall',
  'memory-constellation',
  'soul-quiz',
  'word-weaver',
  'moonlit-2048',
  'heartbeat-reflex',
  'yume-match',
  'runes-of-fate',
  'echo-sequence',
  'petal-catcher',
  'glyph-pairs',
  'orbit-dodge',
  'lullaby-simon',
  'constellation-trace',
  'dream-sort',
  'aurora-tiles',
  'shooting-stars',
  'veil-of-numbers',
  'yume-solitaire',
  'eternal-lanes',
] as const;

export const GET = route(async () => {
  const user = await requireUser();
  const best = all<{ game_id: string; score: number; created_at: string }>(
    `SELECT game_id, MAX(score) AS score, MAX(created_at) AS created_at
     FROM game_scores WHERE user_id = ? GROUP BY game_id`,
    user.id,
  );
  const global = all<{ game_id: string; score: number; username: string; display_name: string }>(
    `SELECT g.game_id, g.score, u.username, u.display_name
     FROM game_scores g JOIN users u ON u.id = g.user_id
     WHERE g.score = (SELECT MAX(score) FROM game_scores x WHERE x.game_id = g.game_id)
     GROUP BY g.game_id`,
  );
  return ok({
    games: GAME_IDS,
    best,
    global,
    played: best.length,
  });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ gameId?: string; score?: number }>(req);
  const gameId = str(body.gameId, 'gameId', { max: 40 });
  if (!(GAME_IDS as readonly string[]).includes(gameId)) throw new ApiError(400, 'Unknown game');
  const score = Math.floor(Number(body.score));
  if (!Number.isFinite(score) || score < 0 || score > 1_000_000) throw new ApiError(400, 'Invalid score');

  const previous = get<{ best: number }>(
    'SELECT MAX(score) AS best FROM game_scores WHERE user_id = ? AND game_id = ?',
    user.id,
    gameId,
  );
  run('INSERT INTO game_scores (id, user_id, game_id, score, created_at) VALUES (?, ?, ?, ?, ?)', uid(), user.id, gameId, score, now());
  return ok({ saved: true, best: Math.max(score, previous?.best ?? 0), improved: score > (previous?.best ?? 0) }, 201);
});
