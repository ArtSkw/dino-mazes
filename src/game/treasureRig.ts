/**
 * Living treasures (art/CLAUDE_HANDOFF_TREASURES.md): a treasure drawn from
 * its painted parts, so petals, vanes, glints and the leaf in the amber can
 * move on their own.
 *
 * The scene keeps the treasure's still image as an invisible stand-in that
 * every existing motion animates (bobbing, the reveal, fades, the celebration
 * pop, the flight to the collection). Each frame the rig copies the
 * stand-in's transform and adds its parts' motion (rigMotion.ts). Reduced
 * motion keeps the still image instead of a rig.
 */
import Phaser from 'phaser';
import type { TreasureId } from '../domain/types';
import { CELEBRATION_S, poseOf } from './rigMotion';

export interface RigPartAsset {
  name: string;
  /** Frame in the parts atlas (a trimmed frame of the full canvas). */
  frame: string;
  /** Pivot in canvas pixels. */
  pivot: [number, number];
  opacity: number;
}

export interface TreasureRigAsset {
  atlas: string;
  /** Canvas size in the still image's pixels. */
  canvas: [number, number];
  /** Centre of the still image inside the canvas: the rig's origin. */
  origin: [number, number];
  size: [number, number];
  /** Draw order, back to front. */
  parts: RigPartAsset[];
}

export const RIG_ATLAS_KEY = 'tr-parts';

interface LivePart {
  asset: RigPartAsset;
  img: Phaser.GameObjects.Image;
  /** Additive copy for light (only parts that glow). */
  light: Phaser.GameObjects.Image | null;
  x: number;
  y: number;
}

export class TreasureRig {
  readonly container: Phaser.GameObjects.Container;
  private readonly id: TreasureId;
  private readonly parts: LivePart[] = [];
  private readonly t0: number;
  private celebratedAt: number | null = null;

  constructor(scene: Phaser.Scene, id: TreasureId, asset: TreasureRigAsset, depth: number) {
    this.id = id;
    this.t0 = scene.time.now;
    this.container = scene.add.container(0, 0).setDepth(depth);
    const [cw, ch] = asset.canvas;
    const [ox, oy] = asset.origin;
    const glows = new Set(['body', 'center', 'crystal-1', 'crystal-2', 'crystal-3']);
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
      this.parts.push({ asset: p, img, light, x: px - ox, y: py - oy });
    }
  }

  /** Start the treasure's own celebration (its parts' choreography). */
  celebrate(now: number): void {
    this.celebratedAt = now;
  }

  /** Follow the stand-in still (place, angle, scale, alpha, visibility) and pose the parts. */
  sync(stand: Phaser.GameObjects.Image, now: number): void {
    const c = this.container;
    c.setVisible(stand.visible && stand.alpha > 0.001);
    if (!c.visible) return;
    c.setPosition(stand.x, stand.y).setRotation(stand.rotation).setScale(stand.scaleX, stand.scaleY).setAlpha(stand.alpha);
    const t = (now - this.t0) / 1000;
    const since = this.celebratedAt === null ? null : (now - this.celebratedAt) / 1000;
    // The celebration choreography fades back into the idle motion.
    const cel = since !== null && since < CELEBRATION_S ? since : null;
    for (const p of this.parts) {
      const pose = poseOf(this.id, p.asset.name, t, cel);
      p.img
        .setPosition(p.x + pose.dx, p.y + pose.dy)
        .setAngle(pose.angle)
        .setScale(pose.scale)
        .setAlpha(Math.min(1, Math.max(0, p.asset.opacity * pose.alpha)));
      if (p.light) {
        p.light.setPosition(p.img.x, p.img.y).setAngle(pose.angle).setScale(pose.scale).setAlpha(Math.min(1, Math.max(0, pose.glow)));
      }
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
