'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, uploadFile } from '@/lib/client';
import { Alert, Empty, Field, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';
import { MUSIC_TRACKS, findTrack } from '@/lib/music';
import { trackAudioUrl } from '@/lib/audio';

interface Scene {
  id: string;
  image: string;
  caption: string;
  duration: number;
  transition: 'fade' | 'slide' | 'zoom' | 'none';
}

interface Timeline {
  scenes: Scene[];
  trackId: string;
  aspect: 'portrait' | 'square' | 'landscape';
  title: string;
  subtitle: string;
}

interface VideoProject {
  id: string;
  title: string;
  template: string;
  duration: number;
  thumbnail: string | null;
  updated_at: string;
}

const ASPECTS: Record<Timeline['aspect'], { w: number; h: number; label: string }> = {
  portrait: { w: 720, h: 1280, label: 'Portrait 9:16' },
  square: { w: 900, h: 900, label: 'Square 1:1' },
  landscape: { w: 1280, h: 720, label: 'Landscape 16:9' },
};

const TEMPLATES = [
  { id: 'celestial', label: 'Celestial night', accent: '#f0d9a8' },
  { id: 'romantic', label: 'Romantic letter', accent: '#f2c4d4' },
  { id: 'gothic', label: 'Gothic cathedral', accent: '#cbb6f5' },
  { id: 'memory', label: 'Memory reel', accent: '#bfe6d8' },
];

function newScene(index: number): Scene {
  return {
    id: `scene-${Date.now().toString(36)}-${index}`,
    image: '',
    caption: '',
    duration: 3,
    transition: 'fade',
  };
}

function emptyTimeline(): Timeline {
  return {
    scenes: [newScene(0)],
    trackId: '',
    aspect: 'portrait',
    title: 'YumEra memory',
    subtitle: '',
  };
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, zoom: number) {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export default function VideoStudioPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<Timeline>(emptyTimeline);
  const [template, setTemplate] = useState('celestial');
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportNote, setExportNote] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const images = useRef<Record<string, HTMLImageElement>>({});
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: VideoProject[] }>('/api/videos');
      setProjects(data.items ?? []);
    } catch {
      /* drafts remain local until the first save */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    for (const scene of timeline.scenes) {
      if (!scene.image || images.current[scene.image]) continue;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = scene.image;
      images.current[scene.image] = img;
    }
  }, [timeline.scenes]);

  const totalDuration = timeline.scenes.reduce((sum, scene) => sum + scene.duration, 0);

  const renderAt = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { w, h } = ASPECTS[timeline.aspect];
      canvas.width = w;
      canvas.height = h;
      const accent = TEMPLATES.find((entry) => entry.id === template)?.accent ?? '#f0d9a8';

      ctx.fillStyle = '#0a0710';
      ctx.fillRect(0, 0, w, h);

      const scenes = timeline.scenes.length > 0 ? timeline.scenes : [newScene(0)];
      let elapsed = 0;
      let index = 0;
      for (let i = 0; i < scenes.length; i += 1) {
        if (time < elapsed + scenes[i].duration) {
          index = i;
          break;
        }
        elapsed += scenes[i].duration;
        index = i;
      }
      const scene = scenes[index];
      const localTime = Math.max(0, Math.min(scene.duration, time - elapsed));
      const progressInScene = localTime / Math.max(0.1, scene.duration);

      const img = scene.image ? images.current[scene.image] : undefined;
      const ready = img?.complete && img.naturalWidth > 0;

      ctx.save();
      if (scene.transition === 'slide') {
        ctx.translate((1 - Math.min(1, progressInScene * 3)) * w * 0.25, 0);
      }
      if (ready) {
        drawCover(ctx, img as HTMLImageElement, w, h, scene.transition === 'zoom' ? 1 + progressInScene * 0.08 : 1.02);
      } else {
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, '#1a1026');
        gradient.addColorStop(1, '#2a1633');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(240,217,168,0.25)';
        ctx.font = `${Math.round(w * 0.08)}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText('✦', w / 2, h / 2);
      }
      ctx.restore();

      // soft vignette + caption plate
      const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      if (scene.transition === 'fade') {
        const fade = Math.min(1, Math.min(progressInScene, 1 - progressInScene) * 4);
        ctx.fillStyle = `rgba(10,7,16,${Math.max(0, 0.85 - fade * 0.85)})`;
        ctx.fillRect(0, 0, w, h);
      }

      if (timeline.title || scene.caption) {
        const plateH = Math.round(h * (scene.caption ? 0.2 : 0.12));
        ctx.fillStyle = 'rgba(10,7,16,0.55)';
        ctx.fillRect(0, h - plateH, w, plateH);
        ctx.textAlign = 'center';
        if (scene.caption) {
          ctx.fillStyle = '#f7f2ea';
          ctx.font = `${Math.round(w * 0.045)}px Georgia, serif`;
          const words = scene.caption.split(' ');
          const lines: string[] = [];
          let line = '';
          for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (ctx.measureText(candidate).width > w * 0.86 && line) {
              lines.push(line);
              line = word;
            } else {
              line = candidate;
            }
          }
          if (line) lines.push(line);
          lines.slice(0, 3).forEach((text, lineIndex) => {
            ctx.fillText(text, w / 2, h - plateH + plateH * 0.42 + lineIndex * w * 0.06);
          });
        }
        if (timeline.subtitle) {
          ctx.fillStyle = accent;
          ctx.font = `${Math.round(w * 0.026)}px Georgia, serif`;
          ctx.fillText(timeline.subtitle, w / 2, h - plateH * 0.18);
        }
      }

      // timeline indicator
      const barW = w * 0.5;
      const barX = (w - barW) / 2;
      const barY = h - Math.round(h * 0.02);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(barX, barY, barW, 3);
      ctx.fillStyle = accent;
      ctx.fillRect(barX, barY, barW * Math.min(1, time / Math.max(0.1, totalDuration)), 3);
    },
    [template, timeline, totalDuration],
  );

  useEffect(() => {
    renderAt(0);
  }, [renderAt]);

  const stopPlayback = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
    audioRef.current?.pause();
  };

  const playPreview = () => {
    stopPlayback();
    setPlaying(true);
    startRef.current = performance.now();
    const track = timeline.trackId ? findTrack(timeline.trackId) : null;
    if (track) {
      audioRef.current ??= new Audio();
      audioRef.current.src = trackAudioUrl(track);
      audioRef.current.currentTime = 0;
      void audioRef.current.play().catch(() => undefined);
    }
    const loop = () => {
      const elapsed = (performance.now() - startRef.current) / 1000;
      if (elapsed >= totalDuration) {
        renderAt(totalDuration);
        stopPlayback();
        return;
      }
      renderAt(elapsed);
      setProgress(elapsed / totalDuration);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const exportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      setExportNote('This browser cannot record canvas video. Try Chrome or Edge on desktop.');
      return;
    }
    stopPlayback();
    setExporting(true);
    setExportNote('');
    try {
      const stream = canvas.captureStream(30);
      const track = timeline.trackId ? findTrack(timeline.trackId) : null;
      let audioEl: HTMLAudioElement | null = null;
      if (track) {
        audioEl = new Audio(trackAudioUrl(track));
        const capture = (audioEl as HTMLAudioElement & { captureStream?: () => MediaStream }).captureStream;
        if (capture) {
          const audioStream = capture.call(audioEl);
          audioStream.getAudioTracks().forEach((audioTrack) => stream.addTrack(audioTrack));
        } else {
          setExportNote('Video exported without music: this browser cannot capture audio tracks from a media element.');
        }
      }
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      const finished = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start();
      if (audioEl) void audioEl.play().catch(() => undefined);

      const started = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          const elapsed = (performance.now() - started) / 1000;
          if (elapsed >= totalDuration) {
            renderAt(totalDuration);
            setProgress(1);
            resolve();
            return;
          }
          renderAt(elapsed);
          setProgress(elapsed / totalDuration);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      recorder.stop();
      audioEl?.pause();
      await finished;
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${timeline.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'yumera-video'}.webm`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      setExportNote(`Exported ${(blob.size / 1_048_576).toFixed(1)} MB WebM. Convert to MP4 with any video tool if needed.`);
    } catch (error) {
      setExportNote(error instanceof Error ? error.message : 'Export failed in this browser.');
    } finally {
      setExporting(false);
    }
  };

  const uploadSceneImage = async (sceneId: string, file: File) => {
    try {
      const data = await uploadFile(file);
      setTimeline((current) => ({
        ...current,
        scenes: current.scenes.map((scene) => (scene.id === sceneId ? { ...scene, image: data.url } : scene)),
      }));
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Upload failed', 'error');
    }
  };

  const patchScene = (sceneId: string, patch: Partial<Scene>) => {
    setTimeline((current) => ({
      ...current,
      scenes: current.scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...patch } : scene)),
    }));
  };

  const save = async () => {
    const body = {
      title: timeline.title || 'Untitled video',
      template,
      timeline: JSON.stringify(timeline),
      duration: Math.round(totalDuration),
      thumbnail: timeline.scenes.find((scene) => scene.image)?.image ?? null,
      visibility: 'private',
    };
    try {
      if (activeId) {
        await api(`/api/videos/${activeId}`, { method: 'PATCH', body });
      } else {
        const created = await api<{ item: VideoProject }>('/api/videos', { body });
        setActiveId(created.item.id);
      }
      await load();
      toast.push('Draft saved', 'info');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not save draft', 'error');
    }
  };

  const openProject = async (id: string) => {
    try {
      const data = await api<{ item: VideoProject & { timeline: string } }>(`/api/videos/${id}`);
      const parsed = JSON.parse(data.item.timeline || '{}') as Timeline;
      setTimeline({
        scenes: Array.isArray(parsed.scenes) && parsed.scenes.length > 0 ? parsed.scenes : [newScene(0)],
        trackId: parsed.trackId ?? '',
        aspect: parsed.aspect ?? 'portrait',
        title: parsed.title ?? data.item.title,
        subtitle: parsed.subtitle ?? '',
      });
      setTemplate(data.item.template ?? 'celestial');
      setActiveId(id);
      toast.push('Draft opened', 'info');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not open draft', 'error');
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await api(`/api/videos/${id}`, { method: 'DELETE' });
      if (activeId === id) setActiveId(null);
      await load();
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not delete draft', 'error');
    }
  };

  if (loading) return <div className="page"><Spinner /></div>;

  return (
    <div className="page stack">
      <header className="stack" style={{ gap: 6 }}>
        <p className="tiny muted">YUMERA · VIDEO STUDIO</p>
        <h1 className="h1">Turn memories into motion</h1>
        <p className="muted" style={{ maxWidth: 720 }}>
          Build a slideshow from your own images, add captions, transitions and an original YumEra track, then export a real
          WebM file. Export runs in your browser, so no video processing happens on the server.
        </p>
      </header>

      <div className="studio-layout">
        <div className="studio-stage card">
          <canvas ref={canvasRef} className="video-canvas" />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn btn-sm btn-primary" onClick={playPreview} disabled={exporting}>
              ▶ Preview
            </button>
            <button className="btn btn-sm" onClick={stopPlayback} disabled={!playing}>⏸ Stop</button>
            <button className="btn btn-sm" onClick={() => void exportVideo()} disabled={exporting}>
              {exporting ? `Recording ${Math.round(progress * 100)}%` : 'Export WebM'}
            </button>
            <button className="btn btn-sm" onClick={() => void save()}>Save draft</button>
          </div>
          <p className="tiny muted" style={{ textAlign: 'center' }}>
            {Math.round(totalDuration)}s · {timeline.scenes.length} scene{timeline.scenes.length === 1 ? '' : 's'}
            {timeline.trackId ? ` · ${findTrack(timeline.trackId)?.title}` : ' · silent'}
          </p>
          {exportNote && <Alert kind="warn">{exportNote}</Alert>}
        </div>

        <div className="studio-panel stack">
          <section className="card stack">
            <h2 className="h3">Project</h2>
            <Field label="Title">
              <input
                className="input input-sm"
                value={timeline.title}
                onChange={(event) => setTimeline({ ...timeline, title: event.target.value })}
              />
            </Field>
            <Field label="Subtitle">
              <input
                className="input input-sm"
                value={timeline.subtitle}
                maxLength={80}
                onChange={(event) => setTimeline({ ...timeline, subtitle: event.target.value })}
              />
            </Field>
            <Field label="Format">
              <select
                className="input input-sm"
                value={timeline.aspect}
                onChange={(event) => setTimeline({ ...timeline, aspect: event.target.value as Timeline['aspect'] })}
              >
                {Object.entries(ASPECTS).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Template">
              <select className="input input-sm" value={template} onChange={(event) => setTemplate(event.target.value)}>
                {TEMPLATES.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Original soundtrack" hint="Licensed YumEra Originals only.">
              <select
                className="input input-sm"
                value={timeline.trackId}
                onChange={(event) => setTimeline({ ...timeline, trackId: event.target.value })}
              >
                <option value="">Silent</option>
                {MUSIC_TRACKS.map((track) => (
                  <option key={track.id} value={track.id}>{track.title}</option>
                ))}
              </select>
            </Field>
          </section>

          <section className="card stack">
            <div className="row between">
              <h2 className="h3">Scenes</h2>
              <button
                className="btn btn-sm"
                onClick={() => setTimeline({ ...timeline, scenes: [...timeline.scenes, newScene(timeline.scenes.length)] })}
              >
                + Scene
              </button>
            </div>
            {timeline.scenes.map((scene, index) => (
              <div key={scene.id} className="stack layer-row" style={{ gap: 6 }}>
                <div className="row between">
                  <strong className="tiny">Scene {index + 1}</strong>
                  <div className="row" style={{ gap: 4 }}>
                    <button
                      className="btn btn-sm btn-ghost"
                      disabled={index === 0}
                      onClick={() => {
                        const scenes = [...timeline.scenes];
                        [scenes[index - 1], scenes[index]] = [scenes[index], scenes[index - 1]];
                        setTimeline({ ...timeline, scenes });
                      }}
                    >
                      ↑
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      disabled={index === timeline.scenes.length - 1}
                      onClick={() => {
                        const scenes = [...timeline.scenes];
                        [scenes[index + 1], scenes[index]] = [scenes[index], scenes[index + 1]];
                        setTimeline({ ...timeline, scenes });
                      }}
                    >
                      ↓
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        const scenes = timeline.scenes.filter((entry) => entry.id !== scene.id);
                        setTimeline({ ...timeline, scenes: scenes.length > 0 ? scenes : [newScene(0)] });
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {scene.image && <img src={scene.image} alt={`Scene ${index + 1}`} className="video-thumb" />}
                <input
                  type="file"
                  accept="image/*"
                  className="input input-sm"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadSceneImage(scene.id, file);
                  }}
                />
                <textarea
                  className="input input-sm"
                  rows={2}
                  placeholder="Caption / subtitle"
                  value={scene.caption}
                  onChange={(event) => patchScene(scene.id, { caption: event.target.value })}
                />
                <div className="row" style={{ gap: 6 }}>
                  <label className="tiny muted" style={{ flex: 1 }}>
                    {scene.duration}s
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={0.5}
                      value={scene.duration}
                      onChange={(event) => patchScene(scene.id, { duration: Number(event.target.value) })}
                      style={{ width: '100%' }}
                    />
                  </label>
                  <select
                    className="input input-sm"
                    value={scene.transition}
                    onChange={(event) => patchScene(scene.id, { transition: event.target.value as Scene['transition'] })}
                  >
                    {['fade', 'slide', 'zoom', 'none'].map((transition) => (
                      <option key={transition} value={transition}>{transition}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </section>

          <section className="card stack">
            <h2 className="h3">Drafts</h2>
            {projects.length === 0 && <Empty title="No drafts yet" hint="Save a draft to reopen it later." />}
            {projects.map((project) => (
              <div key={project.id} className="row between layer-row">
                <span className="tiny">
                  {project.title} · {project.duration}s
                  {activeId === project.id ? ' · open' : ''}
                </span>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => void openProject(project.id)}>Open</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => void deleteProject(project.id)}>✕</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
