import {
  ApiError,
  bool,
  jsonArray,
  ok,
  optionalStr,
  pageParams,
  readJson,
  requireUser,
  route,
  str,
} from './api';
import { all, get, now, run, uid } from './db';

export interface CollectionConfig {
  /** SQL table name (whitelisted by the server code, never by the client). */
  table: string;
  /** Column holding the owning user id. */
  owner: string;
  /** Writable columns. Anything not listed here is ignored. */
  fields: string[];
  /** Fields that must be present and non-empty on create. */
  required?: string[];
  /** Fields stored as JSON arrays. */
  json?: string[];
  /** Column holding 'public' | 'private' visibility, if the table has one. */
  visibilityColumn?: string;
  /** Columns used by the `q` search parameter. */
  search?: string[];
  /** Query params that act as equality filters. */
  filterable?: string[];
  /** Default ORDER BY clause. */
  order?: string;
  /** Table has an updated_at column. */
  updatedAt?: boolean;
  /** Table has a created_at column (default true). */
  createdAt?: boolean;
  /** Read access limited to the owner (private resources). */
  ownerOnly?: boolean;
  /** Extra select expression, e.g. joins. */
  select?: string;
  limitDefault?: number;
  /** Optional hook to run side effects after creation. */
  afterCreate?: (row: Record<string, unknown>, userId: string) => void | Promise<void>;
}

function buildSelect(cfg: CollectionConfig): string {
  return cfg.select ?? '*';
}

function writeRow(body: Record<string, unknown>, cfg: CollectionConfig, userId: string, forCreate: boolean) {
  const values: Record<string, unknown> = {};
  for (const field of cfg.fields) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (cfg.json?.includes(field)) {
      values[field] = jsonArray(raw);
      continue;
    }
    if (typeof raw === 'boolean') {
      values[field] = raw ? 1 : 0;
      continue;
    }
    if (typeof raw === 'number') {
      values[field] = raw;
      continue;
    }
    values[field] = optionalStr(raw, 20000);
  }
  if (forCreate) {
    for (const field of cfg.required ?? []) {
      if (typeof body[field] !== 'string' || !String(body[field]).trim()) {
        throw new ApiError(400, `${field} is required`);
      }
    }
  }
  return values;
}

export function makeCollection(cfg: CollectionConfig) {
  const GET = route(async (req) => {
    const user = await requireUser();
    const url = new URL(req.url);
    const { limit, offset, params } = pageParams(url, cfg.limitDefault ?? 24);
    const mine = params.get('mine') === '1';

    const where: string[] = [];
    const args: unknown[] = [];

    if (cfg.ownerOnly || mine) {
      where.push(`${cfg.owner} = ?`);
      args.push(user.id);
    } else if (cfg.visibilityColumn) {
      where.push(`(${cfg.owner} = ? OR ${cfg.visibilityColumn} = 'public')`);
      args.push(user.id);
    } else {
      where.push(`${cfg.owner} = ?`);
      args.push(user.id);
    }

    for (const filter of cfg.filterable ?? []) {
      const value = params.get(filter);
      if (value) {
        where.push(`${filter} = ?`);
        args.push(value);
      }
    }

    const q = params.get('q')?.trim();
    if (q && cfg.search?.length) {
      where.push(`(${cfg.search.map((column) => `${column} LIKE ?`).join(' OR ')})`);
      for (const _ of cfg.search) args.push(`%${q}%`);
    }

    const sql = `SELECT ${buildSelect(cfg)} FROM ${cfg.table} WHERE ${where.join(' AND ')} ORDER BY ${cfg.order ?? 'created_at DESC'} LIMIT ? OFFSET ?`;
    const rows = all(sql, ...args, limit, offset);
    const total = get<{ count: number }>(`SELECT COUNT(*) AS count FROM ${cfg.table} WHERE ${where.join(' AND ')}`, ...args);
    return ok({ items: rows, total: total?.count ?? rows.length, limit, offset });
  });

  const POST = route(async (req) => {
    const user = await requireUser();
    const body = await readJson(req);
    const values = writeRow(body, cfg, user.id, true);
    const id = uid();
    const createdAt = now();
    values.id = id;
    values[cfg.owner] = user.id;
    if (cfg.createdAt !== false) values.created_at = createdAt;
    if (cfg.updatedAt) values.updated_at = createdAt;

    const columns = Object.keys(values);
    const sql = `INSERT INTO ${cfg.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
    run(sql, ...columns.map((column) => values[column]));
    const row = get<Record<string, unknown>>(`SELECT ${buildSelect(cfg)} FROM ${cfg.table} WHERE id = ?`, id);
    if (row && cfg.afterCreate) await cfg.afterCreate(row, user.id);
    return ok({ item: row }, 201);
  });

  return { GET, POST };
}

export function makeItem(cfg: CollectionConfig & { name?: string }) {
  const label = cfg.name ?? 'resource';

  async function loadOwned(id: string, userId: string) {
    const row = get<Record<string, unknown>>(`SELECT * FROM ${cfg.table} WHERE id = ?`, id);
    if (!row) throw new ApiError(404, `${label} not found`);
    if (row[cfg.owner] !== userId) throw new ApiError(403, `You cannot access this ${label}`);
    return row;
  }

  const GET = route(async (_req, ctx) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const row = get<Record<string, unknown>>(`SELECT ${buildSelect(cfg)} FROM ${cfg.table} WHERE id = ?`, id);
    if (!row) throw new ApiError(404, `${label} not found`);
    const isOwner = row[cfg.owner] === userIdOf(row, cfg);
    if (!isOwner) {
      if (cfg.ownerOnly) throw new ApiError(403, `You cannot access this ${label}`);
      if (cfg.visibilityColumn && row[cfg.visibilityColumn] !== 'public') {
        throw new ApiError(403, `This ${label} is private`);
      }
    }
    void user;
    return ok({ item: row });
  });

  const PATCH = route(async (req, ctx) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    await loadOwned(id, user.id);
    const body = await readJson(req);
    const values = writeRow(body, cfg, user.id, false);
    if (cfg.updatedAt) values.updated_at = now();
    const columns = Object.keys(values);
    if (columns.length === 0) throw new ApiError(400, 'Nothing to update');
    run(
      `UPDATE ${cfg.table} SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ? AND ${cfg.owner} = ?`,
      ...columns.map((column) => values[column]),
      id,
      user.id,
    );
    const row = get<Record<string, unknown>>(`SELECT ${buildSelect(cfg)} FROM ${cfg.table} WHERE id = ?`, id);
    return ok({ item: row });
  });

  const DELETE = route(async (_req, ctx) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    await loadOwned(id, user.id);
    run(`DELETE FROM ${cfg.table} WHERE id = ? AND ${cfg.owner} = ?`, id, user.id);
    return ok({ deleted: true });
  });

  return { GET, PATCH, DELETE };
}

function userIdOf(row: Record<string, unknown>, cfg: CollectionConfig): unknown {
  return row[cfg.owner];
}

/** Shared visibility helper used by feed/profile queries. */
export function canSee(userId: string, ownerId: string, visibility: unknown, isPrivateAccount: unknown): boolean {
  if (userId === ownerId) return true;
  if (Number(isPrivateAccount) === 1) return false;
  return visibility === 'public';
}

export { str, bool };
