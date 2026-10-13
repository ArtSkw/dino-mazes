import { reachAlong, type Capsule } from '../../src/domain/geometry';
import { nodePos } from '../../src/domain/maze';
import type { Maze, Point } from '../../src/domain/types';

/** Every corridor of the maze as a capsule of radius r. */
export function allCapsules(maze: Maze, r: number): Capsule[] {
  return maze.corridors.map((c) => ({ a: nodePos(maze, c.from), b: nodePos(maze, c.to), r }));
}

/** True when every segment of the polyline lies inside the union of corridors. */
export function polylineInside(points: readonly Point[], caps: readonly Capsule[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    if (reachAlong(a, b, caps) < 1 - 1e-9) return false;
  }
  return true;
}

/** Centre-line points along a node path, densely sampled. */
export function centerlinePath(maze: Maze, nodes: readonly number[], step = 0.05): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const a = nodePos(maze, nodes[i - 1] as number);
    const b = nodePos(maze, nodes[i] as number);
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

/** Tiny deterministic PRNG for property tests. */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
