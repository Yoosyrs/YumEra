import { ApiError, ok, readJson, requireUser, route } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';
import { AiNotConfiguredError, aiComplete, characterSystemPrompt, isAiConfigured } from '@/lib/ai';

async function loadCharacter(characterId: string, userId: string) {
  const character = get<{
    id: string;
    user_id: string;
    name: string;
    personality: string;
    biography: string;
    universe: string;
    story: string;
    speech_style: string;
    behavior_rules: string;
    greeting: string;
    temperature: number;
  }>(
    `SELECT id, user_id, name, personality, biography, universe, story, speech_style, behavior_rules, greeting, temperature
     FROM characters WHERE id = ?`,
    characterId,
  );
  if (!character) throw new ApiError(404, 'Character not found');
  if (character.user_id !== userId) throw new ApiError(403, 'This character belongs to another user');
  return character;
}

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await loadCharacter(id, user.id);
  const messages = all(
    'SELECT id, role, content, created_at FROM character_messages WHERE character_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 200',
    id,
    user.id,
  );
  return ok({ messages, aiConfigured: isAiConfigured() });
});

export const POST = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const character = await loadCharacter(id, user.id);
  const body = await readJson<{ content?: string }>(req);
  const content = (body.content ?? '').toString().trim().slice(0, 2000);
  if (!content) throw new ApiError(400, 'Message cannot be empty');
  if (!isAiConfigured()) {
    throw new ApiError(
      503,
      'No AI provider is configured. Add AI_API_KEY on the server to chat with characters. Your message was not sent.',
    );
  }

  const history = all<{ role: string; content: string }>(
    'SELECT role, content FROM character_messages WHERE character_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 20',
    id,
    user.id,
  ).reverse();

  run(
    'INSERT INTO character_messages (id, character_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    uid(),
    id,
    user.id,
    'user',
    content,
    now(),
  );

  let reply: string;
  try {
    reply = await aiComplete(
      [
        { role: 'system', content: characterSystemPrompt(character) },
        ...history.map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: m.content })),
        { role: 'user', content },
      ],
      { temperature: Math.min(Math.max(Number(character.temperature) || 0.85, 0.1), 1.4) },
    );
  } catch (error) {
    if (error instanceof AiNotConfiguredError) throw new ApiError(503, 'AI provider is not configured');
    console.error('[character-chat]', (error as Error).message);
    throw new ApiError(502, 'The AI provider could not answer. Your message was saved and you can retry.');
  }

  run(
    'INSERT INTO character_messages (id, character_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    uid(),
    id,
    user.id,
    'assistant',
    reply,
    now(),
  );

  return ok({
    reply,
    messages: all(
      'SELECT id, role, content, created_at FROM character_messages WHERE character_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT 200',
      id,
      user.id,
    ),
  });
});

export const DELETE = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await loadCharacter(id, user.id);
  run('DELETE FROM character_messages WHERE character_id = ? AND user_id = ?', id, user.id);
  return ok({ cleared: true });
});
