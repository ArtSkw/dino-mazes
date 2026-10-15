/**
 * Where a hidden critter may sit (art/CODEX_REQUEST_POLISH.md): only on hedge,
 * never on a corridor, never near the entrance or the treasure clearing.
 *
 * Candidates are the middle of every wall between two cells that are not
 * joined, and points along the hedge frame around the grid. A candidate is
 * kept only if a critter of radius `r` (logical units) fits between it and
 * every corridor (centre lines widened by CORRIDOR_RADIUS). Pure, so it is
 * unit tested against generated mazes.
 */
import { CORRIDOR_RADIUS, FRAME_MARGIN, nodePos } from './maze';
import type { Maze, Point } from './types';

/** A critter's radius in logical units (cells are 1 wide; hedges between corridors are 0.4). */
export const CRITTER_RADIUS = 0.17;

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance from a point to the nearest corridor centre line. */
export function corridorDistance(maze: Maze, p: Point): number {
  let best = Infinity;
  for (const c of maze.corridors) best = Math.min(best, distToSegment(p, nodePos(maze, c.from), nodePos(maze, c.to)));
  return best;
}

export function critterSpots(maze: Maze, r = CRITTER_RADIUS): Point[] {
  const { width: cols, height: rows } = maze;
  const linked = (a: number, b: number): boolean => maze.cells[a]?.neighbors.includes(b) ?? false;
  const out: Point[] = [];
  // Walls between neighbouring cells that are not joined.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const id = y * cols + x;
      if (x + 1 < cols && !linked(id, id + 1)) out.push({ x: x + 1, y: y + 0.5 });
      if (y + 1 < rows && !linked(id, id + cols)) out.push({ x: x + 0.5, y: y + 1 });
    }
  }
  // The hedge frame around the grid.
  const band = FRAME_MARGIN / 2;
  for (let x = 0; x < cols; x++) out.push({ x: x + 0.5, y: -band }, { x: x + 0.5, y: rows + band });
  for (let y = 0; y < rows; y++) out.push({ x: -band, y: y + 0.5 }, { x: cols + band, y: y + 0.5 });
  const entrance = maze.entrance.outside;
  const goal = maze.goal.center;
  return out.filter(
    (p) =>
      corridorDistance(maze, p) >= CORRIDOR_RADIUS + r &&
      Math.hypot(p.x - entrance.x, p.y - entrance.y) >= 1.6 &&
      Math.hypot(p.x - goal.x, p.y - goal.y) >= 1.2,
  );
}
