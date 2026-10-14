import { describe, expect, it } from 'vitest';
import { FRIEND_SIZE, MIN_CONTROL_PX, MIN_CORRIDOR_PX, castSlots, clusterSpec, computeLayout, fitGrid, introLayout, toLogical, toScreen, type Rect } from '../../src/platform/layout';
import type { Difficulty } from '../../src/domain/types';
import { LEVELS, entranceAxes } from '../../src/domain/maze';
import { friendFrame } from '../../src/game/assets';

const VIEWPORTS: Array<[number, number]> = [
  [1024, 768],
  [1180, 820],
  [1366, 768],
  [1440, 900],
  [768, 1024],
  [1024, 600],
];

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Rect, vw: number, vh: number): boolean => a.x >= -0.5 && a.y >= -0.5 && a.x + a.w <= vw + 0.5 && a.y + a.h <= vh + 0.5;

describe('grid fitting', () => {
  for (const [vw, vh] of VIEWPORTS) {
    for (const d of ['easy', 'medium', 'harder', ...LEVELS] as Difficulty[]) {
      it(`${d} at ${vw}x${vh} keeps corridors ≥ ${MIN_CORRIDOR_PX}px`, () => {
        const fit = fitGrid(d, vw, vh);
        expect(fit.meetsMinimum).toBe(true);
        expect(fit.corridorPx).toBeGreaterThanOrEqual(MIN_CORRIDOR_PX);
      });
    }
  }

  it('bigger grids where they fit without shrinking the friend', () => {
    // A 1180×820 tablet: 9×7 would squeeze the friend's strip, so 7×7 with harder topology.
    for (const d of LEVELS) expect(fitGrid(d, 1180, 820).grid).toEqual({ cols: 7, rows: 7 });
    expect(fitGrid('hard', 1366, 768).grid).toEqual({ cols: 9, rows: 7 });
    expect(fitGrid('hard', 1440, 900).grid).toEqual({ cols: 9, rows: 9 });
    expect(fitGrid('master', 1440, 900).grid).toEqual({ cols: 9, rows: 9 });
    expect(fitGrid('master', 1920, 1080).grid).toEqual({ cols: 11, rows: 9 });
  });

  it('the friend keeps at least 85 % of its size at the old starting level, at every level', () => {
    for (const [vw, vh] of [...VIEWPORTS, [1920, 1080] as [number, number], [1280, 800] as [number, number]].filter(([w, h]) => w / h >= 1.12)) {
      for (const id of ['rocky', 'giganto'] as const) {
        const at = (grid: { cols: number; rows: number }): number =>
          computeLayout({ vw, vh, grid, entranceSide: 'bottom', entranceX: 0.7, friend: friendFrame(id), ...(id === 'giganto' ? { forceCorner: 'left' as const } : {}) }).friendVisible.h;
        // Baseline: the old starting level's grid on this screen (7×7, or smaller where 7×7 does not fit).
        const base = at(fitGrid('medium', vw, vh).grid);
        for (const d of LEVELS) expect(at(fitGrid(d, vw, vh).grid), `${vw}x${vh} ${d} ${id}`).toBeGreaterThanOrEqual(base * 0.85);
      }
    }
  });

  it('uses the nominal 9x9 grid only when space permits', () => {
    expect(fitGrid('harder', 1440, 900).grid).toEqual({ cols: 9, rows: 9 });
    expect(fitGrid('harder', 1024, 768).grid.cols * fitGrid('harder', 1024, 768).grid.rows).toBeLessThan(81);
  });
});

describe('layout', () => {
  for (const [vw, vh] of VIEWPORTS) {
    for (const [side, id] of [['bottom', 'bill'], ['left', 'tiny'], ['right', 'mazu'], ['bottom', 'rocky'], ['left', 'giganto'], ['right', 'giganto']] as const) {
      it(`${vw}x${vh} entrance ${side}, ${id}: board, friend and controls do not collide`, () => {
        const fit = fitGrid(id === 'giganto' ? 'expert' : 'hard', vw, vh);
        // Only the sides the generator can open for this grid (entranceAxes).
        const axes = entranceAxes(fit.grid);
        const usable = (side === 'bottom' && !axes.vertical) || (side !== 'bottom' && !axes.horizontal) ? (axes.horizontal ? 'left' : 'bottom') : side;
        const L = computeLayout({
          vw,
          vh,
          grid: fit.grid,
          entranceSide: usable,
          entranceX: 0.3,
          friend: friendFrame(id),
          ...(id === 'giganto' ? { forceCorner: 'left' as const } : {}),
        });
        expect(inside(L.board, vw, vh)).toBe(true);
        for (const r of [L.character, L.reset, L.hint, L.clusterRect, L.home]) {
          expect(overlaps(r, L.board)).toBe(false);
        }
        for (const r of [L.reset, L.hint, L.clusterRect, L.home]) expect(inside(r, vw, vh)).toBe(true);
        // The friend may bleed off the left edge (Giganto) but never off the bottom or right.
        expect(L.character.y + L.character.h).toBeLessThanOrEqual(vh + 0.5);
        expect(L.character.x + L.character.w).toBeLessThanOrEqual(vw + 0.5);
        expect(overlaps(L.reset, L.friendVisible)).toBe(false);
        expect(overlaps(L.hint, L.friendVisible)).toBe(false);
        const controls = [L.reset, L.hint, L.clusterRect, L.home];
        for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) expect(overlaps(controls[i]!, controls[j]!)).toBe(false);
        expect(L.reset.h).toBeGreaterThanOrEqual(MIN_CONTROL_PX);
        expect(L.hint.w).toBeGreaterThanOrEqual(MIN_CONTROL_PX);
        expect(L.cluster.size).toBeGreaterThanOrEqual(MIN_CONTROL_PX);
        expect(L.corridorPx).toBeGreaterThanOrEqual(MIN_CORRIDOR_PX);
        // The friend's speech bubble area stays clear of the board and every control.
        if (L.speech.w > 0 && L.speech.h > 0) {
          for (const r of [L.board, L.reset, L.clusterRect, L.home]) expect(overlaps(L.speech, r)).toBe(false);
        }
        if (L.speech.w > 0 && L.speech.h > 0) expect(overlaps(L.speech, L.hint)).toBe(false);
        // The butterfly mirrors the cluster in the top-left corner: same size and margins.
        expect(L.hint.x).toBe(L.clusterRect.y);
        expect(L.hint.y).toBe(L.clusterRect.y);
        expect(L.hint.w).toBe(L.cluster.size);
        expect(vw - (L.clusterRect.x + L.clusterRect.w)).toBe(L.hint.x);
        // "Kolejna przygoda" is centred on the screen.
        expect(L.next.x + L.next.w / 2).toBeCloseTo(vw / 2, 0);
        expect(L.next.y + L.next.h / 2).toBeCloseTo(vh / 2, 0);
        expect(L.reset.h).toBeGreaterThanOrEqual(MIN_CONTROL_PX);
        expect(L.hint.w).toBeGreaterThanOrEqual(MIN_CONTROL_PX);
        expect(L.cluster.size).toBeGreaterThanOrEqual(MIN_CONTROL_PX);
        expect(L.corridorPx).toBeGreaterThanOrEqual(MIN_CORRIDOR_PX);
      });
    }
  }

  it('welcome cast: Giganto taller than each friend, flush left, nobody off the right edge', () => {
    for (const [vw, vh] of VIEWPORTS) {
      const items = [
        { aspect: 293 / 255, scale: 1.04, flushLeft: true },
        { aspect: 257 / 305, scale: 0.86 },
        { aspect: 296 / 304, scale: 0.86 },
        { aspect: 305 / 274, scale: 0.86 },
        { aspect: 241 / 283, scale: 0.86 },
      ];
      const slots = castSlots(vw, vh, items);
      expect(slots[0]!.x).toBeLessThanOrEqual(0);
      for (const r of slots.slice(1)) expect(slots[0]!.h).toBeGreaterThan(r.h);
      for (const r of slots) expect(r.x + r.w).toBeLessThanOrEqual(vw + 0.5);
      for (let i = 1; i < slots.length; i++) expect(slots[i]!.x).toBeGreaterThan(slots[i - 1]!.x);
    }
  });

  it('maps pointer coordinates to logical board units and back', () => {
    const L = computeLayout({ vw: 1024, vh: 768, grid: { cols: 5, rows: 5 }, entranceSide: 'bottom', entranceX: 0.1 });
    const p = toScreen(L.transform, { x: 2.5, y: 2.5 });
    const q = toLogical(L.transform, p.x, p.y);
    expect(q.x).toBeCloseTo(2.5);
    expect(q.y).toBeCloseTo(2.5);
  });

  it('centres the quest intro as one group: friend left, card right, no overlap', () => {
    for (const [vw, vh] of VIEWPORTS.filter(([w, h]) => w / h >= 1.12)) {
      const { character, card } = introLayout(vw, vh);
      const visibleRight = character.x + character.w / 2 + (character.w * 0.78) / 2;
      expect(card.x).toBeGreaterThan(visibleRight);
      const groupLeft = character.x + character.w / 2 - (character.w * 0.78) / 2;
      // Equal margins on both sides (within rounding).
      expect(Math.abs(groupLeft - (vw - (card.x + card.w)))).toBeLessThan(2);
      expect(card.x + card.w).toBeLessThanOrEqual(vw - 12);
    }
  });

  it('draws Giganto larger than a regular friend in the same spot', () => {
    for (const [vw, vh] of VIEWPORTS) {
      const fit = fitGrid('medium', vw, vh);
      const base = { vw, vh, grid: fit.grid, entranceSide: 'bottom' as const, entranceX: 0.7, forceCorner: 'left' as const };
      const friend = computeLayout({ ...base, friend: { aspect: 0.9, size: 1, content: { x: 0, y: 0, w: 1, h: 1 } } });
      const giganto = computeLayout({ ...base, friend: { aspect: 293 / 255, size: FRIEND_SIZE['giganto'] as number, content: { x: 0, y: 0, w: 1, h: 1 }, flushLeft: true, bleed: 0.12 } });
      expect(giganto.character.h * giganto.character.w).toBeGreaterThan(friend.character.h * friend.character.w);
      expect(giganto.character.x).toBeLessThanOrEqual(0);
    }
  });

  it('keeps the collection + settings cluster identical on every screen', () => {
    for (const [vw, vh] of VIEWPORTS) {
      const spec = clusterSpec(vw, vh);
      const fit = fitGrid('medium', vw, vh);
      const L = computeLayout({ vw, vh, grid: fit.grid, entranceSide: 'bottom', entranceX: 0.3 });
      // Play uses exactly the rect the welcome/intro screens use.
      expect(L.clusterRect).toEqual(spec.rect);
      expect(spec.direction).toBe('row');
      expect(spec.rect.w).toBe(2 * spec.size + spec.gap);
      expect(spec.size).toBeGreaterThanOrEqual(MIN_CONTROL_PX);
      // Top-right corner, 10px margins.
      expect(spec.rect.x + spec.rect.w).toBe(vw - 10);
      expect(spec.rect.y).toBe(10);
    }
  });

  it('quest intro: the painted friend (wave included) never reaches under the card', () => {
    for (const [vw, vh] of VIEWPORTS.filter(([w, h]) => w / h >= 1.12)) {
      for (const id of ['bill', 'tiny', 'mazu', 'rocky', 'giganto'] as const) {
        const f = friendFrame(id);
        const { character, card } = introLayout(vw, vh, f);
        const paintedRight = character.x + character.w * (f.content.x + f.content.w);
        expect(paintedRight, id).toBeLessThan(card.x);
        expect(card.x + card.w).toBeLessThanOrEqual(vw - 12);
      }
    }
  });

  it('places Giganto in the lower-left corner when forced', () => {
    const L = computeLayout({ vw: 1180, vh: 820, grid: { cols: 7, rows: 7 }, entranceSide: 'left', entranceX: 0, forceCorner: 'left' });
    expect(L.corner).toBe('left');
    expect(L.character.x).toBeLessThan(L.board.x);
  });
});
