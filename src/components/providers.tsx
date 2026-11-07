'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Locale, LOCALES, translate } from '@/lib/i18n';

/* ----------------------------- i18n ----------------------------- */

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'es',
  setLocale: () => {},
  t: (key) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

/* ----------------------------- toasts ---------------------------- */

interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

const ToastContext = createContext<{ push: (message: string, kind?: 'info' | 'error') => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

/* ----------------------------- music player ---------------------- */

export interface PlayingTrack {
  /** Renders the audio lazily (YumEra Originals are synthesised in the browser). */
  ensureAudio?: () => string;
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  cover?: string;
}

interface PlayerContextValue {
  track: PlayingTrack | null;
  queue: PlayingTrack[];
  playing: boolean;
  play: (track: PlayingTrack, queue?: PlayingTrack[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
}

const PlayerContext = createContext<PlayerContextValue>({
  track: null,
  queue: [],
  playing: false,
  play: () => {},
  toggle: () => {},
  next: () => {},
  prev: () => {},
});

export function usePlayer() {
  return useContext(PlayerContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('es');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [track, setTrack] = useState<PlayingTrack | null>(null);
  const [queue, setQueue] = useState<PlayingTrack[]>([]);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const stored = document.cookie.match(/(?:^|; )yumera_locale=([^;]*)/)?.[1];
    const initial = (stored || navigator.language.slice(0, 2)) as Locale;
    if ((LOCALES as readonly string[]).includes(initial)) setLocaleState(initial);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = `yumera_locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    document.documentElement.lang = next;
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  const push = useCallback((message: string, kind: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4200);
  }, []);

  const play = useCallback((next: PlayingTrack, nextQueue?: PlayingTrack[]) => {
    setTrack(next);
    if (nextQueue) setQueue(nextQueue);
    setPlaying(true);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!track || queue.length === 0) return;
      const index = queue.findIndex((item) => item.id === track.id);
      const nextIndex = (index + direction + queue.length) % queue.length;
      setTrack(queue[nextIndex]);
      setPlaying(true);
    },
    [track, queue],
  );

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    let source = track.audioUrl;
    if (!source && track.ensureAudio) {
      try {
        source = track.ensureAudio();
      } catch {
        source = '';
      }
    }
    if (!source) {
      setPlaying(false);
      return;
    }
    if (audio.src !== new URL(source, window.location.href).href) {
      audio.src = source;
    }
    if (playing) void audio.play().catch(() => setPlaying(false));
  }, [track, playing]);

  const playerValue = useMemo(
    () => ({ track, queue, playing, play, toggle, next, prev }),
    [track, queue, playing, play, toggle, next, prev],
  );

  const i18nValue = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  const toastValue = useMemo(() => ({ push }), [push]);

  return (
    <I18nContext.Provider value={i18nValue}>
      <ToastContext.Provider value={toastValue}>
        <PlayerContext.Provider value={playerValue}>
          {children}
          <div className="toast-wrap" aria-live="polite">
            {toasts.map((toast) => (
              <div key={toast.id} className={`toast ${toast.kind === 'error' ? 'error' : ''}`}>
                {toast.message}
              </div>
            ))}
          </div>
          {track && (
            <div className="player-bar">
              <div style={{ minWidth: 0, flex: '0 1 220px' }}>
                <div className="track-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {track.title}
                </div>
                <div className="tiny muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {track.artist}
                </div>
              </div>
              <button className="btn btn-icon btn-sm" onClick={prev} aria-label="Previous track">⏮</button>
              <button className="btn btn-icon btn-sm btn-primary" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? '⏸' : '▶'}
              </button>
              <button className="btn btn-icon btn-sm" onClick={next} aria-label="Next track">⏭</button>
              <audio
                ref={audioRef}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={next}
                onError={() => setPlaying(false)}
                preload="metadata"
                style={{ flex: 1, minWidth: 120 }}
              />
            </div>
          )}
        </PlayerContext.Provider>
      </ToastContext.Provider>
    </I18nContext.Provider>
  );
}
