import { chromium, webkit } from '@playwright/test';
const engine = process.argv[2] ?? 'chromium';
const browser = await (engine === 'webkit' ? webkit : chromium).launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
await page.addInitScript(() => localStorage.setItem('dino-mazes:save', JSON.stringify({ schemaVersion: 1, settings: { lang: 'pl', muted: true, difficulty: 'harder', motion: 'system' }, langChosen: true, collection: {}, recentQuestIds: [], recentLayoutHashes: [], questBag: [], completedOrdinaryMazes: 1, ordinaryCompletionsSinceGiganto: 1, gigantoUnlocked: false, gigantoCompleted: 0, totalCompleted: 1, introDone: true })));
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/?test');
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
await page.evaluate(() => window.__dino.ctrl.play());
await page.evaluate(() => window.__dino.ctrl.reveal());
await page.waitForTimeout(1500);
const info = await page.evaluate(() => window.__dino.ctrl.debugInfo());
// Frame pacing while a real mouse drag draws the whole solution.
const pts = await page.evaluate(() => { const c = window.__dino.ctrl; const m = c.state.maze; const t = c.state.layout.transform; const pos = (id) => id === m.entranceNode ? m.entrance.outside : { x: (id % m.width) + 0.5, y: Math.floor(id / m.width) + 0.5 }; return [m.entranceNode, ...m.metrics.solution].map((n) => { const p = pos(n); return { x: t.ox + p.x * t.pitch, y: t.oy + p.y * t.pitch }; }); });
await page.evaluate(() => { window.__frames = []; const loop = (t) => { window.__frames.push(t); if (window.__frames.length < 100000) requestAnimationFrame(loop); }; requestAnimationFrame(loop); window.__moveCost = []; const surf = document.querySelector('.play-surface'); surf.addEventListener('pointermove', () => { const s = performance.now(); queueMicrotask(() => window.__moveCost.push(performance.now() - s)); }, true); });
await page.mouse.move(pts[0].x, pts[0].y);
await page.mouse.down();
const dragStart = Date.now();
for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 8 });
await page.mouse.up();
const dragMs = Date.now() - dragStart;
const stats = await page.evaluate(() => {
  const f = window.__frames; const d = []; for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
  d.sort((a, b) => a - b); const q = (p) => d[Math.floor(d.length * p)] ?? 0;
  // Pure engine cost: replay the solution through a fresh engine 50 times.
  const c = window.__dino.ctrl; const pts = c.engine.points.slice();
  const E = c.engine.constructor; const s = performance.now(); let moves = 0;
  for (let k = 0; k < 50; k++) { const e = new E(c.state.maze); e.begin(pts[0]); for (const p of pts.slice(1)) { e.move(p); moves++; } }
  const perMove = (performance.now() - s) / moves;
  return { frames: d.length, medianFrameMs: q(0.5).toFixed(1), p95FrameMs: q(0.95).toFixed(1), solved: c.engine.solved, trailPoints: pts.length, engineMsPerMove: perMove.toFixed(3) };
});
console.log(JSON.stringify({ engine, profile: info.profile, corridorPx: info.corridorPx, dragMs, ...stats }));
await browser.close();
