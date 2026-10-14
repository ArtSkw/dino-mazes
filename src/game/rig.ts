/**
 * Painted things drawn from their parts (art/CLAUDE_HANDOFF_TREASURES.md,
 * art/CLAUDE_HANDOFF_MOTION.md), so petals, wings, glints and caps move on
 * their own.
 *
 * Each rig follows a stand-in: the thing's still image, which the scene keeps
 * and animates exactly as before (bobbing, reveal, fades, the celebration
 * pop, the flight to the collection, a butterfly's path and wing beats), but
 * which the camera no longer draws. Every frame the rig copies the stand-in's
 * place, angle, scale, alpha and visibility and poses its parts:
 *
 *   treasure: parts move by rigMotion.ts (a pure function of time);
 *   flier:    the butterfly; the stand-in's narrowed width becomes wings
 *             narrowing toward the body (never below 20 %, never mirrored),
 *             and a perched stand-in shows the folded side pose (short fade).
 *
 * Reduced motion keeps the still images: the scene does not create rigs.
 */
import Phaser from 'phaser';
import type { TreasureId } from '../domain/types';
import { CELEBRATION_S, GLOW_PARTS, PARENTS, poseOf } from './rigMotion';

export interface RigPartAsset {
  name: string;
  /** Frame in the parts atlas (a trimmed frame of the full canvas). */
  frame: string;
  /** Pivot in canvas pixels. */
  pivot: [number, number];
  opacity: number;
}

export interface RigAsset {
  /** Canvas size in the still image's pixels. */
  canvas: [number, number];
  /** Centre of the still image inside the canvas: the rig's origin. */
  origin: [number, number];
  size: [number, number];
  /** Draw order, back to front. */
  parts: RigPartAsset[];
  /** Extra whole poses on the same canvas (the perched butterfly). */
  poses?: Record<string, string>;
}

export const RIG_ATLAS_KEY = 'rig-parts';
const WING = /^wing-/;
const PERCH_FADE_MS = 150;

interface LivePart {
  asset: RigPartAsset;
  img: Phaser.GameObjects.Image;
  /** Additive copy for light (only parts that glow). */
  light: Phaser.GameObjects.Image | null;
  x: number;
  y: number;
  parent: string | null;
}

export class PartRig {
  readonly container: Phaser.GameObjects.Container;
  private readonly id: string;
  private readonly kind: 'treasure' | 'flier';
  private readonly parts: LivePart[] = [];
  private readonly byName = new Map<string, LivePart>();
  private readonly perched: Phaser.GameObjects.Image | null = null;
  private readonly canvasH: number;
  private readonly t0: number;
  private celebratedAt: number | null = null;
  private perchedNow = false;
  private perchSwitch = -Infinity;

  constructor(scene: Phaser.Scene, id: string, asset: RigAsset, depth: number, kind: 'treasure' | 'flier' = 'treasure') {
    this.id = id;
    this.kind = kind;
    this.t0 = scene.time.now;
    this.canvasH = asset.canvas[1];
    this.container = scene.add.container(0, 0).setDepth(depth);
    const [cw, ch] = asset.canvas;
    const [ox, oy] = asset.origin;
    const glows = new Set(GLOW_PARTS[id as TreasureId] ?? []);
    const parents = PARENTS[id as TreasureId] ?? {};
    for (const p of asset.parts) {
      const [px, py] = p.pivot;
      const make = (): Phaser.GameObjects.Image => scene.add.image(px - ox, py - oy, RIG_ATLAS_KEY, p.frame).setOrigin(px / cw, py / ch);
      const img = make().setAlpha(p.opacity);
      this.container.add(img);
      let light: Phaser.GameObjects.Image | null = null;
      if (glows.has(p.name)) {
        light = make().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.container.add(light);
      }
      const live: LivePart = { asset: p, img, light, x: px - ox, y: py - oy, parent: parents[p.name] ?? null };
      this.parts.push(live);
      this.byName.set(p.name, live);
    }
    const perchedFrame = asset.poses?.['perched'];
    if (perchedFrame) {
      // A whole image on the same canvas: placed at the canvas centre.
      this.perched = scene.add.image(cw / 2 - ox, ch / 2 - oy, RIG_ATLAS_KEY, perchedFrame).setAlpha(0);
      this.container.add(this.perched);
    }
  }

  /** Start the treasure's own celebration (its parts' choreography). */
  celebrate(now: number): void {
    this.celebratedAt = now;
  }

  /** Follow the stand-in still and pose the parts. */
  sync(stand: Phaser.GameObjects.Image, now: number): void {
    const c = this.container;
    c.setVisible(stand.active && stand.visible && stand.alpha > 0.001);
    if (!c.visible) return;
    c.setPosition(stand.x, stand.y).setRotation(stand.rotation).setAlpha(stand.alpha);
    if (this.kind === 'flier') this.syncFlier(stand, now);
    else this.syncTreasure(stand, now);
  }

  private syncTreasure(stand: Phaser.GameObjects.Image, now: number): void {
    this.container.setScale(stand.scaleX, stand.scaleY);
    const t = (now - this.t0) / 1000;
    const since = this.celebratedAt === null ? null : (now - this.celebratedAt) / 1000;
    // The celebration choreography fades back into the idle motion.
    const cel = since !== null && since < CELEBRATION_S ? since : null;
    const id = this.id as TreasureId;
    for (const p of this.parts) {
      const pose = poseOf(id, p.asset.name, t, cel);
      let x = p.x + pose.dx * this.canvasH;
      let y = p.y + pose.dy * this.canvasH;
      let angle = pose.angle;
      let sx = pose.scale;
      let sy = pose.scale * pose.sy;
      const parent = p.parent ? this.byName.get(p.parent) : undefined;
      if (parent) {
        // Ride on the parent: its pose carries this part's pivot around its own.
        const pp = poseOf(id, parent.asset.name, t, cel);
        const psx = pp.scale;
        const psy = pp.scale * pp.sy;
        const rx = (p.x - parent.x) * psx;
        const ry = (p.y - parent.y) * psy;
        const a = Phaser.Math.DegToRad(pp.angle);
        x = parent.x + pp.dx * this.canvasH + rx * Math.cos(a) - ry * Math.sin(a) + pose.dx * this.canvasH;
        y = parent.y + pp.dy * this.canvasH + rx * Math.sin(a) + ry * Math.cos(a) + pose.dy * this.canvasH;
        angle += pp.angle;
        sx *= psx;
        sy *= psy;
      }
      p.img.setPosition(x, y).setAngle(angle).setScale(sx, sy).setAlpha(Phaser.Math.Clamp(p.asset.opacity * pose.alpha, 0, 1));
      p.light?.setPosition(x, y).setAngle(angle).setScale(sx, sy).setAlpha(Phaser.Math.Clamp(pose.glow, 0, 1));
    }
  }

  private syncFlier(stand: Phaser.GameObjects.Image, now: number): void {
    const sy = stand.scaleY;
    this.container.setScale(stand.flipX ? -sy : sy, sy);
    // The stand-in's beat narrows its width: the wings narrow toward the body.
    const open = Phaser.Math.Clamp(Math.abs(stand.scaleX) / Math.max(1e-6, sy), 0.2, 1);
    const perched = !!stand.getData('perched') && !!this.perched;
    if (perched !== this.perchedNow) {
      this.perchedNow = perched;
      this.perchSwitch = now;
    }
    const k = Phaser.Math.Clamp((now - this.perchSwitch) / PERCH_FADE_MS, 0, 1);
    const pw = perched ? k : 1 - k;
    for (const p of this.parts) {
      p.img.setScale(WING.test(p.asset.name) ? open : 1, 1).setAlpha(p.asset.opacity * (1 - pw));
    }
    this.perched?.setAlpha(pw);
  }

  destroy(): void {
    this.container.destroy();
  }
}
