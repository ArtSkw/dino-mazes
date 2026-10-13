import { chromium, webkit } from '@playwright/test';
// usage: node scenario.mjs <name> <w> <h> [engine] [lang] [preset] [extra]
const [,, name, w, h, engineName = 'chromium', lang = 'pl', preset = 'fresh', extra = ''] = process.argv;
const base = { schemaVersion: 1, settings: { lang, muted: true, difficulty: 'easy', motion: 'system' }, langChosen: true, collection: {}, recentQuestIds: [], recentLayoutHashes: [], questBag: [], completedOrdinaryMazes: 0, ordinaryCompletionsSinceGiganto: 0, gigantoUnlocked: false, gigantoCompleted: 0, totalCompleted: 0, introDone: false };
const presets = {
  fresh: base,
  played: { ...base, introDone: true, totalCompleted: 2, completedOrdinaryMazes: 2, ordinaryCompletionsSinceGiganto: 2, collection: { coconut: { count: 2, firstFoundAt: 'x' }, flower: { count: 1, firstFoundAt: 'x' } }, settings: { ...base.settings, difficulty: 'medium' } },
  giganto: { ...base, introDone: true, totalCompleted: 5, completedOrdinaryMazes: 5, ordinaryCompletionsSinceGiganto: 5, gigantoUnlocked: true, collection: { coconut: { count: 2, firstFoundAt: 'x' }, nut: { count: 1, firstFoundAt: 'x' }, flower: { count: 1, firstFoundAt: 'x' }, shell: { count: 1, firstFoundAt: 'x' } } },
  harder: { ...base, introDone: true, totalCompleted: 3, completedOrdinaryMazes: 3, ordinaryCompletionsSinceGiganto: 3, settings: { ...base.settings, difficulty: 'harder' } },
};
const browser = await (engineName === 'webkit' ? webkit : chromium).launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, reducedMotion: extra.includes('reduced') ? 'reduce' : 'no-preference' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.addInitScript((save) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('dino-mazes:save', JSON.stringify(save)); sessionStorage.setItem('seeded', '1'); } }, presets[preset]);
await page.goto('http://localhost:5173/?test');
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 20000 });
await page.waitForTimeout(900);
await page.screenshot({ path: `/tmp/dino-shots/${name}-welcome.png` });
await page.evaluate(() => window.__dino.ctrl.play());
await page.waitForTimeout(1100);
await page.screenshot({ path: `/tmp/dino-shots/${name}-intro.png` });
await page.evaluate(() => window.__dino.ctrl.reveal());
await page.waitForTimeout(1200);
if (extra.includes('hint')) {
  await page.evaluate(() => window.__dino.ctrl.hint());
  await page.waitForTimeout(Number(process.env.HINT_WAIT ?? 700));
}
await page.screenshot({ path: `/tmp/dino-shots/${name}-play.png` });
console.log(name, JSON.stringify(await page.evaluate(() => window.__dino.ctrl.debugInfo())));
console.log(errors.join('\n') || 'no console errors');
await browser.close();
