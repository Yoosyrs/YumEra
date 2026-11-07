import { ok, requireUser, route } from '@/lib/api';
import { all } from '@/lib/db';

/**
 * Discovery search across every public surface.
 * Private resources are never returned here: only public visibility rows.
 */
export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const type = url.searchParams.get('type') ?? 'all';
  const like = `%${q}%`;
  const wants = (kind: string) => type === 'all' || type === kind;

  const empty = { users: [], posts: [], yumesonas: [], fos: [], stories: [], communities: [], galleries: [], lore: [] };
  if (q.length < 2) return ok({ query: q, ...empty });

  const users = wants('users')
    ? all(
        `SELECT username, display_name, avatar_url, bio FROM users
         WHERE (username LIKE ? OR display_name LIKE ? OR bio LIKE ?)
           AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = users.id) OR (b.blocker_id = users.id AND b.blocked_id = ?))
         LIMIT 20`,
        like,
        like,
        like,
        user.id,
        user.id,
      )
    : [];

  const posts = wants('posts')
    ? all(
        `SELECT p.id, p.content, p.media_url, p.created_at, u.username, u.display_name, u.avatar_url
         FROM posts p JOIN users u ON u.id = p.user_id
         WHERE p.content LIKE ? AND p.visibility = 'public' AND u.is_private = 0
         ORDER BY p.created_at DESC LIMIT 20`,
        like,
      )
    : [];

  const yumesonas = wants('yumesonas')
    ? all(
        `SELECT y.id, y.name, y.tagline, y.image_url, y.universe, u.username, u.display_name
         FROM yumesonas y JOIN users u ON u.id = y.user_id
         WHERE y.visibility = 'public' AND (y.name LIKE ? OR y.universe LIKE ? OR y.description LIKE ? OR y.tagline LIKE ?)
         ORDER BY y.created_at DESC LIMIT 20`,
        like,
        like,
        like,
        like,
      )
    : [];

  const fos = wants('fos')
    ? all(
        `SELECT f.id, f.name, f.source_work, f.relationship_type, f.portrait_url, u.username, u.display_name
         FROM fo_characters f JOIN users u ON u.id = f.user_id
         WHERE f.visibility = 'public' AND (f.name LIKE ? OR f.source_work LIKE ? OR f.description LIKE ?)
         ORDER BY f.created_at DESC LIMIT 20`,
        like,
        like,
        like,
      )
    : [];

  const stories = wants('stories')
    ? all(
        `SELECT s.id, s.title, s.description, s.cover_url, s.tags, u.username, u.display_name
         FROM stories s JOIN users u ON u.id = s.user_id
         WHERE s.visibility = 'public' AND s.status = 'published'
           AND (s.title LIKE ? OR s.description LIKE ? OR s.tags LIKE ?)
         ORDER BY s.updated_at DESC LIMIT 20`,
        like,
        like,
        like,
      )
    : [];

  const communities = wants('communities')
    ? all(
        `SELECT c.id, c.slug, c.name, c.description, c.cover_url, c.visibility
         FROM communities c
         WHERE c.visibility = 'public' AND (c.name LIKE ? OR c.description LIKE ?)
         LIMIT 20`,
        like,
        like,
      )
    : [];

  const galleries = wants('galleries')
    ? all(
        `SELECT g.id, g.title, g.description, g.cover_url, u.username, u.display_name
         FROM galleries g JOIN users u ON u.id = g.user_id
         WHERE g.visibility = 'public' AND (g.title LIKE ? OR g.description LIKE ?)
         LIMIT 20`,
        like,
        like,
      )
    : [];

  const lore = wants('lore')
    ? all(
        `SELECT l.id, l.title, l.category, l.tags, u.username FROM lore_entries l JOIN users u ON u.id = l.user_id
         WHERE l.visibility = 'public' AND (l.title LIKE ? OR l.body LIKE ? OR l.tags LIKE ?)
         LIMIT 20`,
        like,
        like,
        like,
      )
    : [];

  return ok({ query: q, users, posts, yumesonas, fos, stories, communities, galleries, lore });
});
