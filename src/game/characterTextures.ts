/**
 * Loads and releases the V3 character atlases on demand (art/CLAUDE_HANDOFF_V3.md
 * §4), so GPU memory stays within PRD §9's 96 MiB:
 *
 *   welcome  every friend's corner `idle` (a tap adds that friend's `wave`)
 *   intro    the host's `stage` key poses + corner `idle` (for the reveal)
 *   play     the host's corner `idle`, `wave` and `more`
 *
 * Textures are removed only when no live game object uses them, and the
 * animations built from a removed atlas are removed with it.
 */
import type Phaser from 'phaser';
import type { CharacterId } from '../domain/types';
import { ASSETS, assetUrl, type AtlasGroup } from './assets';

export const atlasKey = (id: CharacterId, group: AtlasGroup): string => `char-${id}-${group}`;

/** Corner-tier group that holds a frame name. */
export function cornerGroupOf(frame: string): Exclude<AtlasGroup, 'stage'> {
  if (frame.startsWith('idle-')) return 'idle';
  if (frame.startsWith('encouragement-')) return 'wave';
  return 'more';
}

export type AtlasRef = readonly [CharacterId, AtlasGroup];

export class CharacterTextures {
  private scene: Phaser.Scene;
  private queue: Promise<void> = Promise.resolve();
  /** Animation keys built from each atlas key. */
  private animsOf = new Map<string, Set<string>>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  has(id: CharacterId, group: AtlasGroup): boolean {
    return this.scene.textures.exists(atlasKey(id, group));
  }

  /** Queue the atlases for the scene loader's preload phase (boot only). */
  preload(refs: readonly AtlasRef[]): void {
    for (const [id, group] of refs) this.addToLoader(id, group);
  }

  /** Load whatever is missing; resolves when all are available. Serialised. */
  ensure(refs: readonly AtlasRef[]): Promise<void> {
    this.queue = this.queue.then(
      () =>
        new Promise<void>((resolve) => {
          const missing = refs.filter(([id, group]) => !this.has(id, group));
          if (missing.length === 0) {
            resolve();
            return;
          }
          const load = this.scene.load;
          for (const [id, group] of missing) this.addToLoader(id, group);
          load.once('complete', () => resolve());
          load.start();
        }),
    );
    return this.queue;
  }

  /** Remember that an animation was built from an atlas (removed together). */
  noteAnimation(textureKey: string, animKey: string): void {
    const set = this.animsOf.get(textureKey) ?? new Set<string>();
    set.add(animKey);
    this.animsOf.set(textureKey, set);
  }

  /** Remove atlases not in `keep` and not used by any live game object. */
  releaseExcept(keep: readonly AtlasRef[]): void {
    const wanted = new Set(keep.map(([id, group]) => atlasKey(id, group)));
    const inUse = new Set<string>();
    for (const obj of this.scene.children.list) {
      const tex = (obj as Phaser.GameObjects.Sprite).texture;
      if (tex) inUse.add(tex.key);
    }
    for (const key of this.scene.textures.getTextureKeys()) {
      if (!key.startsWith('char-') || wanted.has(key) || inUse.has(key)) continue;
      for (const anim of this.animsOf.get(key) ?? []) this.scene.anims.remove(anim);
      this.animsOf.delete(key);
      this.scene.textures.remove(key);
    }
  }

  private addToLoader(id: CharacterId, group: AtlasGroup): void {
    const json = ASSETS.characters[id].atlases[group];
    const dir = json.slice(0, json.lastIndexOf('/') + 1);
    this.scene.load.multiatlas(atlasKey(id, group), assetUrl(json), assetUrl(dir));
  }
}
