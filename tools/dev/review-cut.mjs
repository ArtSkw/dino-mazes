// Dev-only: does any friend's flat waist cut ever rise into view?
// Every frame, records how far each character's base (the frame's bottom
// edge, camera shake included) sits below the screen edge, through the full
// opening, greetings (neighbour hops), Giganto's distant footsteps and the
// quest-intro entrance; saves slowed-down stills of the rise.
// Usage: node tools/dev/review-cut.mjs [url] [outDir] [vw] [vh]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [url = 'http://localhost:5173/?test&opening=full', out = '/tmp/dino-shots/cut', vwS = '1180', vhS = '820'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(vwS), height: Number(vhS) }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.addInitScript(() => {
  window.__cut = { min: {}, phase: 'boot' };
  const tick = () => {
    const d = window.__dino;
    const g = d?.game?.scene?.getScene?.('game');
    if (g?.cameras?.main) {
      const cam = g.cameras.main;
      const dy = cam.shakeEffect?.isRunning ? cam.shakeEffect._offsetY ?? 0 : 0;
      const vh = g.vh; // CSS px (the canvas may be at 2x)
      const actors = [...(g.cast ?? []).map((a) => [a.id, a]), ...(g.companion ? [[`companion-${g.companion.id}`, g.companion]] : [])];
      for (const [name, a] of actors) {
        const s = a.sprite;
        if (!s?.active || !s.visible || s.alpha < 0.05) continue;
        const key = `${window.__cut.phase}:${name}`;
        const below = s.y + dy - vh; // < 0 means the hard edge is on screen
        window.__cut.min[key] = Math.min(window.__cut.min[key] ?? Infinity, below);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.goto(url);
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
await page.evaluate(() => (window.__cut.phase = 'opening'));
// Slow stills of the rise (scene time at 0.25x), then let it finish.
await page.waitForFunction(() => window.__dino.game.scene.getScene('game').cast?.length === 5, null, { timeout: 20000 });
await page.waitForTimeout(3700);
await page.evaluate(() => { const g = window.__dino.game.scene.getScene('game'); g.tweens.timeScale = 0.25; g.time.timeScale = 0.25; });
for (let i = 0; i < 8; i++) {
  await page.screenshot({ path: `${out}/rise-${i}.png`, clip: { x: 0, y: Number(vhS) * 0.35, width: Number(vwS), height: Number(vhS) * 0.65 } });
  await page.waitForTimeout(180);
}
await page.evaluate(() => { const g = window.__dino.game.scene.getScene('game'); g.tweens.timeScale = 1; g.time.timeScale = 1; });
await page.waitForFunction(() => !window.__dino.ctrl.state.opening, null, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/welcome-rest.png` });
await page.evaluate(() => (window.__cut.phase = 'greet'));
for (const id of ['bill', 'tiny', 'mazu', 'rocky', 'giganto', 'tiny']) {
  await page.locator(`.cast-btn[data-id="${id}"]`).click({ force: true });
  await page.waitForTimeout(260);
}
await page.waitForTimeout(1500);
await page.evaluate(() => (window.__cut.phase = 'footsteps'));
await page.evaluate(() => { const g = window.__dino.game.scene.getScene('game'); g.nextFootsteps = g.time.now; });
await page.waitForTimeout(1800);
await page.evaluate(() => (window.__cut.phase = 'quest'));
await page.getByRole('button', { name: /^(Graj|Graj dalej)$/ }).click({ force: true });
await page.waitForFunction(() => window.__dino.ctrl.state.screen === 'intro', null, { timeout: 10000 });
await page.waitForTimeout(1600);
await page.screenshot({ path: `${out}/quest-rest.png` });
const result = await page.evaluate(() => window.__cut.min);
const rows = Object.entries(result).map(([k, v]) => `${k.padEnd(20)} ${v.toFixed(1).padStart(6)} px below${v < 0 ? '   <-- CUT VISIBLE' : ''}`);
console.log(rows.join('\n'));
console.log(errors.join('\n') || 'no errors');
await browser.close();
