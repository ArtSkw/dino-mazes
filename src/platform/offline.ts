/**
 * Offline support (plan Phase 5). The service worker precaches the versioned
 * build. A new version waits until a safe boundary (welcome screen, quest intro
 * or reward screen) before activating, and the page is never force-reloaded,
 * so a drawing session can't be stranded. The next launch uses the new version.
 */
import type { Controller } from '../app/controller';

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
        // Check for updates now and then while the game stays open.
        window.setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
      })
      .catch(() => undefined);
  });
}
