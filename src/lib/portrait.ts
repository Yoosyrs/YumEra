/**
 * YumEra Portrait Studio — composition engine.
 *
 * Everything here is deterministic, canvas-based composition: no generative
 * model is involved anywhere in this file. Styles differ by palette, pattern,
 * ornament set and frame, and every ornament is drawn programmatically.
 */

export type StyleKey = 'anime' | 'gacha' | 'webtoon' | 'gothic' | 'pixel' | 'watercolor' | 'cartoon' | 'photo';

export type LayerType = 'image' | 'glyph' | 'text' | 'frame' | 'ornament';

export interface PortraitLayer {
  id: string;
  type: LayerType;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  color: string;
  value?: string;
  src?: string;
  font?: string;
}

export interface PortraitDoc {
  width: number;
  height: number;
  style: StyleKey;
  mode: 'photo' | 'character' | 'couple' | 'group';
  background: string;
  layers: PortraitLayer[];
}

export interface StyleDef {
  key: StyleKey;
  label: string;
  blurb: string;
  palette: { deep: string; mid: string; accent: string; ink: string };
  glyphs: string[];
  ornaments: string[];
  backgrounds: Array<{ id: string; label: string; colors: [string, string] }>;
  fonts: string[];
}

export const STYLES: StyleDef[] = [
  {
    key: 'anime',
    label: 'Anime & Manga',
    blurb: 'Soft cel shading, expressive eyes and screentone skies.',
    palette: { deep: '#241736', mid: '#7b4fa8', accent: '#ffd9ec', ink: '#12091f' },
    glyphs: ['✧', '✦', '❀', '♡', '★', '☾', '✿', '❁'],
    ornaments: ['✧', '❀', '♡', '★'],
    backgrounds: [
      { id: 'sakura-dusk', label: 'Sakura dusk', colors: ['#3a1d4d', '#ffb7d5'] },
      { id: 'school-roof', label: 'Rooftop sky', colors: ['#2a3f6b', '#ffd9a8'] },
      { id: 'night-city', label: 'Neon night', colors: ['#1b0f2e', '#7b4fa8'] },
    ],
    fonts: ['Georgia, serif', '"Trebuchet MS", sans-serif'],
  },
  {
    key: 'gacha',
    label: 'Gacha & Chibi',
    blurb: 'Bubble chibi silhouettes, pastel sparkles and sticker poses.',
    palette: { deep: '#2b1740', mid: '#c58bff', accent: '#ffe3f4', ink: '#180c26' },
    glyphs: ['✿', '❁', '✧', '♪', '☁', '♬', '✚', '❥'],
    ornaments: ['☁', '✿', '♬', '❥'],
    backgrounds: [
      { id: 'bubble-garden', label: 'Bubble garden', colors: ['#4a2a63', '#ffc6e3'] },
      { id: 'candy-sky', label: 'Candy sky', colors: ['#5b3a7a', '#ffe0a3'] },
      { id: 'star-room', label: 'Sticker room', colors: ['#2f1a44', '#c9a7ff'] },
    ],
    fonts: ['"Comic Sans MS", "Trebuchet MS", sans-serif', 'Georgia, serif'],
  },
  {
    key: 'webtoon',
    label: 'Webtoon & Comic',
    blurb: 'Panel gutters, halftone shadows and speech bubbles.',
    palette: { deep: '#141327', mid: '#5f6bd6', accent: '#ffe066', ink: '#0a0918' },
    glyphs: ['✱', '❯', '❮', '!', '?', '★', '➤', '✷'],
    ornaments: ['✱', '➤', '✷', '★'],
    backgrounds: [
      { id: 'panel-noon', label: 'Panel noon', colors: ['#232a52', '#8fa2ff'] },
      { id: 'panel-rain', label: 'Rain panel', colors: ['#101a2e', '#4a6b8a'] },
      { id: 'panel-flash', label: 'Dramatic flash', colors: ['#241436', '#ffd166'] },
    ],
    fonts: ['Impact, "Arial Black", sans-serif', 'Georgia, serif'],
  },
  {
    key: 'gothic',
    label: 'Gothic & Fantasy',
    blurb: 'Victorian arches, wings, thorned frames and candlelight.',
    palette: { deep: '#0b0714', mid: '#4a2b6b', accent: '#d9b26a', ink: '#05030a' },
    glyphs: ['✝', '☩', '❦', '✠', '☾', '✵', '❧', '♱'],
    ornaments: ['❦', '✝', '✵', '❧'],
    backgrounds: [
      { id: 'crypt', label: 'Candlelit crypt', colors: ['#0a0612', '#3a2352'] },
      { id: 'cathedral', label: 'Cathedral glass', colors: ['#0d0a1f', '#5a3a8c'] },
      { id: 'thorn-garden', label: 'Thorn garden', colors: ['#100a18', '#2f4a3a'] },
    ],
    fonts: ['"Cinzel", Georgia, serif', 'Georgia, serif'],
  },
  {
    key: 'pixel',
    label: 'Pixel Art',
    blurb: 'Blocky portraits, fixed palettes and 8-bit ornament grids.',
    palette: { deep: '#101426', mid: '#3f5bd8', accent: '#ffe066', ink: '#070a14' },
    glyphs: ['▚', '▞', '▙', '▟', '■', '▲', '◆', '●'],
    ornaments: ['■', '◆', '▲', '●'],
    backgrounds: [
      { id: 'pixel-dawn', label: 'Pixel dawn', colors: ['#131a33', '#f2a65a'] },
      { id: 'pixel-cave', label: 'Pixel cave', colors: ['#0d1220', '#3f5bd8'] },
      { id: 'pixel-forest', label: 'Pixel forest', colors: ['#0f1a16', '#3fa86b'] },
    ],
    fonts: ['"Courier New", monospace', 'monospace'],
  },
  {
    key: 'watercolor',
    label: 'Watercolour & Painting',
    blurb: 'Bleeding washes, paper grain and hand-painted frames.',
    palette: { deep: '#1d2338', mid: '#7f9bc4', accent: '#f3d9c0', ink: '#131a2a' },
    glyphs: ['❀', '✿', '❋', '✾', '❁', '☘', '✽', '❃'],
    ornaments: ['❀', '❋', '✽', '☘'],
    backgrounds: [
      { id: 'wash-rose', label: 'Rose wash', colors: ['#2a2036', '#f0b6c0'] },
      { id: 'wash-sea', label: 'Sea wash', colors: ['#172435', '#9fd0d6'] },
      { id: 'wash-gold', label: 'Golden hour', colors: ['#2c2118', '#f6d9a0'] },
    ],
    fonts: ['Georgia, serif', '"Palatino Linotype", serif'],
  },
  {
    key: 'cartoon',
    label: 'Cartoon & 3D',
    blurb: 'Chunky outlines, glossy spheres and playful props.',
    palette: { deep: '#1a1230', mid: '#6b4ce0', accent: '#ffcf5c', ink: '#0e0a1c' },
    glyphs: ['●', '◕', '★', '☺', '✚', '◆', '☀', '♪'],
    ornaments: ['●', '★', '◆', '☀'],
    backgrounds: [
      { id: 'studio-purple', label: 'Studio purple', colors: ['#241a45', '#8a6bff'] },
      { id: 'studio-mint', label: 'Studio mint', colors: ['#16283a', '#7fe0c8'] },
      { id: 'studio-sunset', label: 'Studio sunset', colors: ['#2b1830', '#ff9a6b'] },
    ],
    fonts: ['"Trebuchet MS", sans-serif', '"Arial Rounded MT Bold", sans-serif'],
  },
  {
    key: 'photo',
    label: 'Photography Styles',
    blurb: 'Film grain, vignettes, cinematic contrast and light leaks.',
    palette: { deep: '#0c0c10', mid: '#3b3b46', accent: '#e8d5b5', ink: '#050507' },
    glyphs: ['✦', '·', '✧', '◦', '✳', '◌', '✺', '❉'],
    ornaments: ['✦', '✳', '◌', '✺'],
    backgrounds: [
      { id: 'film-noir', label: 'Film noir', colors: ['#08080b', '#3a3a44'] },
      { id: 'golden-film', label: 'Golden film', colors: ['#171008', '#c9a06a'] },
      { id: 'blue-hour', label: 'Blue hour', colors: ['#0a1420', '#3f6f9a'] },
    ],
    fonts: ['Georgia, serif', '"Helvetica Neue", Arial, sans-serif'],
  },
];

export function styleOf(key: StyleKey): StyleDef {
  return STYLES.find((style) => style.key === key) ?? STYLES[0];
}

export const EXPORT_SIZES = [
  { id: 'profile', label: 'Profile (square)', width: 640, height: 640 },
  { id: 'post', label: 'Post (square)', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Portrait (vertical)', width: 900, height: 1200 },
  { id: 'cover', label: 'Cover (horizontal)', width: 1200, height: 630 },
  { id: 'story', label: 'Story (9:16)', width: 810, height: 1440 },
];

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(src);
  if (cached?.complete && cached.naturalWidth > 0) return cached;
  if (!cached) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    imageCache.set(src, img);
  }
  return null;
}

export function preloadImages(doc: PortraitDoc, onReady?: () => void) {
  const sources = doc.layers.filter((layer) => layer.type === 'image' && layer.src).map((layer) => layer.src as string);
  sources.forEach((src) => {
    const img = imageCache.get(src);
    if (!img) {
      const created = new Image();
      created.crossOrigin = 'anonymous';
      created.onload = () => onReady?.();
      created.src = src;
      imageCache.set(src, created);
    } else if (!img.complete) {
      img.onload = () => onReady?.();
    }
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPattern(ctx: CanvasRenderingContext2D, style: StyleDef, w: number, h: number) {
  ctx.save();
  switch (style.key) {
    case 'anime': {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      for (let i = -h; i < w; i += 26) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h, h);
        ctx.stroke();
      }
      break;
    }
    case 'gacha': {
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 26; i += 1) {
        const r = 20 + ((i * 37) % 90);
        ctx.beginPath();
        ctx.arc((i * 131) % w, (i * 97) % h, r, 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 ? '#ffffff' : style.palette.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    }
    case 'webtoon': {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = style.palette.ink;
      for (let y = 0; y < h; y += 14) {
        for (let x = 0; x < w; x += 14) {
          const size = 2 + ((x + y) % 3);
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'gothic': {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = style.palette.accent;
      ctx.lineWidth = 2;
      for (let x = 40; x < w; x += 120) {
        ctx.beginPath();
        ctx.moveTo(x, h * 0.55);
        ctx.lineTo(x, h * 0.3);
        ctx.arc(x + 30, h * 0.3, 30, Math.PI, 0);
        ctx.lineTo(x + 60, h * 0.55);
        ctx.stroke();
      }
      break;
    }
    case 'pixel': {
      ctx.globalAlpha = 0.35;
      const block = 18;
      for (let y = 0; y < h; y += block) {
        for (let x = 0; x < w; x += block) {
          if ((x / block + y / block) % 3 === 0) {
            ctx.fillStyle = style.palette.accent;
            ctx.fillRect(x, y, block, block);
          }
        }
      }
      break;
    }
    case 'watercolor': {
      ctx.globalAlpha = 0.2;
      for (let i = 0; i < 18; i += 1) {
        const gradient = ctx.createRadialGradient(
          (i * 173) % w, (i * 111) % h, 4,
          (i * 173) % w, (i * 111) % h, 90 + ((i * 31) % 120),
        );
        gradient.addColorStop(0, i % 2 ? style.palette.accent : '#ffffff');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc((i * 173) % w, (i * 111) % h, 140, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'cartoon': {
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 14; i += 1) {
        const x = (i * 211) % w;
        const y = (i * 157) % h;
        const gradient = ctx.createRadialGradient(x - 12, y - 12, 4, x, y, 52);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, style.palette.mid);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 52, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'photo': {
      ctx.globalAlpha = 0.14;
      for (let i = 0; i < 2600; i += 1) {
        const x = (i * 7919) % w;
        const y = (i * 104729) % h;
        ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#000000';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export function drawBackground(ctx: CanvasRenderingContext2D, doc: PortraitDoc, presetId?: string) {
  const style = styleOf(doc.style);
  const preset = style.backgrounds.find((entry) => entry.id === presetId) ?? style.backgrounds[0];
  const gradient = ctx.createLinearGradient(0, 0, doc.width * 0.4, doc.height);
  gradient.addColorStop(0, preset.colors[0]);
  gradient.addColorStop(1, preset.colors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, doc.width, doc.height);
  drawPattern(ctx, style, doc.width, doc.height);

  if (style.key === 'photo') {
    const vignette = ctx.createRadialGradient(
      doc.width / 2, doc.height / 2, doc.width * 0.2,
      doc.width / 2, doc.height / 2, doc.width * 0.78,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, doc.width, doc.height);
  }
}

function drawFrameOrnament(ctx: CanvasRenderingContext2D, style: StyleDef, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = style.palette.accent;
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.globalAlpha = 0.9;
  const inset = w * 0.035;
  switch (style.key) {
    case 'gothic': {
      ctx.beginPath();
      ctx.moveTo(inset, h - inset);
      ctx.lineTo(inset, h * 0.28);
      ctx.arc(w / 2, h * 0.28, w / 2 - inset, Math.PI, 0);
      ctx.lineTo(w - inset, h - inset);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.16, w * 0.03, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'pixel': {
      const step = Math.max(6, Math.round(w * 0.02));
      for (let x = inset; x < w - inset; x += step * 2) {
        ctx.fillStyle = style.palette.accent;
        ctx.fillRect(x, inset, step, step);
        ctx.fillRect(x, h - inset - step, step, step);
      }
      break;
    }
    case 'webtoon': {
      ctx.lineWidth = Math.max(4, w * 0.012);
      ctx.strokeStyle = '#ffffff';
      roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, w * 0.02);
      ctx.stroke();
      break;
    }
    case 'watercolor': {
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 4; i += 1) {
        ctx.lineWidth = Math.max(2, w * 0.006 - i);
        roundRect(ctx, inset + i * 3, inset + i * 3, w - (inset + i * 3) * 2, h - (inset + i * 3) * 2, w * 0.04);
        ctx.stroke();
      }
      break;
    }
    default: {
      roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, w * 0.03);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      roundRect(ctx, inset * 1.6, inset * 1.6, w - inset * 3.2, h - inset * 3.2, w * 0.02);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

export function drawLayer(ctx: CanvasRenderingContext2D, doc: PortraitDoc, layer: PortraitLayer, time = 0) {
  const style = styleOf(doc.style);
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);

  if (layer.type === 'image' && layer.src) {
    const img = loadImage(layer.src);
    if (img) {
      const maxSide = Math.min(doc.width, doc.height) * 0.8;
      const ratio = img.naturalWidth / img.naturalHeight || 1;
      const drawW = ratio >= 1 ? maxSide : maxSide * ratio;
      const drawH = ratio >= 1 ? maxSide / ratio : maxSide;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 28;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      ctx.strokeStyle = style.palette.accent;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(-120, -120, 240, 240);
      ctx.fillStyle = style.palette.accent;
      ctx.font = `600 ${Math.round(doc.width * 0.03)}px ${style.fonts[0]}`;
      ctx.textAlign = 'center';
      ctx.fillText('image', 0, 6);
    }
  }

  if (layer.type === 'glyph' || layer.type === 'ornament') {
    const size = doc.width * 0.11;
    ctx.fillStyle = layer.color;
    ctx.font = `${layer.type === 'ornament' ? 400 : 600} ${size}px ${style.fonts[0]}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = layer.color;
    ctx.shadowBlur = layer.type === 'ornament' ? 22 : 10;
    const float = layer.type === 'ornament' ? Math.sin(time / 600 + layer.x) * doc.width * 0.006 : 0;
    ctx.fillText(layer.value ?? '✦', 0, float);
  }

  if (layer.type === 'text') {
    const size = Math.round(doc.width * 0.055);
    ctx.fillStyle = layer.color;
    ctx.font = `600 ${size}px ${layer.font ?? style.fonts[0]}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 16;
    const lines = String(layer.value ?? '').split('\n').slice(0, 6);
    lines.forEach((line, index) => {
      ctx.fillText(line, 0, index * size * 1.25);
    });
  }

  if (layer.type === 'frame') {
    ctx.translate(-layer.x, -layer.y);
    drawFrameOrnament(ctx, style, doc.width, doc.height);
  }

  ctx.restore();
}

export function renderDoc(ctx: CanvasRenderingContext2D, doc: PortraitDoc, time = 0) {
  ctx.clearRect(0, 0, doc.width, doc.height);
  drawBackground(ctx, doc, doc.background);
  for (const layer of doc.layers) drawLayer(ctx, doc, layer, time);
  drawFrameOrnament(ctx, styleOf(doc.style), doc.width, doc.height);
}

let counter = 0;
export function newLayer(type: LayerType, doc: PortraitDoc, extra: Partial<PortraitLayer> = {}): PortraitLayer {
  const style = styleOf(doc.style);
  counter += 1;
  return {
    id: `layer-${Date.now().toString(36)}-${counter}`,
    type,
    x: doc.width / 2,
    y: doc.height / 2,
    scale: 1,
    rotation: 0,
    opacity: 1,
    color: style.palette.accent,
    value: type === 'glyph' ? style.glyphs[0] : type === 'ornament' ? style.ornaments[0] : type === 'text' ? 'Your universe' : undefined,
    font: style.fonts[0],
    ...extra,
  };
}

export function emptyDoc(style: StyleKey = 'gothic'): PortraitDoc {
  const def = styleOf(style);
  return {
    width: 900,
    height: 1200,
    style,
    mode: 'character',
    background: def.backgrounds[0].id,
    layers: [],
  };
}

export function coupleDoc(style: StyleKey = 'gothic'): PortraitDoc {
  const doc = emptyDoc(style);
  const def = styleOf(style);
  doc.mode = 'couple';
  doc.layers = [
    newLayer('text', doc, { y: doc.height * 0.13, value: 'You & your F/O', color: def.palette.accent }),
    newLayer('ornament', doc, { x: doc.width * 0.3, y: doc.height * 0.42, value: def.ornaments[0], color: def.palette.accent }),
    newLayer('ornament', doc, { x: doc.width * 0.7, y: doc.height * 0.42, value: def.ornaments[1] ?? def.ornaments[0], color: def.palette.accent }),
    newLayer('glyph', doc, { x: doc.width * 0.5, y: doc.height * 0.44, value: '♥', color: def.palette.accent, scale: 0.8 }),
  ];
  return doc;
}

export function groupDoc(style: StyleKey = 'gothic', count = 3): PortraitDoc {
  const doc = emptyDoc(style);
  doc.mode = 'group';
  const def = styleOf(style);
  for (let i = 0; i < count; i += 1) {
    doc.layers.push(
      newLayer('ornament', doc, {
        x: doc.width * ((i + 1) / (count + 1)),
        y: doc.height * (i % 2 === 0 ? 0.4 : 0.55),
        value: def.ornaments[i % def.ornaments.length],
        color: def.palette.accent,
      }),
    );
  }
  return doc;
}

export function parseDoc(raw: unknown): PortraitDoc {
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Partial<PortraitDoc>;
      if (parsed && Array.isArray(parsed.layers)) {
        const style = (parsed.style ?? 'gothic') as StyleKey;
        return {
          width: Number(parsed.width) || 900,
          height: Number(parsed.height) || 1200,
          style,
          mode: (parsed.mode ?? 'character') as PortraitDoc['mode'],
          background: parsed.background ?? styleOf(style).backgrounds[0].id,
          layers: parsed.layers as PortraitLayer[],
        };
      }
    } catch {
      /* fall through */
    }
  }
  return emptyDoc();
}

export function serializeDoc(doc: PortraitDoc): string {
  return JSON.stringify(doc);
}
