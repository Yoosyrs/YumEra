/**
 * YumEra audio synthesis.
 *
 * The YumEra Originals catalogue stores harmony/melody parameters, not audio
 * files. This module renders those parameters into a real 16-bit PCM WAV file in
 * the browser so tracks are genuinely audible, and it also renders the
 * YUMERA SIGNATURE TONE used by in-app notification previews.
 *
 * Everything here is original additive synthesis: no samples, no third-party
 * audio, no copyrighted material.
 */

import type { MusicTrack } from './music';

const SAMPLE_RATE = 22050;

const SCALES: Record<MusicTrack['mode'], number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

function rng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function midiToFreq(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

type Voice = 'pad' | 'bell' | 'bass' | 'pluck' | 'choir';

interface Note {
  start: number;
  duration: number;
  freq: number;
  amp: number;
  voice: Voice;
}

function addNote(buffer: Float32Array, note: Note, sampleRate: number) {
  const startSample = Math.floor(note.start * sampleRate);
  const length = Math.floor(note.duration * sampleRate);
  if (length <= 0 || startSample >= buffer.length) return;

  const attack = note.voice === 'pad' || note.voice === 'choir' ? 0.28 : 0.012;
  const release = note.voice === 'bell' ? 0.9 : note.voice === 'pluck' ? 0.35 : 0.4;
  const partials =
    note.voice === 'bell' ? [1, 2.01, 3.02, 4.71, 6.1] : note.voice === 'pluck' ? [1, 2, 3] : note.voice === 'choir' ? [1, 1.005, 2] : [1, 2, 3, 4];

  for (let i = 0; i < length; i += 1) {
    const index = startSample + i;
    if (index >= buffer.length) break;
    const t = i / sampleRate;
    const progress = i / length;

    let env = 1;
    if (t < attack) env = t / attack;
    else if (progress > 1 - release) env = Math.max(0, (1 - progress) / release);
    if (note.voice === 'bell' || note.voice === 'pluck') env *= Math.exp(-t * (note.voice === 'bell' ? 1.5 : 3.2));

    let sample = 0;
    for (let p = 0; p < partials.length; p += 1) {
      const ratio = partials[p];
      sample += Math.sin(2 * Math.PI * note.freq * ratio * t + p * 0.35) / (p + 1.6);
    }
    buffer[index] += sample * env * note.amp;
  }
}

function addPercussion(buffer: Float32Array, time: number, amp: number, sampleRate: number, kind: 'kick' | 'hat') {
  const length = Math.floor((kind === 'kick' ? 0.22 : 0.06) * sampleRate);
  const start = Math.floor(time * sampleRate);
  const random = rng(Math.floor(time * 1000) + 7);
  for (let i = 0; i < length; i += 1) {
    const index = start + i;
    if (index >= buffer.length) break;
    const t = i / sampleRate;
    if (kind === 'kick') {
      const freq = 110 * Math.exp(-t * 22) + 42;
      buffer[index] += Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 12) * amp;
    } else {
      buffer[index] += (random() * 2 - 1) * Math.exp(-t * 90) * amp * 0.35;
    }
  }
}

/** Render a catalogue track to raw mono PCM. */
export function renderTrackSamples(track: MusicTrack, maxSeconds = 210): Float32Array {
  const duration = Math.min(track.duration, maxSeconds);
  const buffer = new Float32Array(Math.floor(duration * SAMPLE_RATE));
  const random = rng(track.seed * 7919 + track.root);
  const scale = SCALES[track.mode];
  const beat = 60 / track.bpm;
  const bar = beat * 4;
  const totalBars = Math.max(8, Math.floor(duration / bar));

  const progressions = [
    [0, 5, 3, 4],
    [0, 3, 4, 5],
    [0, 4, 5, 3],
    [0, 2, 5, 4],
  ];
  const progression = progressions[Math.floor(random() * progressions.length)];

  const sectionForBar = (index: number) => {
    if (index < 2) return 'intro';
    if (index >= totalBars - 2) return 'outro';
    const cycle = Math.floor((index - 2) / 8) % 2;
    return cycle === 0 ? 'verse' : 'chorus';
  };

  for (let barIndex = 0; barIndex < totalBars; barIndex += 1) {
    const barStart = barIndex * bar;
    const section = sectionForBar(barIndex);
    const degree = progression[barIndex % progression.length];
    const chordRoot = track.root + scale[degree % scale.length] + 12 * Math.floor(degree / scale.length);

    // Pad / choir bed
    const padNotes = [0, 2, 4].map((step) => chordRoot + scale[(degree + step) % scale.length] - track.root + track.root);
    padNotes.forEach((note, index) => {
      addNote(
        buffer,
        {
          start: barStart,
          duration: bar * 1.02,
          freq: midiToFreq(note + (section === 'chorus' ? 12 : 0)),
          amp: section === 'intro' ? 0.1 : 0.075,
          voice: section === 'chorus' ? 'choir' : 'pad',
        },
        SAMPLE_RATE,
      );
      if (index === 0 && section !== 'intro') {
        addNote(buffer, { start: barStart, duration: bar, freq: midiToFreq(note - 12), amp: 0.12, voice: 'bass' }, SAMPLE_RATE);
      }
    });

    // Bass pulse on beats 1 and 3
    addNote(buffer, { start: barStart, duration: beat * 0.9, freq: midiToFreq(chordRoot - 24), amp: 0.16, voice: 'bass' }, SAMPLE_RATE);
    addNote(buffer, { start: barStart + beat * 2, duration: beat * 0.9, freq: midiToFreq(chordRoot - 24), amp: 0.13, voice: 'bass' }, SAMPLE_RATE);

    // Melody / arpeggio
    const density = section === 'chorus' ? 8 : section === 'verse' ? 6 : 4;
    for (let step = 0; step < density; step += 1) {
      if (section === 'intro' && step % 2 === 1) continue;
      if (random() < 0.28) continue;
      const position = barStart + (step * bar) / density;
      const leap = Math.floor(random() * 3) - 1;
      const noteIndex = (degree + 4 + step + leap * 2 + Math.floor(random() * 2)) % (scale.length * 2);
      const octave = noteIndex >= scale.length ? 12 : 0;
      const note = track.root + 12 + scale[noteIndex % scale.length] + octave;
      addNote(
        buffer,
        {
          start: position,
          duration: (bar / density) * (section === 'chorus' ? 0.95 : 0.8),
          freq: midiToFreq(note),
          amp: section === 'outro' ? 0.1 : 0.085,
          voice: section === 'chorus' ? 'bell' : 'pluck',
        },
        SAMPLE_RATE,
      );
    }

    // Gentle percussion
    if (section !== 'intro' && section !== 'outro') {
      addPercussion(buffer, barStart, 0.5, SAMPLE_RATE, 'kick');
      addPercussion(buffer, barStart + beat * 2, 0.4, SAMPLE_RATE, 'kick');
      for (let hat = 0; hat < 4; hat += 1) {
        addPercussion(buffer, barStart + hat * beat + beat / 2, 0.5, SAMPLE_RATE, 'hat');
      }
    }
  }

  // Soft limiter and gentle fade in/out
  const fade = Math.floor(SAMPLE_RATE * 0.8);
  for (let i = 0; i < buffer.length; i += 1) {
    let sample = Math.tanh(buffer[i] * 0.9);
    if (i < fade) sample *= i / fade;
    if (i > buffer.length - fade) sample *= (buffer.length - i) / fade;
    buffer[i] = sample;
  }
  return buffer;
}

export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

const cache = new Map<string, string>();

/** Render (once) and return an object URL for a catalogue track. */
export function trackAudioUrl(track: MusicTrack): string {
  const cached = cache.get(track.id);
  if (cached) return cached;
  const blob = encodeWav(renderTrackSamples(track));
  const url = URL.createObjectURL(blob);
  cache.set(track.id, url);
  return url;
}

export function hasRenderedAudio(trackId: string) {
  return cache.has(trackId);
}

/** YUMERA SIGNATURE TONE — crystalline bell, ~1.7s, original. */
export function signatureToneSamples(): Float32Array {
  const duration = 1.7;
  const buffer = new Float32Array(Math.floor(duration * SAMPLE_RATE));
  const base = midiToFreq(88); // E6
  const partials: Array<[number, number]> = [
    [1, 0.5],
    [2.01, 0.26],
    [3.02, 0.14],
    [4.71, 0.08],
    [6.09, 0.05],
  ];
  partials.forEach(([ratio, amp], index) => {
    const decay = 1.9 - index * 0.18;
    for (let i = 0; i < buffer.length; i += 1) {
      const t = i / SAMPLE_RATE;
      const attack = Math.min(1, t / 0.012);
      buffer[i] += Math.sin(2 * Math.PI * base * ratio * t) * amp * attack * Math.exp(-t * decay);
    }
  });
  // Two shimmer grace notes
  [1.5, 2.0].forEach((offset, index) => {
    const start = Math.floor((0.09 + index * 0.11) * SAMPLE_RATE);
    const freq = base * 1.5;
    for (let i = 0; i < SAMPLE_RATE * 0.6 && start + i < buffer.length; i += 1) {
      const t = i / SAMPLE_RATE;
      buffer[start + i] += Math.sin(2 * Math.PI * freq * t) * 0.12 * Math.exp(-t * 5) * (offset > 1.6 ? 1 : 0.8);
    }
  });
  for (let i = 0; i < buffer.length; i += 1) buffer[i] = Math.tanh(buffer[i] * 1.05) * 0.9;
  return buffer;
}

let toneUrl: string | null = null;

export function signatureToneUrl(): string {
  if (!toneUrl) {
    toneUrl = URL.createObjectURL(encodeWav(signatureToneSamples()));
  }
  return toneUrl;
}

export function toneFromParams(baseFreq: number, waveform: string, decay: number, sparkle: number): Float32Array {
  const duration = Math.max(0.4, decay + 0.2);
  const buffer = new Float32Array(Math.floor(duration * SAMPLE_RATE));
  const partials = waveform === 'glass' ? [1, 2.01, 3.02, 4.7] : waveform === 'bell' ? [1, 2.76, 5.4] : waveform === 'triangle' ? [1, 3, 5] : [1, 2];
  partials.forEach((ratio, index) => {
    for (let i = 0; i < buffer.length; i += 1) {
      const t = i / SAMPLE_RATE;
      buffer[i] += Math.sin(2 * Math.PI * baseFreq * ratio * t) * (0.42 / (index + 1)) * Math.exp(-t * (3.2 / Math.max(0.3, decay)));
    }
  });
  for (let s = 0; s < sparkle; s += 1) {
    const start = Math.floor(0.05 * s * SAMPLE_RATE);
    for (let i = 0; i < SAMPLE_RATE * 0.4 && start + i < buffer.length; i += 1) {
      const t = i / SAMPLE_RATE;
      buffer[start + i] += Math.sin(2 * Math.PI * baseFreq * (2 + s * 0.75) * t) * 0.09 * Math.exp(-t * 7);
    }
  }
  for (let i = 0; i < buffer.length; i += 1) buffer[i] = Math.tanh(buffer[i]);
  return buffer;
}

export function toneUrlFromParams(baseFreq: number, waveform: string, decay: number, sparkle: number): string {
  return URL.createObjectURL(encodeWav(toneFromParams(baseFreq, waveform, decay, sparkle)));
}
