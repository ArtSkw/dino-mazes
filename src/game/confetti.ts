/**
 * Painted confetti (art/CLAUDE_HANDOFF_MOTION.md): leaves and petals burst
 * from a found treasure, flip (their width swings through a brief edge-on
 * sliver, as Codex advised), spin a little and drift down against the air.
 * Each piece's path is a pure function of time (linear drag and gravity), so
 * one counter tween drives a whole burst.
 */
import type Phaser from 'phaser';
import { RIG_ATLAS_KEY, type RigAsset } from './rigData';

const TAU = Math.PI * 2;
const DRAG = 2.2; // 1/s
const LIFE_MS = 1700;

export interface PieceFlight {
  vx: number;
  vy: number;
  gravity: number;
  spin: number; // degrees per second
  flipHz: number;
  phase: number;
}

/** Where a piece is `t` seconds after the burst (offset from the start, px). */
export function pieceOffset(f: PieceFlight, t: number): { x: number; y: number } {
  // Screen y grows downward: v(t) = g/k + (v0 − g/k)·e^(−kt), integrated.
  const e = (1 - Math.exp(-DRAG * t)) / DRAG;
  const terminal = f.gravity / DRAG;
  return { x: f.vx * e, y: (f.vy - terminal) * e + terminal * t };
}

/** A burst of `count` painted pieces from (x, y); `size` is a piece's size on screen. */
export function confettiBurst(scene: Phaser.Scene, asset: RigAsset | null, x: number, y: number, size: number, depth: number, count = 16): void {
  if (!asset || !scene.textures.exists(RIG_ATLAS_KEY) || !asset.parts.length) return;
  const [cw, ch] = asset.canvas;
  // The sheet is laid out three pieces across: a piece is about a third of its width.
  const scale = size / Math.max(1, asset.size[0] / 3);
  const rand = (a: number, b: number): number => a + Math.random() * (b - a);
  const pieces = Array.from({ length: count }, (_, i) => {
    const part = asset.parts[i % asset.parts.length]!;
    const img = scene.add
      .image(x, y, RIG_ATLAS_KEY, part.frame)
      .setOrigin(part.pivot[0] / cw, part.pivot[1] / ch)
      .setDepth(depth)
      .setScale(scale)
      .setAngle(rand(0, 360));
    // A fan that opens upward and to the sides.
    const a = rand(-170, -10) * (Math.PI / 180);
    const speed = rand(5, 9) * size;
    const f: PieceFlight = { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, gravity: size * 14, spin: rand(-240, 240), flipHz: rand(1.2, 2.4), phase: rand(0, TAU) };
    return { img, f, a0: img.angle };
  });
  scene.tweens.addCounter({
    from: 0,
    to: LIFE_MS,
    duration: LIFE_MS,
    onUpdate: (tw) => {
      const ms = tw.getValue() ?? 0;
      const t = ms / 1000;
      const fade = Math.min(1, Math.max(0, (LIFE_MS - ms) / (LIFE_MS * 0.3)));
      for (const p of pieces) {
        if (!p.img.active) continue;
        const o = pieceOffset(p.f, t);
        p.img
          .setPosition(x + o.x, y + o.y)
          .setAngle(p.a0 + p.f.spin * t)
          .setScale(scale * Math.cos(TAU * p.f.flipHz * t + p.f.phase), scale)
          .setAlpha(fade);
      }
    },
    onComplete: () => {
      for (const p of pieces) p.img.destroy();
    },
  });
}
