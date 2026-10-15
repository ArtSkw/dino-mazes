/**
 * Offline support (plan Phase 5). The service worker precaches the versioned
 * build. A new version waits until a safe boundary (welcome screen, quest intro
 * or reward screen) before activating, and the page is never force-reloaded,
 * so a drawing session can't be stranded. The next launch uses the new version.
 *
 * Voices are not precached (they would double the download for one language
 * nobody hears): once the game is running, the chosen language's clips are
 * fetched one by one in the background into the service worker's voice cache,
 * and clips of older recordings are dropped.
 */
import type { Controller } from '../app/controller';
import type { Lang } from '../domain/types';
import { voiceFiles } from '../game/audio';

export function registerServiceWorker(ctrl: Controller): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const safe = (): boolean => ['welcome', 'intro', 'reward'].includes(ctrl.state.screen) && !ctrl.state.celebrating;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((reg) => {
        const tryActivate = (): void => {
          if (reg.waiting && safe()) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        };
        reg.addEventListener('updatefound', () => {
          reg.installing?.addEventListener('statechange', tryActivate);
        });
        ctrl.on((e) => {
          if (e.type === 'state') tryActivate();
        });
        tryActivate();
        let kept: Lang | null = null;
        const keep = (): void => {
          if (kept === ctrl.lang) return;
          kept = ctrl.lang;
          void keepVoices(ctrl.lang);
        };
        ctrl.on((e) => {
          if (e.type === 'state') keep();
        });
        window.setTimeout(keep, 4000);
        // Check for updates now and then while the game stays open.
        window.setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
      })
      .catch(() => undefined);
  });
}

const VOICE_CACHE = 'dino-voices';
let keeping: Promise<void> = Promise.resolve();

/** Keep one language's voices for offline play (one at a time, gently), drop old takes. */
function keepVoices(lang: Lang): Promise<void> {
  keeping = keeping.then(async () => {
    if (!('caches' in window) || !navigator.serviceWorker.controller) return;
    const base = new URL(import.meta.env.BASE_URL, location.href);
    const known = new Set([...voiceFiles('pl'), ...voiceFiles('en')].map((src) => new URL(src, base).href));
    const cache = await caches.open(VOICE_CACHE);
    for (const req of await cache.keys()) if (!known.has(req.url)) await cache.delete(req);
    for (const src of voiceFiles(lang)) {
      const href = new URL(src, base).href;
      if (await cache.match(href)) continue;
      // Through the service worker, which stores it in the voice cache.
      await fetch(href).catch(() => undefined);
      await new Promise((r) => window.setTimeout(r, 30));
    }
  });
  return keeping;
}
