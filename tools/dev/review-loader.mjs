// Dev-only: the loading screen (character atlases held back so it stays up).
import { chromium } from '@playwright/test';
const [url = 'http://localhost:5173/?test', out = '/tmp/dino-shots/loader'] = process.argv.slice(2);
const browser = await chromium.launch();
for (const [name, q] of [['plain', ''], ['curtains', '&opening=full']]) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
  await page.route('**/assets/characters/**', async (route) => { await new Promise((r) => setTimeout(r, 4000)); await route.continue(); });
  await page.goto(url + q);
  for (const t of [700, 1500, 2300]) { await page.waitForTimeout(t === 700 ? 700 : 800); await page.screenshot({ path: `${out}/${name}-${t}.png`, clip: { x: 440, y: 260, width: 300, height: 300 } }); }
  await page.close();
}
await browser.close();
