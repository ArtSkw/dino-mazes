// Dev-only: the vine loader (character atlases held back so the loading screen stays up).
import { chromium } from '@playwright/test';
const [url = 'http://localhost:5173/?test', out = '/tmp/dino-shots/loader'] = process.argv.slice(2);
const browser = await chromium.launch();
for (const [name, q] of [['plain', ''], ['curtains', '&opening=full']]) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
  await page.route('**/assets/characters/**', async (route) => { await new Promise((r) => setTimeout(r, 6000)); await route.continue(); });
  await page.goto(url + q);
  await page.waitForTimeout(800);
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(300);
    const box = await page.locator(name === 'plain' ? '.loading .vine-spinner' : '.curtains .vine-spinner').boundingBox();
    if (box) await page.screenshot({ path: `${out}/${name}-${i}.png`, clip: { x: box.x - 30, y: box.y - 30, width: box.width + 60, height: box.height + 60 } });
  }
  await page.close();
}
await browser.close();
