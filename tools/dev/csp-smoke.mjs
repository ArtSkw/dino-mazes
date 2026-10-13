// Dev-only: walk the production build and report any CSP violation or page error.
import { chromium, webkit } from '@playwright/test';
const url = process.argv[2] ?? 'http://localhost:4180/?test';
for (const type of [chromium, webkit]) {
  const browser = await type.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const problems = [];
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP ${e.violatedDirective} ${e.blockedURI}`)));
  page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused/.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__dino?.ctrl?.state?.screen === 'welcome', null, { timeout: 30000 });
  await page.getByRole('button', { name: /^(Graj|Graj dalej)$/ }).click({ force: true });
  await page.getByRole('button', { name: /Szukajmy/ }).click({ force: true });
  await page.waitForTimeout(1000);
  for (let i = 0; i < 3; i++) {
    await page.locator('.play-surface').focus();
    const dir = await page.evaluate(() => window.__dino.ctrl.engine.availableDirections()[0] ?? 'up');
    await page.keyboard.press({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir]);
    await page.getByRole('button', { name: /Wyczyść ścieżkę/ }).click({ force: true });
  }
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: 'Podpowiedź motylka' }).click({ force: true });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Moje skarby' }).click({ force: true });
  await page.waitForTimeout(400);
  const asleep = await page.evaluate(() => !window.__dino.game.loop.running);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const awake = await page.evaluate(() => window.__dino.game.loop.running);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').length);
  const sw = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
  console.log(`${type.name()}: problems=${problems.length} loopAsleepUnderCollection=${asleep} awakeAfter=${awake} fontsLoaded=${fonts} serviceWorker=${sw}`);
  for (const p of problems) console.log('  ', p);
  await browser.close();
}
