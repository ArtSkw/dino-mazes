// Dev-only: every screen at phone sizes (owner request, 15 Oct 2026: phones too).
// node tools/dev/review-phone.mjs [url] [out] — writes <out>/<w>x<h>-<screen>.png and a contact sheet per size.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [url = 'http://localhost:5173/?test', out = '/tmp/dino-shots/phone'] = process.argv.slice(2);
const SIZES = (process.env.SIZES ?? '390x844,360x780,375x667,844x390').split(',').map((s) => s.split('x').map(Number));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ready = (page) => page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });

for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const shot = (name) => page.screenshot({ path: `${out}/${w}x${h}-${name}.png` });
  await page.goto(url);
  await ready(page);
  await page.waitForTimeout(1200);
  await shot('1-welcome');
  await page.getByRole('button', { name: /^(Graj|Graj dalej)$/ }).click({ force: true });
  await page.waitForTimeout(1500);
  await shot('2-intro');
  await page.getByRole('button', { name: /Szukajmy/ }).click({ force: true });
  await page.waitForTimeout(1500);
  await shot('3-maze-first');
  await page.getByRole('button', { name: 'Ustawienia' }).click({ force: true });
  await page.waitForTimeout(500);
  await shot('4-settings');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Moje skarby' }).click({ force: true });
  await page.waitForTimeout(600);
  await shot('5-collection');
  await page.keyboard.press('Escape');
  // A later, harder maze (and some treasures in the collection).
  await page.evaluate(() => {
    const d = window.__dino;
    const now = new Date().toISOString();
    d.store.commit({ ...d.store.get(), introDone: true, totalCompleted: 14, activeSession: undefined, collection: { coconut: { count: 2, firstFoundAt: now }, flower: { count: 1, firstFoundAt: now }, amber: { count: 1, firstFoundAt: now } } });
    d.store.flush();
  });
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: /^(Graj|Graj dalej)$/ }).click({ force: true });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Szukajmy/ }).click({ force: true });
  await page.waitForTimeout(1500);
  await shot('6-maze-later');
  const info = await page.evaluate(() => {
    const s = window.__dino.ctrl.state;
    return { grid: `${s.maze.width}x${s.maze.height}`, difficulty: s.session.difficulty, corridor: Math.round(s.layout.corridorPx) };
  });
  console.log(`${w}x${h}`, JSON.stringify(info));
  await page.getByRole('button', { name: 'Moje skarby' }).click({ force: true });
  await page.waitForTimeout(600);
  await shot('7-collection-some');
  await page.close();
}
await browser.close();
