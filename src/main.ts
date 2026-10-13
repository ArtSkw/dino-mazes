/**
 * Dino Mazes entry point: wires storage, controller, renderer, UI and input.
 */
import './fonts.css';
import './styles.css';
import { Controller } from './app/controller';
import { ASSETS, assetUrl } from './game/assets';
import { SoundBoard } from './game/audio';
import { createGame } from './game/game';
import { PointerAdapter } from './input/pointer';
import { registerServiceWorker } from './platform/offline';
import { SaveStore, probeStorage } from './storage/save';
import { Ui } from './ui/ui';

const rootStyle = document.documentElement.style;
rootStyle.setProperty('--img-panel', `url(${assetUrl(ASSETS.ui['cream-panel']?.image ?? '')})`);
rootStyle.setProperty('--img-wood', `url(${assetUrl(ASSETS.ui['wood-button']?.image ?? '')})`);
rootStyle.setProperty('--img-leaf', `url(${assetUrl(ASSETS.ui['leaf-button']?.image ?? '')})`);
rootStyle.setProperty('--img-leaf-deco', `url(${assetUrl(ASSETS.ui['panel-leaf']?.image ?? '')})`);

const storage = probeStorage(() => window.localStorage);
const store = new SaveStore(storage);
const sound = new SoundBoard();
const ctrl = new Controller(store, sound, { width: () => window.innerWidth, height: () => window.innerHeight });

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
ctrl.setSystemReducedMotion(motionQuery.matches);
motionQuery.addEventListener('change', (e) => ctrl.setSystemReducedMotion(e.matches));

const uiRoot = document.getElementById('ui') as HTMLElement;
const ui = new Ui(uiRoot, ctrl);
const pointer = new PointerAdapter(ui.surface, ctrl, () => undefined);

// Opening any overlay pauses drawing input; accepted ink is preserved.
ctrl.on((e) => {
  if (e.type === 'state' && ctrl.state.overlay) pointer.interrupt();
});

const game = createGame(document.getElementById('game') as HTMLElement, ctrl, ui);

// The treasure collection is opaque and full-screen: let the GPU rest while it
// covers the canvas (saves battery on tablets), and pick up seamlessly after.
let asleep = false;
ctrl.on((e) => {
  if (e.type !== 'state') return;
  const covered = ctrl.state.overlay === 'collection';
  if (covered && !asleep && game.loop.running) {
    game.loop.sleep();
    asleep = true;
  } else if (!covered && asleep) {
    game.loop.wake(true);
    asleep = false;
  }
});

let resizeFrame = 0;
window.addEventListener('resize', () => {
  pointer.interrupt();
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => ctrl.resize());
});

document.addEventListener('visibilitychange', () => {
  sound.setHidden(document.hidden);
  if (document.hidden) {
    pointer.interrupt();
    ctrl.pause();
  }
});
window.addEventListener('pagehide', () => {
  pointer.interrupt();
  ctrl.pause();
  store.flush();
});

// First interaction anywhere unlocks gentle audio (never autoplay before it).
// Touch grants audio activation on pointerup/touchend (not pointerdown) in WebKit.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const) {
  window.addEventListener(type, () => ctrl.gesture(), { capture: true, passive: true });
}

const params = new URLSearchParams(window.location.search);
if (params.has('test') || params.has('debug')) {
  (window as unknown as { __dino: unknown }).__dino = { ctrl, store, game };
}

registerServiceWorker(ctrl);
