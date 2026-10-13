import { describe, expect, it } from 'vitest';
import { LEVEL_EVERY, award, isGigantoDue, levelFor, selectNextQuest, specialDifficulty, uncollected } from '../../src/domain/progress';
import { createRng } from '../../src/domain/rng';
import { defaultSave } from '../../src/storage/save';
import { GENERATOR_VERSION } from '../../src/domain/maze';
import { TREASURE_ORDER } from '../../src/data/content';
import type { SaveV1, Session } from '../../src/domain/types';

function sessionFor(_save: SaveV1, id: string, choice: ReturnType<typeof selectNextQuest>['choice']): Session {
  return {
    id,
    questId: choice.quest.id,
    seed: id,
    generatorVersion: GENERATOR_VERSION,
    difficulty: 'medium',
    effectiveDifficulty: 'medium',
    grid: { cols: 5, rows: 5 },
    intro: choice.intro,
    trail: [],
    status: 'ready',
    hintUsed: false,
    treasureId: choice.treasureId,
    characterId: choice.characterId,
    special: choice.special,
    layoutHash: `h-${id}`,
  };
}

/** Simulate a child completing `n` mazes in a row. */
function play(n: number, seed = 'play'): { save: SaveV1; log: Array<ReturnType<typeof selectNextQuest>['choice']> } {
  const rng = createRng(seed);
  let save = defaultSave();
  const log: Array<ReturnType<typeof selectNextQuest>['choice']> = [];
  for (let i = 0; i < n; i++) {
    const sel = selectNextQuest(save, rng, save.questBag);
    save = { ...save, questBag: sel.questBag };
    const id = `s${i}`;
    save = { ...save, activeSession: sessionFor(save, id, sel.choice) };
    log.push(sel.choice);
    const r = award(save, {
      sessionId: id,
      questId: sel.choice.quest.id,
      treasureId: sel.choice.treasureId,
      special: sel.choice.special,
      intro: sel.choice.intro,
      layoutHash: `h-${id}`,
      now: new Date(2026, 9, 12).toISOString(),
    });
    expect(r.awarded).toBe(true);
    save = r.save;
  }
  return { save, log };
}

describe('quest selection', () => {
  it('starts with the Bill and coconut introduction', () => {
    const sel = selectNextQuest(defaultSave(), createRng('x'), []);
    expect(sel.choice.intro).toBe(true);
    expect(sel.choice.quest.id).toBe('bill-coconut');
  });

  it('collects all six treasures before repeating any', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const { log } = play(6, seed);
      expect(new Set(log.map((c) => c.treasureId)).size).toBe(6);
    }
  });

  it('never repeats the same quest immediately', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const { log } = play(60, seed);
      for (let i = 1; i < log.length; i++) expect(log[i]!.quest.id).not.toBe(log[i - 1]!.quest.id);
    }
  });

  it('offers every ordinary quest over a long run', () => {
    const { log } = play(80, 'variety');
    const ids = new Set(log.filter((c) => !c.special).map((c) => c.quest.id));
    expect(ids.size).toBe(12);
  });

  it('first Giganto quest is maze six, then one after every four ordinary', () => {
    const { log } = play(26, 'cadence');
    const specials = log.map((c, i) => (c.special ? i + 1 : 0)).filter(Boolean);
    expect(specials).toEqual([6, 11, 16, 21, 26]);
  });

  it('Giganto keeps the uncollected-treasure-first rule with a pictured generic quest', () => {
    const rng = createRng('generic');
    const save: SaveV1 = {
      ...defaultSave(),
      introDone: true,
      ordinaryCompletionsSinceGiganto: 5,
      collection: { coconut: { count: 2, firstFoundAt: 'x' }, berries: { count: 1, firstFoundAt: 'x' }, nut: { count: 1, firstFoundAt: 'x' } },
    };
    const sel = selectNextQuest(save, rng, []);
    expect(sel.choice.special).toBe(true);
    expect(sel.choice.promptKey).toBe('giganto-generic');
    expect(uncollected(save)).toContain(sel.choice.treasureId);
  });

  it('special difficulty steps up one level and is capped', () => {
    expect(specialDifficulty('medium')).toBe('medium-plus');
    expect(specialDifficulty('medium-plus')).toBe('harder');
    expect(specialDifficulty('hard')).toBe('expert');
    expect(specialDifficulty('expert')).toBe('expert');
  });
});

describe('award', () => {
  it('is idempotent per session and restricted to the active unsolved session', () => {
    let save = defaultSave();
    const rng = createRng('idem');
    const sel = selectNextQuest(save, rng, []);
    save = { ...save, activeSession: sessionFor(save, 'one', sel.choice) };
    const input = {
      sessionId: 'one',
      questId: sel.choice.quest.id,
      treasureId: sel.choice.treasureId,
      special: false,
      intro: true,
      layoutHash: 'h',
      now: 'now',
    };
    const first = award(save, input);
    expect(first.awarded).toBe(true);
    expect(first.firstFind).toBe(true);
    expect(first.save.collection.coconut?.count).toBe(1);
    // Double callback / reload during celebration.
    const again = award(first.save, input);
    expect(again.awarded).toBe(false);
    expect(again.save.collection.coconut?.count).toBe(1);
    // A stale session id cannot award.
    expect(award(first.save, { ...input, sessionId: 'other' }).awarded).toBe(false);
  });

  it('repeat finds increase the count without a disappointment state', () => {
    const { save } = play(12, 'repeat');
    const total = TREASURE_ORDER.reduce((s, t) => s + (save.collection[t]?.count ?? 0), 0);
    expect(total).toBe(12);
    expect(uncollected(save)).toHaveLength(0);
  });

  it('cadence counters only advance on unique completions', () => {
    const { save } = play(5, 'counter');
    expect(save.ordinaryCompletionsSinceGiganto).toBe(5);
    expect(isGigantoDue(save)).toBe(true);
    expect(save.gigantoUnlocked).toBe(true);
  });
});

describe('automatic difficulty', () => {
  it('starts generated mazes at medium and steps up every few completions, capped', () => {
    const at = (total: number): string => levelFor({ totalCompleted: total, introDone: total > 0 });
    expect(levelFor({ totalCompleted: 0, introDone: false })).toBe('medium');
    expect(at(1)).toBe('medium'); // only the tutorial done
    expect(at(1 + LEVEL_EVERY - 1)).toBe('medium');
    expect(at(1 + LEVEL_EVERY)).toBe('medium-plus');
    expect(at(1 + 2 * LEVEL_EVERY)).toBe('harder');
    expect(at(1 + 3 * LEVEL_EVERY)).toBe('hard');
    expect(at(1 + 4 * LEVEL_EVERY)).toBe('expert');
    expect(at(500)).toBe('expert');
  });
});
