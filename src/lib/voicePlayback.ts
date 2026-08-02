/**
 * Shared voice-note playback state:
 *  - resume positions per note (survives unmount / route change)
 *  - decoded waveform peaks cache (memory + sessionStorage)
 */

const positions = new Map<string, number>();

export const getResumePosition = (key: string): number => positions.get(key) ?? 0;
export const setResumePosition = (key: string, time: number) => {
  if (isFinite(time) && time >= 0) positions.set(key, time);
};
export const clearResumePosition = (key: string) => positions.delete(key);

const peaksMemory = new Map<string, number[]>();
const inflight = new Map<string, Promise<number[] | null>>();

const storageKey = (key: string, bars: number) => `gd-peaks:${bars}:${key}`;

const readStored = (key: string, bars: number): number[] | null => {
  try {
    const raw = sessionStorage.getItem(storageKey(key, bars));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length === bars ? parsed : null;
  } catch {
    return null;
  }
};

const writeStored = (key: string, bars: number, peaks: number[]) => {
  try {
    sessionStorage.setItem(storageKey(key, bars), JSON.stringify(peaks));
  } catch {
    /* quota — ignore */
  }
};

/** Deterministic fallback bars derived from the URL (used until/if decoding fails). */
export const pseudoPeaks = (key: string, bars: number): number[] => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const seed = Math.abs(Math.sin(hash * (i + 1)) * 10000);
    const envelope = 0.55 + 0.45 * Math.sin((i / bars) * Math.PI);
    const raw = 0.25 + (seed % 75) / 100;
    out.push(Math.min(1, raw * envelope + 0.15));
  }
  return out;
};

/** Decode real amplitude peaks once per note; cached in memory + sessionStorage. */
export const loadPeaks = async (
  cacheKey: string,
  url: string,
  bars: number
): Promise<number[] | null> => {
  const mem = peaksMemory.get(storageKey(cacheKey, bars));
  if (mem) return mem;

  const stored = readStored(cacheKey, bars);
  if (stored) {
    peaksMemory.set(storageKey(cacheKey, bars), stored);
    return stored;
  }

  const running = inflight.get(storageKey(cacheKey, bars));
  if (running) return running;

  const task = (async (): Promise<number[] | null> => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const ctx = new Ctx();
      const audio: AudioBuffer = await ctx.decodeAudioData(buf.slice(0));
      const channel = audio.getChannelData(0);
      const block = Math.floor(channel.length / bars) || 1;
      const raw: number[] = [];
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        const start = i * block;
        for (let j = 0; j < block; j++) {
          const v = channel[start + j] || 0;
          sum += v * v;
        }
        raw.push(Math.sqrt(sum / block));
      }
      try { ctx.close(); } catch { /* noop */ }
      const max = Math.max(...raw, 0.0001);
      const peaks = raw.map((v) => Math.max(0.12, Math.min(1, (v / max) ** 0.75)));
      peaksMemory.set(storageKey(cacheKey, bars), peaks);
      writeStored(cacheKey, bars, peaks);
      return peaks;
    } catch {
      return null;
    } finally {
      inflight.delete(storageKey(cacheKey, bars));
    }
  })();

  inflight.set(storageKey(cacheKey, bars), task);
  return task;
};
