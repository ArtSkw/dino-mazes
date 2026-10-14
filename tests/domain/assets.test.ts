/**
 * Runtime art (tools/art/v3.py): every animation frame the game asks for exists
 * in the atlas it is looked up in, atlases respect the 2048 px edge, and the
 * per-screen GPU memory estimate stays within PRD §9 (96 MiB).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../src/data/assetManifest.json';

type Atlas = { textures: Array<{ image: string; size: { w: number; h: number }; frames: Array<{ filename: string; trimmed: boolean; sourceSize: { w: number; h: number }; frame: { w: number; h: number } }> }> };
const ROOT = resolve(__dirname, '../..');
const atlas = (path: string): Atlas => JSON.parse(readFileSync(resolve(ROOT, 'public', path), 'utf8')) as Atlas;
const names = (a: Atlas): Set<string> => new Set(a.textures.flatMap((t) => t.frames.map((f) => f.filename)));
const MiB = 2 ** 20;
const chars = manifest.characters as Record<string, {
  atlases: Record<'idle' | 'wave' | 'more' | 'stage', string>;
  decodedBytes: Record<'idle' | 'wave' | 'more' | 'stage', number>;
  frameWidth: number;
  frameHeight: number;
  stage: { frameWidth: number; frameHeight: number };
  sequences: Record<string, string[]>;
  stageSequences: Record<string, string[]>;
}>;

describe('character atlases (V3)', () => {
  for (const [id, c] of Object.entries(chars)) {
    it(`${id}: every sequence frame is in the atlas it is looked up in, at the shared frame size`, () => {
      const groupOf = (f: string): 'idle' | 'wave' | 'more' => (f.startsWith('idle-') ? 'idle' : f.startsWith('encouragement-') ? 'wave' : 'more');
      const corner = { idle: atlas(c.atlases.idle), wave: atlas(c.atlases.wave), more: atlas(c.atlases.more) };
      for (const [seq, frames] of Object.entries(c.sequences)) {
        expect(frames.length, seq).toBe(seq === 'talk' ? 4 : 8);
        for (const f of frames) expect(names(corner[groupOf(f)]).has(f), `${seq} ${f}`).toBe(true);
      }
      const stage = atlas(c.atlases.stage);
      for (const f of Object.values(c.stageSequences).flat()) expect(names(stage).has(f), f).toBe(true);
      for (const [a, size] of [
        [corner.idle, c],
        [corner.wave, c],
        [corner.more, c],
        [stage, c.stage],
      ] as const) {
        for (const t of a.textures) {
          expect(t.size.w).toBeLessThanOrEqual(2048);
          expect(t.size.h).toBeLessThanOrEqual(2048);
          for (const f of t.frames) {
            expect(f.trimmed).toBe(true);
            expect(f.sourceSize).toEqual({ w: size.frameWidth, h: size.frameHeight });
          }
        }
      }
    });
  }

  it('intro atlases hold the frames the opening plays', () => {
    const intro = manifest.intro;
    expect([...names(atlas(intro.gigantoPeek.atlas))].sort()).toEqual(intro.gigantoPeek.frames.slice().sort());
    expect(names(atlas(intro.popups.atlas)).size).toBe(16);
    for (const f of ['bill', 'tiny', 'mazu', 'rocky'].flatMap((id) => [0, 1, 2, 3].map((i) => `${id}-${i}`))) expect(names(atlas(intro.popups.atlas)).has(f), f).toBe(true);
    expect([...names(atlas(intro.dust.atlas))].sort()).toEqual(intro.dust.frames.slice().sort());
  });
});

describe('GPU memory per screen (PRD §9: ≤ 96 MiB)', () => {
  const img = (v: { width: number; height: number }): number => v.width * v.height * 4;
  // Phaser textures that live for the whole session (the collection backdrop is DOM).
  const baseline =
    img(manifest.backgrounds.jungle) +
    img(manifest.backgrounds.ground) +
    Object.values(manifest.foliage).reduce((a, v) => a + img(v), 0) +
    Object.values(manifest.treasures).reduce((a, v) => a + img(v), 0) +
    // The treasures' painted parts (one atlas, loaded at boot).
    ((manifest as { treasureRigs?: { decodedBytes?: number } }).treasureRigs?.decodedBytes ?? 0);
  const BOARD = 2048 * 2048 * 4; // painted maze texture, capped at 2048 px
  const ids = Object.keys(chars);
  const sum = (id: string, groups: Array<'idle' | 'wave' | 'more' | 'stage'>): number => groups.reduce((a, g) => a + (chars[id]?.decodedBytes[g] ?? 0), 0);

  it('welcome with the full opening playing', () => {
    const cast = ids.reduce((a, id) => a + sum(id, ['idle']), 0);
    const intro = manifest.intro;
    const opening = intro.gigantoPeek.decodedBytes + intro.popups.decodedBytes + intro.dust.decodedBytes + img(intro.lightShafts);
    expect((baseline + cast + opening) / MiB).toBeLessThanOrEqual(96);
  });

  it('quest intro (stage pose + corner idle for the reveal), worst friend', () => {
    const worst = Math.max(...ids.map((id) => sum(id, ['stage', 'idle'])));
    expect((baseline + BOARD + worst) / MiB).toBeLessThanOrEqual(96);
  });

  it('play and reward (full corner set), worst friend', () => {
    const worst = Math.max(...ids.map((id) => sum(id, ['idle', 'wave', 'more'])));
    expect((baseline + BOARD + worst) / MiB).toBeLessThanOrEqual(96);
  });
});
