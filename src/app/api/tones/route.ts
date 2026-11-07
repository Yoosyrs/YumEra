import { ApiError, ok, oneOf, readJson, requireUser, route, str } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';

const WAVEFORMS = ['sine', 'triangle', 'bell', 'glass'] as const;

/**
 * Custom notification tones.
 *
 * Browsers and operating systems decide the sound of a *push* notification, so
 * these tones are used for the in-app chime and as a selectable preference.
 * They are synthesised procedurally from the stored parameters.
 */
export const GET = route(async () => {
  const user = await requireUser();
  const tones = all<{
    id: string;
    name: string;
    base_freq: number;
    waveform: string;
    decay: number;
    sparkle: number;
    created_at: string;
  }>(
    'SELECT id, name, base_freq, waveform, decay, sparkle, created_at FROM notification_tones WHERE user_id = ? ORDER BY created_at ASC',
    user.id,
  );
  return ok({
    tones: tones.map((tone) => ({
      id: tone.id,
      name: tone.name,
      baseFreq: tone.base_freq,
      waveform: tone.waveform,
      decay: tone.decay,
      sparkle: tone.sparkle,
      createdAt: tone.created_at,
    })),
  });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{
    name?: string;
    baseFreq?: number;
    waveform?: string;
    decay?: number;
    sparkle?: number;
  }>(req);
  const name = str(body.name, 'name', { max: 40 });
  const baseFreq = Math.round(Math.min(Math.max(Number(body.baseFreq ?? 880) || 880, 220), 1800));
  const waveform = oneOf(body.waveform, WAVEFORMS, 'bell');
  const decay = Math.min(Math.max(Number(body.decay ?? 1.6) || 1.6, 0.6), 3);
  const sparkle = Math.min(Math.max(Math.round(Number(body.sparkle ?? 3) || 3), 0), 6);

  const count = get<{ c: number }>('SELECT COUNT(*) AS c FROM notification_tones WHERE user_id = ?', user.id);
  if ((count?.c ?? 0) >= 12) throw new ApiError(400, 'You can keep up to 12 custom tones. Delete one first.');

  const id = uid();
  run(
    `INSERT INTO notification_tones (id, user_id, name, base_freq, waveform, decay, sparkle, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    name,
    baseFreq,
    waveform,
    decay,
    sparkle,
    now(),
  );
  return ok({ tone: { id, name, baseFreq, waveform, decay, sparkle } }, 201);
});

export const DELETE = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) throw new ApiError(400, 'id is required');
  run('DELETE FROM notification_tones WHERE id = ? AND user_id = ?', id, user.id);
  return ok({ deleted: true });
});
