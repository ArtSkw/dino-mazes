import { expect, test } from '@playwright/test';

test('after the first visit the game relaunches and plays offline', async ({ page, context }) => {
  await page.goto('./?test');
  await page.waitForFunction(() => (window as never as { __dino?: { ctrl: { state: { screen: string } } } }).__dino?.ctrl.state.screen === 'welcome', null, { timeout: 30_000 });
  // Wait until the service worker controls the page and the versioned cache is complete.
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.active) return false;
    const keys = await caches.keys();
    const name = keys.find((k) => k.startsWith('dino-mazes-'));
    if (!name) return false;
    const cache = await caches.open(name);
    return (await cache.keys()).length > 40;
  }, null, { timeout: 60_000, polling: 500 });
  // Give the page a saved session, then go offline and relaunch.
  await page.getByRole('button', { name: 'Graj' }).click({ force: true });
  await page.getByRole('button', { name: 'Szukajmy!' }).click({ force: true });
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => (window as never as { __dino?: { ctrl: { state: { screen: string; loadError: boolean } } } }).__dino?.ctrl.state.screen === 'welcome', null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as never as { __dino: { ctrl: { state: { loadError: boolean } } } }).__dino.ctrl.state.loadError)).toBe(false);
  await expect(page.getByRole('button', { name: 'Graj dalej' })).toBeVisible();
  await page.getByRole('button', { name: 'Graj dalej' }).click({ force: true });
  await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'play');
  // A brand-new maze can be generated without network.
  await page.evaluate(() => {
    const d = (window as never as { __dino: { ctrl: { key(d: string): void; state: { maze: { metrics: { solution: number[] }; entranceNode: number; width: number; entrance: { outside: { x: number; y: number } } } } } } }).__dino;
    const m = d.ctrl.state.maze;
    const pos = (id: number): { x: number; y: number } => (id === m.entranceNode ? m.entrance.outside : { x: (id % m.width) + 0.5, y: Math.floor(id / m.width) + 0.5 });
    const nodes = [m.entranceNode, ...m.metrics.solution];
    for (let i = 1; i < nodes.length; i++) {
      const a = pos(nodes[i - 1]!);
      const b = pos(nodes[i]!);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      d.ctrl.key(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    }
  });
  await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'reward', null, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Kolejna przygoda' }).click({ force: true });
  await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'intro');
  await context.setOffline(false);
});
