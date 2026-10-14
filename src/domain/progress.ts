/**
 * Quest selection, Giganto cadence and idempotent rewards (PRD §4.4, §5).
 * Pure functions over the save envelope; no browser APIs.
 */
import {
  GIGANTO_GENERIC,
  GIGANTO_TREASURE_ORDER,
  INTRO_QUEST_ID,
  LEGACY_SPECIAL_QUESTS,
  ORDINARY_QUESTS,
  SPECIAL_QUESTS,
  TREASURE_ORDER,
  questById,
  treasureHasArt,
} from '../data/content';
import { LEVELS } from './maze';
import type { Rng } from './rng';
import type { CharacterId, Difficulty, Quest, SaveV1, TreasureId } from './types';

/** Tunable cadence: first special after five ordinary completions, then every four. */
export const GIGANTO_FIRST_AFTER = 5;
export const GIGANTO_EVERY = 4;
export const RECENT_LIMIT = 6;

export interface QuestChoice {
  quest: Quest;
  treasureId: TreasureId;
  characterId: CharacterId;
  special: boolean;
  intro: boolean;
  /** Set when the generic pictured-treasure template is used. */
  promptKey?: 'giganto-generic';
}

/** Which treasures are in the game (their art exists); tests pass their own. */
export type TreasureReady = (id: TreasureId) => boolean;

/** Not yet found among `ids` (default: the classic treasures in the game). */
export function uncollected(save: Pick<SaveV1, 'collection'>, ids: TreasureId[] = TREASURE_ORDER.filter(treasureHasArt)): TreasureId[] {
  return ids.filter((t) => !(save.collection[t]?.count ?? 0));
}

export function isGigantoDue(save: Pick<SaveV1, 'gigantoCompleted' | 'ordinaryCompletionsSinceGiganto'>): boolean {
  const needed = save.gigantoCompleted === 0 ? GIGANTO_FIRST_AFTER : GIGANTO_EVERY;
  return save.ordinaryCompletionsSinceGiganto >= needed;
}

/** Generated mazes step up one difficulty level every this many completed mazes. */
/** Owner decision (14 Oct 2026): a new level every 4 mazes (was 3). */
export const LEVEL_EVERY = 4;

/**
 * The difficulty for the next generated maze, from progress alone (no parent
 * setting): 'medium' for the first mazes after the tutorial, then one level
 * up every LEVEL_EVERY completions, capped at the last level. A progress
 * reset starts the climb again.
 */
export function levelFor(save: Pick<SaveV1, 'totalCompleted' | 'introDone'>): Difficulty {
  const generated = Math.max(0, save.totalCompleted - (save.introDone ? 1 : 0));
  const i = Math.min(LEVELS.length - 1, Math.floor(generated / LEVEL_EVERY));
  return LEVELS[i] as Difficulty;
}

/** Giganto requests one level above the current one, capped at the hardest. */
export function specialDifficulty(d: Difficulty): Difficulty {
  const i = LEVELS.indexOf(d);
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, i) + 1)] as Difficulty;
}

function pickOrdinary(save: SaveV1, rng: Rng, bag: string[], ready: TreasureReady): { quest: Quest; bag: string[] } {
  const lastId = save.recentQuestIds[0];
  const lastChar = lastId ? questById(lastId)?.characterId : undefined;
  const open = new Set(uncollected(save, TREASURE_ORDER.filter(ready)));
  const quests = ORDINARY_QUESTS.filter((q) => ready(q.treasureId));
  let pool = bag.filter((id) => quests.some((q) => q.id === id));
  if (pool.length === 0) pool = rng.shuffle(quests.map((q) => q.id));
  const all = quests.map((q) => q.id);
  const byId = (id: string): Quest => questById(id) as Quest;
  const notLast = (id: string): boolean => id !== lastId;
  const freshFriend = (id: string): boolean => byId(id).characterId !== lastChar;
  const wanted = (id: string): boolean => open.has(byId(id).treasureId);

  const tiers: Array<[string[], (id: string) => boolean]> = open.size
    ? [
        [pool, (id) => wanted(id) && notLast(id) && freshFriend(id)],
        [rng.shuffle(all), (id) => wanted(id) && notLast(id) && freshFriend(id)],
        [pool, (id) => wanted(id) && notLast(id)],
        [rng.shuffle(all), (id) => wanted(id) && notLast(id)],
        [pool, notLast],
      ]
    : [
        [pool, (id) => notLast(id) && freshFriend(id) && !save.recentQuestIds.slice(0, 3).includes(id)],
        [pool, (id) => notLast(id) && freshFriend(id)],
        [pool, notLast],
        [rng.shuffle(all), notLast],
      ];
  for (const [list, pred] of tiers) {
    const id = list.find(pred);
    if (id) return { quest: byId(id), bag: pool.filter((x) => x !== id) };
  }
  const fallback = all.find(notLast) ?? (all[0] as string);
  return { quest: byId(fallback), bag: pool.filter((x) => x !== fallback) };
}

/**
 * Giganto's quest. With his own treasures in the game he asks for one of
 * them, unfound ones first, never the same quest twice in a row. Until their
 * art exists he keeps the old behaviour: a classic treasure, unfound first.
 */
function pickSpecial(save: SaveV1, rng: Rng, ready: TreasureReady): QuestChoice {
  const lastId = save.recentQuestIds.find((id) => questById(id)?.special);
  const own = SPECIAL_QUESTS.filter((q) => ready(q.treasureId));
  if (own.length) {
    const open = uncollected(save, GIGANTO_TREASURE_ORDER.filter(ready));
    const fresh = own.filter((q) => open.includes(q.treasureId) && q.id !== lastId);
    const notLast = own.filter((q) => q.id !== lastId);
    const quest = rng.pick(fresh.length ? fresh : notLast.length ? notLast : own);
    return { quest, treasureId: quest.treasureId, characterId: 'giganto', special: true, intro: false };
  }
  const open = uncollected(save, TREASURE_ORDER.filter(ready));
  if (open.length) {
    const matching = LEGACY_SPECIAL_QUESTS.filter((q) => open.includes(q.treasureId) && q.id !== lastId);
    if (matching.length) {
      const quest = rng.pick(matching);
      return { quest, treasureId: quest.treasureId, characterId: 'giganto', special: true, intro: false };
    }
    // Keep the first-six-unique rule: pictured generic template with an uncollected treasure.
    return {
      quest: GIGANTO_GENERIC,
      treasureId: rng.pick(open),
      characterId: 'giganto',
      special: true,
      intro: false,
      promptKey: 'giganto-generic',
    };
  }
  const options = LEGACY_SPECIAL_QUESTS.filter((q) => q.id !== lastId);
  const quest = rng.pick(options.length ? options : LEGACY_SPECIAL_QUESTS);
  return { quest, treasureId: quest.treasureId, characterId: 'giganto', special: true, intro: false };
}

export interface Selection {
  choice: QuestChoice;
  questBag: string[];
}

export function selectNextQuest(save: SaveV1, rng: Rng, questBag: string[], ready: TreasureReady = treasureHasArt): Selection {
  if (!save.introDone) {
    const quest = questById(INTRO_QUEST_ID) as Quest;
    return {
      choice: { quest, treasureId: quest.treasureId, characterId: quest.characterId, special: false, intro: true },
      questBag,
    };
  }
  if (isGigantoDue(save)) return { choice: pickSpecial(save, rng, ready), questBag };
  const { quest, bag } = pickOrdinary(save, rng, questBag, ready);
  return {
    choice: { quest, treasureId: quest.treasureId, characterId: quest.characterId, special: false, intro: false },
    questBag: bag,
  };
}

export interface AwardInput {
  sessionId: string;
  questId: string;
  treasureId: TreasureId;
  special: boolean;
  intro: boolean;
  layoutHash: string;
  now: string;
}

export interface AwardResult {
  save: SaveV1;
  awarded: boolean;
  firstFind: boolean;
}

/**
 * Commit a completion exactly once. Restricted to the active unsolved session;
 * replays (reload during celebration, double callbacks) are no-ops.
 */
export function award(save: SaveV1, input: AwardInput): AwardResult {
  const active = save.activeSession;
  if (save.lastAwardedSessionId === input.sessionId) return { save, awarded: false, firstFind: false };
  if (!active || active.id !== input.sessionId || active.status === 'solved') return { save, awarded: false, firstFind: false };
  const prev = save.collection[input.treasureId];
  const firstFind = !prev || prev.count === 0;
  const next: SaveV1 = {
    ...save,
    collection: {
      ...save.collection,
      [input.treasureId]: { count: (prev?.count ?? 0) + 1, firstFoundAt: prev?.firstFoundAt ?? input.now },
    },
    lastAwardedSessionId: input.sessionId,
    recentQuestIds: [input.questId, ...save.recentQuestIds.filter((x) => x !== input.questId)].slice(0, RECENT_LIMIT),
    recentLayoutHashes: [input.layoutHash, ...save.recentLayoutHashes].slice(0, RECENT_LIMIT),
    totalCompleted: save.totalCompleted + 1,
    introDone: save.introDone || input.intro,
    activeSession: { ...active, status: 'solved' },
  };
  if (input.special) {
    next.gigantoCompleted = save.gigantoCompleted + 1;
    next.ordinaryCompletionsSinceGiganto = 0;
    next.gigantoUnlocked = true;
  } else {
    next.completedOrdinaryMazes = save.completedOrdinaryMazes + 1;
    next.ordinaryCompletionsSinceGiganto = save.ordinaryCompletionsSinceGiganto + 1;
    if (isGigantoDue(next)) next.gigantoUnlocked = true;
  }
  return { save: next, awarded: true, firstFind };
}
