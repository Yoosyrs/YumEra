import { ApiError, ok, optionalStr, readJson, requireUser, route } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { isBlocked } from '@/lib/auth';

async function loadCommunity(id: string, userId: string) {
  const community = get<{
    id: string;
    owner_id: string;
    slug: string;
    name: string;
    description: string;
    rules: string;
    visibility: string;
    cover_url: string | null;
    created_at: string;
  }>('SELECT * FROM communities WHERE id = ?', id);
  if (!community) throw new ApiError(404, 'Community not found');
  const membership = get<{ role: string; status: string }>(
    'SELECT role, status FROM community_members WHERE community_id = ? AND user_id = ?',
    id,
    userId,
  );
  const isAdmin = membership?.role === 'admin' || membership?.role === 'moderator';
  const isMember = membership?.status === 'active';
  const isOwner = community.owner_id === userId;
  if (community.visibility === 'private' && !isMember && !isAdmin && !isOwner) {
    throw new ApiError(403, 'This community is private');
  }
  return { community, membership, isAdmin, isMember, isOwner };
}

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { community, membership, isAdmin, isMember } = await loadCommunity(id, user.id);

  const members = all<{ user_id: string; role: string; status: string; username: string; display_name: string; avatar_url: string | null; joined_at: string }>(
    `SELECT m.user_id, m.role, m.status, m.joined_at, u.username, u.display_name, u.avatar_url
     FROM community_members m JOIN users u ON u.id = m.user_id
     WHERE m.community_id = ? AND (m.status = 'active' OR ? = 1)
     ORDER BY CASE m.role WHEN 'admin' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, m.joined_at ASC
     LIMIT 200`,
    id,
    isAdmin ? 1 : 0,
  );
  const events = all(
    'SELECT id, title, description, starts_at, created_at FROM community_events WHERE community_id = ? ORDER BY starts_at ASC',
    id,
  );
  const posts = isMember || community.visibility === 'public'
    ? all(
        `SELECT p.id, p.content, p.media_url, p.media_type, p.created_at, u.username, u.display_name, u.avatar_url
         FROM posts p JOIN users u ON u.id = p.user_id
         WHERE p.community_id = ? AND p.visibility != 'private'
         ORDER BY p.created_at DESC LIMIT 40`,
        id,
      )
    : [];
  return ok({
    community,
    membership: membership ?? null,
    isAdmin,
    isMember,
    members,
    events,
    posts,
  });
});

export const POST = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { community, membership, isAdmin, isMember } = await loadCommunity(id, user.id);
  const body = await readJson<{
    action?: string;
    username?: string;
    userId?: string;
    title?: string;
    description?: string;
    startsAt?: string;
    content?: string;
  }>(req);
  const action = String(body.action ?? '');

  if (action === 'join') {
    if (isMember) return ok({ status: 'active' });
    const status = community.visibility === 'private' ? 'pending' : 'active';
    run(
      `INSERT INTO community_members (id, community_id, user_id, role, status, joined_at)
       VALUES (?, ?, ?, 'member', ?, ?)
       ON CONFLICT(community_id, user_id) DO UPDATE SET status = excluded.status`,
      uid(),
      id,
      user.id,
      status,
      now(),
    );
    if (status === 'pending') {
      await notify({
        recipientId: community.owner_id,
        actorId: user.id,
        type: 'community_join_request',
        category: 'community',
        title: `New request to join ${community.name}`,
        message: `@${user.username} asked to join your private community.`,
        targetType: 'community',
        targetId: id,
        preference: 'events',
        url: `/communities/${id}`,
        pushBody: `@${user.username} asked to join ${community.name}.`,
      });
    }
    return ok({ status });
  }

  if (action === 'leave') {
    if (community.owner_id === user.id) throw new ApiError(400, 'The owner cannot leave their own community');
    run('DELETE FROM community_members WHERE community_id = ? AND user_id = ?', id, user.id);
    return ok({ status: 'left' });
  }

  if (action === 'invite') {
    if (!isMember && !isAdmin) throw new ApiError(403, 'Join the community before inviting others');
    const username = String(body.username ?? '').replace(/^@/, '').toLowerCase();
    const invited = get<{ id: string; username: string }>('SELECT id, username FROM users WHERE username = ?', username);
    if (!invited) throw new ApiError(404, 'User not found');
    if (isBlocked(user.id, invited.id) || isBlocked(invited.id, user.id)) throw new ApiError(403, 'You cannot invite this user');
    run(
      `INSERT INTO community_members (id, community_id, user_id, role, status, joined_at)
       VALUES (?, ?, ?, 'member', 'pending', ?)
       ON CONFLICT(community_id, user_id) DO NOTHING`,
      uid(),
      id,
      invited.id,
      now(),
    );
    await notify({
      recipientId: invited.id,
      actorId: user.id,
      type: 'community_invite',
      category: 'community',
      title: `Invitation to ${community.name}`,
      message: `@${user.username} invited you to join ${community.name}.`,
      targetType: 'community',
      targetId: id,
      preference: 'events',
      url: `/communities/${id}`,
      pushBody: `@${user.username} invited you to ${community.name}.`,
    });
    return ok({ invited: invited.username });
  }

  if (action === 'approve' || action === 'reject') {
    if (!isAdmin) throw new ApiError(403, 'Only admins can review requests');
    const target = String(body.userId ?? '');
    if (!target) throw new ApiError(400, 'userId is required');
    if (action === 'approve') {
      run("UPDATE community_members SET status = 'active' WHERE community_id = ? AND user_id = ?", id, target);
      await notify({
        recipientId: target,
        actorId: user.id,
        type: 'community_accepted',
        category: 'community',
        title: `You joined ${community.name}`,
        message: 'Your membership request was accepted.',
        targetType: 'community',
        targetId: id,
        preference: 'events',
        url: `/communities/${id}`,
      });
    } else {
      run('DELETE FROM community_members WHERE community_id = ? AND user_id = ?', id, target);
    }
    return ok({ reviewed: target, action });
  }

  if (action === 'event') {
    if (!isAdmin) throw new ApiError(403, 'Only admins can schedule events');
    const title = String(body.title ?? '').trim().slice(0, 160);
    if (!title) throw new ApiError(400, 'title is required');
    const startsAt = String(body.startsAt ?? '').slice(0, 40);
    if (!startsAt) throw new ApiError(400, 'startsAt is required');
    const eventId = uid();
    run(
      'INSERT INTO community_events (id, community_id, title, description, starts_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      eventId,
      id,
      title,
      optionalStr(body.description, 2000),
      startsAt,
      now(),
    );
    const audience = all<{ user_id: string }>(
      "SELECT user_id FROM community_members WHERE community_id = ? AND status = 'active' AND user_id != ? LIMIT 200",
      id,
      user.id,
    );
    for (const member of audience) {
      await notify({
        recipientId: member.user_id,
        actorId: user.id,
        type: 'community_event',
        category: 'community',
        title: `Event in ${community.name}`,
        message: title,
        targetType: 'community',
        targetId: id,
        preference: 'events',
        url: `/communities/${id}`,
        pushBody: `New event in ${community.name}: ${title}`,
      });
    }
    return ok({ event: get('SELECT * FROM community_events WHERE id = ?', eventId) }, 201);
  }

  if (action === 'post') {
    if (!isMember && !isAdmin) throw new ApiError(403, 'Only members can post in this community');
    const content = String(body.content ?? '').trim().slice(0, 5000);
    if (!content) throw new ApiError(400, 'content is required');
    const postId = uid();
    run(
      `INSERT INTO posts (id, user_id, content, media_url, media_type, visibility, community_id, share_of, created_at)
       VALUES (?, ?, ?, NULL, NULL, 'public', ?, NULL, ?)`,
      postId,
      user.id,
      content,
      id,
      now(),
    );
    return ok({ postId }, 201);
  }

  if (action === 'delete-event') {
    if (!isAdmin) throw new ApiError(403, 'Only admins can remove events');
    run('DELETE FROM community_events WHERE id = ? AND community_id = ?', String(body.userId ?? ''), id);
    return ok({ deleted: true });
  }

  void membership;
  throw new ApiError(400, 'Unknown action');
});

export const DELETE = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const community = get<{ owner_id: string }>('SELECT owner_id FROM communities WHERE id = ?', id);
  if (!community) throw new ApiError(404, 'Community not found');
  if (community.owner_id !== user.id) throw new ApiError(403, 'Only the owner can delete this community');
  run('DELETE FROM communities WHERE id = ?', id);
  return ok({ deleted: true });
});
