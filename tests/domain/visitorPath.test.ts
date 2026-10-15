import { describe, expect, it } from 'vitest';
import { computeLayout, fitGrid, overlapsRect } from '../../src/platform/layout';
import { friendFrame } from '../../src/game/assets';
import { VISITOR_KINDS, planVisit, visitDuration, visitPose, visitorRails } from '../../src/game/visitorPath';
import type { CharacterId } from '../../src/domain/types';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const VIEWPORTS: Array<[number, number]> = [[1180, 820], [1366, 768], [1024, 768], [1440, 900], [1280, 720]];
const layoutFor = (vw: number, vh: number, id: CharacterId = 'tiny') =>
  computeLayout({ vw, vh, grid: fitGrid('expert', vw, vh).grid, entranceSide: 'bottom', friend: friendFrame(id) });

describe('jungle visitors at the screen edges', () => {
  it('rails sit beside the board, clear of the corner buttons, the friend and "Wróć"; none in portrait', () => {
    for (const [vw, vh] of VIEWPORTS) {
      for (const id of ['tiny', 'giganto'] as const) {
        const L = layoutFor(vw, vh, id);
        const rails = visitorRails(L, 40);
        expect(rails.length, `${vw}x${vh}`).toBeGreaterThan(0);
        for (const r of rails) {
          const rect = { x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 };
          for (const ui of [L.board, L.hint, L.clusterRect, L.home, L.reset, L.friendVisible]) expect(overlapsRect(rect, ui), `${vw}x${vh} ${r.side}`).toBe(false);
        }
      }
    }
    expect(visitorRails(computeLayout({ vw: 820, vh: 1180, grid: { cols: 7, rows: 7 }, entranceSide: 'bottom' }), 40)).toEqual([]);
  });

  it('every visit comes from beyond the edge, stays on its strip and leaves the screen', () => {
    for (const [vw, vh] of VIEWPORTS) {
      const L = layoutFor(vw, vh);
      for (const rail of visitorRails(L, 40)) {
        for (const kind of VISITOR_KINDS) {
          for (let seed = 1; seed <= 25; seed++) {
            const v = planVisit(kind, rail, vw, 40, rng(seed * 7 + vw));
            const total = visitDuration(v);
            expect(total, kind).toBeGreaterThan(3);
            expect(total, kind).toBeLessThan(18);
            const off = (x: number): boolean => x < 0 || x > vw;
            expect(off(v.enter.x) && off(v.exit.x), kind).toBe(true);
            for (let t = 0; t <= total; t += 0.05) {
              const p = visitPose(v, t);
              // Never over the board: always on its own side of the strip's inner edge.
              if (rail.side === 'left') expect(p.x, `${kind} t=${t}`).toBeLessThanOrEqual(rail.x1);
              else expect(p.x, `${kind} t=${t}`).toBeGreaterThanOrEqual(rail.x0);
              // Below the buttons and above the friend / "Wróć" (a flying ladybug may rise).
              if (kind !== 'ladybug' || p.wings === 0) {
                expect(p.y).toBeGreaterThanOrEqual(rail.y0 - 40);
                expect(p.y).toBeLessThanOrEqual(rail.y1 + 1);
              }
              expect(p.body).toBeGreaterThanOrEqual(0.25);
            }
            expect(visitPose(v, total + 0.01).done).toBe(true);
          }
        }
      }
    }
  });

  it('each visitor rests 2–3 s longer than its base, a different length each time', () => {
    const L = layoutFor(1180, 820);
    const rail = visitorRails(L, 40)[0]!;
    const base = { ladybug: 1.8, snail: 3.2, frog: 2.6 };
    for (const kind of VISITOR_KINDS) {
      const rests = Array.from({ length: 20 }, (_, i) => planVisit(kind, rail, 1180, 40, rng((i + 1) * 2654435761)).restS);
      for (const r of rests) {
        expect(r - base[kind]).toBeGreaterThanOrEqual(2);
        expect(r - base[kind]).toBeLessThanOrEqual(3);
      }
      expect(new Set(rests.map((r) => r.toFixed(2))).size).toBeGreaterThan(10);
    }
  });

  it('the frog only hops (jump pose in the air), the ladybug opens its wings only to fly off', () => {
    const L = layoutFor(1180, 820);
    const rail = visitorRails(L, 40)[0]!;
    const frog = planVisit('frog', rail, 1180, 40, rng(3));
    const rest = visitPose(frog, frog.inS + 1);
    expect(rest.jump).toBe(false);
    expect([0.2, 0.3].some((t) => visitPose(frog, t).jump)).toBe(true);
    const lady = planVisit('ladybug', rail, 1180, 40, rng(4));
    expect(visitPose(lady, lady.inS / 2).wings).toBe(0);
    expect(visitPose(lady, lady.inS + lady.restS + 1).wings).toBeGreaterThan(0.9);
  });
});
