/**
 * Painted things drawn from their parts (art/CLAUDE_HANDOFF_TREASURES.md,
 * art/CLAUDE_HANDOFF_MOTION.md), so petals, wings, glints, caps and leaves
 * move on their own.
 *
 * Each rig follows a stand-in: the thing's still image, which the scene keeps
 * and animates exactly as before (bobbing, reveal, fades, the celebration
 * pop, the flight to the collection, a butterfly's path and wing beats, a
 * plant's sway in the wind), but which the camera no longer draws. Every
 * frame the rig copies the stand-in's place, scale, alpha and visibility and
 * poses its parts:
 *
 *   treasure: parts move by rigMotion.ts (a pure function of time);
 *   flier:    the butterfly; the stand-in's narrowed width becomes wings
 *             narrowing toward the body (never below 20 %, never mirrored),
 *             and a perched stand-in shows the folded side pose (short fade);
 *   plant:    the stand-in's wind angle is shared out: the base sways less,
 *             the back leaves follow a beat later and the front leaves later
 *             still, at most ±6° against the base (Codex's tested range).
 *
 * Reduced motion keeps the still images: no rigs are created.
 */
import Phaser from 'phaser';
import type { TreasureId } from '../domain/types';
import { CELEBRATION_S, GLOW_PARTS, PARENTS, poseOf } from './rigMotion';
import { PLANT_LAYERS, PLANT_MAX_RELATIVE, RIG_ATLAS_KEY, type RigAsset, type RigKind, type RigPartAsset } from './rigData';

export { RIG_ATLAS_KEY, type RigAsset, type RigKind } from './rigData';

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
  /** Lagged wind angle (plants). */
  lagged: number;
}

export class PartRig {
  readonly container: Phaser.GameObjects.Container;
  private readonly id: string;
  private readonly kind: RigKind;
  private readonly parts: LivePart[] = [];
  private readonly byName = new Map<string, LivePart>();
  private readonly perched: Phaser.GameObjects.Image | null = null;
  private readonly canvasH: number;
  private readonly t0: number;
  private celebratedAt: number | null = null;
  private perchedNow = false;
  private perchSwitch = -Infinity;
  private last: number;

  constructor(scene: Phaser.Scene, id: string, asset: RigAsset, depth: number, kind: RigKind = 'treasure') {
    this.id = id;
    this.kind = kind;
    this.t0 = scene.time.now;
    this.last = this.t0;
    this.canvasH = asset.canvas[1];
    this.container = scene.add.container(0, 0).setDepth(depth);
    const [cw, ch] = asset.canvas;
    const [ox, oy] = asset.origin;
    const glows = new Set(GLOW_PARTS[id as TreasureId] ?? []);
    const parents = PARENTS[id as TreasureId] ?? {};
    for (const p of asset.parts) {
      const [px, py] = p.pivot;
      const make = (): Phaser.GameObjects.Image => scene.add.image(px - ox, py - oy, RIG_ATLAS_KEY, p.frame).setOrigin(px / cw, py / ch);
      const img = make().setAlpha(p.restVisible === false ? 0 : p.opacity);
      this.container.add(img);
      let light: Phaser.GameObjects.Image | null = null;
      if (glows.has(p.name)) {
        light = make().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.container.add(light);
      }
      const live: LivePart = { asset: p, img, light, x: px - ox, y: py - oy, parent: parents[p.name] ?? null, lagged: 0 };
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
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!c.visible) return;
    c.setAlpha(stand.alpha);
    if (this.kind === 'plant') this.syncPlant(stand, now, dt);
    else {
      c.setPosition(stand.x, stand.y).setRotation(stand.rotation);
      if (this.kind === 'flier') this.syncFlier(stand, now);
      else this.syncTreasure(stand, now);
    }
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

  /**
   * A plant stand-in has its origin at the bottom centre and its angle set by
   * the shared wind (ambient.ts) around a resting `baseAngle`. The rig sits on
   * the same spot without turning as a whole and shares the wind out.
   */
  private syncPlant(stand: Phaser.GameObjects.Image, now: number, dt: number): void {
    const flip = stand.flipX ? -1 : 1;
    const s = stand.scaleY;
    // The rig's origin is the still's centre; the stand-in's is its bottom centre.
    this.container
      .setPosition(stand.x + (0.5 - stand.originX) * stand.displayWidth * flip, stand.y + (0.5 - stand.originY) * stand.displayHeight)
      .setRotation(0)
      .setScale(flip * Math.abs(stand.scaleX), s);
    const rest = (stand.getData('baseAngle') as number | undefined) ?? 0;
    // Angles inside a mirrored container turn the other way.
    const wind = (stand.angle - rest) * flip;
    const restLocal = rest * flip;
    const t = (now - this.t0) / 1000;
    const base = this.byName.get('base');
    const baseAngle = restLocal + PLANT_LAYERS.base!.share * wind;
    for (const p of this.parts) {
      const layer = PLANT_LAYERS[p.asset.name];
      if (!layer) continue;
      // Follow-through: each layer eases toward its share of the wind.
      const target = layer.share * wind;
      p.lagged = layer.lag > 0 ? p.lagged + (target - p.lagged) * (1 - Math.exp(-dt / layer.lag)) : target;
      const flutter = layer.flutter * Math.sin(t * 2.3 + (p === base ? 0 : p.asset.name.length));
      const own = restLocal + p.lagged + flutter;
      const angle = p === base ? baseAngle : baseAngle + Phaser.Math.Clamp(own - baseAngle, -PLANT_MAX_RELATIVE, PLANT_MAX_RELATIVE);
      p.img.setAngle(angle);
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}

/**
 * The rigs that follow other stand-ins (butterflies, plants, the flying
 * treasure). Each lives as long as its stand-in; the camera stops drawing the
 * stand-in while its rig exists.
 */
export class RigFollowers {
  private readonly scene: Phaser.Scene;
  private readonly rigFor: (id: string) => RigAsset | null;
  private list: Array<{ stand: Phaser.GameObjects.Image; rig: PartRig }> = [];

  constructor(scene: Phaser.Scene, rigFor: (id: string) => RigAsset | null) {
    this.scene = scene;
    this.rigFor = rigFor;
  }

  get size(): number {
    return this.list.length;
  }

  has(stand: Phaser.GameObjects.Image): boolean {
    return this.list.some((f) => f.stand === stand);
  }

  /** Draw `stand` from its parts (when they exist and the atlas is loaded). */
  follow(stand: Phaser.GameObjects.Image, id: string, kind: RigKind): void {
    const asset = this.rigFor(id);
    if (!asset || !this.scene.textures.exists(RIG_ATLAS_KEY) || this.has(stand)) return;
    const rig = new PartRig(this.scene, id, asset, stand.depth, kind);
    this.scene.cameras.main.ignore(stand);
    rig.sync(stand, this.scene.time.now);
    this.list.push({ stand, rig });
  }

  /** Back to stills (reduced motion switched on): stand-ins are drawn again. */
  release(): void {
    for (const { stand, rig } of this.list) {
      rig.destroy();
      if (stand.active) stand.cameraFilter = 0;
    }
    this.list = [];
  }

  sync(now: number): void {
    this.list = this.list.filter(({ stand, rig }) => {
      if (stand.active) {
        rig.sync(stand, now);
        return true;
      }
      rig.destroy();
      return false;
    });
  }
}
