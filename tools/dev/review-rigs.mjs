// Dev-only: the rigged treasures in the maze centre (idle) and their
// celebration, slowed down, as zoomed stills.
// Usage: node tools/dev/review-rigs.mjs [url] [outDir]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [url = 'http://localhost:5173/?test', out = '/tmp/dino-shots/rig'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const browser = await chromium.launch();
const errors = [];
const QUESTS = [['feather', 'tiny', 'tiny-feather', false], ['amber', 'giganto', 'giganto-amber', true], ['gigaflower', 'giganto', 'giganto-gigaflower', true], ['crystal', 'giganto', 'giganto-crystal', true]];
for (const [tid, cid, qid, special] of QUESTS) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errors.push(`${tid}: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
  await page.getByRole('button', { name: 'Graj' }).click({ force: true });
  await page.waitForFunction(() => window.__dino.ctrl.state.screen === 'intro');
  await page.getByRole('button', { name: 'Szukajmy!' }).click({ force: true });
  await page.waitForTimeout(600);
  await page.evaluate(([tid, cid, qid, special]) => { const c = window.__dino.ctrl; c.newSession({ keepQuestOf: { ...c.state.session, characterId: cid, questId: qid, treasureId: tid, intro: false, special }, difficultyOverride: 'hard' }); }, [tid, cid, qid, special]);
  await page.waitForTimeout(1500);
  const box = await page.evaluate(() => { const g = window.__dino.game.scene.getScene('game'); const t = g.treasure; return { x: t.x, y: t.y, s: t.displayWidth, rig: !!g.treasureRig }; });
  const clip = { x: box.x - box.s * 1.6, y: box.y - box.s * 1.6, width: box.s * 3.2, height: box.s * 3.2 };
  for (let i = 0; i < 3; i++) { await page.screenshot({ path: `${out}/${tid}-idle-${i}.png`, clip }); await page.waitForTimeout(700); }
  // Solve by keyboard, then watch the celebration at a fifth of the speed.
  const dirs = await page.evaluate(() => { const m = window.__dino.ctrl.state.maze; const pos = (id) => id === m.entranceNode ? m.entrance.outside : { x: (id % m.width) + 0.5, y: Math.floor(id / m.width) + 0.5 }; const nodes = [m.entranceNode, ...m.metrics.solution]; const o = []; for (let i = 1; i < nodes.length; i++) { const a = pos(nodes[i - 1]); const b = pos(nodes[i]); const dx = b.x - a.x; const dy = b.y - a.y; o.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); } return o; });
  await page.locator('.play-surface').focus();
  await page.evaluate(() => { const g = window.__dino.game.scene.getScene('game'); g.tweens.timeScale = 0.2; g.time.timeScale = 0.2; });
  for (const d of dirs) await page.keyboard.press(KEY[d]);
  const t0 = Date.now();
  for (let i = 0; i < 12; i++) {
    const wait = 2900 + i * 420 - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/${tid}-cel-${String(i).padStart(2, '0')}.png`, clip: { x: box.x - box.s * 1.5, y: box.y - box.s * 1.5, width: box.s * 3, height: box.s * 3 } });
  }
  console.log(tid, JSON.stringify(box));
  await page.close();
}
console.log(errors.join('\n') || 'no errors');
await browser.close();
