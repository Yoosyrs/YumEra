import { ApiError, ok, requireUser, route } from '@/lib/api';
import { saveUpload } from '@/lib/upload';

export const POST = route(async (req) => {
  await requireUser();
  const form = await req.formData().catch(() => null);
  if (!form) throw new ApiError(400, 'Expected multipart form data.');
  const file = form.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'No file received.');
  const saved = await saveUpload(file);
  return ok({ url: saved.url, mime: saved.mime, name: saved.name, size: saved.size }, 201);
});
