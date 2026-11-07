import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { UPLOAD_DIR } from './db';

const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
};

export interface SavedFile {
  url: string;
  mime: string;
  size: number;
}

/** Persists an uploaded file to the server data directory and returns its URL. */
export async function saveUpload(file: File): Promise<SavedFile> {
  if (!file || typeof file === 'string') {
    throw new Error('No file received');
  }
  if (file.size === 0) throw new Error('Empty file');
  if (file.size > MAX_BYTES) throw new Error('File exceeds the 8 MB limit');
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error(`Unsupported file type: ${file.type || 'unknown'}`);
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return { url: `/api/media/${name}`, mime: file.type, size: file.size };
}

export async function readUpload(name: string): Promise<{ buffer: Buffer; mime: string } | null> {
  // Block traversal: only allow generated file names.
  if (!/^[a-z0-9-]+\.(png|jpg|webp|gif|svg|mp3|wav|webm|mp4)$/i.test(name)) return null;
  try {
    const buffer = await fs.readFile(path.join(UPLOAD_DIR, name));
    const ext = name.split('.').pop()!.toLowerCase();
    const mime =
      Object.entries(ALLOWED).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
    return { buffer, mime };
  } catch {
    return null;
  }
}

export async function saveDataUrl(dataUrl: string, fallbackMime = 'image/png'): Promise<string> {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error('Invalid data URL');
  const mime = match[1];
  const ext = ALLOWED[mime] ?? (fallbackMime === 'image/jpeg' ? 'jpg' : 'png');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > MAX_BYTES) throw new Error('File exceeds the 8 MB limit');
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `/api/media/${name}`;
}
