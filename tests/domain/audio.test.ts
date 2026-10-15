/**
 * Sound (docs/SOUND_PLAN.md, tools/audio/master.mjs): every line the game can
 * show has a voice clip in both languages, every file in the audio manifest
 * exists, and the downloads stay within budget.
 */
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../src/data/audioManifest.json';
import { ALL_TREASURE_IDS, GIGANTO_GENERIC, INTRO_PROMPT, ORDINARY_QUESTS, SPECIAL_QUESTS, TREASURES, TREASURE_AGAIN, VOICES } from '../../src/data/content';
import { t } from '../../src/data/i18n';
import type { Lang } from '../../src/domain/types';
import { voiceClip, voiceFiles, voiceKey, type Speaker } from '../../src/game/audio';

const ROOT = resolve(__dirname, '../..');
const LANGS: Lang[] = ['pl', 'en'];
const MB = 1e6;

type Clip = { src: string; s: number };
const clips = (o: unknown): Clip[] =>
  o && typeof o === 'object' ? ('src' in o ? [o as Clip] : Object.values(o).flatMap(clips)) : [];
const size = (list: Clip[]): number => list.reduce((n, c) => n + statSync(resolve(ROOT, 'public', c.src)).size, 0);

describe('voices', () => {
  it('every line the game can show has a clip in Polish and English', () => {
    const missing: string[] = [];
    const need = (lang: Lang, speaker: Speaker, text: string): void => {
      if (!voiceClip(lang, speaker, text)) missing.push(`${lang} ${speaker}: ${text}`);
    };
    for (const lang of LANGS) {
      for (const [who, v] of Object.entries(VOICES)) {
        for (const line of [v.hello, ...v.lines, ...v.cheers]) need(lang, who as Speaker, line[lang]);
      }
      for (const q of [...ORDINARY_QUESTS, ...SPECIAL_QUESTS]) {
        need(lang, q.characterId, q.ask[lang]);
        need(lang, 'narrator', q.prompt[lang]);
      }
      for (const id of ALL_TREASURE_IDS) {
        const name = TREASURES[id].name[lang];
        need(lang, 'giganto', GIGANTO_GENERIC.ask[lang].replace('{treasure}', name));
        // The banner as the UI writes it (the name in lower case).
        need(lang, 'narrator', t(lang, TREASURES[id].kind === 'giganto' ? 'newGigantoTreasure' : 'newTreasure', { name: name.toLocaleLowerCase(lang) }));
        need(lang, 'narrator', TREASURE_AGAIN[id][lang]);
      }
      need(lang, 'narrator', GIGANTO_GENERIC.prompt[lang]);
      need(lang, 'narrator', INTRO_PROMPT[lang]);
      need(lang, 'narrator', t(lang, 'hintReady'));
    }
    expect(missing).toEqual([]);
  });

  it('looks lines up by their words, whatever the case or spacing', () => {
    expect(voiceKey('  Nowy  skarb: Kokos! ')).toBe('nowy skarb: kokos!');
    expect(voiceClip('pl', 'narrator', 'Nowy skarb: KOKOS!')).not.toBeNull();
    expect(voiceClip('pl', 'tiny', 'Nowy skarb: kokos!')).toBeNull();
  });

  it('clips are short enough for a speech bubble (under 7 s)', () => {
    const long = clips(manifest.voice).filter((c) => c.s <= 0 || c.s > 7);
    expect(long).toEqual([]);
  });
});

describe('audio files', () => {
  it('every file in the manifest exists and has a content-hashed name', () => {
    const all = clips(manifest);
    expect(all.length).toBeGreaterThan(200);
    for (const c of all) {
      expect(existsSync(resolve(ROOT, 'public', c.src)), c.src).toBe(true);
      expect(c.src).toMatch(/-[0-9a-f]{8}\.m4a$/);
    }
  });

  it('stays within budget: effects and music ≤ 1.2 MB, voices ≤ 2.5 MB per language', () => {
    expect(size([...clips(manifest.fx), ...clips(manifest.music)])).toBeLessThan(1.2 * MB);
    for (const lang of LANGS) {
      const files = voiceFiles(lang);
      expect(files.length).toBeGreaterThan(90);
      expect(size(files.map((src) => ({ src, s: 0 })))).toBeLessThan(2.5 * MB);
    }
  });
});
