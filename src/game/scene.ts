/**
 * The single Phaser scene. It renders accepted state only; it never decides
 * gameplay. World coordinates are CSS pixels; the camera zooms by the device
 * pixel ratio so textures stay crisp.
 */
import Phaser from 'phaser';
import type { Controller, GameEvent, Reward } from '../app/controller';
import { TREASURES } from '../data/content';
import { nodePos } from '../domain/maze';
import type { Hint } from '../domain/trail';
import type { CharacterId, Point, TreasureId } from '../domain/types';
import { castSlots, introCharacterRect, toScreen, type Rect } from '../platform/layout';
import { CharacterActor, sheetKey } from './actor';
import { ASSETS, CAST_SCALE, assetUrl, handTexture, leafTexture, ringTexture, sparkTexture, starTexture } from './assets';
import { paintBoard } from './boardPainter';

export interface UiBridge {
  rectOf(name: 'collection' | 'reset' | 'hint'): DOMRect | null;
  pulse(name: 'collection' | 'reset'): void;
  setCastRects(rects: Array<{ id: CharacterId; rect: Rect }>): void;
  celebrationBanner(reward: Reward): void;
  /** The arriving butterfly has landed beside the friend: reveal the hint button. */
  hintLanded(): void;
  /** Screen rect of the corner companion's frame (null while it is not on the board). */
  setCompanionRect(rect: Rect | null): void;
}

const D = {
  bg: 0,
  ambient: 5,
  board: 10,
  trail: 20,
  treasureGlow: 24,
  treasure: 25,
  marker: 30,
  hand: 35,
  hint: 40,
  fx: 45,
  companion: 50,
  foreground: 55,
  fly: 60,
} as const;

const TRAIL = { outline: 0x8a4f12, core: 0xffc93c, highlight: 0xfff4c4, glow: 0xffe17a };
const CAST_ORDER: CharacterId[] = ['giganto', 'rocky', 'tiny', 'mazu', 'bill'];

export class GameScene extends Phaser.Scene {
  private ctrl: Controller;
  private ui: UiBridge;
  private dpr = 1;
  private shownScreen: string = 'loading';

  private bg!: Phaser.GameObjects.Image;
  private board: Phaser.GameObjects.Image | null = null;
  private boardKey: string | null = null;
  private boardSerial = 0;
  private repaintTimer: Phaser.Time.TimerEvent | null = null;
  private trailGfx!: Phaser.GameObjects.Graphics;
  private ghostGfx!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Graphics;
  private markerGlow!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Image;
  private treasure: Phaser.GameObjects.Image | null = null;
  private treasureGlow: Phaser.GameObjects.Image | null = null;
  private treasureFlown = false;
  private companion: CharacterActor | null = null;
  private companionPlants: Phaser.GameObjects.Image[] = [];
  private cast: CharacterActor[] = [];
  private castPlants: Phaser.GameObjects.Image[] = [];
  private hand!: Phaser.GameObjects.Image;
  private handTween: Phaser.Tweens.Tween | null = null;
  private hintFly: Phaser.GameObjects.Image | null = null;
  /** Pollen dots the hint butterfly leaves along the next two moves. */
  private hintDots!: Phaser.GameObjects.Graphics;
  private ambientFlies: Phaser.GameObjects.Image[] = [];
  private bursts: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private sparkle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private celebration: { timers: Phaser.Time.TimerEvent[]; flyer: Phaser.GameObjects.Image | null; done: boolean } | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(ctrl: Controller, ui: UiBridge) {
    super({ key: 'game' });
    this.ctrl = ctrl;
    this.ui = ui;
  }

  // ---------------------------------------------------------------------------
  // Loading

  preload(): void {
    this.load.on('loaderror', () => this.ctrl.failLoading());
    this.load.image('bg-jungle', assetUrl(ASSETS.backgrounds.jungle.image));
    this.load.image('ground', assetUrl(ASSETS.backgrounds.ground.image));
    for (const [name, item] of Object.entries(ASSETS.foliage)) this.load.image(`fol-${name}`, assetUrl(item.image));
    for (const [id, item] of Object.entries(ASSETS.treasures)) this.load.image(`tr-${id}`, assetUrl(item.image));
    for (const [id, c] of Object.entries(ASSETS.characters)) {
      this.load.spritesheet(sheetKey(id as CharacterId), assetUrl(c.image), {
        frameWidth: c.frameWidth,
        frameHeight: c.frameHeight,
        spacing: c.spacing,
      });
    }
  }

  create(): void {
    this.textures.addCanvas('spark', sparkTexture());
    this.textures.addCanvas('star', starTexture());
    this.textures.addCanvas('ring', ringTexture());
    this.textures.addCanvas('hand', handTexture());
    this.textures.addCanvas('leaf-a', leafTexture('#5fae3a'));
    this.textures.addCanvas('leaf-b', leafTexture('#8fcf4a'));
    this.textures.addCanvas('petal', leafTexture('#ff9a8a'));

    this.bg = this.add.image(0, 0, 'bg-jungle').setOrigin(0.5).setDepth(D.bg);
    this.trailGfx = this.add.graphics().setDepth(D.trail);
    this.ghostGfx = this.add.graphics().setDepth(D.hand - 1);
    this.hintDots = this.add.graphics().setDepth(D.trail + 1);
    this.markerGlow = this.add.image(0, 0, 'spark').setDepth(D.marker).setBlendMode(Phaser.BlendModes.ADD).setTint(TRAIL.glow).setVisible(false);
    this.marker = this.add.graphics().setDepth(D.marker + 1);
    this.ring = this.add.image(0, 0, 'ring').setDepth(D.marker).setTint(0xffe9a0).setVisible(false);
    this.hand = this.add.image(0, 0, 'hand').setOrigin(0.46, 0.04).setDepth(D.hand).setVisible(false);

    this.bursts = ['leaf-a', 'leaf-b', 'petal'].map((key) =>
      this.add
        .particles(0, 0, key, {
          speed: { min: 120, max: 320 },
          angle: { min: 0, max: 360 },
          rotate: { start: 0, end: 360 },
          lifespan: { min: 900, max: 1500 },
          scale: { start: 0.9, end: 0.4 },
          alpha: { start: 1, end: 0 },
          gravityY: 160,
          emitting: false,
        })
        .setDepth(D.fx),
    );
    this.sparkle = this.add.particles(0, 0, 'star', {
      speed: { min: 20, max: 90 },
      lifespan: { min: 500, max: 900 },
      scale: { start: 0.45, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      tint: 0xfff2b0,
      emitting: false,
    }).setDepth(D.fx + 1);

    this.cameras.main.setOrigin(0, 0);
    this.handleResize(true);
    this.createAmbient();
    this.unsubscribe = this.ctrl.on((e) => this.onEvent(e));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
    this.ctrl.ready();
  }

  // ---------------------------------------------------------------------------
  // Events from the controller

  private onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'state':
        this.applyScreen();
        this.companion?.setReduced(this.reduced);
        for (const a of this.cast) a.setReduced(this.reduced);
        this.updateHandDemo();
        break;
      case 'maze':
        this.buildMaze();
        break;
      case 'trail':
        this.drawTrail();
        break;
      case 'trail-reset':
        this.companion?.react('encouragement');
        this.ctrl.sfx('whoosh');
        this.clearHint();
        this.drawTrail();
        break;
      case 'drawing-start':
        this.companion?.react('drawing');
        break;
      case 'drawing-stop':
        this.drawMarker();
        break;
      case 'solved':
        this.celebrate(e.reward);
        break;
      case 'skip-celebration':
        this.finishCelebration(true);
        break;
      case 'hint':
        this.showHint(e.hint);
        break;
      case 'hint-ready':
        this.butterflyArrives();
        break;
      case 'talk':
        this.boop();
        this.companion?.react('encouragement', true);
        break;
      case 'wave': {
        const actor = this.cast.find((a) => a.id === e.characterId) ?? (this.companion?.id === e.characterId ? this.companion : null);
        actor?.react('encouragement', true);
        break;
      }
      case 'layout':
        this.handleResize(false);
        break;
      default:
        break;
    }
  }

  private get reduced(): boolean {
    return this.ctrl.state.reducedMotion;
  }

  private get vw(): number {
    return window.innerWidth;
  }

  private get vh(): number {
    return window.innerHeight;
  }

  // ---------------------------------------------------------------------------
  // Sizing

  private handleResize(initial: boolean): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.vw;
    const h = this.vh;
    if (dpr !== this.dpr || initial) {
      this.dpr = dpr;
      this.scale.setZoom(1 / dpr);
    }
    this.scale.resize(Math.round(w * dpr), Math.round(h * dpr));
    this.cameras.resize(Math.round(w * dpr), Math.round(h * dpr));
    this.cameras.main.setOrigin(0, 0).setZoom(dpr).setScroll(0, 0);
    const s = Math.max(w / this.bg.width, h / this.bg.height);
    this.bg.setPosition(w / 2, h / 2).setScale(s);
    if (initial) return;
    // A resize cancels flights cleanly; rewards are already saved.
    if (this.celebration && !this.celebration.done) this.finishCelebration(true);
    this.placeEverything();
    this.repaintTimer?.remove();
    this.repaintTimer = this.time.delayedCall(160, () => this.paintBoardTexture());
  }

  private placeEverything(): void {
    this.placeBoard();
    this.placeTreasure();
    this.placeCompanion(false);
    this.placeCast();
    this.drawTrail();
    this.updateHandDemo();
  }

  // ---------------------------------------------------------------------------
  // Maze objects

  private buildMaze(): void {
    const { maze, session } = this.ctrl.state;
    if (!maze || !session) return;
    this.clearHint();
    this.cancelCelebration();
    // Old objects drift away gently.
    const oldBoard = this.board;
    const oldKey = this.boardKey;
    if (oldBoard) {
      this.tweens.add({
        targets: oldBoard,
        alpha: 0,
        duration: this.reduced ? 120 : 320,
        onComplete: () => {
          oldBoard.destroy();
          if (oldKey && this.textures.exists(oldKey)) this.textures.remove(oldKey);
        },
      });
      this.board = null;
      this.boardKey = null;
    }
    this.treasure?.destroy();
    this.treasureGlow?.destroy();
    this.treasure = null;
    this.treasureGlow = null;
    this.treasureFlown = this.ctrl.state.screen === 'reward';

    const oldCompanion = this.companion;
    if (oldCompanion) {
      for (const p of this.companionPlants) p.destroy();
      this.companionPlants = [];
      this.tweens.killTweensOf(oldCompanion.sprite);
      this.tweens.add({
        targets: oldCompanion.sprite,
        y: this.vh + oldCompanion.sprite.displayHeight,
        alpha: 0,
        duration: this.reduced ? 120 : 380,
        ease: 'Sine.easeIn',
        onComplete: () => oldCompanion.destroy(),
      });
    }
    this.companion = new CharacterActor(this, session.characterId, this.reduced);
    this.companion.sprite.setDepth(D.companion);
    this.createCompanionPlants();

    this.paintBoardTexture();
    const tr = TREASURES[session.treasureId];
    this.treasureGlow = this.add.image(0, 0, 'spark').setDepth(D.treasureGlow).setBlendMode(Phaser.BlendModes.ADD).setTint(Phaser.Display.Color.HexStringToColor(tr.glow).color).setAlpha(0.75);
    this.treasure = this.add.image(0, 0, `tr-${session.treasureId}`).setDepth(D.treasure);
    this.placeTreasure();
    this.drawTrail();
    this.shownScreen = 'rebuilding';
    this.applyScreen();
  }

  private paintBoardTexture(): void {
    const { maze, layout } = this.ctrl.state;
    if (!maze || !layout) return;
    const tex = (k: string): HTMLImageElement => this.textures.get(k).getSourceImage() as HTMLImageElement;
    const painted = paintBoard(maze, {
      ground: tex('ground'),
      hedgeA: tex('fol-hedge-a'),
      hedgeB: tex('fol-hedge-b'),
      rocks: tex('fol-rocks'),
      flowers: tex('fol-flower-bush'),
    }, layout.transform.pitch, this.dpr);
    const key = `board-${++this.boardSerial}`;
    this.textures.addCanvas(key, painted.canvas);
    const prevKey = this.boardKey;
    const alpha = this.board ? this.board.alpha : 0;
    this.board?.destroy();
    if (prevKey && this.textures.exists(prevKey)) this.textures.remove(prevKey);
    this.board = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(D.board).setAlpha(alpha);
    this.boardKey = key;
    this.board.setData('painted', painted);
    this.placeBoard();
  }

  private placeBoard(): void {
    const { layout } = this.ctrl.state;
    if (!this.board || !layout) return;
    const painted = this.board.getData('painted') as ReturnType<typeof paintBoard>;
    const p = toScreen(layout.transform, painted.origin);
    this.board.setPosition(p.x, p.y);
    this.board.setDisplaySize(painted.size.w * layout.transform.pitch, painted.size.h * layout.transform.pitch);
  }

  private placeTreasure(): void {
    const { maze, layout } = this.ctrl.state;
    if (!this.treasure || !this.treasureGlow || !maze || !layout) return;
    this.tweens.killTweensOf(this.treasure);
    const c = toScreen(layout.transform, maze.goal.center);
    // Slightly narrower than a corridor so the treasure sits inside its clearing.
    const size = layout.transform.pitch * 0.62;
    const img = this.treasure;
    img.setPosition(c.x, c.y).setAngle(0);
    img.setScale(size / Math.max(img.width, img.height));
    img.setData('baseScale', img.scaleX).setData('baseY', c.y);
    this.treasureGlow.setPosition(c.x, c.y).setDisplaySize(size * 1.9, size * 1.9);
    img.setVisible(!this.treasureFlown);
    this.treasureGlow.setVisible(!this.treasureFlown);
    if (!this.reduced && !this.treasureFlown) {
      this.tweens.add({ targets: img, y: c.y - layout.transform.pitch * 0.035, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private createCompanionPlants(): void {
    for (const p of this.companionPlants) p.destroy();
    this.companionPlants = [
      this.add.image(0, 0, 'fol-fern').setOrigin(0.5, 1).setDepth(D.foreground),
      this.add.image(0, 0, 'fol-monstera').setOrigin(0.5, 1).setDepth(D.foreground),
    ];
  }

  /** Place the companion in its reserved corner (or the intro pose). */
  private placeCompanion(animate: boolean): void {
    const actor = this.companion;
    const { layout, session } = this.ctrl.state;
    if (!actor || !layout || !session) return;
    const screen = this.ctrl.state.screen;
    const intro = screen === 'intro';
    let x: number;
    let scale: number;
    const y = this.vh + 6;
    if (intro) {
      // Intro pose: fitted into its box, anchored on the torso pivot.
      const box = introCharacterRect(this.vw, this.vh);
      scale = Math.min(box.w / actor.frameWidth, box.h / actor.frameHeight);
      x = box.x + box.w / 2;
      actor.sprite.setOrigin(ASSETS.characters[actor.id].pivot.x, 1);
    } else {
      // Corner: the layout gives the exact frame rect (size, Giganto's bleed).
      const r = layout.character;
      scale = r.h / actor.frameHeight;
      x = r.x;
      actor.sprite.setOrigin(0, 1);
    }
    const box = intro ? introCharacterRect(this.vw, this.vh) : layout.character;
    this.ui.setCompanionRect(intro || screen === 'welcome' ? null : layout.character);
    actor.sprite.setData('baseScale', scale);
    this.tweens.killTweensOf(actor.sprite);
    if (animate && !this.reduced) {
      this.tweens.add({ targets: actor.sprite, x, y, scale, alpha: 1, duration: 650, ease: 'Cubic.easeInOut' });
    } else {
      actor.sprite.setPosition(x, y).setScale(scale).setAlpha(1);
    }
    // Foreground plants hide the bust's cut line, outside the face area.
    const [fern, leaf] = this.companionPlants;
    if (fern && leaf) {
      const outer = layout.corner === 'right' ? this.vw : 0;
      const inward = layout.corner === 'right' ? -1 : 1;
      const fw = Math.max(70, box.w * 0.5);
      fern.setScale(fw / fern.width).setPosition(outer + inward * fw * 0.32, this.vh + fw * 0.12).setFlipX(layout.corner === 'right');
      leaf.setScale((box.w * 0.42) / leaf.width).setPosition(box.x + box.w / 2 + inward * box.w * 0.42, this.vh + box.w * 0.14).setFlipX(layout.corner === 'left').setAngle(inward * -8);
      for (const p of this.companionPlants) {
        p.setVisible(!intro);
        this.tweens.killTweensOf(p);
        if (!this.reduced) this.tweens.add({ targets: p, angle: p.angle + 2.5, duration: 2600 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
  }

  /** Immediate tactile answer to a tap on the friend: a tiny squash and stretch. */
  private boop(): void {
    const sprite = this.companion?.sprite;
    if (!sprite || this.reduced) return;
    const base = (sprite.getData('baseScale') as number | undefined) ?? sprite.scaleX;
    this.tweens.killTweensOf(sprite);
    sprite.setScale(base);
    this.tweens.chain({
      targets: sprite,
      tweens: [
        { scaleX: base * 1.04, scaleY: base * 0.96, duration: 90, ease: 'Sine.easeOut' },
        { scaleX: base * 0.98, scaleY: base * 1.05, duration: 120, ease: 'Sine.easeInOut' },
        { scaleX: base, scaleY: base, duration: 160, ease: 'Back.easeOut' },
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // Screens

  private applyScreen(): void {
    const screen = this.ctrl.state.screen;
    const from = this.shownScreen;
    if (screen === from) return;
    this.shownScreen = screen;
    const boardVisible = screen === 'play' || screen === 'reward';
    this.setCastVisible(screen === 'welcome');

    if (screen === 'welcome' || screen === 'loading') {
      this.ui.setCompanionRect(null);
      this.fade(this.board, 0);
      for (const o of [this.treasure, this.treasureGlow]) this.fade(o, 0);
      if (this.companion) this.fade(this.companion.sprite, 0);
      for (const p of this.companionPlants) p.setVisible(false);
      this.trailGfx.setVisible(false);
      this.marker.setVisible(false);
      this.markerGlow.setVisible(false);
      this.ring.setVisible(false);
      return;
    }

    if (screen === 'intro') {
      this.board?.setAlpha(0);
      this.treasure?.setAlpha(0);
      this.treasureGlow?.setAlpha(0);
      this.trailGfx.setVisible(false);
      this.marker.setVisible(false);
      this.markerGlow.setVisible(false);
      this.ring.setVisible(false);
      const actor = this.companion;
      if (actor) {
        this.placeCompanion(false);
        if (!this.reduced) {
          const targetY = actor.sprite.y;
          actor.sprite.setY(targetY + actor.sprite.displayHeight * 0.6).setAlpha(0);
          this.tweens.add({ targets: actor.sprite, y: targetY, alpha: 1, duration: 520, ease: 'Back.easeOut', delay: 120 });
        }
        this.time.delayedCall(this.reduced ? 0 : 500, () => actor.react('encouragement', true));
      }
      return;
    }

    if (boardVisible) {
      const revealing = from === 'intro';
      this.placeCompanion(revealing);
      this.trailGfx.setVisible(true);
      const dur = this.reduced ? 150 : revealing ? 520 : 300;
      this.fade(this.board, 1, dur);
      if (!this.treasureFlown) {
        for (const o of [this.treasure, this.treasureGlow]) {
          if (!o) continue;
          o.setVisible(true);
          if (revealing && !this.reduced && o === this.treasure) {
            const base = o.getData('baseScale') as number;
            o.setAlpha(1).setScale(base * 0.2);
            this.tweens.add({ targets: o, scale: base, duration: 520, delay: 320, ease: 'Back.easeOut' });
          } else this.fade(o, o === this.treasureGlow ? 0.75 : 1, dur);
        }
      }
      this.drawTrail();
      this.updateHandDemo();
    }
  }

  private fade(o: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | null | undefined, alpha: number, duration = 260): void {
    if (!o) return;
    this.tweens.killTweensOf(o);
    if (this.reduced || duration <= 0) {
      o.setAlpha(alpha);
      return;
    }
    this.tweens.add({ targets: o, alpha, duration, ease: 'Sine.easeInOut' });
  }

  // ---------------------------------------------------------------------------
  // Welcome cast

  private setCastVisible(visible: boolean): void {
    if (visible && this.cast.length === 0) this.createCast();
    for (const a of this.cast) a.sprite.setVisible(visible);
    for (const p of this.castPlants) p.setVisible(visible);
    for (const f of this.ambientFlies) f.setVisible(true);
    if (visible) this.placeCast();
    this.ui.setCastRects(visible ? this.castRects() : []);
  }

  private createCast(): void {
    for (const id of CAST_ORDER) {
      const a = new CharacterActor(this, id, this.reduced);
      a.sprite.setDepth(D.companion);
      this.cast.push(a);
    }
    const plants = ['fern', 'banana-plant', 'monstera', 'fern', 'banana-plant', 'monstera'];
    this.castPlants = plants.map((n) => this.add.image(0, 0, `fol-${n}`).setOrigin(0.5, 1).setDepth(D.foreground));
  }

  private castSlots(): Rect[] {
    return castSlots(
      this.vw,
      this.vh,
      this.cast.map((a) => ({ aspect: a.frameWidth / a.frameHeight, scale: CAST_SCALE[a.id], flushLeft: a.id === 'giganto' })),
    );
  }

  private castRects(): Array<{ id: CharacterId; rect: Rect }> {
    const slots = this.castSlots();
    return this.cast.map((a, i) => ({ id: a.id, rect: slots[i] as Rect }));
  }

  private placeCast(): void {
    if (this.cast.length === 0) return;
    const slots = this.castSlots();
    this.cast.forEach((a, i) => {
      const box = slots[i] as Rect;
      a.sprite.setOrigin(0, 1);
      a.sprite.setPosition(box.x, this.vh + 8).setScale(box.h / a.frameHeight).setAlpha(1);
    });
    // Plants stand in the seams between friends and at the ends, sized to the
    // friends (not to Giganto) and low enough to cover bodies, never faces.
    const friendH = slots.slice(1).reduce((a, r) => a + r.h, 0) / Math.max(1, slots.length - 1);
    const seams = [slots[0] ? slots[0].x + slots[0].w * 0.55 : 0];
    for (let i = 1; i < slots.length; i++) {
      const a = slots[i - 1] as Rect;
      const b = slots[i] as Rect;
      seams.push((a.x + a.w + b.x) / 2);
    }
    const lastSlot = slots[slots.length - 1];
    seams.push(lastSlot ? Math.min(this.vw, lastSlot.x + lastSlot.w) : this.vw);
    this.castPlants.forEach((p, i) => {
      const w = Math.max(80, friendH * 0.5);
      p.setScale(w / p.width);
      p.setPosition(seams[i % seams.length] as number, this.vh + w * 0.32);
      p.setFlipX(i % 2 === 1);
      this.tweens.killTweensOf(p);
      p.setAngle(0);
      if (!this.reduced) this.tweens.add({ targets: p, angle: i % 2 ? 2.5 : -2.5, duration: 2400 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.ui.setCastRects(this.castRects());
  }

  // ---------------------------------------------------------------------------
  // Trail, endpoint marker, entrance invitation

  private trailPointsOnScreen(): Point[] {
    const { layout } = this.ctrl.state;
    const engine = this.ctrl.engine;
    if (!layout || !engine) return [];
    const out: Point[] = [];
    const min = 0.06;
    let last: Point | null = null;
    const pts = engine.points;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i] as Point;
      if (last && i < pts.length - 1 && Math.hypot(p.x - last.x, p.y - last.y) < min) continue;
      out.push(toScreen(layout.transform, p));
      last = p;
    }
    return out;
  }

  private strokeTrail(g: Phaser.GameObjects.Graphics, pts: Point[], width: number, color: number, alpha = 1, joints = true): void {
    if (pts.length === 0) return;
    g.fillStyle(color, alpha);
    const r = width / 2;
    if (pts.length === 1) {
      const p = pts[0] as Point;
      g.fillCircle(p.x, p.y, r);
      return;
    }
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo((pts[0] as Point).x, (pts[0] as Point).y);
    for (let i = 1; i < pts.length; i++) g.lineTo((pts[i] as Point).x, (pts[i] as Point).y);
    g.strokePath();
    if (!joints) return;
    // Round caps at both ends; round joins only where the stroke actually bends
    // (straight runs need none), which keeps per-frame tessellation small.
    const first = pts[0] as Point;
    const last = pts[pts.length - 1] as Point;
    g.fillCircle(first.x, first.y, r);
    g.fillCircle(last.x, last.y, r);
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1] as Point;
      const b = pts[i] as Point;
      const c = pts[i + 1] as Point;
      const ux = b.x - a.x;
      const uy = b.y - a.y;
      const vx = c.x - b.x;
      const vy = c.y - b.y;
      const cross = Math.abs(ux * vy - uy * vx);
      const lens = Math.hypot(ux, uy) * Math.hypot(vx, vy);
      if (lens > 0 && cross / lens > 0.12) g.fillCircle(b.x, b.y, r);
    }
  }

  private inkWidth(): number {
    const pitch = this.ctrl.state.layout?.transform.pitch ?? 80;
    const engine = this.ctrl.engine;
    return Math.max(8, Math.min(14, 2 * (engine?.opts.inkRadius ?? 0.065) * pitch));
  }

  private drawTrail(glow = false): void {
    const g = this.trailGfx;
    g.clear();
    const pts = this.trailPointsOnScreen();
    const w = this.inkWidth();
    if (pts.length > 0) {
      this.strokeTrail(g, pts, w + 4, TRAIL.outline);
      this.strokeTrail(g, pts, w, glow ? 0xffe46b : TRAIL.core);
      const hl = pts.map((p) => ({ x: p.x - w * 0.12, y: p.y - w * 0.14 }));
      this.strokeTrail(g, hl, Math.max(2, w * 0.3), TRAIL.highlight, 1, true);
    }
    this.drawMarker();
  }

  private drawMarker(): void {
    const { layout, maze, screen } = this.ctrl.state;
    const engine = this.ctrl.engine;
    const m = this.marker;
    m.clear();
    const show = !!layout && !!maze && !!engine && (screen === 'play') && !engine.solved;
    m.setVisible(show);
    this.markerGlow.setVisible(show);
    this.ring.setVisible(show && !this.ctrl.state.drawing);
    if (!show || !layout || !maze || !engine) return;
    const w = this.inkWidth();
    const at = toScreen(layout.transform, engine.endpoint ?? maze.entrance.outside);
    m.fillStyle(TRAIL.outline, 1);
    m.fillCircle(at.x, at.y, w * 0.95 + 2);
    m.fillStyle(0xffde5a, 1);
    m.fillCircle(at.x, at.y, w * 0.95);
    m.fillStyle(0xffffff, 0.9);
    m.fillCircle(at.x - w * 0.25, at.y - w * 0.28, w * 0.3);
    this.markerGlow.setPosition(at.x, at.y).setDisplaySize(w * 6, w * 6);
    const ringSize = engine.started ? w * 4.2 : layout.transform.pitch * 0.9;
    this.ring.setPosition(at.x, at.y).setData('size', ringSize);
  }

  // ---------------------------------------------------------------------------
  // First-puzzle hand demonstration (stops permanently on first input)

  private updateHandDemo(): void {
    const { showHandDemo, screen, maze, layout } = this.ctrl.state;
    const on = showHandDemo && screen === 'play' && !!maze && !!layout && !this.ctrl.engine?.started;
    if (!on) {
      this.handTween?.stop();
      this.handTween = null;
      this.hand.setVisible(false);
      this.ghostGfx.clear();
      return;
    }
    if (!maze || !layout) return;
    const nodes = [maze.entranceNode, ...maze.metrics.solution.slice(0, 2)];
    const pts = nodes.map((n) => toScreen(layout.transform, nodePos(maze, n)));
    const lens: number[] = [0];
    for (let i = 1; i < pts.length; i++) lens.push((lens[i - 1] as number) + Math.hypot((pts[i] as Point).x - (pts[i - 1] as Point).x, (pts[i] as Point).y - (pts[i - 1] as Point).y));
    const total = lens[lens.length - 1] as number;
    const at = (d: number): Point => {
      for (let i = 1; i < pts.length; i++) {
        if (d <= (lens[i] as number) || i === pts.length - 1) {
          const a = pts[i - 1] as Point;
          const b = pts[i] as Point;
          const t = Math.min(1, Math.max(0, (d - (lens[i - 1] as number)) / Math.max(1e-6, (lens[i] as number) - (lens[i - 1] as number))));
          return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        }
      }
      return pts[pts.length - 1] as Point;
    };
    const handScale = Math.max(0.5, Math.min(0.9, layout.transform.pitch / 120));
    this.hand.setScale(handScale).setVisible(true);
    const w = this.inkWidth();
    if (this.reduced) {
      this.handTween?.stop();
      this.handTween = null;
      const start = at(0);
      this.hand.setPosition(start.x, start.y).setAlpha(0.95);
      this.ghostGfx.clear();
      this.strokeTrail(this.ghostGfx, pts, w, TRAIL.core, 0.45, false);
      return;
    }
    if (this.handTween) return;
    this.handTween = this.tweens.addCounter({
      from: 0,
      to: 1.35,
      duration: 2600,
      repeat: -1,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        const t = Math.min(1, v);
        const p = at(t * total);
        this.hand.setPosition(p.x, p.y);
        this.hand.setAlpha(v < 0.08 ? v / 0.08 : v > 1.05 ? Math.max(0, 1 - (v - 1.05) / 0.25) : 1);
        this.ghostGfx.clear();
        const trace: Point[] = [];
        for (let d = 0; d <= t * total; d += 6) trace.push(at(d));
        trace.push(p);
        this.strokeTrail(this.ghostGfx, trace, w, TRAIL.core, Math.min(0.5, this.hand.alpha * 0.5), false);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Hint butterfly

  private clearHint(): void {
    this.tweens.killTweensOf(this.hintDots);
    this.hintDots.clear().setAlpha(1);
    if (this.hintFly) {
      this.tweens.killTweensOf(this.hintFly);
      this.hintFly.destroy();
      this.hintFly = null;
    }
  }

  /**
   * Fly a butterfly along a smooth spline through `points`: constant speed by
   * arc length, gentle banking into turns, wing beats that follow the speed and
   * slow down when it lands, and a faint sparkle trail. Returns the image; the
   * caller owns what happens after `onArrive`.
   */
  private flyButterfly(
    points: Point[],
    o: { size: number; speed: number; depth: number; land?: boolean; onArrive?: (fly: Phaser.GameObjects.Image) => void; onProgress?: (t: number) => void },
  ): Phaser.GameObjects.Image {
    const first = points[0] as Point;
    const fly = this.add.image(first.x, first.y, 'fol-butterfly').setDepth(o.depth);
    const base = o.size / fly.width;
    fly.setScale(base);
    const pts = points.length >= 2 ? points : [first, first];
    const curve = new Phaser.Curves.Spline(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
    const length = Math.max(1, curve.getLength());
    const duration = Math.max(500, (length / o.speed) * 1000);
    fly.setData('duration', duration);
    let phase = 0;
    let last = this.time.now;
    let sinceSpark = 0;
    let prev = new Phaser.Math.Vector2(first.x, first.y);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: o.land ? 'Sine.easeOut' : 'Sine.easeInOut',
      onUpdate: (tw) => {
        if (!fly.active) return;
        const t = Math.min(1, tw.getValue() ?? 0);
        const now = this.time.now;
        const dt = Math.min(50, now - last);
        last = now;
        const p = curve.getPointAt(t);
        const moved = Phaser.Math.Distance.Between(prev.x, prev.y, p.x, p.y);
        prev = p;
        // Wing beats: faster while travelling, slowing to a glide on landing.
        const settle = o.land ? Math.max(0, (t - 0.82) / 0.18) : 0;
        phase += dt * (0.034 - 0.022 * settle) + moved * 0.01;
        const open = 0.3 + 0.7 * Math.abs(Math.cos(phase));
        fly.setScale(base * (open + (1 - open) * settle), base * (0.96 + 0.04 * open));
        // Bank into the direction of travel, levelling out on landing.
        const tan = curve.getTangentAt(t);
        fly.setAngle(Phaser.Math.Clamp(tan.x * 24, -24, 24) * (1 - settle));
        fly.setFlipX(tan.x < -0.15);
        fly.setPosition(p.x, p.y + Math.sin(phase * 0.5) * 2.5 * (1 - settle));
        o.onProgress?.(t);
        sinceSpark += moved;
        if (sinceSpark > 46) {
          sinceSpark = 0;
          this.sparkle.emitParticleAt(p.x, p.y + 6, 1);
        }
      },
      onComplete: () => {
        if (!fly.active) return;
        fly.setScale(base).setAngle(0);
        o.onArrive?.(fly);
      },
    });
    return fly;
  }

  /**
   * After three fresh starts a butterfly flutters in past the friend, loops
   * once around its head (the friend waves hello), then flies up to the
   * top-left corner and lands where the hint button appears.
   */
  private butterflyArrives(): void {
    const { layout } = this.ctrl.state;
    const btn = this.ui.rectOf('hint');
    if (!layout || !btn || this.reduced) {
      this.ui.hintLanded();
      return;
    }
    this.ctrl.sfx('flutter');
    const v = layout.friendVisible;
    const to = { x: btn.x + btn.width / 2, y: btn.y + btn.height / 2 };
    const left = layout.corner === 'left';
    const inX = (x: number): number => Phaser.Math.Clamp(x, 24, this.vw - 24);
    const inY = (y: number): number => Phaser.Math.Clamp(y, 24, this.vh - 24);
    const headY = v.y + v.h * 0.12;
    const over = { x: inX(v.x + v.w * 0.5), y: inY(headY - v.h * 0.15) };
    const path: Point[] = [
      { x: left ? -50 : this.vw + 50, y: inY(headY - v.h * 0.45) },
      { x: inX(v.x + v.w * 0.5), y: inY(headY - v.h * 0.4) },
      { x: inX(left ? v.x + v.w * 0.95 : v.x + v.w * 0.05), y: inY(headY) },
      over,
      { x: inX((over.x + to.x) / 2), y: inY(Math.min(over.y, to.y) + Math.abs(over.y - to.y) * 0.35) },
      { x: to.x + btn.width * 0.7, y: to.y + btn.height * 0.9 },
      to,
    ];
    let waved = false;
    this.flyButterfly(path, {
      size: Math.max(48, btn.width * 0.8),
      speed: Math.max(420, this.vh * 0.6),
      depth: D.fly,
      land: true,
      onProgress: (t) => {
        if (!waved && t > 0.3) {
          waved = true;
          this.companion?.react('encouragement', true);
        }
      },
      onArrive: (fly) => {
        this.sparkle.explode(8, to.x, to.y);
        this.ui.hintLanded();
        this.tweens.add({ targets: fly, alpha: 0, duration: 220, onComplete: () => fly.destroy() });
      },
    });
  }

  /** Golden pollen dots along a route, revealed as the butterfly passes over them. */
  private pollenDots(route: Point[], spacing: number): Array<{ p: Point; at: number }> {
    const out: Array<{ p: Point; at: number }> = [];
    let total = 0;
    for (let i = 1; i < route.length; i++) total += Phaser.Math.Distance.BetweenPoints(route[i - 1] as Point, route[i] as Point);
    let walked = 0;
    let next = spacing * 0.5;
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1] as Point;
      const b = route[i] as Point;
      const seg = Phaser.Math.Distance.BetweenPoints(a, b);
      while (next <= walked + seg) {
        const k = (next - walked) / Math.max(1e-6, seg);
        out.push({ p: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, at: total > 0 ? next / total : 1 });
        next += spacing;
      }
      walked += seg;
    }
    return out;
  }

  private drawPollen(dots: Array<{ p: Point; at: number }>, upTo: number, r: number): void {
    const g = this.hintDots;
    g.clear();
    for (const d of dots) {
      if (d.at > upTo) break;
      g.fillStyle(0x8a4f12, 0.55);
      g.fillCircle(d.p.x, d.p.y, r + 1.5);
      g.fillStyle(0xffe17a, 1);
      g.fillCircle(d.p.x, d.p.y, r);
    }
  }

  private showHint(hint: Hint): void {
    const { layout } = this.ctrl.state;
    if (!layout || hint.kind === 'none') return;
    this.clearHint();
    this.ctrl.sfx('flutter');
    const size = Math.max(58, layout.transform.pitch * 0.72);
    const btn = this.ui.rectOf('hint');
    const start = btn ? { x: btn.x + btn.width / 2, y: btn.y + btn.height / 2 } : { x: layout.friendVisible.x, y: layout.friendVisible.y };
    let path: Point[];
    if (hint.kind === 'reset') {
      const r = this.ui.rectOf('reset');
      path = r ? [{ x: r.x + r.width / 2, y: r.y - size * 0.2 }] : [start];
      this.ui.pulse('reset');
    } else {
      path = hint.points.map((p) => toScreen(layout.transform, p));
    }
    if (this.reduced) {
      const fly = this.add.image(0, 0, 'fol-butterfly').setDepth(D.hint);
      fly.setScale(size / fly.width);
      this.hintFly = fly;
      const end = path[path.length - 1] as Point;
      fly.setPosition(end.x, end.y).setAlpha(0);
      if (hint.kind === 'path') this.drawPollen(this.pollenDots(path, Math.max(14, layout.transform.pitch * 0.26)), 1, Math.max(3, this.inkWidth() * 0.32));
      this.tweens.add({ targets: fly, alpha: 1, duration: 200, hold: 1800, yoyo: true, onComplete: () => this.clearHint() });
      return;
    }
    // Lift off from the corner, then follow the next two moves of the route,
    // dropping golden pollen on them that lingers a moment after landing.
    const lift = { x: start.x + size * 0.6, y: start.y + size * 0.4 };
    const routeDots = hint.kind === 'path' ? this.pollenDots(path, Math.max(14, layout.transform.pitch * 0.26)) : [];
    const dotR = Math.max(3, this.inkWidth() * 0.32);
    // Fraction of the flight spent before reaching the route.
    const lead = Phaser.Math.Distance.BetweenPoints(start, lift) + Phaser.Math.Distance.BetweenPoints(lift, path[0] as Point);
    let routeLen = 0;
    for (let i = 1; i < path.length; i++) routeLen += Phaser.Math.Distance.BetweenPoints(path[i - 1] as Point, path[i] as Point);
    const leadShare = lead / Math.max(1, lead + routeLen);
    this.hintFly = this.flyButterfly([start, lift, ...path], {
      size,
      speed: Math.max(260, layout.transform.pitch * 3.2),
      depth: D.hint,
      land: true,
      onProgress: (t) => {
        if (routeDots.length) this.drawPollen(routeDots, (t - leadShare) / Math.max(0.01, 1 - leadShare), dotR);
      },
      onArrive: (fly) => {
        if (this.hintFly !== fly) return;
        if (routeDots.length) this.drawPollen(routeDots, 1, dotR);
        const y = fly.y;
        this.tweens.chain({
          targets: fly,
          tweens: [
            { y: y - 8, duration: 420, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' },
            { alpha: 0, duration: 420, onComplete: () => this.clearHint() },
          ],
        });
        this.tweens.add({ targets: this.hintDots, alpha: 0, delay: 1400, duration: 900 });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Celebration (reward is already saved before this starts)

  private celebrate(reward: Reward): void {
    const { layout, maze } = this.ctrl.state;
    this.clearHint();
    this.updateHandDemo();
    this.ring.setVisible(false);
    this.marker.setVisible(false);
    this.markerGlow.setVisible(false);
    this.celebration = { timers: [], flyer: null, done: false };
    const c = this.celebration;
    const later = (ms: number, fn: () => void): void => {
      c.timers.push(this.time.delayedCall(ms, fn));
    };
    this.companion?.react('celebration', true);
    this.ui.celebrationBanner(reward);
    this.ctrl.sfx('success');
    if (!layout || !maze || !this.treasure) {
      later(400, () => this.finishCelebration(false));
      return;
    }
    if (this.reduced) {
      this.drawTrail(true);
      later(500, () => {
        this.fade(this.treasure, 0, 200);
        this.fade(this.treasureGlow, 0, 200);
        this.ctrl.sfx('pickup');
        this.ui.pulse('collection');
      });
      later(900, () => this.finishCelebration(false));
      return;
    }
    // 1. Trail glows; a light runs along it from the entrance to the treasure.
    this.drawTrail(true);
    const pts = this.trailPointsOnScreen();
    const runner = this.add.image(0, 0, 'spark').setDepth(D.fx).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff3b0);
    runner.setDisplaySize(this.inkWidth() * 5, this.inkWidth() * 5);
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push((lens[i - 1] as number) + Math.hypot((pts[i] as Point).x - (pts[i - 1] as Point).x, (pts[i] as Point).y - (pts[i - 1] as Point).y));
    const total = lens[lens.length - 1] ?? 0;
    let idx = 1;
    this.tweens.addCounter({
      from: 0,
      to: total,
      duration: 750,
      ease: 'Sine.easeIn',
      onUpdate: (tw) => {
        const d = tw.getValue() ?? 0;
        while (idx < pts.length - 1 && (lens[idx] as number) < d) idx++;
        const a = pts[idx - 1] ?? pts[0];
        const b = pts[idx] ?? a;
        if (!a || !b) return;
        const seg = Math.max(1e-6, (lens[idx] as number) - (lens[idx - 1] as number));
        const t = Math.min(1, Math.max(0, (d - (lens[idx - 1] as number)) / seg));
        runner.setPosition(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        if (Math.random() < 0.35) this.sparkle.emitParticleAt(runner.x, runner.y, 1);
      },
      onComplete: () => {
        this.tweens.add({ targets: runner, alpha: 0, scale: runner.scale * 2, duration: 300, onComplete: () => runner.destroy() });
      },
    });

    // 2. Treasure performs its signature motion; leaves and petals burst.
    const treasure = this.treasure;
    later(650, () => {
      this.tweens.killTweensOf(treasure);
      this.signatureMotion(reward.treasureId, treasure, layout.transform.pitch);
      this.bursts.forEach((b, i) => b.explode(i === 0 ? 10 : 8, treasure.x, treasure.y));
      this.sparkle.explode(12, treasure.x, treasure.y);
    });

    // 3. Treasure travels to its collection slot.
    later(1750, () => this.flyToCollection(reward));
    later(2700, () => this.finishCelebration(false));
  }

  private signatureMotion(id: TreasureId, img: Phaser.GameObjects.Image, pitch: number): void {
    const s = img.getData('baseScale') as number;
    const y = img.getData('baseY') as number;
    switch (TREASURES[id].motion) {
      case 'roll':
        this.tweens.chain({
          targets: img,
          tweens: [
            { angle: -14, duration: 140, ease: 'Sine.easeInOut' },
            { angle: 14, duration: 180, ease: 'Sine.easeInOut' },
            { angle: 100, x: img.x + pitch * 0.18, duration: 380, ease: 'Sine.easeInOut' },
            { angle: 0, x: img.x, duration: 380, ease: 'Sine.easeInOut' },
          ],
        });
        break;
      case 'hop':
        this.tweens.chain({
          targets: img,
          tweens: [
            { scaleY: s * 0.82, scaleX: s * 1.12, duration: 110 },
            { y: y - pitch * 0.32, scaleY: s * 1.1, scaleX: s * 0.92, duration: 220, ease: 'Quad.easeOut' },
            { y, scaleY: s, scaleX: s, duration: 200, ease: 'Quad.easeIn' },
            { y: y - pitch * 0.16, duration: 160, ease: 'Quad.easeOut' },
            { y, duration: 160, ease: 'Bounce.easeOut' },
          ],
        });
        break;
      case 'sway':
        this.tweens.add({ targets: img, angle: { from: -12, to: 12 }, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => img.setAngle(0) });
        this.tweens.add({ targets: img, scale: s * 1.12, duration: 300, yoyo: true, ease: 'Sine.easeInOut' });
        break;
      case 'glint': {
        const star = this.add.image(img.x - img.displayWidth * 0.25, img.y - img.displayHeight * 0.2, 'star').setDepth(D.fx + 2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
        this.tweens.add({ targets: star, scale: 1.3, angle: 90, alpha: { from: 1, to: 0 }, duration: 700, ease: 'Sine.easeOut', onComplete: () => star.destroy() });
        this.tweens.add({ targets: img, scale: s * 1.14, duration: 260, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
        break;
      }
      case 'turn':
        this.tweens.chain({
          targets: img,
          tweens: [
            { scaleX: -s, y: y - pitch * 0.06, duration: 380, ease: 'Sine.easeInOut' },
            { scaleX: s, y, duration: 380, ease: 'Sine.easeInOut' },
          ],
        });
        break;
      case 'jiggle':
        this.tweens.chain({
          targets: img,
          tweens: [
            { scaleX: s * 1.14, scaleY: s * 0.88, duration: 90 },
            { scaleX: s * 0.9, scaleY: s * 1.12, duration: 90 },
            { scaleX: s * 1.1, scaleY: s * 0.92, duration: 90 },
            { scaleX: s * 0.95, scaleY: s * 1.06, duration: 90 },
            { scaleX: s, scaleY: s, duration: 120 },
          ],
        });
        break;
    }
  }

  private flyToCollection(reward: Reward): void {
    const c = this.celebration;
    if (!c || !this.treasure) return;
    const btn = this.ui.rectOf('collection');
    const from = { x: this.treasure.x, y: this.treasure.y };
    const to = btn ? { x: btn.x + btn.width / 2, y: btn.y + btn.height / 2 } : { x: this.vw - 40, y: 40 };
    const flyer = this.add.image(from.x, from.y, `tr-${reward.treasureId}`).setDepth(D.fly);
    const s0 = this.treasure.scaleX;
    flyer.setScale(s0);
    c.flyer = flyer;
    this.treasure.setVisible(false);
    this.treasureGlow?.setVisible(false);
    this.treasureFlown = true;
    const s1 = Math.min(s0, 44 / Math.max(flyer.width, flyer.height));
    const arc = Math.max(80, Math.abs(to.x - from.x) * 0.25);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 760,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        flyer.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * arc);
        flyer.setScale(s0 + (s1 - s0) * t).setAngle(360 * t);
      },
      onComplete: () => {
        this.sparkle.explode(10, to.x, to.y);
        this.ctrl.sfx('pickup');
        this.ui.pulse('collection');
        flyer.destroy();
        if (c.flyer === flyer) c.flyer = null;
      },
    });
  }

  private cancelCelebration(): void {
    const c = this.celebration;
    if (!c) return;
    for (const t of c.timers) t.remove();
    c.flyer?.destroy();
    this.celebration = null;
  }

  private finishCelebration(skipped: boolean): void {
    const c = this.celebration;
    if (!c || c.done) return;
    c.done = true;
    for (const t of c.timers) t.remove();
    if (skipped) {
      if (c.flyer) {
        this.tweens.killTweensOf(c.flyer);
        c.flyer.destroy();
        c.flyer = null;
      }
      this.treasureFlown = true;
      this.treasure?.setVisible(false);
      this.treasureGlow?.setVisible(false);
      this.ui.pulse('collection');
    }
    this.drawTrail(false);
    this.ctrl.finishCelebration();
  }

  // ---------------------------------------------------------------------------
  // Ambient life (outside the board; removed with reduced motion)

  private createAmbient(): void {
    for (let i = 0; i < 2; i++) {
      const f = this.add.image(-100, -100, 'fol-butterfly').setDepth(D.ambient).setScale(0.12).setAlpha(0.95);
      f.setData('base', 0.12);
      this.ambientFlies.push(f);
      this.time.delayedCall(800 + i * 1800, () => this.wander(f));
    }
  }

  private freeSpot(): Point {
    const { screen, layout } = this.ctrl.state;
    const w = this.vw;
    const h = this.vh;
    if ((screen === 'play' || screen === 'reward') && layout) {
      const left = Math.random() < 0.5;
      const railW = layout.boardArea.x;
      const x = left ? railW * (0.2 + Math.random() * 0.6) : w - railW * (0.2 + Math.random() * 0.6);
      return { x, y: h * (0.3 + Math.random() * 0.25) };
    }
    return { x: w * (0.05 + Math.random() * 0.9), y: h * (0.08 + Math.random() * 0.35) };
  }

  private wander(f: Phaser.GameObjects.Image): void {
    if (!f.active) return;
    if (this.reduced) {
      f.setVisible(false);
      this.time.delayedCall(3000, () => this.wander(f));
      return;
    }
    const screen = this.ctrl.state.screen;
    const show = screen === 'welcome' || screen === 'play' || screen === 'reward';
    if (!show) {
      f.setVisible(false);
      this.time.delayedCall(2000, () => this.wander(f));
      return;
    }
    if (!f.visible || f.x < 0) {
      const s = this.freeSpot();
      f.setPosition(s.x, s.y).setVisible(true);
    }
    const target = this.freeSpot();
    const d = Math.hypot(target.x - f.x, target.y - f.y);
    const base = f.getData('base') as number;
    this.tweens.killTweensOf(f);
    this.tweens.add({ targets: f, scaleX: base * 0.35, duration: 140, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: f,
      x: target.x,
      y: target.y,
      duration: Math.max(1800, (d / 45) * 1000),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.tweens.killTweensOf(f);
        f.setScale(base);
        this.time.delayedCall(1200 + Math.random() * 2500, () => this.wander(f));
      },
    });
  }

  // ---------------------------------------------------------------------------

  override update(time: number): void {
    this.companion?.update(time);
    for (const a of this.cast) if (a.sprite.visible) a.update(time);
    if (this.ring.visible) {
      const size = (this.ring.getData('size') as number) || 60;
      const phase = (time % 1600) / 1600;
      const k = this.reduced ? 1 : 0.75 + phase * 0.5;
      this.ring.setDisplaySize(size * k, size * k).setAlpha(this.reduced ? 0.8 : 1 - phase * 0.85);
    }
    if (this.markerGlow.visible && !this.reduced) {
      const w = this.inkWidth();
      const k = 1 + Math.sin(time / 260) * 0.12;
      this.markerGlow.setDisplaySize(w * 6 * k, w * 6 * k);
    }
  }
}

