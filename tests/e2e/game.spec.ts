import { expect, test, type Page } from '@playwright/test';

type Pt = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

const KEY: Record<Dir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

async function boot(page: Page, query = '?test'): Promise<void> {
  await page.goto(query);
  // An opening with sound waits behind the closed curtains for the first tap.
  await page.waitForFunction(() => {
    const st = (window as never as { __dino?: { ctrl: { state: { screen: string; awaitingTap: boolean } } } }).__dino?.ctrl.state;
    return st?.screen === 'welcome' || !!st?.awaitingTap;
  }, null, { timeout: 30_000 });
  if (await page.evaluate(() => (window as never as { __dino: { ctrl: { state: { awaitingTap: boolean } } } }).__dino.ctrl.state.awaitingTap)) {
    await page.locator('.tap-start').click();
  }
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
  test('twenty completions: one reward each, Giganto at 6/11/16 with his own three, all eleven treasures', async ({ page }) => {
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
    // Seventeen friends' mazes bring all eight classic treasures; Giganto's three bring his own.
    expect(Object.keys(counts).sort()).toEqual(['amber', 'berries', 'coconut', 'crystal', 'feather', 'flower', 'gigaflower', 'nut', 'shell', 'stone', 'strawberry']);
    for (const g of ['amber', 'gigaflower', 'crystal']) expect(counts[g]?.count, g).toBe(1);
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
    await expect(page.getByText("Bill can smell a coconut. Let's find it together!")).toBeVisible();
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
    await expect(page.getByRole('button', { name: /Coconut\. In your collection: 1/ })).toBeVisible();
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
    expect(await state<string>(page, 'c.questPrompt()')).toBe('Dudek wywęszył kokos. Znajdźmy go razem!');
  });

  test('the corner friend is the quest reminder: a tap shows a speech bubble', async ({ page }) => {
    await boot(page);
    await startQuest(page);
    await expect(page.locator('.quest-chip')).toHaveCount(0);
    const friend = page.getByRole('button', { name: /Dotknij, żeby porozmawiać/ });
    await friend.click();
    await expect(page.locator('.bubble')).toBeVisible();
    await expect(page.locator('.bubble')).toHaveText('Czuję kokos! Ale boję się iść sam. Pójdziesz ze mną?');
    await friend.click();
    await expect(page.locator('.bubble')).toHaveText('Mam najlepszy nos w dżungli. Wywęszę każdy owoc!');
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

  test('settings is the only place for language and sound (sounds, music and voices apart)', async ({ page }) => {
    await boot(page);
    await expect(page.locator('.cluster button')).toHaveCount(2);
    await page.getByRole('button', { name: 'Ustawienia' }).click({ force: true });
    const off = page.getByRole('group', { name: 'Dźwięki' }).getByRole('button', { name: 'Wyłączony' });
    await off.click();
    expect(await state<boolean>(page, 's.get().settings.muted')).toBe(true);
    await expect(off).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('group', { name: 'Dźwięki' }).getByRole('button', { name: 'Włączony' }).click();
    expect(await state<boolean>(page, 's.get().settings.muted')).toBe(false);
    for (const [group, key] of [['Muzyka', 'music'], ['Głosy', 'voices']] as const) {
      const g = page.getByRole('group', { name: group });
      await g.getByRole('button', { name: 'Wyłączony' }).click();
      expect(await state<boolean>(page, `s.get().settings.${key}`)).toBe(false);
      await expect(g.getByRole('button', { name: 'Wyłączony' })).toHaveAttribute('aria-pressed', 'true');
      await g.getByRole('button', { name: 'Włączony' }).click();
      expect(await state<boolean>(page, `s.get().settings.${key}`)).toBe(true);
    }
  });

  test('sound: a tapped friend speaks its line, the welcome screen has its music bed, voices can be switched off', async ({ page }) => {
    await boot(page);
    const voice = page.waitForRequest(/assets\/audio\/voice\/pl\/tiny-hello-[0-9a-f]{8}\.m4a$/);
    const bed = page.waitForRequest(/assets\/audio\/music\/welcome-bed-[0-9a-f]{8}\.m4a$/);
    await page.getByRole('button', { name: 'Miłka' }).click({ force: true });
    await voice;
    await bed;
    // Voices off: the next tap shows the bubble but fetches no clip.
    await page.evaluate(() => (window as never as { __dino: { ctrl: { setVoices(v: boolean): void } } }).__dino.ctrl.setVoices(false));
    let fetched = false;
    page.on('request', (r) => {
      if (/audio\/voice\//.test(r.url())) fetched = true;
    });
    await page.getByRole('button', { name: 'Miłka' }).click({ force: true });
    await expect(page.locator('.cast-bubble')).toBeVisible();
    await page.waitForTimeout(400);
    expect(fetched).toBe(false);
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
    // 7.5 s of scene time; software GL under parallel load runs the clock slow.
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { opening: string | null } } } }).__dino.ctrl.state.opening === null, null, { timeout: 25_000 });
    await expect(page.getByRole('button', { name: 'Graj', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dino Labirynty' })).toBeVisible();
    await page.waitForTimeout(600);
    const keys = await textures(page);
    expect(keys.filter((k) => k.startsWith('intro-'))).toEqual([]);
    expect(keys).toEqual(['char-bill-idle', 'char-giganto-idle', 'char-mazu-idle', 'char-rocky-idle', 'char-tiny-idle']);
  });

  test("the friends' flat waist cut never rises into view (rise, greetings, hops)", async ({ page }) => {
    // Every frame: how far each cast member's base sits below the screen edge
    // in CSS px (camera shake included). The busts are cut flat at the waist.
    await page.addInitScript(() => {
      const w = window as never as { __cut: Record<string, number>; __dino?: { game: { scene: { getScene(k: string): unknown } } } };
      w.__cut = {};
      const tick = (): void => {
        const g = w.__dino?.game.scene.getScene('game') as
          | { cast?: Array<{ id: string; sprite: { y: number; active: boolean; visible: boolean; alpha: number } }>; vh: number; cameras: { main: { shakeEffect: { isRunning: boolean; _offsetY: number } } } }
          | undefined;
        if (g?.cameras?.main) {
          const shake = g.cameras.main.shakeEffect;
          const dy = shake.isRunning ? shake._offsetY : 0;
          for (const a of g.cast ?? []) {
            if (!a.sprite.active || !a.sprite.visible || a.sprite.alpha < 0.05) continue;
            w.__cut[a.id] = Math.min(w.__cut[a.id] ?? Infinity, a.sprite.y + dy - g.vh);
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await boot(page, '?test&opening=short');
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { opening: string | null } } } }).__dino.ctrl.state.opening === null, null, { timeout: 15_000 });
    // Quick repeated greetings make the neighbours hop over and over.
    for (const id of ['tiny', 'tiny', 'mazu', 'tiny', 'rocky']) {
      await page.locator(`.cast-btn[data-id="${id}"]`).click({ force: true });
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(1200);
    const below = await page.evaluate(() => (window as never as { __cut: Record<string, number> }).__cut);
    expect(Object.keys(below).sort()).toEqual(['bill', 'giganto', 'mazu', 'rocky', 'tiny']);
    for (const [id, px] of Object.entries(below)) expect(px, id).toBeGreaterThanOrEqual(0);
  });

  test("Giganto's peek never shows the cell's straight left or bottom cut", async ({ page }) => {
    // Every frame: the peek's cut edges in CSS px against the screen edges (camera shake included).
    await page.addInitScript(() => {
      const w = window as never as { __peek: { left: number; bottom: number; seen: number }; __dino?: { game: { scene: { getScene(k: string): unknown } } } };
      w.__peek = { left: -Infinity, bottom: Infinity, seen: 0 };
      const tick = (): void => {
        const g = w.__dino?.game.scene.getScene('game') as
          | { opening?: { objects: Array<{ texture?: { key: string }; active: boolean; x: number; y: number; scaleX: number; scaleY: number }> } | null; vh: number; cameras: { main: { zoom: number; shakeEffect: { isRunning: boolean; _offsetX: number; _offsetY: number } } } }
          | undefined;
        const peek = g?.opening?.objects.find((o) => o.active && o.texture?.key === 'intro-peek');
        if (g && peek) {
          const cut = { left: 0.0176, bottom: 0.9707 };
          // The shake moves the picture in canvas pixels (CSS px × zoom).
          const { shakeEffect: sh, zoom } = g.cameras.main;
          const dx = sh.isRunning ? sh._offsetX / zoom : 0;
          const dy = sh.isRunning ? sh._offsetY / zoom : 0;
          w.__peek.left = Math.max(w.__peek.left, peek.x + cut.left * 512 * peek.scaleX + dx);
          w.__peek.bottom = Math.min(w.__peek.bottom, peek.y - (1 - cut.bottom) * 512 * peek.scaleY + dy - g.vh);
          w.__peek.seen++;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await boot(page, '?test&opening=full');
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { opening: string | null } } } }).__dino.ctrl.state.opening === null, null, { timeout: 25_000 });
    const peek = await page.evaluate(() => (window as never as { __peek: { left: number; bottom: number; seen: number } }).__peek);
    expect(peek.seen).toBeGreaterThan(10);
    expect(peek.left, 'left cut stays left of the screen').toBeLessThan(0);
    expect(peek.bottom, 'bottom cut stays below the screen').toBeGreaterThan(0);
  });

  test('an opening with sound waits behind the curtains for the first tap, then plays with its theme', async ({ page }) => {
    await page.goto('?test&opening=full');
    await page.waitForFunction(() => (window as never as { __dino?: { ctrl: { state: { awaitingTap: boolean } } } }).__dino?.ctrl.state.awaitingTap === true, null, { timeout: 30_000 });
    await expect(page.locator('.tap-start')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dotknij, żeby zacząć' })).toBeVisible();
    expect(await state<string>(page, 'c.state.screen')).toBe('loading');
    expect(await state<string | null>(page, 'c.state.opening')).toBeNull();
    const theme = page.waitForRequest(/assets\/audio\/music\/theme-opening-[0-9a-f]{8}\.m4a$/);
    await page.locator('.tap-start').click();
    await theme;
    // The leaf pops into leaves first, then the curtains part.
    await page.waitForFunction(() => (window as never as { __dino: { ctrl: { state: { opening: string | null } } } }).__dino.ctrl.state.opening === 'full');
    await expect(page.locator('.tap-start')).toBeHidden();
  });

  test('reduced motion: no opening, so no start screen either', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('?test&opening=auto');
    await page.waitForFunction(() => (window as never as { __dino?: { ctrl: { state: { screen: string } } } }).__dino?.ctrl.state.screen === 'welcome', null, { timeout: 30_000 });
    expect(await state<boolean>(page, 'c.state.awaitingTap')).toBe(false);
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

test.describe('living treasures (14 October 2026)', () => {
  const rigState = (page: Page): Promise<{ rig: boolean; parts: number; standHidden: boolean }> =>
    state(page, "(() => { const g = d.game.scene.getScene('game'); return { rig: !!g.treasureRig, parts: g.treasureRig ? g.treasureRig.container.list.length : 0, standHidden: (g.treasure.cameraFilter & g.cameras.main.id) !== 0 }; })()");
  const host = async (page: Page, treasureId: string, questId: string): Promise<void> => {
    await page.evaluate(([t, q]) => {
      const c = (window as never as { __dino: { ctrl: { state: { session: object }; newSession(o: object): void } } }).__dino.ctrl;
      c.newSession({ keepQuestOf: { ...c.state.session, characterId: 'giganto', questId: q, treasureId: t, intro: false, special: true }, difficultyOverride: 'hard' });
    }, [treasureId, questId]);
    await page.waitForTimeout(400);
  };

  test("Giganto's giga flower is drawn from its painted parts; the still stays as an invisible stand-in", async ({ page }) => {
    await boot(page);
    await startQuest(page);
    await host(page, 'gigaflower', 'giganto-gigaflower');
    const r = await rigState(page);
    expect(r.rig).toBe(true);
    // Ten parts plus the centre's light.
    expect(r.parts).toBe(11);
    expect(r.standHidden).toBe(true);
    // Since the last delivery every treasure has parts: the stone too (body and glint).
    await host(page, 'stone', 'mazu-stone');
    expect(await rigState(page)).toEqual({ rig: true, parts: 2, standHidden: true });
  });

  test('butterflies flap real wings; the collection button is a painted chest', async ({ page }) => {
    await boot(page);
    await page.waitForFunction(() => (window as never as { __dino: { game: { scene: { getScene(k: string): { rigs: { size: number } } } } } }).__dino.game.scene.getScene('game').rigs.size >= 3);
    const flies = await state<{ rigs: number; wings: number }>(
      page,
      "(() => { const g = d.game.scene.getScene('game'); const f = g.rigs.list.filter((x) => x.stand.texture.key === 'fol-butterfly'); return { rigs: f.length, wings: f[0].rig.container.list.length }; })()",
    );
    // Three wandering butterflies, each a body, four wings and the perched pose.
    expect(flies).toEqual({ rigs: 3, wings: 6 });
    await expect(page.locator('.collection-btn .chest img')).toHaveCount(3);
  });

  test('plants sway leaf by leaf, the first maze shows the painted hand, a visitor walks in at the screen edge', async ({ page }) => {
    await boot(page);
    await page.waitForFunction(() => (window as never as { __dino: { game: { scene: { getScene(k: string): { rigs: { size: number } } } } } }).__dino.game.scene.getScene('game').rigs.size >= 9);
    // Six welcome plants and three butterflies are drawn from their parts.
    expect(await state<number>(page, "d.game.scene.getScene('game').castPlants.filter((p) => (p.cameraFilter & d.game.scene.getScene('game').cameras.main.id) !== 0).length")).toBe(6);
    await startQuest(page);
    expect(await state<string>(page, "d.game.scene.getScene('game').hand.texture.key")).toBe('rig-parts');
    // A jungle visitor: it comes from beyond the edge onto a side strip, never over the board.
    const first = await state<{ kind: string; side: string; x: number }>(page, "(() => { const g = d.game.scene.getScene('game'); g.visitors.start(c.state.layout, g.time.now, 'frog'); return g.visitors.current; })()");
    expect(first.kind).toBe('frog');
    const vw = await page.evaluate(() => window.innerWidth);
    expect(first.x < 0 || first.x > vw).toBe(true);
    await page.waitForTimeout(1800);
    const later = await state<{ x: number; side: string }>(page, "d.game.scene.getScene('game').visitors.current");
    const board = await state<{ x: number; w: number }>(page, 'c.state.layout.board');
    if (later.side === 'left') expect(later.x).toBeLessThan(board.x);
    else expect(later.x).toBeGreaterThan(board.x + board.w);
    expect(later.x).toBeGreaterThan(-1);
    expect(later.x).toBeLessThan(vw + 1);
  });

  test('reduced motion shows the still image instead of the rig', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page);
    await startQuest(page);
    await host(page, 'crystal', 'giganto-crystal');
    expect(await rigState(page)).toEqual({ rig: false, parts: 0, standHidden: false });
    // No part rigs at all, and no jungle visitors.
    expect(await state<number>(page, "d.game.scene.getScene('game').rigs.size")).toBe(0);
    expect(await state<unknown>(page, "(() => { const g = d.game.scene.getScene('game'); g.visitors.start(c.state.layout, g.time.now); g.visitors.update(g.time.now); return g.visitors.current; })()")).toBeNull();
  });
});

test.describe('living world details (14 October 2026)', () => {
  test('a tapped friend says hello on the welcome screen in its own way, then more', async ({ page }) => {
    await boot(page);
    await page.waitForTimeout(300);
    const bubble = page.locator('.cast-bubble');
    await page.locator('.cast-btn[data-id="tiny"]').click({ force: true });
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveText('Cześć, jestem Miłka! Chcesz usłyszeć dowcip?');
    await page.locator('.cast-btn[data-id="tiny"]').click({ force: true });
    await expect(bubble).toHaveText('Jak nazywa się śpiący dinozaur? Chrapozaur!');
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
    // Prints start a moment after the reward screen; slow software GL can stretch that.
    await page.waitForFunction(() => (window as never as { __dino: { game: { scene: { getScene(k: string): { prints: unknown[] } } } } }).__dino.game.scene.getScene('game').prints.length > 3, null, { timeout: 8_000 });
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

test.describe('phones (15 October 2026)', () => {
  for (const [w, h] of [[390, 844], [844, 390]] as const) {
    test(`${w}×${h}: big round buttons, a centred maze, settings and collection that fit the screen`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await boot(page);
      // The tab says "Dino Mazes" in either language.
      await expect(page).toHaveTitle('Dino Mazes');
      await startQuest(page);
      await page.waitForTimeout(400);
      // Round buttons are easy to hit.
      for (const name of ['Ekran startowy', 'Moje skarby', 'Ustawienia']) {
        const box = await page.getByRole('button', { name }).boundingBox();
        expect(box!.width, name).toBeGreaterThanOrEqual(56);
      }
      // Mazes stay simple on a phone.
      expect(await state<string>(page, 'c.state.session.effectiveDifficulty')).toMatch(/^(easy|medium)$/);
      // Settings: nothing sticks out of the screen sideways.
      await page.getByRole('button', { name: 'Ustawienia' }).click({ force: true });
      const overflow = await page.evaluate(() => [...document.querySelectorAll('.settings button')].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1);
      }).length);
      expect(overflow).toBe(0);
      await page.keyboard.press('Escape');
      // Collection: every slot on screen.
      await page.getByRole('button', { name: 'Moje skarby' }).click({ force: true });
      await page.waitForTimeout(400);
      const off = await page.evaluate(() => [...document.querySelectorAll('.collection .slot')].filter((s) => {
        const r = s.getBoundingClientRect();
        return r.top < 0 || r.bottom > window.innerHeight + 1 || r.left < 0 || r.right > window.innerWidth + 1;
      }).length);
      expect(off).toBe(0);
    });
  }
});
