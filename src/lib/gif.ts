/**
 * Minimal, dependency-free GIF89a encoder.
 *
 * Used by YumEra Portrait Studio to export animated portraits (sparkles,
 * floating ornaments) as a real .gif file. Frames are quantised to a fixed
 * 216-colour cube; LZW compression is implemented per the GIF89a spec.
 */

export interface RawFrame {
  /** RGBA bytes, length = width * height * 4. */
  data: Uint8ClampedArray | Uint8Array;
  delayMs: number;
}

const PALETTE: number[][] = (() => {
  const entries: number[][] = [];
  const levels = [0, 51, 102, 153, 204, 255];
  for (const r of levels) for (const g of levels) for (const b of levels) entries.push([r, g, b]);
  // Pad to 256 with a soft grey ramp for smooth gradients.
  for (let i = 0; entries.length < 256; i += 1) {
    const value = Math.min(255, Math.round((i / 39) * 255));
    entries.push([value, value, value]);
  }
  return entries;
})();

function quantise(r: number, g: number, b: number): number {
  const rq = Math.round(r / 51);
  const gq = Math.round(g / 51);
  const bq = Math.round(b / 51);
  return rq * 36 + gq * 6 + bq;
}

function toIndexed(frame: RawFrame): Uint8Array {
  const pixels = frame.data;
  const out = new Uint8Array(pixels.length / 4);
  for (let i = 0, p = 0; i < out.length; i += 1, p += 4) {
    out[i] = quantise(pixels[p], pixels[p + 1], pixels[p + 2]);
  }
  return out;
}

class ByteWriter {
  private bytes: number[] = [];

  byte(value: number) {
    this.bytes.push(value & 0xff);
  }

  short(value: number) {
    this.byte(value & 0xff);
    this.byte((value >> 8) & 0xff);
  }

  ascii(text: string) {
    for (let i = 0; i < text.length; i += 1) this.byte(text.charCodeAt(i));
  }

  raw(values: number[] | Uint8Array) {
    for (const value of values) this.byte(value);
  }

  toUint8Array() {
    return Uint8Array.from(this.bytes);
  }
}

function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;

  let dict = new Map<number, number>();
  const codes: number[] = [clearCode];
  let prefix = indices[0] ?? 0;

  for (let i = 1; i < indices.length; i += 1) {
    const char = indices[i];
    const key = (prefix << 8) | char;
    const existing = dict.get(key);
    if (existing !== undefined) {
      prefix = existing;
      continue;
    }
    codes.push(prefix);
    if (nextCode < 4096) {
      dict.set(key, nextCode);
      nextCode += 1;
      if (nextCode > (1 << codeSize) && codeSize < 12) codeSize += 1;
    } else {
      codes.push(clearCode);
      dict = new Map();
      codeSize = minCodeSize + 1;
      nextCode = endCode + 1;
    }
    prefix = char;
  }
  codes.push(prefix);
  codes.push(endCode);

  // Pack variable-width codes, LSB first.
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  let currentSize = minCodeSize + 1;
  let emitted = 0;
  let dictionarySize = endCode + 1;

  for (const code of codes) {
    buffer |= code << bits;
    bits += currentSize;
    while (bits >= 8) {
      out.push(buffer & 0xff);
      buffer >>= 8;
      bits -= 8;
    }
    emitted += 1;
    if (code === clearCode) {
      currentSize = minCodeSize + 1;
      dictionarySize = endCode + 1;
    } else if (code !== endCode) {
      dictionarySize += 1;
      if (dictionarySize > (1 << currentSize) && currentSize < 12) currentSize += 1;
    }
    if (emitted < 0) break;
  }
  if (bits > 0) out.push(buffer & 0xff);
  return Uint8Array.from(out);
}

function writeSubBlocks(writer: ByteWriter, data: Uint8Array) {
  let offset = 0;
  while (offset < data.length) {
    const size = Math.min(255, data.length - offset);
    writer.byte(size);
    for (let i = 0; i < size; i += 1) writer.byte(data[offset + i]);
    offset += size;
  }
  writer.byte(0);
}

export function encodeGif(width: number, height: number, frames: RawFrame[], loop = 0): Uint8Array {
  if (frames.length === 0) throw new Error('encodeGif needs at least one frame');
  const writer = new ByteWriter();
  writer.ascii('GIF89a');
  writer.short(width);
  writer.short(height);
  writer.byte(0xf7); // global colour table, 256 entries
  writer.byte(0);
  writer.byte(0);
  for (const [r, g, b] of PALETTE) {
    writer.byte(r);
    writer.byte(g);
    writer.byte(b);
  }

  // Netscape looping extension.
  writer.byte(0x21);
  writer.byte(0xff);
  writer.byte(0x0b);
  writer.ascii('NETSCAPE2.0');
  writer.byte(0x03);
  writer.byte(0x01);
  writer.short(loop);
  writer.byte(0);

  for (const frame of frames) {
    const delay = Math.max(2, Math.round(frame.delayMs / 10));
    writer.byte(0x21);
    writer.byte(0xf9);
    writer.byte(0x04);
    writer.byte(0x04); // disposal: restore to background
    writer.short(delay);
    writer.byte(0);
    writer.byte(0);

    writer.byte(0x2c);
    writer.short(0);
    writer.short(0);
    writer.short(width);
    writer.short(height);
    writer.byte(0);

    const indices = toIndexed(frame);
    writer.byte(8);
    writeSubBlocks(writer, lzwEncode(indices, 8));
  }

  writer.byte(0x3b);
  return writer.toUint8Array();
}

export function gifBlob(width: number, height: number, frames: RawFrame[]): Blob {
  const bytes = encodeGif(width, height, frames);
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy], { type: 'image/gif' });
}
