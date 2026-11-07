import { ApiError, ok, optionalStr, oneOf, pageParams, readJson, requireUser, route } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';
import { isBlocked } from '@/lib/auth';
import { notify } from '@/lib/notifications';

const POST_SELECT = `
  p.*,
  u.username, u.display_name, u.avatar_url, u.is_private,
  (SELECT COUNT(*) FROM reactions r WHERE r.target_type = 'post' AND r.target_id = p.id) AS reaction_count,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
  (SELECT COUNT(*) FROM posts s WHERE s.share_of = p.id) AS share_count,
  (SELECT COUNT(*) FROM reactions r2 WHERE r2.target_type = 'post' AND r2.target_id = p.id AND r2.user_id = ?) AS reacted
`;

export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const { limit, offset, params } = pageParams(url, 20);
  const where: string[] = [];
  const args: unknown[] = [user.id];

  const username = params.get('user');
  const community = params.get('community');
  const tag = params.get('tag');
  const following = params.get('feed') === 'following';
  const q = params.get('q')?.trim();

  if (username) {
    where.push('u.username = ?');
    args.push(username);
    if (username !== user.username) where.push(`(p.visibility = 'public' AND u.is_private = 0)`);
  } else if (community) {
    where.push('p.community_id = ?');
    args.push(community);
  } else if (following) {
    where.push(`(p.user_id = ? OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?))`);
    args.push(user.id);
    where.push(`p.visibility = 'public'`);
  } else {
    where.push(`(p.visibility = 'public' OR p.user_id = ?)`);
  }

  if (tag) {
    where.push('(p.content LIKE ? OR p.content LIKE ?)');
    args.push(`#${tag}%`, `% #${tag}%`);
  }
  if (q) {
    where.push('p.content LIKE ?');
    args.push(`%${q}%`);
  }

  where.push(`NOT EXISTS (
    SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = p.user_id)
      OR (b.blocker_id = p.user_id AND b.blocked_id = ?)
  )`);
  args.push(user.id, user.id);

  const sql = `SELECT ${POST_SELECT} FROM posts p JOIN users u ON u.id = p.user_id
    WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
  const items = all(sql, ...args, limit, offset);
  return ok({ items, limit, offset });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const content = optionalStr(body.content, 5000);
  const mediaUrl = optionalStr(body.mediaUrl, 500) || null;
  const mediaType = mediaUrl ? oneOf(body.mediaType, ['image', 'video', 'audio'] as const, 'image') : null;
  const visibility = oneOf(body.visibility, ['public', 'private'] as const, 'public');
  const communityId = optionalStr(body.communityId, 60) || null;
  const shareOf = optionalStr(body.shareOf, 60) || null;

  if (!content && !mediaUrl && !shareOf) throw new ApiError(400, 'Write something or attach an image.');

  if (communityId) {
    const member = get(
      `SELECT id FROM community_members WHERE community_id = ? AND user_id = ? AND status = 'active'`,
      communityId,
      user.id,
    );
    if (!member) throw new ApiError(403, 'Join this community before posting.');
  }

  const id = uid();
  run(
    `INSERT INTO posts (id, user_id, content, media_url, media_type, visibility, community_id, share_of, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    content,
    mediaUrl,
    mediaType,
    visibility,
    communityId,
    shareOf,
    now(),
  );

  // Mentions become real notifications.
  const mentions = Array.from(new Set((content.match(/@([a-z0-9_]{3,24})/gi) ?? []).map((m) => m.slice(1).toLowerCase())));
  for (const username of mentions.slice(0, 10)) {
    const target = get<{ id: string }>('SELECT id FROM users WHERE username = ?', username);
    if (target && target.id !== user.id && !isBlocked(user.id, target.id)) {
      await notify({
        recipientId: target.id,
        actorId: user.id,
        type: 'mention',
        category: 'interactions',
        title: `${user.display_name} mentioned you`,
        message: content.slice(0, 120),
        targetType: 'post',
        targetId: id,
        preference: 'mentions',
        url: `/post/${id}`,
      });
    }
  }

  const item = get(`SELECT ${POST_SELECT} FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`, user.id, id);
  return ok({ item }, 201);
});
