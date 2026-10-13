import { describe, expect, it } from 'vitest';
import { STRINGS } from '../../src/data/i18n';
import { ALL_QUESTS, CHARACTERS, FRIEND_LINES, KIND_LINES, TREASURES, INTRO_PROMPT } from '../../src/data/content';

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
    const pl = [...ALL_QUESTS.map((q) => q.prompt.pl), INTRO_PROMPT.pl, ...Object.values(FRIEND_LINES).flat().map((l) => l.pl)].join(' ');
    for (const name of ['Bill', 'Tiny', 'Mazu', 'Rocky']) expect(pl).not.toContain(name);
  });

  it('every companion line exists in both languages', () => {
    for (const l of [...Object.values(FRIEND_LINES).flat(), ...KIND_LINES]) {
      expect(l.pl.trim()).not.toBe('');
      expect(l.en.trim()).not.toBe('');
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
