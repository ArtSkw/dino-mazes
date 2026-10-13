// Dev-only: intro + play (with speech bubble) for every friend at one viewport.
import { chromium } from '@playwright/test';
const [url = 'http://localhost:5173/?test', out = '/tmp/dino-shots/matrix', vwS = '1180', vhS = '820', lang = 'pl', only = ''] = process.argv.slice(2);
const vw = Number(vwS), vh = Number(vhS);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
const QUEST = { bill: 'bill-nut', tiny: 'tiny-shell', mazu: 'mazu-stone', rocky: 'rocky-flower', giganto: 'giganto-berries' };
const ids = only ? only.split(',') : ['bill', 'tiny', 'mazu', 'rocky', 'giganto'];
for (const id of ids) {
  await page.evaluate(([id, q, lang]) => {
    const d = window.__dino; const save = d.store.get();
    const giganto = id === 'giganto';
    d.store.commit({ ...save, introDone: true, totalCompleted: 5, questBag: [q], recentQuestIds: [], activeSession: undefined, collection: {},
      gigantoUnlocked: giganto, ordinaryCompletionsSinceGiganto: giganto ? 5 : 0, settings: { ...save.settings, lang }, langChosen: true });
    d.store.flush();
  }, [id, QUEST[id], lang]);
  await page.reload();
  await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^(Graj|Play|Graj dalej|Continue)$/ }).click({ force: true });
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${out}/${vw}x${vh}-${id}-intro.png` });
  await page.getByRole('button', { name: /Szukajmy|Let's look/ }).click({ force: true });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${out}/${vw}x${vh}-${id}-play.png` });
  await page.locator('.companion-btn').click({ force: true });
  await page.locator('.companion-btn').click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${vw}x${vh}-${id}-talk.png` });
  // Three fresh starts with real drawing: the butterfly comes to the friend.
  for (let i = 0; i < 3; i++) {
    await page.locator('.play-surface').focus();
    const dir = await page.evaluate(() => window.__dino.ctrl.engine.availableDirections()[0] ?? 'up');
    await page.keyboard.press({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir]);
    await page.getByRole('button', { name: /Wyczyść ścieżkę|Clear the path/ }).click({ force: true });
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(3200);
  await page.locator('.companion-btn').click({ force: true });
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/${vw}x${vh}-${id}-hint.png` });
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
