# Interface polish review — "make interfaces feel better" (full mode)

Date: 13 October 2026. Skill: [jakubkrehel/make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better),
applied together with the owner's six review points. Every row below was changed in this pass
unless it is listed under "Considered but rejected".

## Scope and coverage

Mode **full**. Scope: the DOM overlay (welcome, quest intro, play HUD, speech bubble, reward,
collection, settings, confirm, toasts). Framework: TypeScript + Vite, plain DOM, one stylesheet
(`src/styles.css`); no Tailwind or motion library, so fixes stay in plain CSS. The Phaser canvas
(maze, characters, particles) is outside this skill's scope except where it meets the DOM.

| Category | Evidence inspected | Result |
|---|---|---|
| Typography | `src/styles.css` root, headings, notes, intro prompt, bubble, badge, slot counts; screenshots at 1180×820, 1366×768, 1024×600, 768×1024 | 3 findings |
| Surfaces | Panel 9-slice + leaf, round buttons, segmented controls, bubble, shadows, hit areas; settings at 1180×820 | 4 findings |
| Animations | Every keyframe and transition; welcome/intro entrances, overlay open, bubble enter/exit, press states, reduced motion | 4 findings |
| Icons | Old hand-drawn set in `src/ui/icons.ts`, every icon use | 2 findings |
| Performance | All `transition` declarations, `will-change` | 1 finding |

## Findings

### Surfaces

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| HIGH | `src/styles.css:134`, `tools/art/extract.py` (`split_panel_leaf`) | Leaf accent baked into the 9-slice panel: stretched along the top and right edges; settings close button at `top/right: -14px` inside `overflow: auto` was clipped and sat under the leaf | Clean symmetric panel + separate `panel-leaf.webp` placed by `.panel::after`, overhanging outward with `pointer-events: none`; close button in its own header row inside the frame | Overlapping, clipped controls are the owner's "UI overlap bug"; decoration must never cover a hit target |
| MEDIUM | `src/styles.css:18-19` | One-layer `0 6px 16px` shadow | Layered transparent shadow tokens `--shadow` / `--shadow-lift` (contact + lift + ambient) | Shadows for elevation read naturally on the painted, multi-colour jungle |
| MEDIUM | `src/styles.css:589` | Speech UI was a chip with a 4px coloured border | Bubble uses a 3px accent ring drawn with `box-shadow` plus `--shadow-lift`; the tail shares the ring | Border-as-depth replaced by shadow; one ring for bubble and tail keeps edges continuous |
| LOW | `src/styles.css:378`, `:386`, `:740`, `.seg .icon` | Equal padding on icon+text buttons; play triangle geometrically centred | Icon side 2px tighter (`calc(1.1em - 2px)`), play glyph nudged 2px right | Optical over geometric alignment |

### Typography

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| HIGH | `src/fonts.css`, `src/styles.css` `--font` | Fredoka lacked ą ć ę ń ś ź ż, so those letters rendered in a fallback font (owner spotted it) | Baloo 2 with per-subset `unicode-range`, weights 600/700/800 mapped through `--fw-text/label/title`; `line-height: 1.25` on the root for Baloo's tall metrics | Typography must render every letter of the default language in one face |
| LOW | `src/styles.css:40-41` | Default subpixel smoothing | `-webkit-font-smoothing: antialiased` on the root | Fredoka renders heavy on macOS/iPadOS otherwise |
| LOW | `src/styles.css:46`, `:50`, `:499`, `:588` | Default wrapping (e.g. "Znajdźmy / go razem!") | `text-wrap: balance` on headings and the quest prompt; `pretty` on paragraphs, notes, bubble | No orphans on short child-facing lines |
| LOW | `src/styles.css:672`, `:961` | Proportional digits in the collection badge and "×2" counts | `font-variant-numeric: tabular-nums` | Counts change while the treasure flies in; no width jitter |

### Animations

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| MEDIUM | `src/styles.css:160-166`, `:211-222`, `:250-265` | `.btn:active` translate + `scale(0.98)`, `.btn-round:active scale(0.94)` | `scale: 0.96` on transitions (150 ms ease-out) for buttons, round buttons and segments; disabled under reduced motion | One consistent, interruptible press feedback; 0.94 felt exaggerated |
| LOW | `src/styles.css:332-351` | Welcome card appeared all at once | Title, tagline and "Graj" rise ~100 ms apart (opacity + 12px + 4px blur); intro prompt and button follow the card | Split-and-stagger for an infrequent staged entrance |
| LOW | `src/styles.css:621-637` | Old bubble popped in and vanished | Bubble enters in 280 ms; exits with a shorter, softer 150 ms fade and 6px lift | Exits softer than enters |
| LOW | `src/styles.css:698-702`, `:840-843` | Hint button and overlays appeared instantly | Hint button settles in as the butterfly lands (scale 0.25→1, blur 4px→0); overlay backdrop fades, panels rise 12px | Contextual appearance with the exact icon-animation values |

### Icons

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| MEDIUM | `src/platform/layout.ts` `clusterSpec`, `src/ui/ui.ts` | Collection button larger than settings; cluster was a row on menus and a centred column in play | One spec for every screen: equal round buttons, top-right row, same coordinates | Consistent placement; controls must not jump between screens |
| MEDIUM | `src/ui/icons.ts` | Shopping-basket glyph for the treasure collection | Phosphor `treasure-chest` (bold) | The metaphor matches the game; same family and weight as the gear |
| MEDIUM | `src/ui/icons.ts:10-26` | Hand-drawn 48px-grid strokes, mixed visual weights | One family: **Phosphor Icons (MIT), bold weight**, inlined with Vite `?raw`, `currentColor`, `aria-hidden` | One set, consistent geometry and terminals |
| LOW | `src/ui/icons.ts`, settings rows | Settings labels without icons; sound toggle was an icon-only round button | Bold weight matches 600 text; rows get translate/speaker/path/sparkle glyphs; sound becomes a labelled On/Off segment | Icon stroke matches text weight; state carried by colour + label, not only an icon swap |

### Performance

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | `src/styles.css` (all transitions) | `transition: transform 120ms ease, filter 120ms ease` shorthands | Explicit `transition-property` lists (`scale, filter`, `background-color, color, scale`, `opacity, translate`) | Transition only what changes; no `all` anywhere |

## Considered but rejected

| Location | Candidate | Rejected because |
|---|---|---|
| `.slot img`, `.intro-treasure`, `.banner img` | 1px image outline | Treasures are transparent cut-outs; an outline would draw a rectangle around them |
| `.btn-round` green rim | Replace the 4px border with a shadow ring | The rim is the game's structural/brand edge matching the painted surfaces, not fake depth |
| `.btn-play`, `.next-btn` breathing loop | Remove the infinite animation (motion restraint) | Deliberate invitation for 4–6-year-olds on a once-per-screen primary action; it stops under reduced motion |
| Any element | `will-change: transform` | No first-frame stutter observed in Chromium or WebKit; extra layers cost memory on old tablets |
| Welcome/intro entrances | Skip the entrance on first load | The entrance is the intentional staged moment; it is not a toggle with a default state |

## Verification and verdict

1. `npm run typecheck`, `npm run lint`: clean. `npm test`: 109 passed (includes a woff2 cmap check of Polish coverage).
2. `npm run test:e2e` (Chromium + WebKit): 43 passed, 1 skipped by design; includes a new **no-UI-overlap** test (welcome card vs
   cluster and cast, settings close button inside the frame, every play control vs the board and
   each other, centred wood "Kolejna przygoda").
3. Screenshot walkthroughs (`tools/dev/review-walkthrough.mjs`, `review-friends.mjs`,
   `review-welcome.mjs`) at 1180×820, 1366×768, 1440×900, 1024×600 and 768×1024, Polish and
   English, all five friends.
4. **Not verified:** animations were not stepped through at 10 % speed in a browser Animations
   panel (headless only), and nothing was checked on a real iPad or Android tablet.

Verdict: **Approve**, with the two unverified checks above still open.
