import { ApiError, ok, requireUser, route } from '@/lib/api';
import { all, get } from '@/lib/db';
import { isBlocked } from '@/lib/auth';

export const GET = route(async (_req, ctx) => {
  const viewer = await requireUser();
  const { username } = await ctx.params;
  const profile = get<{
    id: string;
    username: string;
    display_name: string;
    bio: string;
    pronouns: string;
    avatar_url: string | null;
    cover_url: string | null;
    soul_color: string;
    is_private: number;
    created_at: string;
  }>(
    `SELECT id, username, display_name, bio, pronouns, avatar_url, cover_url, soul_color, is_private, created_at
     FROM users WHERE username = ?`,
    String(username).toLowerCase(),
  );
  if (!profile) throw new ApiError(404, 'Profile not found');
  if (isBlocked(viewer.id, profile.id)) throw new ApiError(403, 'This profile is unavailable.');

  const isSelf = profile.id === viewer.id;
  const counts = get<{ posts: number; followers: number; following: number }>(
    `SELECT (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS posts,
            (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
    profile.id,
    profile.id,
    profile.id,
  );
  const isFollowing = Boolean(
    get('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', viewer.id, profile.id),
  );
  const friendState = get<{ status: string; from_id: string }>(
    'SELECT status, from_id FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)',
    viewer.id,
    profile.id,
    profile.id,
    viewer.id,
  );
  const blocked = Boolean(get('SELECT id FROM blocks WHERE blocker_id = ? AND blocked_id = ?', viewer.id, profile.id));

  const gated = !isSelf && profile.is_private === 1 && !isFollowing;
  const visible = (visibility: string) => isSelf || (!gated && visibility === 'public');

  const posts = visible('public')
    ? all(
        `SELECT p.id, p.content, p.media_url, p.media_type, p.created_at,
           (SELECT COUNT(*) FROM reactions r WHERE r.target_type = 'post' AND r.target_id = p.id) AS reaction_count,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
         FROM posts p WHERE p.user_id = ? AND (p.visibility = 'public' OR p.user_id = ?)
         ORDER BY p.created_at DESC LIMIT 30`,
        profile.id,
        viewer.id,
      )
    : [];

  const yumesonas = gated
    ? []
    : all(
        `SELECT id, name, tagline, image_url, universe, visibility FROM yumesonas
         WHERE user_id = ? AND (visibility = 'public' OR user_id = ?) ORDER BY created_at DESC LIMIT 50`,
        profile.id,
        viewer.id,
      );

  const fos = gated
    ? []
    : all(
        `SELECT id, name, source_work, relationship_type, portrait_url, anti_double, visibility FROM fo_characters
         WHERE user_id = ? AND (visibility = 'public' OR user_id = ?) ORDER BY created_at DESC LIMIT 50`,
        profile.id,
        viewer.id,
      );

  const stories = gated
    ? []
    : all(
        `SELECT id, title, cover_url, description, status, visibility FROM stories
         WHERE user_id = ? AND (user_id = ? OR (visibility = 'public' AND status = 'published'))
         ORDER BY updated_at DESC LIMIT 20`,
        profile.id,
        viewer.id,
      );

  return ok({
    profile,
    counts,
    isFollowing,
    isSelf,
    friendState: friendState ?? null,
    blocked,
    gated,
    posts,
    yumesonas,
    fos,
    stories,
  });
});
