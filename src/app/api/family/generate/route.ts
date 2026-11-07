import { ApiError, ok, readJson, requireUser, route, str } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';
import { AiNotConfiguredError, aiComplete, isAiConfigured } from '@/lib/ai';

function seededRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function hash(text: string): number {
  let value = 7;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) % 2147483647;
  return value;
}

const TRAIT_POOL = [
  'starlit eyes',
  'gentle laugh',
  'protective streak',
  'loves rain',
  'collects feathers',
  'quiet courage',
  'musical',
  'stubbornly kind',
  'dreams in colour',
  'afraid of silence',
  'loyal to a fault',
  'finds lost things',
  'reads late',
  'draws constellations',
  'brave at dawn',
  'soft-spoken',
];

const NAME_A = ['Liria', 'Sable', 'Noor', 'Elian', 'Mirae', 'Cass', 'Yuki', 'Alma', 'Ren', 'Vesper', 'Iris', 'Sol'];
const NAME_B = ['del Alba', 'Nocturne', 'Aurel', 'Hoshino', 'Valcour', 'Estel', 'Marés', 'Lune', 'Seraph', 'Amanecer'];

/**
 * Generates a "yume child" for an F/O bond.
 *
 * The character sheet is derived from the two source characters. When an AI
 * provider is configured it writes the story; otherwise a deterministic
 * composition from the parents' palettes and traits is used, and the response
 * says which path produced it.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ foId?: string; yumesonaId?: string; notes?: string }>(req);
  const foId = str(body.foId, 'foId', { max: 80 });
  const fo = get<{
    id: string;
    name: string;
    source_work: string;
    relationship_type: string;
    description: string;
    preferences: string;
    portrait_url: string | null;
    user_id: string;
  }>('SELECT * FROM fo_characters WHERE id = ?', foId);
  if (!fo || fo.user_id !== user.id) throw new ApiError(404, 'F/O not found');

  let yumesona: { id: string; name: string; personality: string; universe: string; image_url: string | null; traits: string } | null = null;
  if (body.yumesonaId) {
    yumesona = get<{ id: string; name: string; personality: string; universe: string; image_url: string | null; traits: string }>(
      'SELECT id, name, personality, universe, image_url, traits FROM yumesonas WHERE id = ? AND user_id = ?',
      body.yumesonaId,
      user.id,
    );
    if (!yumesona) throw new ApiError(404, 'Yumesona not found');
  }

  const seed = hash(`${fo.id}:${yumesona?.id ?? 'solo'}:${body.notes ?? ''}`);
  const random = seededRandom(seed);
  const pick = <T,>(list: T[]): T => list[Math.floor(random() * list.length)];

  let parentTraits: string[] = [];
  try {
    const parsed = yumesona?.traits ? (JSON.parse(yumesona.traits) as unknown) : [];
    if (Array.isArray(parsed)) parentTraits = parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    parentTraits = [];
  }

  const traits = Array.from(
    new Set([...parentTraits.slice(0, 3), pick(TRAIT_POOL), pick(TRAIT_POOL), pick(TRAIT_POOL)]),
  ).slice(0, 6);

  const palette = ['#b892ff', '#f2a7c3', '#f6e2b3', '#9ad1e8', '#e8d7ff'].sort(() => random() - 0.5).slice(0, 4);
  const fallbackName = `${pick(NAME_A)} ${pick(NAME_B)}`;

  let name = fallbackName;
  let gender = pick(['non-binary', 'feminine', 'masculine', 'unspecified']);
  let story = `Child of ${fo.name}${yumesona ? ` and ${yumesona.name}` : ''}. A quiet soul who inherited ${
    traits[0] ?? 'a gentle heart'
  } and keeps a small star chart of the family's memories.`;
  let source: 'ai' | 'local' = 'local';
  let note = 'Generated from the bond data on your account. Add an AI provider key to let YumEra write richer lore.';

  if (isAiConfigured()) {
    try {
      const answer = await aiComplete(
        [
          {
            role: 'system',
            content:
              'You design original fictional characters for a self-shipping community. Reply ONLY with JSON: {"name":"","gender":"","traits":["",""],"palette":["#hex"],"story":""}. Story must be 2-3 sentences, warm, no explicit content.',
          },
          {
            role: 'user',
            content: `F/O: ${fo.name} from ${fo.source_work || 'an original universe'}. Relationship: ${fo.relationship_type || 'romantic'}. Description: ${fo.description.slice(0, 400)}. Partner yumesona: ${yumesona?.name ?? 'the user self-insert'}. Yumesona personality: ${(yumesona?.personality ?? '').slice(0, 300)}. Universe: ${yumesona?.universe ?? ''}. Extra notes: ${(body.notes ?? '').slice(0, 300)}`,
          },
        ],
        { temperature: 0.9, maxTokens: 500 },
      );
      const match = answer.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as {
          name?: string;
          gender?: string;
          traits?: unknown;
          palette?: unknown;
          story?: string;
        };
        if (parsed.name) name = String(parsed.name).slice(0, 80);
        if (parsed.gender) gender = String(parsed.gender).slice(0, 40);
        if (Array.isArray(parsed.traits) && parsed.traits.length) {
          traits.splice(0, traits.length, ...parsed.traits.filter((t): t is string => typeof t === 'string').slice(0, 6));
        }
        if (Array.isArray(parsed.palette) && parsed.palette.length) {
          palette.splice(0, palette.length, ...parsed.palette.filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, 5));
        }
        if (parsed.story) story = String(parsed.story).slice(0, 1200);
        source = 'ai';
        note = 'Character written by the configured AI provider from your bond data.';
      }
    } catch (error) {
      if (!(error instanceof AiNotConfiguredError)) console.error('[family-generate]', (error as Error).message);
      note = 'The AI provider did not answer, so YumEra composed this character locally from the bond data.';
    }
  }

  const childId = uid();
  const portrait = JSON.stringify({
    foPortrait: fo.portrait_url,
    yumesonaPortrait: yumesona?.image_url ?? null,
    palette,
  });
  run(
    `INSERT INTO family_children (id, user_id, fo_id, yumesona_id, name, gender, traits, palette, portrait, story, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    childId,
    user.id,
    fo.id,
    yumesona?.id ?? null,
    name,
    gender,
    JSON.stringify(traits),
    JSON.stringify(palette),
    portrait,
    story,
    now(),
  );

  return ok(
    {
      child: get('SELECT * FROM family_children WHERE id = ?', childId),
      source,
      note,
      parents: { fo: { id: fo.id, name: fo.name }, yumesona: yumesona ? { id: yumesona.id, name: yumesona.name } : null },
    },
    201,
  );
});

export const GET = route(async () => {
  const user = await requireUser();
  const children = all(
    `SELECT c.*, f.name AS fo_name, f.portrait_url AS fo_portrait, y.name AS yumesona_name
     FROM family_children c
     LEFT JOIN fo_characters f ON f.id = c.fo_id
     LEFT JOIN yumesonas y ON y.id = c.yumesona_id
     WHERE c.user_id = ? ORDER BY c.created_at DESC`,
    user.id,
  );
  const fos = all('SELECT id, name, source_work, portrait_url FROM fo_characters WHERE user_id = ? ORDER BY name', user.id);
  const yumesonas = all('SELECT id, name, image_url FROM yumesonas WHERE user_id = ? ORDER BY name', user.id);
  return ok({ children, fos, yumesonas, aiConfigured: isAiConfigured() });
});
