import { ApiError, ok, optionalStr, oneOf, readJson, requireUser, route } from '@/lib/api';
import { all, get, now, run, uid } from '@/lib/db';

async function loadGallery(galleryId: string, viewerId: string) {
  const gallery = get<{ id: string; user_id: string; visibility: string }>(
    'SELECT id, user_id, visibility FROM galleries WHERE id = ?',
    galleryId,
  );
  if (!gallery) throw new ApiError(404, 'Gallery not found');
  const isOwner = gallery.user_id === viewerId;
  if (!isOwner && gallery.visibility !== 'public') throw new ApiError(403, 'This gallery is private');
  return { gallery, isOwner };
}

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await loadGallery(id, user.id);
  const items = all(
    'SELECT id, media_url, media_type, caption, created_at FROM gallery_items WHERE gallery_id = ? ORDER BY created_at DESC',
    id,
  );
  return ok({ items });
});

export const POST = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { isOwner } = await loadGallery(id, user.id);
  if (!isOwner) throw new ApiError(403, 'Only the owner can add to this gallery');
  const body = await readJson<{ mediaUrl?: string; mediaType?: string; caption?: string }>(req);
  if (typeof body.mediaUrl !== 'string' || !body.mediaUrl.trim()) throw new ApiError(400, 'mediaUrl is required');
  const mediaUrl = body.mediaUrl.trim().slice(0, 500);
  if (!/^(\/api\/files\/|https?:\/\/)/.test(mediaUrl)) throw new ApiError(400, 'Unsupported media location');
  const itemId = uid();
  run(
    'INSERT INTO gallery_items (id, gallery_id, user_id, media_url, media_type, caption, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    itemId,
    id,
    user.id,
    mediaUrl,
    oneOf(body.mediaType, ['image', 'video'] as const, 'image'),
    optionalStr(body.caption, 400),
    now(),
  );
  run('UPDATE galleries SET cover_url = COALESCE(cover_url, ?) WHERE id = ?', mediaUrl, id);
  return ok({ item: get('SELECT * FROM gallery_items WHERE id = ?', itemId) }, 201);
});

export const DELETE = route(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { isOwner } = await loadGallery(id, user.id);
  if (!isOwner) throw new ApiError(403, 'Only the owner can remove items');
  const itemId = new URL(req.url).searchParams.get('itemId');
  if (!itemId) throw new ApiError(400, 'itemId is required');
  run('DELETE FROM gallery_items WHERE id = ? AND gallery_id = ?', itemId, id);
  return ok({ deleted: true });
});
