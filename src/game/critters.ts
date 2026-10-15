/**
 * Hidden critters (art/CODEX_REQUEST_POLISH.md): now and then a ladybug, a
 * snail or a frog sits on a hedge of the maze. They are a small surprise, not
 * a task, so they must never pull the child away from the maze:
 *
 *   - at most one per maze, on about half of the mazes, never in the first
 *     (tutorial) maze, never with reduced motion;
 *   - they appear only after a quiet moment (no drawing for a few seconds),
 *     only on hedge (critterSpots), away from the trail's end;
 *   - they keep still while the child draws;
 *   - tapped, each does its little thing: the ladybug lifts its wing cases and
 *     flies off, the snail pulls into its shell and peeks out again, the frog
 *     hops to another hedge.
 *
 * Every motion is a function of the time since it started.
 */
import Phaser from 'phaser';
import { CRITTER_RADIUS, critterSpots } from '../domain/critterSpots';
import type { Maze, Point } from '../domain/types';
import type { BoardTransform } from '../platform/layout';
import { toScreen } from '../platform/layout';
import { spring } from './motion';
import { RIG_ATLAS_KEY, type RigAsset } from './rigData';

export type CritterKind = 'ladybug' | 'snail' | 'frog';
const KINDS: CritterKind[] = ['ladybug', 'snail', 'frog'];

/** Seconds of play before a critter may come, and of quiet (no drawing) it waits for. */
export const CRITTER_AFTER_S = 10;
export const CRITTER_QUIET_S = 4;
/** Share of mazes that get a critter. */
export const CRITTER_CHANCE = 0.5;

export interface CritterHost {
  scene: Phaser.Scene;
  rigFor(id: string): RigAsset | null;
  depth: number;
  /** Current maze state, or null when no maze is being played. */
  play(): { maze: Maze; transform: BoardTransform; intro: boolean; drawing: boolean; quietFor: number; playingFor: number; endpoint: Point | null } | null;
  reduced(): boolean;
}

interface Live {
  kind: CritterKind;
  asset: RigAsset;
  container: Phaser.GameObjects.Container;
  parts: Map<string, Phaser.GameObjects.Image>;
  at: Point;
  /** Reaction in progress: what and since when (ms). */
  action: { name: 'fly' | 'hide' | 'hop'; t0: number; from: Point; to: Point } | null;
  bornAt: number;
}

export class Critters {
  private host: CritterHost;
  private live: Live | null = null;
  /** The maze (seed) this decision was made for, and whether it gets a critter. */
  private decidedFor: string | null = null;
  private wanted = false;
  private done = false;

  constructor(host: CritterHost) {
    this.host = host;
  }

  /** A new maze: forget the old critter and decide whether this one gets one. */
  reset(seed: string | null): void {
    this.clear();
    this.decidedFor = seed;
    this.wanted = seed !== null && Math.random() < CRITTER_CHANCE;
    this.done = false;
  }

  clear(): void {
    this.live?.container.destroy();
    this.live = null;
  }

  /** The child tapped the board at a logical point: does a critter react? */
  tap(p: Point): boolean {
    const c = this.live;
    if (!c || c.action) return false;
    if (Math.hypot(p.x - c.at.x, p.y - c.at.y) > CRITTER_RADIUS * 2.6) return false;
    const now = this.host.scene.time.now;
    if (c.kind === 'ladybug') {
      // Off and away: up and out over the nearest edge of the board.
      const play = this.host.play();
      const away = play ? { x: c.at.x < play.maze.width / 2 ? -2.5 : play.maze.width + 2.5, y: c.at.y - 3 } : { x: c.at.x, y: c.at.y - 4 };
      c.action = { name: 'fly', t0: now, from: c.at, to: away };
    } else if (c.kind === 'snail') {
      c.action = { name: 'hide', t0: now, from: c.at, to: c.at };
    } else {
      const play = this.host.play();
      const spots = play ? critterSpots(play.maze).filter((s) => {
        const d = Math.hypot(s.x - c.at.x, s.y - c.at.y);
        return d >= 1 && d <= 2.6 && (!play.endpoint || Math.hypot(s.x - play.endpoint.x, s.y - play.endpoint.y) > 1.5);
      }) : [];
      const to = spots.length ? spots[Math.floor(Math.random() * spots.length)]! : c.at;
      c.action = { name: 'hop', t0: now, from: c.at, to };
    }
    return true;
  }

  update(now: number): void {
    const play = this.host.play();
    if (!play || this.host.reduced()) {
      this.clear();
      return;
    }
    if (play.maze.seed !== this.decidedFor) this.reset(play.maze.seed);
    if (!this.live && this.wanted && !this.done && !play.intro && !play.drawing && play.playingFor >= CRITTER_AFTER_S && play.quietFor >= CRITTER_QUIET_S) {
      this.spawn(play, now);
    }
    const c = this.live;
    if (!c) return;
    const screen = (p: Point): Point => toScreen(play.transform, p);
    const size = play.transform.pitch * CRITTER_RADIUS * 2.3;
    const scale = size / Math.max(c.asset.size[0], c.asset.size[1]);
    const appear = Math.min(1, (now - c.bornAt) / 400);
    c.container.setAlpha(appear);
    const t = (now - c.bornAt) / 1000;
    const still = play.drawing;
    const part = (n: string): Phaser.GameObjects.Image | undefined => c.parts.get(n);
    if (!c.action) {
      const p = screen(c.at);
      c.container.setPosition(p.x, p.y).setScale(scale);
      if (still) return;
      // Small signs of life.
      if (c.kind === 'ladybug') c.container.setAngle(4 * Math.sin(t * 1.3));
      else if (c.kind === 'snail') part('body')?.setScale(1, 1 + 0.03 * Math.sin(t * 1.6));
      else c.container.setScale(scale * (1 + 0.02 * Math.sin(t * 2.2)), scale * (1 - 0.02 * Math.sin(t * 2.2)));
      return;
    }
    const a = c.action;
    const u = (now - a.t0) / 1000;
    if (a.name === 'fly') {
      // Wing cases swing open (spring), wings buzz, then it flies off in an arc.
      const open = spring(u, 0.5, 3.2);
      part('shell-left')?.setAngle(-55 * open);
      part('shell-right')?.setAngle(55 * open);
      part('wings')?.setAlpha(0.7 * Math.min(1, open)).setScale(0.85 + 0.15 * Math.abs(Math.sin(u * 40)), 1);
      // A moment to see the wings open, then an unhurried flight away.
      const k = Phaser.Math.Clamp((u - 0.6) / 1.6, 0, 1);
      const e = k * k * (3 - 2 * k);
      const pos = { x: a.from.x + (a.to.x - a.from.x) * e, y: a.from.y + (a.to.y - a.from.y) * e - Math.sin(Math.PI * k) * 0.8 };
      const p = screen(pos);
      c.container.setPosition(p.x, p.y).setScale(scale * (1 + 0.35 * Math.sin(Math.PI * Math.min(1, k * 1.4)))).setAngle((a.to.x > a.from.x ? 1 : -1) * 20 * k);
      if (k > 0.75) c.container.setAlpha((1 - k) / 0.25);
      if (k >= 1) {
        this.clear();
        this.done = true;
      }
      return;
    }
    if (a.name === 'hide') {
      // Into the shell, a moment's wait, then a careful peek out again.
      const inside = u < 0.25 ? u / 0.25 : u < 2.3 ? 1 : 1 - spring(u - 2.3, 0.6, 1.6);
      part('body')?.setScale(1 - 0.75 * inside);
      if (u > 3.6) {
        part('body')?.setScale(1);
        c.action = null;
      }
      return;
    }
    // Hop: the jump pose from the push-off to the landing, a squash on landing.
    const T = 0.6;
    const k = Phaser.Math.Clamp(u / T, 0, 1);
    const pos = { x: a.from.x + (a.to.x - a.from.x) * k, y: a.from.y + (a.to.y - a.from.y) * k - Math.sin(Math.PI * k) * 0.9 };
    const p = screen(pos);
    const airborne = u > 0.05 && k < 1;
    this.setFrogPose(c, airborne);
    const squash = u >= T ? 0.12 * Math.max(0, 1 - (u - T) / 0.25) : 0;
    c.container.setPosition(p.x, p.y).setScale(scale * (1 + squash), scale * (1 - squash));
    if (u >= T + 0.25) {
      c.at = a.to;
      c.action = null;
    }
  }

  private setFrogPose(c: Live, jump: boolean): void {
    const master = c.parts.get('master');
    const pose = c.parts.get('jump');
    master?.setVisible(!jump);
    pose?.setVisible(jump);
  }

  /** Put a critter on the board now (`only` picks the kind; used by the review tools). */
  spawn(play: NonNullable<ReturnType<CritterHost['play']>>, now: number, only?: CritterKind): void {
    const scene = this.host.scene;
    if (!scene.textures.exists(RIG_ATLAS_KEY)) return;
    const kinds = KINDS.filter((k) => this.host.rigFor(k) && (!only || k === only));
    if (!kinds.length) return;
    const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
    this.clear();
    const asset = this.host.rigFor(kind)!;
    const end = play.endpoint;
    const spots = critterSpots(play.maze).filter((s) => !end || Math.hypot(s.x - end.x, s.y - end.y) > 2);
    if (!spots.length) {
      this.done = true;
      return;
    }
    const at = spots[Math.floor(Math.random() * spots.length)]!;
    const [cw, ch] = asset.canvas;
    const [ox, oy] = asset.origin;
    const container = scene.add.container(0, 0).setDepth(this.host.depth).setAlpha(0);
    const parts = new Map<string, Phaser.GameObjects.Image>();
    const add = (name: string, frame: string, pivot: [number, number], alpha: number): void => {
      const img = scene.add.image(pivot[0] - ox, pivot[1] - oy, RIG_ATLAS_KEY, frame).setOrigin(pivot[0] / cw, pivot[1] / ch).setAlpha(alpha);
      container.add(img);
      parts.set(name, img);
    };
    for (const p of asset.parts) add(p.name, p.frame, p.pivot, p.restVisible === false ? 0 : p.opacity);
    if (asset.master) add('master', asset.master, [cw / 2, ch / 2], 1);
    if (asset.poses?.['jump']) {
      add('jump', asset.poses['jump'], [cw / 2, ch / 2], 1);
      parts.get('jump')?.setVisible(false);
    }
    // Facing any way: critters are seen from above.
    container.setRotation(kind === 'ladybug' ? 0 : Math.random() < 0.5 ? 0 : Math.PI);
    this.live = { kind, asset, container, parts, at, action: null, bornAt: now };
  }

  /** For tests: what is on the board now. */
  get current(): { kind: CritterKind; at: Point; acting: boolean } | null {
    return this.live ? { kind: this.live.kind, at: this.live.at, acting: !!this.live.action } : null;
  }
}
