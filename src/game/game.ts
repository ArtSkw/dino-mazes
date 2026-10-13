/**
 * Phaser bootstrap. The canvas covers the viewport; world units are CSS pixels
 * and the camera zooms by the (capped) device pixel ratio for crisp output.
 * Phaser input is disabled: one Pointer Events adapter owns drawing input.
 */
import Phaser from 'phaser';
import type { Controller } from '../app/controller';
import { GameScene, type UiBridge } from './scene';

export function createGame(parent: HTMLElement, ctrl: Controller, ui: UiBridge): Phaser.Game {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#d9c38c',
    banner: false,
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(w * dpr),
      height: Math.round(h * dpr),
      zoom: 1 / dpr,
      autoRound: false,
    },
    // One texture per batch. Phaser already does this on iOS/Android
    // (autoMobileTextures); on desktop Chromium, 4.2.1 multi-texture batching
    // sampled the wrong texture for some quads (plants showed pieces of
    // character sheets). With ~50 objects the extra draw calls are negligible.
    render: { antialias: true, roundPixels: false, maxTextures: 1 },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    audio: { noAudio: true },
    disableContextMenu: true,
    scene: [new GameScene(ctrl, ui)],
  });
}
