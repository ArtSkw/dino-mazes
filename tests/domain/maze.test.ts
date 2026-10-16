import { describe, expect, it } from 'vitest';
import {
  FALLBACK_SEEDS,
  LEVELS,
  MAX_ATTEMPTS,
  centerCellOf,
  checkGraph,
  generateMaze,
  gridCandidates,
  introMaze,
  phoneGridCandidates,
  turnMaze,
  turnPoint,
  meetsProfile,
  profileFor,
  rebuildMaze,
  tryGenerate,
  nodePos,
  innerCorners,
  WALL_ROUNDING,
  CORRIDOR_RADIUS,
} from '../../src/domain/maze';
import { distToSegment } from '../../src/domain/geometry';
import { TrailEngine } from '../../src/domain/trail';
import { centerlinePath } from './helpers';
import type { Difficulty, GridSpec, Maze } from '../../src/domain/types';

const PROFILES: Array<[Difficulty, GridSpec]> = [];
for (const d of ['easy', ...LEVELS] as Difficulty[]) {
  const seen = new Set<string>();
  for (const landscape of [true, false]) {
    for (const g of gridCandidates(d, landscape)) {
      const k = `${g.cols}x${g.rows}`;
      if (seen.has(k)) continue;
      seen.add(k);
      PROFILES.push([d, g]);
    }
  }
}

// Phones are capped at 'medium' and use long grids along the screen.
for (const landscape of [true, false]) {
  for (const g of phoneGridCandidates(landscape)) {
    if (!PROFILES.some(([d, p]) => d === 'medium' && p.cols === g.cols && p.rows === g.rows)) PROFILES.push(['medium', g]);
  }
}

/** Count simple paths between two nodes (independent of tree reasoning). */
function countSimplePaths(maze: Maze, from: number, to: number): number {
  const visited = new Uint8Array(maze.cells.length);
  let count = 0;
  const dfs = (n: number): void => {
    if (n === to) {
      count++;
      return;
    }
    visited[n] = 1;
    for (const m of maze.cells[n]?.neighbors ?? []) if (!visited[m]) dfs(m);
    visited[n] = 0;
  };
  dfs(from);
  return count;
}

function onSide(maze: Maze): boolean {
  const cell = maze.entrance.insideCell;
  const x = cell % maze.width;
  const y = Math.floor(cell / maze.width);
  switch (maze.entrance.side) {
    case 'bottom':
      return y === maze.height - 1;
    case 'top':
      return y === 0;
    case 'left':
      return x === 0;
    case 'right':
      return x === maze.width - 1;
  }
}

describe('maze generator', () => {
  for (const [difficulty, grid] of PROFILES) {
    it(`1,000 seeds are valid for ${difficulty} ${grid.cols}x${grid.rows}`, () => {
      const profile = profileFor(difficulty, grid);
      let fallbacks = 0;
      for (let i = 0; i < 1000; i++) {
        const maze = generateMaze(`seed-${i}`, profile);
        if (maze.usedFallback) fallbacks++;
        expect(maze.width).toBe(grid.cols);
        expect(maze.height).toBe(grid.rows);
        const center = centerCellOf(grid);
        expect(checkGraph(maze.cells, center).ok).toBe(true);
        // E = V − 1 and connected ⇒ tree ⇒ exactly one simple route.
        const E = maze.cells.reduce((s, c) => s + c.neighbors.length, 0) / 2;
        expect(E).toBe(maze.cells.length - 1);
        expect(maze.goal.cellId).toBe(center);
        expect(maze.cells[center]?.neighbors.length).toBe(1);
        expect(onSide(maze)).toBe(true);
        expect(meetsProfile(maze.metrics, profile)).toBe(true);
        expect(maze.attempts).toBeLessThanOrEqual(profile.maxAttempts ?? MAX_ATTEMPTS);
        // Never on the left: the friend stands at the lower left.
        expect(maze.entrance.side).not.toBe('left');
        // One external entrance: exactly one corridor touches the outside node.
        expect(maze.corridors.filter((c) => c.from === maze.entranceNode || c.to === maze.entranceNode)).toHaveLength(1);
        if (i < 60) expect(countSimplePaths(maze, maze.entrance.insideCell, center)).toBe(1);
      }
      // Fallbacks must stay rare so children see fresh layouts.
      expect(fallbacks).toBeLessThan(10);
    }, 60000);
  }

  it('is repeatable for the same seed and profile', () => {
    for (const [difficulty, grid] of PROFILES) {
      const p = profileFor(difficulty, grid);
      const a = generateMaze('repeat-me', p);
      const b = generateMaze('repeat-me', p);
      expect(a.layoutHash).toBe(b.layoutHash);
      expect(a.corridors).toEqual(b.corridors);
      expect(a.entrance).toEqual(b.entrance);
    }
  });

  it('produces varied layouts', () => {
    const p = profileFor('easy', { cols: 5, rows: 5 });
    const hashes = new Set<string>();
    for (let i = 0; i < 200; i++) hashes.add(generateMaze(`v${i}`, p).layoutHash);
    expect(hashes.size).toBeGreaterThan(190);
  });

  it('has a validated fallback for every profile', () => {
    for (const [difficulty, grid] of PROFILES) {
      const key = `${difficulty}:${grid.cols}x${grid.rows}`;
      const seed = FALLBACK_SEEDS[key] ?? `fallback:${key}`;
      const m = tryGenerate(seed, profileFor(difficulty, grid));
      expect(m, key).not.toBeNull();
    }
  });

  it('rebuilds a stored session maze exactly', () => {
    const p = profileFor('medium', { cols: 7, rows: 7 });
    const a = generateMaze('stored', p);
    const b = rebuildMaze('stored', 'medium', { cols: 7, rows: 7 }, false);
    expect(b.layoutHash).toBe(a.layoutHash);
  });

  it('keeps non-adjacent corridors separated by a real hedge', () => {
    // Capsules of corridors that share no node must never come within 2·radius,
    // otherwise a visual gap could read as an opening.
    const maze = generateMaze('separation', profileFor('harder', { cols: 9, rows: 9 }));
    const segs = maze.corridors.map((c) => ({ ...c, a: nodePos(maze, c.from), b: nodePos(maze, c.to) }));
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const s = segs[i]!;
        const t = segs[j]!;
        if (s.from === t.from || s.from === t.to || s.to === t.from || s.to === t.to) continue;
        const gap = Math.min(distToSegment(s.a, t.a, t.b), distToSegment(s.b, t.a, t.b), distToSegment(t.a, s.a, s.b), distToSegment(t.b, s.a, s.b));
        expect(gap).toBeGreaterThan(2 * maze.corridorRadius + 0.3);
      }
    }
  });
});

describe('long phone mazes (owner request, 16 Oct 2026)', () => {
  it('are about as rich as a 9x7 tablet maze, well beyond the old 5x5', () => {
    for (const grid of [{ cols: 9, rows: 5 }, { cols: 5, rows: 9 }]) {
      const p = profileFor('medium', grid);
      expect(p.branchChoices[0]).toBeGreaterThanOrEqual(3);
      expect(p.minSolutionLength).toBeGreaterThanOrEqual(13);
      expect(p.minSolutionLength).toBeGreaterThan(profileFor('medium', { cols: 5, rows: 5 }).minSolutionLength);
    }
  });
});

describe('turning a maze for a rotated screen (owner decision, 16 Oct 2026)', () => {
  const samples = (): Maze[] => [
    ...Array.from({ length: 40 }, (_, i) => generateMaze(`turn-w${i}`, profileFor('medium', { cols: 9, rows: 5 }))),
    ...Array.from({ length: 40 }, (_, i) => generateMaze(`turn-t${i}`, profileFor('medium', { cols: 5, rows: 9 }))),
    generateMaze('turn-tablet', profileFor('hard', { cols: 9, rows: 7 })),
  ];

  it('is the same maze: valid, same route and branches, and turning twice gives it back', () => {
    for (const maze of samples()) {
      const t = turnMaze(maze);
      expect(t.width).toBe(maze.height);
      expect(t.height).toBe(maze.width);
      expect(t.layoutHash).toBe(maze.layoutHash);
      expect(t.goal.cellId).toBe(centerCellOf({ cols: t.width, rows: t.height }));
      expect(checkGraph(t.cells, t.goal.cellId).ok).toBe(true);
      t.cells.forEach((c, i) => {
        expect(c.id).toBe(i);
        expect(c.x).toBe(i % t.width);
        expect(c.y).toBe(Math.floor(i / t.width));
      });
      // Every corridor joins grid neighbours, and the route is the same length.
      for (const c of t.cells) for (const n of c.neighbors) expect(Math.abs(c.x - t.cells[n]!.x) + Math.abs(c.y - t.cells[n]!.y)).toBe(1);
      expect(t.metrics.solution).toHaveLength(maze.metrics.solution.length);
      expect(t.metrics.solution[t.metrics.solution.length - 1]).toBe(t.goal.cellId);
      expect(onSide(t)).toBe(true);
      expect(turnMaze(t)).toEqual(maze);
    }
  });

  it('keeps the entrance clear of the friend: right half of the bottom or lower half of the right side', () => {
    for (const maze of samples()) {
      const t = turnMaze(maze);
      const x = t.entrance.insideCell % t.width;
      const y = Math.floor(t.entrance.insideCell / t.width);
      expect(['bottom', 'right']).toContain(t.entrance.side);
      expect(t.entrance.side).toBe(t.width >= t.height ? 'bottom' : 'right');
      if (t.entrance.side === 'bottom') expect(x).toBeGreaterThanOrEqual(Math.floor(t.width / 2));
      else expect(y).toBeGreaterThanOrEqual(t.height - Math.ceil(t.height / 2));
    }
  });

  it('a trail drawn so far turns with it and still leads on', () => {
    for (const maze of samples().slice(0, 20)) {
      const nodes = [maze.entranceNode, ...maze.metrics.solution];
      const half = centerlinePath(maze, nodes.slice(0, Math.ceil(nodes.length / 2)));
      const a = new TrailEngine(maze);
      expect(a.restore(half)).toBe(true);
      const t = turnMaze(maze);
      const b = new TrailEngine(t);
      expect(b.restore(a.points.map(turnPoint))).toBe(true);
      expect(b.points).toHaveLength(a.points.length);
      // The turned trail can be finished along the turned route.
      const all = centerlinePath(t, [t.entranceNode, ...t.metrics.solution]);
      const c = new TrailEngine(t);
      expect(c.begin(all[0]!)).toBeTruthy();
      for (const p of all.slice(1)) expect(c.move(p).lost).toBe(false);
      expect(c.solved).toBe(true);
    }
  });

  it('rebuilds a turned session maze exactly', () => {
    const grid = { cols: 9, rows: 5 };
    const a = turnMaze(generateMaze('stored-turned', profileFor('medium', grid)));
    expect(rebuildMaze('stored-turned', 'medium', grid, false, true)).toEqual(a);
  });
});

describe('introductory maze', () => {
  it('is a valid easy maze with a straight safe first section', () => {
    const maze = introMaze();
    expect(checkGraph(maze.cells, maze.goal.cellId).ok).toBe(true);
    expect(meetsProfile(maze.metrics, maze.profile)).toBe(true);
    // Mirrored (GENERATOR_VERSION 4): up the right-centre column, clear of the friend.
    expect(maze.entrance.side).toBe('bottom');
    expect(maze.metrics.solution.slice(0, 3)).toEqual([23, 18, 13]);
    expect(maze.cells[23]?.neighbors).toEqual([18]);
    expect(maze.cells[18]?.neighbors).toEqual([13, 23]);
  });
});

describe('rounded hedge corners', () => {
  it('only round hedge: never touch a corridor or open a gap toward another passage', () => {
    const r = CORRIDOR_RADIUS;
    const f = WALL_ROUNDING;
    const mazes = [introMaze(), ...LEVELS.map((d, i) => generateMaze(`round-${i}`, profileFor(d, { cols: 7, rows: 7 })))];
    for (const maze of mazes) {
      const corners = innerCorners(maze);
      expect(corners.length).toBeGreaterThan(0);
      const segs = maze.corridors.map((c) => [nodePos(maze, c.from), nodePos(maze, c.to)] as const);
      for (const { node, a, b } of corners) {
        const O = { x: node.x + (r + f) * (a.x + b.x), y: node.y + (r + f) * (a.y + b.y) };
        for (let i = 0; i <= 10; i++) {
          for (let j = 0; j <= 10; j++) {
            // Sample the rounding wedge: the f×f square at the corner minus the fillet circle.
            const p = { x: node.x + (r + (f * i) / 10) * a.x + (r + (f * j) / 10) * b.x, y: node.y + (r + (f * i) / 10) * a.y + (r + (f * j) / 10) * b.y };
            if (Math.hypot(p.x - O.x, p.y - O.y) < f) continue;
            for (const [s0, s1] of segs) {
              const d = distToSegment(p, s0, s1);
              const incident = (s0.x === node.x && s0.y === node.y) || (s1.x === node.x && s1.y === node.y);
              // It is hedge today (outside every corridor) …
              expect(d).toBeGreaterThanOrEqual(r - 1e-9);
              // … and stays well clear of passages that do not meet at this corner.
              if (!incident) expect(d).toBeGreaterThanOrEqual(r + 0.19);
            }
          }
        }
      }
    }
  });
});
