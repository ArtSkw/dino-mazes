/**
 * Device-local save envelope with validation, migration and safe fallback
 * (PRD §8, DEVELOPMENT_PLAN.md §3). Storage failure never prevents play: an
 * unavailable or full localStorage falls back to an in-memory session.
 */
import { GENERATOR_VERSION } from '../domain/maze';
import { TREASURE_ORDER, questById } from '../data/content';
import type { Difficulty, Lang, Point, SaveV1, Session, Settings, TreasureId } from '../domain/types';

export const SAVE_KEY = 'dino-mazes:save';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadStatus = 'fresh' | 'loaded' | 'recovered' | 'unavailable';

export function defaultSettings(): Settings {
  // Polish on a fresh install regardless of browser language (PRD §4.1).
  return { lang: 'pl', muted: false, motion: 'system' };
}

/**
 * "Zacznij grę od nowa": a fresh game (treasures, the current maze, the
 * tutorial, Giganto's cadence and the difficulty climb all start over) that
 * keeps the parent's settings and language choice.
 */
export function restartedSave(save: SaveV1): SaveV1 {
  return { ...defaultSave(), settings: { ...save.settings }, langChosen: save.langChosen };
}

export function defaultSave(): SaveV1 {
  return {
    schemaVersion: 1,
    settings: defaultSettings(),
    langChosen: false,
    collection: {},
    recentQuestIds: [],
    recentLayoutHashes: [],
    questBag: [],
    completedOrdinaryMazes: 0,
    ordinaryCompletionsSinceGiganto: 0,
    gigantoUnlocked: false,
    gigantoCompleted: 0,
    totalCompleted: 0,
    introDone: false,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNat = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1e9;
const isLang = (v: unknown): v is Lang => v === 'pl' || v === 'en';
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'medium-plus', 'harder', 'hard', 'expert'];
const isDiff = (v: unknown): v is Difficulty => (DIFFICULTIES as readonly unknown[]).includes(v);
const isTreasure = (v: unknown): v is TreasureId => typeof v === 'string' && (TREASURE_ORDER as string[]).includes(v);
const strList = (v: unknown, cap: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length < 200).slice(0, cap) : [];

function validPoint(p: unknown): p is Point {
  return isObj(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x as number) < 100 && Math.abs(p.y as number) < 100;
}

function validateSession(raw: unknown): Session | undefined {
  if (!isObj(raw)) return undefined;
  if (raw.generatorVersion !== GENERATOR_VERSION) return undefined; // never reinterpret an old trail
  if (typeof raw.id !== 'string' || typeof raw.seed !== 'string' || typeof raw.questId !== 'string') return undefined;
  if (!questById(raw.questId)) return undefined;
  if (!isDiff(raw.difficulty) || !isDiff(raw.effectiveDifficulty)) return undefined;
  if (!isObj(raw.grid) || !isNat(raw.grid.cols) || !isNat(raw.grid.rows)) return undefined;
  const { cols, rows } = raw.grid as { cols: number; rows: number };
  if (cols < 3 || rows < 3 || cols > 15 || rows > 15 || cols % 2 === 0 || rows % 2 === 0) return undefined;
  if (!isTreasure(raw.treasureId)) return undefined;
  if (!['bill', 'tiny', 'mazu', 'rocky', 'giganto'].includes(raw.characterId as string)) return undefined;
  const trail = Array.isArray(raw.trail) && raw.trail.length < 20000 && raw.trail.every(validPoint) ? (raw.trail as Point[]) : [];
  const status = raw.status === 'solved' ? 'solved' : trail.length ? 'paused' : 'ready';
  return {
    id: raw.id,
    questId: raw.questId,
    seed: raw.seed,
    generatorVersion: GENERATOR_VERSION,
    difficulty: raw.difficulty,
    effectiveDifficulty: raw.effectiveDifficulty,
    grid: { cols, rows },
    intro: raw.intro === true,
    trail,
    status,
    hintUsed: raw.hintUsed === true,
    ...(isNat(raw.resets) && raw.resets <= 999 ? { resets: raw.resets } : {}),
    treasureId: raw.treasureId,
    characterId: raw.characterId as Session['characterId'],
    special: raw.special === true,
    ...(raw.promptKey === 'giganto-generic' ? { promptKey: 'giganto-generic' } : {}),
    layoutHash: typeof raw.layoutHash === 'string' ? raw.layoutHash : '',
  };
}

/** Validate untrusted JSON into a save; salvages what it can. Returns null if hopeless. */
export function validateSave(raw: unknown): { save: SaveV1; recovered: boolean } | null {
  if (!isObj(raw)) return null;
  if (raw.schemaVersion !== 1) return migrate(raw);
  const base = defaultSave();
  let recovered = false;
  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = {
    lang: isLang(s.lang) ? s.lang : base.settings.lang,
    muted: typeof s.muted === 'boolean' ? s.muted : base.settings.muted,
    motion: s.motion === 'reduced' ? 'reduced' : 'system',
  };
  const collection: SaveV1['collection'] = {};
  if (isObj(raw.collection)) {
    for (const [k, v] of Object.entries(raw.collection)) {
      if (!isTreasure(k)) {
        recovered = true;
        continue;
      }
      if (isObj(v) && isNat(v.count) && v.count > 0) {
        collection[k] = { count: v.count, firstFoundAt: typeof v.firstFoundAt === 'string' ? v.firstFoundAt : new Date(0).toISOString() };
      } else recovered = true;
    }
  }
  const activeSession = validateSession(raw.activeSession);
  if (raw.activeSession !== undefined && !activeSession) recovered = true;
  const save: SaveV1 = {
    schemaVersion: 1,
    settings,
    langChosen: raw.langChosen === true,
    collection,
    ...(typeof raw.lastAwardedSessionId === 'string' ? { lastAwardedSessionId: raw.lastAwardedSessionId } : {}),
    recentQuestIds: strList(raw.recentQuestIds, 6).filter((id) => !!questById(id)),
    recentLayoutHashes: strList(raw.recentLayoutHashes, 6),
    questBag: strList(raw.questBag, 20).filter((id) => !!questById(id)),
    completedOrdinaryMazes: isNat(raw.completedOrdinaryMazes) ? raw.completedOrdinaryMazes : 0,
    ordinaryCompletionsSinceGiganto: isNat(raw.ordinaryCompletionsSinceGiganto) ? raw.ordinaryCompletionsSinceGiganto : 0,
    gigantoUnlocked: raw.gigantoUnlocked === true,
    gigantoCompleted: isNat(raw.gigantoCompleted) ? raw.gigantoCompleted : 0,
    totalCompleted: isNat(raw.totalCompleted) ? raw.totalCompleted : 0,
    introDone: raw.introDone === true || isNat(raw.totalCompleted) && (raw.totalCompleted as number) > 0,
    ...(activeSession ? { activeSession } : {}),
  };
  return { save, recovered };
}

/** Older or unknown schema: keep preferences and treasures if recognisable, drop the rest. */
function migrate(raw: Record<string, unknown>): { save: SaveV1; recovered: boolean } | null {
  const salvage = validateSave({ ...raw, schemaVersion: 1, activeSession: undefined });
  if (!salvage) return null;
  return { save: salvage.save, recovered: true };
}

export function probeStorage(candidate: () => StorageLike | undefined): StorageLike | null {
  try {
    const s = candidate();
    if (!s) return null;
    const k = `${SAVE_KEY}:probe`;
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export function loadSave(storage: StorageLike | null): { save: SaveV1; status: LoadStatus } {
  if (!storage) return { save: defaultSave(), status: 'unavailable' };
  let text: string | null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { save: defaultSave(), status: 'unavailable' };
  }
  if (text === null) return { save: defaultSave(), status: 'fresh' };
  try {
    const parsed: unknown = JSON.parse(text);
    const result = validateSave(parsed);
    if (!result) return { save: defaultSave(), status: 'recovered' };
    return { save: result.save, status: result.recovered ? 'recovered' : 'loaded' };
  } catch {
    return { save: defaultSave(), status: 'recovered' };
  }
}

/**
 * Holds the current save and writes it through to storage. Writes are
 * synchronous for important moments (completion, reset, lifecycle) and
 * throttled for ordinary trail progress.
 */
export class SaveStore {
  private current: SaveV1;
  private storage: StorageLike | null;
  private pending: ReturnType<typeof setTimeout> | null = null;
  status: LoadStatus;
  lastError: string | null = null;

  constructor(storage: StorageLike | null) {
    this.storage = storage;
    const { save, status } = loadSave(storage);
    this.current = save;
    this.status = status;
  }

  get(): SaveV1 {
    return this.current;
  }

  /** Replace the save and flush immediately. */
  commit(next: SaveV1): void {
    this.current = next;
    this.flush();
  }

  /** Replace the save and flush soon (throttled). */
  stage(next: SaveV1, delayMs = 800): void {
    this.current = next;
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      this.flush();
    }, delayMs);
  }

  flush(): void {
    if (this.pending) {
      clearTimeout(this.pending);
      this.pending = null;
    }
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.current));
      this.lastError = null;
    } catch (err) {
      // Quota exceeded or storage revoked: keep playing in memory.
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  }
}
