import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SaveStore, defaultSave, loadSave, probeStorage, restartedSave, validateSave, type StorageLike } from '../../src/storage/save';
import { GENERATOR_VERSION } from '../../src/domain/maze';

class MemStorage implements StorageLike {
  map = new Map<string, string>();
  failWrites = false;
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

const session = {
  id: 's1',
  questId: 'bill-nut',
  seed: 'abc',
  generatorVersion: GENERATOR_VERSION,
  difficulty: 'easy',
  effectiveDifficulty: 'easy',
  grid: { cols: 5, rows: 5 },
  intro: false,
  trail: [{ x: 1.5, y: 6 }],
  status: 'drawing',
  hintUsed: false,
  treasureId: 'nut',
  characterId: 'bill',
  special: false,
  layoutHash: 'h',
};

describe('opening animation date', () => {
  it('keeps a valid date and drops anything else', () => {
    expect(validateSave({ ...defaultSave(), openingShownOn: '2026-10-14' })!.save.openingShownOn).toBe('2026-10-14');
    for (const bad of ['14.10.2026', 20261014, '<b>', '2026-1-4']) expect(validateSave({ ...defaultSave(), openingShownOn: bad })!.save.openingShownOn).toBeUndefined();
  });

  it('survives a game restart (a viewing rhythm, not progress)', () => {
    expect(restartedSave({ ...defaultSave(), openingShownOn: '2026-10-14', totalCompleted: 9 }).openingShownOn).toBe('2026-10-14');
  });
});

describe('restart the game', () => {
  it('clears treasures, the current maze and all progress but keeps parent settings', () => {
    const played = {
      ...defaultSave(),
      settings: { lang: 'en' as const, muted: true, music: false, voices: true, motion: 'reduced' as const },
      langChosen: true,
      collection: { coconut: { count: 3, firstFoundAt: 'x' } },
      activeSession: { ...session } as never,
      totalCompleted: 14,
      introDone: true,
      gigantoCompleted: 2,
      ordinaryCompletionsSinceGiganto: 3,
      recentQuestIds: ['bill-nut'],
      recentLayoutHashes: ['h'],
      questBag: ['tiny-shell'],
    };
    const r = restartedSave(played);
    expect(r.settings).toEqual(played.settings);
    expect(r.langChosen).toBe(true);
    expect(r.collection).toEqual({});
    expect(r.activeSession).toBeUndefined();
    expect(r.totalCompleted).toBe(0);
    expect(r.introDone).toBe(false);
    expect(r.gigantoCompleted).toBe(0);
    expect(r.recentQuestIds).toEqual([]);
    expect(r.questBag).toEqual([]);
  });
});

describe('fresh-start counter (butterfly hint gate)', () => {
  it('keeps a valid reset count with the active session', () => {
    const r = validateSave({ ...defaultSave(), activeSession: { ...session, resets: 2 } })!;
    expect(r.save.activeSession?.resets).toBe(2);
  });

  it('drops a malformed reset count without losing the session', () => {
    for (const resets of [-1, 1.5, '3', 1e6]) {
      const r = validateSave({ ...defaultSave(), activeSession: { ...session, resets } })!;
      expect(r.save.activeSession).toBeDefined();
      expect(r.save.activeSession?.resets).toBeUndefined();
    }
  });
});

describe('save loading', () => {
  it('fresh storage starts in Polish with defaults', () => {
    const { save, status } = loadSave(new MemStorage());
    expect(status).toBe('fresh');
    expect(save.settings.lang).toBe('pl');
    expect(save.settings).toEqual({ lang: 'pl', muted: false, music: true, voices: true, motion: 'system' });
  });

  it('corrupt JSON falls back to a playable default', () => {
    const s = new MemStorage();
    s.setItem(SAVE_KEY, '{not json');
    const { save, status } = loadSave(s);
    expect(status).toBe('recovered');
    expect(save).toEqual(defaultSave());
  });

  it('unavailable storage still plays in memory', () => {
    expect(loadSave(null).status).toBe('unavailable');
    expect(probeStorage(() => {
      throw new Error('SecurityError');
    })).toBeNull();
    const store = new SaveStore(null);
    store.commit({ ...store.get(), totalCompleted: 3 });
    expect(store.get().totalCompleted).toBe(3);
  });

  it('quota errors keep the in-memory save', () => {
    const s = new MemStorage();
    const store = new SaveStore(s);
    s.failWrites = true;
    store.commit({ ...store.get(), totalCompleted: 2 });
    expect(store.get().totalCompleted).toBe(2);
    expect(store.lastError).toMatch(/Quota/);
  });

  it('an old generator version drops the active maze but keeps the collection', () => {
    const raw = {
      ...defaultSave(),
      collection: { shell: { count: 2, firstFoundAt: 'x' } },
      activeSession: { ...session, generatorVersion: GENERATOR_VERSION - 1 },
    };
    const r = validateSave(raw)!;
    expect(r.save.activeSession).toBeUndefined();
    expect(r.save.collection.shell?.count).toBe(2);
    expect(r.recovered).toBe(true);
  });

  it('an old schema keeps preferences and treasures', () => {
    const raw = { schemaVersion: 0, settings: { lang: 'en', muted: true }, collection: { stone: { count: 1, firstFoundAt: 'x' } }, activeSession: session };
    const r = validateSave(raw)!;
    expect(r.save.settings.lang).toBe('en');
    expect(r.save.settings.muted).toBe(true);
    // Saves from before music and voices: a silenced game stays silent.
    expect(r.save.settings.music).toBe(false);
    expect(r.save.settings.voices).toBe(false);
    expect(r.save.collection.stone?.count).toBe(1);
    expect(r.save.activeSession).toBeUndefined();
  });

  it('round-trips a valid save with an active session', () => {
    const s = new MemStorage();
    const store = new SaveStore(s);
    store.commit({ ...store.get(), langChosen: true, settings: { ...store.get().settings, lang: 'en' }, activeSession: session as never });
    const again = new SaveStore(s);
    expect(again.status).toBe('loaded');
    expect(again.get().settings.lang).toBe('en');
    expect(again.get().activeSession?.trail).toEqual(session.trail);
    expect(again.get().activeSession?.status).toBe('paused');
  });

  it('rejects malicious or garbage fields', () => {
    const r = validateSave({ ...defaultSave(), collection: { gold: { count: 99 }, nut: { count: -3 } }, recentQuestIds: ['bogus', 'tiny-shell'] })!;
    expect(Object.keys(r.save.collection)).toEqual([]);
    expect(r.save.recentQuestIds).toEqual(['tiny-shell']);
  });
});
