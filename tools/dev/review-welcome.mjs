// Dev-only: welcome screen at several viewports.
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? '/tmp/dino-shots/welcome';
const browser = await chromium.launch();
for (const [w, h] of [[1024, 600], [768, 1024], [1366, 768], [1440, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173/?test');
  await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${w}x${h}.png` });
  await page.close();
}
await browser.close();
