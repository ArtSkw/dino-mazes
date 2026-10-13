/**
 * Paints the static maze board into an offscreen canvas (DEVELOPMENT_PLAN.md §5).
 *
 * Gameplay geometry is never taken from art: corridors are the exact capsule
 * union from the validated graph. Hedges are a continuous code-rendered wall
 * fill, decorated with Codex foliage stamps clipped away from every corridor, so
 * foliage can never imply a false opening. Decoration uses its own seeded
 * stream, so art changes never alter routes.
 */
import { CORRIDOR_RADIUS, FRAME_MARGIN, WALL_ROUNDING, innerCorners, nodePos } from '../domain/maze';
import { createRng } from '../domain/rng';
import type { Maze, Point } from '../domain/types';

export interface BoardImages {
  ground: CanvasImageSource & { width: number; height: number };
  hedgeA: CanvasImageSource & { width: number; height: number };
  hedgeB: CanvasImageSource & { width: number; height: number };
  rocks: CanvasImageSource & { width: number; height: number };
  flowers: CanvasImageSource & { width: number; height: number };
}

export interface PaintedBoard {
  canvas: HTMLCanvasElement;
  /** Logical coordinate of the canvas's top-left corner. */
  origin: Point;
  /** Device pixels per logical unit used for painting. */
  scale: number;
  /** Logical size of the canvas. */
  size: { w: number; h: number };
}

export const CLEARING_RADIUS = 0.4;
const MAX_TEXTURE = 2048;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  return g;
}

function roundRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Stroke every corridor centre-line (plus the clearing) with the current style. */
function corridorPath(g: CanvasRenderingContext2D, maze: Maze, toPx: (p: Point) => Point): void {
  g.beginPath();
  for (const c of maze.corridors) {
    const a = toPx(nodePos(maze, c.from));
    const b = toPx(nodePos(maze, c.to));
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
  }
}

/**
 * The rounding wedges at every inside corner of the walkable space: the square
 * between the corner and the fillet circle, minus that circle. Cutting these
 * out of the hedge rounds its sharp outside corners. `r` is the corridor
 * half-width used for this layer, `f` the rounding radius; the circle centre
 * node + (r + f)(a + b) stays the same for the darker rim (r + d, f − d).
 * `overlap` pushes the straight sides that much into the corridors (already
 * cut away), so two anti-aliased edges never meet and leave a faint seam.
 */
function filletPath(g: CanvasRenderingContext2D, maze: Maze, toPx: (p: Point) => Point, scale: number, r: number, f: number, overlap = 0): void {
  g.beginPath();
  const at = (node: Point, a: Point, b: Point, ka: number, kb: number): Point => toPx({ x: node.x + ka * a.x + kb * b.x, y: node.y + ka * a.y + kb * b.y });
  for (const { node, a, b } of innerCorners(maze)) {
    const e = r - overlap;
    const start = at(node, a, b, e, e);
    const q1 = at(node, a, b, r + f, e);
    const p1 = at(node, a, b, r + f, r);
    const q2 = at(node, a, b, e, r + f);
    const o = at(node, a, b, r + f, r + f);
    const t1 = Math.atan2(-b.y, -b.x);
    const t2 = Math.atan2(-a.y, -a.x);
    const turn = Math.atan2(Math.sin(t2 - t1), Math.cos(t2 - t1));
    g.moveTo(start.x, start.y);
    g.lineTo(q1.x, q1.y);
    g.lineTo(p1.x, p1.y);
    g.arc(o.x, o.y, f * scale, t1, t2, turn < 0);
    g.lineTo(q2.x, q2.y);
    g.closePath();
  }
}

/** Three-toed dino footprint, pointing along `angle`. */
function footprint(g: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(angle + Math.PI / 2);
  g.beginPath();
  g.ellipse(0, size * 0.18, size * 0.28, size * 0.32, 0, 0, Math.PI * 2);
  g.fill();
  for (const [dx, rot] of [
    [-0.32, -0.45],
    [0, 0],
    [0.32, 0.45],
  ] as const) {
    g.save();
    g.translate(dx * size, -size * 0.22);
    g.rotate(rot);
    g.beginPath();
    g.ellipse(0, -size * 0.14, size * 0.1, size * 0.24, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.restore();
}

export function paintBoard(maze: Maze, images: BoardImages, pitchCss: number, dpr: number): PaintedBoard {
  const margin = 1.3; // logical room for shadow, stub and start pad
  const origin = { x: -FRAME_MARGIN - margin, y: -FRAME_MARGIN - margin };
  const size = { w: maze.width + 2 * (FRAME_MARGIN + margin), h: maze.height + 2 * (FRAME_MARGIN + margin) };
  let scale = pitchCss * Math.min(2, Math.max(1, dpr));
  scale = Math.min(scale, MAX_TEXTURE / size.w, MAX_TEXTURE / size.h);
  const W = Math.round(size.w * scale);
  const H = Math.round(size.h * scale);
  const toPx = (p: Point): Point => ({ x: (p.x - origin.x) * scale, y: (p.y - origin.y) * scale });
  const u = (v: number): number => v * scale;
  const rng = createRng(`${maze.seed}|${maze.layoutHash}`, 'decor');

  const frame = { x: u(margin), y: u(margin), w: u(maze.width + 2 * FRAME_MARGIN), h: u(maze.height + 2 * FRAME_MARGIN) };
  const corridorWidth = u(2 * CORRIDOR_RADIUS);
  const center = toPx(maze.goal.center);

  // --- Hedge layer: continuous wall fill + foliage, corridors cut out exactly.
  const hedge = makeCanvas(W, H);
  const hg = ctx2d(hedge);
  roundRectPath(hg, frame.x, frame.y, frame.w, frame.h, u(0.42));
  const base = hg.createLinearGradient(frame.x, frame.y, frame.x + frame.w, frame.y + frame.h);
  base.addColorStop(0, '#3f8a2e');
  base.addColorStop(1, '#2c6a26');
  hg.fillStyle = base;
  hg.fill();
  hg.save();
  roundRectPath(hg, frame.x, frame.y, frame.w, frame.h, u(0.42));
  hg.clip();
  const step = 0.36;
  const stamps: Array<[BoardImages[keyof BoardImages], number]> = [
    [images.hedgeA, 0.5],
    [images.hedgeB, 0.5],
  ];
  for (let y = -FRAME_MARGIN - 0.2; y < maze.height + FRAME_MARGIN + 0.2; y += step) {
    for (let x = -FRAME_MARGIN - 0.2; x < maze.width + FRAME_MARGIN + 0.2; x += step) {
      const pick = rng.chance(stamps[0]![1]) ? stamps[0]![0] : stamps[1]![0];
      const s = u(rng.range(0.52, 0.72));
      const p = toPx({ x: x + rng.range(-0.12, 0.12), y: y + rng.range(-0.12, 0.12) });
      hg.save();
      hg.translate(p.x, p.y);
      hg.rotate(rng.range(0, Math.PI * 2));
      hg.globalAlpha = rng.range(0.85, 1);
      hg.drawImage(pick, -s / 2, -s / 2, s, s);
      hg.restore();
    }
  }
  // Flowers and rocks on hedge lattice points (the thickest hedge spots).
  for (let gy = 0; gy <= maze.height; gy++) {
    for (let gx = 0; gx <= maze.width; gx++) {
      const roll = rng.next();
      if (roll > 0.16) continue;
      const img = roll < 0.11 ? images.flowers : images.rocks;
      const s = u(img === images.rocks ? rng.range(0.26, 0.34) : rng.range(0.3, 0.4));
      const p = toPx({ x: gx + rng.range(-0.05, 0.05), y: gy + rng.range(-0.05, 0.05) });
      hg.save();
      hg.translate(p.x, p.y);
      hg.rotate(rng.range(-0.6, 0.6));
      hg.drawImage(img, -s / 2, -s / 2, s, (s * img.height) / img.width);
      hg.restore();
    }
  }
  // Soft top-left light across the hedge mass.
  const light = hg.createLinearGradient(frame.x, frame.y, frame.x + frame.w, frame.y + frame.h);
  light.addColorStop(0, 'rgba(255,240,180,0.16)');
  light.addColorStop(0.55, 'rgba(255,240,180,0)');
  light.addColorStop(1, 'rgba(10,40,10,0.18)');
  hg.fillStyle = light;
  hg.fillRect(frame.x, frame.y, frame.w, frame.h);
  hg.restore();
  // Dark rim to define corridor edges, then cut corridors out exactly.
  hg.lineCap = 'round';
  hg.lineJoin = 'round';
  hg.strokeStyle = 'rgba(22, 52, 18, 0.55)';
  hg.lineWidth = corridorWidth + u(0.07);
  corridorPath(hg, maze, toPx);
  hg.stroke();
  // Rounded hedge corners (the rim follows the same rounding, 0.035 wider).
  hg.fillStyle = 'rgba(22, 52, 18, 0.55)';
  filletPath(hg, maze, toPx, scale, CORRIDOR_RADIUS + 0.035, WALL_ROUNDING - 0.035);
  hg.fill();
  hg.beginPath();
  hg.arc(center.x, center.y, u(CLEARING_RADIUS + 0.035), 0, Math.PI * 2);
  hg.fillStyle = 'rgba(22, 52, 18, 0.55)';
  hg.fill();
  hg.globalCompositeOperation = 'destination-out';
  hg.strokeStyle = '#000';
  hg.lineWidth = corridorWidth;
  corridorPath(hg, maze, toPx);
  hg.stroke();
  hg.fillStyle = '#000';
  filletPath(hg, maze, toPx, scale, CORRIDOR_RADIUS, WALL_ROUNDING, 0.04);
  hg.fill();
  hg.beginPath();
  hg.arc(center.x, center.y, u(CLEARING_RADIUS), 0, Math.PI * 2);
  hg.fill();
  hg.globalCompositeOperation = 'source-over';

  // --- Main canvas
  const out = makeCanvas(W, H);
  const g = ctx2d(out);

  // Ground drop shadow under the whole hedge block.
  g.save();
  g.shadowColor = 'rgba(30, 50, 10, 0.45)';
  g.shadowBlur = u(0.3);
  g.shadowOffsetX = u(0.06);
  g.shadowOffsetY = u(0.12);
  roundRectPath(g, frame.x, frame.y, frame.w, frame.h, u(0.42));
  g.fillStyle = '#d8b46a';
  g.fill();
  g.restore();

  // Sand: ground plate scaled over the frame, plus the entrance stub outside it.
  const groundScale = Math.max(frame.w / images.ground.width, frame.h / images.ground.height);
  g.save();
  roundRectPath(g, frame.x, frame.y, frame.w, frame.h, u(0.42));
  g.clip();
  g.drawImage(images.ground, frame.x, frame.y, images.ground.width * groundScale, images.ground.height * groundScale);
  // Lighten paths slightly toward cream for calm, readable corridors.
  g.fillStyle = 'rgba(255, 246, 214, 0.22)';
  g.fillRect(frame.x, frame.y, frame.w, frame.h);
  g.restore();
  const stubA = toPx(maze.entrance.outside);
  const stubB = toPx(nodePos(maze, maze.entrance.insideCell));
  const pattern = g.createPattern(images.ground as CanvasImageSource, 'repeat');
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = pattern ?? '#e8c77e';
  g.lineWidth = corridorWidth;
  g.beginPath();
  g.moveTo(stubA.x, stubA.y);
  g.lineTo(stubB.x, stubB.y);
  g.stroke();
  g.strokeStyle = 'rgba(255, 246, 214, 0.22)';
  g.stroke();
  g.restore();

  // Hedges cast a soft shadow down-right onto the sand (light from upper left).
  g.save();
  g.shadowColor = 'rgba(28, 60, 16, 0.42)';
  g.shadowBlur = u(0.12);
  g.shadowOffsetX = W + u(0.05);
  g.shadowOffsetY = u(0.08);
  g.drawImage(hedge, -W, 0);
  g.restore();

  // Clearing: warm glow and a ring of pebbles around the treasure spot.
  const glow = g.createRadialGradient(center.x, center.y, 0, center.x, center.y, u(CLEARING_RADIUS));
  glow.addColorStop(0, 'rgba(255, 236, 160, 0.75)');
  glow.addColorStop(0.7, 'rgba(255, 226, 140, 0.25)');
  glow.addColorStop(1, 'rgba(255, 226, 140, 0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(center.x, center.y, u(CLEARING_RADIUS), 0, Math.PI * 2);
  g.fill();
  const pebbles = 16;
  for (let i = 0; i < pebbles; i++) {
    const a = (i / pebbles) * Math.PI * 2 + rng.range(-0.08, 0.08);
    const r = u(CLEARING_RADIUS - 0.05);
    const px = center.x + Math.cos(a) * r;
    const py = center.y + Math.sin(a) * r;
    // Leave the opening toward the single entry corridor clear of pebbles.
    const entry = maze.cells[maze.goal.cellId]?.neighbors[0];
    if (entry !== undefined) {
      const e = toPx(nodePos(maze, entry));
      const ea = Math.atan2(e.y - center.y, e.x - center.x);
      const diff = Math.atan2(Math.sin(a - ea), Math.cos(a - ea));
      if (Math.abs(diff) < 0.75) continue;
    }
    g.fillStyle = `rgba(${150 + rng.int(30)}, ${140 + rng.int(25)}, ${120 + rng.int(25)}, 0.95)`;
    g.beginPath();
    g.ellipse(px, py, u(0.035), u(0.026), a, 0, Math.PI * 2);
    g.fill();
  }

  // Hedges on top.
  g.drawImage(hedge, 0, 0);

  // Entrance: dino footprints walking in from the start pad.
  const dir = Math.atan2(stubB.y - stubA.y, stubB.x - stubA.x);
  g.fillStyle = 'rgba(150, 105, 50, 0.38)';
  const nx = -Math.sin(dir);
  const ny = Math.cos(dir);
  for (let i = 0; i < 3; i++) {
    const t = 0.16 + i * 0.22;
    const side = i % 2 === 0 ? 1 : -1;
    const fx = stubA.x + (stubB.x - stubA.x) * t + nx * side * u(0.08);
    const fy = stubA.y + (stubB.y - stubA.y) * t + ny * side * u(0.08);
    footprint(g, fx, fy, u(0.17), dir);
  }

  return { canvas: out, origin, scale, size };
}
