import { expect, test, type Page } from '@playwright/test';

type Pt = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

const KEY: Record<Dir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

async function boot(page: Page, query = '?test'): Promise<void> {
  await page.goto(query);
  await page.waitForFunction(() => (window as never as { __dino?: { ctrl: { state: { screen: string } } } }).__dino?.ctrl.state.screen === 'welcome', null, { timeout: 30_000 });
}

async function state<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(() => { const d = window.__dino; const c = d.ctrl; const s = d.store; return ${fn}; })()`) as Promise<T>;
}

async function startQuest(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(Graj|Play|Graj dalej|Continue)$/ }).click({ force: true });
  await page.waitForFunction(() => ['intro', 'play', 'reward'].includes((window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen));
  if ((await state<string>(page, 'c.state.screen')) === 'intro') {
    await page.getByRole('button', { name: /Szukajmy|Let's look/ }).click({ force: true });
  }
  await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'play');
}

/** Solution path (entrance → treasure) in screen coordinates. */
async function solutionPoints(page: Page): Promise<Pt[]> {
  return state<Pt[]>(
    page,
    `(() => { const m = c.state.maze; const t = c.state.layout.transform;
      const pos = (id) => id === m.entranceNode ? m.entrance.outside : { x: (id % m.width) + 0.5, y: Math.floor(id / m.width) + 0.5 };
      return [m.entranceNode, ...m.metrics.solution].map((n) => { const p = pos(n); return { x: t.ox + p.x * t.pitch, y: t.oy + p.y * t.pitch }; }); })()`,
  );
}

async function solutionDirs(page: Page): Promise<Dir[]> {
  return state<Dir[]>(
    page,
    `(() => { const m = c.state.maze;
      const pos = (id) => id === m.entranceNode ? m.entrance.outside : { x: (id % m.width) + 0.5, y: Math.floor(id / m.width) + 0.5 };
      const nodes = [m.entranceNode, ...m.metrics.solution]; const out = [];
      for (let i = 1; i < nodes.length; i++) { const a = pos(nodes[i-1]), b = pos(nodes[i]); const dx = b.x - a.x, dy = b.y - a.y;
        out.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }
      return out; })()`,
  );
}

async function drag(page: Page, pts: Pt[], steps = 10): Promise<void> {
  await page.mouse.move(pts[0]!.x, pts[0]!.y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps });
  await page.mouse.up();
}

/** Language and sound live only in the parents' settings panel. */
async function chooseLanguage(page: Page, name: 'Polski' | 'English'): Promise<void> {
  await page.getByRole('button', { name: /^(Ustawienia|Settings)$/ }).click({ force: true });
  await page.getByRole('button', { name, exact: true }).click({ force: true });
  await page.keyboard.press('Escape');
}

/** Draw a little, then press "Wróć": one fresh start that counts towards the butterfly. */
async function drawAndReset(page: Page, times: number): Promise<void> {
  const pts = await solutionPoints(page);
  for (let i = 0; i < times; i++) {
    await drag(page, pts.slice(0, 2));
    await page.getByRole('button', { name: /Wyczyść ścieżkę|Clear the path/ }).click({ force: true });
    await page.waitForTimeout(80);
  }
}

type Box = { x: number; y: number; width: number; height: number };
const boxesOverlap = (a: Box, b: Box): boolean => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

async function solveByKeyboard(page: Page): Promise<void> {
  const dirs = await solutionDirs(page);
  await page.locator('.play-surface').focus();
  for (const d of dirs) await page.keyboard.press(KEY[d]);
}

test.describe('language', () => {
  test('fresh install opens in Polish even with an English browser', async ({ page }) => {
    await boot(page);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pl');
    await expect(page.getByRole('button', { name: 'Graj' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dino Labirynty' })).toBeVisible();
  });

  test('switching language mid-maze keeps the drawn trail and persists', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    const pts = await solutionPoints(page);
    await drag(page, pts.slice(0, 3));
    const before = await state<number>(page, 'c.engine.points.length');
    expect(before).toBeGreaterThan(3);
    await chooseLanguage(page, 'English');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    await expect(page.getByRole('button', { name: /Clear the path/ })).toBeVisible();
    expect(await state<number>(page, 'c.engine.points.length')).toBe(before);
    await page.reload();
    await page.waitForFunction(() => (window as never as { __dino?: { ctrl: { state: { screen: string } } } }).__dino?.ctrl.state.screen === 'welcome');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await startQuest(page);
    expect(await state<number>(page, 'c.engine.points.length')).toBe(before);
  });
});

test.describe('drawing contract', () => {
  test('solving by pointer awards exactly once, even across reloads', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    await drag(page, await solutionPoints(page));
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { celebrating: boolean; screen: string } } } }).__dino.ctrl.state.screen === 'reward' || (window as never as { __dino: { ctrl: { state: { celebrating: boolean } } } }).__dino.ctrl.state.celebrating);
    // Reload in the middle of the celebration.
    await page.reload();
    await page.waitForFunction(() => (window as never as { __dino?: { ctrl: { state: { screen: string } } } }).__dino?.ctrl.state.screen === 'welcome');
    expect(await state<number>(page, 's.get().collection.coconut.count')).toBe(1);
    expect(await state<number>(page, 's.get().totalCompleted')).toBe(1);
    await page.getByRole('button', { name: 'Graj dalej' }).click({ force: true });
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'reward');
    expect(await state<number>(page, 's.get().collection.coconut.count')).toBe(1);
    // Repeated taps on "Next" create exactly one new session.
    await expect(page.getByRole('button', { name: 'Kolejna przygoda' })).toBeVisible();
    const id0 = await state<string>(page, 'c.state.session.id');
    // A double tap: two clicks in the same tick.
    await page.evaluate(() => {
      const b = document.querySelector('.next-btn') as HTMLButtonElement;
      b.click();
      b.click();
    });
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'intro');
    const id1 = await state<string>(page, 'c.state.session.id');
    expect(id1).not.toBe(id0);
    expect(await state<number>(page, 's.get().totalCompleted')).toBe(1);
  });

  test('a disconnected tap on the treasure or a fast swipe cannot solve', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    const pts = await solutionPoints(page);
    const goal = pts[pts.length - 1]!;
    await page.mouse.click(goal.x, goal.y);
    expect(await state<number>(page, 'c.engine.points.length')).toBe(0);
    await drag(page, [pts[0]!, goal], 1);
    expect(await state<boolean>(page, 'c.engine.solved')).toBe(false);
    expect(await state<string>(page, 'c.state.screen')).toBe('play');
  });

  test('"Wróć" clears the whole attempt in the same maze and the entrance works at once', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    const seed = await state<string>(page, 'c.state.maze.seed');
    const pts = await solutionPoints(page);
    await drag(page, pts.slice(0, 4));
    expect(await state<number>(page, 'c.engine.points.length')).toBeGreaterThan(3);
    await page.getByRole('button', { name: 'Wyczyść ścieżkę i wróć na początek' }).click({ force: true });
    expect(await state<number>(page, 'c.engine.points.length')).toBe(0);
    expect(await state<string>(page, 'c.state.maze.seed')).toBe(seed);
    await page.waitForTimeout(250);
    await drag(page, pts.slice(0, 2));
    expect(await state<number>(page, 'c.engine.points.length')).toBeGreaterThan(1);
  });

  test('lifting preserves ink; pressing elsewhere does not start a new trail', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    const pts = await solutionPoints(page);
    await drag(page, pts.slice(0, 3));
    const n = await state<number>(page, 'c.engine.points.length');
    const far = pts[pts.length - 1]!;
    await drag(page, [far, { x: far.x + 30, y: far.y }]);
    expect(await state<number>(page, 'c.engine.points.length')).toBe(n);
    // Resume from the endpoint.
    await drag(page, pts.slice(2, 4));
    expect(await state<number>(page, 'c.engine.points.length')).toBeGreaterThan(n);
  });

  test('opening the collection and settings restores the exact trail', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    await drag(page, (await solutionPoints(page)).slice(0, 4));
    const before = await state<string>(page, 'JSON.stringify(c.engine.points)');
    await page.getByRole('button', { name: 'Moje skarby' }).click({ force: true });
    await expect(page.getByRole('dialog', { name: 'Moje skarby' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Ustawienia' }).click({ force: true });
    await page.keyboard.press('Escape');
    expect(await state<string>(page, 'JSON.stringify(c.engine.points)')).toBe(before);
    expect(await state<string>(page, 'c.state.screen')).toBe('play');
  });

  test('hint never extends the trail', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    await drag(page, (await solutionPoints(page)).slice(0, 3));
    await drawAndReset(page, 3);
    await drag(page, (await solutionPoints(page)).slice(0, 3));
    const n = await state<number>(page, 'c.engine.points.length');
    await page.getByRole('button', { name: 'Podpowiedź motylka' }).click({ force: true });
    await page.waitForTimeout(600);
    expect(await state<number>(page, 'c.engine.points.length')).toBe(n);
    expect(await state<boolean>(page, 'c.state.session.hintUsed')).toBe(true);
  });

  test('keyboard arrows complete the maze with the same rules', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    await page.locator('.play-surface').focus();
    await page.keyboard.press('ArrowLeft'); // into a hedge: nothing happens
    expect(await state<number>(page, 'c.engine.points.length')).toBe(0);
    await solveByKeyboard(page);
    // The celebration is skippable once the outcome is clear; the reward is already saved.
    expect(await state<boolean>(page, 'c.state.celebrating')).toBe(true);
    expect(await state<number>(page, 's.get().totalCompleted')).toBe(1);
    await page.getByRole('button', { name: 'Pomiń' }).click({ force: true });
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'reward', null, { timeout: 3_000 });
    expect(await state<number>(page, 's.get().totalCompleted')).toBe(1);
  });

  test('resize while drawing keeps the trail and the board', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    await drag(page, (await solutionPoints(page)).slice(0, 4));
    const before = await state<string>(page, 'JSON.stringify(c.engine.points)');
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(400);
    expect(await state<string>(page, 'JSON.stringify(c.engine.points)')).toBe(before);
    // Continue drawing in the new layout from the endpoint.
    const pts = await solutionPoints(page);
    await drag(page, pts.slice(3, 6));
    expect(await state<number>(page, 'c.engine.route.length')).toBeGreaterThan(4);
  });
});

test.describe('storage', () => {
  test('corrupt storage falls back to a playable game', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('dino-mazes:save', '{broken'));
    await boot(page);
    await startQuest(page);
    expect(await state<string>(page, 'c.state.storage')).toBe('recovered');
    await solveByKeyboard(page);
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'reward');
  });
});

test.describe('reliability', () => {
  test('twenty completions: one reward each, Giganto at 6/11/16, all six treasures', async ({ page }) => {
    test.setTimeout(300_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page);
    await page.getByRole('button', { name: 'Graj' }).click({ force: true });
    const specials: number[] = [];
    for (let i = 1; i <= 20; i++) {
      await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'intro');
      if (await state<boolean>(page, 'c.state.session.special')) specials.push(i);
      await page.getByRole('button', { name: 'Szukajmy!' }).click({ force: true });
      await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'play');
      if (i % 2 === 0) {
        // Ten collection round-trips mid-maze.
        await page.getByRole('button', { name: 'Moje skarby' }).click({ force: true });
        await page.keyboard.press('Escape');
      }
      await solveByKeyboard(page);
      await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'reward', null, { timeout: 20_000 });
      expect(await state<number>(page, 's.get().totalCompleted')).toBe(i);
      await page.getByRole('button', { name: 'Kolejna przygoda' }).click({ force: true });
    }
    expect(specials).toEqual([6, 11, 16]);
    const counts = await state<Record<string, { count: number }>>(page, 's.get().collection');
    expect(Object.keys(counts).sort()).toEqual(['berries', 'coconut', 'flower', 'nut', 'shell', 'stone']);
    expect(Object.values(counts).reduce((a, b) => a + b.count, 0)).toBe(20);
    // Live resources stay bounded: old board textures are released.
    await page.waitForTimeout(600);
    const boards = await state<number>(page, "Object.keys(window.__dino.game.textures.list).filter((k) => k.startsWith('board-')).length");
    expect(boards).toBeLessThanOrEqual(2);
  });
});

test.describe('touch', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'synthetic touch pointer events');
  test('touch pointers draw; a second finger is ignored', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    const pts = await solutionPoints(page);
    await page.evaluate((path) => {
      const el = document.querySelector('.play-surface') as HTMLElement;
      const fire = (type: string, p: { x: number; y: number }, id: number, primary: boolean): void => {
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: primary, clientX: p.x, clientY: p.y, buttons: 1 }));
      };
      fire('pointerdown', path[0]!, 1, true);
      // A second finger lands far away and moves: must not draw.
      fire('pointerdown', path[path.length - 1]!, 2, false);
      fire('pointermove', path[path.length - 2]!, 2, false);
      for (let i = 1; i < 3; i++) {
        const a = path[i - 1]!;
        const b = path[i]!;
        for (let k = 1; k <= 8; k++) fire('pointermove', { x: a.x + ((b.x - a.x) * k) / 8, y: a.y + ((b.y - a.y) * k) / 8 }, 1, true);
      }
      fire('pointerup', path[2]!, 1, true);
      fire('pointerup', path[path.length - 2]!, 2, false);
    }, pts);
    expect(await state<number>(page, 'c.engine.route.length')).toBe(3);
    expect(await state<boolean>(page, 'c.engine.solved')).toBe(false);
  });
});

test.describe('special guest and settings', () => {
  test("Giganto's quest steps up one level and the easier maze restarts it at the normal level", async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('dino-mazes:save', JSON.stringify({
        schemaVersion: 1, settings: { lang: 'pl', muted: true, difficulty: 'easy', motion: 'system' }, langChosen: true,
        collection: {}, recentQuestIds: [], recentLayoutHashes: [], questBag: [], completedOrdinaryMazes: 5,
        ordinaryCompletionsSinceGiganto: 5, gigantoUnlocked: true, gigantoCompleted: 0, totalCompleted: 5, introDone: true,
      }));
    });
    await boot(page);
    await startQuest(page);
    expect(await state<string>(page, 'c.state.session.characterId')).toBe('giganto');
    expect(await state<string>(page, 'c.state.session.effectiveDifficulty')).toBe('master');
    expect(await state<string>(page, 'c.state.layout.corner')).toBe('left');
    const quest = await state<string>(page, 'c.state.session.questId');
    await drag(page, (await solutionPoints(page)).slice(0, 3));
    await page.getByRole('button', { name: 'Ustawienia' }).click({ force: true });
    await page.getByRole('button', { name: 'Łatwiejszy labirynt' }).click({ force: true });
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { session: { effectiveDifficulty: string } } } } }).__dino.ctrl.state.session.effectiveDifficulty === 'expert');
    expect(await state<string>(page, 'c.state.session.questId')).toBe(quest);
    expect(await state<number>(page, 'c.engine.points.length')).toBe(0);
    expect(await state<string>(page, 'c.state.screen')).toBe('play');
    expect(await state<number>(page, 's.get().totalCompleted')).toBe(5);
  });

  test('English has full parity on every screen', async ({ page }) => {
    await boot(page);
    await chooseLanguage(page, 'English');
    await expect(page.getByRole('heading', { name: 'Dino Mazes' })).toBeVisible();
    await page.getByRole('button', { name: 'Play' }).click({ force: true });
    await expect(page.getByText("Bill is looking for a coconut. Let's find it together!")).toBeVisible();
    await page.getByRole('button', { name: "Let's look!" }).click({ force: true });
    await expect(page.getByRole('button', { name: 'Clear the path and go back to the start' })).toBeVisible();
    await expect(page.locator('.reset-btn .label')).toHaveText('Start over');
    await expect(page.getByRole('button', { name: 'Bill. Tap to talk.' })).toBeVisible();
    await drawAndReset(page, 3);
    await expect(page.getByRole('button', { name: 'Butterfly hint' })).toBeVisible();
    await solveByKeyboard(page);
    await expect(page.getByRole('button', { name: 'Next adventure' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'My treasures' }).click({ force: true });
    await expect(page.getByRole('heading', { name: 'My treasures' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Coconut\. Found: 1/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings' }).click({ force: true });
    await expect(page.getByRole('heading', { name: 'For parents' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start the game over' })).toBeVisible();
    // Nothing Polish leaks into the visible English UI.
    const text = await page.evaluate(() => document.getElementById('ui')!.innerText);
    for (const word of ['Graj', 'Wróć', 'Szukajmy', 'Kolejna', 'Moje skarby', 'Ustawienia', 'Zacznij']) expect(text).not.toContain(word);
  });

  test('tapping a friend on the welcome screen waves without starting a game', async ({ page }) => {
    await boot(page);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Miłka' }).click({ force: true });
    expect(await state<string>(page, 'c.state.screen')).toBe('welcome');
  });
});

test.describe('owner review fixes (13 October 2026)', () => {
  test('friends use their Polish dub names in Polish and English names in English', async ({ page }) => {
    await boot(page);
    for (const name of ['Dudek', 'Miłka', 'Rudzia', 'Czupur', 'Giganto']) await expect(page.getByRole('button', { name, exact: true })).toBeAttached();
    await startQuest(page);
    await expect(page.getByRole('button', { name: 'Dudek. Dotknij, żeby porozmawiać.' })).toBeVisible();
    expect(await state<string>(page, 'c.questPrompt()')).toBe('Dudek szuka kokosa. Znajdźmy go razem!');
  });

  test('the corner friend is the quest reminder: a tap shows a speech bubble', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    await expect(page.locator('.quest-chip')).toHaveCount(0);
    const friend = page.getByRole('button', { name: /Dotknij, żeby porozmawiać/ });
    await friend.click();
    await expect(page.locator('.bubble')).toBeVisible();
    await expect(page.locator('.bubble')).toHaveText('Pomożesz mi znaleźć kokos?');
    await friend.click();
    await expect(page.locator('.bubble')).not.toHaveText('Pomożesz mi znaleźć kokos?');
    // Talking never touches the drawing.
    expect(await state<number>(page, 'c.engine.points.length')).toBe(0);
  });

  test('the butterfly appears only after three fresh starts that cleared real drawing', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    const hint = page.getByRole('button', { name: 'Podpowiedź motylka' });
    await expect(hint).toBeHidden();
    await page.getByRole('button', { name: 'Wyczyść ścieżkę i wróć na początek' }).click({ force: true });
    await page.getByRole('button', { name: 'Wyczyść ścieżkę i wróć na początek' }).click({ force: true });
    await expect(hint).toBeHidden(); // resets of an empty trail do not count
    await drawAndReset(page, 2);
    await expect(hint).toBeHidden();
    await drawAndReset(page, 1);
    await expect(hint).toBeVisible();
    // It waits in the top-left corner, mirroring the right-hand buttons.
    const vp = page.viewportSize()!;
    const hb = (await hint.boundingBox())!;
    const settings = (await page.locator('.cluster .settings-btn').boundingBox())!;
    expect(hb.x).toBeCloseTo(vp.width - (settings.x + settings.width), 0);
    expect(hb.y).toBeCloseTo(settings.y, 0);
    expect(hb.width).toBeCloseTo(settings.width, 0);
    // The count belongs to this maze and survives a reload.
    await page.reload();
    await page.waitForFunction(() => (window as never as { __dino?: { ctrl: { state: { screen: string } } } }).__dino?.ctrl.state.screen === 'welcome');
    await startQuest(page);
    await expect(hint).toBeVisible();
  });

  test('collection and settings buttons keep one size and place on every screen', async ({ page }) => {
    await boot(page);
    const boxes = async (): Promise<Box[]> => Promise.all([page.locator('.cluster .collection-btn'), page.locator('.cluster .settings-btn')].map(async (l) => (await l.boundingBox())!));
    const welcome = await boxes();
    // Equal size, side by side in one row.
    expect(welcome[0]!.width).toBeCloseTo(welcome[1]!.width, 0);
    expect(welcome[0]!.height).toBeCloseTo(welcome[1]!.height, 0);
    expect(welcome[0]!.y).toBeCloseTo(welcome[1]!.y, 0);
    expect(welcome[1]!.x).toBeGreaterThan(welcome[0]!.x + welcome[0]!.width);
    await page.getByRole('button', { name: /^(Graj|Play|Graj dalej|Continue)$/ }).click({ force: true });
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'intro');
    const intro = await boxes();
    await page.getByRole('button', { name: /Szukajmy|Let's look/ }).click({ force: true });
    await page.waitForTimeout(300);
    const play = await boxes();
    for (const other of [intro, play]) {
      for (let i = 0; i < 2; i++) {
        expect(other[i]!.x).toBeCloseTo(welcome[i]!.x, 0);
        expect(other[i]!.y).toBeCloseTo(welcome[i]!.y, 0);
        expect(other[i]!.width).toBeCloseTo(welcome[i]!.width, 0);
      }
    }
    // The friend carries no badge or emblem; tapping it is the whole interaction.
    await expect(page.locator('.talk-badge')).toHaveCount(0);
    await expect(page.locator('.companion-btn *')).toHaveCount(0);
  });

  test('"Ekran startowy" sits with the corner buttons on maze screens only, never in settings', async ({ page }) => {
    await boot(page);
    const home = page.getByRole('button', { name: 'Ekran startowy' });
    await expect(home).toBeHidden();
    await page.getByRole('button', { name: 'Ustawienia' }).click({ force: true });
    await expect(page.locator('.settings').getByRole('button', { name: 'Ekran startowy' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await startQuest(page);
    await expect(home).toBeVisible();
    const hb = (await home.boundingBox())!;
    const chest = (await page.locator('.cluster .collection-btn').boundingBox())!;
    expect(hb.width).toBeCloseTo(chest.width, 0);
    await home.click();
    expect(await state<string>(page, 'c.state.screen')).toBe('welcome');
    await expect(page.getByRole('button', { name: 'Graj dalej' })).toBeVisible();
  });

  test('"Zacznij grę od nowa" (maze screens only) clears treasures and mazes and starts at the tutorial again', async ({ page }) => {
    await boot(page);
    // Not offered from the welcome screen.
    await page.getByRole('button', { name: 'Ustawienia' }).click({ force: true });
    await expect(page.getByRole('button', { name: 'Zacznij grę od nowa' })).toBeHidden();
    await expect(page.getByText('Trudność labiryntu')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await startQuest(page);
    await solveByKeyboard(page);
    await page.getByRole('button', { name: 'Pomiń' }).click({ force: true });
    await expect(page.getByRole('button', { name: 'Kolejna przygoda' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Kolejna przygoda' }).click({ force: true });
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'intro');
    expect(await state<number>(page, 's.get().totalCompleted')).toBe(1);
    await page.getByRole('button', { name: 'Ustawienia' }).click({ force: true });
    await page.getByRole('button', { name: 'Zacznij grę od nowa' }).click({ force: true });
    await page.getByRole('button', { name: 'Tak, od nowa' }).click({ force: true });
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'welcome');
    expect(await state<number>(page, 's.get().totalCompleted')).toBe(0);
    expect(await state<number>(page, 'Object.keys(s.get().collection).length')).toBe(0);
    expect(await state<boolean>(page, 's.get().activeSession === undefined')).toBe(true);
    await expect(page.getByRole('button', { name: 'Graj', exact: true })).toBeVisible();
    await startQuest(page);
    // A brand-new game: the tutorial maze with Dudek and the coconut again.
    expect(await state<string>(page, 'c.state.session.questId')).toBe('bill-coconut');
    expect(await state<boolean>(page, 'c.state.session.intro')).toBe(true);
  });

  test('settings is the only place for language and sound', async ({ page }) => {
    await boot(page);
    await expect(page.locator('.cluster button')).toHaveCount(2);
    await page.getByRole('button', { name: 'Ustawienia' }).click({ force: true });
    const off = page.getByRole('group', { name: 'Dźwięk' }).getByRole('button', { name: 'Wyłączony' });
    await off.click();
    expect(await state<boolean>(page, 's.get().settings.muted')).toBe(true);
    await expect(off).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('group', { name: 'Dźwięk' }).getByRole('button', { name: 'Włączony' }).click();
    expect(await state<boolean>(page, 's.get().settings.muted')).toBe(false);
  });

  test('no UI overlap: welcome, settings close button, play controls, next button', async ({ page }) => {
    await boot(page);
    await page.waitForTimeout(500);
    const card = (await page.locator('.welcome-card').boundingBox())!;
    for (const b of await page.locator('.cluster button').all()) expect(boxesOverlap(card, (await b.boundingBox())!)).toBe(false);
    for (const b of await page.locator('.cast-btn').all()) expect(boxesOverlap(card, (await b.boundingBox())!)).toBe(false);
    // Welcome card is centred horizontally.
    const vp = page.viewportSize()!;
    expect(Math.abs(card.x + card.width / 2 - vp.width / 2)).toBeLessThan(2);

    // Settings: the close button sits wholly inside the panel's frame, not on its edge.
    await page.getByRole('button', { name: 'Ustawienia' }).click({ force: true });
    await page.waitForTimeout(400); // panel entrance
    const panel = (await page.locator('.settings-panel').boundingBox())!;
    const close = (await page.locator('.settings .close-btn').boundingBox())!;
    expect(close.x).toBeGreaterThanOrEqual(panel.x + 34 - 1);
    expect(close.y).toBeGreaterThanOrEqual(panel.y + 34 - 1);
    expect(close.x + close.width).toBeLessThanOrEqual(panel.x + panel.width - 34 + 1);
    await expect(page.locator('.settings .close-btn')).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Escape');

    await startQuest(page);
    await drawAndReset(page, 3);
    await page.getByRole('button', { name: /Dotknij, żeby porozmawiać/ }).click();
    await page.waitForTimeout(350);
    // Read the speech bubble first: it hides itself after a few seconds.
    const named: Array<[string, Box]> = [['.bubble', (await page.locator('.bubble').boundingBox())!]];
    expect(named[0]![1], '.bubble').not.toBeNull();
    const board = await state<Box>(page, '(() => { const b = c.state.layout.board; return { x: b.x, y: b.y, width: b.w, height: b.h }; })()');
    for (const sel of ['.cluster .collection-btn', '.cluster .settings-btn', '.home-btn', '.reset-btn', '.hint-btn', '.companion-btn']) {
      const box = await page.locator(sel).boundingBox();
      expect(box, sel).not.toBeNull();
      named.push([sel, box!]);
    }
    for (let i = 0; i < named.length; i++) {
      const [a, ab] = named[i]!;
      expect(boxesOverlap(ab, board), `${a} vs board`).toBe(false);
      for (let j = i + 1; j < named.length; j++) {
        const [b, bb] = named[j]!;
        if ([a, b].includes('.companion-btn') && [a, b].includes('.bubble')) continue; // the bubble points at its friend
        expect(boxesOverlap(ab, bb), `${a} vs ${b}`).toBe(false);
      }
    }

    // "Kolejna przygoda" is wood and centred on the screen.
    await solveByKeyboard(page);
    const next = page.getByRole('button', { name: 'Kolejna przygoda' });
    await expect(next).toBeVisible({ timeout: 20_000 });
    await expect(next).toHaveClass(/btn-wood/);
    await page.waitForTimeout(700);
    const nb = (await next.boundingBox())!;
    expect(Math.abs(nb.x + nb.width / 2 - vp.width / 2)).toBeLessThan(3);
    expect(Math.abs(nb.y + nb.height / 2 - vp.height / 2)).toBeLessThan(3);
  });
});

test.describe('opening animation and V3 characters (14 October 2026)', () => {
  const opening = (page: Page): Promise<string | null> => state<string | null>(page, 'c.state.opening');
  const textures = (page: Page): Promise<string[]> => state<string[]>(page, "d.game.textures.getTextureKeys().filter((k) => k.startsWith('char-') || k.startsWith('intro-')).sort()");

  test('the full opening plays through and ends on the welcome screen, its textures released', async ({ page }) => {
    await boot(page, '?test&opening=full');
    expect(await opening(page)).toBe('full');
    await expect(page.getByRole('button', { name: 'Pomiń' }).first()).toBeVisible();
    // The play button waits for its moment (sprouts near the end).
    await expect(page.locator('.btn-play')).toBeHidden();
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { opening: string | null } } } }).__dino.ctrl.state.opening === null, null, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Graj', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dino Labirynty' })).toBeVisible();
    await page.waitForTimeout(600);
    const keys = await textures(page);
    expect(keys.filter((k) => k.startsWith('intro-'))).toEqual([]);
    expect(keys).toEqual(['char-bill-idle', 'char-giganto-idle', 'char-mazu-idle', 'char-rocky-idle', 'char-tiny-idle']);
  });

  test('a tap skips the opening at once; a key does too', async ({ page }) => {
    await boot(page, '?test&opening=full');
    await page.waitForTimeout(900);
    await page.mouse.click(600, 400);
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { opening: string | null } } } }).__dino.ctrl.state.opening === null, null, { timeout: 1_500 });
    await expect(page.getByRole('button', { name: 'Graj', exact: true })).toBeVisible();
    await boot(page, '?test&opening=short');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { opening: string | null } } } }).__dino.ctrl.state.opening === null, null, { timeout: 1_500 });
  });

  test('first launch of the day gets the full opening, later launches the short one', async ({ page }) => {
    await boot(page, '?test&opening=auto');
    expect(await opening(page)).toBe('full');
    await boot(page, '?test&opening=auto');
    expect(await opening(page)).toBe('short');
  });

  test('reduced motion gets a plain fade', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1180, height: 820 }, locale: 'en-US' });
    const page = await context.newPage();
    await boot(page, '?test&opening=auto');
    expect(await opening(page)).toBe('fade');
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { opening: string | null } } } }).__dino.ctrl.state.opening === null, null, { timeout: 3_000 });
    await context.close();
  });

  test('character atlases load per screen and the rest are released', async ({ page }) => {
    await boot(page);
    await page.waitForTimeout(300);
    expect(await textures(page)).toEqual(['char-bill-idle', 'char-giganto-idle', 'char-mazu-idle', 'char-rocky-idle', 'char-tiny-idle']);
    await page.getByRole('button', { name: /^(Graj|Play)$/ }).click({ force: true });
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'intro');
    // Quest intro: the host's large stage pose + corner idle only.
    await page.waitForFunction(() => {
      const k = (window as never as { __dino: { game: { textures: { getTextureKeys(): string[] } } } }).__dino.game.textures.getTextureKeys().filter((x) => x.startsWith('char-'));
      return k.length === 2 && k.includes('char-bill-stage') && k.includes('char-bill-idle');
    }, null, { timeout: 5_000 });
    await page.getByRole('button', { name: /Szukajmy/ }).click({ force: true });
    // Play: the corner set; the stage pose is released after the reveal.
    await page.waitForFunction(() => {
      const k = (window as never as { __dino: { game: { textures: { getTextureKeys(): string[] } } } }).__dino.game.textures.getTextureKeys().filter((x) => x.startsWith('char-')).sort().join(',');
      return k === 'char-bill-idle,char-bill-more,char-bill-wave';
    }, null, { timeout: 5_000 });
    // Tapping the friend plays the talking mouth poses.
    await page.getByRole('button', { name: /Dotknij, żeby porozmawiać/ }).click();
    await page.waitForFunction(() => {
      const scene = (window as never as { __dino: { game: { scene: { getScene(k: string): { children: { list: Array<{ anims?: { currentAnim?: { key: string } } }> } } } } } }).__dino.game.scene.getScene('game');
      return scene.children.list.some((o) => o.anims?.currentAnim?.key === 'bill-corner-talk');
    }, null, { timeout: 3_000 });
    // Home: back to the cast's idle frames only.
    await page.getByRole('button', { name: 'Ekran startowy' }).click();
    await page.waitForFunction(() => {
      const k = (window as never as { __dino: { game: { textures: { getTextureKeys(): string[] } } } }).__dino.game.textures.getTextureKeys().filter((x) => x.startsWith('char-')).sort().join(',');
      return k === 'char-bill-idle,char-giganto-idle,char-mazu-idle,char-rocky-idle,char-tiny-idle';
    }, null, { timeout: 5_000 });
  });
});

test.describe('living world details (14 October 2026)', () => {
  test('a tapped friend says hello on the welcome screen, then tells a little fact', async ({ page }) => {
    await boot(page);
    await page.waitForTimeout(300);
    const bubble = page.locator('.cast-bubble');
    await page.locator('.cast-btn[data-id="tiny"]').click({ force: true });
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveText('Cześć! Jestem Miłka!');
    await page.locator('.cast-btn[data-id="tiny"]').click({ force: true });
    await expect(bubble).toHaveText('Mam trzy rogi. Policzysz je ze mną?');
    // "Graj" stays uncovered.
    const b = (await bubble.boundingBox())!;
    const play = (await page.locator('.btn-play').boundingBox())!;
    expect(b.x < play.x + play.width && play.x < b.x + b.width && b.y < play.y + play.height && play.y < b.y + b.height).toBe(false);
    expect(await state<string>(page, 'c.state.screen')).toBe('welcome');
  });

  test('after a long quiet spell the friend dozes off; a tap wakes it', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const g = (window as never as { __dino: { game: { scene: { getScene(k: string): { lastActivity: number; time: { now: number } } } } } }).__dino.game.scene.getScene('game'); g.lastActivity = g.time.now - 60_000; });
    await page.waitForFunction(() => (window as never as { __dino: { game: { scene: { getScene(k: string): { companion: { isSleeping: boolean } } } } } }).__dino.game.scene.getScene('game').companion.isSleeping, null, { timeout: 3_000 });
    await page.getByRole('button', { name: /Dotknij, żeby porozmawiać/ }).click();
    expect(await state<boolean>(page, "d.game.scene.getScene('game').companion.isSleeping")).toBe(false);
  });

  test('after a solve the friend leaves paw prints along the path (not with reduced motion)', async ({ page, browser }) => {
    await boot(page);
    await startQuest(page);
    await solveByKeyboard(page);
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'reward', null, { timeout: 15_000 });
    await page.waitForTimeout(800);
    expect(await state<number>(page, "d.game.scene.getScene('game').prints.length")).toBeGreaterThan(3);
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1180, height: 820 }, locale: 'en-US' });
    const calm = await context.newPage();
    await boot(calm);
    await startQuest(calm);
    await solveByKeyboard(calm);
    await calm.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { screen: string } } } }).__dino.ctrl.state.screen === 'reward', null, { timeout: 15_000 });
    await calm.waitForTimeout(800);
    expect(await state<number>(calm, "d.game.scene.getScene('game').prints.length")).toBe(0);
    await context.close();
  });
});
