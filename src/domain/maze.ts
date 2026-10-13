/**
 * Seeded maze generation and validation (DEVELOPMENT_PLAN.md §4.1).
 *
 * Construction: a randomized spanning tree over every cell except the centre,
 * then the centre clearing is attached as a leaf through exactly one passage and
 * one outside entrance stub is added on the boundary. A connected acyclic graph
 * (E = V − 1) has exactly one simple path between any two nodes, so the route from
 * the entrance to the treasure is unique. Each candidate is then measured and
 * rejected unless it matches its difficulty profile; after 100 attempts a fixed,
 * test-validated fallback seed is used instead.
 */
import { createRng, hashString, type Rng } from './rng';
import type { Difficulty, GridSpec, Maze, MazeCell, MazeMetrics, MazeProfile, Point, Side } from './types';

/** v2: five automatic difficulty levels (owner decision, 13 Oct 2026). */
export const GENERATOR_VERSION = 2;
/** Visual corridor half-width in cell units (corridor width = 0.6 of the cell pitch). */
export const CORRIDOR_RADIUS = 0.3;
/** Hedge frame around the grid, in cell units. */
export const FRAME_MARGIN = 0.38;
/** How far the outside entrance point sits beyond the frame edge. */
export const ENTRANCE_REACH = 0.42;
export const MAX_ATTEMPTS = 100;

const key = (g: GridSpec): string => `${g.cols}x${g.rows}`;

interface ProfileRule {
  branch: [number, number];
  minSolution: number;
  maxSolution?: number;
  maxDeadEnd?: number;
  maxDecisions?: number;
  /** Growing-tree "newest cell" probability range: high = long winding corridors, low = bushier. */
  bias?: [number, number];
  /** Rejection-sampling budget before the fixed fallback (harder targets need more). */
  attempts?: number;
}

/**
 * Profile targets per effective grid. Generated mazes start at 'medium' and step
 * up through LEVELS; the grid grows only where the screen keeps corridors ≥ 48 px,
 * so most of the growth comes from topology: more real branch choices and a
 * longer route. Targets were picked from measured distributions so that the
 * fallback stays rare (tests/domain/maze.test.ts: < 1 % per profile).
 */
const RULES: Record<Difficulty, Record<string, ProfileRule>> = {
  easy: {
    '5x5': { branch: [1, 3], minSolution: 7, maxSolution: 15, maxDeadEnd: 4, maxDecisions: 5, bias: [0.2, 0.7] },
  },
  medium: {
    '7x7': { branch: [3, 5], minSolution: 13 },
    '7x5': { branch: [2, 4], minSolution: 10 },
    '5x7': { branch: [2, 4], minSolution: 10 },
    '5x5': { branch: [2, 4], minSolution: 7 },
  },
  'medium-plus': {
    '9x7': { branch: [4, 6], minSolution: 15 },
    '7x9': { branch: [4, 6], minSolution: 15 },
    '7x7': { branch: [4, 6], minSolution: 15 },
    '7x5': { branch: [3, 5], minSolution: 11 },
    '5x7': { branch: [3, 5], minSolution: 11 },
    '5x5': { branch: [2, 4], minSolution: 8 },
  },
  harder: {
    '9x9': { branch: [5, 7], minSolution: 20 },
    '9x7': { branch: [4, 6], minSolution: 17 },
    '7x9': { branch: [4, 6], minSolution: 17 },
    '7x7': { branch: [4, 7], minSolution: 17, attempts: 250 },
    '7x5': { branch: [3, 5], minSolution: 12 },
    '5x7': { branch: [3, 5], minSolution: 12 },
    '5x5': { branch: [2, 4], minSolution: 9 },
  },
  hard: {
    '9x9': { branch: [5, 8], minSolution: 23, attempts: 250 },
    '9x7': { branch: [5, 7], minSolution: 19, attempts: 300 },
    '7x9': { branch: [5, 7], minSolution: 19, attempts: 300 },
    '7x7': { branch: [5, 8], minSolution: 18, attempts: 400 },
    '7x5': { branch: [4, 6], minSolution: 13, attempts: 300 },
    '5x7': { branch: [4, 6], minSolution: 13, attempts: 300 },
    '5x5': { branch: [3, 4], minSolution: 10, attempts: 300 },
  },
  expert: {
    '9x9': { branch: [6, 9], minSolution: 26, attempts: 400 },
    '9x7': { branch: [5, 8], minSolution: 21, attempts: 400 },
    '7x9': { branch: [5, 8], minSolution: 21, attempts: 400 },
    '7x7': { branch: [5, 8], minSolution: 20, attempts: 500, bias: [0.6, 1] },
    '7x5': { branch: [4, 6], minSolution: 15, attempts: 400 },
    '5x7': { branch: [4, 6], minSolution: 15, attempts: 400 },
    '5x5': { branch: [3, 4], minSolution: 11, attempts: 400 },
  },
};

/** Automatic progression of generated mazes (the tutorial maze is 'easy'). */
export const LEVELS: Difficulty[] = ['medium', 'medium-plus', 'harder', 'hard', 'expert'];

/** Grid candidates in preference order; the layout fitter picks the first that fits. */
export function gridCandidates(difficulty: Difficulty, landscape: boolean): GridSpec[] {
  const wide = (a: number, b: number): GridSpec => (landscape ? { cols: a, rows: b } : { cols: b, rows: a });
  switch (difficulty) {
    case 'easy':
      return [{ cols: 5, rows: 5 }];
    case 'medium':
      return [{ cols: 7, rows: 7 }, wide(7, 5), { cols: 5, rows: 5 }];
    case 'medium-plus':
      return [wide(9, 7), { cols: 7, rows: 7 }, wide(7, 5), { cols: 5, rows: 5 }];
    case 'harder':
    case 'hard':
    case 'expert':
      return [{ cols: 9, rows: 9 }, wide(9, 7), { cols: 7, rows: 7 }, wide(7, 5), { cols: 5, rows: 5 }];
  }
}
export function profileFor(difficulty: Difficulty, grid: GridSpec): MazeProfile {
  const rule = RULES[difficulty][key(grid)] ?? RULES.medium[key(grid)] ?? RULES.easy['5x5'];
  if (!rule) throw new Error(`No maze profile for ${difficulty} ${key(grid)}`);
  return {
    difficulty,
    grid,
    branchChoices: rule.branch,
    minSolutionLength: rule.minSolution,
    ...(rule.maxSolution !== undefined ? { maxSolutionLength: rule.maxSolution } : {}),
    ...(rule.maxDeadEnd !== undefined ? { maxDeadEndDepth: rule.maxDeadEnd } : {}),
    ...(rule.maxDecisions !== undefined ? { maxDecisionPoints: rule.maxDecisions } : {}),
    bias: rule.bias ?? [0.45, 0.95],
    ...(rule.attempts !== undefined ? { maxAttempts: rule.attempts } : {}),
  };
}

export const centerCellOf = (g: GridSpec): number => Math.floor(g.rows / 2) * g.cols + Math.floor(g.cols / 2);

export function cellCenter(maze: Pick<Maze, 'width'>, id: number): Point {
  return { x: (id % maze.width) + 0.5, y: Math.floor(id / maze.width) + 0.5 };
}

/** Position of any graph node, including the virtual outside entrance node. */
export function nodePos(maze: Maze, id: number): Point {
  return id === maze.entranceNode ? maze.entrance.outside : cellCenter(maze, id);
}

/** Neighbours of a node including the entrance stub link. */
export function nodeNeighbors(maze: Maze, id: number): number[] {
  if (id === maze.entranceNode) return [maze.entrance.insideCell];
  const cell = maze.cells[id];
  if (!cell) return [];
  return id === maze.entrance.insideCell ? [...cell.neighbors, maze.entranceNode] : cell.neighbors;
}

// ---------------------------------------------------------------------------
// Tree construction

function gridNeighbors(g: GridSpec, id: number): number[] {
  const x = id % g.cols;
  const y = Math.floor(id / g.cols);
  const out: number[] = [];
  if (y > 0) out.push(id - g.cols);
  if (x < g.cols - 1) out.push(id + 1);
  if (y < g.rows - 1) out.push(id + g.cols);
  if (x > 0) out.push(id - 1);
  return out;
}

function growingTree(g: GridSpec, rng: Rng, pNewest: number): Array<[number, number]> {
  const center = centerCellOf(g);
  const total = g.cols * g.rows;
  const visited = new Uint8Array(total);
  visited[center] = 1;
  let start = rng.int(total);
  if (start === center) start = 0;
  visited[start] = 1;
  const active = [start];
  const edges: Array<[number, number]> = [];
  while (active.length > 0) {
    const idx = rng.chance(pNewest) ? active.length - 1 : rng.int(active.length);
    const c = active[idx] as number;
    const options = rng.shuffle(gridNeighbors(g, c).filter((n) => !visited[n]));
    const n = options[0];
    if (n === undefined) {
      active.splice(idx, 1);
      continue;
    }
    visited[n] = 1;
    edges.push([c, n]);
    active.push(n);
  }
  return edges;
}

function pickEntrance(g: GridSpec, rng: Rng): { side: Side; cell: number } {
  const roll = rng.int(5);
  const side: Side = roll < 3 ? 'bottom' : roll === 3 ? 'left' : 'right';
  const lowerRows = Math.ceil(g.rows / 2);
  if (side === 'bottom') return { side, cell: (g.rows - 1) * g.cols + rng.int(g.cols) };
  const y = g.rows - lowerRows + rng.int(lowerRows);
  return { side, cell: side === 'left' ? y * g.cols : y * g.cols + g.cols - 1 };
}

// ---------------------------------------------------------------------------
// Assembly, metrics and validation

export interface RawLayout {
  grid: GridSpec;
  edges: Array<[number, number]>;
  entranceCell: number;
  side: Side;
}

function entranceGeometry(g: GridSpec, cell: number, side: Side): Maze['entrance'] {
  const cx = (cell % g.cols) + 0.5;
  const cy = Math.floor(cell / g.cols) + 0.5;
  const out = FRAME_MARGIN + ENTRANCE_REACH;
  const r = CORRIDOR_RADIUS;
  switch (side) {
    case 'bottom':
      return {
        side,
        insideCell: cell,
        outside: { x: cx, y: g.rows + out },
        opening: [
          { x: cx - r, y: g.rows + FRAME_MARGIN },
          { x: cx + r, y: g.rows + FRAME_MARGIN },
        ],
      };
    case 'top':
      return {
        side,
        insideCell: cell,
        outside: { x: cx, y: -out },
        opening: [
          { x: cx - r, y: -FRAME_MARGIN },
          { x: cx + r, y: -FRAME_MARGIN },
        ],
      };
    case 'left':
      return {
        side,
        insideCell: cell,
        outside: { x: -out, y: cy },
        opening: [
          { x: -FRAME_MARGIN, y: cy - r },
          { x: -FRAME_MARGIN, y: cy + r },
        ],
      };
    case 'right':
      return {
        side,
        insideCell: cell,
        outside: { x: g.cols + out, y: cy },
        opening: [
          { x: g.cols + FRAME_MARGIN, y: cy - r },
          { x: g.cols + FRAME_MARGIN, y: cy + r },
        ],
      };
  }
}

export function computeMetrics(
  cells: readonly MazeCell[],
  entranceCell: number,
  center: number,
): MazeMetrics | null {
  // BFS from the entrance cell to find the (unique) solution path.
  const prev = new Int32Array(cells.length).fill(-2);
  prev[entranceCell] = -1;
  const queue = [entranceCell];
  while (queue.length) {
    const c = queue.shift() as number;
    for (const n of cells[c]?.neighbors ?? []) {
      if (prev[n] !== -2) continue;
      prev[n] = c;
      queue.push(n);
    }
  }
  if (prev[center] === -2) return null;
  const solution: number[] = [];
  for (let c = center; c !== -1; c = prev[c] as number) solution.unshift(c);
  const onPath = new Set(solution);

  const depthFrom = (node: number, parent: number): number => {
    let best = 0;
    for (const n of cells[node]?.neighbors ?? []) {
      if (n === parent) continue;
      best = Math.max(best, 1 + depthFrom(n, node));
    }
    return best;
  };

  // A decision point is any solution node offering more than one way forward. It is
  // "meaningful" when at least one wrong option runs two or more cells deep; a
  // one-cell pocket is visibly closed at a glance and adds texture, not difficulty.
  let branchChoices = 0;
  let decisionPoints = 0;
  let maxDeadEndDepth = 0;
  for (let i = 0; i < solution.length - 1; i++) {
    const node = solution[i] as number;
    const back = i === 0 ? -1 : (solution[i - 1] as number);
    const forward = (cells[node]?.neighbors ?? []).filter((n) => n !== back);
    const wrong = forward.filter((n) => !onPath.has(n));
    if (forward.length >= 2) decisionPoints++;
    let deepest = 0;
    for (const w of wrong) deepest = Math.max(deepest, 1 + depthFrom(w, node));
    if (deepest >= 2) branchChoices++;
    maxDeadEndDepth = Math.max(maxDeadEndDepth, deepest);
  }
  const deadEnds = cells.filter((c) => c.id !== center && c.id !== entranceCell && c.neighbors.length === 1).length;
  return { solutionLength: solution.length, branchChoices, decisionPoints, maxDeadEndDepth, deadEnds, solution };
}

export interface GraphCheck {
  ok: boolean;
  reason?: string;
}

/** Structural proof of a unique route: connected, acyclic, centre is a leaf. */
export function checkGraph(cells: readonly MazeCell[], center: number): GraphCheck {
  const V = cells.length;
  let degreeSum = 0;
  for (const c of cells) {
    for (const n of c.neighbors) {
      const other = cells[n];
      if (n === c.id) return { ok: false, reason: `self loop at ${c.id}` };
      if (!other || !other.neighbors.includes(c.id)) return { ok: false, reason: `asymmetric edge ${c.id}-${n}` };
    }
    if (new Set(c.neighbors).size !== c.neighbors.length) return { ok: false, reason: `duplicate edge at ${c.id}` };
    degreeSum += c.neighbors.length;
  }
  const E = degreeSum / 2;
  if (E !== V - 1) return { ok: false, reason: `edge count ${E} != V-1 (${V - 1})` };
  const seen = new Uint8Array(V);
  const stack = [0];
  seen[0] = 1;
  let count = 1;
  while (stack.length) {
    const c = stack.pop() as number;
    for (const n of cells[c]?.neighbors ?? []) {
      if (seen[n]) continue;
      seen[n] = 1;
      count++;
      stack.push(n);
    }
  }
  if (count !== V) return { ok: false, reason: 'not connected' };
  if ((cells[center]?.neighbors.length ?? 0) !== 1) return { ok: false, reason: 'centre is not a leaf' };
  return { ok: true };
}

function buildCells(layout: RawLayout): MazeCell[] {
  const { cols, rows } = layout.grid;
  const cells: MazeCell[] = [];
  for (let id = 0; id < cols * rows; id++) cells.push({ id, x: id % cols, y: Math.floor(id / cols), neighbors: [] });
  for (const [a, b] of layout.edges) {
    const ca = cells[a];
    const cb = cells[b];
    if (!ca || !cb) throw new Error(`edge out of range ${a}-${b}`);
    // Only orthogonal grid neighbours may be linked.
    if (!gridNeighbors(layout.grid, a).includes(b)) throw new Error(`non-adjacent edge ${a}-${b}`);
    ca.neighbors.push(b);
    cb.neighbors.push(a);
  }
  for (const c of cells) c.neighbors.sort((p, q) => p - q);
  return cells;
}

/** Canonical layout fingerprint, invariant to rotation/reflection. */
export function layoutHash(layout: RawLayout): string {
  const { cols, rows } = layout.grid;
  const transforms: Array<(x: number, y: number) => [number, number, number]> = [
    (x, y) => [x, y, cols],
    (x, y) => [cols - 1 - x, y, cols],
    (x, y) => [x, rows - 1 - y, cols],
    (x, y) => [cols - 1 - x, rows - 1 - y, cols],
  ];
  if (cols === rows) {
    transforms.push(
      (x, y) => [y, x, rows],
      (x, y) => [rows - 1 - y, x, rows],
      (x, y) => [y, cols - 1 - x, rows],
      (x, y) => [rows - 1 - y, cols - 1 - x, rows],
    );
  }
  let best: string | null = null;
  for (const t of transforms) {
    const map = (id: number): number => {
      const [nx, ny, w] = t(id % cols, Math.floor(id / cols));
      return ny * w + nx;
    };
    const edges = layout.edges
      .map(([a, b]) => {
        const p = map(a);
        const q = map(b);
        return p < q ? `${p}-${q}` : `${q}-${p}`;
      })
      .sort()
      .join(',');
    const s = `${edges}|e${map(layout.entranceCell)}`;
    if (best === null || s < best) best = s;
  }
  return hashString(`${cols}x${rows}|${best}`);
}

export function meetsProfile(m: MazeMetrics, p: MazeProfile): boolean {
  if (m.branchChoices < p.branchChoices[0] || m.branchChoices > p.branchChoices[1]) return false;
  if (m.solutionLength < p.minSolutionLength) return false;
  if (p.maxSolutionLength !== undefined && m.solutionLength > p.maxSolutionLength) return false;
  if (p.maxDeadEndDepth !== undefined && m.maxDeadEndDepth > p.maxDeadEndDepth) return false;
  if (p.maxDecisionPoints !== undefined && m.decisionPoints > p.maxDecisionPoints) return false;
  if (m.maxDeadEndDepth < 2) return false; // at least one genuinely plausible wrong branch
  return true;
}

export function assembleMaze(seed: string, profile: MazeProfile, layout: RawLayout, extras: { usedFallback: boolean; attempts: number }): Maze {
  const g = layout.grid;
  const cells = buildCells(layout);
  const center = centerCellOf(g);
  const check = checkGraph(cells, center);
  if (!check.ok) throw new Error(`invalid maze graph: ${check.reason}`);
  const metrics = computeMetrics(cells, layout.entranceCell, center);
  if (!metrics) throw new Error('centre unreachable');
  const entranceNode = cells.length;
  const corridors: Maze['corridors'] = [];
  for (const c of cells) for (const n of c.neighbors) if (n > c.id) corridors.push({ from: c.id, to: n });
  corridors.push({ from: entranceNode, to: layout.entranceCell });
  const centerPos = { x: (center % g.cols) + 0.5, y: Math.floor(center / g.cols) + 0.5 };
  return {
    seed,
    generatorVersion: GENERATOR_VERSION,
    width: g.cols,
    height: g.rows,
    profile,
    cells,
    entranceNode,
    entrance: entranceGeometry(g, layout.entranceCell, layout.side),
    goal: { cellId: center, center: centerPos, radius: 0.32 },
    corridors,
    corridorRadius: CORRIDOR_RADIUS,
    frameMargin: FRAME_MARGIN,
    metrics,
    layoutHash: layoutHash(layout),
    usedFallback: extras.usedFallback,
    attempts: extras.attempts,
  };
}

function attemptLayout(g: GridSpec, rng: Rng, bias: [number, number]): RawLayout {
  const pNewest = rng.range(bias[0], bias[1]);
  const edges = growingTree(g, rng, pNewest);
  const center = centerCellOf(g);
  const centerLinks = gridNeighbors(g, center);
  edges.push([rng.pick(centerLinks), center]);
  const { side, cell } = pickEntrance(g, rng);
  return { grid: g, edges, entranceCell: cell, side };
}

/** Validated fallback seeds per effective profile (verified by tests/domain/maze.test.ts). */
export const FALLBACK_SEEDS: Record<string, string> = {};

/**
 * Deterministic: the same seed, profile and generator version always yield the same
 * maze, so a saved session can be rebuilt exactly. Repeat-avoidance happens one level
 * up by drawing a new seed, never by skipping attempts here.
 */
export function tryGenerate(seed: string, profile: MazeProfile): Maze | null {
  const rng = createRng(seed, `layout:v${GENERATOR_VERSION}`);
  const center = centerCellOf(profile.grid);
  const budget = profile.maxAttempts ?? MAX_ATTEMPTS;
  for (let attempt = 1; attempt <= budget; attempt++) {
    const layout = attemptLayout(profile.grid, rng, profile.bias);
    const cells = buildCells(layout);
    if (!checkGraph(cells, center).ok) continue;
    const metrics = computeMetrics(cells, layout.entranceCell, center);
    if (!metrics || !meetsProfile(metrics, profile)) continue;
    return assembleMaze(seed, profile, layout, { usedFallback: false, attempts: attempt });
  }
  return null;
}

export function generateMaze(seed: string, profile: MazeProfile): Maze {
  const maze = tryGenerate(seed, profile);
  if (maze) return maze;
  const fbKey = `${profile.difficulty}:${key(profile.grid)}`;
  const fbSeed = FALLBACK_SEEDS[fbKey] ?? `fallback:${fbKey}`;
  const fallback = tryGenerate(fbSeed, profile);
  if (!fallback) throw new Error(`fallback maze failed for ${fbKey}`);
  return { ...fallback, seed, usedFallback: true, attempts: profile.maxAttempts ?? MAX_ATTEMPTS };
}

// ---------------------------------------------------------------------------
// Fixed introductory maze for the very first quest (Bill and the coconut).

const INTRO_GRID: GridSpec = { cols: 5, rows: 5 };
const c = (x: number, y: number): number => y * INTRO_GRID.cols + x;
export const INTRO_LAYOUT: RawLayout = {
  grid: INTRO_GRID,
  entranceCell: c(1, 4),
  side: 'bottom',
  edges: [
    // solution: straight up the left-centre column, across the top, down to the clearing
    [c(1, 4), c(1, 3)],
    [c(1, 3), c(1, 2)],
    [c(1, 2), c(1, 1)],
    [c(1, 1), c(1, 0)],
    [c(1, 0), c(2, 0)],
    [c(2, 0), c(3, 0)],
    [c(3, 0), c(3, 1)],
    [c(3, 1), c(2, 1)],
    [c(2, 1), c(2, 2)],
    // left wrong branch
    [c(1, 2), c(0, 2)],
    [c(0, 2), c(0, 1)],
    [c(0, 1), c(0, 0)],
    [c(0, 2), c(0, 3)],
    [c(0, 3), c(0, 4)],
    // top-right wrong branch
    [c(3, 0), c(4, 0)],
    [c(4, 0), c(4, 1)],
    // lower-right wrong branch
    [c(3, 1), c(3, 2)],
    [c(3, 2), c(4, 2)],
    [c(4, 2), c(4, 3)],
    [c(4, 3), c(4, 4)],
    [c(3, 2), c(3, 3)],
    [c(3, 3), c(2, 3)],
    [c(3, 3), c(3, 4)],
    [c(3, 4), c(2, 4)],
  ],
};

export const INTRO_SEED = 'intro-bill-coconut';

export function introMaze(): Maze {
  return assembleMaze(INTRO_SEED, profileFor('easy', INTRO_GRID), INTRO_LAYOUT, { usedFallback: false, attempts: 0 });
}

/** Rebuild a maze for a stored session (seed + grid + difficulty + version). */
export function rebuildMaze(seed: string, difficulty: Difficulty, grid: GridSpec, intro: boolean): Maze {
  if (intro) return introMaze();
  return generateMaze(seed, profileFor(difficulty, grid));
}
