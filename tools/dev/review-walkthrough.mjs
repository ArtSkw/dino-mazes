// Dev-only screenshot walkthrough for UI review (not part of the test suite).
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://localhost:5173/?test';
const out = process.argv[3] ?? '/tmp/dino-shots/new';
const vw = Number(process.argv[4] ?? 1180), vh = Number(process.argv[5] ?? 820);
const lang = process.argv[6] ?? 'pl';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto(url);
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
if (lang === 'en') await page.evaluate(() => window.__dino.ctrl.setLang('en'));
await page.waitForTimeout(1300);
await page.screenshot({ path: `${out}/1-welcome.png` });
await page.getByRole('button', { name: /Ustawienia|Settings/ }).click({ force: true });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/2-settings.png` });
await page.keyboard.press('Escape');
await page.getByRole('button', { name: /^(Graj|Play)$/ }).click({ force: true });
await page.waitForTimeout(1300);
await page.screenshot({ path: `${out}/3-intro.png` });
await page.getByRole('button', { name: /Szukajmy|Let's look/ }).click({ force: true });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/4-play.png` });
await page.locator('.companion-btn').click({ force: true });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/5-talk.png` });
// Two fresh starts unlock the butterfly.
const reset = page.getByRole('button', { name: /Wyczyść ścieżkę|Clear the path/ });
await page.locator('.play-surface').focus();
const first = await page.evaluate(() => { const c = window.__dino.ctrl; return c.engine.availableDirections()[0]; });
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
for (let i = 0; i < 3; i++) {
  await page.locator('.play-surface').focus();
  await page.keyboard.press(KEYS[first] ?? 'ArrowUp');
  await reset.click({ force: true });
  await page.waitForTimeout(i < 2 ? 300 : 0);
}
// The butterfly's arrival, mid-flight and after landing beside the friend.
for (const [ms, name] of [[500, '6a-fly'], [700, '6b-fly'], [700, '6c-fly'], [1400, '6-hint']]) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `${out}/${name}.png` });
}
// Solve by keyboard and wait for the reward screen.
const dirs = await page.evaluate(() => { const c = window.__dino.ctrl; const m = c.state.maze;
  const pos = (id) => id === m.entranceNode ? m.entrance.outside : { x: (id % m.width) + 0.5, y: Math.floor(id / m.width) + 0.5 };
  const nodes = [m.entranceNode, ...m.metrics.solution]; const o = [];
  for (let i = 1; i < nodes.length; i++) { const a = pos(nodes[i-1]), b = pos(nodes[i]); const dx = b.x - a.x, dy = b.y - a.y;
    o.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp')); } return o; });
await page.locator('.play-surface').focus();
for (const d of dirs) await page.keyboard.press(d);
await page.waitForFunction(() => window.__dino.ctrl.state.screen === 'reward', null, { timeout: 15000 });
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/7-reward.png` });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
