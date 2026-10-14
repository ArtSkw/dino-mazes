// Dev-only: the quest-intro pose shrinking into the corner (tier switch), frame by frame.
import { chromium } from '@playwright/test';
const [url = 'http://localhost:5173/?test', out = '/tmp/dino-shots/reveal', who = 'giganto'] = process.argv.slice(2);
const QUEST = { bill: 'bill-nut', tiny: 'tiny-shell', mazu: 'mazu-stone', rocky: 'rocky-flower', giganto: 'giganto-berries' };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page.goto(url);
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
await page.evaluate(([q, g]) => { const d = window.__dino; const s = d.store.get(); d.store.commit({ ...s, introDone: true, totalCompleted: 5, questBag: [q], recentQuestIds: [], activeSession: undefined, gigantoUnlocked: g, ordinaryCompletionsSinceGiganto: g ? 5 : 0 }); d.store.flush(); }, [QUEST[who], who === 'giganto']);
await page.reload();
await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome');
await page.getByRole('button', { name: /^(Graj|Graj dalej)$/ }).click({ force: true });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/${who}-0-intro.png` });
const box = async () => page.evaluate(() => { const g = window.__dino.game.scene.getScene('game'); const s = g.children.list.find((o) => o.texture?.key?.startsWith('char-') && o.visible && o.alpha > 0.5); return s ? { key: s.texture.key, x: Math.round(s.x - s.originX * s.displayWidth), w: Math.round(s.displayWidth), h: Math.round(s.displayHeight) } : null; });
const before = await box();
await page.getByRole('button', { name: /Szukajmy/ }).click({ force: true });
const seq = [];
for (const t of [16, 60, 120, 250, 400, 700]) { await page.waitForTimeout(t === 16 ? 16 : t - (seq.at(-1)?.t ?? 0)); seq.push({ t, ...(await box()) }); }
await page.screenshot({ path: `${out}/${who}-1-play.png` });
console.log(JSON.stringify({ before, seq }));
await browser.close();
