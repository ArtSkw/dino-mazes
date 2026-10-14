/**
 * The living jungle around the maze (owner request, 14 Oct 2026): small,
 * slow, mostly peripheral motion that makes the world feel like a cartoon set
 * without pulling attention from the maze.
 *
 *   wind      one breeze for every plant on screen, gusts travelling left to
 *             right with a damped follow-through (plants no longer sway alone)
 *   light     a few small sun spots through the canopy, brightening as gusts pass
 *             (small sprites on purpose: full-screen light layers cost a tablet
 *             GPU far too much fill rate; measured 33 → 83 ms/frame in software GL)
 *   leaves    occasionally a leaf tumbles down (in the side rails during play)
 *   flies     butterflies wander, perch on plants and rest with slow wings
 *   twinkle   a star glints on the treasure every few seconds
 *   daylight  the backdrop's colour follows the local time of day
 *
 * Everything lives below the board (or in the rails) and switches off with
 * reduced motion. Motion budget (docs/MOTION_PROPOSAL.md): ambient travel stays
 * under ~5 % of the screen, slow sines, out of step.
 */
import Phaser from 'phaser';
import type { Rect } from '../platform/layout';

export interface AmbientHost {
  scene: Phaser.Scene;
  vw(): number;
  vh(): number;
  reduced(): boolean;
  /** Current screen and whether the maze is being drawn or celebrated. */
  mode(): { screen: string; drawing: boolean; celebrating: boolean; opening: boolean; overlay: boolean };
  /** The board (play/reward), so ambient things keep out of it. */
  board(): Rect | null;
  /** Plants to blow (each has data 'baseAngle' and 'flex'). */
  plants(): Phaser.GameObjects.Image[];
  /** The treasure in the clearing, while it is visible. */
  treasure(): Phaser.GameObjects.Image | null;
  depth: { light: number; flies: number; leaves: number; twinkle: number };
  backdrop: Phaser.GameObjects.Image;
}

const TAU = Math.PI * 2;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);

type Fly = {
  img: Phaser.GameObjects.Image;
  base: number;
  phase: number;
  /** Flaps per second while flying. */
  rate: number;
  state: 'fly' | 'rest' | 'hidden';
  restUntil: number;
};

export class AmbientWorld {
  private host: AmbientHost;
  private spots: Array<{ img: Phaser.GameObjects.Image; fx: number; fy: number; size: number; px: number; py: number }> = [];
  private flies: Fly[] = [];
  private gust = { t0: -100, amp: 0 };
  private nextGust = 0;
  private nextLeaf = 0;
  private nextTwinkle = 0;
  private extraShiver = { t0: -100, amp: 0 };

  constructor(host: AmbientHost) {
    this.host = host;
    const s = host.scene;
    // Sun spots: anchored as fractions of the screen, mostly on the sand around
    // the board, each drifting on its own slow sine.
    const anchors: Array<[number, number, number]> = [[0.12, 0.3, 0.2], [0.86, 0.22, 0.16], [0.2, 0.78, 0.14], [0.82, 0.7, 0.18], [0.5, 0.12, 0.12]];
    for (const [fx, fy, size] of anchors) {
      const img = s.add.image(0, 0, 'spark').setDepth(host.depth.light).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff1c4).setAlpha(0);
      this.spots.push({ img, fx, fy, size, px: rand(0, TAU), py: rand(0, TAU) });
    }
    for (let i = 0; i < 3; i++) {
      const img = s.add.image(-200, -200, 'fol-butterfly').setDepth(host.depth.flies).setVisible(false);
      const base = rand(0.1, 0.13);
      img.setScale(base);
      this.flies.push({ img, base, phase: rand(0, TAU), rate: rand(5.5, 7.5), state: 'hidden', restUntil: 0 });
    }
    const now = s.time.now;
    this.nextGust = now + 4000;
    this.nextLeaf = now + 9000;
    this.nextTwinkle = now + 2500;
    this.applyDaylight();
    s.time.addEvent({ delay: 5 * 60 * 1000, loop: true, callback: () => this.applyDaylight() });
    this.flies.forEach((f, i) => s.time.delayedCall(900 + i * 1700, () => this.wander(f)));
  }

  /** Daylight colour from the local hour: cool morning, neutral day, golden evening, soft dusk. */
  applyDaylight(date = new Date()): void {
    const h = date.getHours() + date.getMinutes() / 60;
    const tint = h < 6 ? 0xe2e8ff : h < 10 ? 0xf1f6ff : h < 16 ? 0xffffff : h < 19.5 ? 0xffefd6 : 0xe6eaff;
    this.host.backdrop.setTint(tint);
  }

  /** A distant footstep: plants shiver for a moment (the scene adds sound and shake). */
  shiver(amp = 3.2): void {
    this.extraShiver = { t0: this.host.scene.time.now / 1000, amp };
  }

  /** Breeze angle (degrees) for a plant at screen x, at time t (s). */
  private wind(x: number, t: number): number {
    const k = x / Math.max(1, this.host.vw());
    const base = Math.sin(TAU * (t / 5.3) - k * 1.6) * 0.9 + Math.sin(TAU * (t / 11.7) - k * 0.8 + 1.3) * 0.6;
    // A gust travels across the screen in ~1.2 s and settles with a damped wobble.
    const pulse = (t0: number, amp: number): number => {
      const tau = t - t0 - k * 1.2;
      if (tau < 0 || tau > 4) return 0;
      return amp * Math.exp(-tau * 1.5) * Math.sin(tau * TAU * 0.85);
    };
    return base + pulse(this.gust.t0, this.gust.amp) + pulse(this.extraShiver.t0, this.extraShiver.amp);
  }

  update(time: number): void {
    const t = time / 1000;
    const reduced = this.host.reduced();
    const m = this.host.mode();
    const vw = this.host.vw();
    const vh = this.host.vh();

    // Wind on every plant.
    for (const p of this.host.plants()) {
      if (!p.active || !p.visible) continue;
      const base = (p.getData('baseAngle') as number | undefined) ?? 0;
      const flex = (p.getData('flex') as number | undefined) ?? 1;
      p.setAngle(reduced ? base : base + this.wind(p.x, t) * flex);
    }
    if (!reduced && time > this.nextGust) {
      this.gust = { t0: t, amp: rand(2.2, 3.8) };
      this.nextGust = time + rand(9000, 16000);
    }

    // Sun spots drift slowly; they brighten a little as a gust shakes the canopy.
    // The opening has its own light shafts; the spots fade in once it is over.
    const showLight = !reduced && m.screen !== 'loading' && !m.opening;
    const gustGlow = Math.max(0, this.wind(vw * 0.5, t) - 1) * 0.04;
    for (const sp of this.spots) {
      sp.img.setVisible(showLight);
      if (!showLight) continue;
      const size = Math.min(vw, vh) * sp.size * (1 + 0.08 * Math.sin(t / 7 + sp.px));
      sp.img.setDisplaySize(size, size * 0.8);
      sp.img.setPosition(vw * sp.fx + Math.sin(t / 23 + sp.px) * vw * 0.025, vh * sp.fy + Math.cos(t / 19 + sp.py) * vh * 0.02);
      sp.img.setAlpha(0.16 + 0.06 * Math.sin(t / 5 + sp.py) + gustGlow);
    }

    // A leaf tumbles down now and then.
    if (!reduced && time > this.nextLeaf && !m.opening) {
      this.nextLeaf = time + rand(14000, 26000);
      this.dropLeaf();
    }

    // A star glints on the treasure (draws the eye to the goal, gently).
    const tr = this.host.treasure();
    if (!reduced && tr && tr.visible && tr.alpha > 0.9 && m.screen === 'play' && !m.celebrating && time > this.nextTwinkle) {
      this.nextTwinkle = time + rand(3800, 6500);
      this.twinkle(tr);
    }

    // Butterflies: asymmetric wing beats (fast down-stroke), slow breathing at rest.
    for (const f of this.flies) {
      // A perched butterfly folds its wings (the rig shows its side pose).
      f.img.setData('perched', f.state === 'rest');
      if (f.state === 'hidden') continue;
      const dt = this.host.scene.game.loop.delta / 1000;
      if (f.state === 'fly') {
        f.phase = (f.phase + dt * f.rate) % 1;
        // 0..0.4 down-stroke (closing fast), 0.4..1 up-stroke (opening slowly).
        const open = f.phase < 0.4 ? 1 - Math.sin((f.phase / 0.4) * (Math.PI / 2)) * 0.7 : 0.3 + Math.sin(((f.phase - 0.4) / 0.6) * (Math.PI / 2)) * 0.7;
        f.img.setScale(f.base * open, f.base);
      } else {
        f.phase = (f.phase + dt * 0.45) % 1;
        const open = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(f.phase * TAU));
        f.img.setScale(f.base * open, f.base);
        f.img.setAngle(Math.sin(t * 1.3 + f.base * 50) * 4);
        if (time > f.restUntil) {
          f.state = 'fly';
          this.wander(f);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------

  /** Where a butterfly may go: plant tops (perches) or free air outside the board. */
  private spot(perch: boolean): { x: number; y: number; perch: boolean } {
    const vw = this.host.vw();
    const vh = this.host.vh();
    const board = this.host.board();
    if (perch) {
      const plants = this.host.plants().filter((p) => p.active && p.visible);
      const p = plants[Math.floor(Math.random() * plants.length)];
      if (p) {
        const top = p.getTopCenter();
        const x = Phaser.Math.Clamp((top.x ?? p.x) + rand(-0.15, 0.15) * p.displayWidth, 20, vw - 20);
        const y = Phaser.Math.Clamp((top.y ?? p.y) + p.displayHeight * rand(0.12, 0.3), 30, vh - 20);
        if (!board || !Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(board.x - 20, board.y - 20, board.w + 40, board.h + 40), x, y)) return { x, y, perch: true };
      }
    }
    if (board) {
      const left = Math.random() < 0.5;
      const railW = left ? board.x : vw - (board.x + board.w);
      const x = left ? railW * rand(0.2, 0.8) : vw - railW * rand(0.2, 0.8);
      return { x, y: vh * rand(0.25, 0.6), perch: false };
    }
    return { x: vw * rand(0.05, 0.95), y: vh * rand(0.08, 0.45), perch: false };
  }

  private wander(f: Fly): void {
    const s = this.host.scene;
    if (!f.img.active) return;
    const m = this.host.mode();
    const show = !this.host.reduced() && (m.screen === 'welcome' || m.screen === 'play' || m.screen === 'reward') && !m.opening;
    if (!show) {
      f.state = 'hidden';
      f.img.setVisible(false);
      s.time.delayedCall(2500, () => this.wander(f));
      return;
    }
    if (f.state === 'hidden' || !f.img.visible) {
      const start = this.spot(false);
      f.img.setPosition(start.x, start.y).setVisible(true).setAngle(0);
    }
    f.state = 'fly';
    const target = this.spot(Math.random() < 0.45);
    const from = { x: f.img.x, y: f.img.y };
    const d = Math.hypot(target.x - from.x, target.y - from.y);
    // A gentle arc, not a straight line: the control point is lifted above the path.
    const ctrl = { x: (from.x + target.x) / 2 + rand(-40, 40), y: Math.min(from.y, target.y) - Math.min(120, d * 0.35) };
    f.img.setFlipX(target.x < from.x);
    s.tweens.killTweensOf(f.img);
    s.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.max(1800, (d / 55) * 1000),
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const u = tw.getValue() ?? 0;
        const x = (1 - u) * (1 - u) * from.x + 2 * (1 - u) * u * ctrl.x + u * u * target.x;
        const y = (1 - u) * (1 - u) * from.y + 2 * (1 - u) * u * ctrl.y + u * u * target.y;
        // Each wing beat lifts the body a little.
        f.img.setPosition(x, y - Math.max(0, Math.sin(f.phase * TAU)) * 3);
        f.img.setAngle(Phaser.Math.Clamp((target.x - from.x) / Math.max(1, d), -1, 1) * 10);
      },
      onComplete: () => {
        if (target.perch) {
          f.state = 'rest';
          f.restUntil = s.time.now + rand(2500, 6500);
        } else {
          s.time.delayedCall(rand(300, 1400), () => this.wander(f));
        }
      },
    });
  }

  private dropLeaf(): void {
    const s = this.host.scene;
    if (!s.textures.exists('amb-leaf')) return;
    const vw = this.host.vw();
    const vh = this.host.vh();
    const board = this.host.board();
    // During play leaves fall in a side rail; elsewhere anywhere across the top.
    let x = vw * rand(0.1, 0.9);
    if (board) {
      const left = Math.random() < 0.5;
      const railW = left ? board.x : vw - (board.x + board.w);
      if (railW < 60) return;
      x = left ? railW * rand(0.25, 0.75) : vw - railW * rand(0.25, 0.75);
    }
    const leaf = s.add.image(x, -40, 'amb-leaf').setDepth(this.host.depth.leaves);
    const size = Math.min(vw, vh) * rand(0.035, 0.05);
    const base = size / leaf.width;
    leaf.setScale(base).setAngle(rand(0, 360));
    const sway = rand(30, 60);
    const spin = rand(0.6, 1.1);
    const drift = rand(-40, 40);
    const dur = rand(7000, 10000);
    const start = s.time.now;
    s.tweens.addCounter({
      from: 0,
      to: 1,
      duration: dur,
      onUpdate: (tw) => {
        const u = tw.getValue() ?? 0;
        const tt = (s.time.now - start) / 1000;
        leaf.setPosition(x + Math.sin(tt * spin * 2.2) * sway + u * drift, -40 + u * (vh + 80));
        // The leaf flips as it tumbles: scaleX swings through zero.
        leaf.setScale(base * Math.cos(tt * spin * 2.2), base);
        leaf.setAngle(Math.sin(tt * spin * 1.1) * 40 + tt * 12);
        leaf.setAlpha(u > 0.85 ? (1 - u) / 0.15 : 1);
      },
      onComplete: () => leaf.destroy(),
    });
  }

  private twinkle(tr: Phaser.GameObjects.Image): void {
    const s = this.host.scene;
    const star = s.add
      .image(tr.x - tr.displayWidth * rand(0.1, 0.3), tr.y - tr.displayHeight * rand(0.15, 0.3), 'star')
      .setDepth(this.host.depth.twinkle)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0)
      .setAngle(0);
    const peak = Math.max(0.35, tr.displayWidth / 120);
    s.tweens.chain({
      targets: star,
      tweens: [
        { scale: peak, angle: 45, duration: 260, ease: 'Back.easeOut' },
        { scale: 0, angle: 90, duration: 380, ease: 'Sine.easeIn', onComplete: () => star.destroy() },
      ],
    });
  }

  /** The butterflies' still images (rigs follow them; see rig.ts). */
  flierImages(): Phaser.GameObjects.Image[] {
    return this.flies.map((f) => f.img);
  }

  /** Hide everything at once (e.g. reduced motion switched on). */
  hideAll(): void {
    for (const f of this.flies) {
      f.state = 'hidden';
      f.img.setVisible(false);
    }
  }
}
