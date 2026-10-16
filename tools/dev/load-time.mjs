import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const results = [];
for (let run = 0; run < 3; run++) {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  // Documented test profile: 10 Mbps down, 5 Mbps up, 40 ms latency.
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: (10 * 1024 * 1024) / 8, uploadThroughput: (5 * 1024 * 1024) / 8 });
  const t0 = Date.now();
  // Pass a query (e.g. "?test&opening=full") to include the opening's assets.
  await page.goto(`http://localhost:4323/${process.argv[2] ?? '?test'}`);
  // An opening waits behind the curtains for the first tap (the curtains are the loading screen).
  await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome' || window.__dino?.ctrl?.state?.awaitingTap, null, { timeout: 60000, polling: 50 });
  const gate = Date.now() - t0;
  if (await page.evaluate(() => window.__dino.ctrl.state.awaitingTap)) await page.evaluate(() => window.__dino.ctrl.start());
  await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 60000, polling: 50 });
  const welcome = Date.now() - t0;
  await page.evaluate(() => window.__dino.ctrl.skipOpening());
  await page.evaluate(() => window.__dino.ctrl.play());
  await page.evaluate(() => window.__dino.ctrl.reveal());
  await page.waitForFunction(() => window.__dino.ctrl.state.screen === 'play');
  const drawable = Date.now() - t0;
  // The friend appears when its atlases are in.
  await page.waitForFunction(() => window.__dino.game.textures.getTextureKeys().some((k) => k.endsWith('-more')), null, { timeout: 60000, polling: 50 });
  const friendReady = Date.now() - t0;
  const bytes = await page.evaluate(() => performance.getEntriesByType('resource').reduce((a, e) => a + (e.transferSize || 0), 0) + (performance.getEntriesByType('navigation')[0]?.transferSize || 0));
  results.push({ gate, welcome, drawable, friendReady, transferredMB: +(bytes / 1e6).toFixed(2) });
  await context.close();
}
console.log(JSON.stringify(results));
await browser.close();
