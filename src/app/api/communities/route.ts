import { ApiError, ok, optionalStr, oneOf, readJson, requireUser, route, str } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'community';
}

export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') ?? 'all';
  const q = (url.searchParams.get('q') ?? '').trim();

  const rows = all<{
    id: string;
    slug: string;
    name: string;
    description: string;
    rules: string;
    visibility: string;
    cover_url: string | null;
    owner_id: string;
    created_at: string;
    member_count: number;
    my_status: string | null;
    my_role: string | null;
  }>(
    `SELECT c.*,
       (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id AND m.status = 'active') AS member_count,
       (SELECT status FROM community_members m WHERE m.community_id = c.id AND m.user_id = ?) AS my_status,
       (SELECT role FROM community_members m WHERE m.community_id = c.id AND m.user_id = ?) AS my_role
     FROM communities c
     WHERE (c.visibility = 'public' OR c.owner_id = ? OR EXISTS (SELECT 1 FROM community_members m WHERE m.community_id = c.id AND m.user_id = ?))
       ${q ? 'AND (c.name LIKE ? OR c.description LIKE ?)' : ''}
     ORDER BY member_count DESC, c.created_at DESC LIMIT 60`,
    user.id,
    user.id,
    user.id,
    user.id,
    ...(q ? [`%${q}%`, `%${q}%`] : []),
  );

  const items = rows.filter((row) => (scope === 'mine' ? Boolean(row.my_status) : true));
  return ok({ items, mine: rows.filter((row) => Boolean(row.my_status)).length });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ name?: string; description?: string; rules?: string; visibility?: string }>(req);
  const name = str(body.name, 'name', { max: 80 });
  const base = slugify(name);
  let slug = base;
  let attempt = 0;
  while (get('SELECT id FROM communities WHERE slug = ?', slug)) {
    attempt += 1;
    slug = `${base}-${attempt}`;
    if (attempt > 50) throw new ApiError(409, 'Could not allocate a community address');
  }
  const id = uid();
  run(
    `INSERT INTO communities (id, owner_id, slug, name, description, rules, visibility, cover_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    id,
    user.id,
    slug,
    name,
    optionalStr(body.description, 1200),
    optionalStr(body.rules, 4000),
    oneOf(body.visibility, ['public', 'private'] as const, 'public'),
    now(),
  );
  run(
    `INSERT INTO community_members (id, community_id, user_id, role, status, joined_at) VALUES (?, ?, ?, 'admin', 'active', ?)`,
    uid(),
    id,
    user.id,
    now(),
  );
  return ok({ community: get('SELECT * FROM communities WHERE id = ?', id) }, 201);
});
