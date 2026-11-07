import { readUpload } from '@/lib/upload';

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const file = await readUpload(name);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(file.buffer), {
    headers: {
      'Content-Type': file.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
