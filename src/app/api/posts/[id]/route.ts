import { ApiError, ok, optionalStr, oneOf, readJson, requireUser, route } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';
import { isBlocked } from '@/lib/auth';
import { notify } from '@/lib/notifications';

const SELECT = `
  p.*, u.username, u.display_name, u.avatar_url, u.is_private,
  (SELECT COUNT(*) FROM reactions r WHERE r.target_type = 'post' AND r.target_id = p.id) AS reaction_count,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
  (SELECT COUNT(*) FROM posts s WHERE s.share_of = p.id) AS share_count
`;

async function loadPost(id: string, viewerId: string) {
  const post = get<Record<string, unknown> & { user_id: string; visibility: string }>(
    `SELECT ${SELECT} FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
    id,
  );
  if (!post) throw new ApiError(404, 'Post not found');
  if (post.visibility !== 'public' && post.user_id !== viewerId) throw new ApiError(403, 'This post is private');
  if (isBlocked(viewerId, post.user_id)) throw new ApiError(403, 'Unavailable');
  return post;
}

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const post = await loadPost(id, user.id);
  const comments = all(
    `SELECT c.*, u.username, u.display_name, u.avatar_url
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ? ORDER BY c.created_at ASC LIMIT 300`,
    id,
  );
  const reacted = get(
    `SELECT id FROM reactions WHERE user_id = ? AND target_type = 'post' AND target_id = ?`,
    user.id,
    id,
  );
  return ok({ item: post, comments, reacted: Boolean(reacted) });
});

export const POST = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const post = await loadPost(id, user.id);
  const body = await readJson(req);
  const action = oneOf(body.action, ['react', 'comment', 'share'] as const, 'react');

  if (action === 'react') {
    const kind = oneOf(body.kind, ['heart', 'star', 'moon', 'sparkle'] as const, 'heart');
    const existing = get<{ id: string }>(
      `SELECT id FROM reactions WHERE user_id = ? AND target_type = 'post' AND target_id = ?`,
      user.id,
      id,
    );
    if (existing) {
      run('DELETE FROM reactions WHERE id = ?', existing.id);
    } else {
      run(
        `INSERT INTO reactions (id, user_id, target_type, target_id, kind, created_at) VALUES (?, ?, 'post', ?, ?, ?)`,
        uid(),
        user.id,
        id,
        kind,
        now(),
      );
      await notify({
        recipientId: post.user_id,
        actorId: user.id,
        type: 'reaction',
        category: 'interactions',
        title: `${user.display_name} reacted to your post`,
        message: String(post.content ?? '').slice(0, 120),
        targetType: 'post',
        targetId: id,
        preference: 'reactions',
        url: `/post/${id}`,
      });
    }
    const count = get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM reactions WHERE target_type = 'post' AND target_id = ?`,
      id,
    );
    return ok({ reacted: !existing, count: count?.c ?? 0 });
  }

  if (action === 'comment') {
    const content = optionalStr(body.content, 2000);
    if (!content) throw new ApiError(400, 'Comment cannot be empty.');
    const parentId = optionalStr(body.parentId, 60) || null;
    if (parentId) {
      const parent = get<{ id: string }>('SELECT id FROM comments WHERE id = ? AND post_id = ?', parentId, id);
      if (!parent) throw new ApiError(404, 'The comment you replied to no longer exists.');
    }
    const commentId = uid();
    run(
      `INSERT INTO comments (id, post_id, user_id, parent_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      commentId,
      id,
      user.id,
      parentId,
      content,
      now(),
    );
    await notify({
      recipientId: post.user_id,
      actorId: user.id,
      type: parentId ? 'reply' : 'comment',
      category: 'interactions',
      title: `${user.display_name} commented on your post`,
      message: content.slice(0, 140),
      targetType: 'post',
      targetId: id,
      preference: 'comments',
      url: `/post/${id}`,
    });
    const mentions = Array.from(new Set((content.match(/@([a-z0-9_]{3,24})/gi) ?? []).map((m) => m.slice(1).toLowerCase())));
    for (const username of mentions.slice(0, 8)) {
      const target = get<{ id: string }>('SELECT id FROM users WHERE username = ?', username);
      if (target && target.id !== user.id) {
        await notify({
          recipientId: target.id,
          actorId: user.id,
          type: 'mention',
          category: 'interactions',
          title: `${user.display_name} mentioned you in a comment`,
          message: content.slice(0, 140),
          targetType: 'post',
          targetId: id,
          preference: 'mentions',
          url: `/post/${id}`,
        });
      }
    }
    const comment = get(
      `SELECT c.*, u.username, u.display_name, u.avatar_url FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
      commentId,
    );
    return ok({ comment }, 201);
  }

  // share
  const shareId = uid();
  run(
    `INSERT INTO posts (id, user_id, content, media_url, media_type, visibility, community_id, share_of, created_at)
     VALUES (?, ?, ?, NULL, NULL, 'public', NULL, ?, ?)`,
    shareId,
    user.id,
    optionalStr(body.content, 1000),
    id,
    now(),
  );
  await notify({
    recipientId: post.user_id,
    actorId: user.id,
    type: 'share',
    category: 'interactions',
    title: `${user.display_name} shared your post`,
    targetType: 'post',
    targetId: id,
    preference: 'reactions',
    url: `/post/${shareId}`,
  });
  return ok({ shared: true, id: shareId }, 201);
});

export const DELETE = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const post = get<{ user_id: string }>('SELECT user_id FROM posts WHERE id = ?', id);
  if (!post) throw new ApiError(404, 'Post not found');
  if (post.user_id !== user.id && user.role !== 'admin') throw new ApiError(403, 'You can only delete your own posts.');
  run('DELETE FROM posts WHERE id = ?', id);
  return ok({ deleted: true });
});
