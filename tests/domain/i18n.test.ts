import { describe, expect, it } from 'vitest';
import { STRINGS } from '../../src/data/i18n';
import { ALL_QUESTS, CHARACTERS, INTRO_PROMPT, TREASURES, TREASURE_AGAIN, VOICES } from '../../src/data/content';
import type { Localized } from '../../src/domain/types';

const voiceLines = (): Localized[] => Object.values(VOICES).flatMap((v) => [v.hello, ...v.lines, ...v.cheers]);
const bubbleLines = (): Localized[] => [...voiceLines(), ...ALL_QUESTS.map((q) => q.ask)];

describe('translations', () => {
  it('every UI string exists and is non-empty in Polish and English', () => {
    for (const [key, v] of Object.entries(STRINGS)) {
      expect(v.pl.trim(), key).not.toBe('');
      expect(v.en.trim(), key).not.toBe('');
    }
  });

  it('every quest and treasure has both languages', () => {
    for (const q of ALL_QUESTS) {
      expect(q.prompt.pl.trim(), q.id).not.toBe('');
      expect(q.prompt.en.trim(), q.id).not.toBe('');
    }
    for (const t of Object.values(TREASURES)) {
      expect(t.name.pl).not.toBe('');
      expect(t.name.en).not.toBe('');
    }
    expect(INTRO_PROMPT.pl).toContain('Dudek');
    expect(INTRO_PROMPT.en).toContain('Bill');
  });

  it('friends use the Polish dub names in Polish (Wikipedia: Gigantozaur, wersja polska)', () => {
    expect(CHARACTERS.bill.name).toEqual({ pl: 'Dudek', en: 'Bill' });
    expect(CHARACTERS.tiny.name).toEqual({ pl: 'Miłka', en: 'Tiny' });
    expect(CHARACTERS.mazu.name).toEqual({ pl: 'Rudzia', en: 'Mazu' });
    expect(CHARACTERS.rocky.name).toEqual({ pl: 'Czupur', en: 'Rocky' });
    expect(CHARACTERS.giganto.name).toEqual({ pl: 'Giganto', en: 'Giganto' });
    // No English name leaks into Polish text.
    const pl = [...ALL_QUESTS.map((q) => q.prompt.pl), INTRO_PROMPT.pl, ...bubbleLines().map((l) => l.pl)].join(' ');
    for (const name of ['Bill', 'Tiny', 'Mazu', 'Rocky']) expect(pl).not.toContain(name);
  });

  it('every companion line exists in both languages', () => {
    for (const l of [...bubbleLines(), ...Object.values(TREASURE_AGAIN)]) {
      expect(l.pl.trim()).not.toBe('');
      expect(l.en.trim()).not.toBe('');
    }
  });

  it('every friend has its own hello, little things about itself and its own cheers', () => {
    for (const [id, v] of Object.entries(VOICES)) {
      expect(v.lines.length, id).toBeGreaterThanOrEqual(3);
      expect(v.cheers.length, id).toBeGreaterThanOrEqual(2);
    }
    // Each regular friend introduces itself by its own name.
    for (const id of ['bill', 'tiny', 'mazu', 'rocky'] as const) {
      expect(VOICES[id].hello.pl).toContain(CHARACTERS[id].name.pl);
      expect(VOICES[id].hello.en).toContain(CHARACTERS[id].name.en);
    }
  });

  it('bubbles and quest cards stay short (two short sentences at most)', () => {
    for (const l of bubbleLines()) for (const s of [l.pl, l.en]) expect(s.length, s).toBeLessThanOrEqual(72);
    for (const q of ALL_QUESTS) for (const s of [q.prompt.pl, q.prompt.en]) expect(s.length, s).toBeLessThanOrEqual(80);
  });

  it('Polish never uses gendered past forms for the child (zrobiłeś / zrobiłaś)', () => {
    const pl = [...bubbleLines().map((l) => l.pl), ...ALL_QUESTS.map((q) => q.prompt.pl), ...Object.values(STRINGS).map((v) => v.pl)];
    for (const s of pl) expect(s, s).not.toMatch(/\p{L}+(łeś|łaś)(?!\p{L})/u);
  });

  it('nothing a friend says judges the route (PRD §4.3)', () => {
    for (const l of bubbleLines()) {
      expect(l.pl, l.pl).not.toMatch(/(?<!\p{L})(dobrze|źle|dobra droga|zła droga|pomyłka)(?!\p{L})/iu);
      expect(l.en, l.en).not.toMatch(/\b(right|wrong|correct|mistake)\b/i);
    }
  });

  it('lines match the art: Miłka / Tiny never counts three horns (she has two)', () => {
    for (const l of [...VOICES.tiny.lines, VOICES.tiny.hello, ...VOICES.tiny.cheers]) {
      expect(l.pl).not.toMatch(/trzy rogi/i);
      expect(l.en).not.toMatch(/three horns/i);
    }
  });

  it('Polish strings use real Polish characters (font must cover latin-ext)', () => {
    const all = Object.values(STRINGS).map((v) => v.pl).join(' ') + ALL_QUESTS.map((q) => q.prompt.pl).join(' ');
    for (const ch of ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż']) expect(all).toContain(ch);
  });

  it('the reset button is never labelled merely "Back"', () => {
    expect(STRINGS.startOver.en).toBe('Start over');
    expect(STRINGS.startOver.pl).toBe('Wróć');
    expect(STRINGS.startOverA11y.pl).toBe('Wyczyść ścieżkę i wróć na początek');
  });
});
