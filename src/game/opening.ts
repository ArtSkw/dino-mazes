/**
 * The opening animation (art/INTRO_ANIMATION_PLAN.md, concept A), ending
 * exactly on the welcome screen:
 *
 *   full  (first launch of the day, ≈ 7.5 s) leaf curtains part, two giant
 *         footsteps (shake, dust, a sweeping shadow), Giganto peeks in from the
 *         left and then stands up in front, the four friends pop up from bushes
 *         one after another and hop to the front, the title sign drops on
 *         vines and "Graj" sprouts from a seedling;
 *   short (later launches, ≈ 2 s) curtains, friends rise, sign, sprout;
 *   fade  (reduced motion) the curtains simply fade away.
 *
 * Tap or key skips straight to the end. Phaser handles the scene pieces; the
 * curtains, sign and sprout are DOM (live, localized text) driven through
 * `ui.openingStep`. Textures used only here are released at the end.
 */
import Phaser from 'phaser';
import type { Sfx } from './audio';
import type { CharacterActor } from './actor';
import { ASSETS, assetUrl, baseHidden } from './assets';
import { popUp } from './motion';
import type { OpeningMode } from '../app/controller';
import { peekRest, popupSpots, type Rect } from '../platform/layout';

export type OpeningStep = 'curtains' | 'sign' | 'sprout' | 'finish';

export interface OpeningHost {
  scene: Phaser.Scene;
  vw(): number;
  vh(): number;
  /** Cast actors, left to right, already placed at their final positions. */
  cast(): CharacterActor[];
  castSlots(): Rect[];
  step(step: OpeningStep, ms: number): void;
  sfx(name: Sfx): void;
  sparkle(x: number, y: number, n: number): void;
  depth: { shadow: number; peek: number; popup: number; dust: number; shafts: number };
  done(): void;
}

const KEYS = { peek: 'intro-peek', popups: 'intro-popups', dust: 'intro-dust', shafts: 'intro-shafts', shadow: 'intro-shadow' } as const;

/** Queue the opening's Phaser textures in the boot preload (full mode only). */
export function preloadOpening(scene: Phaser.Scene, mode: OpeningMode | null): void {
  if (mode !== 'full') return;
  const atlas = (key: string, json: string): void => {
    scene.load.multiatlas(key, assetUrl(json), assetUrl(json.slice(0, json.lastIndexOf('/') + 1)));
  };
  atlas(KEYS.peek, ASSETS.intro.gigantoPeek.atlas);
  atlas(KEYS.popups, ASSETS.intro.popups.atlas);
  atlas(KEYS.dust, ASSETS.intro.dust.atlas);
  scene.load.image(KEYS.shafts, assetUrl(ASSETS.intro.lightShafts.image));
}

function shadowTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(256, 128, 10, 256, 128, 250);
  grad.addColorStop(0, 'rgba(20,40,10,0.9)');
  grad.addColorStop(0.6, 'rgba(20,40,10,0.45)');
  grad.addColorStop(1, 'rgba(20,40,10,0)');
  g.fillStyle = grad;
  g.setTransform(1, 0, 0, 0.5, 0, 64);
  g.beginPath();
  g.arc(256, 128, 250, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Order the friends pop up in (left to right after Giganto). */
const POPUP_ORDER = ['rocky', 'tiny', 'mazu', 'bill'] as const;

export class OpeningDirector {
  private host: OpeningHost;
  private mode: OpeningMode;
  private timers: Phaser.Time.TimerEvent[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private finished = false;

  constructor(host: OpeningHost, mode: OpeningMode) {
    this.host = host;
    this.mode = mode;
  }

  private get scene(): Phaser.Scene {
    return this.host.scene;
  }

  private at(ms: number, fn: () => void): void {
    this.timers.push(this.scene.time.delayedCall(ms, () => !this.finished && fn()));
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objects.push(o);
    return o;
  }

  start(): void {
    if (this.mode === 'fade') {
      this.host.step('curtains', 500);
      this.host.step('sign', 0);
      this.host.step('sprout', 0);
      this.at(560, () => this.finish());
      return;
    }
    // Friends wait below the screen edge, behind the foreground plants.
    for (const a of this.host.cast()) a.sprite.setY(a.sprite.y + a.sprite.displayHeight * 1.05);
    if (this.mode === 'short') this.short();
    else this.full();
  }

  private short(): void {
    this.at(80, () => this.host.step('curtains', 650));
    this.host.cast().forEach((a, i) => this.at(320 + i * 90, () => this.rise(a, i === 0)));
    this.at(780, () => this.host.step('sign', 560));
    this.at(1300, () => this.host.step('sprout', 420));
    this.at(1820, () => this.finish());
  }

  private full(): void {
    const vw = this.host.vw();
    const vh = this.host.vh();
    const cast = this.host.cast();
    const giganto = cast.find((a) => a.id === 'giganto');
    this.at(150, () => {
      this.host.step('curtains', 1000);
      this.host.sfx('curtains');
    });
    this.shafts();
    // Two giant footsteps and a shadow sweeping over the clearing.
    this.at(1150, () => this.giantShadow());
    for (const t of [1350, 1850]) {
      this.at(t, () => {
        this.scene.cameras.main.shake(200, 0.0045);
        this.host.sfx('bum');
        this.dust(vw * (t === 1350 ? 0.16 : 0.3), vh * 0.97, Math.min(vw, vh) * 0.32);
      });
    }
    this.at(2250, () => this.gigantoPeek());
    // Giganto steps in front: the third footstep.
    this.at(3950, () => {
      if (giganto) this.rise(giganto, true);
      this.scene.cameras.main.shake(220, 0.006);
      this.host.sfx('bum');
      this.dust(vw * 0.12, vh * 0.99, Math.min(vw, vh) * 0.36);
    });
    // The friends pop up from bushes, left to right, then hop to the front.
    POPUP_ORDER.forEach((id, i) => {
      const actor = cast.find((a) => a.id === id);
      if (actor) this.at(4300 + i * 430, () => this.popup(actor));
    });
    this.at(6050, () => {
      this.host.step('sign', 800);
      this.host.sfx('sign');
    });
    this.at(6850, () => this.host.step('sprout', 520));
    this.at(7500, () => this.finish());
  }

  /** Where a cast member rests: its slot, with the faded waist cut below the screen. */
  private restOf(actor: CharacterActor): { y: number; scale: number; slot: Rect } | null {
    const slot = this.host.castSlots()[this.host.cast().indexOf(actor)];
    if (!slot) return null;
    return { y: this.host.vh() + baseHidden(actor.id, slot.h), scale: slot.h / actor.frameHeight, slot };
  }

  /**
   * A friend rises from behind the foreground plants into its welcome place.
   * The friends are busts cut flat at the waist, so the bounce is a stretch
   * around the base (pinned below the screen edge), never a lift that would
   * show the cut. No wave here: loading every friend's wave atlas would push
   * GPU memory past the budget; idle frames are already in.
   */
  private rise(actor: CharacterActor, heavy: boolean): void {
    const rest = this.restOf(actor);
    if (!rest) return;
    this.scene.tweens.killTweensOf(actor.sprite);
    const p = popUp(this.scene, actor.sprite, {
      restY: rest.y,
      scale: rest.scale,
      ...(heavy ? { zeta: 0.58, freq: 1.7, amount: 0.42 } : { zeta: 0.5, freq: 2.1, amount: 0.5 }),
    });
    this.at(p.arrival * 0.7, () => {
      const head = { x: rest.slot.x + rest.slot.w * 0.5, y: rest.slot.y + rest.slot.h * 0.2 };
      this.host.sparkle(head.x, head.y, heavy ? 10 : 7);
      if (!heavy) this.host.sfx('pop');
      if (actor.id === 'rocky') this.host.sfx('toot');
    });
  }

  private shafts(): void {
    if (!this.scene.textures.exists(KEYS.shafts)) return;
    const vw = this.host.vw();
    const img = this.keep(this.scene.add.image(0, 0, KEYS.shafts).setOrigin(0, 0).setDepth(this.host.depth.shafts));
    img.setScale((vw * 0.95) / img.width).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: img, alpha: 0.24, duration: 1400, delay: 500, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: img, alpha: 0.14, duration: 2400, delay: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private giantShadow(): void {
    if (!this.scene.textures.exists(KEYS.shadow)) this.scene.textures.addCanvas(KEYS.shadow, shadowTexture());
    const vw = this.host.vw();
    const vh = this.host.vh();
    const img = this.keep(this.scene.add.image(-vw * 0.5, vh * 0.62, KEYS.shadow).setDepth(this.host.depth.shadow).setAlpha(0));
    img.setDisplaySize(vw * 0.9, vh * 0.34);
    this.scene.tweens.add({ targets: img, x: vw * 1.45, duration: 1700, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({ targets: img, alpha: 0.3, duration: 850, yoyo: true, ease: 'Sine.easeInOut' });
  }

  private dust(x: number, y: number, w: number): void {
    if (!this.scene.textures.exists(KEYS.dust)) return;
    const frames = ASSETS.intro.dust.frames;
    const s = this.keep(this.scene.add.sprite(x, y, KEYS.dust, frames[0]).setOrigin(0.5, 0.85).setDepth(this.host.depth.dust));
    s.setScale(w / s.width).setAlpha(0.95);
    frames.forEach((f, i) => this.at(i * 110, () => s.active && s.setFrame(f)));
    this.scene.tweens.add({ targets: s, alpha: 0, y: y - w * 0.08, duration: 520, delay: 200, ease: 'Sine.easeIn', onComplete: () => s.destroy() });
  }

  /**
   * Giganto leans in over the bottom-left plants (where he will stand up a
   * moment later): in, sniff, look, grin, blink, and back down. The cell is
   * cut straight on its left and bottom; those edges fade out (tools/art/v3.py)
   * and stay beyond the screen edges the whole time, sniffing bob included
   * (peekRest), so he seems to lean in from the jungle, not from a picture.
   */
  private gigantoPeek(): void {
    if (!this.scene.textures.exists(KEYS.peek)) return;
    const vh = this.host.vh();
    const peek = ASSETS.intro.gigantoPeek;
    const frames = peek.frames;
    const size = Math.min(vh * 0.46, 380);
    const lift = size * 0.02;
    const rest = peekRest(vh, size, peek.cut ?? { left: 0, bottom: 1, band: 0 }, lift);
    const s = this.keep(this.scene.add.sprite(0, rest.y, KEYS.peek, frames[0]).setOrigin(0, 1).setDepth(this.host.depth.peek));
    s.setScale(size / peek.frameSize).setX(rest.x - size * 0.6);
    this.scene.tweens.add({ targets: s, x: rest.x, duration: 420, ease: 'Sine.easeOut' });
    const beats: Array<[number, number]> = [[0, 0], [260, 1], [560, 2], [900, 3], [1180, 4], [1480, 5], [1600, 4]];
    for (const [t, f] of beats) this.at(t, () => s.active && s.setFrame(frames[f] as string));
    this.at(560, () => this.scene.tweens.add({ targets: s, y: rest.y - lift, duration: 140, yoyo: true, repeat: 1 }));
    this.at(1850, () => this.scene.tweens.add({ targets: s, y: vh + size * 1.05, duration: 380, ease: 'Sine.easeIn', onComplete: () => s.destroy() }));
  }

  /** A friend pops up from a bush in the clearing, shows off, ducks, and hops to the front. */
  private popup(actor: CharacterActor): void {
    if (!this.scene.textures.exists(KEYS.popups)) {
      this.rise(actor, false);
      return;
    }
    const order = POPUP_ORDER.indexOf(actor.id as (typeof POPUP_ORDER)[number]);
    const spot = popupSpots(this.host.vw(), this.host.vh(), POPUP_ORDER.length)[order];
    if (!spot) return;
    const cell = ASSETS.intro.popups.cellSize;
    const { x, y, size } = spot;
    const name = (i: number): string => `${actor.id}-${i}`;
    const s = this.keep(this.scene.add.sprite(x, y, KEYS.popups, name(0)).setOrigin(0.5, 0.92).setDepth(this.host.depth.popup));
    const scale = size / cell;
    s.setScale(scale * 0.6).setAlpha(0);
    this.scene.tweens.add({ targets: s, scale, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.host.sfx('pop');
    [1, 2, 3].forEach((f, i) => this.at(110 * (i + 1), () => s.active && s.setFrame(name(f))));
    this.at(330, () => {
      this.host.sparkle(x, y - size * 0.55, 6);
      if (actor.id === 'rocky') this.host.sfx('toot');
      this.scene.tweens.add({ targets: s, scaleY: scale * 1.05, scaleX: scale * 0.97, duration: 140, yoyo: true });
    });
    [2, 1, 0].forEach((f, i) => this.at(780 + i * 80, () => s.active && s.setFrame(name(f))));
    this.at(1020, () => {
      this.dust(x, y, size * 0.9);
      this.scene.tweens.add({ targets: s, scale: scale * 0.5, alpha: 0, duration: 200, ease: 'Sine.easeIn', onComplete: () => s.destroy() });
    });
    this.at(1080, () => this.rise(actor, false));
  }

  /** Jump to the end state immediately (tap, key or resize). */
  skip(): void {
    if (this.finished) return;
    for (const a of this.host.cast()) {
      this.scene.tweens.killTweensOf(a.sprite);
      const rest = this.restOf(a);
      if (rest) a.sprite.setY(rest.y).setScale(rest.scale);
    }
    this.host.step('curtains', 0);
    this.host.step('sign', 0);
    this.host.step('sprout', 0);
    this.finish();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    for (const t of this.timers) t.remove();
    this.timers = [];
    this.host.step('finish', 0);
    // Fade out what remains of the opening, then release its textures.
    const live = this.objects.filter((o) => o.active) as Phaser.GameObjects.Image[];
    for (const o of live) this.scene.tweens.killTweensOf(o);
    if (live.length) {
      this.scene.tweens.add({ targets: live, alpha: 0, duration: 400, onComplete: () => this.cleanup() });
    } else this.cleanup();
    this.host.done();
  }

  private cleanup(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    for (const key of Object.values(KEYS)) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
  }
}
