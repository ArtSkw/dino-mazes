import { describe, expect, it } from 'vitest';
import { generateMaze, introMaze, nodeNeighbors, nodePos, profileFor } from '../../src/domain/maze';
import { TrailEngine, computeHint, type Dir } from '../../src/domain/trail';
import { dist } from '../../src/domain/geometry';
import type { Maze, Point } from '../../src/domain/types';
import { allCapsules, centerlinePath, mulberry, polylineInside } from './helpers';

function solutionNodes(maze: Maze): number[] {
  return [maze.entranceNode, ...maze.metrics.solution];
}

function drawPath(engine: TrailEngine, pts: readonly Point[]): { solvedEvents: number; lost: boolean } {
  let solvedEvents = 0;
  let lost = false;
  const first = pts[0] as Point;
  const r0 = engine.begin(first);
  if (!r0) return { solvedEvents, lost: true };
  if (r0.solvedNow) solvedEvents++;
  for (const p of pts.slice(1)) {
    const r = engine.move(p);
    if (r.solvedNow) solvedEvents++;
    if (r.lost) lost = true;
  }
  engine.end();
  return { solvedEvents, lost };
}

/** Find a wrong branch: a solution node with a forward option off the solution. */
function wrongBranch(maze: Maze): { prefix: number[]; wrong: number } {
  const sol = maze.metrics.solution;
  for (let i = 0; i < sol.length - 1; i++) {
    const back = i === 0 ? maze.entranceNode : (sol[i - 1] as number);
    const wrong = nodeNeighbors(maze, sol[i] as number).find((n) => n !== back && n !== sol[i + 1]);
    if (wrong !== undefined) return { prefix: [maze.entranceNode, ...sol.slice(0, i + 1)], wrong };
  }
  throw new Error('no wrong branch');
}

/** Follow a dead-end subtree to a leaf. */
function walkToLeaf(maze: Maze, from: number, start: number): number[] {
  const path = [start];
  let prev = from;
  let cur = start;
  for (;;) {
    const next = nodeNeighbors(maze, cur).find((n) => n !== prev);
    if (next === undefined) return path;
    path.push(next);
    prev = cur;
    cur = next;
  }
}

const mazes = (): Maze[] => [
  introMaze(),
  generateMaze('t1', profileFor('easy', { cols: 5, rows: 5 })),
  generateMaze('t2', profileFor('medium', { cols: 7, rows: 7 })),
  generateMaze('t3', profileFor('harder', { cols: 9, rows: 9 })),
  generateMaze('t4', profileFor('harder', { cols: 9, rows: 7 })),
  generateMaze('t5', profileFor('expert', { cols: 7, rows: 7 })),
];

describe('drawing the solution', () => {
  it('solves along centre-lines and completes exactly once', () => {
    for (const maze of mazes()) {
      const e = new TrailEngine(maze);
      const r = drawPath(e, centerlinePath(maze, solutionNodes(maze)));
      expect(r.lost).toBe(false);
      expect(e.solved).toBe(true);
      expect(r.solvedEvents).toBe(1);
      expect(e.route.slice(1)).toEqual(maze.metrics.solution);
      // Further input after completion is ignored.
      expect(e.begin(e.endpoint!)).toBeNull();
      expect(e.move({ x: 0, y: 0 }).advanced).toBe(false);
    }
  });

  it('tolerates gentle wobble inside the corridor', () => {
    const rnd = mulberry(7);
    for (const maze of mazes()) {
      const e = new TrailEngine(maze);
      const pts = centerlinePath(maze, solutionNodes(maze)).map((p) => ({ x: p.x + (rnd() - 0.5) * 0.3, y: p.y + (rnd() - 0.5) * 0.3 }));
      pts[0] = maze.entrance.outside;
      const r = drawPath(e, pts);
      expect(r.lost).toBe(false);
      expect(e.solved).toBe(true);
    }
  });

  it('first accepted point is the outside entrance', () => {
    const maze = introMaze();
    const e = new TrailEngine(maze);
    const O = maze.entrance.outside;
    e.begin({ x: O.x + 0.2, y: O.y + 0.1 });
    expect(e.points[0]).toEqual(O);
  });
});

describe('collision', () => {
  it('a fast swipe cannot tunnel through walls to the treasure', () => {
    for (const maze of mazes()) {
      const e = new TrailEngine(maze);
      e.begin(maze.entrance.outside);
      e.move(maze.goal.center);
      expect(e.solved).toBe(false);
      expect(polylineInside(e.points, allCapsules(maze, e.collisionRadius))).toBe(true);
      expect(e.route).not.toContain(maze.goal.cellId);
    }
  });

  it('pressing on the treasure without a connected trail does nothing', () => {
    for (const maze of mazes()) {
      const e = new TrailEngine(maze);
      expect(e.begin(maze.goal.center)).toBeNull();
      expect(e.points).toHaveLength(0);
      e.begin(maze.entrance.outside);
      e.end();
      expect(e.begin(maze.goal.center)).toBeNull();
      expect(e.solved).toBe(false);
    }
  });

  it('cannot leave the board and come back in through the outside', () => {
    for (const maze of mazes()) {
      const e = new TrailEngine(maze);
      const O = maze.entrance.outside;
      e.begin(O);
      // Sweep far outside the frame and around to the far side.
      const path = [
        { x: -2, y: O.y },
        { x: -2, y: -2 },
        { x: maze.width + 2, y: -2 },
        maze.goal.center,
      ];
      for (const p of path) e.move(p);
      expect(e.solved).toBe(false);
      for (const p of e.points) {
        expect(p.y).toBeLessThanOrEqual(maze.height + maze.frameMargin + 1);
      }
      expect(polylineInside(e.points, allCapsules(maze, e.collisionRadius))).toBe(true);
    }
  });

  it('diagonal corner cuts are clipped at every turn of every maze', () => {
    const rnd = mulberry(11);
    for (const maze of mazes()) {
      const nodes = solutionNodes(maze);
      const e = new TrailEngine(maze);
      e.begin(maze.entrance.outside);
      for (let i = 1; i < nodes.length - 1; i++) {
        const a = nodePos(maze, nodes[i - 1] as number);
        const b = nodePos(maze, nodes[i] as number);
        const c = nodePos(maze, nodes[i + 1] as number);
        // Cut diagonally from the middle of one corridor to the middle of the next.
        const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const m2 = { x: (b.x + c.x) / 2 + (rnd() - 0.5) * 0.1, y: (b.y + c.y) / 2 };
        e.move(m1);
        e.move(m2);
        if (!e.connected) e.begin(e.endpoint!);
        e.move(b);
        e.move(c);
      }
      expect(polylineInside(e.points, allCapsules(maze, e.collisionRadius))).toBe(true);
    }
  });

  it('ink never crosses a hedge under random scribbles (property test)', () => {
    for (let s = 0; s < 120; s++) {
      const maze = generateMaze(`scribble-${s}`, profileFor(s % 3 === 0 ? 'easy' : s % 3 === 1 ? 'medium' : 'harder', s % 3 === 0 ? { cols: 5, rows: 5 } : s % 3 === 1 ? { cols: 7, rows: 7 } : { cols: 9, rows: 9 }));
      const rnd = mulberry(s + 1);
      const e = new TrailEngine(maze);
      const caps = allCapsules(maze, e.collisionRadius);
      let p = { ...maze.entrance.outside };
      e.begin(p);
      for (let k = 0; k < 400; k++) {
        // Mostly small moves, sometimes a wild jump.
        const jump = rnd() < 0.05 ? 3 : 0.35;
        p = { x: p.x + (rnd() - 0.5) * jump, y: p.y + (rnd() - 0.5) * jump };
        if (rnd() < 0.03) {
          e.end();
          e.begin(p);
        } else if (!e.connected && rnd() < 0.3 && e.endpoint) {
          p = { ...e.endpoint };
          e.begin(p);
        } else {
          e.move(p);
        }
      }
      expect(polylineInside(e.points, caps)).toBe(true);
      // Route must be a simple path along real edges.
      const seen = new Set<number>();
      for (let i = 0; i < e.route.length; i++) {
        const n = e.route[i] as number;
        expect(seen.has(n)).toBe(false);
        seen.add(n);
        if (i > 0) expect(nodeNeighbors(maze, e.route[i - 1] as number)).toContain(n);
      }
      if (e.solved) expect(e.route[e.route.length - 1]).toBe(maze.goal.cellId);
    }
  });
});

describe('lift, resume and reversing', () => {
  it('lifting preserves ink; resuming only near the endpoint', () => {
    const maze = introMaze();
    const e = new TrailEngine(maze);
    const path = centerlinePath(maze, solutionNodes(maze).slice(0, 4));
    drawPath(e, path);
    const count = e.points.length;
    const E = e.endpoint!;
    expect(e.connected).toBe(false);
    expect(e.begin({ x: E.x + 1.2, y: E.y })).toBeNull();
    expect(e.begin(maze.entrance.outside)).toBeNull();
    expect(e.points).toHaveLength(count);
    expect(e.begin({ x: E.x + 0.1, y: E.y })).not.toBeNull();
    expect(e.connected).toBe(true);
  });

  it('pressing elsewhere then sliding onto the endpoint reconnects without a gap', () => {
    const maze = introMaze();
    const e = new TrailEngine(maze);
    drawPath(e, centerlinePath(maze, solutionNodes(maze).slice(0, 3)));
    const E = e.endpoint!;
    // A move while disconnected far away does nothing…
    expect(e.move({ x: E.x + 2, y: E.y }).advanced).toBe(false);
    // …arriving at the endpoint reconnects.
    e.move({ x: E.x, y: E.y - 0.05 });
    expect(e.connected).toBe(true);
    expect(polylineInside(e.points, allCapsules(maze, e.collisionRadius))).toBe(true);
  });

  it('reversing does not erase and the endpoint stops at traversed ink', () => {
    const maze = introMaze();
    const e = new TrailEngine(maze);
    const forward = centerlinePath(maze, solutionNodes(maze).slice(0, 4));
    e.begin(forward[0]!);
    for (const p of forward.slice(1)) e.move(p);
    const count = e.points.length;
    const route = [...e.route];
    const far = e.endpoint!;
    for (const p of forward.slice().reverse()) e.move(p);
    expect(e.points.length).toBeGreaterThanOrEqual(count);
    expect(e.route).toEqual(route);
    // The endpoint stays at the furthest ink: at most a small wobble inside the
    // junction it has reached (collision radius + jitter), never back along the trail.
    expect(dist(e.endpoint!, far)).toBeLessThanOrEqual(e.collisionRadius + e.opts.jitter);
  });

  it('a wrong branch stays valid and cannot be escaped without reset', () => {
    for (const maze of mazes()) {
      const { prefix, wrong } = wrongBranch(maze);
      const junction = prefix[prefix.length - 1] as number;
      const deadEnd = walkToLeaf(maze, junction, wrong);
      const e = new TrailEngine(maze);
      const r = drawPath(e, centerlinePath(maze, [...prefix, ...deadEnd]));
      expect(r.lost).toBe(false);
      expect(e.route).toContain(wrong);
      // Try every way back to the correct branch.
      e.begin(e.endpoint!);
      for (const p of centerlinePath(maze, [...deadEnd].reverse().concat([junction]))) e.move(p);
      const correctNext = maze.metrics.solution[prefix.length - 1] as number;
      e.move(nodePos(maze, correctNext));
      expect(e.route).not.toContain(correctNext);
      expect(polylineInside(e.points, allCapsules(maze, e.collisionRadius))).toBe(true);
      e.reset();
      expect(e.points).toHaveLength(0);
      expect(drawPath(e, centerlinePath(maze, solutionNodes(maze))).solvedEvents).toBe(1);
    }
  });

  it('a wall touch stops ink at the last safe point', () => {
    const maze = introMaze();
    const e = new TrailEngine(maze);
    drawPath(e, centerlinePath(maze, solutionNodes(maze).slice(0, 3)));
    e.begin(e.endpoint!);
    const before = e.points.length;
    // Drag sideways deep into the hedge.
    const E = e.endpoint!;
    const r = e.move({ x: E.x + 0.9, y: E.y });
    expect(r.lost).toBe(true);
    expect(e.connected).toBe(false);
    expect(e.points.length).toBeGreaterThanOrEqual(before);
    expect(polylineInside(e.points, allCapsules(maze, e.collisionRadius))).toBe(true);
  });
});

describe('keyboard alternate input', () => {
  const dirOf = (a: Point, b: Point): Dir =>
    Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? (b.x > a.x ? 'right' : 'left') : b.y > a.y ? 'down' : 'up';

  it('walks one segment per key press and completes the maze', () => {
    for (const maze of mazes()) {
      const e = new TrailEngine(maze);
      const nodes = solutionNodes(maze);
      let solvedEvents = 0;
      for (let i = 1; i < nodes.length; i++) {
        const d = dirOf(nodePos(maze, nodes[i - 1] as number), nodePos(maze, nodes[i] as number));
        expect(e.availableDirections()).toContain(d);
        const r = e.keyStep(d);
        expect(r).not.toBeNull();
        if (r?.solvedNow) solvedEvents++;
      }
      expect(e.solved).toBe(true);
      expect(solvedEvents).toBe(1);
    }
  });

  it('rejects directions into hedges', () => {
    const maze = introMaze();
    const e = new TrailEngine(maze);
    expect(e.keyStep('left')).toBeNull();
    expect(e.points).toHaveLength(0);
    expect(e.keyStep('up')).not.toBeNull();
    expect(e.keyStep('left')).toBeNull();
  });
});

describe('restore', () => {
  it('replays stored points into the same route', () => {
    for (const maze of mazes()) {
      const e = new TrailEngine(maze);
      drawPath(e, centerlinePath(maze, solutionNodes(maze).slice(0, 5)));
      const f = new TrailEngine(maze);
      expect(f.restore(e.points)).toBe(true);
      expect(f.route).toEqual(e.route);
      expect(f.endpoint).toEqual(e.endpoint);
      expect(f.connected).toBe(false);
    }
  });

  it('rejects trails that cross walls or start elsewhere', () => {
    const maze = introMaze();
    const f = new TrailEngine(maze);
    expect(f.restore([maze.entrance.outside, maze.goal.center])).toBe(false);
    expect(f.points).toHaveLength(0);
    expect(f.restore([{ x: 2.5, y: 2.5 }])).toBe(false);
  });
});

describe('hint', () => {
  it('points along the correct route and never extends the trail', () => {
    for (const maze of mazes()) {
      const e = new TrailEngine(maze);
      const h0 = computeHint(e);
      expect(h0.kind).toBe('path');
      if (h0.kind === 'path') expect(h0.points[0]).toEqual(maze.entrance.outside);
      drawPath(e, centerlinePath(maze, solutionNodes(maze).slice(0, 3)));
      const count = e.points.length;
      const h1 = computeHint(e);
      expect(h1.kind).toBe('path');
      expect(e.points).toHaveLength(count);
    }
  });

  it('shows the next two branch decisions (the cell after the second one), or the rest of the route', () => {
    for (const maze of mazes()) {
      const sol = maze.metrics.solution;
      const decisions: number[] = [];
      sol.forEach((n, i) => {
        if (i === sol.length - 1) return;
        const back = i === 0 ? maze.entranceNode : (sol[i - 1] as number);
        if (nodeNeighbors(maze, n).filter((x) => x !== back).length >= 2) decisions.push(i);
      });
      const h = computeHint(new TrailEngine(maze));
      if (h.kind !== 'path') throw new Error('expected a path hint');
      const nodes = decisions.length >= 2 ? (decisions[1] as number) + 2 : sol.length;
      expect(h.points).toHaveLength(1 + nodes);
      expect(h.points[h.points.length - 1]).toEqual(nodePos(maze, sol[nodes - 1] as number));
      // One decision only shows less.
      const one = computeHint(new TrailEngine(maze), 1);
      if (one.kind === 'path' && decisions.length >= 2) expect(one.points.length).toBeLessThan(h.points.length);
    }
  });

  it('suggests starting over from a wrong branch', () => {
    const maze = introMaze();
    const { prefix, wrong } = wrongBranch(maze);
    const e = new TrailEngine(maze);
    drawPath(e, centerlinePath(maze, [...prefix, wrong]));
    expect(computeHint(e).kind).toBe('reset');
  });
});
