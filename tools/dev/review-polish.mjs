// Dev-only: the polish delivery in the running game: wind-driven plants on the
// welcome screen, the painted hand of the first maze, each hidden critter and
// its tap reaction. Usage: node tools/dev/review-polish.mjs [url] [outDir]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [url = 'http://localhost:5173/?test', out = '/tmp/dino-shots/polish'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome' && window.__dino.game.scene.getScene('game').cast?.length === 5, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const welcome = await page.evaluate(() => { const g = window.__dino.game.scene.getScene('game'); return { followers: g.rigs.size, plants: g.castPlants.length }; });
await page.screenshot({ path: `${out}/1-welcome.png` });
// The first maze: the painted hand demo.
await page.getByRole('button', { name: 'Graj' }).click({ force: true });
await page.waitForFunction(() => window.__dino.ctrl.state.screen === 'intro');
await page.getByRole('button', { name: 'Szukajmy!' }).click({ force: true });
await page.waitForTimeout(1300);
const hand = await page.evaluate(() => { const g = window.__dino.game.scene.getScene('game'); return { key: g.hand.texture.key, frame: g.hand.frame.name, visible: g.hand.visible }; });
await page.screenshot({ path: `${out}/2-hand.png` });
// A generated maze, then each jungle visitor at the screen edge, frame by frame.
await page.evaluate(() => { const c = window.__dino.ctrl; c.newSession({ keepQuestOf: { ...c.state.session, characterId: 'tiny', questId: 'tiny-shell', treasureId: 'shell', intro: false }, difficultyOverride: 'hard' }); });
await page.waitForTimeout(1200);
const report = [];
for (const kind of ['ladybug', 'snail', 'frog']) {
  const info = await page.evaluate((kind) => { const g = window.__dino.game.scene.getScene('game'); g.visitors.start(window.__dino.ctrl.state.layout, g.time.now, kind); return g.visitors.current; }, kind);
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    await page.waitForTimeout((info.total * 1000) / steps);
    const v = await page.evaluate(() => window.__dino.game.scene.getScene('game').visitors.current);
    const clipX = info.side === 'left' ? 0 : 1180 - 300;
    await page.screenshot({ path: `${out}/3-${kind}-${i}.png`, clip: { x: clipX, y: 100, width: 300, height: 560 } });
    report.push({ kind, i, at: v ? [Math.round(v.x), Math.round(v.y)] : null });
  }
}
console.log(JSON.stringify({ welcome, hand, report }));
console.log(errors.join('\n') || 'no errors');
await browser.close();
