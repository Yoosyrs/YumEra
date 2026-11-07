import { ApiError, ok, requireUser, route } from '@/lib/api';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function spotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError(
      503,
      'Spotify is not connected yet. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET on the server to search and play Spotify tracks.',
    );
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new ApiError(502, 'Spotify rejected the credentials');
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

/** Spotify catalogue search (artists, tracks, albums) via client credentials. */
export const GET = route(async (req) => {
  await requireUser();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) throw new ApiError(400, 'Search for at least two characters');
  const token = await spotifyToken();
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track,artist&limit=12`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new ApiError(502, 'Spotify search failed');
  const data = (await response.json()) as {
    tracks?: { items?: Array<Record<string, unknown>> };
    artists?: { items?: Array<Record<string, unknown>> };
  };
  type SpotifyImage = { url: string };
  type SpotifyArtist = { id: string; name: string; images?: SpotifyImage[]; external_urls?: { spotify?: string } };
  const tracks = (data.tracks?.items ?? []).map((raw) => {
    const track = raw as {
      id: string;
      name: string;
      preview_url: string | null;
      external_urls?: { spotify?: string };
      artists?: SpotifyArtist[];
      album?: { images?: SpotifyImage[] };
    };
    return {
      id: track.id,
      name: track.name,
      artists: (track.artists ?? []).map((a) => a.name).join(', '),
      image: track.album?.images?.[0]?.url ?? null,
      previewUrl: track.preview_url,
      url: track.external_urls?.spotify ?? null,
    };
  });
  const artists = (data.artists?.items ?? []).map((raw) => {
    const artist = raw as SpotifyArtist;
    return { id: artist.id, name: artist.name, image: artist.images?.[0]?.url ?? null, url: artist.external_urls?.spotify ?? null };
  });
  return ok({ query: q, tracks, artists });
});
