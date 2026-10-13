// Dev-only: rounded hedge corners up close, and a corner-cutting touch drag.
import { chromium } from '@playwright/test';
const [url = 'http://localhost:5173/?test', out = '/tmp/dino-shots/corners'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
await page.goto(url);
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
await page.evaluate(() => { const d = window.__dino; d.store.commit({ ...d.store.get(), introDone: true, totalCompleted: 4, activeSession: undefined }); d.store.flush(); });
await page.reload();
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome');
await page.getByRole('button', { name: /^(Graj|Graj dalej)$/ }).click({ force: true });
await page.getByRole('button', { name: /Szukajmy/ }).click({ force: true });
await page.waitForTimeout(1400);
const board = await page.evaluate(() => { const b = window.__dino.ctrl.state.layout.board; return { x: b.x, y: b.y, width: b.w, height: b.h }; });
await page.screenshot({ path: `${out}/board.png`, clip: board });
// Touch-drag the solution, cutting every corner diagonally (midpoint to midpoint).
const pts = await page.evaluate(() => {
  const c = window.__dino.ctrl; const m = c.state.maze; const t = c.state.layout.transform;
  const pos = (id) => id === m.entranceNode ? m.entrance.outside : { x: (id % m.width) + 0.5, y: Math.floor(id / m.width) + 0.5 };
  const nodes = [m.entranceNode, ...m.metrics.solution].map(pos);
  const mids = [nodes[0]];
  for (let i = 1; i < nodes.length; i++) mids.push({ x: (nodes[i - 1].x + nodes[i].x) / 2, y: (nodes[i - 1].y + nodes[i].y) / 2 });
  mids.push(nodes[nodes.length - 1]);
  return mids.map((p) => ({ x: t.ox + p.x * t.pitch, y: t.oy + p.y * t.pitch }));
});
const cdp = await page.context().newCDPSession(page);
const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
await touch('touchStart', pts[0]);
for (let i = 1; i < pts.length; i++) {
  const a = pts[i - 1], b = pts[i];
  for (let k = 1; k <= 8; k++) await touch('touchMove', { x: a.x + (b.x - a.x) * k / 8, y: a.y + (b.y - a.y) * k / 8 });
}
await touch('touchEnd');
await page.waitForTimeout(300);
const r = await page.evaluate(() => ({ solved: window.__dino.ctrl.engine.solved, route: window.__dino.ctrl.engine.route.length, screen: window.__dino.ctrl.state.screen }));
console.log('corner-cutting touch drag:', JSON.stringify(r));
await page.screenshot({ path: `${out}/drawn.png`, clip: board });
await browser.close();
