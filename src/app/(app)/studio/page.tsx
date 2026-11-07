'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Alert, Empty, Field, Spinner } from '@/components/ui';
import { useToast } from '@/components/providers';
import {
  EXPORT_SIZES,
  LayerType,
  PortraitDoc,
  PortraitLayer,
  STYLES,
  StyleKey,
  coupleDoc,
  emptyDoc,
  groupDoc,
  newLayer,
  parseDoc,
  preloadImages,
  renderDoc,
  serializeDoc,
  styleOf,
} from '@/lib/portrait';
import { gifBlob } from '@/lib/gif';

interface Project {
  id: string;
  title: string;
  style: string;
  mode: string;
  canvas: string;
  thumbnail: string | null;
  folder_id: string | null;
  updated_at: string;
}

const MODES = [
  { id: 'photo', label: 'Photo Portrait', hint: 'Upload a photo, then add filters, frames and ornaments.' },
  { id: 'character', label: 'Character Portrait', hint: 'Build a character from ornaments, colours and text.' },
  { id: 'couple', label: 'Yume Couple', hint: 'Two figures, one composition, romantic ornament sets.' },
  { id: 'group', label: 'Group Portrait', hint: 'Arrange several figures across the canvas.' },
] as const;

function renderToCanvas(doc: PortraitDoc, width: number, height: number, time = 0): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.save();
    ctx.scale(width / doc.width, height / doc.height);
    renderDoc(ctx, doc, time);
    ctx.restore();
  }
  return canvas;
}

export default function PortraitStudioPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [doc, setDoc] = useState<PortraitDoc | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled portrait');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<PortraitDoc[]>([]);
  const [future, setFuture] = useState<PortraitDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [exportSize, setExportSize] = useState(EXPORT_SIZES[2].id);
  const [busy, setBusy] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const timeRef = useRef(0);

  const loadLibrary = useCallback(async () => {
    try {
      const [projectData, folderData] = await Promise.all([
        api<{ items: Project[] }>('/api/portraits?mine=1'),
        api<{ items: Array<{ id: string; name: string }> }>('/api/folders'),
      ]);
      setProjects(projectData.items ?? []);
      setFolders(folderData.items ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  /* ---------------------------------------------------------------- render */
  const paint = useCallback(
    (time = 0) => {
      const canvas = canvasRef.current;
      if (!canvas || !doc) return;
      canvas.width = doc.width;
      canvas.height = doc.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderDoc(ctx, doc, time);
    },
    [doc],
  );

  useEffect(() => {
    preloadImages(doc ?? emptyDoc(), () => paint(timeRef.current));
    paint(timeRef.current);
  }, [doc, paint]);

  useEffect(() => {
    if (!animating) {
      timeRef.current = 0;
      paint(0);
      return;
    }
    let raf = 0;
    const loop = () => {
      timeRef.current = performance.now();
      paint(timeRef.current);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [animating, paint]);

  /* ------------------------------------------------------------- mutations */
  const commit = useCallback(
    (next: PortraitDoc) => {
      setDoc((current) => {
        if (current) {
          setHistory((stack) => [...stack.slice(-24), current]);
          setFuture([]);
        }
        return next;
      });
    },
    [],
  );

  const patchLayer = useCallback(
    (id: string, changes: Partial<PortraitLayer>, pushHistory = true) => {
      setDoc((current) => {
        if (!current) return current;
        if (pushHistory) setHistory((stack) => [...stack.slice(-24), current]);
        if (pushHistory) setFuture([]);
        return {
          ...current,
          layers: current.layers.map((layer) => (layer.id === id ? { ...layer, ...changes } : layer)),
        };
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setHistory((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setDoc((current) => {
        if (current) setFuture((next) => [...next, current]);
        return previous;
      });
      return stack.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((stack) => {
      if (stack.length === 0) return stack;
      const nextDoc = stack[stack.length - 1];
      setDoc((current) => {
        if (current) setHistory((prev) => [...prev, current]);
        return nextDoc;
      });
      return stack.slice(0, -1);
    });
  }, []);

  /* ------------------------------------------------------------- autosave */
  const thumbnail = useCallback((source: PortraitDoc) => {
    const canvas = renderToCanvas(source, 320, Math.round((320 * source.height) / source.width));
    return canvas.toDataURL('image/png');
  }, []);

  const save = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!doc) return null;
      setSaving(true);
      try {
        let thumbnailUrl: string | null = null;
        try {
          const dataUrl = thumbnail(doc);
          const blob = await (await fetch(dataUrl)).blob();
          const form = new FormData();
          form.append('file', new File([blob], 'portrait-preview.png', { type: 'image/png' }));
          const uploaded = await api<{ url: string }>('/api/upload', { formData: form });
          thumbnailUrl = uploaded.url;
        } catch {
          thumbnailUrl = null;
        }

        const payload = {
          title: title.trim() || 'Untitled portrait',
          style: doc.style,
          mode: doc.mode,
          canvas: serializeDoc(doc),
          visibility: 'private',
          ...(thumbnailUrl ? { thumbnail: thumbnailUrl } : {}),
        };

        if (projectId) {
          await api(`/api/portraits/${projectId}`, { method: 'PATCH', body: payload });
        } else {
          const created = await api<{ item: Project }>('/api/portraits', { method: 'POST', body: payload });
          if (created.item?.id) setProjectId(created.item.id);
        }
        setSavedAt(new Date().toLocaleTimeString());
        await loadLibrary();
        if (!options.silent) toast.push('Portrait saved to your library', 'info');
        return true;
      } catch (error) {
        toast.push(error instanceof Error ? error.message : 'Could not save portrait', 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [doc, loadLibrary, projectId, thumbnail, title, toast],
  );

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!doc) return;
    const id = window.setTimeout(() => {
      void saveRef.current({ silent: true });
    }, 2600);
    return () => window.clearTimeout(id);
  }, [doc, title]);

  /* ------------------------------------------------------------ interaction */
  const selected = doc?.layers.find((layer) => layer.id === selectedId) ?? null;

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !doc) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * doc.width,
      y: ((event.clientY - rect.top) / rect.height) * doc.height,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!doc) return;
    const point = canvasPoint(event);
    const hit = [...doc.layers].reverse().find((layer) => {
      const radius = Math.max(doc.width, doc.height) * 0.09 * layer.scale;
      return Math.hypot(layer.x - point.x, layer.y - point.y) < radius;
    });
    if (!hit) {
      setSelectedId(null);
      return;
    }
    setSelectedId(hit.id);
    dragRef.current = { id: hit.id, offsetX: point.x - hit.x, offsetY: point.y - hit.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = canvasPoint(event);
    patchLayer(drag.id, { x: point.x - drag.offsetX, y: point.y - drag.offsetY }, false);
  };

  const onPointerUp = () => {
    if (dragRef.current && doc) setHistory((stack) => [...stack.slice(-24), doc]);
    dragRef.current = null;
  };

  const addLayer = (type: LayerType, extra: Partial<PortraitLayer> = {}) => {
    if (!doc) return;
    const layer = newLayer(type, doc, extra);
    commit({ ...doc, layers: [...doc.layers, layer] });
    setSelectedId(layer.id);
  };

  const uploadImage = async (file: File, asBackground = false) => {
    if (!doc) return;
    setBusy(asBackground ? 'background' : 'image');
    try {
      const form = new FormData();
      form.append('file', file);
      const uploaded = await api<{ url: string }>('/api/upload', { formData: form });
      if (asBackground) {
        const layer = newLayer('image', doc, { src: uploaded.url, scale: 1, x: doc.width / 2, y: doc.height / 2 });
        commit({ ...doc, layers: [layer, ...doc.layers] });
        setSelectedId(layer.id);
      } else {
        addLayer('image', { src: uploaded.url });
      }
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Upload failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  /* --------------------------------------------------------------- exports */
  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportImage = async (format: 'png' | 'jpeg') => {
    if (!doc) return;
    const size = EXPORT_SIZES.find((entry) => entry.id === exportSize) ?? EXPORT_SIZES[2];
    setBusy('export');
    try {
      const canvas = renderToCanvas(doc, size.width, size.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, format === 'png' ? 'image/png' : 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('Export failed');
      download(blob, `${(title || 'yumera-portrait').toLowerCase().replace(/\s+/g, '-')}.${format === 'png' ? 'png' : 'jpg'}`);
      toast.push(`Exported ${size.label}`, 'info');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Export failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const exportGif = async () => {
    if (!doc) return;
    setBusy('gif');
    try {
      const width = 360;
      const height = Math.round((360 * doc.height) / doc.width);
      const frames: Array<{ data: Uint8ClampedArray; delayMs: number }> = [];
      for (let frame = 0; frame < 12; frame += 1) {
        const canvas = renderToCanvas(doc, width, height, frame * 110);
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        frames.push({ data: ctx.getImageData(0, 0, width, height).data, delayMs: 110 });
      }
      const blob = gifBlob(width, height, frames);
      download(blob, `${(title || 'yumera-portrait').toLowerCase().replace(/\s+/g, '-')}.gif`);
      toast.push('Animated GIF exported', 'info');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'GIF export failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const useAsProfile = async (target: 'avatarUrl' | 'coverUrl') => {
    if (!doc) return;
    setBusy('profile');
    try {
      const size = target === 'avatarUrl' ? EXPORT_SIZES[0] : EXPORT_SIZES[3];
      const canvas = renderToCanvas(doc, size.width, size.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Export failed');
      const form = new FormData();
      form.append('file', new File([blob], 'portrait.png', { type: 'image/png' }));
      const uploaded = await api<{ url: string }>('/api/upload', { formData: form });
      await api('/api/auth/session', { method: 'PATCH', body: { [target]: uploaded.url } });
      toast.push(target === 'avatarUrl' ? 'Profile picture updated' : 'Profile cover updated', 'info');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not update profile', 'error');
    } finally {
      setBusy(null);
    }
  };

  /* -------------------------------------------------------------- lifecycle */
  const startMode = (mode: (typeof MODES)[number]['id'], style: StyleKey) => {
    const next = mode === 'couple' ? coupleDoc(style) : mode === 'group' ? groupDoc(style, 3) : emptyDoc(style);
    next.mode = mode;
    setDoc(next);
    setHistory([]);
    setFuture([]);
    setProjectId(null);
    setSelectedId(null);
    setTitle(mode === 'couple' ? 'Yume couple' : mode === 'group' ? 'Group portrait' : 'Untitled portrait');
  };

  const openProject = (project: Project) => {
    const parsed = parseDoc(project.canvas);
    setDoc(parsed);
    setProjectId(project.id);
    setTitle(project.title);
    setHistory([]);
    setFuture([]);
    setSelectedId(null);
  };

  const duplicateProject = async (project: Project) => {
    try {
      await api('/api/portraits', {
        method: 'POST',
        body: {
          title: `${project.title} (copy)`,
          style: project.style,
          mode: project.mode,
          canvas: project.canvas,
          thumbnail: project.thumbnail,
          visibility: 'private',
        },
      });
      toast.push('Portrait duplicated', 'info');
      await loadLibrary();
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not duplicate', 'error');
    }
  };

  const removeProject = async (id: string) => {
    try {
      await api(`/api/portraits/${id}`, { method: 'DELETE' });
      if (projectId === id) {
        setDoc(null);
        setProjectId(null);
      }
      toast.push('Project deleted', 'info');
      await loadLibrary();
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not delete', 'error');
    }
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    try {
      await api('/api/folders', { method: 'POST', body: { name: folderName.trim() } });
      setFolderName('');
      await loadLibrary();
      toast.push('Folder created', 'info');
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Could not create folder', 'error');
    }
  };

  const style = useMemo(() => styleOf(doc?.style ?? 'gothic'), [doc?.style]);

  if (loading) return <div className="page"><Spinner /></div>;

  /* -------------------------------------------------------------- welcome */
  if (!doc) {
    return (
      <div className="page stack">
        <section className="studio-hero">
          <p className="tiny muted">YUME ERA · V4</p>
          <h1 className="studio-title">YUMERA PORTRAIT STUDIO</h1>
          <p className="studio-tagline">Your face. Your character. Your universe.</p>
          <p className="muted" style={{ maxWidth: 640 }}>
            Create portraits that tell your story. Your characters, your memories, your universe — built with real
            layering tools, original ornament sets and manual composition. No generative AI is used anywhere in this
            studio.
          </p>
        </section>

        <section className="stack">
          <h2 className="h2">Choose a style</h2>
          <div className="style-grid">
            {STYLES.map((entry) => (
              <button
                key={entry.key}
                className="style-card"
                style={{
                  background: `linear-gradient(150deg, ${entry.palette.deep}, ${entry.palette.mid})`,
                  borderColor: `${entry.palette.accent}55`,
                }}
                onClick={() => startMode('character', entry.key)}
              >
                <span className="style-glyphs">{entry.ornaments.join(' ')}</span>
                <strong style={{ color: entry.palette.accent }}>{entry.label}</strong>
                <span className="tiny" style={{ color: '#efe7ff' }}>{entry.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="stack">
          <h2 className="h2">Creation modes</h2>
          <div className="grid-auto">
            {MODES.map((mode) => (
              <article key={mode.id} className="card stack">
                <h3 className="h3">{mode.label}</h3>
                <p className="tiny muted">{mode.hint}</p>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {STYLES.slice(0, 4).map((entry) => (
                    <button key={entry.key} className="chip" onClick={() => startMode(mode.id, entry.key)}>
                      {entry.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => startMode(mode.id, 'gothic')}>
                  Start {mode.label}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="stack">
          <div className="row between">
            <h2 className="h2">My portrait library</h2>
            <div className="row" style={{ gap: 6 }}>
              <input
                className="input input-sm"
                placeholder="New folder name"
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
              />
              <button className="btn btn-sm" onClick={() => void createFolder()}>Add folder</button>
            </div>
          </div>
          {folders.length > 0 && (
            <p className="tiny muted">Folders: {folders.map((folder) => folder.name).join(' · ')}</p>
          )}
          {projects.length === 0 ? (
            <Empty title="Your library is empty" hint="Start a portrait above and it will be saved here automatically." />
          ) : (
            <div className="grid-auto">
              {projects.map((project) => (
                <article key={project.id} className="card stack">
                  {project.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={project.thumbnail} alt={project.title} className="thumb" />
                  ) : (
                    <div className="thumb thumb-empty">{styleOf(project.style as StyleKey).ornaments[0]}</div>
                  )}
                  <h3 className="h3">{project.title}</h3>
                  <p className="tiny muted">{project.style} · {project.mode}</p>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-primary" onClick={() => openProject(project)}>Open</button>
                    <button className="btn btn-sm" onClick={() => void duplicateProject(project)}>Duplicate</button>
                    <button className="btn btn-sm" onClick={() => void removeProject(project.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  /* ---------------------------------------------------------------- editor */
  return (
    <div className="page stack">
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm" onClick={() => { setDoc(null); setProjectId(null); }}>← Library</button>
          <input
            className="input input-sm"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Portrait title"
          />
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={undo} disabled={history.length === 0}>Undo</button>
          <button className="btn btn-sm" onClick={redo} disabled={future.length === 0}>Redo</button>
          <button className="btn btn-sm" onClick={() => setAnimating((value) => !value)}>
            {animating ? 'Stop preview' : 'Animate'}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <p className="tiny muted">
        {savedAt ? `Autosaved at ${savedAt}` : 'Autosave is on — your work is stored in your library.'}
      </p>

      <div className="studio-layout">
        <aside className="studio-panel stack">
          <div>
            <p className="tiny muted">Style</p>
            <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
              {STYLES.map((entry) => (
                <button
                  key={entry.key}
                  className={`chip ${doc.style === entry.key ? 'is-active' : ''}`}
                  onClick={() => {
                    commit({ ...doc, style: entry.key, background: entry.backgrounds[0].id });
                  }}
                >
                  {entry.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="tiny muted">Background</p>
            <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
              {style.backgrounds.map((background) => (
                <button
                  key={background.id}
                  className={`bg-swatch ${doc.background === background.id ? 'is-active' : ''}`}
                  style={{ background: `linear-gradient(140deg, ${background.colors[0]}, ${background.colors[1]})` }}
                  onClick={() => commit({ ...doc, background: background.id })}
                  title={background.label}
                />
              ))}
            </div>
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <p className="tiny muted">Add</p>
            <label className="btn btn-sm" style={{ textAlign: 'center' }}>
              {busy === 'image' ? 'Uploading…' : 'Upload image'}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file);
                  event.target.value = '';
                }}
              />
            </label>
            <label className="btn btn-sm" style={{ textAlign: 'center' }}>
              {busy === 'background' ? 'Uploading…' : 'Photo as base layer'}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file, true);
                  event.target.value = '';
                }}
              />
            </label>
            <button className="btn btn-sm" onClick={() => addLayer('text')}>Add text</button>
            <button className="btn btn-sm" onClick={() => addLayer('glyph')}>Add glyph</button>
            <button className="btn btn-sm" onClick={() => addLayer('ornament')}>Add ornament</button>
          </div>

          <div>
            <p className="tiny muted">Ornament set · {style.label}</p>
            <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
              {[...style.ornaments, ...style.glyphs].map((glyph, index) => (
                <button
                  key={`${glyph}-${index}`}
                  className="glyph-btn"
                  style={{ color: style.palette.accent }}
                  onClick={() => addLayer(index < style.ornaments.length ? 'ornament' : 'glyph', { value: glyph })}
                >
                  {glyph}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="stack" style={{ gap: 10 }}>
          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              className="canvas-stage"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <select className="input input-sm" value={exportSize} onChange={(event) => setExportSize(event.target.value)}>
              {EXPORT_SIZES.map((size) => (
                <option key={size.id} value={size.id}>{size.label}</option>
              ))}
            </select>
            <button className="btn btn-sm" onClick={() => void exportImage('png')} disabled={busy === 'export'}>PNG</button>
            <button className="btn btn-sm" onClick={() => void exportImage('jpeg')} disabled={busy === 'export'}>JPG</button>
            <button className="btn btn-sm" onClick={() => void exportGif()} disabled={busy === 'gif'}>
              {busy === 'gif' ? 'Building GIF…' : 'Animated GIF'}
            </button>
            <button className="btn btn-sm" onClick={() => void useAsProfile('avatarUrl')} disabled={busy === 'profile'}>
              Use as profile picture
            </button>
            <button className="btn btn-sm" onClick={() => void useAsProfile('coverUrl')} disabled={busy === 'profile'}>
              Use as cover
            </button>
          </div>
          <p className="tiny muted" style={{ textAlign: 'center' }}>
            Drag any element on the canvas to reposition it. GIF export renders the animation frame by frame in your browser.
          </p>
        </div>

        <aside className="studio-panel stack">
          <p className="tiny muted">Layers ({doc.layers.length})</p>
          <div className="stack" style={{ gap: 4 }}>
            {[...doc.layers].reverse().map((layer) => (
              <button
                key={layer.id}
                className={`layer-row ${selectedId === layer.id ? 'is-active' : ''}`}
                onClick={() => setSelectedId(layer.id)}
              >
                <span>{layer.type === 'image' ? '🖼' : layer.type === 'text' ? 'T' : layer.value ?? '✦'}</span>
                <span className="tiny">{layer.type}</span>
                <span className="tiny muted" style={{ marginLeft: 'auto' }}>
                  {Math.round(layer.scale * 100)}%
                </span>
              </button>
            ))}
            {doc.layers.length === 0 && <p className="tiny muted">Add a photo, text or ornament to begin.</p>}
          </div>

          {selected && (
            <div className="stack" style={{ gap: 8 }}>
              <Field label="Opacity">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selected.opacity}
                  onChange={(event) => patchLayer(selected.id, { opacity: Number(event.target.value) }, false)}
                />
              </Field>
              <Field label="Size">
                <input
                  type="range"
                  min={0.2}
                  max={3}
                  step={0.05}
                  value={selected.scale}
                  onChange={(event) => patchLayer(selected.id, { scale: Number(event.target.value) }, false)}
                />
              </Field>
              <Field label="Rotation">
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={selected.rotation}
                  onChange={(event) => patchLayer(selected.id, { rotation: Number(event.target.value) }, false)}
                />
              </Field>
              <Field label="Colour">
                <input
                  type="color"
                  value={selected.color}
                  onChange={(event) => patchLayer(selected.id, { color: event.target.value }, false)}
                />
              </Field>
              {(selected.type === 'text' || selected.type === 'glyph' || selected.type === 'ornament') && (
                <Field label={selected.type === 'text' ? 'Text' : 'Glyph'}>
                  <input
                    className="input input-sm"
                    value={selected.value ?? ''}
                    onChange={(event) => patchLayer(selected.id, { value: event.target.value }, false)}
                  />
                </Field>
              )}
              {selected.type === 'text' && (
                <Field label="Font">
                  <select
                    className="input input-sm"
                    value={selected.font ?? style.fonts[0]}
                    onChange={(event) => patchLayer(selected.id, { font: event.target.value }, false)}
                  >
                    {style.fonts.map((font) => (
                      <option key={font} value={font}>{font.split(',')[0].replace(/"/g, '')}</option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const copy = { ...selected, id: `${selected.id}-copy-${Date.now().toString(36)}`, x: selected.x + 24, y: selected.y + 24 };
                    commit({ ...doc, layers: [...doc.layers, copy] });
                    setSelectedId(copy.id);
                  }}
                >
                  Duplicate
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    commit({ ...doc, layers: doc.layers.filter((layer) => layer.id !== selected.id) });
                    setSelectedId(null);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {doc.mode === 'couple' && (
        <Alert kind="warn">
          Couple mode: place two figures or ornaments side by side, then add a date and a dedication in the text layers.
        </Alert>
      )}
      <p className="tiny muted">
        Want to share it? Export the PNG, then publish it in <Link href="/gallery" className="link">your gallery</Link> or
        attach it to a <Link href="/feed" className="link">feed post</Link>.
      </p>
    </div>
  );
}
