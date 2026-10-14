/**
 * Motion helpers shared by the scene and the opening (docs/MOTION_PROPOSAL.md):
 * every value is a pure function of time, so a frame can be rendered at any
 * moment and tested without a running game.
 */
import type Phaser from 'phaser';

/**
 * Step response of a damped spring, rising from 0 to rest at 1.
 * `zeta` is the damping ratio (below 1 overshoots), `freq` the natural
 * frequency in Hz, `t` the time in seconds.
 */
export function spring(t: number, zeta: number, freq: number): number {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
}

/** When an underdamped spring first reaches its rest value (seconds). */
export function firstArrival(zeta: number, freq: number): number {
  const z = Math.min(0.99, Math.max(0.01, zeta));
  const wd = 2 * Math.PI * freq * Math.sqrt(1 - z * z);
  return (Math.PI - Math.atan(Math.sqrt(1 - z * z) / z)) / wd;
}

/** Time until the spring's swing has died down below `settle` (seconds). */
export function settleTime(zeta: number, freq: number, settle = 0.004): number {
  return -Math.log(settle) / (Math.max(0.05, Math.min(1, zeta)) * 2 * Math.PI * freq);
}

export interface PinnedPopUp {
  /** Total duration in milliseconds. */
  duration: number;
  /** Arrival time in milliseconds (the base reaches its resting place). */
  arrival: number;
  /** Travel progress 0 → 1 for normalized time v (0..1); stays 1 after arrival. */
  travel(v: number): number;
  /** Stretch (positive) or squash (negative) as a fraction of height, for v (0..1). */
  stretch(v: number): number;
}

/**
 * A pop-up whose base stays pinned. The characters are busts cut flat at the
 * waist, and that edge must never rise above the screen. A plain springy rise
 * overshoots and lifts it into view, so here the spring moves the sprite
 * until it first arrives, and from then on its overshoot and ringing turn into
 * stretch and squash around the base: the head still bounces, the cut does not.
 * `amount` scales the spring's swing into stretch.
 */
export function pinnedPopUp(zeta: number, freq: number, amount: number): PinnedPopUp {
  const t1 = firstArrival(zeta, freq);
  const total = Math.max(t1 * 1.2, settleTime(zeta, freq));
  return {
    duration: Math.round(total * 1000),
    arrival: Math.round(t1 * 1000),
    travel(v: number): number {
      const t = v * total;
      return t >= t1 ? 1 : spring(t, zeta, freq);
    },
    stretch(v: number): number {
      if (v >= 1) return 0;
      const t = v * total;
      if (t < t1) return 0;
      // The last ringing is tiny; taper it to exactly 0 so the end never snaps.
      const u = Math.min(1, Math.max(0, (v - 0.8) / 0.2));
      return (spring(t, zeta, freq) - 1) * amount * (1 - u * u * (3 - 2 * u));
    },
  };
}

export interface PopUpOptions {
  /** Resting y of the sprite's base (its origin is at the bottom). */
  restY: number;
  /** Resting scale. */
  scale: number;
  zeta: number;
  freq: number;
  amount: number;
  delay?: number;
}

/**
 * Play a pinned pop-up on a bottom-anchored sprite from wherever it is now
 * (below the screen) to `restY`. Taller also means a little narrower, so the
 * body keeps its volume. Returns the timing for syncing sparkles and sounds.
 */
export function popUp(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, o: PopUpOptions): PinnedPopUp {
  const p = pinnedPopUp(o.zeta, o.freq, o.amount);
  const base = { targets: sprite, duration: p.duration, delay: o.delay ?? 0 };
  sprite.setScale(o.scale);
  scene.tweens.add({ ...base, y: o.restY, ease: (v: number) => p.travel(v) });
  // value = start + (end - start) · ease: scale · (1 + s) and scale · (1 − 0.4 s).
  scene.tweens.add({ ...base, scaleY: o.scale * 2, ease: (v: number) => p.stretch(v) });
  scene.tweens.add({ ...base, scaleX: o.scale * 0.6, ease: (v: number) => p.stretch(v) });
  return p;
}
