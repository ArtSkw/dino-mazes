/**
 * The honest drawing engine (PRD §4.3, DEVELOPMENT_PLAN.md §4.2).
 *
 * State is a route through the maze tree (entrance → … → current head node) plus
 * the accepted ink points. At any moment the ink may only move inside:
 *   • the head corridor, restricted so progress cannot reverse by more than a
 *     small jitter allowance, and
 *   • the corridors leading forward from the head node.
 * Every accepted movement is validated with exact capsule intersection, so fast
 * swipes cannot tunnel through hedges, cut corners or jump between passages.
 *
 * Ergonomic tolerance: when the pointer strays slightly off the corridor the ink
 * follows the closest point inside the *currently allowed* corridors. It never
 * selects a passage that isn't adjacent to the head. Straying further stops the
 * ink and the child must return to the endpoint to continue.
 */
import { axisParam, closestInUnion, dist, insideCapsule, lerp, reachAlong, type Capsule } from './geometry';
import { nodeNeighbors, nodePos } from './maze';
import type { Maze, Point } from './types';

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface TrailOptions {
  /** Max distance the pointer may stray outside the allowed corridor while drawing (units). */
  tolerance: number;
  /** Pointer must be this close to the endpoint to resume (units). */
  resumeRadius: number;
  /** Pointer must be this close to the outside entrance point to begin (units). */
  entranceRadius: number;
  /** Backward progress allowed along the head corridor before ink stops (units). */
  jitter: number;
  /** Ink half-width in units; the ink edge must stay inside the visual corridor. */
  inkRadius: number;
  /** Extra safety margin between ink edge and hedge (units). */
  margin: number;
  /** Minimum distance between stored points (units). */
  minStep: number;
  /**
   * How deep the ink must go into a corridor leaving the head node before the
   * route commits to it (units from the node centre). Until then a finger that
   * drifts or dips into a wrong corridor can come back and carry on another way
   * (owner requests, 24 Oct 2026); deeper, only "Wróć" undoes the choice.
   */
  commitDepth: number;
}

export const DEFAULT_TRAIL_OPTIONS: TrailOptions = {
  tolerance: 0.3,
  resumeRadius: 0.38,
  entranceRadius: 0.55,
  jitter: 0.14,
  inkRadius: 0.065,
  margin: 0.015,
  minStep: 0.02,
  commitDepth: 0.7,
};

export interface MoveResult {
  /** True if new ink was accepted. */
  advanced: boolean;
  /** True if the pointer left the corridor and ink stopped (needs reconnection). */
  lost: boolean;
  /** True on the single move that completes the maze. */
  solvedNow: boolean;
  /** Nodes newly entered during this move. */
  entered: number[];
}

const SUBSTEP = 0.08;

export class TrailEngine {
  readonly maze: Maze;
  opts: TrailOptions;
  points: Point[] = [];
  /** Route through graph nodes; route[0] is the virtual outside entrance node. */
  route: number[] = [];
  /** Furthest progress along the head corridor (units from its start node). */
  headMax = 0;
  connected = false;
  solved = false;
  private lastPointer: Point | null = null;
  /**
   * The ink is in the opening of a corridor it has not committed to: which one,
   * and the index of its first point there. If the ink leaves that opening
   * again, those points are dropped, so a slip leaves no spike in the trail.
   */
  private slip: { tag: number; from: number } | null = null;

  constructor(maze: Maze, opts: Partial<TrailOptions> = {}) {
    this.maze = maze;
    this.opts = { ...DEFAULT_TRAIL_OPTIONS, ...opts };
  }

  /** Corridor radius available to the ink centre. */
  get collisionRadius(): number {
    return this.maze.corridorRadius - this.opts.inkRadius - this.opts.margin;
  }

  get started(): boolean {
    return this.points.length > 0;
  }

  get endpoint(): Point | null {
    return this.points[this.points.length - 1] ?? null;
  }

  get headNode(): number {
    return this.route[this.route.length - 1] ?? this.maze.entranceNode;
  }

  get previousNode(): number {
    return this.route[this.route.length - 2] ?? -1;
  }

  setOptions(opts: Partial<TrailOptions>): void {
    this.opts = { ...this.opts, ...opts };
  }

  reset(): void {
    this.points = [];
    this.route = [];
    this.headMax = 0;
    this.connected = false;
    this.solved = false;
    this.lastPointer = null;
    this.slip = null;
  }

  /** Capsules the ink may currently occupy. Tag = target node id, or -1 for the head. */
  allowedCapsules(): Capsule[] {
    const R = this.collisionRadius;
    const to = this.headNode;
    const from = this.previousNode;
    const caps: Capsule[] = [];
    if (from >= 0) {
      caps.push({ a: nodePos(this.maze, from), b: nodePos(this.maze, to), r: R, minS: this.headMax - this.opts.jitter, tag: -1 });
    }
    for (const m of nodeNeighbors(this.maze, to)) {
      if (m === from) continue;
      caps.push({ a: nodePos(this.maze, to), b: nodePos(this.maze, m), r: R, tag: m });
    }
    return caps;
  }

  private startRoute(): void {
    const O = this.maze.entrance.outside;
    this.points = [{ ...O }];
    this.route = [this.maze.entranceNode, this.maze.entrance.insideCell];
    this.headMax = 0;
  }

  /** Can a pointer press at p begin or resume drawing? (No state change.) */
  canBegin(p: Point): boolean {
    if (this.solved) return false;
    if (!this.started) return dist(p, this.maze.entrance.outside) <= this.opts.entranceRadius;
    const E = this.endpoint;
    return !!E && dist(p, E) <= this.opts.resumeRadius;
  }

  /** Pointer pressed. Returns true when drawing (re)connects. */
  begin(p: Point): MoveResult | null {
    if (!this.canBegin(p)) return null;
    if (!this.started) this.startRoute();
    this.connected = true;
    this.lastPointer = this.endpoint;
    return this.move(p);
  }

  /** Pointer released, cancelled or interrupted: keep ink, require reconnection. */
  end(): void {
    this.connected = false;
    this.lastPointer = null;
  }

  move(p: Point): MoveResult {
    const result: MoveResult = { advanced: false, lost: false, solvedNow: false, entered: [] };
    if (this.solved || !this.started) return result;
    const E = this.endpoint as Point;
    if (!this.connected) {
      // Mid-gesture reconnection: the pointer came back to the endpoint.
      if (dist(p, E) > this.opts.resumeRadius) return result;
      this.connected = true;
      this.lastPointer = E;
    }
    const from = this.lastPointer ?? E;
    const steps = Math.max(1, Math.ceil(dist(from, p) / SUBSTEP));
    for (let i = 1; i <= steps; i++) {
      const target = lerp(from, p, i / steps);
      const step = this.stepTo(target, result);
      if (step === 'lost') {
        result.lost = true;
        this.connected = false;
        this.lastPointer = null;
        return result;
      }
      if (this.solved) break;
    }
    this.lastPointer = p;
    return result;
  }

  /** Advance ink toward one sub-sample of the pointer path. */
  private stepTo(target: Point, result: MoveResult): 'ok' | 'lost' {
    const caps = this.allowedCapsules();
    const near = closestInUnion(target, caps);
    if (!near || near.distance > this.opts.tolerance) return 'lost';
    const E = this.endpoint as Point;
    const t = reachAlong(E, near.point, caps);
    // A finger cutting the inside of a turn would drag the ink straight into the
    // hedge corner and stop it there; lead it round the corner instead.
    if (t < 1 - 1e-9 && this.turnCorner(E, near.point, caps[near.index] as Capsule, caps, result)) return 'ok';
    if (t <= 0) return 'ok';
    const q = lerp(E, near.point, t);
    if (dist(E, q) < this.opts.minStep) return 'ok';
    this.accept(q, caps, result);
    return 'ok';
  }

  /**
   * Corner assist. When the pointer is in a corridor leaving the head node but
   * the straight line from the ink to it crosses the hedge corner of the turn,
   * the ink goes in two legs through a pivot inside the junction: first the
   * inside corner of the turn (the tightest honest path), then nearer the node
   * centre. Each leg lies inside one convex capsule (the head corridor, then the
   * next one), so the ink can never leave the corridors or reach a passage that
   * is not adjacent to the head; it only stops being blocked by the corner.
   */
  private turnCorner(E: Point, target: Point, into: Capsule, caps: Capsule[], result: MoveResult): boolean {
    if (into.tag === undefined || into.tag < 0) return false;
    const head = caps.find((c) => c.tag === -1);
    if (!head) return false;
    const node = into.a;
    const unit = (p: Point, q: Point): Point => {
      const l = dist(p, q) || 1;
      return { x: (q.x - p.x) / l, y: (q.y - p.y) / l };
    };
    const dIn = unit(head.a, head.b);
    const dOut = unit(into.a, into.b);
    const R = this.collisionRadius - 0.01;
    const inside = { x: dOut.x - dIn.x, y: dOut.y - dIn.y };
    // Straight on, the only corner in the way is a side opening's, when the ink
    // drifted into it: back out through the node centre.
    const pivots = Math.abs(dIn.x * dOut.x + dIn.y * dOut.y) > 0.5
      ? [node]
      : [
          { x: node.x + R * inside.x, y: node.y + R * inside.y },
          { x: node.x + (R / Math.SQRT2) * inside.x, y: node.y + (R / Math.SQRT2) * inside.y },
          node,
        ];
    for (const P of pivots) {
      if (reachAlong(E, P, caps) < 1 - 1e-9) continue;
      const t2 = reachAlong(P, target, caps);
      if (t2 <= 0) continue;
      if (dist(E, P) > 1e-6) this.accept(P, caps, result);
      if (this.solved) return true;
      const q = lerp(P, target, t2);
      if (dist(P, q) >= this.opts.minStep) this.accept(q, caps, result);
      return true;
    }
    return false;
  }

  private accept(q: Point, caps: Capsule[], result: MoveResult): void {
    const head = caps.find((c) => c.tag === -1);
    const zone = head && insideCapsule(q, head) ? -1 : (caps.find((c) => c.tag !== undefined && c.tag >= 0 && insideCapsule(q, c))?.tag ?? -1);
    if (this.slip && zone !== this.slip.tag) {
      // Back out of a side opening: drop the ink drawn in it when the trail
      // stays inside the corridors without it.
      const last = this.points[this.slip.from - 1];
      if (last && reachAlong(last, q, caps) >= 1 - 1e-9) this.points.length = this.slip.from;
      this.slip = null;
    }
    if (!this.slip && zone >= 0) this.slip = { tag: zone, from: this.points.length };
    this.points.push(q);
    result.advanced = true;
    let committed = false;
    for (const cap of caps) {
      if (cap.tag === undefined || cap.tag < 0) continue;
      if (!insideCapsule(q, cap)) continue;
      const s = axisParam(cap, q);
      if (s > this.opts.commitDepth) {
        this.route.push(cap.tag);
        this.headMax = s;
        result.entered.push(cap.tag);
        committed = true;
        this.slip = null;
        break;
      }
    }
    if (!committed && head) this.headMax = Math.max(this.headMax, axisParam(head, q));
    if (this.headNode === this.maze.goal.cellId && dist(q, this.maze.goal.center) <= this.maze.goal.radius) {
      this.solved = true;
      this.connected = false;
      result.solvedNow = true;
    }
  }

  // -------------------------------------------------------------------------
  // Keyboard alternate input: one valid segment per key press.

  private dirBetween(a: Point, b: Point): Dir {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  private atHeadNode(): boolean {
    const E = this.endpoint;
    return !!E && dist(E, nodePos(this.maze, this.headNode)) < 0.12;
  }

  /** Directions the keyboard may move in right now. */
  availableDirections(): Dir[] {
    if (this.solved) return [];
    if (!this.started) {
      const O = this.maze.entrance.outside;
      return [this.dirBetween(O, nodePos(this.maze, this.maze.entrance.insideCell))];
    }
    const head = nodePos(this.maze, this.headNode);
    if (!this.atHeadNode()) return [this.dirBetween(nodePos(this.maze, this.previousNode), head)];
    return nodeNeighbors(this.maze, this.headNode)
      .filter((m) => m !== this.previousNode)
      .map((m) => this.dirBetween(head, nodePos(this.maze, m)));
  }

  /** Walk along corridor centre-lines. Uses the same validation as pointer input. */
  keyStep(dir: Dir): MoveResult | null {
    if (this.solved) return null;
    if (!this.availableDirections().includes(dir)) return null;
    if (!this.started) this.startRoute();
    const result: MoveResult = { advanced: false, lost: false, solvedNow: false, entered: [] };
    const walk = (to: Point): boolean => {
      const E = this.endpoint as Point;
      const steps = Math.max(1, Math.ceil(dist(E, to) / SUBSTEP));
      const start = { ...E };
      for (let i = 1; i <= steps; i++) {
        if (this.stepTo(lerp(start, to, i / steps), result) === 'lost') return false;
        if (this.solved) return true;
      }
      return true;
    };
    const headPos = nodePos(this.maze, this.headNode);
    if (!this.atHeadNode()) {
      walk(headPos);
    } else {
      const target = nodeNeighbors(this.maze, this.headNode)
        .filter((m) => m !== this.previousNode)
        .find((m) => this.dirBetween(headPos, nodePos(this.maze, m)) === dir);
      if (target === undefined) return null;
      walk(nodePos(this.maze, target));
    }
    this.connected = false;
    this.lastPointer = null;
    return result;
  }

  // -------------------------------------------------------------------------
  // Persistence

  /** Rebuild state by replaying stored points through normal validation. */
  restore(points: readonly Point[]): boolean {
    this.reset();
    if (points.length === 0) return true;
    const first = points[0] as Point;
    if (dist(first, this.maze.entrance.outside) > 1e-6) return false;
    this.startRoute();
    this.connected = true;
    this.lastPointer = this.endpoint;
    for (let i = 1; i < points.length; i++) {
      const r = this.move(points[i] as Point);
      if (r.lost) {
        this.reset();
        return false;
      }
    }
    const last = points[points.length - 1] as Point;
    const E = this.endpoint as Point;
    this.connected = false;
    this.lastPointer = null;
    if (dist(E, last) > 0.05) {
      this.reset();
      return false;
    }
    return true;
  }
}

// ---------------------------------------------------------------------------
// Hint (explicit request only): where should the child go next?

export type Hint =
  | { kind: 'path'; points: Point[] }
  | { kind: 'reset' }
  | { kind: 'none' };

/**
 * Uses the solver only on explicit request. Returns the stretch of the correct
 * route from the current position up to just past the next `decisions` branch
 * decisions (two by default: "show me the next two moves"). Never extends the
 * trail itself.
 */
export function computeHint(engine: TrailEngine, decisions = 2): Hint {
  const maze = engine.maze;
  if (engine.solved) return { kind: 'none' };
  const solution = maze.metrics.solution;
  const route = engine.route.slice(1);
  if (route.length > solution.length) return { kind: 'reset' };
  for (let i = 0; i < route.length; i++) if (route[i] !== solution[i]) return { kind: 'reset' };
  const startIndex = Math.max(0, route.length - 1);
  const pts: Point[] = [engine.started ? (engine.endpoint as Point) : maze.entrance.outside];
  let passed = 0;
  for (let i = startIndex; i < solution.length; i++) {
    const node = solution[i] as number;
    pts.push(nodePos(maze, node));
    if (i === solution.length - 1) break;
    const back = i === 0 ? maze.entranceNode : (solution[i - 1] as number);
    const forward = nodeNeighbors(maze, node).filter((n) => n !== back);
    if (forward.length >= 2 && ++passed >= decisions) {
      // Include the correct next cell after the last shown decision, then stop.
      pts.push(nodePos(maze, solution[i + 1] as number));
      break;
    }
  }
  return { kind: 'path', points: pts };
}
