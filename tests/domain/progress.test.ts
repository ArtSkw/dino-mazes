import { describe, expect, it } from 'vitest';
import { LEVEL_EVERY, award, isGigantoDue, levelFor, selectNextQuest, specialDifficulty, uncollected, type TreasureReady } from '../../src/domain/progress';
import { createRng } from '../../src/domain/rng';
import { defaultSave } from '../../src/storage/save';
import { GENERATOR_VERSION } from '../../src/domain/maze';
import { ALL_TREASURE_IDS, GIGANTO_TREASURE_ORDER, ORDINARY_QUESTS, TREASURES, TREASURE_ORDER, treasureHasArt } from '../../src/data/content';
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

/** Every treasure has art (the game since Codex delivered the new four). */
const ALL_READY: TreasureReady = () => true;
/** Only the six original treasures have art (the game before that delivery). */
const ORIGINAL_SIX: TreasureReady = (id) => ['coconut', 'nut', 'flower', 'stone', 'shell', 'berries'].includes(id);

/** Simulate a child completing `n` mazes in a row. */
function play(n: number, seed = 'play', ready: TreasureReady = treasureHasArt): { save: SaveV1; log: Array<ReturnType<typeof selectNextQuest>['choice']> } {
  const rng = createRng(seed);
  let save = defaultSave();
  const log: Array<ReturnType<typeof selectNextQuest>['choice']> = [];
  for (let i = 0; i < n; i++) {
    const sel = selectNextQuest(save, rng, save.questBag, ready);
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

  it('offers every ordinary quest whose treasure has art over a long run', () => {
    const { log } = play(80, 'variety');
    const ids = new Set(log.filter((c) => !c.special).map((c) => c.quest.id));
    expect(ids.size).toBe(ORDINARY_QUESTS.filter((q) => treasureHasArt(q.treasureId)).length);
    expect(new Set(play(80, 'variety', ORIGINAL_SIX).log.filter((c) => !c.special).map((c) => c.quest.id)).size).toBe(12);
  });

  it('first Giganto quest is maze six, then one after every four ordinary', () => {
    const { log } = play(26, 'cadence');
    const specials = log.map((c, i) => (c.special ? i + 1 : 0)).filter(Boolean);
    expect(specials).toEqual([6, 11, 16, 21, 26]);
  });

  it("until his own treasures have art, Giganto keeps the uncollected-first rule with a pictured generic quest", () => {
    const rng = createRng('generic');
    const save: SaveV1 = {
      ...defaultSave(),
      introDone: true,
      ordinaryCompletionsSinceGiganto: 5,
      collection: { coconut: { count: 2, firstFoundAt: 'x' }, berries: { count: 1, firstFoundAt: 'x' }, nut: { count: 1, firstFoundAt: 'x' } },
    };
    const sel = selectNextQuest(save, rng, [], ORIGINAL_SIX);
    expect(sel.choice.special).toBe(true);
    expect(sel.choice.promptKey).toBe('giganto-generic');
    expect(uncollected(save, ['coconut', 'nut', 'flower', 'stone', 'shell', 'berries'])).toContain(sel.choice.treasureId);
  });

  it('treasures without art never appear', () => {
    const { log } = play(80, 'art-gate');
    for (const c of log) expect(treasureHasArt(c.treasureId), c.treasureId).toBe(true);
    for (const c of play(40, 'art-gate', ORIGINAL_SIX).log) expect(ORIGINAL_SIX(c.treasureId), c.treasureId).toBe(true);
  });

  it('all eleven treasures have art (Codex deliveries, 14 and 15 Oct 2026)', () => {
    for (const id of ALL_TREASURE_IDS) expect(treasureHasArt(id), id).toBe(true);
    expect(TREASURES.amber.kind).toBe('giganto');
  });

  describe('with all eleven treasures in the game', () => {
    it('friends bring the eight classic treasures before any repeats; Giganto only his own', () => {
      for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
        const { log } = play(30, seed, ALL_READY);
        const ordinary = log.filter((c) => !c.special).map((c) => c.treasureId);
        expect(new Set(ordinary.slice(0, 8)).size, seed).toBe(8);
        for (const t of ordinary) expect(TREASURES[t].kind).toBe('classic');
        const giganto = log.filter((c) => c.special).map((c) => c.treasureId);
        for (const t of giganto) expect(GIGANTO_TREASURE_ORDER).toContain(t);
      }
    });

    it("Giganto's first three quests bring his three different treasures", () => {
      for (const seed of ['a', 'b', 'c', 'd']) {
        const { log } = play(16, seed, ALL_READY);
        const giganto = log.filter((c) => c.special).map((c) => c.treasureId);
        expect(giganto.length).toBe(3);
        expect(new Set(giganto).size, seed).toBe(3);
      }
    });

    it('offers all sixteen ordinary quests over a long run, feather and strawberry ones included', () => {
      const { log } = play(140, 'variety-10', ALL_READY);
      const ids = new Set(log.filter((c) => !c.special).map((c) => c.quest.id));
      expect(ids.size).toBe(16);
      for (const q of ['tiny-feather', 'rocky-feather', 'bill-strawberry', 'mazu-strawberry']) expect(ids.has(q), q).toBe(true);
    });

    it('eight classic treasures (4 + 4 in the collection) and three of Giganto', () => {
      expect(TREASURE_ORDER).toHaveLength(8);
      expect(GIGANTO_TREASURE_ORDER).toHaveLength(3);
    });

    it('every friend has four quests and every classic treasure two', () => {
      const by = (key: 'characterId' | 'treasureId'): Record<string, number> =>
        ORDINARY_QUESTS.reduce<Record<string, number>>((a, q) => ({ ...a, [q[key]]: (a[q[key]] ?? 0) + 1 }), {});
      expect(Object.values(by('characterId'))).toEqual([4, 4, 4, 4]);
      for (const t of TREASURE_ORDER) expect(by('treasureId')[t], t).toBe(2);
    });
  });

  it('special difficulty steps up one level and is capped', () => {
    expect(specialDifficulty('hard')).toBe('expert');
    expect(specialDifficulty('expert')).toBe('master');
    expect(specialDifficulty('master')).toBe('grand');
    expect(specialDifficulty('grand')).toBe('grand');
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
    const total = ALL_TREASURE_IDS.reduce((s, t) => s + (save.collection[t]?.count ?? 0), 0);
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
  it('starts generated mazes at hard and steps up every few completions, capped', () => {
    const at = (total: number): string => levelFor({ totalCompleted: total, introDone: total > 0 });
    expect(levelFor({ totalCompleted: 0, introDone: false })).toBe('hard');
    expect(at(1)).toBe('hard'); // only the tutorial done
    expect(at(1 + LEVEL_EVERY - 1)).toBe('hard');
    expect(at(1 + LEVEL_EVERY)).toBe('expert');
    expect(at(1 + 2 * LEVEL_EVERY)).toBe('master');
    expect(at(1 + 3 * LEVEL_EVERY)).toBe('grand');
    expect(at(500)).toBe('grand');
    expect(LEVEL_EVERY).toBe(4);
    // The fourth generated maze is still 'hard'; the fifth is the first 'expert'.
    expect(at(1 + 3)).toBe('hard');
    expect(at(1 + 4)).toBe('expert');
  });
});
