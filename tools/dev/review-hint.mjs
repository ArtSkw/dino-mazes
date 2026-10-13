// Dev-only: the butterfly hint end to end (arrival in the corner, two-move pollen trail).
import { chromium } from '@playwright/test';
const [url = 'http://localhost:5173/?test', out = '/tmp/dino-shots/hint', vwS = '1180', vhS = '820'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(vwS), height: Number(vhS) }, deviceScaleFactor: 1 });
await page.goto(url);
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
// Skip the tutorial so a generated maze (with real decisions) is used.
await page.evaluate(() => { const d = window.__dino; d.store.commit({ ...d.store.get(), introDone: true, totalCompleted: 1, activeSession: undefined }); d.store.flush(); });
await page.reload();
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome');
await page.getByRole('button', { name: /^(Graj|Graj dalej)$/ }).click({ force: true });
await page.getByRole('button', { name: /Szukajmy/ }).click({ force: true });
await page.waitForTimeout(1300);
for (let i = 0; i < 3; i++) {
  await page.locator('.play-surface').focus();
  const dir = await page.evaluate(() => window.__dino.ctrl.engine.availableDirections()[0] ?? 'up');
  await page.keyboard.press({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir]);
  await page.getByRole('button', { name: /Wyczyść ścieżkę/ }).click({ force: true });
  await page.waitForTimeout(150);
}
for (const [ms, name] of [[900, 'a-arrive'], [900, 'b-arrive'], [2600, 'c-landed']]) { await page.waitForTimeout(ms); await page.screenshot({ path: `${out}/${name}.png` }); }
await page.getByRole('button', { name: 'Podpowiedź motylka' }).click({ force: true });
for (const [ms, name] of [[700, 'd-hint'], [900, 'e-hint'], [900, 'f-hint']]) { await page.waitForTimeout(ms); await page.screenshot({ path: `${out}/${name}.png` }); }
await browser.close();
