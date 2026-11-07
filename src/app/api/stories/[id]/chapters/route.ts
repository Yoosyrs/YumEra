import { ApiError, ok, optionalStr, readJson, requireUser, route, str } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';

async function loadStory(storyId: string, viewerId: string) {
  const story = get<{ id: string; user_id: string; visibility: string; status: string; title: string }>(
    'SELECT id, user_id, visibility, status, title FROM stories WHERE id = ?',
    storyId,
  );
  if (!story) throw new ApiError(404, 'Story not found');
  const isOwner = story.user_id === viewerId;
  if (!isOwner && (story.visibility !== 'public' || story.status !== 'published')) {
    throw new ApiError(403, 'This story is private');
  }
  return { story, isOwner };
}

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await loadStory(id, user.id);
  const chapters = all(
    'SELECT id, title, content, position, created_at FROM story_chapters WHERE story_id = ? ORDER BY position ASC, created_at ASC',
    id,
  );
  return ok({ chapters });
});

export const POST = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { isOwner } = await loadStory(id, user.id);
  if (!isOwner) throw new ApiError(403, 'Only the author can add chapters');
  const body = await readJson<{ title?: string; content?: string }>(req);
  const title = str(body.title, 'title', { max: 160 });
  const content = optionalStr(body.content, 40_000);
  const next = get<{ n: number }>('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM story_chapters WHERE story_id = ?', id);
  const chapterId = uid();
  run(
    'INSERT INTO story_chapters (id, story_id, title, content, position, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    chapterId,
    id,
    title,
    content,
    next?.n ?? 0,
    now(),
  );
  return ok({ chapter: get('SELECT * FROM story_chapters WHERE id = ?', chapterId) }, 201);
});

export const PATCH = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { isOwner } = await loadStory(id, user.id);
  if (!isOwner) throw new ApiError(403, 'Only the author can edit chapters');
  const body = await readJson<{ chapterId?: string; title?: string; content?: string; position?: number }>(req);
  const chapterId = str(body.chapterId, 'chapterId', { max: 80 });
  const existing = get<{ id: string }>('SELECT id FROM story_chapters WHERE id = ? AND story_id = ?', chapterId, id);
  if (!existing) throw new ApiError(404, 'Chapter not found');
  if (typeof body.title === 'string') run('UPDATE story_chapters SET title = ? WHERE id = ?', body.title.slice(0, 160), chapterId);
  if (typeof body.content === 'string') run('UPDATE story_chapters SET content = ? WHERE id = ?', body.content.slice(0, 40_000), chapterId);
  if (typeof body.position === 'number') run('UPDATE story_chapters SET position = ? WHERE id = ?', Math.max(0, Math.floor(body.position)), chapterId);
  return ok({ chapter: get('SELECT * FROM story_chapters WHERE id = ?', chapterId) });
});

export const DELETE = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { isOwner } = await loadStory(id, user.id);
  if (!isOwner) throw new ApiError(403, 'Only the author can delete chapters');
  const chapterId = new URL(req.url).searchParams.get('chapterId');
  if (!chapterId) throw new ApiError(400, 'chapterId is required');
  run('DELETE FROM story_chapters WHERE id = ? AND story_id = ?', chapterId, id);
  return ok({ deleted: true });
});
