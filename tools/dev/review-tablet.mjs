// Dev-only: mazes at landscape iPad sizes (owner request, 24 Oct 2026: tablets keep big-screen mazes).
// node tools/dev/review-tablet.mjs [url] [out] — writes <out>/<w>x<h>-<level>-<friend>.png per size.
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [url = 'http://localhost:5173/?test', out = '/tmp/dino-shots/tablet'] = process.argv.slice(2);
const SIZES = (process.env.SIZES ?? '1024x768,1080x810,1133x744,1180x820,1194x834,1366x1024').split(',').map((s) => s.split('x').map(Number));
// Completed mazes → level: 1 hard, 9 master, 14 grand.
const LEVELS = (process.env.LEVELS ?? '1,14').split(',').map(Number);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ready = (page) => page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });

for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
  await page.goto(url);
  await ready(page);
  for (const done of LEVELS) {
    await page.evaluate((n) => {
      const d = window.__dino;
      d.store.commit({ ...d.store.get(), introDone: true, totalCompleted: n, completedSinceSpecial: 0, activeSession: undefined });
      d.store.flush();
    }, done);
    await page.reload();
    await ready(page);
    await page.getByRole('button', { name: /^(Graj|Graj dalej)$/ }).click({ force: true });
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /Szukajmy/ }).click({ force: true });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const { state } = window.__dino.ctrl;
      const L = state.layout;
      return { grid: `${state.maze.width}x${state.maze.height}`, level: state.session.effectiveDifficulty, friend: state.session.characterId, corridor: Math.round(L.corridorPx), friendH: Math.round(L.character.h) };
    });
    await page.screenshot({ path: `${out}/${w}x${h}-${info.level}-${info.friend}.png` });
    console.log(`${w}x${h}`, JSON.stringify(info));
  }
  await page.close();
}
await browser.close();
