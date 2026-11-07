'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { Alert, Empty, Field, Spinner } from '@/components/ui';
import { usePlayer, useToast, type PlayingTrack } from '@/components/providers';
import { MOODS, MUSIC_TRACKS, findTrack, type MusicMood, type MusicTrack } from '@/lib/music';
import { signatureToneUrl, toneUrlFromParams, trackAudioUrl } from '@/lib/audio';

interface PlaylistRow {
  id: string;
  title: string;
  description: string | null;
  is_public: number;
  generated_by: string | null;
  created_at: string;
}

interface Tone {
  id: string;
  name: string;
  baseFreq: number;
  waveform: string;
  decay: number;
  sparkle: number;
}

interface SpotifyTrack {
  id?: string;
  name?: string;
  title?: string;
  artist?: string;
  artists?: string;
  url?: string;
  externalUrl?: string;
  album?: string;
  previewUrl?: string | null;
}

const TABS = [
  { id: 'catalogue', label: 'Originals' },
  { id: 'ai', label: 'AI playlist' },
  { id: 'playlists', label: 'My playlists' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'tones', label: 'Tones' },
] as const;

const LANGUAGES = ['es', 'en', 'fr', 'ja'] as const;

export default function MusicStudioPage() {
  const player = usePlayer();
  const toast = useToast();

  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('catalogue');
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState<MusicMood | 'all'>('all');
  const [language, setLanguage] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  const [prompt, setPrompt] = useState('Songs for a gothic winter night with a fictional lover');
  const [aiTracks, setAiTracks] = useState<MusicTrack[]>([]);
  const [aiNote, setAiNote] = useState('');
  const [aiSource, setAiSource] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);

  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [openPlaylist, setOpenPlaylist] = useState<{ item: PlaylistRow; tracks: MusicTrack[] } | null>(null);

  const [spotifyQuery, setSpotifyQuery] = useState('');
  const [spotifyTracks, setSpotifyTracks] = useState<SpotifyTrack[]>([]);
  const [spotifyBusy, setSpotifyBusy] = useState(false);
  const [spotifyNote, setSpotifyNote] = useState('');

  const [tones, setTones] = useState<Tone[]>([]);
  const [toneDraft, setToneDraft] = useState({ name: 'Midnight glass', baseFreq: 1046, waveform: 'glass', decay: 1.8, sparkle: 3 });
  const toneAudio = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [favData, playlistData, toneData] = await Promise.all([
        api<{ favorites: string[] }>('/api/music/favorites'),
        api<{ playlists: PlaylistRow[]; aiConfigured: boolean }>('/api/music/ai-playlist'),
        api<{ tones: Tone[] }>('/api/tones'),
      ]);
      setFavorites(favData.favorites ?? []);
      setPlaylists(playlistData.playlists ?? []);
      setAiConfigured(Boolean(playlistData.aiConfigured));
      setTones(toneData.tones ?? []);
    } catch {
      /* the studio still works without the personal data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toPlaying = (track: MusicTrack): PlayingTrack => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    audioUrl: '',
    ensureAudio: () => trackAudioUrl(track),
  });

  const playList = (list: MusicTrack[], startId?: string) => {
    if (list.length === 0) return;
    const first = list.find((track) => track.id === startId) ?? list[0];
    toast.push('Preparing original audio…');
    player.play(toPlaying(first), list.map(toPlaying));
  };

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return MUSIC_TRACKS.filter((track) => {
      if (mood !== 'all' && track.mood !== mood) return false;
      if (language !== 'all' && track.language !== language) return false;
      if (!text) return true;
      return (
        track.title.toLowerCase().includes(text) ||
        track.artist.toLowerCase().includes(text) ||
        track.tags.some((tag) => tag.toLowerCase().includes(text))
      );
    });
  }, [query, mood, language]);

  const nowPlaying = player.track ? findTrack(player.track.id) : null;

  const toggleFavorite = async (trackId: string) => {
    try {
      const data = await api<{ favorited: boolean }>('/api/music/favorites', { body: { trackId } });
      setFavorites((current) =>
        data.favorited ? [...new Set([...current, trackId])] : current.filter((id) => id !== trackId),
      );
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not update favourites', 'error');
    }
  };

  const generatePlaylist = async (save: boolean) => {
    if (!prompt.trim()) return;
    setAiBusy(true);
    try {
      const data = await api<{ tracks: MusicTrack[]; note: string; source: string; title?: string }>(
        '/api/music/ai-playlist',
        { body: { prompt, save } },
      );
      setAiTracks(data.tracks ?? []);
      setAiNote(data.note ?? '');
      setAiSource(data.source);
      if (save) {
        toast.push('Playlist saved', 'info');
        await load();
      }
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not build playlist', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const openPlaylistDetail = async (id: string) => {
    try {
      const data = await api<{ item: PlaylistRow; tracks: MusicTrack[] }>(`/api/playlists/${id}`);
      setOpenPlaylist({ item: data.item, tracks: data.tracks ?? [] });
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not open playlist', 'error');
    }
  };

  const deletePlaylist = async (id: string) => {
    try {
      await api(`/api/playlists/${id}`, { method: 'DELETE' });
      setOpenPlaylist(null);
      await load();
      toast.push('Playlist deleted', 'info');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not delete playlist', 'error');
    }
  };

  const searchSpotify = async () => {
    if (!spotifyQuery.trim()) return;
    setSpotifyBusy(true);
    try {
      const data = await api<{ tracks: SpotifyTrack[]; note?: string }>(`/api/spotify?q=${encodeURIComponent(spotifyQuery)}`);
      setSpotifyTracks(data.tracks ?? []);
      setSpotifyNote(data.note ?? '');
    } catch (error) {
      setSpotifyTracks([]);
      setSpotifyNote(error instanceof Error ? error.message : 'Spotify search failed');
    } finally {
      setSpotifyBusy(false);
    }
  };

  const previewTone = (url: string) => {
    toneAudio.current ??= new Audio();
    toneAudio.current.src = url;
    toneAudio.current.currentTime = 0;
    void toneAudio.current.play().catch(() => toast.push('The browser blocked audio playback', 'error'));
  };

  const createTone = async () => {
    try {
      const data = await api<{ tone: Tone }>('/api/tones', { body: toneDraft });
      setTones((current) => [...current, data.tone]);
      toast.push('Tone saved', 'info');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not save tone', 'error');
    }
  };

  const deleteTone = async (id: string) => {
    try {
      await api(`/api/tones?id=${id}`, { method: 'DELETE' });
      setTones((current) => current.filter((tone) => tone.id !== id));
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not delete tone', 'error');
    }
  };

  if (loading) return <div className="page"><Spinner /></div>;

  return (
    <div className="page stack">
      <header className="stack" style={{ gap: 6 }}>
        <p className="tiny muted">YUMERA · MUSIC STUDIO</p>
        <h1 className="h1">Original songs, playlists & tones</h1>
        <p className="muted" style={{ maxWidth: 720 }}>
          Every track in the YumEra Originals catalogue is an original composition written for this platform, and the
          audio is synthesised in your browser from its harmonic data — nothing is streamed or hosted from third parties.
        </p>
      </header>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((entry) => (
          <button
            key={entry.id}
            className={`chip ${tab === entry.id ? 'is-active' : ''}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'catalogue' && (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input
              className="input input-sm"
              placeholder="Search title, artist or tag"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ minWidth: 220 }}
            />
            <select className="input input-sm" value={mood} onChange={(event) => setMood(event.target.value as MusicMood | 'all')}>
              <option value="all">All moods</option>
              {MOODS.map((entry) => (
                <option key={entry} value={entry}>{entry}</option>
              ))}
            </select>
            <select className="input input-sm" value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="all">All languages</option>
              {LANGUAGES.map((code) => (
                <option key={code} value={code}>{code.toUpperCase()}</option>
              ))}
            </select>
            <button className="btn btn-sm btn-primary" onClick={() => playList(filtered)}>Play all ({filtered.length})</button>
          </div>

          <div className="grid-auto">
            {filtered.map((track) => (
              <article key={track.id} className="card stack track-card">
                <div
                  className="track-cover"
                  style={{ background: `linear-gradient(150deg, ${track.palette[0]}, ${track.palette[1]})` }}
                >
                  <span style={{ color: track.palette[2] }}>♪</span>
                </div>
                <h3 className="h3">{track.title}</h3>
                <p className="tiny muted">{track.artist} · {track.language.toUpperCase()} · {track.mood} · {track.bpm} BPM</p>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => playList(filtered, track.id)}
                  >
                    ▶ Play
                  </button>
                  <button className="btn btn-sm" onClick={() => void toggleFavorite(track.id)}>
                    {favorites.includes(track.id) ? '♥ Saved' : '♡ Save'}
                  </button>
                </div>
                <details>
                  <summary className="tiny muted">Lyrics · {track.lyrics.length} sections</summary>
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    {track.lyrics.map((section) => (
                      <div key={section.label}>
                        <p className="tiny" style={{ color: track.palette[2], margin: 0 }}>{section.label}</p>
                        {section.lines.map((line, index) => (
                          <p key={`${section.label}-${index}`} className="tiny muted" style={{ margin: 0 }}>{line}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </div>
          {filtered.length === 0 && <Empty title="No songs match" hint="Try another mood or language." />}

          {nowPlaying && (
            <section className="card stack">
              <div className="row between">
                <h2 className="h2">Now playing · {nowPlaying.title}</h2>
                <button className="btn btn-sm" onClick={player.toggle}>{player.playing ? '⏸ Pause' : '▶ Resume'}</button>
              </div>
              <p className="tiny muted">{nowPlaying.artist} · {nowPlaying.duration}s · rendered locally</p>
              {nowPlaying.lyrics.map((section) => (
                <div key={section.label}>
                  <p className="tiny" style={{ color: nowPlaying.palette[2], margin: 0 }}>{section.label}</p>
                  {section.lines.map((line, index) => (
                    <p key={`${section.label}-np-${index}`} className="tiny muted" style={{ margin: 0 }}>{line}</p>
                  ))}
                </div>
              ))}
            </section>
          )}

          {favorites.length > 0 && (
            <section className="stack">
              <h2 className="h2">Favourites</h2>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {favorites.map((id) => {
                  const track = findTrack(id);
                  if (!track) return null;
                  return (
                    <button key={id} className="chip" onClick={() => playList([track])}>
                      ♥ {track.title}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {tab === 'ai' && (
        <section className="card stack">
          <h2 className="h2">Playlist composer</h2>
          <p className="tiny muted">
            {aiConfigured
              ? 'An AI provider is configured on the server, so the curator model picks tracks from the catalogue.'
              : 'No AI provider is configured, so YumEra curates by mood and keyword matching over the original catalogue and says so explicitly.'}
          </p>
          <Field label="Describe the playlist you want" hint="Mood, language, theme, characters, season…">
            <textarea
              className="input"
              rows={3}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </Field>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => void generatePlaylist(false)} disabled={aiBusy}>
              {aiBusy ? 'Curating…' : 'Generate playlist'}
            </button>
            <button className="btn" onClick={() => void generatePlaylist(true)} disabled={aiBusy || aiTracks.length === 0}>
              Save to my playlists
            </button>
            {aiTracks.length > 0 && (
              <button className="btn" onClick={() => playList(aiTracks)}>▶ Play result</button>
            )}
          </div>
          {aiSource && (
            <p className="tiny muted">
              Source: {aiSource === 'ai' ? 'AI curator' : 'keyword curation'}
              {aiNote ? ` — ${aiNote}` : ''}
            </p>
          )}
          <div className="stack" style={{ gap: 4 }}>
            {aiTracks.map((track) => (
              <div key={track.id} className="row between layer-row">
                <span className="tiny">{track.title} · {track.artist}</span>
                <button className="btn btn-sm btn-ghost" onClick={() => playList(aiTracks, track.id)}>▶</button>
              </div>
            ))}
            {aiTracks.length === 0 && <p className="tiny muted">No playlist generated yet.</p>}
          </div>
        </section>
      )}

      {tab === 'playlists' && (
        <section className="stack">
          <h2 className="h2">My playlists</h2>
          {playlists.length === 0 && <Empty title="No playlists yet" hint="Generate one in the AI playlist tab." />}
          <div className="grid-auto">
            {playlists.map((playlist) => (
              <article key={playlist.id} className="card stack">
                <h3 className="h3">{playlist.title}</h3>
                <p className="tiny muted">{playlist.description || 'No description'}</p>
                <p className="tiny muted">
                  {playlist.is_public ? 'Public' : 'Private'} · {playlist.generated_by === 'ai' ? 'AI curated' : 'Keyword curated'}
                </p>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => void openPlaylistDetail(playlist.id)}>Open</button>
                  <button className="btn btn-sm" onClick={() => void deletePlaylist(playlist.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>

          {openPlaylist && (
            <section className="card stack">
              <div className="row between">
                <h3 className="h3">{openPlaylist.item.title}</h3>
                <button className="btn btn-sm" onClick={() => setOpenPlaylist(null)}>Close</button>
              </div>
              {openPlaylist.tracks.length > 0 ? (
                <>
                  <button className="btn btn-sm btn-primary" onClick={() => playList(openPlaylist.tracks)}>▶ Play playlist</button>
                  <div className="stack" style={{ gap: 4 }}>
                    {openPlaylist.tracks.map((track) => (
                      <div key={track.id} className="row between layer-row">
                        <span className="tiny">{track.title} · {track.artist}</span>
                        <button className="btn btn-sm btn-ghost" onClick={() => playList(openPlaylist.tracks, track.id)}>▶</button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="tiny muted">This playlist has no tracks yet.</p>
              )}
            </section>
          )}
        </section>
      )}

      {tab === 'spotify' && (
        <section className="card stack">
          <h2 className="h2">Spotify search</h2>
          <p className="tiny muted">
            Search artists and songs through the server-side Spotify integration. Playback happens on Spotify, so nothing
            copyrighted is hosted here.
          </p>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <input
              className="input input-sm"
              placeholder="Artist or song"
              value={spotifyQuery}
              onChange={(event) => setSpotifyQuery(event.target.value)}
              style={{ minWidth: 220 }}
            />
            <button className="btn btn-sm btn-primary" onClick={() => void searchSpotify()} disabled={spotifyBusy}>
              {spotifyBusy ? 'Searching…' : 'Search'}
            </button>
          </div>
          {spotifyNote && <Alert kind="warn">{spotifyNote}</Alert>}
          <div className="stack" style={{ gap: 6 }}>
            {spotifyTracks.map((track, index) => (
              <div key={track.id ?? `${index}`} className="row between layer-row">
                <span className="tiny">
                  {track.name ?? track.title ?? 'Unknown'} · {track.artist ?? track.artists ?? 'Unknown artist'}
                  {track.album ? ` · ${track.album}` : ''}
                </span>
                {(track.url ?? track.externalUrl) && (
                  <a className="link tiny" href={track.url ?? track.externalUrl} target="_blank" rel="noreferrer">
                    Open in Spotify
                  </a>
                )}
              </div>
            ))}
            {spotifyTracks.length === 0 && !spotifyBusy && (
              <p className="tiny muted">Search to see results from the connected Spotify account.</p>
            )}
          </div>
        </section>
      )}

      {tab === 'tones' && (
        <section className="card stack">
          <h2 className="h2">Notification tones</h2>
          <p className="tiny muted">
            The YUMERA SIGNATURE TONE is an original crystalline bell, 1.7 seconds long. Custom tones are stored on your
            account and can be previewed here or in Notification Settings.
          </p>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-primary" onClick={() => previewTone(signatureToneUrl())}>
              ▶ Preview Signature Tone
            </button>
            <a className="btn btn-sm" href="/sounds/yumera-signature.wav" download>
              Download .wav
            </a>
          </div>

          <div className="grid-2" style={{ gap: 8 }}>
            <Field label="Name">
              <input
                className="input input-sm"
                value={toneDraft.name}
                maxLength={40}
                onChange={(event) => setToneDraft({ ...toneDraft, name: event.target.value })}
              />
            </Field>
            <Field label="Waveform">
              <select
                className="input input-sm"
                value={toneDraft.waveform}
                onChange={(event) => setToneDraft({ ...toneDraft, waveform: event.target.value })}
              >
                {['glass', 'bell', 'triangle', 'sine'].map((waveform) => (
                  <option key={waveform} value={waveform}>{waveform}</option>
                ))}
              </select>
            </Field>
            <Field label={`Base frequency · ${toneDraft.baseFreq} Hz`}>
              <input
                type="range"
                min={220}
                max={1800}
                step={10}
                value={toneDraft.baseFreq}
                onChange={(event) => setToneDraft({ ...toneDraft, baseFreq: Number(event.target.value) })}
              />
            </Field>
            <Field label={`Decay · ${toneDraft.decay.toFixed(1)}s`}>
              <input
                type="range"
                min={0.6}
                max={3}
                step={0.1}
                value={toneDraft.decay}
                onChange={(event) => setToneDraft({ ...toneDraft, decay: Number(event.target.value) })}
              />
            </Field>
            <Field label={`Sparkle · ${toneDraft.sparkle}`}>
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                value={toneDraft.sparkle}
                onChange={(event) => setToneDraft({ ...toneDraft, sparkle: Number(event.target.value) })}
              />
            </Field>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button
              className="btn btn-sm"
              onClick={() => previewTone(toneUrlFromParams(toneDraft.baseFreq, toneDraft.waveform, toneDraft.decay, toneDraft.sparkle))}
            >
              ▶ Preview draft
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => void createTone()}>Save tone</button>
          </div>

          <div className="stack" style={{ gap: 4 }}>
            {tones.map((tone) => (
              <div key={tone.id} className="row between layer-row">
                <span className="tiny">{tone.name} · {tone.waveform} · {tone.baseFreq} Hz</span>
                <div className="row" style={{ gap: 4 }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => previewTone(toneUrlFromParams(tone.baseFreq, tone.waveform, tone.decay, tone.sparkle))}
                  >
                    ▶
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => void deleteTone(tone.id)}>✕</button>
                </div>
              </div>
            ))}
            {tones.length === 0 && <p className="tiny muted">No custom tones yet.</p>}
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>
            Browsers and operating systems choose the sound of push notifications. A custom tone cannot always replace the
            system push sound; YumEra plays these tones for in-app notification previews.
          </p>
        </section>
      )}
    </div>
  );
}
