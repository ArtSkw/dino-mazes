/**
 * Jungle visitors (owner request, 15 Oct 2026): during play, now and then a
 * ladybug, a snail or a frog comes out of the jungle at the left or right
 * edge of the screen, wanders a little and disappears again (visitorPath.ts).
 * A quiet, playful detail at the edge of the eye, like the butterflies:
 *
 *   - only on the maze screen in landscape, never with reduced motion;
 *   - only where a side strip is free: below the corner buttons, above the
 *     friend (left) or above "Wróć" (right), never over the board;
 *   - the first one after 12–20 s of play, then one every 25–45 s, one at a
 *     time; a new maze or the end of a maze sends it away.
 */
import Phaser from 'phaser';
import type { Layout } from '../platform/layout';
import { RIG_ATLAS_KEY, type RigAsset } from './rigData';
import { VISITOR_KINDS, planVisit, visitDuration, visitPose, visitorRails, type Visit, type VisitorKind } from './visitorPath';

export const FIRST_VISIT_S: [number, number] = [12, 20];
export const NEXT_VISIT_S: [number, number] = [25, 45];

export interface VisitorHost {
  scene: Phaser.Scene;
  rigFor(id: string): RigAsset | null;
  depth: number;
  /** The maze screen's layout while a maze is played (not celebrating, no overlay), else null. */
  layout(): Layout | null;
  reduced(): boolean;
}

interface Live {
  visit: Visit;
  t0: number;
  container: Phaser.GameObjects.Container;
  parts: Map<string, Phaser.GameObjects.Image>;
  scale: number;
}

export class Visitors {
  private host: VisitorHost;
  private live: Live | null = null;
  private nextAt: number | null = null;
  private layoutRef: Layout | null = null;

  constructor(host: VisitorHost) {
    this.host = host;
  }

  clear(): void {
    this.live?.container.destroy();
    this.live = null;
  }

  update(now: number): void {
    const L = this.host.layout();
    if (!L || this.host.reduced()) {
      this.clear();
      this.nextAt = null;
      this.layoutRef = null;
      return;
    }
    // A new maze or a new layout: send the visitor away and start counting again.
    if (L !== this.layoutRef) {
      this.layoutRef = L;
      this.clear();
      this.nextAt = now + 1000 * rand(FIRST_VISIT_S);
    }
    if (!this.live && this.nextAt !== null && now >= this.nextAt) this.start(L, now);
    const v = this.live;
    if (!v) return;
    const t = (now - v.t0) / 1000;
    const pose = visitPose(v.visit, t);
    if (pose.done) {
      this.clear();
      this.nextAt = now + 1000 * rand(NEXT_VISIT_S);
      return;
    }
    const fade = Math.min(1, t / 0.3);
    v.container
      .setPosition(pose.x, pose.y)
      .setAngle(pose.angle)
      .setScale(pose.mirror ? -v.scale : v.scale, v.scale)
      .setAlpha(fade);
    const part = (n: string): Phaser.GameObjects.Image | undefined => v.parts.get(n);
    if (v.visit.kind === 'ladybug') {
      part('shell-left')?.setAngle(-55 * pose.wings);
      part('shell-right')?.setAngle(55 * pose.wings);
      part('wings')?.setAlpha(0.7 * pose.wings).setScale(0.85 + 0.15 * Math.abs(Math.sin(t * 40)), 1);
    } else if (v.visit.kind === 'snail') {
      part('body')?.setScale(pose.body, pose.body * (1 + 0.04 * Math.sin(t * 3)));
    } else {
      part('master')?.setVisible(!pose.jump);
      part('jump')?.setVisible(pose.jump);
    }
  }

  /** Send a visitor now (`only` picks the kind; used by the review tools and tests). */
  start(L: Layout, now: number, only?: VisitorKind): void {
    const scene = this.host.scene;
    if (!scene.textures.exists(RIG_ATLAS_KEY)) return;
    const size = Math.max(28, Math.min(48, L.vh * 0.05));
    const rails = visitorRails(L, size);
    const kinds = VISITOR_KINDS.filter((k) => this.host.rigFor(k) && (!only || k === only));
    if (!rails.length || !kinds.length) {
      this.nextAt = now + 1000 * rand(NEXT_VISIT_S);
      return;
    }
    const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
    const rail = rails[Math.floor(Math.random() * rails.length)]!;
    const asset = this.host.rigFor(kind)!;
    this.clear();
    const [cw, ch] = asset.canvas;
    const [ox, oy] = asset.origin;
    const container = scene.add.container(0, 0).setDepth(this.host.depth).setAlpha(0);
    const parts = new Map<string, Phaser.GameObjects.Image>();
    const add = (name: string, frame: string, pivot: [number, number], alpha: number): Phaser.GameObjects.Image => {
      const img = scene.add.image(pivot[0] - ox, pivot[1] - oy, RIG_ATLAS_KEY, frame).setOrigin(pivot[0] / cw, pivot[1] / ch).setAlpha(alpha);
      container.add(img);
      parts.set(name, img);
      return img;
    };
    for (const p of asset.parts) add(p.name, p.frame, p.pivot, p.restVisible === false ? 0 : p.opacity);
    if (asset.master) add('master', asset.master, [cw / 2, ch / 2], 1);
    if (asset.poses?.['jump']) add('jump', asset.poses['jump'], [cw / 2, ch / 2], 1).setVisible(false);
    const visit = planVisit(kind, rail, L.vw, size, Math.random);
    this.live = { visit, t0: now, container, parts, scale: size / Math.max(asset.size[0], asset.size[1]) };
    this.update(now);
  }

  /** For tests: the visitor on screen now. */
  get current(): { kind: VisitorKind; side: 'left' | 'right'; x: number; y: number; total: number } | null {
    const v = this.live;
    return v ? { kind: v.visit.kind, side: v.visit.side, x: v.container.x, y: v.container.y, total: visitDuration(v.visit) } : null;
  }
}

function rand([a, b]: [number, number]): number {
  return a + Math.random() * (b - a);
}
