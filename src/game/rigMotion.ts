/**
 * How the painted parts of each treasure move (rig.ts draws them). Pure
 * functions of time, so they can be tested without a game: idle motion stays
 * within the amplitudes Codex reviewed (art/CLAUDE_HANDOFF_TREASURES.md,
 * art/CLAUDE_HANDOFF_MOTION.md), and each celebration starts and ends on the
 * idle pose.
 */
import type { TreasureId } from '../domain/types';
import { spring } from './motion';

/**
 * A part's pose relative to rest: degrees, uniform scale, extra vertical
 * scale (squash/stretch), alpha factor, offsets as fractions of the canvas
 * height, and `glow` (additive light).
 */
export interface PartPose {
  angle: number;
  scale: number;
  sy: number;
  alpha: number;
  dx: number;
  dy: number;
  glow: number;
}

/** Seconds a celebration choreography lasts before the idle motion takes over again. */
export const CELEBRATION_S = 4;

/** Parts that carry an additive light layer (only these can glow). */
export const GLOW_PARTS: Partial<Record<TreasureId, string[]>> = {
  amber: ['body'],
  gigaflower: ['center'],
  crystal: ['crystal-1', 'crystal-2', 'crystal-3'],
};

/**
 * Parts that ride on another part (rotate and scale with it about its pivot):
 * the coconut's tuft on the husk, the strawberry's cap on the berry.
 */
export const PARENTS: Partial<Record<TreasureId, Record<string, string>>> = {
  coconut: { tuft: 'body' },
  strawberry: { cap: 'body' },
};

/** Treasures whose whole body hops on find (the stand-in still does the hop). */
export const HOPPERS: ReadonlySet<TreasureId> = new Set(['strawberry']);

const TAU = Math.PI * 2;
const REST: PartPose = { angle: 0, scale: 1, sy: 1, alpha: 1, dx: 0, dy: 0, glow: 0 };
const decay = (c: number, rate: number): number => Math.exp(-rate * Math.max(0, c));
/** Smooth 0 → 1 → 0 bump over [start, start + length]. */
const bump = (x: number, start: number, length: number): number => {
  const u = (x - start) / length;
  return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u);
};
const smooth = (a: number, b: number, x: number): number => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const index = (name: string): number => Number(name.split('-')[1] ?? 0);
/** Damped wobble that starts at `start` seconds into the celebration. */
const wobble = (c: number | null, start: number, amp: number, rate: number, hz: number): number =>
  c === null || c < start ? 0 : amp * decay(c - start, rate) * Math.sin(TAU * hz * (c - start));

/** A flower's petals sway out of step; on find it closes, then blooms petal by petal. */
function bloom(part: string, t: number, c: number | null, petalSway: number, centerGlow: number): Partial<PartPose> {
  if (part.startsWith('petal')) {
    const i = index(part);
    const sway = petalSway * Math.sin((TAU * t) / 2.8 + i * 1.05);
    if (c === null) return { angle: sway };
    const closed = c < 0.25 ? smooth(0, 0.15, c) : 1 - spring(c - 0.25 - 0.06 * (i - 1), 0.45, 2.4);
    return { angle: sway - 20 * closed, scale: 1 - 0.7 * closed };
  }
  if (part === 'center') {
    const breathe = 1 + 0.03 * Math.sin((TAU * t) / 2.2);
    if (c === null) return { scale: breathe };
    // The centre grows with the bloom (Codex: full-size stamens look odd on closed petals).
    const k = c < 0.25 ? 1 - 0.55 * smooth(0, 0.15, c) : 0.45 + 0.55 * spring(c - 0.4, 0.35, 2.4);
    return { scale: breathe * k, glow: centerGlow * bump(c, 0.45, 0.7) };
  }
  if (part === 'leaf-left' || part === 'leaf-right') {
    const side = part === 'leaf-left' ? 1 : -1;
    return { angle: side * 2 * Math.sin((TAU * t) / 3.3 + (side > 0 ? 0 : 0.9)) };
  }
  return {};
}

/**
 * Part motion per treasure: `t` seconds since the rig appeared, `c` seconds
 * since the celebration started (null before and after it).
 */
export const RIG_MOTION: Partial<Record<TreasureId, (part: string, t: number, c: number | null) => Partial<PartPose>>> = {
  // The whole feather sways on its quill; the vanes ruffle a little, out of
  // step. On find it swings like a pendulum and settles.
  feather: (part, t, c) => {
    const swing = c === null ? 0 : 12 * decay(c, 1.7) * Math.sin(TAU * 1.1 * c);
    const whole = 2 * Math.sin((TAU * t) / 3.4) + swing;
    if (part === 'quill') return { angle: whole };
    const side = part === 'vane-left' ? 1 : -1;
    const ruffle = 1.2 * Math.sin((TAU * t) / 1.9 + (side > 0 ? 0 : 1.3)) + (c === null ? 0 : 1.3 * decay(c, 3) * Math.sin(TAU * 3 * c));
    return { angle: whole + side * ruffle };
  },
  // Warm light breathes in the amber; the fern leaf inside sways a hair. On
  // find the highlight flares and the leaf wiggles.
  amber: (part, t, c) => {
    if (part === 'glint') {
      const flare = c === null ? 0 : bump(c, 0.05, 0.7);
      return { alpha: 0.75 + 0.25 * Math.sin((TAU * t) / 2.6) + 0.5 * flare, scale: 1 + 0.12 * flare, dx: 0.0065 * Math.sin((TAU * t) / 5.2), dy: 0.0044 * Math.sin((TAU * t) / 4.1) };
    }
    if (part === 'leaf') return { angle: 2 * Math.sin((TAU * t) / 3.1) + wobble(c, 0, 5, 2, 1.6) };
    if (part === 'body') return { glow: 0.06 + 0.06 * Math.sin((TAU * t) / 2.6) + (c === null ? 0 : 0.3 * bump(c, 0, 0.9)) };
    return {};
  },
  gigaflower: (part, t, c) => bloom(part, t, c, 3, 0.4),
  // Glints twinkle gently; on find the crystals light up one after another,
  // from the tallest, and the glints flash.
  crystal: (part, t, c) => {
    if (part === 'glint') {
      const twinkle = 0.6 + 0.8 * (0.5 + 0.5 * Math.sin((TAU * t) / 2.4));
      return { alpha: twinkle + (c === null ? 0 : 2.6 * bump(c, 0.5, 0.5)) };
    }
    if (part.startsWith('crystal')) {
      const i = index(part);
      return { glow: 0.05 * (0.5 + 0.5 * Math.sin((TAU * t) / 3 + i)) + (c === null ? 0 : 0.55 * bump(c, 0.08 + 0.16 * (i - 1), 0.42)) };
    }
    return {};
  },
  // The husk rocks gently (±3°, on find up to ±9°) while its sheen stays put;
  // the tuft rides on the husk and lags a little behind (at most ±5°).
  coconut: (part, t, c) => {
    if (part === 'body') return { angle: 3 * Math.sin((TAU * t) / 3.6) + wobble(c, 0, 9, 1.6, 1.15) };
    if (part === 'tuft') return { angle: 2.5 * Math.sin((TAU * t) / 2.1 + 0.8) + wobble(c, 0.12, 2.5, 2, 1.15) };
    if (part === 'highlight') return { alpha: 0.9 + 0.1 * Math.sin((TAU * t) / 3.6) };
    return {};
  },
  // The nut nestles in its cup; on find it hops up out of the cup (at most
  // 6 % of the canvas, Codex's limit), lands with a squash and the cup flutters.
  nut: (part, t, c) => {
    if (part === 'nut') {
      const lift = c === null ? 0 : 0.055 * bump(c, 0.05, 0.42) + 0.022 * bump(c, 0.55, 0.26);
      const squash = c === null ? 0 : 0.1 * bump(c, 0.44, 0.14) + 0.05 * bump(c, 0.8, 0.12);
      return { dy: -0.003 * (0.5 + 0.5 * Math.sin((TAU * t) / 2.4)) - lift, sy: 1 - squash, scale: 1 + 0.5 * squash };
    }
    if (part === 'cup') return { angle: 1 * Math.sin((TAU * t) / 3.2) + wobble(c, 0.46, 3, 2.5, 2.2) };
    return {};
  },
  flower: (part, t, c) => bloom(part, t, c, 2.5, 0),
  // Each berry breathes on its own; on find they jiggle like jelly, one
  // after another (85 to 115 %), and the leaves flutter.
  berries: (part, t, c) => {
    if (part.startsWith('berry')) {
      const i = index(part);
      const idle = 1 + 0.025 * Math.sin((TAU * t) / 1.9 + i * 1.3);
      const j = wobble(c, 0.05 * (i - 1), 0.12, 2.6, 2.4);
      return { scale: idle * (1 + j), sy: 1 - 0.5 * j };
    }
    if (part === 'leaves') return { angle: 1.5 * Math.sin((TAU * t) / 2.7) + wobble(c, 0.1, 3, 2.2, 1.8) };
    return {};
  },
  // The strawberry hops on find (the stand-in still jumps), squashes on
  // landing, and its leafy cap lags and flutters (±6°, Codex's review).
  strawberry: (part, t, c) => {
    if (part === 'body') {
      const squash = c === null ? 0 : 0.1 * bump(c, 0.36, 0.2);
      return { sy: 1 - squash, scale: 1 + 0.4 * squash };
    }
    if (part === 'cap') return { angle: 2 * Math.sin((TAU * t) / 2.9) + wobble(c, 0.38, 4, 2.4, 1.7) };
    if (part === 'glint') return { alpha: 0.85 + 0.15 * Math.sin((TAU * t) / 3.1) };
    return {};
  },
};

export function poseOf(id: TreasureId, part: string, t: number, c: number | null): PartPose {
  return { ...REST, ...(RIG_MOTION[id]?.(part, t, c) ?? {}) };
}
