/**
 * Seeded pseudo-random numbers. Pure, deterministic and browser-independent.
 *
 * Separate named streams (e.g. "layout" vs "decor") are derived from one seed so
 * that cosmetic randomness can change without altering maze routes.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Uniform float in [a, b). */
  range(a: number, b: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

/** cyrb128 string hash → four 32-bit words. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** sfc32 generator: small, fast, good statistical quality. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string, stream = 'main'): Rng {
  const [a, b, c, d] = cyrb128(`${seed}::${stream}`);
  const raw = sfc32(a, b, c, d);
  // Warm up to decorrelate similar seeds.
  for (let i = 0; i < 12; i++) raw();
  const rng: Rng = {
    next: raw,
    int: (n) => Math.floor(raw() * n),
    range: (lo, hi) => lo + raw() * (hi - lo),
    chance: (p) => raw() < p,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('pick from empty list');
      return items[Math.floor(raw() * items.length)] as T;
    },
    shuffle: <T>(items: readonly T[]): T[] => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(raw() * (i + 1));
        const tmp = out[i] as T;
        out[i] = out[j] as T;
        out[j] = tmp;
      }
      return out;
    },
  };
  return rng;
}

/** Short stable hash string, for layout fingerprints and debug output. */
export function hashString(input: string): string {
  const [a, b] = cyrb128(input);
  return a.toString(36) + b.toString(36);
}

/** Fresh random seed string for a new session (uses crypto when available). */
export function freshSeed(): string {
  const bytes = new Uint32Array(2);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Math.floor(Math.random() * 2 ** 32);
    bytes[1] = Math.floor(Math.random() * 2 ** 32);
  }
  return `${(bytes[0] ?? 0).toString(36)}${(bytes[1] ?? 0).toString(36)}`;
}
