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
  meetsProfile,
  profileFor,
  rebuildMaze,
  tryGenerate,
  nodePos,
} from '../../src/domain/maze';
import { distToSegment } from '../../src/domain/geometry';
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

describe('introductory maze', () => {
  it('is a valid easy maze with a straight safe first section', () => {
    const maze = introMaze();
    expect(checkGraph(maze.cells, maze.goal.cellId).ok).toBe(true);
    expect(meetsProfile(maze.metrics, maze.profile)).toBe(true);
    expect(maze.metrics.solution.slice(0, 3)).toEqual([21, 16, 11]);
    expect(maze.cells[21]?.neighbors).toEqual([16]);
    expect(maze.cells[16]?.neighbors).toEqual([11, 21]);
  });
});
