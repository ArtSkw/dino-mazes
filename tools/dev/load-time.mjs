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
  await page.goto('http://localhost:4323/?test');
  await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 60000, polling: 50 });
  const welcome = Date.now() - t0;
  await page.evaluate(() => window.__dino.ctrl.play());
  await page.evaluate(() => window.__dino.ctrl.reveal());
  await page.waitForFunction(() => window.__dino.ctrl.state.screen === 'play');
  const playable = Date.now() - t0;
  results.push({ welcome, playable });
  await context.close();
}
console.log(JSON.stringify(results));
await browser.close();
