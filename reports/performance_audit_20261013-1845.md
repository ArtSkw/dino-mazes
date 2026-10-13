# Performance Audit: whole repository (first release), 13 October 2026

Scope: the shipped client (`src/`, build config, service worker) for tablets and laptops,
against PRD §9 budgets (initial transfer ≤ 5 MB, first playable ≤ 4 s at 10 Mbps, GPU
≤ 96 MiB, 60 fps target / ≥ 30 fps on the oldest tablet). Run inline by one agent (Claude,
Opus 5.5), no subagents. There is no database or API, so the N+1, over-fetch and index checks
were applied to their client equivalents: asset-loading waterfalls, files fetched but never
used, per-frame work, and caching.

Current numbers (production build): JavaScript 1.37 MB Phaser chunk + 123 KB app (≈ 357 KB
+ 39 KB gzip), CSS 18 KB, fonts 6 × woff2 ≈ 105 KB, runtime art 2.6 MB WebP; service worker
precache 53 files. Previously measured first playable 3.05–3.10 s at 10 Mbps (docs/STATUS.md).

## Findings

Startup bundle:
  - Finding: the whole Phaser library ships and is parsed before anything renders; it is ~90 % of the JavaScript.
  - Evidence: src/game/game.ts:6 `import Phaser from 'phaser';` (also scene.ts, actor.ts) → dist/assets/phaser-*.js 1,374,100 bytes.
  - Recommendation: a custom Phaser build (only WebGL renderer, Graphics, Image/Sprite, Tweens, Particles, Loader, Time) or a later Phaser release with module entry points; measure with the existing `tools/dev/load-time.mjs`.
  - Effort: High · Priority: Medium · Expected effect: roughly 40–60 % less JS to download and compile; most noticeable on older tablets.

Asset loading order:
  - Finding: every texture loads in one preload before the welcome screen appears, including board-only art (ground, hedges, rocks, flower bush, treasures, ≈ 0.6 MB) that the first screen never shows.
  - Evidence: src/game/scene.ts:84-97 `preload()` loads backgrounds, all foliage, all treasures and all five character sheets.
  - Recommendation: two phases: backdrop + cast + UI surfaces first; board and treasure art in the background after `create()`, awaited only by "Graj". Invalidation: none needed (same files).
  - Effort: Medium · Priority: Low (first playable is within budget) · Expected effect: welcome screen ≈ 0.4–0.6 s sooner at 10 Mbps.

Service worker precache:
  - Finding: files no longer used at runtime are still deployed and precached on install: five friend portraits (quest card removed), five per-character JSON files and `assets/manifest.json` (the app imports `src/data/assetManifest.json`), and `ui/cream-pill.webp` (≈ 106 KB, 12 requests).
  - Evidence: dist/sw.js precache list ("./assets/characters/bill-portrait.webp", "./assets/characters/bill.json", "./assets/manifest.json", "./assets/ui/cream-pill.webp", …); grep finds no runtime reference.
  - Recommendation (applied): exclude them from the precache list in `vite.config.ts`.
  - Effort: Low · Priority: Low · Expected effect: −12 install requests, −106 KB per device.

Rendering while hidden:
  - Finding: the Phaser loop keeps rendering at full rate while the opaque, full-screen treasure collection covers the canvas.
  - Evidence: src/styles.css `.collection-bg { position: absolute; inset: 0; … }` over the canvas; src/game/game.ts has no sleep/wake on overlays.
  - Recommendation (applied): `game.loop.sleep()` while the collection is open, `wake()` on close (the settings overlay is translucent, so the game keeps rendering there).
  - Effort: Low · Priority: Low · Expected effect: GPU idle and less battery use while children browse their treasures.

## Already efficient (checked)

- Maze generation: ≈ 0.3 ms per maze on average, worst case a few ms (`tools/dev/maze-stats.test.ts`), even at the hardest level.
- Drawing: engine ≈ 0.001 ms per pointer move; trail redraw ≈ 0.8 ms for 600 points (joints only at bends).
- Saves while drawing are batched (`SaveStore.stage`, 800 ms) and flushed on lift, pause and page hide.
- Board texture repaint on resize is debounced (160 ms) and old textures are released.
- Fonts: only three weights, two subsets each, `unicode-range` so unused subsets never load.
- Caching: content-hashed JS/CSS/fonts; a content-versioned service worker precache, cache-first app shell, updates applied only at safe moments; GitHub Pages' 10-minute HTTP cache is bypassed on install (`cache: 'reload'`).
- Art is WebP at measured sizes; GPU estimate ≈ 50 MiB of the 96 MiB budget.

## Needs runtime profiling

- Real frame rate and memory on the family's oldest tablet (headless numbers are not representative).
- Phaser JS parse/compile time on that tablet, to decide whether the custom build is worth it.
- Effect of `maxTextures: 1` (one texture per batch) on draw calls on the tablet's GPU.
