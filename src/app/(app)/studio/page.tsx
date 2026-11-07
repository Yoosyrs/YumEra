'use client';

import Link from 'next/link';
import { STYLES } from '@/lib/portrait';
import { MUSIC_TRACKS } from '@/lib/music';

const STUDIOS = [
  {
    href: '/studio/portrait',
    title: 'YumEra Portrait Studio',
    badge: 'V4',
    blurb:
      'Layered portrait composition with eight distinct visual systems, photo tools, couple and group modes, animated GIF export. No generative AI.',
    glyph: '🖼',
    accent: '#e7c9ff',
  },
  {
    href: '/studio/music',
    title: 'Music Studio',
    badge: 'Originals',
    blurb:
      'Listen to the YumEra Originals catalogue, build AI-assisted playlists, search Spotify, and design your own notification tones.',
    glyph: '♪',
    accent: '#ffd9ec',
  },
  {
    href: '/studio/video',
    title: 'Video Studio',
    badge: 'Editor',
    blurb:
      'Assemble photos, clips, captions and transitions into a portrait film, preview it live and export a WebM file.',
    glyph: '🎬',
    accent: '#f2d7a0',
  },
];

export default function StudioHubPage() {
  return (
    <div className="page stack">
      <header className="stack" style={{ gap: 6 }}>
        <p className="tiny muted">YUMERA · CREATIVE SUITE</p>
        <h1 className="h1">Studios</h1>
        <p className="muted" style={{ maxWidth: 680 }}>
          Three connected workshops. Everything you make here can become a profile picture, a feed post, a gallery piece
          or a memory.
        </p>
      </header>

      <div className="grid-auto">
        {STUDIOS.map((studio) => (
          <Link key={studio.href} href={studio.href} className="card stack studio-hub-card">
            <span className="studio-hub-glyph" style={{ color: studio.accent }}>{studio.glyph}</span>
            <div className="row between">
              <h2 className="h3">{studio.title}</h2>
              <span className="badge">{studio.badge}</span>
            </div>
            <p className="tiny muted">{studio.blurb}</p>
            <span className="link tiny">Open studio →</span>
          </Link>
        ))}
      </div>

      <section className="card stack">
        <h2 className="h2">Portrait styles available</h2>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {STYLES.map((style) => (
            <span key={style.key} className="chip" style={{ borderColor: `${style.palette.accent}55`, color: style.palette.accent }}>
              {style.label}
            </span>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          {MUSIC_TRACKS.length} original songs are also waiting in the Music Studio.
        </p>
      </section>
    </div>
  );
}
