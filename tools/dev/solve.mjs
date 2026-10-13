import { chromium, webkit } from '@playwright/test';
const [,, url = 'http://localhost:5173/?test', out = '/tmp/dino-shots', w = '1180', h = '820', engineName = 'chromium'] = process.argv;
const browser = await (engineName === 'webkit' ? webkit : chromium).launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 20000 });
await page.getByRole('button', { name: /Graj|Play/ }).click({ force: true });
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Szukajmy|Let's look/ }).click({ force: true });
await page.waitForTimeout(1200);
// Solution path in screen coordinates
const pts = await page.evaluate(() => {
  const c = window.__dino.ctrl; const m = c.state.maze; const t = c.state.layout.transform;
  const pos = (id) => id === m.entranceNode ? m.entrance.outside : { x: (id % m.width) + 0.5, y: Math.floor(id / m.width) + 0.5 };
  const nodes = [m.entranceNode, ...m.metrics.solution];
  return nodes.map((n) => { const p = pos(n); return { x: t.ox + p.x * t.pitch, y: t.oy + p.y * t.pitch }; });
});
await page.mouse.move(pts[0].x, pts[0].y);
await page.mouse.down();
for (let i = 1; i < pts.length; i++) {
  // human-ish wobble while moving
  await page.mouse.move(pts[i].x + (i % 2 ? 4 : -3), pts[i].y + (i % 3 ? -3 : 4), { steps: 12 });
  if (i === Math.floor(pts.length / 2)) {
    await page.mouse.up();
    await page.screenshot({ path: `${out}/4-drawing.png` });
    await page.mouse.down();
  }
}
await page.mouse.move(pts[pts.length - 1].x, pts[pts.length - 1].y, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/5-celebrating.png` });
await page.waitForFunction(() => window.__dino.ctrl.state.screen === 'reward', null, { timeout: 8000 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/6-reward.png` });
const state = await page.evaluate(() => ({ screen: window.__dino.ctrl.state.screen, collection: window.__dino.store.get().collection, total: window.__dino.store.get().totalCompleted }));
console.log(JSON.stringify(state));
await page.getByRole('button', { name: /Moje skarby|My treasures/ }).click({ force: true });
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/7-collection.png` });
await page.keyboard.press('Escape');
await page.getByRole('button', { name: /Ustawienia|Settings/ }).click({ force: true });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/8-settings.png` });
await page.keyboard.press('Escape');
await page.getByRole('button', { name: /Kolejna przygoda|Next adventure/ }).click({ force: true });
await page.waitForTimeout(1300);
await page.screenshot({ path: `${out}/9-next-intro.png` });
console.log(errors.join('\n') || 'no console errors');
await browser.close();
