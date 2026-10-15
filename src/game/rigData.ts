/**
 * Rig data shared by the Phaser rig players (rig.ts, critters.ts,
 * confetti.ts) and the tests: the manifest's rig shapes and the constants
 * that keep motion inside what Codex reviewed. No Phaser here.
 */

export interface RigPartAsset {
  name: string;
  /** Frame in the parts atlas (a trimmed frame of the full canvas). */
  frame: string;
  /** Pivot in canvas pixels. */
  pivot: [number, number];
  opacity: number;
  /** False for parts hidden at rest (the ladybug's flight wings). */
  restVisible?: boolean;
}

export interface RigAsset {
  /** Canvas size in the still image's pixels. */
  canvas: [number, number];
  /** Centre of the still image inside the canvas: the rig's origin. */
  origin: [number, number];
  size: [number, number];
  /** Draw order, back to front. */
  parts: RigPartAsset[];
  /** Extra whole poses on the same canvas (the perched butterfly, the pressing hand). */
  poses?: Record<string, string>;
  /** The whole master as one frame (pose-only assets: the hand, the frog). */
  master?: string;
  /** Named points in canvas pixels (the hand's fingertip, the frog's body centre). */
  landmarks?: Record<string, [number, number]>;
}

export type RigKind = 'treasure' | 'flier' | 'plant';

export const RIG_ATLAS_KEY = 'rig-parts';
/** Plant layers: share of the wind and lag (seconds) per layer. */
export const PLANT_LAYERS: Record<string, { share: number; lag: number; flutter: number }> = {
  base: { share: 0.6, lag: 0, flutter: 0 },
  'leaves-back': { share: 0.95, lag: 0.12, flutter: 0.6 },
  'leaves-front': { share: 1.2, lag: 0.28, flutter: 1 },
};
/** Most a leaf layer may turn against the base (Codex: ±6° tested, roots stay covered). */
export const PLANT_MAX_RELATIVE = 6;
