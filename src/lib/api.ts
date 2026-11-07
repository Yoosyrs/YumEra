import { NextResponse } from 'next/server';
import { getSessionUser, SessionUser } from './auth';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as object, { status });
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    return (body ?? {}) as T;
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, 'Authentication required');
  return user;
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export function route(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof ApiError) return fail(error.status, error.message);
      console.error('[api]', req.method, req.url, error);
      return fail(500, 'Unexpected server error');
    }
  };
}

export function str(value: unknown, field: string, { min = 1, max = 5000 } = {}): string {
  if (typeof value !== 'string') throw new ApiError(400, `${field} is required`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw new ApiError(400, `${field} must be at least ${min} characters`);
  if (trimmed.length > max) throw new ApiError(400, `${field} must be at most ${max} characters`);
  return trimmed;
}

export function optionalStr(value: unknown, max = 5000): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function pageParams(url: string, defaultLimit = 20) {
  const params = new URL(url).searchParams;
  const limit = Math.min(Math.max(Number(params.get('limit') ?? defaultLimit) || defaultLimit, 1), 50);
  const offset = Math.max(Number(params.get('offset') ?? 0) || 0, 0);
  return { limit, offset, params };
}

export function jsonArray(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.slice(0, 200));
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return JSON.stringify(parsed.slice(0, 200));
    } catch {
      /* ignore */
    }
  }
  return '[]';
}
