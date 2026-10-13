# Dino Mazes — Development and Art Production Plan

**Version:** 1.1 · **Date:** 12 October 2026  
**Product contract:** [PRD.md](PRD.md)  
**Code owner:** Claude Code · **Generated-art owner:** Codex / GPT Imagegen

## 1. Starting state and handoff

This is a new project. No game implementation, package setup, runtime atlas, deployment, or browser QA is claimed complete. The accompanying art directory contains generated source candidates and an inventory; consult `art/manifest.json` and `art/review/QA.md` for actual status. Concepts are not screenshots of a running game.

Read the PRD first, then this plan, then the art inventory and QA notes. The Castle Atlas files were structural examples only. Do not import their 3D stack, existing-state claims, AGENTS instructions, or castle-specific workflow.

### Responsibilities

| Codex | Claude Code |
|---|---|
| Art direction, source references, prompts, GPT Imagegen calls, visual review and art revisions | Game architecture, maze generator, drawing/collision, UI, persistence, audio, testing, deployment setup |
| Character identities, treasure illustrations, environment kit, decorative surfaces | Crop/extract approved art, normalize pivots, loss-aware exports, texture atlas metadata and packing |
| Additional poses/variants when a measured integration problem needs them | Report exact asset defects with screenshots and asset IDs; do not replace final art with emoji or unrelated generated art |
| Source inventory and prompt provenance | Runtime manifest, resource budgets, integration screenshots and interaction recordings |

No runtime AI calls. High-resolution artwork is generated during production and packaged as local files. Work on mechanics may use explicitly marked temporary primitives, but the visual milestone and release may not pass with them.

## 2. Recommended stack and architecture

- TypeScript strict + Vite.
- Phaser for 2D scene rendering, sprite transforms, effects, and resource management. Select and pin a supported stable version during foundation setup; verify its APIs rather than mixing examples from different majors.
- Lightweight HTML/CSS UI overlay for buttons, language, collection, settings, and accessible status. Use a small UI framework only if it materially simplifies this; do not add a second rendering owner for gameplay.
- Pure TypeScript domain modules for maze generation, seeded randomness, route validation, content selection, and persistence migrations; these must run without a browser or Phaser.
- One Pointer Events adapter owns drawing input; renderer only displays accepted state. Do not simultaneously process Phaser pointer input and DOM pointer input for the same drawing gesture.
- Vitest or equivalent unit/property tests; Playwright Chromium and WebKit for flow tests; real iPad/trackpad verification for release.
- Static hosting over HTTPS; Vite base-path safe assets. Private family hosting must use real access restriction if privacy is required; an obscure URL is not access control. Provider selection/deployment remains a later setup task, not a claim of an existing site.

Suggested structure:

```text
src/
  domain/       maze, geometry, trail, difficulty, content selection, completion
  input/        pointer adapter, keyboard adapter, coordinate transform
  game/         scene, board renderer, sprite motion, effects, audio
  ui/           welcome, quest strip, controls, collection, settings
  data/         quests, translations, design tokens, asset manifest
  storage/      schema, migration, recovery
  platform/     sizing, lifecycle, offline update handling
tests/          domain and browser cases
public/assets/  optimized runtime derivatives only
art/source/     immutable source PNG candidates
art/references/ user-supplied cartoon references; not runtime assets
art/prompts/    exact prompts and reference roles
art/review/     QA findings and contact sheets if needed
```

Keep state ownership explicit. UI sends commands to the domain controller; the renderer and UI subscribe to resulting state. Avoid separate copies of trail/completion state in UI and scene.

## 3. Domain contracts

```ts
type Lang = 'pl' | 'en';
type Localized = Record<Lang, string>;
type CharacterId = 'bill' | 'tiny' | 'mazu' | 'rocky' | 'giganto';
type TreasureId = 'coconut' | 'nut' | 'flower' | 'stone' | 'shell' | 'berries';
type Difficulty = 'easy' | 'medium' | 'harder';
type Point = { x: number; y: number }; // logical board coordinates, never device pixels

interface Quest {
  id: string;
  characterId: CharacterId;
  treasureId: TreasureId;
  prompt: Localized;
  narration?: Partial<Record<Lang, string>>; // reserved, absent in v1
}
interface Maze {
  seed: string;
  generatorVersion: number;
  width: number;
  height: number;
  cells: Array<{ id: number; neighbors: number[] }>;
  entrance: { outside: Point; insideCell: number; opening: [Point, Point] };
  goal: { cellId: number; center: Point; radius: number };
  wallPolygons: Point[][];
  metrics: { solutionLength: number; branchChoices: number; maxDeadEndDepth: number };
}
interface Session {
  id: string;
  questId: string;
  maze: Maze;
  difficulty: Difficulty;
  trail: Point[];
  status: 'ready' | 'drawing' | 'paused' | 'solved';
  hintUsed: boolean;
}
interface SaveV1 {
  schemaVersion: 1;
  settings: { lang: Lang; muted: boolean; difficulty: Difficulty; motion: 'system' | 'reduced' };
  collection: Partial<Record<TreasureId, { count: number; firstFoundAt: string }>>;
  lastAwardedSessionId?: string;
  recentQuestIds: string[];
  completedOrdinaryMazes: number;
  ordinaryCompletionsSinceGiganto: number;
  gigantoUnlocked: boolean;
  activeSession?: Session;
}
```

These are interface contracts, not a requirement to store expensive derived geometry redundantly. Persist either validated geometry or seed + supported generator version. An unsupported version must start a fresh maze while retaining collection/preferences, rather than silently reinterpreting an old trail on new geometry.

One save envelope stores collection and solved session together. `award(sessionId)` is idempotent; restrict it to the active unsolved session. Flush on completion/reset and on lifecycle events; throttle ordinary trail saves. Invalid storage falls back safely. A storage failure never prevents local play.

## 4. Maze and trail implementation rules

### 4.1 Generation

1. Choose effective grid from viewport constraints and requested difficulty.
2. Reserve the central cell/clearing and one outer entrance corridor. Start with a spanning-tree maze over remaining cells; attach the center as a leaf through exactly one passage, or use an equivalent validated construction. This guarantees a simple unique route and avoids central shortcuts.
3. Derive corridor and wall geometry from the same graph. The outside area is nonwalkable except for the entrance corridor.
4. Verify the walkable graph is connected and acyclic (for a simple undirected graph, connected with E = V - 1), including the central node; this proves exactly one simple entrance-to-center solution. Then solve with BFS/DFS and compute solution length, actual branch decisions along the solution, and branch dead-end depths. Require meaningful wrong branches at the selected profile; one correct route alone does not ensure an interesting maze. Grid size alone is not a difficulty score.
5. Reject layouts outside the chosen profile; cap attempts at 100. On failure, use a known validated fallback for that effective size/profile. Never loop indefinitely or ship an unchecked result.
6. Decorate from a separate PRNG stream. Reject any placement that infringes the playable corridor plus its visual safety margin.
7. Include `seed`, generator version, profile and layout hash in debug output. Same inputs must reproduce a layout.

Inspect at least 1,000 seeds per supported profile in automated tests. Include fixed regression seeds for all discovered geometry failures. Fallbacks must pass the same validations.

### 4.2 Drawing

- Use `clientX/clientY`, canvas bounding rect, letterbox offsets and board transform. DPR affects raster resolution, not CSS hit coordinates. Recompute transforms on resize; store trail in logical coordinates.
- On primary `pointerdown` near entrance/endpoint, capture that pointer. Ignore extra fingers and nonprimary mouse buttons. Release/cancel safely.
- Process coalesced samples where supported; interpolate segments with exact swept collision or conservative sufficiently fine subdivision plus wall intersection checks. Endpoint-only collision is forbidden.
- Validate a swept ink radius, including joins, against wall boundaries. If smoothing changes the rendered curve, validate that curve too; smoothing must never create a visual wall crossing.
- Clip at the first invalid point. Do not continue from the far side of an invalid movement. Require pointer reconnection near the last accepted endpoint before resuming.
- Maintain ordered visited route segments/cells and reject loops/reverse traversal. Tolerate tiny jitter within the active segment without declaring a revisit. No automatic erase and no retrospective whole-maze pathfinding.
- Resume radius starts at 24 CSS px, capped by corridor geometry so it cannot select across a wall. Tune through child/device testing.
- Restrict `touch-action: none` and selection suppression to the drawing surface. Add overscroll handling only where required; don't disable zoom or scroll for all UI.
- The hint uses the solver only after explicit request, shows the next branch direction briefly, and never draws the solution. A hint is not a reset or completion.
- Keyboard alternate input moves one valid segment toward a chosen neighboring cell and uses the same domain validation/reset/completion rules.

### 4.3 State transitions

`loading → welcome → character-quest-intro → maze-reveal → quest-ready → drawing/paused → solved → celebrating → reward-ready → next character-quest-intro`.

Collection/settings are overlays, not new sessions. Language changes are orthogonal. Reset cancels pointer capture and any attempt-specific animation, clears trail/hint, and returns to quest-ready with the same seed. Navigation away pauses accepted input. Completion disables new trail edits, commits the award once, then triggers its visual presentation. Animation callbacks may never independently award treasure.

## 5. 2D art pipeline — Codex owned

### 5.1 Production method

Use built-in GPT Imagegen for all illustrative raster art. Do not silently substitute a CLI, paid API workflow, or different model. Prompts and source files travel with the project. This tool creates still images; movement, interaction, particle placement and audio are implemented by Claude.

1. Preserve user references and establish a shared palette/light/material description.
2. Generate an atmosphere concept. Mark it non-runtime and reject its geometry/character drift as a source of truth.
3. Generate five animation sheets directly from the supplied identity reference: Bill, Tiny, Mazu, Rocky, Giganto. Each has 16 registered frames in a 4 × 4 grid: idle, drawing attention, reset encouragement, celebration. Fixed camera and character scale, transparent gutters, consistent silhouette and anatomy. Use upper-body companions so reference facial identity is visible at small corner size.
4. Generate a six-item treasure board, background, subtle ground plate, foliage decoration kit, collection background, and decorative UI surface kit.
5. Inspect every source at full size and intended display size. Record identity, anatomy, unwanted text, clipping, alpha, background quietness, and usability in QA.
6. Claude extracts approved elements non-destructively, normalizes pivots/scale, creates transparent runtime exports and atlases, and records actual trim/frame metadata. Do not assume imagegen obeyed a requested exact grid.
7. Integrate a single finished maze; capture desktop/tablet PL/EN and reset/success recordings. Codex revises any artwork that fails in context.
8. Extend content using the established references, retaining versioned variants and provenance. Do not regenerate the entire style for every new item.

### 5.2 Source asset inventory

| Asset ID | Source deliverable | Runtime use and acceptance |
|---|---|---|
| style-anchor | One strict top-down single-host concept | Atmosphere/layout only; never a playable maze or character identity reference. Earlier tilted group version is superseded. |
| character-bill | 16-frame animation sheet | Bill's long-neck silhouette and face preserved; fixed frame registration. |
| character-tiny | 16-frame animation sheet | Green frill, correct horn count, dark beak; no clipped horns. |
| character-mazu | 16-frame animation sheet | Recognizable brown/orange character; consistent face/markings across frames. |
| character-rocky | 16-frame animation sheet | Correct red/orange body and crest; stable scale and silhouette. |
| character-giganto | 16-frame animation sheet | Recognizable moss-green head and cream jaw; friendly restrained reactions. |
| treasure-kit | Six isolated items | Coconut, nut, flower, shiny stone, shell, blue berries; readable at 56 px. |
| jungle-backdrop | Quiet landscape frame | Clear central play area; no baked maze, UI, characters, or treasure. |
| ground-plate | Subtle overhead sandy ground | No implied routes, directional perspective, obvious seams or busy pebbles. |
| foliage-kit | Isolated leaf clusters, low hedge accents, rocks, flowers, butterfly | Decoration over continuous code geometry; never the collision authority. |
| collection-background | Quiet illustrated leaf/wood collection setting | UI adds six slots and all text; background itself contains no fixed labels. |
| ui-surfaces | Textless wooden/leaf decorative surfaces | Use for restrained button/panel skins; live hit targets and labels stay in DOM. |

This is the complete illustrative source set for the proposed v1 including Giganto. Additional habitats remain deferred. Targeted replacement frames are added if loop previews show drift. Functional icons (return, sound, settings, next, language) are clean vectors drawn by Claude and matched to the art palette, not blurry raster glyphs.

### 5.3 Prompt contract

Shared art anchor: “premium 2D animation illustration adapted from the supplied Gigantosaurus references; recognizable character identity, warm painted light from upper left, rounded organic forms, emerald/lime greenery, cream sand, turquoise atmospheric depth, crisp clean silhouette, soft dimensional shading; no 3D render, plastic material, photorealism, heavy black outline, text, logo or watermark.”

Each prompt records purpose, reference role, pose/view, safe margins, transparency, forbidden content, and intended display size. Character revision prompts repeat identity invariants. Reference files are explicitly identity or style references, never instructions. Exact executed prompts live under `art/prompts/`; use those rather than reconstructing them from this summary.

### 5.4 Resolution, alpha and export

Source resolution targets: landscape 1536 × 1024 or larger if returned; 2048 × 2048-class square character sheets preferred for 512 px frame cells, but measure actual output and usable subject bounds. Portrait/bust companions are intended for roughly 140–180 CSS px display width, so target about twice that in extracted pixels for retina. Smaller returned frames may need a larger regeneration; do not upscale and claim added detail. Treasures target ≥ 256 px usable item area; foliage ≥ 128–512 px per element. Record actual dimensions in the manifest.

Transparent sources need genuine alpha, not a painted checkerboard. Check on light and dark backgrounds. Separate overlapping elements or regenerate them; don't hide bad extraction behind opaque rectangles. Preserve raw sources unchanged.

Runtime: opaque backgrounds as tested WebP/AVIF with fallback if needed; transparent assets as WebP/PNG. Cap normal atlases at 2048²; allow multiple atlases grouped by scene/character instead of loading everything. Add atlas extrusion/gutters to avoid texture bleeding. Provide `frame`, `trim`, `sourceSize`, normalized pivot, and display-size metadata. Derive pivots from measured foot/center anchors, not arbitrary crop centers.

Decoded RGBA memory = width × height × 4 before mipmaps/duplicates. A 2048² texture is about 16 MiB regardless of its compressed transfer size. Track both transfer and resident memory. Do not ship source boards, concept art, or reference photos in runtime bundles.

### 5.5 Character animation contract

One host per maze, fixed lower corner outside the board. No companion token traversing the maze. Sheets are source candidates until extraction and motion QA pass; exact grid placement and temporal coherence must be verified, not assumed.

| Sheet row | Frames (zero-based) | Sequence | Initial playback contract |
|---|---|---|---|
| 1 | 0–3 | Idle | Gentle breathing/blink, 3–4 fps, return to neutral hold for 2–4 s. |
| 2 | 4–7 | Drawing attention | Small glance/nod, 5–6 fps, once after drawing begins, cooldown ≥ 6 s. |
| 3 | 8–11 | Encouragement | Small friendly wave on reset, 5–6 fps, cooldown ≥ 4 s. |
| 4 | 12–15 | Celebration | Smile/short cheer, 6–8 fps, one or two passes on solved. |

Use semantic frame names in runtime metadata even if source ordering needs correction. Register to a stable neck/body anchor with untrimmed source-size metadata; never independently center trimmed frames. Preview each sequence against a fixed guide to catch wobble, changing face proportions, vanishing markings, duplicate limbs and clipped silhouettes. Frame 3 should transition back to frame 0 comfortably. If a generated sequence is inconsistent, request replacement frames from Codex; a crossfade does not repair anatomy.

Event priority: celebration > reset encouragement > drawing reaction > idle. Never react to the solver's knowledge of a wrong branch. A wall graze does not trigger noisy attention. Idle stays still while drawing if motion distracts; tune with actual children. Keep effects away from the trail.

Treasure-specific transforms and a few leaf/glint particles supply secondary motion. Collection arrival uses the same treasure sprite and stable screen-space mapping; cancel cleanly on resize. Reduced motion shows one approved static expression per state and directly updates the collection. No automatic voice/lip-sync, camera shake, rig inference, or synthetic in-between frames that distort identity.

## 6. Phased implementation with acceptance gates

### Phase 0 — Foundation and contracts

Create package setup, strict TS, dev/build/lint/test scripts, pinned dependencies, repository asset paths, and initial domain interfaces. Implement language store defaulting to PL, design tokens and an empty drawing scene with responsive board bounds. Add debug diagnostics behind an explicit development flag.

**Exit:** project starts and builds; PL/EN controls work; supported layout sizes reserve enough playfield; no production gameplay is claimed yet. Record chosen engine version and browser baseline.

### Phase 1 — Maze engine and honest drawing

Implement seeded graph generation, center/entrance reservation, metrics/rejection/fallback, geometry, trail validation, pointer capture, resume, reset, and keyboard adapter. Use temporary flat colors only here. Add the fixed first puzzle and profile fitting.

**Exit:** seed tests pass; fast diagonal swipes cannot tunnel; outside shortcuts fail; pointer lift/resume works; a wrong branch requires explicit reset; reset preserves seed; goal cannot trigger from a disconnected touch. Real touch and trackpad smoke test completed or explicitly recorded unavailable.

### Phase 2 — One polished vertical slice

Integrate Bill, coconut, real background, ground and foliage. Art-pack source candidates into runtime assets after extraction QA. Compose overhead readable maze and live trail. Add quest UI, reset, language, simple effects, one success sequence and persisted collection award.

**Exit:** complete first-play-to-next loop in PL/EN; screenshot and short recording on tablet/laptop sizes; no placeholder hero art; character recognition and corridor readability reviewed. Identify art defects by asset ID for Codex revision. Do not expand content to compensate for weak input or visuals.

### Phase 3 — Replay, collection and settings

Add all four regular characters plus Giganto, six treasures, twelve ordinary quests and two special examples plus a generic pictured-treasure template. Implement five ordinary completions before first Giganto; thereafter four ordinary completions between specials, persisted and idempotent. Add capped one-step special difficulty and an easier-maze escape. Preserve the uncollected-treasure-first bag when selecting special quests. Add three difficulty profiles, one-step hint, settings, collection overlay, save/resume, storage recovery and idempotent awards. Preserve trail on overlays and language switches.

**Exit:** every treasure reachable in collection rotation; repeat rewards work; reload during success awards once; repeated taps on next create one new session; zero missing translations; settings apply at documented boundaries.

### Phase 4 — Motion, sound and child usability

Tune warm restrained effects, treasure-specific celebrations, collection arrival, pose transitions, focus/pressed states, reduced motion and original soft audio. Run supervised child play sessions if available; measure ability to find reset and resume without adult instruction. Record observations instead of assuming a successful test.

**Exit:** reduced motion and muted modes are complete; soundtrack/narration absent as scoped; animation skips/resize/backgrounding cannot lose rewards or block next; input comfort confirmed on real hardware before release.

### Phase 5 — Performance, offline and release packaging

Optimize atlases/transfers, lazy-load characters/collection, cap DPR initially at 2 and tune based on real results, pause rendering/animations when hidden. Add install manifest/service worker after the core loop is stable. Version caches and wait for a safe welcome/next-maze boundary to activate an update; never force-reload a drawing session.

Test HTTPS deployment with actual base path; missing assets show a friendly retry while keeping saved progress. Validate offline launch after cache completion and recovery from a failed update. Final README includes commands, architecture, asset-source/runtime distinction, tested device matrix and deployment instructions.

**Exit:** PRD budgets measured; all acceptance cases below pass; build/lint/tests pass; art and browser QA statuses are honest; final preview ready for user review. Public release and external sharing are outside the private-family scope.

## 7. Verification matrix

| Area | Required cases |
|---|---|
| Generator | 1,000 seeds/profile; center reachable; connected acyclic graph and exactly one simple solution; meaningful wrong branches; one external entrance; bounded attempts; fallback; repeatability; route metrics; minimum corridor width. |
| Collision | Fast sweep across multiple walls; diagonal corner cut; wall graze; outside loop; crossing at low FPS; smoothing curve overshoot; all orientations. |
| Resume/reset | Lift/rejoin endpoint; touch elsewhere; pointercancel; lost capture; browser blur; second finger; UI tap; reset midway; reset while resuming; same seed after reset. |
| Rules | No auto erase; no backward branch switch; valid dead end remains neutral; tiny hand jitter tolerated; hint does not extend trail. |
| Completion | Disconnected center tap rejected; valid goal accepted once; double callbacks; repeated next taps; reset race at goal; reload before/after celebration; skip animation. |
| Special guest | First Giganto after five ordinary completions; subsequent four-completion cooldown; reload/reset do not advance counters; difficulty capped; easier version works; unseen treasure selection preserved. |
| Animation | Five sheets × four loops; stable registration/identity; neutral return; event priorities/cooldowns; no reaction based on correct route; one character only; reduced motion. |
| Localization | Fresh English-browser session still PL; persisted EN; switch during drawn route, collection, and success; all Polish glyphs; long labels; `document.lang`; accessible labels. |
| Storage | Empty, corrupt, old schema, old generator, unavailable/quota-exceeded storage; solved-session reload; collection survives invalid active maze recovery. |
| Visual | All characters/treasures; six layouts; DPR 1/2; light/dark alpha checks; no cropped faces/tails; readable trail and walls; PL/EN; reduced motion. |
| Devices | Chromium + WebKit automation; real iPad Safari, Android tablet Chrome if available, MacBook Air Safari/Chrome; actual touch and trackpad. |
| Lifecycle | Resize/orientation while drawing/success; hide/show tab; sound unlock/mute; close collection restores exact trail; twenty completions and ten overlay cycles. |
| Offline | Cache-complete offline reload; new maze without network; partial cache failure; version upgrade; old active session migration; retry without save loss. |

Use behavioral assertions for collision and award logic; avoid tests that merely duplicate implementation. Stable-seed screenshots serve as review aids; do not let loose visual diff thresholds replace inspection of narrow path boundaries. Log unavailable device tests as pending, never passed.

## 8. Working practice for the coding handoff

Implement in dependency order. Keep the project runnable after each phase. Before marking a phase complete: run relevant checks, capture changed states, inspect screenshots, and update a status log with evidence and unresolved defects. Run broad checks again only after changes that justify them.

Keep temporary primitives separate from final asset IDs. If an asset is missing or rejected, continue independent code work and report the precise need to Codex: asset ID, required pose/view, target size, screenshot, and observed defect. Do not silently lower the visual standard or claim that generated source boards are runtime-ready.

Recommended initial Claude Code instruction:

> Read PRD.md and DEVELOPMENT_PLAN.md, then art/manifest.json and art/review/QA.md. Implement Phase 0 and Phase 1 first, preserving the explicit drawn-trail/reset contract. Continue through the phased acceptance gates. Codex owns illustrative artwork; package the supplied assets non-destructively and report required revisions by asset ID. Keep maze geometry procedural and validated. Do not add runtime 3D, runtime AI, narration, or music. Record actual test results and asset readiness; do not infer approval or completed work from the reference project documents.

## 9. Technical references

- [Phaser documentation](https://docs.phaser.io/) — validate APIs against the pinned version.
- [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) and [pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) — unified pointing input and gesture lifecycle.
- [MDN Web Audio practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) — audio startup and user controls.
- [MDN offline operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — cache and service-worker behavior.

These references support technical choices, not completed implementation claims. Recheck current stable library setup when implementation begins.
