/**
 * A friend's reactive animation (DEVELOPMENT_PLAN.md §5.5) on the V3 atlases.
 *
 * Priority: celebration > encouragement/talk > drawing reaction > idle.
 * Drawing reactions at most every 6 s, encouragement at most every 4 s.
 * Reactions respond to effort and events only, never to route correctness.
 * Reduced motion shows one static expression per state.
 *
 * Two tiers share one logical frame: `corner` (play, welcome cast; 8 frames
 * per reaction, frame rates doubled from the old 4-frame sheets so durations
 * stay the same) and `stage` (the large quest-intro pose; key poses only).
 * A reaction whose atlas is not loaded yet is loaded first, then played if it
 * is still wanted.
 */
import type Phaser from 'phaser';
import type { CharacterId } from '../domain/types';
import { ASSETS, type Reaction } from './assets';
import { atlasKey, cornerGroupOf, type CharacterTextures } from './characterTextures';

export type { Reaction };
export type Tier = 'corner' | 'stage';

const PRIORITY: Record<Reaction, number> = { idle: 0, drawing: 1, talk: 2, encouragement: 2, celebration: 3 };
const COOLDOWN: Partial<Record<Reaction, number>> = { drawing: 6000, encouragement: 4000 };
const FPS: Record<Reaction, number> = { idle: 7, drawing: 11, encouragement: 11, celebration: 14, talk: 9 };
const STAGE_FPS: Partial<Record<Reaction, number>> = { idle: 3.5, encouragement: 9 };
/** Static expressions for reduced motion (and the rest pose after a celebration). */
const STATIC_FRAME: Record<Reaction, string> = {
  idle: 'idle-00',
  drawing: 'drawing-08',
  encouragement: 'encouragement-19',
  celebration: 'celebration-28',
  talk: 'talk-34',
};
const STAGE_STATIC: Partial<Record<Reaction, string>> = { idle: 'idle-00', encouragement: 'encouragement-19' };
/** Mouth poses while the speech bubble is visible: opens and closes, ends shut. */
const TALK_ORDER = ['talk-32', 'talk-33', 'talk-34', 'talk-33', 'talk-35', 'talk-33', 'talk-32'];

export class CharacterActor {
  readonly id: CharacterId;
  readonly sprite: Phaser.GameObjects.Sprite;
  private scene: Phaser.Scene;
  private textures: CharacterTextures;
  private reduced: boolean;
  private tier: Tier;
  private current: Reaction = 'idle';
  private busy = false;
  private destroyed = false;
  private nextIdleAt = 0;
  private last: Partial<Record<Reaction, number>> = {};
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private talkUntil = 0;

  constructor(scene: Phaser.Scene, id: CharacterId, reduced: boolean, textures: CharacterTextures, tier: Tier = 'corner') {
    this.scene = scene;
    this.id = id;
    this.reduced = reduced;
    this.textures = textures;
    this.tier = tier;
    this.sprite = scene.add.sprite(0, 0, this.keyFor('idle-00'), 'idle-00');
    this.sprite.setOrigin(ASSETS.characters[id].pivot.x, 1);
    this.sprite.on('animationcomplete', () => this.onComplete());
    this.scheduleIdle(scene.time.now, true);
  }

  get frameWidth(): number {
    const c = ASSETS.characters[this.id];
    return this.tier === 'stage' ? c.stage.frameWidth : c.frameWidth;
  }

  get frameHeight(): number {
    const c = ASSETS.characters[this.id];
    return this.tier === 'stage' ? c.stage.frameHeight : c.frameHeight;
  }

  get currentTier(): Tier {
    return this.tier;
  }

  /** Switch resolution tier (e.g. the quest-intro pose shrinking into the corner). */
  setTier(tier: Tier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.holdTimer?.remove();
    this.holdTimer = null;
    this.sprite.stop();
    this.current = 'idle';
    this.busy = false;
    this.sprite.setTexture(this.keyFor('idle-00'), 'idle-00');
    this.scheduleIdle(this.scene.time.now);
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced;
    if (reduced) {
      this.sprite.stop();
      this.showStatic(this.current);
    }
  }

  /** Request a reaction; respects priority and cooldowns. Returns true if it plays (or will, once loaded). */
  react(kind: Reaction, force = false): boolean {
    if (this.destroyed) return false;
    const now = this.scene.time.now;
    if (!force) {
      if (this.busy && PRIORITY[this.current] > PRIORITY[kind]) return false;
      const cd = COOLDOWN[kind];
      if (cd !== undefined && now - (this.last[kind] ?? -Infinity) < cd) return false;
    }
    if (this.tier === 'stage' && !ASSETS.characters[this.id].stageSequences[kind as 'idle' | 'encouragement']) return false;
    this.last[kind] = now;
    const group = this.tier === 'stage' ? 'stage' : cornerGroupOf(this.frames(kind)[0] as string);
    if (!this.textures.has(this.id, group)) {
      void this.textures.ensure([[this.id, group]]).then(() => {
        if (!this.destroyed && this.textures.has(this.id, group)) this.start(kind);
      });
      return true;
    }
    this.start(kind);
    return true;
  }

  /** Mouth poses for about `ms` while the speech bubble is up (corner tier). */
  talk(ms: number): void {
    if (this.tier !== 'corner') return;
    this.talkUntil = this.scene.time.now + ms;
    this.react('talk', true);
  }

  private frames(kind: Reaction): string[] {
    const c = ASSETS.characters[this.id];
    if (this.tier === 'stage') return c.stageSequences[kind as 'idle' | 'encouragement'] ?? c.stageSequences.idle;
    return kind === 'talk' ? TALK_ORDER : c.sequences[kind];
  }

  private keyFor(frame: string): string {
    return atlasKey(this.id, this.tier === 'stage' ? 'stage' : cornerGroupOf(frame));
  }

  private animKey(kind: Reaction): string {
    return `${this.id}-${this.tier}-${kind}`;
  }

  private ensureAnim(kind: Reaction): string | null {
    const key = this.animKey(kind);
    if (this.scene.anims.exists(key)) return key;
    const frames = this.frames(kind);
    if (!frames.every((f) => this.scene.textures.exists(this.keyFor(f)))) return null;
    const rate = this.tier === 'stage' ? (STAGE_FPS[kind] ?? FPS[kind]) : FPS[kind];
    this.scene.anims.create({
      key,
      frames: frames.map((frame) => ({ key: this.keyFor(frame), frame })),
      frameRate: rate,
      repeat: kind === 'celebration' ? 1 : 0,
    });
    for (const f of new Set(frames.map((frame) => this.keyFor(frame)))) this.textures.noteAnimation(f, key);
    return key;
  }

  private showStatic(kind: Reaction): void {
    const frame = this.tier === 'stage' ? (STAGE_STATIC[kind] ?? 'idle-00') : STATIC_FRAME[kind];
    const key = this.keyFor(frame);
    if (this.scene.textures.exists(key)) this.sprite.setTexture(key, frame);
  }

  private start(kind: Reaction): void {
    if (this.destroyed || !this.sprite.active) return;
    this.holdTimer?.remove();
    this.holdTimer = null;
    this.current = kind;
    this.busy = kind !== 'idle';
    if (this.reduced) {
      this.sprite.stop();
      this.showStatic(kind);
      if (kind !== 'idle') {
        const hold = kind === 'celebration' ? 2600 : kind === 'talk' ? Math.max(800, this.talkUntil - this.scene.time.now) : 1400;
        this.holdTimer = this.scene.time.delayedCall(hold, () => this.toIdle());
      }
      return;
    }
    const anim = this.ensureAnim(kind);
    if (!anim) {
      this.toIdle();
      return;
    }
    this.sprite.play(anim);
  }

  private onComplete(): void {
    if (this.destroyed) return;
    if (this.current === 'talk' && this.scene.time.now < this.talkUntil) {
      this.start('talk');
      return;
    }
    if (this.current === 'celebration') {
      // Hold a content, settled smile for a moment before relaxing.
      const key = this.keyFor('celebration-31');
      if (this.scene.textures.exists(key)) this.sprite.setTexture(key, 'celebration-31');
      this.holdTimer = this.scene.time.delayedCall(2200, () => this.toIdle());
      return;
    }
    this.toIdle();
  }

  private toIdle(): void {
    this.holdTimer = null;
    if (this.destroyed || !this.sprite.active) return;
    this.current = 'idle';
    this.busy = false;
    const key = this.keyFor('idle-00');
    if (this.scene.textures.exists(key)) this.sprite.setTexture(key, 'idle-00');
    this.scheduleIdle(this.scene.time.now);
  }

  private scheduleIdle(now: number, first = false): void {
    this.nextIdleAt = now + (first ? Math.random() * 2500 + 600 : 2000 + Math.random() * 2000);
  }

  update(now: number): void {
    if (this.destroyed || this.reduced || this.busy || this.current !== 'idle') return;
    if (now >= this.nextIdleAt && !this.sprite.anims.isPlaying) {
      const anim = this.ensureAnim('idle');
      if (anim) this.sprite.play(anim);
      this.nextIdleAt = Infinity;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.holdTimer?.remove();
    this.sprite.destroy();
  }
}
