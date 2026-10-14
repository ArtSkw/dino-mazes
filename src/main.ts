/**
 * Dino Mazes entry point: wires storage, controller, renderer, UI and input.
 */
import './fonts.css';
import './styles.css';
import { Controller, type OpeningPolicy } from './app/controller';
import { ASSETS, assetUrl } from './game/assets';
import { SoundBoard } from './game/audio';
import { createGame } from './game/game';
import { PointerAdapter } from './input/pointer';
import { registerServiceWorker } from './platform/offline';
import { SaveStore, probeStorage } from './storage/save';
import { Ui } from './ui/ui';

const rootStyle = document.documentElement.style;
// Absolute URLs: a relative url() inside a custom property resolves against the
// stylesheet that uses it (dist/assets/*.css in production), not the page, which
// produced assets/assets/... 404s on GitHub Pages.
const cssImage = (path: string | undefined): string => `url("${new URL(assetUrl(path ?? ''), document.baseURI).href}")`;
rootStyle.setProperty('--img-panel', cssImage(ASSETS.ui['cream-panel']?.image));
rootStyle.setProperty('--img-wood', cssImage(ASSETS.ui['wood-button']?.image));
rootStyle.setProperty('--img-leaf', cssImage(ASSETS.ui['leaf-button']?.image));
rootStyle.setProperty('--img-leaf-deco', cssImage(ASSETS.ui['panel-leaf']?.image));
// Seedling art: where the soil mound sits (loader and "Graj" sprout grow from it).
rootStyle.setProperty('--soil-x', `${(ASSETS.intro.sprout.soil.x * 100).toFixed(2)}%`);
rootStyle.setProperty('--soil-y', `${(ASSETS.intro.sprout.soil.y * 100).toFixed(2)}%`);
rootStyle.setProperty('--sprout-ar', `${ASSETS.intro.sprout.width} / ${ASSETS.intro.sprout.height}`);

const storage = probeStorage(() => window.localStorage);
const store = new SaveStore(storage);
const sound = new SoundBoard();
const ctrl = new Controller(store, sound, { width: () => window.innerWidth, height: () => window.innerHeight });

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
ctrl.setSystemReducedMotion(motionQuery.matches);
motionQuery.addEventListener('change', (e) => ctrl.setSystemReducedMotion(e.matches));

// Opening animation: automatic for families; off for the test hooks unless a
// test asks for one explicitly (?opening=full|short|fade).
const params = new URLSearchParams(window.location.search);
const openingParam = params.get('opening');
const policy: OpeningPolicy =
  openingParam === 'full' || openingParam === 'short' || openingParam === 'fade' || openingParam === 'off' || openingParam === 'auto'
    ? openingParam
    : params.has('test')
      ? 'off'
      : 'auto';
ctrl.planOpening(policy);

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

if (params.has('test') || params.has('debug')) {
  (window as unknown as { __dino: unknown }).__dino = { ctrl, store, game };
}

registerServiceWorker(ctrl);
