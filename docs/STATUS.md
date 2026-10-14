# Dino Mazes — implementation status log

Last updated: 13 October 2026 (owner review round 2). Evidence below was produced on a MacBook (Apple
silicon, macOS 27) with Node 24.15, Playwright 1.64 (Chromium 1248 headless shell,
WebKit 2370). Nothing here was measured on an iPad, Android tablet or with children
yet; those rows are marked **pending**, never passed.

## Phase summary

| Phase | Status | Evidence |
|---|---|---|
| 0 — Foundation | Done | Vite 8.3.4, TypeScript 6.0.3 strict, Phaser **4.2.1** pinned, ESLint 10, Vitest 5, Playwright 1.64. `npm run build`, `lint`, `typecheck` clean. PL default + EN switch. |
| 1 — Maze engine + honest drawing | Done | 98 domain tests (1,000 seeds per profile; tunnelling, corner cuts, outside shortcuts, reversing, lift/resume, keyboard, restore, random-scribble property test). |
| 2 — Vertical slice | Done | Bill/coconut intro maze with real art, live trail, reset, celebration, persisted award. Screenshots reviewed at 1180×820 (DPR 2). |
| 3 — Replay, collection, settings | Done | 4 friends + Giganto, 6 treasures, 12 + 2 quests + generic special, cadence 6/11/16…, easier maze, 3 difficulties, hint, collection, settings, save/resume, recovery. |
| 4 — Motion, sound, usability | Done in code; **child sessions, in-motion art review and on-device audio pending** | Treasure-specific motions, collection arrival, companion reactions with cooldowns, Web Audio set, reduced motion, focus states. No supervised play sessions yet. |
| 5 — Performance, offline, packaging | Done locally; **real devices + HTTPS deploy pending** | Budgets measured (below); offline relaunch test passes; README written. Not deployed. |

## Owner review, round 2 (13 October 2026)

The owner reviewed screenshots and asked for nine changes. All are implemented and covered by
tests or screenshots; device checks are still pending as before.

| # | Request | What changed | Evidence |
|---|---|---|---|
| 1 | Centre the welcome card | Card centred on screen; nudged up only as far as needed to stay clear of the cast and the cluster | e2e "no UI overlap"; `tools/dev/review-welcome.mjs` at 4 viewports |
| 2 | One settings button, no duplicated language/sound | Top cluster is now collection + settings only; language and sound (On/Off segment) live only in "Dla rodziców" | e2e "settings is the only place for language and sound" |
| 3 | Close button cut by the panel graphic; no UI overlap | Panel leaf split out of the 9-slice (`split_panel_leaf` in `tools/art/extract.py`), placed as a non-interactive corner decoration; close button in a header row inside the frame. Also fixed: portrait intro card under the cluster, rotate toast over the board, danger button inner rectangle | e2e "no UI overlap"; layout unit tests now check hint, reset, cluster and speech area against each other and the board |
| 4 | Intro box less far right; Polish names | Friend + card centred as one group. Polish dub names (Wikipedia, *Gigantozaur*, "Wersja polska"): Bill = **Dudek**, Tiny = **Miłka**, Mazu = **Rudzia**, Rocky = **Czupur**, Giganto = Giganto. All Polish quest prompts re-declined | unit test "Polish dub names"; e2e names test |
| 5 | One friend on the play screen, clickable with a bubble; butterfly only after 2–3 resets; smaller treasure | Quest chip removed. Tapping the corner friend shows a speech bubble (quest first, then the friend's own lines and kind lines). (A chat cue badge added here was removed in round 3.) Butterfly appears after **2** resets that cleared real drawing (count saved with the maze), flies in and settles on its button, in the rail opposite the friend. Treasure size 0.84 → 0.62 of a cell | e2e bubble + butterfly tests; storage tests for the reset count |
| 6 | "Kolejna przygoda" in wood, centred | Wooden 9-slice button centred on the screen | e2e checks class and centre |
| 7 | Apply "make interfaces feel better" | See [UI_POLISH_REVIEW.md](UI_POLISH_REVIEW.md) | — |
| 8 | Consistent icons from a library | Phosphor Icons 2.1.1 (MIT), bold weight, one family everywhere | — |
| 9 | Sharper characters, double frames, more 2D ideas | Codex/GPT Imagegen handoff: [../art/CODEX_REQUEST_V3.md](../art/CODEX_REQUEST_V3.md) with 185 jobs | Not generated yet (Codex) |

## Owner review, round 3 (13 October 2026)

| # | Request | What changed | Evidence |
|---|---|---|---|
| 1 | Remove the chat badge stuck on the friend | Badge removed. A tap makes the friend squash-and-stretch at once, play its wave, and show the speech bubble; nothing is drawn over the artwork | e2e checks the friend's button has no children |
| 2 | Settings button jumps between screens; collection and settings sizes differ; basket looks like e-commerce | `clusterSpec` in `src/platform/layout.ts` gives one size and one top-right row for every screen (column only if a landscape rail is too narrow). Basket replaced by Phosphor's treasure chest (bold). A painted chest is proposed for Codex | layout unit test; e2e compares both buttons across welcome, intro and play |
| 3 | Polish letters look different from the rest | Root cause: Fredoka 5.3.0 contains only ó and ł of the Polish set; ą ć ę ń ś ź ż (and capitals) came from a fallback font. Replaced by **Baloo 2** (OFL), declared in `src/fonts.css` with per-subset unicode-range, weights 600/700/800, woff2 only (≈ 105 KB) | `tests/domain/fonts.test.ts` reads each woff2 cmap; it fails on Fredoka (missing ąćęńśźżĄĆĘŃŚŹŻ) and passes on Baloo 2 |

## Owner review, round 4 (13 October 2026)

| # | Request | What changed | Evidence |
|---|---|---|---|
| 1 | Welcome card centred in the empty space; Giganto a bit bigger, the four friends a bit smaller | The card centres between the top controls/foliage and the heads of the friends standing under it, and never touches any painted friend. Cast slots use each friend's real frame aspect and a target height (Giganto 1.08 × base, friends 0.88 ×), Giganto hugs the left edge, plants stand in the seams below the faces | `tools/dev/review-welcome.mjs` at 4 viewports; layout unit test (Giganto taller, nobody off-screen) |
| 2 | "Ekran startowy" out of settings; next to the other buttons while playing, hidden on the home page | Home button removed from settings; a round home button joins the top-right row on the intro, play and reward screens (to the left, so chest and settings never move) | e2e: absent on welcome and in settings, present and equal size in the maze, returns to the welcome screen |
| 3 | Friends (Giganto especially) larger in the maze; butterfly after 3 resets, beside the friend; nicer flight | Friends are sized by target height (≈ 36 % of the viewport, Giganto ×1.22, may bleed 12 % off the left edge); the board leans away from the friend when there is spare width. Butterfly unlocks after **3** fresh starts and waits beside the friend (above the head in landscape, by the paws in portrait). New flight: smooth spline at constant speed, banking, speed-linked wing beats, sparkle trail, a loop around the friend's head, slow landing, the friend waves, and the button appears exactly on landing. Speech bubbles sit beside the butterfly and use an SVG tail aimed at the friend's head | layout unit tests for all five friends × six viewports; e2e "butterfly after three fresh starts … lands beside the friend" |

Measured visible-content boxes per character frame are now part of the asset manifest
(`content`, `contentActive`, written by `tools/art/extract.py`); only JSON changed when re-run.

## Owner review, round 12 (14 October 2026): one corner for the friend, ten treasures

- **The friend always at the lower left, "Wróć" always at the lower right** (`FRIEND_CORNER`), so
  the reset button never jumps between mazes. Checked on the V3 frames: Giganto, Rudzia and Dudek
  face right, Czupur and Miłka face front (`FACING`), so from the left everyone looks at the maze
  and no art needs mirroring (unit test). The welcome screen keeps its arrangement.
- **Entrances never on the left** (GENERATOR_VERSION 4): wide and square grids open in the right
  half of the bottom edge, tall grids on the right side; the introductory maze is mirrored. A
  layout test checks that no possible entrance runs into the friend or "Wróć". Square grids no
  longer open on a side, which widened the board and shrank the friend by about a fifth. A maze
  saved by an older version starts fresh (the save never reinterprets an old trail).
- **Ten treasures:** seven classic (new: Piórko / Feather) and three of Giganto's own (Bursztyn /
  Amber, Gigakwiat / Giga flower, Kryształ / Crystal) with new quests (Miłka's paintbrush,
  Czupur wants to fly, Giganto's cave…). A treasure enters the game only once its art is in the
  manifest (`treasureHasArt`), so today's game is unchanged until Codex delivers
  ([../art/CODEX_REQUEST_TREASURES.md](../art/CODEX_REQUEST_TREASURES.md), 26 jobs); then
  `npm run art` switches them on. Until then Giganto keeps his old quests.
- **Collection:** classic treasures in centred rows (4 + 3), Giganto's in a golden "Skarby
  Giganto" box with his footprint, beside them in landscape and below in portrait; nests stay
  round at any size. Checked with stand-in art on 1180 × 820, 820 × 1180 and 667 × 375.

## Owner review, round 11 (14 October 2026): what the friends say

The owner found generic lines and a factual slip (Miłka "has three horns"; the art has two).
Research on the friends from the series is in [CHARACTER_VOICES.md](CHARACTER_VOICES.md).

- **Quests:** every card is a tiny scene from the friend's character (Dudek sniffs out a coconut
  but is scared to go alone, Rudzia builds a coconut phone, Czupur wants to break a record…), and
  each quest has its own first speech bubble in the friend's voice (`ask`).
- **Speech bubbles:** each friend has its own hello, three little things about itself and two
  cheers of its own (`VOICES`), replacing the shared generic lines. Miłka tells jokes, written
  separately in each language. Giganto roars and says a word or two, as in the cartoon.
- **UI:** natural Polish and English per the miodkuj rules ("Gość specjalny", "na zwykłym
  poziomie", "Spróbuj jeszcze raz", "W kolekcji: 3", "Znowu kokos!", a plainer parents' help).
- **Guards (unit tests):** length limits, no gendered past forms for the child in Polish, nothing
  judges the route, Miłka never counts three horns, each friend introduces itself by name.

## Owner review, round 10 (14 October 2026): the waist cut in the opening

The friends are busts cut flat at the waist. Their springy rise (Back.easeOut) overshot and
lifted that edge up to ~29 px into view; greeting hops could stack and leave a friend raised;
the quest-intro entrance showed it too (`tools/dev/review-cut.mjs` measured every frame).

- **Pinned pop-up** (`src/game/motion.ts`): a damped spring moves the friend until it first
  arrives, then its overshoot becomes stretch and squash around the base, so the head still
  bounces while the base stays below the screen. Used by the opening rise and the quest-intro
  entrance. `spring(t, ζ, f)` is the pure function planned in MOTION_PROPOSAL.md.
- **Hops** lift only within the hidden band (the rest is stretch), always start from the resting
  pose, and never stack. A tap bounce also returns the friend to its resting place.
- **Soft cut:** `tools/art/v3.py` fades the bottom 3 % of every character frame to transparent
  (`cutFade` in the manifest). At rest that band sits below the screen edge (`baseHidden`), so a
  camera shake can at most show a soft fade, never a line.
- Regression test: e2e "the friends' flat waist cut never rises into view" (fails on the old code
  at -28.5 px, passes now).

## Owner review, round 9 (14 October 2026)

- **Loader:** a spinning ring of jungle vine (`src/ui/vineSpinner.ts`, canvas): the ring turns at a
  steady rate while the vine's head grows ahead and its tail catches up, leaves unfurl at the head
  and curl away at the tail, a tendril leads. It runs only while on screen; reduced motion shows a
  still ring. Used on the loading screen and the closed-curtain loader.
- **Art plan for rigged assets:** [../art/CODEX_REQUEST_MOTION.md](../art/CODEX_REQUEST_MOTION.md)
  and [../art/prompts/jobs-motion.json](../art/prompts/jobs-motion.json) (58 jobs: butterfly,
  six treasures, chest, confetti, plants, pointer, optional critters, each as an assembled master
  plus parts made as edits of it). Waiting for Codex.

## Owner review, round 8 (14 October 2026)

Living-world details built in code (no new art): wind, sun spots, falling leaves, perching
butterflies, daylight colour, treasure twinkle, sand under the drawing tip, paw prints after a
solve, friends saying hello on the welcome screen, Giganto's distant footsteps, and a sleepy
friend after a long pause. All outside the board or on the solved path, off with reduced motion.
Details and further ideas: [MOTION_PROPOSAL.md](MOTION_PROPOSAL.md) §6. New e2e tests: greeting
bubble (does not cover "Graj"), paw prints (none with reduced motion), sleepy friend wakes on tap.

## Owner review, round 7 (14 October 2026)

- Difficulty now steps up every **4** generated mazes (was 3): hard 1–4, expert 5–8,
  master 9–12, grand 13+ (`LEVEL_EVERY` in `src/domain/progress.ts`; parent help text updated).
- Research on living, high-fidelity small assets (samyost1/3dicon, the "Opus 5.5 Motion Lab"
  article) and a place-by-place proposal: [MOTION_PROPOSAL.md](MOTION_PROPOSAL.md). Not built yet.

## Owner review, round 6 (14 October 2026)

| # | Request | What changed | Evidence |
|---|---|---|---|
| 1 | Start harder; first levels still too easy | Levels are now hard → expert → master → grand (one step every 3 mazes); `GENERATOR_VERSION` 3. On a 1180×820 tablet the first mazes average 5.4 branch choices and a 22-cell route (was 3.9 / 19), climbing to 7.2 branches. Wider screens get 9×7, 9×9 or 11×9. Non-square grids open on one axis only, which is what lets 9×7 fit with ≥ 48 px corridors. A grid is used only if the friend keeps ≥ 85 % of its old size (9×7 on the tablet would have cut it by a third) | maze tests (1,000 seeds per profile and grid, < 1 % fallbacks; worst case ≈ 6 ms per maze); layout tests for grid choice and friend size |
| 2 | No friend name on the quest card | Removed (the friend is right next to it; the "Specjalny gość" ribbon stays for Giganto) | screenshots |
| 3 | Loader should be a real textured leaf | The loading screen and the closed-curtain loader show the painted seedling growing through three stages (popping in on the same soil mound) and swaying. Sprout stages are now aligned on the soil in the pipeline, and the "Graj" sprout stays within the button's height | `tools/dev/review-loader.mjs` |

## V3 characters and the opening animation (14 October 2026)

Codex delivered 180 character frames (36 per friend, 1254 px each) and 12 intro assets
(art/CLAUDE_HANDOFF_V3.md, art/INTRO_ASSET_HANDOFF.md). Integrated as planned:

- **Characters** (`tools/art/v3.py`, `src/game/characterTextures.ts`, `src/game/actor.ts`):
  trimmed Phaser multiatlases in two tiers. Corner tier, 512 px subject height, as three
  atlases loaded independently: `idle`, `wave` and `more` (drawing, celebration, talk). Stage
  tier, 800 px, for the quest-intro pose: key poses only (4 breathing, 6 wave). Frame rates
  doubled (7/11/11/14 fps), so reactions last as long as before. New talk mouth poses play
  while the speech bubble is up. Reduced motion shows one static pose per state.
- **Registration:** Codex's shared canvas is kept, with no automatic shifting. The back
  contour is stable within 2–3 source px. Correlation-based shifts were misled by asymmetric
  poses and would have added pops. Head-centroid steps between frames are the intended nods
  and bounces. Details are in art/review/RUNTIME_QA.md.
- **Atlases load on demand and are released:**

  | Screen | Atlases in GPU memory |
  |---|---|
  | Welcome | every friend's `idle`; a tap adds that friend's `wave` for the wave |
  | Quest intro | host `stage` + `idle` |
  | Play and reward | host `idle` + `wave` + `more`; stage released after the reveal |

  The reveal swaps tiers without a visible jump (measured: position and size continuous).
- **Opening** (`src/game/opening.ts`, DOM parts in `src/ui/ui.ts`): concept A. The full
  version (≈ 7.5 s, first launch of the day): curtains part, two footsteps with shake, dust and
  a sweeping shadow, Giganto peeks over the bottom-left plants and stands up, the friends pop
  up from bushes and hop to the front, the title sign drops on vines, "Graj" sprouts. The short
  version (≈ 1.8 s) plays on later launches that day, and reduced motion gets a 0.5 s fade.
  A tap or key skips. The closed curtains double as the loading screen. Opening textures are
  released at the end. The welcome screen's cream card became the hanging wooden sign (live
  text), sized to fit above the friends.
- **Budgets** (10 Mbps, cache and service worker disabled, 3 runs, production build):

  | Measure | Result | Target |
  |---|---|---|
  | First visit transfer (with opening) | 4.91 MB | ≤ 5 MB |
  | Complete offline download | ≈ 10.2 MB | ≤ 12 MB |
  | Welcome screen ready | 3.42–3.46 s | — |
  | Maze drawable | 3.83–3.84 s | ≤ 4 s |
  | Friend fully animated | ≈ 4.9 s | atlases stream in the background |

  GPU estimate (tests/domain/assets.test.ts) for the worst friend per screen:

  | Screen | Estimate | Budget |
  |---|---|---|
  | Welcome during the opening | ≈ 77 MiB | ≤ 96 MiB |
  | Quest intro | ≈ 68 MiB | ≤ 96 MiB |
  | Play | ≈ 74 MiB | ≤ 96 MiB |
- **Pending:** watching the loops and the opening on the family tablet at real frame rate; owner
  likeness approval of every generated pose (the handoff records permission to proceed, not a
  per-pose sign-off).

## Owner tablet test: sharp hedge corners (13 October 2026)

Drawing by touch, the ink stuck at the sharp inside corners of turns. Cause: the ink moves
towards the finger in a straight line, and a finger that cuts the inside of a turn drags that
line across the hedge corner, so the ink stopped there until the finger came back.

- **Corner assist** (`TrailEngine.turnCorner`): when the finger is already in the next
  corridor but the straight line crosses the corner, the ink goes in two legs through a pivot
  inside the junction (the inside corner of the turn, else nearer the node centre). Each leg
  lies inside one convex capsule, so the ink still never enters a hedge or a passage that is
  not adjacent to the head.
- **Rounded hedge corners** (`innerCorners`, `WALL_ROUNDING` = 0.2 of a cell): every sharp
  outside corner of the hedge is rounded and hedge tips between parallel passages become
  semicircles. Purely visual; collision geometry is unchanged.
- Tests: "a finger cutting the inside of a turn carries the ink round the corner" and "wide
  curved swipes over hedge corners …" fail on the previous engine and pass now; a geometry
  test checks the rounding never touches a corridor or approaches another passage. A
  touch-emulated drag that cuts every corner solves the maze (`tools/dev/review-corners.mjs`).

## Deployment (13 October 2026)

Live at https://artskw.github.io/dino-mazes/ from the public repository
`ArtSkw/dino-mazes`. Every push to `main` runs type check, lint, domain tests and the
production-build tests, then publishes to GitHub Pages (`.github/workflows/deploy.yml`).
Security and performance audits: `reports/security_audit_20261013-1845.md`,
`reports/performance_audit_20261013-1845.md`. The site is public (with `noindex`), not
access-restricted; official show images and source art are kept out of the repository.

## Owner review, round 5 (13 October 2026)

| # | Request | What changed | Evidence |
|---|---|---|---|
| 1 | Replace "clear collection" with a game/progress reset, offered only from the maze view | "Zacznij grę od nowa" (with confirmation) resets treasures, the current maze, the tutorial, Giganto's cadence and the difficulty climb; settings and language stay. Shown in settings only on the intro, play and reward screens; afterwards the welcome screen offers "Graj" and the tutorial maze starts again | storage unit test (`restartedSave`); e2e restart test (hidden on welcome, works from the maze, tutorial again) |
| 2 | No difficulty choice; start at medium or a bit higher and grow every few mazes | Difficulty row removed. Five levels (medium → medium-plus → harder → hard → expert), one step every 3 completed mazes after the tutorial, Giganto one level above. `GENERATOR_VERSION` 2 (a maze in progress from an older build is replaced once; treasures are kept) | progress unit test (`levelFor`); maze tests: 1,000 seeds per level and grid, fallbacks < 1 %; generation ≈ 0.3 ms per maze on average |
| 3 | Butterfly button top-left with the same spacing as the right-hand buttons; more helpful hint | The button mirrors the cluster (same size and margins). The arriving butterfly passes the friend (who waves) and lands in the corner. A tap shows the next **two** moves (to the cell after the second branch decision) and leaves golden pollen dots that fade after a moment | trail unit test (two decisions); layout test (mirror position); e2e hint test |
| 4 | Intro animation ideas and an imagegen plan | [../art/INTRO_ANIMATION_PLAN.md](../art/INTRO_ANIMATION_PLAN.md) and [../art/prompts/jobs-intro.json](../art/prompts/jobs-intro.json) (proposal, not built) | — |

Also fixed: the random-scribble property test found that pulling ink back onto a corridor edge
could leave a point 2·10⁻¹⁵ units outside it through rounding. Projections now land 10⁻⁹ units
inside the wall (`closestInCapsule`).

## Test results

| Suite | Command | Result |
|---|---|---|
| Domain unit + property | `npm test` | 218 passed |
| Browser flows (Chromium + WebKit) | `npm run test:e2e` | 65 passed, 1 skipped (synthetic-touch test is Chromium-only by design) |
| Production build (offline relaunch, painted UI surfaces) | `npm run test:offline` | 2 passed |
| Types / lint | `npm run typecheck`, `npm run lint` | clean |

E2E coverage: fresh install in Polish under an English browser locale; language
switch mid-maze keeps the trail and persists; pointer solve awards exactly once
across a reload during the celebration; double-tap on "Next" makes one session;
disconnected tap / fast swipe cannot solve; "Wróć" keeps the seed and the entrance
works within 250 ms; lift + press elsewhere does not draw; collection/settings
round-trip restores the exact trail; hint never extends the trail; keyboard solve +
skippable celebration; resize while drawing; corrupt storage recovery; twenty
completions with ten collection round-trips (Giganto at 6, 11, 16; all six
treasures; one award each; board textures released); touch pointer drawing with a
second finger ignored; Giganto difficulty step + "Łatwiejszy labirynt"; full English
parity; welcome wave.

## Measured budgets

| Target (PRD §9) | Measured | Notes |
|---|---|---|
| Initial transfer ≤ 5 MB, complete ≤ 12 MB | **3.26 MB** total (everything) | gzip for text; images are WebP. 49 precached files. |
| First playable ≤ 4 s at 10 Mbps | **3.05–3.10 s** (3 cold runs) | Chromium, 10 Mbps down / 5 up / 40 ms, cache + SW disabled, local preview server. |
| GPU memory ≤ 96 MiB, atlas edge ≤ 2048 | ≈ 50 MiB estimated | Characters 24.6 MiB decoded (all five), board ≤ 2048² (≤ 16 MiB), backgrounds 6 MiB, kits ≈ 7 MiB. |
| 60 fps / ≥ 30 fps oldest tablet | **pending on devices** | Headless WebKit: median 17 ms, p95 22 ms per frame while drawing a 9×9 maze. Headless Chromium uses software GL at 2880×1800 (83 ms/frame), not representative. |
| Input response ≤ 50 ms | engine ≈ 0.001 ms/move; frame JS ≈ 0.8 ms | Trail redraw cost cut from 4.4 ms to 0.8 ms per frame (600-point trail) by drawing joints only at bends. |
| Corridor ≥ 48 CSS px | 49–70 px at all six reference layouts | Enforced by `fitGrid`; covered by layout tests. |

Effective grids chosen at the reference layouts (requested → effective):
easy 5×5 everywhere; medium 7×7 (7×5 at 1024×600); harder 9×9 at 1440×900,
9×7 at 1366×768, 7×7 at 1024×768 / 1180×820, 7×5 at 1024×600, 7×7 portrait.

## Deviations from the plan (and why)

1. **Corridor geometry instead of wall polygons.** Walkable space is the union of
   round-capped capsules around graph edges; walls are its exact complement. One
   data set drives rendering, collision and decoration (`src/domain/types.ts`).
2. **"Meaningful" branch choices** count decisions whose wrong branch is at least
   two cells deep; one-cell pockets are visible at a glance. Easy also caps all
   decision points at 5, dead ends at 4 cells and the route at 15 cells. With the
   literal count, 5×5 easy mazes failed the 1–3 rule 3–34 % of the time.
3. **Rectangular fallbacks** (9×7, 7×5) when a square nominal grid would shrink
   corridors below 48 px; the closest achievable branch target is used.
4. **Ergonomic corridor tolerance.** A pointer that strays slightly into a hedge
   keeps drawing at the closest point inside the *current* corridor (never another
   passage); a larger stray stops the ink until the child returns to the endpoint.
5. **Hint from a wrong branch:** the butterfly flies to "Wróć" and it glows (no
   solution is drawn and nothing is announced as wrong).
6. **Phaser `maxTextures: 1`.** Phaser 4.2.1 multi-texture batching drew pieces of
   character sheets inside foliage quads in desktop Chromium. One texture per batch
   (Phaser's own default on iOS/Android) fixed it; draw-call cost is negligible here.
7. **Controller lives in `src/app/`** (not listed in the plan's tree) to keep
   gameplay state in one place between UI and renderer.
8. **Giganto always uses the lower-left corner.** His sheet faces right and is
   cropped on the left, so he faces the maze from there with the crop at the screen edge.
9. **No difficulty setting** (owner decision, 13 Oct, round 5): difficulty grows automatically
   with progress; the PRD's three parent presets were replaced.
10. **Language and sound only in settings** (owner decision, 13 Oct). The home button lives
   with the corner controls on maze screens (round 4), not in settings. PRD §2, §4.1 and §6
   were updated; the PRD previously asked for a visible PL/EN switch and mute control.
11. **Butterfly hint is gated** behind three fresh starts that cleared real drawing in the same
    maze (owner decision; two in round 2, three since round 4). The reset count is saved with the session; the easier-maze restart
    sets it back to zero.
12. **No quest chip**: the corner friend is the quest reminder (tap → speech bubble).

## Pending / not verified

- Real-device input comfort: iPad Safari touch, Android tablet Chrome, MacBook
  trackpad. Use `npm run dev` and open the LAN URL it prints.
- Supervised child play sessions (finding "Wróć", resuming at the endpoint, hint use).
- Owner approval of cartoon likeness for all five characters (see art QA).
- Audio on real devices (iOS unlock on first touch, mute, background pause).
- Offline install on the iPad from the live URL; real access restriction if the family wants the site private.
- Real-GPU frame rates on the oldest family tablet.
- Watching the new UI motion (bubble, butterfly arrival, staggered entrances) at 10 % speed in
  a real browser's Animations panel; only headless screenshots were taken.
- Codex v3 character art, then extraction, trimmed atlas packing, 2× frame rates and the talk loop.

## Art requests for Codex

Current request: [art/CODEX_REQUEST_V3.md](../art/CODEX_REQUEST_V3.md) (one frame per image,
32 frames per friend plus an optional talk loop, owner likeness sign-off on five masters before
the rest). Earlier notes: [art/review/RUNTIME_QA.md](../art/review/RUNTIME_QA.md). Nothing
blocks release.
