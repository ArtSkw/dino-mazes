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
// A generated maze, then each critter: on the board, then tapped.
await page.evaluate(() => { const c = window.__dino.ctrl; c.newSession({ keepQuestOf: { ...c.state.session, characterId: 'tiny', questId: 'tiny-shell', treasureId: 'shell', intro: false }, difficultyOverride: 'hard' }); });
await page.waitForTimeout(1200);
const report = [];
for (const kind of ['ladybug', 'snail', 'frog']) {
  const at = await page.evaluate((kind) => {
    const g = window.__dino.game.scene.getScene('game');
    const st = window.__dino.ctrl.state;
    g.critters.spawn({ maze: st.maze, transform: st.layout.transform, intro: false, drawing: false, quietFor: 99, playingFor: 99, endpoint: null }, g.time.now, kind);
    const c = g.critters.current; const t = st.layout.transform;
    return { x: t.ox + c.at.x * t.pitch, y: t.oy + c.at.y * t.pitch, pitch: t.pitch };
  }, kind);
  await page.waitForTimeout(700);
  const clip = { x: at.x - at.pitch * 1.2, y: at.y - at.pitch * 1.2, width: at.pitch * 2.4, height: at.pitch * 2.4 };
  await page.screenshot({ path: `${out}/3-${kind}-rest.png`, clip });
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(kind === 'ladybug' ? 450 : 250);
  const acting = await page.evaluate(() => window.__dino.game.scene.getScene('game').critters.current);
  await page.screenshot({ path: `${out}/3-${kind}-tapped.png`, clip });
  report.push({ kind, acting });
  await page.waitForTimeout(2500);
}
console.log(JSON.stringify({ welcome, hand, report }));
console.log(errors.join('\n') || 'no errors');
await browser.close();
