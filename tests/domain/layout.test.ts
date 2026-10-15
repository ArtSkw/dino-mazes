import { describe, expect, it } from 'vitest';
import { FRIEND_CORNER, FRIEND_SIZE, MIN_CONTROL_PX, MIN_CORRIDOR_PX, castSlots, clusterSpec, computeLayout, fitGrid, introLayout, peekRest, toLogical, toScreen, type Layout, type Rect } from '../../src/platform/layout';
import type { Difficulty } from '../../src/domain/types';
import { CORRIDOR_RADIUS, ENTRANCE_REACH, FRAME_MARGIN, LEVELS, entranceAxes } from '../../src/domain/maze';
import { ASSETS, FACING, friendFrame } from '../../src/game/assets';
import type { GridSpec, Side } from '../../src/domain/types';

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

/**
 * Screen boxes of every entrance the generator may open on this grid: the stub
 * from the hedge frame to the start pad, widened by the corridor and the pad.
 */
function entranceBoxes(L: Layout, grid: GridSpec, side: Side): Rect[] {
  const { pitch, ox, oy } = L.transform;
  const r = (CORRIDOR_RADIUS + 0.15) * pitch;
  const reach = FRAME_MARGIN + ENTRANCE_REACH;
  const boxes: Rect[] = [];
  if (side === 'bottom') {
    for (let x = Math.floor(grid.cols / 2); x < grid.cols; x++) {
      const cx = ox + (x + 0.5) * pitch;
      boxes.push({ x: cx - r, y: oy + (grid.rows + FRAME_MARGIN) * pitch, w: 2 * r, h: (reach - FRAME_MARGIN) * pitch + r });
    }
  } else {
    const lowerRows = Math.ceil(grid.rows / 2);
    for (let y = grid.rows - lowerRows; y < grid.rows; y++) {
      const cy = oy + (y + 0.5) * pitch;
      boxes.push({ x: ox + (grid.cols + FRAME_MARGIN) * pitch, y: cy - r, w: (reach - FRAME_MARGIN) * pitch + r, h: 2 * r });
    }
  }
  return boxes;
}

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
          computeLayout({ vw, vh, grid, entranceSide: 'bottom', friend: friendFrame(id) }).friendVisible.h;
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
    for (const [side, id] of [['bottom', 'bill'], ['right', 'tiny'], ['right', 'mazu'], ['bottom', 'rocky'], ['bottom', 'giganto'], ['right', 'giganto']] as const) {
      it(`${vw}x${vh} entrance ${side}, ${id}: board, friend and controls do not collide`, () => {
        const fit = fitGrid(id === 'giganto' ? 'expert' : 'hard', vw, vh);
        // Only the sides the generator can open for this grid (entranceAxes; never left).
        const axes = entranceAxes(fit.grid);
        const usable: Side = side === 'bottom' && !axes.vertical ? 'right' : side === 'right' && !axes.horizontal ? 'bottom' : side;
        const L = computeLayout({ vw, vh, grid: fit.grid, entranceSide: usable, friend: friendFrame(id) });
        // The friend always at the lower left, "Wróć" always at the lower right.
        expect(L.corner).toBe('left');
        expect(L.reset.x + L.reset.w / 2).toBeGreaterThan(vw / 2);
        expect(L.friendVisible.x + L.friendVisible.w / 2).toBeLessThan(vw / 2);
        // No entrance the generator can open runs into the friend or "Wróć".
        for (const e of entranceBoxes(L, fit.grid, usable)) {
          expect(overlaps(e, L.friendVisible), `entrance vs friend ${JSON.stringify(e)}`).toBe(false);
          expect(overlaps(e, L.reset), `entrance vs reset ${JSON.stringify(e)}`).toBe(false);
        }
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
    const L = computeLayout({ vw: 1024, vh: 768, grid: { cols: 5, rows: 5 }, entranceSide: 'bottom' });
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
      const base = { vw, vh, grid: fit.grid, entranceSide: 'bottom' as const };
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
      const L = computeLayout({ vw, vh, grid: fit.grid, entranceSide: 'bottom' });
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

  it('every friend stands at the lower left and faces the maze; "Wróć" is always at the lower right', () => {
    expect(FRIEND_CORNER).toBe('left');
    for (const id of ['bill', 'tiny', 'mazu', 'rocky', 'giganto'] as const) {
      // Facing left would turn the friend's back on the board.
      expect(FACING[id], id).not.toBe('left');
      for (const side of ['bottom', 'right'] as const) {
        const L = computeLayout({ vw: 1180, vh: 820, grid: { cols: 7, rows: 7 }, entranceSide: side, friend: friendFrame(id) });
        expect(L.character.x).toBeLessThan(L.board.x);
        expect(L.reset.x).toBeGreaterThan(L.board.x + L.board.w);
      }
    }
  });
});

describe("the opening's Giganto peek", () => {
  it('keeps its straight left and bottom cuts beyond the screen edges, sniffing bob included', () => {
    const cut = ASSETS.intro.gigantoPeek.cut!;
    expect(cut.left).toBeGreaterThan(0);
    expect(cut.bottom).toBeLessThan(1);
    for (const vh of [375, 600, 768, 820, 1024]) {
      const size = Math.min(vh * 0.46, 380);
      const lift = size * 0.02;
      const rest = peekRest(vh, size, cut, lift);
      // The left cut sits left of the screen, with most of its fade.
      expect(rest.x + cut.left * size).toBeLessThanOrEqual(-0.6 * cut.band * size);
      // The bottom cut stays below the screen even at the top of the bob.
      expect(rest.y - lift - (1 - cut.bottom) * size).toBeGreaterThanOrEqual(vh + 0.6 * cut.band * size);
      // Giganto himself is still well in view (no more than a tenth of the cell hidden on the left).
      expect(-rest.x).toBeLessThan(size * 0.1);
    }
  });
});
