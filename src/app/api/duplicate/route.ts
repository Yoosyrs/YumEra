import { ApiError, ok, readJson, requireUser, route, str } from '@/lib/api';
import { get, now, run, uid } from '@/lib/db';
import { COLLECTIONS, DUPLICABLE } from '@/lib/collections';

/** Duplicates a user-owned resource into a fresh private copy. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<{ resource?: string; id?: string }>(req);
  const key = DUPLICABLE[str(body.resource, 'resource', { max: 40 })];
  if (!key) throw new ApiError(400, 'That resource cannot be duplicated');
  const id = str(body.id, 'id', { max: 80 });
  const cfg = COLLECTIONS[key];
  const row = get<Record<string, unknown>>(`SELECT * FROM ${cfg.table} WHERE id = ? AND ${cfg.owner} = ?`, id, user.id);
  if (!row) throw new ApiError(404, 'Resource not found');

  const copy: Record<string, unknown> = { ...row };
  const newId = uid();
  copy.id = newId;
  copy[cfg.owner] = user.id;
  copy.created_at = now();
  if ('updated_at' in copy) copy.updated_at = now();
  const titleField = 'title' in copy ? 'title' : 'name';
  if (typeof copy[titleField] === 'string') {
    copy[titleField] = `${copy[titleField]} (copy)`.slice(0, 160);
  }
  if (cfg.visibilityColumn) copy[cfg.visibilityColumn] = 'private';

  const columns = Object.keys(copy);
  run(
    `INSERT INTO ${cfg.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    ...columns.map((column) => copy[column]),
  );
  return ok({ id: newId, item: get(`SELECT * FROM ${cfg.table} WHERE id = ?`, newId) }, 201);
});
