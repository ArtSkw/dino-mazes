/**
 * Shared domain contracts (see DEVELOPMENT_PLAN.md §3).
 *
 * Geometry note: the plan's sketch listed `wallPolygons`. Corridors here are the
 * union of round-capped capsules around graph edges, and walls are the exact
 * complement inside the board frame. Collision, rendering and decoration all
 * derive from the same `corridors` + radius data, so no separate wall polygon
 * list is stored.
 */

export type Lang = 'pl' | 'en';
export type Localized = Record<Lang, string>;
export type CharacterId = 'bill' | 'tiny' | 'mazu' | 'rocky' | 'giganto';
/** Eight classic treasures found with the friends, three found only with Giganto. */
export type TreasureId = 'coconut' | 'nut' | 'flower' | 'stone' | 'shell' | 'berries' | 'feather' | 'strawberry' | 'amber' | 'gigaflower' | 'crystal';
/**
 * Maze difficulty. 'easy' is only the fixed first (tutorial) maze; generated
 * mazes start at 'hard' and step up automatically (see LEVELS in maze.ts).
 * 'medium', 'medium-plus' and 'harder' remain as profiles (tests, old saves).
 */
export type Difficulty = 'easy' | 'medium' | 'medium-plus' | 'harder' | 'hard' | 'expert' | 'master' | 'grand';

/** Logical board coordinates in cell units; never device pixels. */
export interface Point {
  x: number;
  y: number;
}

export type Side = 'bottom' | 'left' | 'right' | 'top';

export interface Quest {
  id: string;
  characterId: CharacterId;
  treasureId: TreasureId;
  prompt: Localized;
  /** The friend's first speech bubble in the maze, in its own voice. */
  ask: Localized;
  /** Reserved for later recorded narration; absent in v1. */
  narration?: Partial<Record<Lang, string>>;
  special?: boolean;
}

export interface GridSpec {
  cols: number;
  rows: number;
}

export interface MazeProfile {
  difficulty: Difficulty;
  grid: GridSpec;
  /** Inclusive range of branch decisions along the solution. */
  branchChoices: [number, number];
  minSolutionLength: number;
  maxSolutionLength?: number;
  /** Optional cap on dead-end depth (easy mazes keep dead ends short). */
  maxDeadEndDepth?: number;
  /** Optional cap on all decision points, including trivial one-cell pockets. */
  maxDecisionPoints?: number;
  /** Generator bias range (growing-tree newest-cell probability). */
  bias: [number, number];
  /** Rejection-sampling budget (defaults to MAX_ATTEMPTS). */
  maxAttempts?: number;
}

export interface MazeCell {
  id: number;
  x: number;
  y: number;
  neighbors: number[];
}

export interface Maze {
  seed: string;
  generatorVersion: number;
  width: number;
  height: number;
  profile: MazeProfile;
  cells: MazeCell[];
  /** Node id of the virtual outside entrance node (equals cells.length). */
  entranceNode: number;
  entrance: { side: Side; outside: Point; insideCell: number; opening: [Point, Point] };
  goal: { cellId: number; center: Point; radius: number };
  /** Corridor centre-lines; walkable space is every point within `corridorRadius` of one. */
  corridors: Array<{ from: number; to: number }>;
  /** Visual half-width of a corridor, in cell units. */
  corridorRadius: number;
  /** Frame margin of hedge around the grid, in cell units. */
  frameMargin: number;
  metrics: MazeMetrics;
  layoutHash: string;
  /** True when the generator fell back to a validated fixed seed. */
  usedFallback: boolean;
  attempts: number;
}

export interface MazeMetrics {
  solutionLength: number;
  /** Meaningful decisions on the solution (a wrong option ≥ 2 cells deep). */
  branchChoices: number;
  /** Every node on the solution with more than one forward option. */
  decisionPoints: number;
  maxDeadEndDepth: number;
  deadEnds: number;
  solution: number[];
}

export type SessionStatus = 'ready' | 'drawing' | 'paused' | 'solved';

export interface StoredTrail {
  points: Point[];
}

export interface Session {
  id: string;
  questId: string;
  seed: string;
  generatorVersion: number;
  difficulty: Difficulty;
  /** The difficulty actually used for generation (Giganto may step up). */
  effectiveDifficulty: Difficulty;
  /** The generated grid (used to rebuild the maze from its seed). */
  grid: GridSpec;
  /**
   * The maze is shown turned (turnMaze) because the screen was rotated; the
   * trail is stored in the shown maze's coordinates.
   */
  turned?: boolean;
  intro: boolean;
  trail: Point[];
  status: SessionStatus;
  hintUsed: boolean;
  /**
   * How many times "Wróć" cleared the trail in this maze. The butterfly hint
   * only appears after a few fresh starts, so the child tries alone first.
   */
  resets?: number;
  /** Treasure shown for this quest (generic special quests choose one). */
  treasureId: TreasureId;
  characterId: CharacterId;
  special: boolean;
  /** Quest prompt template id when a generic special template is used. */
  promptKey?: string;
  layoutHash: string;
}

export interface CollectionEntry {
  count: number;
  firstFoundAt: string;
}

/** Parent settings. Difficulty is not a setting: it grows with progress (levelFor). */
export interface Settings {
  lang: Lang;
  /** Effects off (the first switch, kept from the first version). */
  muted: boolean;
  /** Music and the jungle bed (welcome screen and opening). */
  music: boolean;
  /** The friends' and the narrator's voices. */
  voices: boolean;
  motion: 'system' | 'reduced';
}

export interface SaveV1 {
  schemaVersion: 1;
  settings: Settings;
  /** True once the user has explicitly picked a language. */
  langChosen: boolean;
  collection: Partial<Record<TreasureId, CollectionEntry>>;
  lastAwardedSessionId?: string;
  recentQuestIds: string[];
  recentLayoutHashes: string[];
  /** Shuffled content bag of ordinary quest ids still to come. */
  questBag: string[];
  completedOrdinaryMazes: number;
  ordinaryCompletionsSinceGiganto: number;
  gigantoUnlocked: boolean;
  gigantoCompleted: number;
  totalCompleted: number;
  introDone: boolean;
  /** Local date (YYYY-MM-DD) the full opening animation last played; later launches that day get the short one. */
  openingShownOn?: string;
  activeSession?: Session;
}
