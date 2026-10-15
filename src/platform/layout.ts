/**
 * Responsive layout (PRD §8). Pure functions of the viewport so they can be unit
 * tested: grid fitting with a minimum corridor width, board placement, the
 * reserved companion corner and control positions.
 *
 * Priorities: treasure and maze first, friend second, controls third. Corridors
 * never shrink below MIN_CORRIDOR_PX to keep a nominal grid; a smaller grid is
 * chosen instead (and recorded as the effective profile).
 */
import { CORRIDOR_RADIUS, ENTRANCE_REACH, FRAME_MARGIN, entranceAxes, gridCandidates } from '../domain/maze';
import type { Difficulty, GridSpec, Side } from '../domain/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Corner = 'left' | 'right';
export type Orientation = 'landscape' | 'portrait';

export const MIN_CORRIDOR_PX = 48;
export const MIN_CONTROL_PX = 56;
const MAX_PITCH = 136;
/** Hedge frame plus a soft rim around the grid, per side (units). */
const SIDE_UNITS = FRAME_MARGIN + 0.16;
/** Entrance stub, start pad and marker room beyond the frame (units). */
const ENTRANCE_UNITS = ENTRANCE_REACH + 0.34;

export interface BoardTransform {
  /** CSS px per logical unit. */
  pitch: number;
  /** CSS px position of logical (0, 0). */
  ox: number;
  oy: number;
}

export interface Layout {
  vw: number;
  vh: number;
  orientation: Orientation;
  boardArea: Rect;
  transform: BoardTransform;
  /** Bounding box of the board including the hedge frame. */
  board: Rect;
  corridorPx: number;
  corner: Corner;
  character: Rect;
  /** Top-right anchored cluster of small controls (collection + settings). */
  cluster: { x: number; y: number; direction: 'column' | 'row'; size: number };
  /** Screen area the cluster occupies (for collision checks). */
  clusterRect: Rect;
  /** "Ekran startowy" button, shown with the cluster on maze screens only. */
  home: Rect;
  /** Painted (visible) part of the friend on screen. */
  friendVisible: Rect;
  /**
   * Free area next to the friend where its speech bubble may appear without
   * covering the board or any control.
   */
  speech: Rect & { side: 'above' | 'beside' };
  reset: Rect;
  /** The butterfly hint: top-left, mirroring the cluster's size and margins. */
  hint: Rect;
  next: Rect;
}

/**
 * Phones (owner request, 15 Oct 2026): the game is made for tablets, but on a
 * phone the round buttons grow, the board and the quest card sit in the
 * middle, the friend is a little smaller, and mazes stay simple (PHONE_LEVEL).
 */
export function isPhone(vw: number, vh: number): boolean {
  return Math.min(vw, vh) < 500;
}

export function orientationOf(vw: number, vh: number): Orientation {
  return vw / Math.max(1, vh) >= 1.12 ? 'landscape' : 'portrait';
}

function railWidth(vw: number): number {
  return Math.round(Math.min(230, Math.max(128, vw * 0.15)));
}

/** Height reserved at the top in portrait for the control row (collection + settings). */
export function portraitTopBar(vw: number, vh: number): number {
  const c = clusterSpec(vw, vh).rect;
  return c.y + c.h + 12;
}

export interface ClusterSpec {
  size: number;
  gap: number;
  direction: 'row' | 'column';
  /** Screen area of the whole cluster. */
  rect: Rect;
}

/**
 * The collection + settings buttons: identical size and the same top-right
 * place on every screen (welcome, intro, play, reward), so nothing jumps when
 * screens change. A row of two equal round buttons; a column only when the
 * landscape side rail is too narrow for the row (very small screens).
 */
export function clusterSpec(vw: number, vh: number): ClusterSpec {
  const size = controlSize(vw, vh);
  const gap = 10;
  const margin = 10;
  const rowW = 2 * size + gap;
  const landscape = orientationOf(vw, vh) === 'landscape';
  const direction = landscape && rowW + 2 * margin > railWidth(vw) ? 'column' : 'row';
  const w = direction === 'row' ? rowW : size;
  const h = direction === 'row' ? size : rowW;
  return { size, gap, direction, rect: { x: vw - margin - w, y: margin, w, h } };
}

/** Round control size: 56–68 CSS px depending on the viewport; 62 on phones, easier for small fingers. */
export function controlSize(vw: number, vh: number): number {
  if (isPhone(vw, vh)) return 62;
  return Math.max(MIN_CONTROL_PX, Math.min(68, Math.round(Math.min(vw, vh) * 0.075)));
}

export function boardAreaFor(vw: number, vh: number): Rect {
  const pad = 10;
  if (orientationOf(vw, vh) === 'landscape') {
    const rw = railWidth(vw);
    return { x: rw, y: pad, w: Math.max(100, vw - 2 * rw), h: Math.max(100, vh - 2 * pad) };
  }
  const top = Math.max(84, portraitTopBar(vw, vh));
  const bottom = Math.round(Math.min(220, Math.max(160, vh * 0.2)));
  return { x: pad, y: top, w: Math.max(100, vw - 2 * pad), h: Math.max(100, vh - top - bottom) };
}

/** Pitch that fits a grid; entrance room is reserved on the axes its entrance can use. */
export function pitchFor(grid: GridSpec, area: Rect): number {
  // Entrance room only on the axis the generator may open (entranceAxes).
  const axes = entranceAxes(grid);
  const uw = grid.cols + 2 * SIDE_UNITS + (axes.horizontal ? ENTRANCE_UNITS : 0);
  const uh = grid.rows + 2 * SIDE_UNITS + (axes.vertical ? ENTRANCE_UNITS : 0);
  return Math.min(area.w / uw, area.h / uh, MAX_PITCH);
}

export interface GridFit {
  grid: GridSpec;
  corridorPx: number;
  /** False when even the smallest grid is below the minimum corridor width. */
  meetsMinimum: boolean;
  nominal: GridSpec;
}

/**
 * In landscape the friend stands in the strip beside the board. A bigger grid
 * is only used if that strip stays at least this wide, so harder mazes never
 * shrink the friend (owner requests of 13 and 14 Oct 2026); otherwise the
 * difficulty comes from topology on a smaller grid.
 */
export function minFriendStrip(vh: number): number {
  return Math.min(250, vh * 0.28);
}

/** Width of the strip beside a board of this grid (bottom entrance, no lean). */
function friendStrip(grid: GridSpec, area: Rect): number {
  const pitch = pitchFor(grid, area);
  const bw = (grid.cols + 2 * SIDE_UNITS) * pitch;
  return area.x + Math.max(0, area.w - bw) / 2 + (SIDE_UNITS - FRAME_MARGIN) * pitch;
}

export function fitGrid(difficulty: Difficulty, vw: number, vh: number): GridFit {
  const area = boardAreaFor(vw, vh);
  const landscape = orientationOf(vw, vh) === 'landscape';
  const candidates = gridCandidates(difficulty, landscape);
  const nominal = candidates[0] as GridSpec;
  const smallestGrid = candidates[candidates.length - 1] as GridSpec;
  for (const grid of candidates) {
    const corridorPx = pitchFor(grid, area) * 2 * CORRIDOR_RADIUS;
    if (corridorPx < MIN_CORRIDOR_PX) continue;
    if (landscape && grid !== smallestGrid && friendStrip(grid, area) < minFriendStrip(vh)) continue;
    return { grid, corridorPx, meetsMinimum: true, nominal };
  }
  const smallest = candidates[candidates.length - 1] as GridSpec;
  return { grid: smallest, corridorPx: pitchFor(smallest, area) * 2 * CORRIDOR_RADIUS, meetsMinimum: false, nominal };
}

export interface LayoutInput {
  vw: number;
  vh: number;
  grid: GridSpec;
  entranceSide: Side;
  /** The hosting friend's sprite frame, so the layout knows its real size. */
  friend?: FriendFrame;
}

export interface FriendFrame {
  /** frameWidth / frameHeight. */
  aspect: number;
  /** Relative size: Giganto is drawn larger than the four friends. */
  size: number;
  /** Painted area as fractions of the frame (union of the non-celebration frames). */
  content: { x: number; y: number; w: number; h: number };
  /** Hug the left screen edge; up to `bleed` of the frame may sit off-screen. */
  flushLeft?: boolean;
  bleed?: number;
}

const DEFAULT_FRIEND: FriendFrame = { aspect: 0.9, size: 1, content: { x: 0.04, y: 0.03, w: 0.92, h: 0.96 } };

/** On-screen size of the friend relative to the four regular friends. */
export const FRIEND_SIZE: Record<string, number> = { giganto: 1.22 };

/**
 * The friend always stands in the lower-left corner and "Wróć" is always at the
 * lower right, on every maze (owner decision, 14 Oct 2026): a child learns where
 * the reset button is and it never moves between sessions. Every friend faces
 * right or straight ahead (FACING in game/assets.ts), so from the left it looks
 * at the maze. The generator never opens a maze on the left side, so the
 * entrance stays clear of the friend.
 */
export const FRIEND_CORNER: Corner = 'left';
/** How far the board leans away from the friend, as a share of the spare width. */
const LEAN = 0.3;

export function computeLayout(input: LayoutInput): Layout {
  const { vw, vh, grid } = input;
  const orientation = orientationOf(vw, vh);
  const area = boardAreaFor(vw, vh);
  const pitch = pitchFor(grid, area);
  const corner = FRIEND_CORNER;

  // Actual logical extents of this board (entrance room only on its side).
  const side = input.entranceSide;
  const xMin = -SIDE_UNITS - (side === 'left' ? ENTRANCE_UNITS : 0);
  const xMax = grid.cols + SIDE_UNITS + (side === 'right' ? ENTRANCE_UNITS : 0);
  const yMin = -SIDE_UNITS - (side === 'top' ? ENTRANCE_UNITS : 0);
  const yMax = grid.rows + SIDE_UNITS + (side === 'bottom' ? ENTRANCE_UNITS : 0);
  const bw = (xMax - xMin) * pitch;
  const bh = (yMax - yMin) * pitch;
  // In landscape the board leans a little away from the friend's corner when
  // there is spare width, so the friend can be drawn larger.
  const slack = Math.max(0, area.w - bw);
  const lean = orientation === 'landscape' ? slack * LEAN * (corner === 'left' ? 1 : -1) : 0;
  const bx = area.x + (area.w - bw) / 2 + lean;
  // Portrait: in the middle of the screen when the strips above and below allow
  // it (phones leave a tall gap under the board otherwise), else in its area.
  const inArea = area.y + (area.h - bh) / 2;
  const by = orientation === 'portrait' ? Math.min(Math.max((vh - bh) / 2, area.y), Math.max(area.y, area.y + area.h - bh)) : inArea;
  const transform: BoardTransform = { pitch, ox: bx - xMin * pitch, oy: by - yMin * pitch };
  const board: Rect = {
    x: transform.ox - FRAME_MARGIN * pitch,
    y: transform.oy - FRAME_MARGIN * pitch,
    w: (grid.cols + 2 * FRAME_MARGIN) * pitch,
    h: (grid.rows + 2 * FRAME_MARGIN) * pitch,
  };

  const control = controlSize(vw, vh);
  const gap = 10;
  const spec = clusterSpec(vw, vh);
  const cluster: Layout['cluster'] = { x: spec.rect.x + spec.rect.w, y: spec.rect.y, direction: spec.direction, size: spec.size };
  const clusterRect: Rect = spec.rect;
  const f = input.friend ?? DEFAULT_FRIEND;
  const boardRight = board.x + board.w;
  const boardBottom = board.y + board.h;

  // Home sits left of the cluster row; below it when that would touch the board.
  let home: Rect = spec.direction === 'row'
    ? { x: spec.rect.x - gap - spec.size, y: spec.rect.y, w: spec.size, h: spec.size }
    : { x: spec.rect.x, y: spec.rect.y + spec.rect.h + gap, w: spec.size, h: spec.size };
  if (overlapsRect(inflate(home, 8), board)) home = { x: spec.rect.x + spec.rect.w - spec.size, y: spec.rect.y + spec.rect.h + gap, w: spec.size, h: spec.size };
  const topControlsBottom = Math.max(clusterRect.y + clusterRect.h, home.y + home.h);

  // Butterfly: top-left corner, the mirror image of the cluster's first button.
  const hint: Rect = { x: spec.rect.y, y: spec.rect.y, w: spec.size, h: spec.size };
  const topLeftBottom = hint.y + hint.h;
  let character: Rect;
  let reset: Rect;
  let speech: Layout['speech'];

  if (orientation === 'landscape') {
    const rw = area.x;
    // The friend uses the spare width between the board and the screen edge.
    const stripX0 = corner === 'left' ? 0 : boardRight + 10;
    const stripX1 = corner === 'left' ? board.x - 10 : vw;
    const stripW = stripX1 - stripX0;
    const bleed = f.flushLeft && corner === 'left' ? (f.bleed ?? 0.12) : 0;
    let ch = Math.min(vh * 0.36 * f.size, 300 * f.size);
    let cw = ch * f.aspect;
    if (cw * (1 - bleed) > stripW - 4) {
      cw = (stripW - 4) / (1 - bleed);
      ch = cw / f.aspect;
    }
    const cx = bleed > 0 ? -cw * bleed : stripX0 + (stripW - cw) / 2;
    character = { x: cx, y: vh - ch, w: cw, h: ch };
    const resetW = rw - 2 * gap;
    const resetH = Math.max(88, Math.round(control * 1.55));
    reset = { x: corner === 'left' ? vw - rw + gap : gap, y: vh - resetH - 16, w: resetW, h: resetH };
    const vis = visibleOf(character, f);
    // Speech bubble: above the friend, inside its strip, below the corner buttons.
    const sTop = (corner === 'right' ? topControlsBottom : topLeftBottom) + 12;
    speech = { x: stripX0 + 8, y: sTop, w: Math.max(0, stripW - 16), h: Math.max(0, vis.y - sTop), side: 'above' };
  } else {
    const resetW = Math.min(220, vw * 0.3);
    const resetH = Math.max(80, control * 1.4);
    reset = { x: corner === 'left' ? vw - resetW - 16 : 16, y: vh - resetH - 16, w: resetW, h: resetH };
    // As large as the space under the board allows.
    let ch = Math.min(vh - boardBottom - 6, 240 * f.size);
    let cw = ch * f.aspect;
    const maxW = vw * 0.36;
    if (cw > maxW) {
      cw = maxW;
      ch = cw / f.aspect;
    }
    const bleed = f.flushLeft && corner === 'left' ? (f.bleed ?? 0.12) : 0;
    const cx = bleed > 0 ? -cw * bleed : corner === 'left' ? 8 : vw - cw - 8;
    character = { x: cx, y: vh - ch, w: cw, h: ch };
    const vis = visibleOf(character, f);
    const barTop = boardBottom + 8;
    const sx0 = corner === 'left' ? vis.x + vis.w + 8 : reset.x + reset.w + 12;
    const sx1 = corner === 'left' ? reset.x - 12 : vis.x - 8;
    speech = { x: sx0, y: barTop, w: Math.max(0, sx1 - sx0), h: Math.max(0, vh - barTop - 8), side: 'beside' };
  }

  // "Kolejna przygoda": fully centred on the screen.
  const nextW = Math.min(400, Math.max(300, board.w * 0.6), vw - 24);
  const nextH = 84;
  const next: Rect = { x: (vw - nextW) / 2, y: (vh - nextH) / 2, w: nextW, h: nextH };

  return {
    vw,
    vh,
    orientation,
    boardArea: area,
    transform,
    board,
    corridorPx: pitch * 2 * CORRIDOR_RADIUS,
    corner,
    character,
    cluster,
    clusterRect,
    home,
    friendVisible: visibleOf(character, f),
    speech,
    reset,
    hint,
    next,
  };
}

function inflate(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}

export function overlapsRect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Painted part of a friend whose frame occupies `frame` on screen (clipped to the screen bottom). */
export function visibleOf(frame: Rect, f: FriendFrame): Rect {
  const x = frame.x + frame.w * f.content.x;
  const y = frame.y + frame.h * f.content.y;
  return { x: Math.max(0, x), y, w: frame.w * f.content.w - Math.max(0, -x), h: frame.h * f.content.h };
}

export function toLogical(t: BoardTransform, clientX: number, clientY: number): { x: number; y: number } {
  return { x: (clientX - t.ox) / t.pitch, y: (clientY - t.oy) / t.pitch };
}

export function toScreen(t: BoardTransform, p: { x: number; y: number }): { x: number; y: number } {
  return { x: t.ox + p.x * t.pitch, y: t.oy + p.y * t.pitch };
}

/**
 * Quest intro composition. In landscape the friend and the quest card form one
 * group centred on the screen (friend left, card right) so the card does not
 * hug the right edge; in portrait the card sits above the friend.
 */
export function introLayout(vw: number, vh: number, friend: Pick<FriendFrame, 'aspect' | 'content'> = INTRO_DEFAULT): { character: Rect; card: Rect } {
  const { aspect, content } = friend;
  if (orientationOf(vw, vh) === 'landscape') {
    const ch = Math.min(vh * 0.66, 500);
    const cw = ch * aspect;
    // Lay out by the painted part of the friend, so a long snout or a waving
    // hand never reaches under the card.
    const visible = cw * content.w;
    const cardW = Math.min(520, vw * 0.44);
    const cardH = Math.min(vh - 48, 460);
    const gap = Math.round(Math.min(64, Math.max(28, vw * 0.035)));
    const total = visible + gap + cardW;
    const start = Math.max(12, (vw - total) / 2);
    return {
      character: { x: start - cw * content.x, y: vh - ch, w: cw, h: ch },
      card: { x: start + visible + gap, y: (vh - cardH) / 2 - vh * 0.02, w: cardW, h: cardH },
    };
  }
  // A phone gets a smaller friend, so the card can sit in the middle of the screen.
  const ch = Math.min(vh * (isPhone(vw, vh) ? 0.32 : 0.42), 440);
  const cw = ch * aspect;
  const w = Math.min(560, vw - 40);
  // Below the top-right control row, above the friend's head; centred on the screen when there is room.
  const top = portraitTopBar(vw, vh);
  const floor = vh - ch * 0.93 - 16;
  const h = Math.min(vh * 0.5, 470, floor - top);
  const y = Math.min(Math.max((vh - h) / 2 - vh * 0.04, top), Math.max(top, floor - h));
  const visibleCenter = cw * (content.x + content.w / 2);
  return { character: { x: vw / 2 - visibleCenter, y: vh - ch, w: cw, h: ch }, card: { x: (vw - w) / 2, y, w, h } };
}

const INTRO_DEFAULT = { aspect: 0.9, content: { x: 0.11, y: 0, w: 0.78, h: 1 } };

/** Large character pose on the quest intro screen: the exact frame rect, bottom-anchored. */
export function introCharacterRect(vw: number, vh: number, friend?: Pick<FriendFrame, 'aspect' | 'content'>): Rect {
  return introLayout(vw, vh, friend).character;
}

/** Quest card next to (landscape) or above (portrait) the intro character. */
export function introCardRect(vw: number, vh: number, friend?: Pick<FriendFrame, 'aspect' | 'content'>): Rect {
  return introLayout(vw, vh, friend).card;
}

/**
 * Welcome-screen cast along the bottom edge. Each friend gets a target height
 * (`scale` × a base height; Giganto a bit taller than the four friends, as in
 * the cartoon) and its frame's own aspect, so slots are exact sprite rects.
 * A `flushLeft` friend (Giganto: his sheet is cropped on the left) hugs the
 * left edge; the others follow with a small overlap and share any spare width.
 */
export function castSlots(vw: number, vh: number, items: Array<{ aspect: number; scale: number; flushLeft?: boolean }>): Rect[] {
  const portrait = orientationOf(vw, vh) === 'portrait';
  const base = Math.min(vh * (portrait ? 0.27 : 0.4), 340);
  let hs = items.map((it) => base * it.scale);
  let ws = hs.map((h, i) => h * (items[i] as { aspect: number }).aspect);
  const bleed = (i: number): number => (items[i]?.flushLeft ? (ws[i] as number) * 0.06 : 0);
  // Friends overlap by a quarter of the narrower frame (foliage hides the
  // seams); the flush-left giant keeps his snout clear of his neighbour.
  const overlap = (i: number): number => {
    if (i === 0) return 0;
    const k = items[i - 1]?.flushLeft ? 0.04 : portrait ? 0.36 : 0.26;
    return Math.min(ws[i - 1] as number, ws[i] as number) * k;
  };
  const span = (): number => ws.reduce((a, w, i) => a + w - overlap(i), 0) - bleed(0);
  if (span() > vw) {
    const k = vw / span();
    hs = hs.map((h) => h * k);
    ws = ws.map((w) => w * k);
  }
  const spare = Math.max(0, vw - span());
  const flush = !!items[0]?.flushLeft;
  // Spare width becomes equal gaps between friends (and a margin at the open ends).
  const gaps = flush ? items.length : items.length + 1;
  const g = spare / gaps;
  const out: Rect[] = [];
  let x = flush ? -bleed(0) : g;
  items.forEach((_, i) => {
    if (i > 0) x += g - overlap(i);
    const w = ws[i] as number;
    const h = hs[i] as number;
    out.push({ x, y: vh - h, w, h });
    x += w;
  });
  return out;
}

/** Where a painted cell is cut straight (fractions of the cell) and how wide its fade is. */
export interface CellCut {
  left: number;
  bottom: number;
  band: number;
}

/**
 * Resting place of the opening's Giganto peek (a `size` px cell, origin at its
 * bottom-left corner): its straight left and bottom cuts, and most of their
 * fade, stay beyond the screen's left and bottom edges, even at the top of
 * its `lift` (the little bob while it sniffs).
 */
export function peekRest(vh: number, size: number, cut: CellCut, lift: number): { x: number; y: number } {
  const hidden = 0.7 * cut.band;
  return { x: -(cut.left + hidden) * size, y: vh + (1 - cut.bottom + hidden) * size + lift };
}
