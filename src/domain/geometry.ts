/**
 * Exact 2D geometry for corridor collision.
 *
 * Walkable space is a union of capsules (a segment swept by a disc). Each capsule
 * may carry a half-plane restriction `s >= minS`, measured along its axis from
 * `a`, which forbids reversing back along the trail. Every query here is exact:
 * the line/capsule intersection is solved analytically, so a fast movement can
 * never tunnel through a wall between two samples.
 */
import type { Point } from './types';

export interface Capsule {
  a: Point;
  b: Point;
  r: number;
  /** Optional half-plane restriction: projection along a→b (in units) must be ≥ minS. */
  minS?: number;
  /** Arbitrary tag so callers can tell which edge a capsule represents. */
  tag?: number;
}

const EPS = 1e-9;

export const add = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: p.y + q.y });
export const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
export const scale = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
export const dot = (p: Point, q: Point): number => p.x * q.x + p.y * q.y;
export const len = (p: Point): number => Math.hypot(p.x, p.y);
export const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
export const lerp = (p: Point, q: Point, t: number): Point => ({
  x: p.x + (q.x - p.x) * t,
  y: p.y + (q.y - p.y) * t,
});

interface Frame {
  e: Point;
  n: Point;
  L: number;
}

function frameOf(c: Capsule): Frame {
  const u = sub(c.b, c.a);
  const L = len(u);
  if (L < EPS) return { e: { x: 1, y: 0 }, n: { x: 0, y: 1 }, L: 0 };
  const e = scale(u, 1 / L);
  return { e, n: { x: -e.y, y: e.x }, L };
}

/** Projection of p along capsule axis, in units from a. */
export function axisParam(c: Capsule, p: Point): number {
  return dot(sub(p, c.a), frameOf(c).e);
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  const u = sub(b, a);
  const L2 = dot(u, u);
  if (L2 < EPS) return dist(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), u) / L2));
  return dist(p, add(a, scale(u, t)));
}

type Interval = [number, number] | null;

/** t-range where lo ≤ c0 + c1·t ≤ hi. */
function linearRange(c0: number, c1: number, lo: number, hi: number): Interval {
  if (Math.abs(c1) < EPS) return c0 >= lo - EPS && c0 <= hi + EPS ? [-Infinity, Infinity] : null;
  let t0 = (lo - c0) / c1;
  let t1 = (hi - c0) / c1;
  if (t0 > t1) [t0, t1] = [t1, t0];
  return [t0, t1];
}

function intersect(a: Interval, b: Interval): Interval {
  if (!a || !b) return null;
  const lo = Math.max(a[0], b[0]);
  const hi = Math.min(a[1], b[1]);
  return lo <= hi + EPS ? [lo, Math.max(lo, hi)] : null;
}

/** t-range where |p0 + t·d − c| ≤ r. */
function discRange(p0: Point, d: Point, c: Point, r: number): Interval {
  const m = sub(p0, c);
  const A = dot(d, d);
  const B = 2 * dot(d, m);
  const C = dot(m, m) - r * r;
  if (A < EPS) return C <= EPS ? [-Infinity, Infinity] : null;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  return [(-B - sq) / (2 * A), (-B + sq) / (2 * A)];
}

/** Exact t-range where the moving point p0 + t·d lies inside the (restricted) capsule. */
export function capsuleRange(p0: Point, d: Point, c: Capsule): Interval {
  const f = frameOf(c);
  const rel = sub(p0, c.a);
  const s0 = dot(rel, f.e);
  const s1 = dot(d, f.e);
  const v0 = dot(rel, f.n);
  const v1 = dot(d, f.n);
  const pieces: Interval[] = [discRange(p0, d, c.a, c.r), discRange(p0, d, c.b, c.r)];
  if (f.L > EPS) pieces.push(intersect(linearRange(s0, s1, 0, f.L), linearRange(v0, v1, -c.r, c.r)));
  let lo = Infinity;
  let hi = -Infinity;
  for (const piece of pieces) {
    if (!piece) continue;
    lo = Math.min(lo, piece[0]);
    hi = Math.max(hi, piece[1]);
  }
  if (lo > hi) return null;
  let range: Interval = [lo, hi];
  if (c.minS !== undefined) range = intersect(range, linearRange(s0, s1, c.minS, Infinity));
  return range;
}

export function insideCapsule(p: Point, c: Capsule, tol = 1e-7): boolean {
  if (c.minS !== undefined && axisParam(c, p) < c.minS - tol) return false;
  return distToSegment(p, c.a, c.b) <= c.r + tol;
}

/**
 * Largest t ∈ [0, 1] such that the whole segment from `from` to `from + t·(to − from)`
 * lies inside the union of capsules. Returns 0 if `from` is not inside the union.
 */
export function reachAlong(from: Point, to: Point, caps: readonly Capsule[]): number {
  const d = sub(to, from);
  const ranges: Array<[number, number]> = [];
  for (const c of caps) {
    const r = capsuleRange(from, d, c);
    if (!r) continue;
    const lo = Math.max(0, r[0]);
    const hi = Math.min(1, r[1]);
    if (hi >= lo - EPS) ranges.push([lo, hi]);
  }
  let cur = 0;
  let covered = false;
  for (;;) {
    let best = cur;
    for (const [lo, hi] of ranges) {
      if (lo <= cur + 1e-9 && hi > best) best = hi;
      if (lo <= cur + 1e-9) covered = true;
    }
    if (!covered) return 0;
    if (best <= cur + 1e-12) break;
    cur = best;
    if (cur >= 1) return 1;
  }
  return cur;
}

/**
 * Projections land this far inside the capsule wall, so a point pulled back
 * onto the edge is never outside it by floating-point rounding (found by the
 * random-scribble property test: 2e-15 units outside on an exact edge).
 */
const INSET = 1e-9;

/** Closest point to p within a single (possibly restricted) capsule; null if empty. */
export function closestInCapsule(p: Point, c: Capsule): Point | null {
  const f = frameOf(c);
  const rel = sub(p, c.a);
  const s = Math.max(0, Math.min(f.L, dot(rel, f.e)));
  const S = add(c.a, scale(f.e, s));
  const v = sub(p, S);
  const dv = len(v);
  const q = dv <= c.r - INSET ? p : add(S, scale(v, (c.r - INSET) / dv));
  if (c.minS === undefined || axisParam(c, q) >= c.minS - 1e-12) return q;
  const sm = c.minS;
  if (sm < -c.r || sm > f.L + c.r) return null;
  const r = c.r - INSET;
  let w = r;
  if (sm < 0) w = Math.sqrt(Math.max(0, r * r - sm * sm));
  else if (sm > f.L) w = Math.sqrt(Math.max(0, r * r - (sm - f.L) ** 2));
  const vp = Math.max(-w, Math.min(w, dot(rel, f.n)));
  return add(add(c.a, scale(f.e, sm)), scale(f.n, vp));
}

/** Closest point to p within a union of capsules. */
export function closestInUnion(p: Point, caps: readonly Capsule[]): { point: Point; distance: number; index: number } | null {
  let best: { point: Point; distance: number; index: number } | null = null;
  caps.forEach((c, index) => {
    const q = closestInCapsule(p, c);
    if (!q) return;
    const d = dist(p, q);
    if (!best || d < best.distance - 1e-12) best = { point: q, distance: d, index };
  });
  return best;
}
