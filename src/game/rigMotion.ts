/**
 * How the painted parts of each treasure move (treasureRig.ts draws them).
 * Pure functions of time, so they can be tested without a game: idle motion
 * stays within the amplitudes Codex reviewed (art/CLAUDE_HANDOFF_TREASURES.md:
 * feather vanes about ±2°, petals about ±3°, glints as gentle pulses), and
 * each celebration starts and ends on the idle pose.
 */
import type { TreasureId } from '../domain/types';
import { spring } from './motion';

/** A part's pose relative to rest: degrees, scale factor, alpha factor, canvas px; `glow` adds light. */
export interface PartPose {
  angle: number;
  scale: number;
  alpha: number;
  dx: number;
  dy: number;
  glow: number;
}

/** Seconds a celebration choreography lasts before the idle motion takes over again. */
export const CELEBRATION_S = 4;

const TAU = Math.PI * 2;
const REST: PartPose = { angle: 0, scale: 1, alpha: 1, dx: 0, dy: 0, glow: 0 };
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
      return { alpha: 0.75 + 0.25 * Math.sin((TAU * t) / 2.6) + 0.5 * flare, scale: 1 + 0.12 * flare, dx: 3 * Math.sin((TAU * t) / 5.2), dy: 2 * Math.sin((TAU * t) / 4.1) };
    }
    if (part === 'leaf') return { angle: 2 * Math.sin((TAU * t) / 3.1) + (c === null ? 0 : 5 * decay(c, 2) * Math.sin(TAU * 1.6 * c)) };
    if (part === 'body') return { glow: 0.06 + 0.06 * Math.sin((TAU * t) / 2.6) + (c === null ? 0 : 0.3 * bump(c, 0, 0.9)) };
    return {};
  },
  // Petals sway out of step. On find the flower closes for a moment, then
  // blooms: petals open one after another on a spring and the centre pops.
  gigaflower: (part, t, c) => {
    if (part.startsWith('petal')) {
      const i = index(part);
      const sway = 3 * Math.sin((TAU * t) / 2.8 + i * 1.05);
      if (c === null) return { angle: sway };
      const closed = c < 0.25 ? smooth(0, 0.15, c) : 1 - spring(c - 0.25 - 0.06 * (i - 1), 0.45, 2.4);
      return { angle: sway - 20 * closed, scale: 1 - 0.7 * closed };
    }
    if (part === 'center') {
      const breathe = 1 + 0.03 * Math.sin((TAU * t) / 2.2);
      if (c === null) return { scale: breathe };
      const k = c < 0.25 ? 1 - 0.45 * smooth(0, 0.15, c) : 0.55 + 0.45 * spring(c - 0.4, 0.35, 2.4);
      return { scale: breathe * k, glow: 0.4 * bump(c, 0.45, 0.7) };
    }
    if (part === 'leaf-left' || part === 'leaf-right') {
      const side = part === 'leaf-left' ? 1 : -1;
      return { angle: side * 2 * Math.sin((TAU * t) / 3.3 + (side > 0 ? 0 : 0.9)) };
    }
    return {};
  },
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
};

export function poseOf(id: TreasureId, part: string, t: number, c: number | null): PartPose {
  return { ...REST, ...(RIG_MOTION[id]?.(part, t, c) ?? {}) };
}
