/**
 * A corner companion's reactive animation (DEVELOPMENT_PLAN.md §5.5).
 *
 * Priority: celebration > encouragement > drawing reaction > idle.
 * Drawing reactions at most every 6 s, encouragement at most every 4 s.
 * Reactions respond to effort and events only, never to route correctness.
 * Reduced motion shows one static expression per state.
 */
import Phaser from 'phaser';
import { ASSETS } from './assets';
import type { CharacterId } from '../domain/types';

export type Reaction = 'idle' | 'drawing' | 'encouragement' | 'celebration';

const PRIORITY: Record<Reaction, number> = { idle: 0, drawing: 1, encouragement: 2, celebration: 3 };
const COOLDOWN: Partial<Record<Reaction, number>> = { drawing: 6000, encouragement: 4000 };
const FPS: Record<Reaction, number> = { idle: 3.5, drawing: 5.5, encouragement: 5.5, celebration: 7 };
/** Approved static expressions for reduced motion. */
const STATIC_FRAME: Record<Reaction, number> = { idle: 0, drawing: 4, encouragement: 8, celebration: 12 };

export function sheetKey(id: CharacterId): string {
  return `char-${id}`;
}

export function registerAnimations(scene: Phaser.Scene, id: CharacterId): void {
  const meta = ASSETS.characters[id];
  for (const [name, frames] of Object.entries(meta.sequences) as Array<[Reaction, number[]]>) {
    const key = `${id}-${name}`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(sheetKey(id), { frames }),
      frameRate: FPS[name],
      repeat: name === 'celebration' ? 1 : 0,
    });
  }
}

export class CharacterActor {
  readonly id: CharacterId;
  readonly sprite: Phaser.GameObjects.Sprite;
  private scene: Phaser.Scene;
  private reduced: boolean;
  private current: Reaction = 'idle';
  private busy = false;
  private nextIdleAt = 0;
  private last: Partial<Record<Reaction, number>> = {};
  private holdTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, id: CharacterId, reduced: boolean) {
    this.scene = scene;
    this.id = id;
    this.reduced = reduced;
    registerAnimations(scene, id);
    this.sprite = scene.add.sprite(0, 0, sheetKey(id), 0);
    const meta = ASSETS.characters[id];
    this.sprite.setOrigin(meta.pivot.x, 1);
    this.sprite.on('animationcomplete', () => this.onComplete());
    this.scheduleIdle(scene.time.now, true);
  }

  get frameWidth(): number {
    return ASSETS.characters[this.id].frameWidth;
  }

  get frameHeight(): number {
    return ASSETS.characters[this.id].frameHeight;
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced;
    if (reduced) {
      this.sprite.stop();
      this.sprite.setFrame(STATIC_FRAME[this.current]);
    }
  }

  /** Request a reaction; respects priority and cooldowns. Returns true if it plays. */
  react(kind: Reaction, force = false): boolean {
    const now = this.scene.time.now;
    if (!force) {
      if (this.busy && PRIORITY[this.current] > PRIORITY[kind]) return false;
      const cd = COOLDOWN[kind];
      if (cd !== undefined && now - (this.last[kind] ?? -Infinity) < cd) return false;
    }
    this.last[kind] = now;
    this.start(kind);
    return true;
  }

  private start(kind: Reaction): void {
    // A delayed reaction may arrive after the actor left the stage.
    if (!this.sprite.active) return;
    this.holdTimer?.remove();
    this.holdTimer = null;
    this.current = kind;
    this.busy = kind !== 'idle';
    if (this.reduced) {
      this.sprite.stop();
      this.sprite.setFrame(STATIC_FRAME[kind]);
      if (kind !== 'idle') {
        this.holdTimer = this.scene.time.delayedCall(kind === 'celebration' ? 2600 : 1400, () => this.toIdle());
      }
      return;
    }
    this.sprite.play(`${this.id}-${kind}`);
  }

  private onComplete(): void {
    if (this.current === 'celebration') {
      // Hold the happy face for a moment before relaxing.
      this.sprite.setFrame(12);
      this.holdTimer = this.scene.time.delayedCall(2200, () => this.toIdle());
      return;
    }
    this.toIdle();
  }

  private toIdle(): void {
    this.holdTimer = null;
    if (!this.sprite.active) return;
    this.current = 'idle';
    this.busy = false;
    this.sprite.setFrame(0);
    this.scheduleIdle(this.scene.time.now);
  }

  private scheduleIdle(now: number, first = false): void {
    this.nextIdleAt = now + (first ? Math.random() * 2500 + 600 : 2000 + Math.random() * 2000);
  }

  update(now: number): void {
    if (this.reduced || this.busy || this.current !== 'idle') return;
    if (now >= this.nextIdleAt && !this.sprite.anims.isPlaying) {
      this.sprite.play(`${this.id}-idle`);
      this.nextIdleAt = Infinity;
    }
  }

  destroy(): void {
    this.holdTimer?.remove();
    this.sprite.destroy();
  }
}
