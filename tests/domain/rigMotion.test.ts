import { describe, expect, it } from 'vitest';
import { CELEBRATION_S, GLOW_PARTS, PARENTS, RIG_MOTION, poseOf } from '../../src/game/rigMotion';
import { ASSETS, rigFor } from '../../src/game/assets';
import type { TreasureId } from '../../src/domain/types';

const RIGGED = Object.keys(RIG_MOTION) as TreasureId[];
const partsOf = (id: string): string[] => rigFor(id)?.parts.map((p) => p.name) ?? [];
const times = (from: number, to: number, step: number): number[] => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const maxOver = (ts: number[], f: (t: number) => number): number => Math.max(...ts.map((t) => Math.abs(f(t))));
const IDLE = times(0, 30, 0.05);
const CEL = times(0, CELEBRATION_S, 0.01);

describe('rigs: assets', () => {
  it('every rigged treasure has its motion, still image and parts; the butterfly has its perched pose', () => {
    const assets = ASSETS.rigs?.assets ?? {};
    expect(Object.keys(assets).sort()).toEqual([...RIGGED, 'butterfly'].sort());
    for (const id of RIGGED) {
      const rig = rigFor(id)!;
      expect(ASSETS.treasures[id], id).toBeDefined();
      expect(rig.origin[0]).toBeGreaterThan(0);
      expect(rig.origin[0]).toBeLessThan(rig.canvas[0]);
      // The still and the assembled rig have the same size.
      expect(Math.max(...rig.size)).toBeCloseTo(Math.max(ASSETS.treasures[id]!.width, ASSETS.treasures[id]!.height), 0);
      for (const g of GLOW_PARTS[id] ?? []) expect(partsOf(id), `${id} glow ${g}`).toContain(g);
      for (const [child, parent] of Object.entries(PARENTS[id] ?? {})) expect(partsOf(id), id).toEqual(expect.arrayContaining([child, parent]));
    }
    const fly = rigFor('butterfly')!;
    expect(partsOf('butterfly').filter((n) => n.startsWith('wing-'))).toHaveLength(4);
    expect(fly.poses?.['perched']).toBeDefined();
    expect(ASSETS.foliage['butterfly']).toBeDefined();
  });

  it('the chest for the collection button: closed layers, open pose and the lid hinge on the right', () => {
    const c = ASSETS.chest!;
    for (const k of ['base', 'lid', 'open'] as const) expect(c[k], k).toMatch(/^assets\/ui\/chest-/);
    expect(c.lidPivot![0]).toBeGreaterThan(0.5);
  });
});

describe('rigs: motion stays within what Codex reviewed', () => {
  it('feather: vanes at most ±2.5° against the quill, idle and on find', () => {
    for (const c of [null, ...CEL]) {
      for (const t of c === null ? IDLE : [1.7]) {
        const quill = poseOf('feather', 'quill', t, c).angle;
        for (const v of ['vane-left', 'vane-right']) expect(Math.abs(poseOf('feather', v, t, c).angle - quill)).toBeLessThanOrEqual(2.5);
      }
    }
  });

  it('petals ±3° (giga flower) and ±2.5° (flower) idle; leaves ±2°', () => {
    for (let i = 1; i <= 6; i++) expect(maxOver(IDLE, (t) => poseOf('gigaflower', `petal-${i}`, t, null).angle)).toBeLessThanOrEqual(3.01);
    for (let i = 1; i <= 5; i++) expect(maxOver(IDLE, (t) => poseOf('flower', `petal-${i}`, t, null).angle)).toBeLessThanOrEqual(2.51);
    for (const id of ['flower', 'gigaflower'] as const) for (const l of ['leaf-left', 'leaf-right']) expect(maxOver(IDLE, (t) => poseOf(id, l, t, null).angle)).toBeLessThanOrEqual(2.01);
  });

  it('coconut: husk ±3° idle and at most ±10° on find; the tuft adds at most ±5°; the sheen never turns', () => {
    expect(maxOver(IDLE, (t) => poseOf('coconut', 'body', t, null).angle)).toBeLessThanOrEqual(3.01);
    expect(maxOver(CEL, (c) => poseOf('coconut', 'body', 0, c).angle)).toBeLessThanOrEqual(10);
    expect(maxOver(CEL, (c) => poseOf('coconut', 'tuft', 0.4, c).angle)).toBeLessThanOrEqual(5);
    expect(maxOver(CEL, (c) => poseOf('coconut', 'highlight', 0, c).angle)).toBe(0);
  });

  it('nut: lifts out of its cup by at most 6 % of the canvas', () => {
    expect(maxOver([...CEL, ...IDLE.map((t) => t)], (x) => poseOf('nut', 'nut', x, x <= CELEBRATION_S ? x : null).dy)).toBeLessThanOrEqual(0.06);
  });

  it('berries: each berry stays between 85 and 115 %', () => {
    for (let i = 1; i <= 5; i++) {
      for (const c of [null, ...CEL]) {
        for (const t of c === null ? IDLE : [0.9]) {
          const p = poseOf('berries', `berry-${i}`, t, c);
          for (const s of [p.scale, p.scale * p.sy]) {
            expect(s).toBeGreaterThanOrEqual(0.85);
            expect(s).toBeLessThanOrEqual(1.15);
          }
        }
      }
    }
  });

  it("strawberry: the cap swings at most ±6° on the berry", () => {
    expect(maxOver(CEL, (c) => poseOf('strawberry', 'cap', 1.1, c).angle)).toBeLessThanOrEqual(6);
    expect(maxOver(IDLE, (t) => poseOf('strawberry', 'cap', t, null).angle)).toBeLessThanOrEqual(2.01);
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
            expect(Math.abs(p.sy - idle.sy), `${id}/${part} sy at c=${c}`).toBeLessThan(0.02);
            expect(Math.abs(p.dy - idle.dy), `${id}/${part} dy at c=${c}`).toBeLessThan(0.005);
            expect(Math.abs(p.alpha - idle.alpha), `${id}/${part} alpha at c=${c}`).toBeLessThan(0.05);
            expect(Math.abs(p.glow - idle.glow), `${id}/${part} glow at c=${c}`).toBeLessThan(0.07);
          }
        }
      }
    }
  });

  it('flowers close, then have bloomed before the treasure flies to the collection (1.1 s)', () => {
    for (const [id, n] of [['gigaflower', 6], ['flower', 5]] as const) {
      expect(poseOf(id, 'petal-3', 0, 0.2).scale).toBeLessThan(0.4);
      for (let i = 1; i <= n; i++) expect(poseOf(id, `petal-${i}`, 0, 1.05).scale, `${id} petal-${i}`).toBeGreaterThan(0.93);
    }
  });
});
