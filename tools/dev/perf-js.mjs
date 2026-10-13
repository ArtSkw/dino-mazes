import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript(() => localStorage.setItem('dino-mazes:save', JSON.stringify({ schemaVersion: 1, settings: { lang: 'pl', muted: true, difficulty: 'harder', motion: 'system' }, langChosen: true, collection: {}, recentQuestIds: [], recentLayoutHashes: [], questBag: [], completedOrdinaryMazes: 1, ordinaryCompletionsSinceGiganto: 1, gigantoUnlocked: false, gigantoCompleted: 0, totalCompleted: 1, introDone: true })));
await page.goto('http://localhost:5173/?test');
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
await page.evaluate(() => { window.__dino.ctrl.play(); window.__dino.ctrl.reveal(); });
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const c = window.__dino.ctrl; const game = window.__dino.game; const m = c.state.maze;
  const pos = (id) => id === m.entranceNode ? m.entrance.outside : { x: (id % m.width) + 0.5, y: Math.floor(id / m.width) + 0.5 };
  const nodes = [m.entranceNode, ...m.metrics.solution];
  // Draw the whole solution via the controller (as pointer input would).
  c.pointerDown(pos(nodes[0]));
  for (let i = 1; i < nodes.length; i++) { const a = pos(nodes[i - 1]), b = pos(nodes[i]); for (let k = 1; k <= 12; k++) c.pointerMove({ x: a.x + (b.x - a.x) * k / 12, y: a.y + (b.y - a.y) * k / 12 }); if (i === nodes.length - 2) break; }
  const scene = game.scene.getScene('game');
  const time = (fn, n) => { const s = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - s) / n; };
  const drawTrail = time(() => scene.drawTrail(), 50);
  const step = time(() => game.step(performance.now(), 16), 30);
  return { points: c.engine.points.length, drawTrailMs: drawTrail.toFixed(2), gameStepMs: step.toFixed(2) };
});
console.log(JSON.stringify(r));
await browser.close();
