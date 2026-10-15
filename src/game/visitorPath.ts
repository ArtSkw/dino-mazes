/**
 * Jungle visitors' paths (owner request, 15 Oct 2026): a ladybug, a snail or
 * a frog comes out of the jungle at the left or right edge of the screen,
 * where the butterflies fly, wanders a little over the stones and leaves,
 * and goes back off screen. Pure functions of time, so they are tested
 * without a game.
 *
 * A visit: enter from beyond the screen edge to a resting spot near the edge
 * (on the jungle border, never over the board or a button), rest, and leave:
 *   ladybug: walks in, rests, opens its wing cases and flies off up and out;
 *   snail:   crawls in slowly, rests and pulls into its shell for a moment,
 *            crawls back out;
 *   frog:    two hops in, sits, two hops out.
 */
import type { Point } from '../domain/types';
import type { Layout } from '../platform/layout';

export type VisitorKind = 'ladybug' | 'snail' | 'frog';
export const VISITOR_KINDS: VisitorKind[] = ['ladybug', 'snail', 'frog'];

/** Free side strip a visitor may use: x0..x1 on screen, y0..y1 clear of buttons and the friend. */
export interface Rail {
  side: 'left' | 'right';
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Visit {
  kind: VisitorKind;
  side: 'left' | 'right';
  /** Visitor size on screen (px). */
  size: number;
  enter: Point;
  stop: Point;
  exit: Point;
  /** Seconds: coming in, resting, going out. */
  inS: number;
  restS: number;
  outS: number;
}

export interface VisitorPose {
  x: number;
  y: number;
  /** Degrees; the art's own facing is already accounted for. */
  angle: number;
  /** Mirror horizontally (the snail walking left). */
  mirror: boolean;
  /** Frog: the stretched jump pose. */
  jump: boolean;
  /** Ladybug: wing cases and wings, 0 closed … 1 open. */
  wings: number;
  /** Snail: body out of the shell, 1 out … 0.25 in. */
  body: number;
  done: boolean;
}

const SPEED: Record<VisitorKind, number> = { ladybug: 70, snail: 22, frog: 0 };
const HOP_S = 0.5;
const HOP_REST_S = 0.3;
/** Which way the art faces (degrees from screen-right): ladybug up, snail right, frog down. */
const FACING: Record<VisitorKind, number> = { ladybug: -90, snail: 0, frog: 90 };

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const smooth = (x: number): number => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};
const lerp = (a: Point, b: Point, u: number): Point => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

/** Plan one visit on a rail (`rand` returns 0..1). */
export function planVisit(kind: VisitorKind, rail: Rail, vw: number, size: number, rand: () => number): Visit {
  const left = rail.side === 'left';
  const outside = left ? -size : vw + size;
  const width = rail.x1 - rail.x0;
  // Rest on the jungle border near the screen edge, not out on the sand.
  // The snail only peeks in a little (it is slow); the others come a bit further.
  const depth = Math.min(width * (0.22 + rand() * 0.3), kind === 'snail' ? size * 1.6 : Infinity);
  const stopX = left ? rail.x0 + depth : rail.x1 - depth;
  const yLo = rail.y0 + size;
  const yHi = Math.max(yLo, rail.y1 - size);
  const stop = { x: clamp(stopX, rail.x0 + size / 2, rail.x1 - size / 2), y: yLo + rand() * (yHi - yLo) };
  const enter = { x: outside, y: clamp(stop.y + (rand() - 0.5) * 120, yLo, yHi) };
  const exit = kind === 'ladybug' ? { x: outside, y: stop.y - (120 + rand() * 90) } : { x: outside, y: clamp(stop.y + (rand() - 0.5) * 180, yLo, yHi) };
  const dIn = Math.hypot(stop.x - enter.x, stop.y - enter.y);
  const dOut = Math.hypot(exit.x - stop.x, exit.y - stop.y);
  const hopping = 2 * (HOP_S + HOP_REST_S);
  const inS = kind === 'frog' ? hopping : dIn / SPEED[kind];
  const outS = kind === 'frog' ? hopping : kind === 'ladybug' ? 0.6 + 1.5 : dOut / SPEED[kind];
  const restS = kind === 'snail' ? 3.2 : kind === 'frog' ? 2.6 : 1.8;
  return { kind, side: rail.side, size, enter, stop, exit, inS, restS, outS };
}

export function visitDuration(v: Visit): number {
  return v.inS + v.restS + v.outS;
}

/** Heading in degrees for movement from a to b, turned to the art's facing. */
function heading(kind: VisitorKind, a: Point, b: Point): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI - FACING[kind];
}

/** Two frog hops from a to b: progress along the way, lift (0..1) and whether it is in the air. */
function hops(a: Point, b: Point, u: number): { p: Point; lift: number; air: boolean } {
  const step = HOP_S + HOP_REST_S;
  const total = 2 * step;
  const t = clamp(u, 0, 1) * total;
  const i = Math.min(1, Math.floor(t / step));
  const local = t - i * step;
  const k = clamp(local / HOP_S, 0, 1);
  const along = (i + k) / 2;
  return { p: lerp(a, b, along), lift: Math.sin(Math.PI * k) * (local < HOP_S ? 1 : 0), air: local < HOP_S && k > 0.05 && k < 0.95 };
}

export function visitPose(v: Visit, t: number): VisitorPose {
  const base: VisitorPose = { x: v.stop.x, y: v.stop.y, angle: 0, mirror: false, jump: false, wings: 0, body: 1, done: false };
  const inward = v.side === 'left' ? { x: v.stop.x + 1, y: v.stop.y } : { x: v.stop.x - 1, y: v.stop.y };
  if (t >= visitDuration(v)) return { ...base, x: v.exit.x, y: v.exit.y, done: true };
  if (v.kind === 'frog') {
    const lift = v.size * 0.6;
    if (t < v.inS) {
      const h = hops(v.enter, v.stop, t / v.inS);
      return { ...base, x: h.p.x, y: h.p.y - h.lift * lift, angle: heading('frog', v.enter, v.stop), jump: h.air };
    }
    if (t < v.inS + v.restS) return { ...base, angle: heading('frog', v.stop, inward) };
    const h = hops(v.stop, v.exit, (t - v.inS - v.restS) / v.outS);
    return { ...base, x: h.p.x, y: h.p.y - h.lift * lift, angle: heading('frog', v.stop, v.exit), jump: h.air };
  }
  if (v.kind === 'snail') {
    // Seen from the side-ish: mirrored when it crawls left, nose tilted with the slope.
    const tilt = (a: Point, b: Point): number => clamp((Math.atan2(b.y - a.y, Math.abs(b.x - a.x)) * 180) / Math.PI, -25, 25);
    const mirrorIn = v.stop.x < v.enter.x;
    if (t < v.inS) {
      const p = lerp(v.enter, v.stop, t / v.inS);
      return { ...base, x: p.x, y: p.y, mirror: mirrorIn, angle: tilt(v.enter, v.stop) * (mirrorIn ? -1 : 1) };
    }
    const r = t - v.inS;
    if (r < v.restS) {
      // Into the shell for a moment, then out again.
      const inside = r < 0.9 ? 0 : r < 1.2 ? (r - 0.9) / 0.3 : r < 2.2 ? 1 : 1 - smooth((r - 2.2) / 0.8);
      return { ...base, mirror: mirrorIn, body: 1 - 0.75 * inside };
    }
    const p = lerp(v.stop, v.exit, (r - v.restS) / v.outS);
    const mirrorOut = v.exit.x < v.stop.x;
    return { ...base, x: p.x, y: p.y, mirror: mirrorOut, angle: tilt(v.stop, v.exit) * (mirrorOut ? -1 : 1) };
  }
  // Ladybug.
  if (t < v.inS) {
    const p = lerp(v.enter, v.stop, smooth(t / v.inS) * 0.15 + (t / v.inS) * 0.85);
    return { ...base, x: p.x, y: p.y, angle: heading('ladybug', v.enter, v.stop) + 6 * Math.sin(t * 9) };
  }
  const r = t - v.inS;
  const turn = 25 * (v.side === 'left' ? -1 : 1);
  const walked = heading('ladybug', v.enter, v.stop);
  if (r < v.restS) return { ...base, angle: walked + turn * smooth(r / v.restS) };
  // Wing cases open, then it flies off, turning toward where it goes.
  const o = r - v.restS;
  const wings = smooth(o / 0.6);
  const k = clamp((o - 0.6) / (v.outS - 0.6), 0, 1);
  const p = lerp(v.stop, v.exit, smooth(k));
  let to = heading('ladybug', v.stop, v.exit);
  const from = walked + turn;
  while (to - from > 180) to -= 360;
  while (to - from < -180) to += 360;
  return { ...base, x: p.x, y: p.y - Math.sin(Math.PI * k) * v.size, angle: from + (to - from) * smooth(k), wings };
}

/** Free strips at the screen's sides for a visitor of `size` px (landscape only). */
export function visitorRails(L: Layout, size: number): Rail[] {
  if (L.orientation !== 'landscape') return [];
  const rails: Rail[] = [];
  const top = (r: { y: number; h: number }): number => r.y + r.h + 12;
  const leftTop = top(L.hint);
  const leftBottom = Math.min(L.friendVisible.y, L.vh) - 12;
  const left: Rail = { side: 'left', x0: 0, x1: L.board.x - 10, y0: leftTop, y1: leftBottom };
  const rightTop = Math.max(top(L.clusterRect), top(L.home));
  const right: Rail = { side: 'right', x0: L.board.x + L.board.w + 10, x1: L.vw, y0: rightTop, y1: L.reset.y - 12 };
  for (const r of [left, right]) if (r.x1 - r.x0 >= size * 2 && r.y1 - r.y0 >= size * 4) rails.push(r);
  return rails;
}
