// Dev-only: the opening animation, frame by frame (?opening=full|short|fade).
import { chromium } from '@playwright/test';
const [url = 'http://localhost:5173/?test&opening=full', out = '/tmp/dino-shots/opening', vwS = '1180', vhS = '820', reduce = ''] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(vwS), height: Number(vhS) }, deviceScaleFactor: 1, reducedMotion: reduce ? 'reduce' : 'no-preference' });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
await page.goto(url);
// An opening with sound waits behind the closed curtains for the first tap.
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome' || window.__dino?.ctrl?.state?.awaitingTap, null, { timeout: 30000 });
if (await page.evaluate(() => window.__dino.ctrl.state.awaitingTap)) await page.locator('.tap-start').click();
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
const t0 = Date.now();
const times = (process.env.TIMES ?? '300,900,1500,2000,2700,3300,4200,4800,5400,6100,6600,7200,8200').split(',').map(Number);
for (const t of times) {
  const wait = t - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/t${String(t).padStart(5, '0')}.png` });
}
const st = await page.evaluate(() => ({ opening: window.__dino.ctrl.state.opening, textures: window.__dino.game.textures.getTextureKeys().filter((k) => k.startsWith('intro') || k.startsWith('char-')).sort() }));
console.log(JSON.stringify(st));
console.log(errors.join('\n') || 'no errors');
await browser.close();
