import { describe, expect, it } from 'vitest';
import { CELEBRATION_S, RIG_MOTION, poseOf } from '../../src/game/rigMotion';
import { ASSETS, treasureRig } from '../../src/game/assets';
import type { TreasureId } from '../../src/domain/types';

const RIGGED = Object.keys(RIG_MOTION) as TreasureId[];
const partsOf = (id: TreasureId): string[] => treasureRig(id)?.parts.map((p) => p.name) ?? [];
const times = (from: number, to: number, step: number): number[] => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

describe('treasure rigs: assets', () => {
  it('every rig in the manifest has its motion, its still image and its parts in one atlas', () => {
    const rigs = ASSETS.treasureRigs?.rigs ?? {};
    expect(Object.keys(rigs).sort()).toEqual([...RIGGED].sort());
    for (const id of RIGGED) {
      const rig = treasureRig(id)!;
      expect(ASSETS.treasures[id], id).toBeDefined();
      expect(rig.atlas).toBe(ASSETS.treasureRigs?.atlas);
      // The rig's origin is the centre of the still, inside its canvas.
      expect(rig.origin[0]).toBeGreaterThan(0);
      expect(rig.origin[0]).toBeLessThan(rig.canvas[0]);
      // The still and the assembled rig have the same size.
      expect(Math.max(...rig.size)).toBeCloseTo(Math.max(ASSETS.treasures[id]!.width, ASSETS.treasures[id]!.height), 0);
    }
  });
});

describe('treasure rigs: motion stays within what Codex reviewed', () => {
  it('idle: feather vanes move at most ±2.5° against the quill, petals ±3°, leaves ±2°', () => {
    for (const t of times(0, 30, 0.05)) {
      const quill = poseOf('feather', 'quill', t, null).angle;
      for (const v of ['vane-left', 'vane-right']) expect(Math.abs(poseOf('feather', v, t, null).angle - quill)).toBeLessThanOrEqual(2.5);
      expect(Math.abs(quill)).toBeLessThanOrEqual(2.01);
      for (let i = 1; i <= 6; i++) expect(Math.abs(poseOf('gigaflower', `petal-${i}`, t, null).angle)).toBeLessThanOrEqual(3.01);
      for (const l of ['leaf-left', 'leaf-right']) expect(Math.abs(poseOf('gigaflower', l, t, null).angle)).toBeLessThanOrEqual(2.01);
      expect(Math.abs(poseOf('amber', 'leaf', t, null).angle)).toBeLessThanOrEqual(2.01);
    }
  });

  it('celebration: feather vanes stay within ±2.5° of the quill while the whole feather swings', () => {
    for (const c of times(0, CELEBRATION_S, 0.01)) {
      const quill = poseOf('feather', 'quill', 1.7, c).angle;
      for (const v of ['vane-left', 'vane-right']) expect(Math.abs(poseOf('feather', v, 1.7, c).angle - quill)).toBeLessThanOrEqual(2.5);
    }
  });

  it('a celebration starts and ends on the idle pose (no jumps)', () => {
    for (const id of RIGGED) {
      for (const part of partsOf(id)) {
        for (const t of [0.3, 1.9, 7.4]) {
          const idle = poseOf(id, part, t, null);
          for (const c of [0, CELEBRATION_S - 0.001]) {
            const p = poseOf(id, part, t, c);
            expect(Math.abs(p.angle - idle.angle), `${id}/${part} angle at c=${c}`).toBeLessThan(0.3);
            expect(Math.abs(p.scale - idle.scale), `${id}/${part} scale at c=${c}`).toBeLessThan(0.02);
            expect(Math.abs(p.alpha - idle.alpha), `${id}/${part} alpha at c=${c}`).toBeLessThan(0.05);
            expect(Math.abs(p.glow - idle.glow), `${id}/${part} glow at c=${c}`).toBeLessThan(0.07);
          }
        }
      }
    }
  });

  it('the giga flower closes, then has bloomed fully before the treasure flies to the collection (1.1 s)', () => {
    expect(poseOf('gigaflower', 'petal-3', 0, 0.2).scale).toBeLessThan(0.4);
    for (let i = 1; i <= 6; i++) expect(poseOf('gigaflower', `petal-${i}`, 0, 1.05).scale, `petal-${i}`).toBeGreaterThan(0.93);
  });
});
