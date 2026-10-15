/**
 * The single owner of game state (DEVELOPMENT_PLAN.md §2, §4.3).
 *
 * UI and renderer send commands here and subscribe to the resulting state and
 * events; neither keeps its own copy of trail or completion state.
 *
 * Flow: loading → welcome → intro (character + treasure) → play (ready /
 * drawing / paused) → solved + celebrating → reward → next intro.
 * Collection and settings are overlays and never create sessions.
 */
import { CHARACTERS, GIGANTO_GENERIC, INTRO_PROMPT, TREASURE_OBJECT, TREASURES, VOICES, questById } from '../data/content';
import { t, type StringKey } from '../data/i18n';
import { GENERATOR_VERSION, generateMaze, introMaze, profileFor, rebuildMaze } from '../domain/maze';
import { PHONE_LEVEL, award, capDifficulty, levelFor, selectNextQuest, specialDifficulty } from '../domain/progress';
import { createRng, freshSeed } from '../domain/rng';
import { TrailEngine, computeHint, type Dir, type Hint } from '../domain/trail';
import type { CharacterId, Difficulty, Lang, Localized, Maze, Point, SaveV1, Session, Settings, TreasureId } from '../domain/types';
import { friendFrame } from '../game/assets';
import type { MusicId, SoundBoard, Sfx, Speaker } from '../game/audio';
import { computeLayout, fitGrid, isPhone, type Layout } from '../platform/layout';
import { restartedSave, type LoadStatus, type SaveStore } from '../storage/save';

export type Screen = 'loading' | 'welcome' | 'intro' | 'play' | 'reward';
/** Full story (first launch of the day), short greeting (later launches), or a plain fade (reduced motion). */
export type OpeningMode = 'full' | 'short' | 'fade';
export type OpeningPolicy = 'auto' | 'off' | OpeningMode;

/** Local calendar date as YYYY-MM-DD. */
export function localDate(d = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Which opening plays (art/INTRO_ANIMATION_PLAN.md): pure, so it can be tested. */
export function decideOpening(policy: OpeningPolicy, reducedMotion: boolean, shownOn: string | undefined, today: string): OpeningMode | null {
  if (policy === 'off') return null;
  if (policy !== 'auto') return policy;
  if (reducedMotion) return 'fade';
  return shownOn === today ? 'short' : 'full';
}
export type Overlay = 'collection' | 'settings' | null;

export interface Reward {
  sessionId: string;
  treasureId: TreasureId;
  firstFind: boolean;
  count: number;
}

export interface AppState {
  screen: Screen;
  overlay: Overlay;
  settings: Settings;
  reducedMotion: boolean;
  session: Session | null;
  maze: Maze | null;
  layout: Layout | null;
  celebrating: boolean;
  reward: Reward | null;
  canContinue: boolean;
  storage: LoadStatus;
  /** True until the first drawing input on the introductory maze (hand demo). */
  showHandDemo: boolean;
  /** Opening animation planned at boot (shown while loading as closed curtains). */
  openingPlan: OpeningMode | null;
  /** Opening animation currently playing on the welcome screen. */
  opening: OpeningMode | null;
  /**
   * Loaded, curtains closed, waiting for the first tap (owner request, 15 Oct
   * 2026): browsers allow sound only after a tap, and the opening's footsteps
   * and theme deserve to be heard.
   */
  awaitingTap: boolean;
  /** Drawing is connected right now (finger/mouse down and following). */
  drawing: boolean;
  loadError: boolean;
}

export type GameEvent =
  | { type: 'state' }
  | { type: 'maze' }
  | { type: 'trail' }
  | { type: 'trail-reset' }
  | { type: 'drawing-start' }
  | { type: 'drawing-stop'; lost: boolean }
  | { type: 'solved'; reward: Reward }
  | { type: 'skip-celebration' }
  | { type: 'hint'; hint: Hint }
  | { type: 'hint-ready' }
  | { type: 'talk'; characterId: string; ms: number }
  | { type: 'opening-skip' }
  | { type: 'wave'; characterId: string }
  | { type: 'treasure-tap'; treasureId: TreasureId }
  | { type: 'reveal' }
  | { type: 'layout' }
  | { type: 'announce'; text: string }
  | { type: 'collection-pulse' };

type Listener = (e: GameEvent) => void;

export interface Viewport {
  width(): number;
  height(): number;
}

const HINT_COOLDOWN_MS = 2600;
/**
 * The butterfly hint stays away until the child has pressed "Wróć" this many
 * times in the same maze: first they try on their own (owner decision, 2026-10-13).
 */
export const HINT_AFTER_RESETS = 3;
const CELEBRATION_GUARD_MS = 6000;

export class Controller {
  readonly store: SaveStore;
  readonly sound: SoundBoard;
  private viewport: Viewport;
  private listeners = new Set<Listener>();
  private rng = createRng(freshSeed(), 'content');
  engine: TrailEngine | null = null;
  state: AppState;
  private lastHintAt = -Infinity;
  private celebrationGuard = 0;
  private systemReducedMotion = false;
  /** Taps on the companion in the current maze (drives which line it says). */
  private talks = 0;
  private musicNow: MusicId | null = null;
  /** Length of the last spoken greeting / maze line (ms, 0 when silent), for bubble timing. */
  greetMs = 0;
  talkMs = 0;

  constructor(store: SaveStore, sound: SoundBoard, viewport: Viewport) {
    this.store = store;
    this.sound = sound;
    this.viewport = viewport;
    const save = store.get();
    sound.setChannels(channels(save.settings));
    this.state = {
      screen: 'loading',
      overlay: null,
      settings: save.settings,
      reducedMotion: save.settings.motion === 'reduced',
      session: null,
      maze: null,
      layout: null,
      celebrating: false,
      reward: null,
      canContinue: !!save.activeSession,
      storage: store.status,
      showHandDemo: false,
      openingPlan: null,
      opening: null,
      awaitingTap: false,
      drawing: false,
      loadError: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Subscription

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: GameEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    if ('screen' in patch || 'opening' in patch || 'overlay' in patch) this.music();
    this.emit({ type: 'state' });
  }

  get lang(): Lang {
    return this.state.settings.lang;
  }

  tr(key: StringKey, vars?: Record<string, string | number>): string {
    return t(this.lang, key, vars);
  }

  sfx(name: Sfx, gain?: number, pan?: number): void {
    this.sound.play(name, gain, pan);
  }

  get audio(): SoundBoard {
    return this.sound;
  }

  /**
   * Say a line aloud in a friend's or the narrator's voice (when it has a
   * clip and voices are on). Returns the clip's length in ms (0 if silent).
   */
  speak(speaker: Speaker, text: string): number {
    return Math.round(this.sound.say(this.lang, speaker, text) * 1000);
  }

  /** The narrator reads the quest card (after the friend has arrived on stage). */
  narrateQuest(): void {
    const text = this.questPrompt();
    if (text) this.speak('narrator', text);
  }

  /** Background music follows the screen: the theme with the opening, a calm bed on the welcome screen, silence in mazes. */
  private music(): void {
    const { screen, opening, overlay } = this.state;
    let want: MusicId | null = null;
    if (opening === 'full') want = 'theme-opening';
    else if (opening === 'short') want = 'theme-short';
    else if (screen === 'welcome' && overlay !== 'settings') want = 'welcome-bed';
    if (want === this.musicNow) return;
    // The opening's theme ends on its own; the bed fades in after it.
    if (this.musicNow?.startsWith('theme-') && want === 'welcome-bed') this.sound.playMusic(want, true, 2.5);
    else if (want) this.sound.playMusic(want, want === 'welcome-bed', want === 'welcome-bed' ? 1.5 : 0);
    else this.sound.stopMusic(0.8);
    // The rainforest: full on the welcome screen, quieter but always there in the mazes.
    this.sound.setAmbience(opening ? 0 : screen === 'welcome' ? 1 : ['intro', 'play', 'reward'].includes(screen) ? 0.45 : 0);
    // The sleepy friend's snore never follows the child off the maze.
    if (screen !== 'play') this.sound.stopLoop('snore');
    this.musicNow = want;
  }

  private announce(text: string): void {
    this.emit({ type: 'announce', text });
  }

  setSystemReducedMotion(reduced: boolean): void {
    this.systemReducedMotion = reduced;
    this.set({ reducedMotion: this.state.settings.motion === 'reduced' || reduced });
  }

  // ---------------------------------------------------------------------------
  // Lifecycle

  /**
   * Decide the opening once at boot (after the system motion preference is
   * known), so the loader fetches only what that opening needs and the closed
   * curtains can stand in for the loading screen.
   */
  planOpening(policy: OpeningPolicy, today = localDate()): OpeningMode | null {
    const plan = decideOpening(policy, this.state.reducedMotion, this.store.get().openingShownOn, today);
    this.set({ openingPlan: plan });
    if (plan === 'full') {
      const save = this.store.get();
      this.store.commit({ ...save, openingShownOn: today });
    }
    return plan;
  }

  ready(): void {
    // An opening with sound waits behind the closed curtains for the first tap.
    const plan = this.state.openingPlan;
    // Browsers that say sound may start on its own (Firefox's autoplay policy) skip the wait.
    if ((plan === 'full' || plan === 'short') && !this.sound.autoplayAllowed()) {
      this.set({ awaitingTap: true });
      return;
    }
    this.begin();
  }

  /** The first tap on the closed curtains: sound is allowed now, the opening plays. */
  start(): void {
    if (this.state.awaitingTap) this.begin();
  }

  private begin(): void {
    const save = this.store.get();
    this.set({ screen: 'welcome', canContinue: this.isResumable(save), opening: this.state.openingPlan, awaitingTap: false });
  }

  /** The renderer finished (or skipped) the opening: the welcome screen is live. */
  finishOpening(): void {
    if (this.state.opening) this.set({ opening: null, openingPlan: null });
  }

  /** Tap or key during the opening: jump straight to the welcome screen. */
  skipOpening(): void {
    if (this.state.opening) this.emit({ type: 'opening-skip' });
  }

  failLoading(): void {
    this.set({ loadError: true });
  }

  private isResumable(save: SaveV1): boolean {
    return !!save.activeSession && !!questById(save.activeSession.questId);
  }

  /** Any user gesture: unlock audio. */
  gesture(): void {
    this.sound.unlock();
  }

  /** Page hidden, blur, pagehide: pause input and persist. */
  pause(): void {
    if (this.engine?.connected) this.engine.end();
    if (this.state.drawing) this.set({ drawing: false });
    this.persistTrail(true);
  }

  // ---------------------------------------------------------------------------
  // Welcome → session

  play(): void {
    if (this.state.screen !== 'welcome') return;
    const save = this.store.get();
    const active = save.activeSession;
    if (active && this.restoreSession(active)) {
      this.announce(this.tr('srObjective'));
      return;
    }
    this.newSession();
  }

  private restoreSession(s: Session): boolean {
    let maze: Maze;
    try {
      maze = rebuildMaze(s.seed, s.effectiveDifficulty, s.grid, s.intro);
    } catch {
      return false;
    }
    if (s.layoutHash && maze.layoutHash !== s.layoutHash) return false;
    const engine = new TrailEngine(maze);
    let session = s;
    if (!engine.restore(s.trail)) {
      if (s.status === 'solved') return false;
      session = { ...s, trail: [], status: 'ready' };
      const save = this.store.get();
      this.store.commit({ ...save, activeSession: session });
    }
    if (session.status === 'solved') {
      const count = this.store.get().collection[session.treasureId]?.count ?? 1;
      this.installMaze(maze, session, engine, {
        screen: 'reward',
        reward: { sessionId: session.id, treasureId: session.treasureId, firstFind: false, count },
      });
    } else {
      this.installMaze(maze, session, engine, { screen: 'play' });
    }
    return true;
  }

  /**
   * Install a maze and its session, then notify: 'maze' first (renderer rebuilds
   * board objects against the new state), then 'state'.
   */
  private installMaze(maze: Maze, session: Session, engine: TrailEngine, extra: Partial<AppState>): void {
    const layout = this.layoutFor(maze, session);
    this.engine = engine;
    this.talks = 0;
    this.applyTrailTolerances(layout);
    this.state = {
      ...this.state,
      maze,
      session,
      layout,
      celebrating: false,
      reward: null,
      drawing: false,
      overlay: null,
      showHandDemo: session.intro && session.trail.length === 0,
      ...extra,
    };
    this.emit({ type: 'maze' });
    this.emit({ type: 'state' });
  }

  private layoutFor(maze: Maze, session: Pick<Session, 'characterId'>): Layout {
    return computeLayout({
      vw: this.viewport.width(),
      vh: this.viewport.height(),
      grid: { cols: maze.width, rows: maze.height },
      entranceSide: maze.entrance.side,
      friend: friendFrame(session.characterId),
    });
  }

  private applyTrailTolerances(layout: Layout): void {
    const pitch = layout.transform.pitch;
    const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
    this.engine?.setOptions({
      resumeRadius: clamp(34 / pitch, 0.3, 0.45),
      entranceRadius: clamp(48 / pitch, 0.5, 0.8),
    });
  }

  /** Phones keep mazes simple (PHONE_LEVEL); the progress itself still counts. */
  private screenCap(d: Difficulty): Difficulty {
    return isPhone(this.viewport.width(), this.viewport.height()) ? capDifficulty(d, PHONE_LEVEL) : d;
  }

  private newSession(opts: { keepQuestOf?: Session; difficultyOverride?: Difficulty } = {}): void {
    let save = this.store.get();
    let session: Session;
    let maze: Maze;
    // No parent setting: the level grows with progress (every few mazes).
    const difficulty = levelFor(save);
    if (opts.keepQuestOf) {
      const prev = opts.keepQuestOf;
      const eff = this.screenCap(opts.difficultyOverride ?? prev.effectiveDifficulty);
      const fit = fitGrid(eff, this.viewport.width(), this.viewport.height());
      maze = this.freshMaze(eff, fit.grid, save);
      session = { ...prev, id: freshSeed(), seed: maze.seed, effectiveDifficulty: eff, difficulty: prev.difficulty, grid: { cols: maze.width, rows: maze.height }, trail: [], status: 'ready', hintUsed: false, resets: 0, layoutHash: maze.layoutHash };
    } else {
      const sel = selectNextQuest(save, this.rng, save.questBag);
      const choice = sel.choice;
      save = { ...save, questBag: sel.questBag };
      const eff = this.screenCap(choice.special ? specialDifficulty(difficulty) : difficulty);
      if (choice.intro) {
        maze = introMaze();
      } else {
        const fit = fitGrid(eff, this.viewport.width(), this.viewport.height());
        maze = this.freshMaze(eff, fit.grid, save);
      }
      session = {
        id: freshSeed(),
        questId: choice.quest.id,
        seed: maze.seed,
        generatorVersion: GENERATOR_VERSION,
        difficulty,
        effectiveDifficulty: choice.intro ? 'easy' : eff,
        grid: { cols: maze.width, rows: maze.height },
        intro: choice.intro,
        trail: [],
        status: 'ready',
        hintUsed: false,
        treasureId: choice.treasureId,
        characterId: choice.characterId,
        special: choice.special,
        ...(choice.promptKey ? { promptKey: choice.promptKey } : {}),
        layoutHash: maze.layoutHash,
      };
    }
    this.store.commit({ ...save, activeSession: session });
    this.installMaze(maze, session, new TrailEngine(maze), { screen: opts.keepQuestOf ? 'play' : 'intro', canContinue: true });
    if (opts.keepQuestOf) this.announce(this.tr('srObjective'));
  }

  /** New seeded maze that is not a repeat of the most recent layouts. */
  private freshMaze(eff: Difficulty, grid: { cols: number; rows: number }, save: SaveV1): Maze {
    const profile = profileFor(eff, grid);
    let maze = generateMaze(freshSeed(), profile);
    for (let i = 0; i < 5 && save.recentLayoutHashes.includes(maze.layoutHash); i++) {
      maze = generateMaze(freshSeed(), profile);
    }
    return maze;
  }

  /** "Szukajmy!" — reveal the maze. */
  reveal(): void {
    if (this.state.screen !== 'intro') return;
    this.set({ screen: 'play' });
    this.sfx('maze-reveal');
    this.emit({ type: 'reveal' });
    this.announce(this.tr('srObjective'));
  }

  // ---------------------------------------------------------------------------
  // Quest text

  questPrompt(session: Session | null = this.state.session): string {
    if (!session) return '';
    const quest = questById(session.questId);
    if (!quest) return '';
    let prompt: Localized = quest.prompt;
    if (session.intro) prompt = INTRO_PROMPT;
    if (session.promptKey === 'giganto-generic') prompt = GIGANTO_GENERIC.prompt;
    return prompt[this.lang];
  }

  characterName(session: Session | null = this.state.session): string {
    return session ? CHARACTERS[session.characterId].name[this.lang] : '';
  }

  // ---------------------------------------------------------------------------
  // Drawing input (logical board coordinates)

  private canDraw(): boolean {
    return this.state.screen === 'play' && !this.state.overlay && !this.state.celebrating && !!this.engine && !this.engine.solved;
  }

  pointerDown(p: Point): boolean {
    if (!this.canDraw()) return false;
    const engine = this.engine as TrailEngine;
    if (this.state.showHandDemo) this.set({ showHandDemo: false });
    const fresh = !engine.started;
    const r = engine.begin(p);
    if (!r) return false;
    // The first step on the path, not every touch that continues it.
    if (fresh) this.sfx('maze-start');
    this.afterMove(r, true);
    return true;
  }

  pointerMove(p: Point): void {
    if (!this.canDraw()) return;
    const engine = this.engine as TrailEngine;
    const wasConnected = engine.connected;
    if (!engine.started) {
      // Sliding into the entrance pad counts as starting inside it.
      if (!engine.canBegin(p)) return;
      const r = engine.begin(p);
      if (r) {
        this.sfx('maze-start');
        this.afterMove(r, true);
      }
      return;
    }
    const r = engine.move(p);
    this.afterMove(r, !wasConnected && engine.connected);
  }

  pointerUp(): void {
    if (!this.engine) return;
    const wasDrawing = this.engine.connected;
    this.engine.end();
    if (this.state.drawing) this.set({ drawing: false });
    if (wasDrawing) this.emit({ type: 'drawing-stop', lost: false });
    this.persistTrail(true);
  }

  private afterMove(r: { advanced: boolean; lost: boolean; solvedNow: boolean }, started: boolean): void {
    const engine = this.engine as TrailEngine;
    if (started) {
      if (!this.state.drawing) this.set({ drawing: true });
      this.emit({ type: 'drawing-start' });
    }
    if (r.advanced) {
      this.emit({ type: 'trail' });
      this.persistTrail(false);
    }
    if (r.lost) {
      this.set({ drawing: false });
      this.emit({ type: 'drawing-stop', lost: true });
    }
    if (r.solvedNow && engine.solved) this.onSolved();
  }

  key(dir: Dir): void {
    if (!this.canDraw()) return;
    const engine = this.engine as TrailEngine;
    if (this.state.showHandDemo) this.set({ showHandDemo: false });
    const first = !engine.started;
    const r = engine.keyStep(dir);
    if (!r) {
      const dirs = engine.availableDirections();
      this.announce(dirs.length ? this.tr('srCanGo', { dirs: dirs.map((d) => this.tr(d)).join(', ') }) : this.tr('srNoWay'));
      return;
    }
    if (first) this.emit({ type: 'drawing-start' });
    this.emit({ type: 'trail' });
    this.persistTrail(true);
    if (r.solvedNow) {
      this.onSolved();
      return;
    }
    const dirs = engine.availableDirections();
    this.announce(dirs.length ? this.tr('srCanGo', { dirs: dirs.map((d) => this.tr(d)).join(', ') }) : this.tr('srNoWay'));
  }

  /** "Wróć": clear the whole attempt in the same maze. No confirmation. */
  resetTrail(): void {
    if (this.state.screen !== 'play' || this.state.celebrating || !this.engine || this.engine.solved) return;
    // Only a reset that clears real drawing counts as a fresh start.
    const hadTrail = this.engine.started;
    this.engine.reset();
    const wasAvailable = this.hintAvailable();
    const resets = (this.state.session?.resets ?? 0) + (hadTrail ? 1 : 0);
    this.updateSession({ trail: [], status: 'ready', hintUsed: false, resets });
    this.store.flush();
    this.set({ drawing: false });
    this.emit({ type: 'trail-reset' });
    this.emit({ type: 'trail' });
    const ready = !wasAvailable && this.hintAvailable();
    this.announce(ready ? `${this.tr('srReset')} ${this.tr('hintReady')}` : this.tr('srReset'));
    if (ready) {
      this.emit({ type: 'hint-ready' });
      // Most players cannot read yet: the narrator says the butterfly is here.
      window.setTimeout(() => this.speak('narrator', this.tr('hintReady')), 900);
    }
  }

  /** The butterfly is offered only after a few fresh starts in this maze. */
  hintAvailable(): boolean {
    return (this.state.session?.resets ?? 0) >= HINT_AFTER_RESETS;
  }

  hint(): void {
    if (!this.canDraw() || !this.hintAvailable()) return;
    const now = performance.now();
    if (now - this.lastHintAt < HINT_COOLDOWN_MS) return;
    this.lastHintAt = now;
    const hint = computeHint(this.engine as TrailEngine);
    this.updateSession({ hintUsed: true });
    this.store.flush();
    this.emit({ type: 'hint', hint });
  }

  private updateSession(patch: Partial<Session>): void {
    const save = this.store.get();
    if (!save.activeSession || !this.state.session || save.activeSession.id !== this.state.session.id) return;
    const session = { ...save.activeSession, ...patch };
    this.store.commit({ ...save, activeSession: session });
    this.state = { ...this.state, session };
  }

  private persistTrail(immediate: boolean): void {
    const engine = this.engine;
    const save = this.store.get();
    if (!engine || !save.activeSession || !this.state.session || save.activeSession.id !== this.state.session.id) return;
    if (save.activeSession.status === 'solved') return;
    const session: Session = {
      ...save.activeSession,
      trail: engine.points.map((p) => ({ x: Math.round(p.x * 1e4) / 1e4, y: Math.round(p.y * 1e4) / 1e4 })),
      status: engine.started ? (engine.connected ? 'drawing' : 'paused') : 'ready',
    };
    const next = { ...save, activeSession: session };
    if (immediate) this.store.commit(next);
    else this.store.stage(next);
    this.state = { ...this.state, session };
  }

  // ---------------------------------------------------------------------------
  // Completion

  private onSolved(): void {
    const session = this.state.session;
    if (!session || this.state.celebrating) return;
    // Persist the final trail together with the award, atomically.
    const engine = this.engine as TrailEngine;
    const save0 = this.store.get();
    if (!save0.activeSession) return;
    const withTrail: SaveV1 = { ...save0, activeSession: { ...save0.activeSession, trail: engine.points.slice() } };
    const result = award(withTrail, {
      sessionId: session.id,
      questId: session.questId,
      treasureId: session.treasureId,
      special: session.special,
      intro: session.intro,
      layoutHash: session.layoutHash,
      now: new Date().toISOString(),
    });
    if (!result.awarded) return;
    this.store.commit(result.save);
    const count = result.save.collection[session.treasureId]?.count ?? 1;
    const reward: Reward = { sessionId: session.id, treasureId: session.treasureId, firstFind: result.firstFind, count };
    this.set({ celebrating: true, reward, drawing: false, session: result.save.activeSession ?? session });
    this.emit({ type: 'solved', reward });
    // Safety net: the reward is already saved; never let a stalled or hidden
    // renderer block the "Next adventure" button.
    window.clearTimeout(this.celebrationGuard);
    this.celebrationGuard = window.setTimeout(() => this.finishCelebration(), CELEBRATION_GUARD_MS);
    this.announce(this.tr('srSolved', { treasure: TREASURE_OBJECT[session.treasureId][this.lang] }));
  }

  /** Called by the renderer when the success performance ends (or is skipped). */
  finishCelebration(): void {
    window.clearTimeout(this.celebrationGuard);
    if (!this.state.celebrating) return;
    this.set({ celebrating: false, screen: 'reward' });
    this.emit({ type: 'collection-pulse' });
  }

  skipCelebration(): void {
    if (this.state.celebrating) this.emit({ type: 'skip-celebration' });
  }

  /** "Kolejna przygoda": exactly one new session per reward. */
  next(): void {
    if (this.state.screen !== 'reward' || this.state.celebrating) return;
    this.newSession();
  }

  // ---------------------------------------------------------------------------
  // Overlays and settings

  openOverlay(o: Exclude<Overlay, null>): void {
    if (this.engine?.connected) this.pointerUp();
    this.set({ overlay: o });
  }

  closeOverlay(): void {
    if (this.state.overlay) this.set({ overlay: null });
  }

  private saveSettings(patch: Partial<Settings>, extra: Partial<SaveV1> = {}): void {
    const save = this.store.get();
    const settings = { ...save.settings, ...patch };
    this.store.commit({ ...save, ...extra, settings });
    this.sound.setChannels(channels(settings));
    this.set({ settings, reducedMotion: settings.motion === 'reduced' || this.systemReducedMotion });
  }

  setLang(lang: Lang): void {
    if (lang === this.lang && this.store.get().langChosen) return;
    this.saveSettings({ lang }, { langChosen: true });
  }

  toggleMute(): void {
    this.setMuted(!this.state.settings.muted);
  }

  setMuted(muted: boolean): void {
    if (muted === this.state.settings.muted) return;
    this.saveSettings({ muted });
    if (!muted) this.sfx('ui-wood', 0.7);
  }

  setMusic(music: boolean): void {
    if (music !== this.state.settings.music) this.saveSettings({ music });
  }

  setVoices(voices: boolean): void {
    if (voices !== this.state.settings.voices) this.saveSettings({ voices });
  }

  setMotion(motion: Settings['motion']): void {
    this.saveSettings({ motion });
  }

  /** Giganto's special quest may restart at the current normal level, no penalty. */
  canUseEasierMaze(): boolean {
    const s = this.state.session;
    return !!s && s.special && this.state.screen === 'play' && !this.state.celebrating && s.effectiveDifficulty !== s.difficulty;
  }

  easierMaze(): void {
    const s = this.state.session;
    if (!s || !this.canUseEasierMaze()) return;
    this.set({ overlay: null });
    this.newSession({ keepQuestOf: s, difficultyOverride: s.difficulty });
    this.emit({ type: 'trail-reset' });
  }

  /**
   * "Zacznij grę od nowa" (parents' settings, maze screens only): treasures,
   * the current maze and all progress start over; settings stay. Back to the
   * welcome screen, where "Graj" begins with the tutorial maze again.
   */
  restartGame(): void {
    if (this.engine?.connected) this.pointerUp();
    window.clearTimeout(this.celebrationGuard);
    this.store.commit(restartedSave(this.store.get()));
    this.store.flush();
    this.engine = null;
    this.set({ screen: 'welcome', overlay: null, session: null, maze: null, celebrating: false, reward: null, drawing: false, canContinue: false, showHandDemo: false });
  }

  wave(characterId: string): void {
    this.sfx('friend-tap', 0.5);
    this.emit({ type: 'wave', characterId });
  }

  /** Taps per friend on the welcome screen (first: hello, then their own lines). */
  private greetings = new Map<string, number>();

  /** A tapped friend on the welcome screen says hello, then little things about itself. */
  greet(characterId: CharacterId): string {
    const n = this.greetings.get(characterId) ?? 0;
    this.greetings.set(characterId, n + 1);
    const voice = VOICES[characterId];
    const text = n === 0 ? voice.hello[this.lang] : (voice.lines[(n - 1) % voice.lines.length] as Localized)[this.lang];
    this.greetMs = this.speak(characterId, text);
    return text;
  }

  /**
   * The child tapped the corner companion. The first tap of every maze is the
   * quest in the friend's own voice; later taps alternate little things about
   * the friend with its own cheers, and the quest comes back every few taps.
   * Returns the line to show in the speech bubble.
   */
  talk(): string {
    const session = this.state.session;
    if (!session) return '';
    const n = this.talks++;
    this.sfx('friend-tap', 0.5);
    const { lines, cheers } = VOICES[session.characterId];
    const cycle = lines.length + cheers.length + 1;
    const k = n % cycle;
    const i = Math.floor((k - 1) / 2);
    const line = k === 0 ? null : (k - 1) % 2 === 0 ? lines[i % lines.length] : cheers[i % cheers.length];
    const text = line ? line[this.lang] : this.askLine(session);
    // Mouth poses for as long as the clip plays (or roughly the time to read the line aloud).
    const spoken = this.speak(session.characterId, text);
    this.talkMs = spoken;
    this.emit({ type: 'talk', characterId: session.characterId, ms: spoken > 0 ? spoken : Math.min(3200, Math.max(1200, 600 + text.length * 40)) });
    return text;
  }

  private askLine(session: Session): string {
    const quest = session.promptKey === 'giganto-generic' ? GIGANTO_GENERIC : (questById(session.questId) ?? GIGANTO_GENERIC);
    return quest.ask[this.lang].replace('{treasure}', TREASURES[session.treasureId].name[this.lang]);
  }

  tapTreasure(treasureId: TreasureId): void {
    this.sfx(`treasure-${treasureId}`);
    this.emit({ type: 'treasure-tap', treasureId });
  }

  goHome(): void {
    if (this.engine?.connected) this.pointerUp();
    this.persistTrail(true);
    this.set({ screen: 'welcome', overlay: null, canContinue: this.isResumable(this.store.get()), celebrating: false });
  }

  // ---------------------------------------------------------------------------
  // Layout

  resize(): void {
    const { maze, session } = this.state;
    if (this.engine?.connected) this.pointerUp();
    if (!maze || !session) {
      this.emit({ type: 'layout' });
      return;
    }
    const layout = this.layoutFor(maze, session);
    this.applyTrailTolerances(layout);
    this.set({ layout });
    this.emit({ type: 'layout' });
  }

  /** Debug info for QA (shown only with ?debug=1). */
  debugInfo(): Record<string, string | number | boolean> {
    const m = this.state.maze;
    const s = this.state.session;
    const L = this.state.layout;
    return {
      seed: m?.seed ?? '-',
      generator: GENERATOR_VERSION,
      profile: m ? `${m.profile.difficulty} ${m.width}x${m.height}` : '-',
      requested: s?.difficulty ?? '-',
      branches: m?.metrics.branchChoices ?? 0,
      decisions: m?.metrics.decisionPoints ?? 0,
      solution: m?.metrics.solutionLength ?? 0,
      deadEnd: m?.metrics.maxDeadEndDepth ?? 0,
      fallback: m?.usedFallback ?? false,
      layout: m?.layoutHash ?? '-',
      corridorPx: L ? Math.round(L.corridorPx) : 0,
      points: this.engine?.points.length ?? 0,
      route: this.engine?.route.length ?? 0,
      storage: this.state.storage,
    };
  }
}

/** The sound channels a parent's settings allow. */
function channels(s: Settings): { effects: boolean; music: boolean; voices: boolean } {
  return { effects: !s.muted, music: s.music, voices: s.voices };
}
