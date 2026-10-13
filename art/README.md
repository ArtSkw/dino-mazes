# Dino Mazes — generated art handoff

Generated with the **built-in GPT Imagegen tool** on 12 October 2026. The actual selected files, dimensions, transparency and readiness are recorded in [manifest.json](manifest.json). All game implementation remains with Claude Code.

## Start here

1. Read [the PRD](../PRD.md) and [development plan](../DEVELOPMENT_PLAN.md).
2. Inspect [the revised top-down concept](source/style-anchor-v2.png). It establishes composition only; its maze has not been checked for a unique solution and must never be used as the playable board.
3. Open [the source inspection page](review/preview.html) in a browser. It works directly from disk and provides light/dark background inspection plus first-frame sizing.
4. Read [QA findings](review/QA.md) before extracting sprites. Source candidates are not ready-packed runtime atlases.

## Selected sheets

| Character | Source | Layout |
|---|---|---|
| Bill | [character-bill-v2.png](source/character-bill-v2.png) | 4 × 4; idle, drawing attention, encouragement, celebration |
| Tiny | [character-tiny-v1.png](source/character-tiny-v1.png) | Same |
| Mazu | [character-mazu-v1.png](source/character-mazu-v1.png) | Same |
| Rocky | [character-rocky-v1.png](source/character-rocky-v1.png) | Same |
| Giganto | [character-giganto-v2.png](source/character-giganto-v2.png) | Same; wider spacing than superseded v1 |

There are **80 generated reaction frames** across five sheets. These are upper-body corner companions, not walking characters or skeletal rigs. Sprite sequences and runtime timings are specified in DEVELOPMENT_PLAN.md §5.5. Character recognition and consistency still need owner review and in-motion integration checks; exact cartoon fidelity is a requirement, not a claim that generation automatically achieved it.

## Environment and UI source kit

- [Six treasures](source/treasure-kit-v1.png): coconut, nut, flower, stone, shell, blueberries.
- [Overhead jungle backdrop](source/jungle-backdrop-v1.png): empty central play area.
- [Sandy ground plate](source/ground-plate-v1.png): opaque material for code-generated paths.
- [Foliage kit](source/foliage-kit-v1.png): two overhead hedge clusters, rocks, flowers, two framing plants, leaves, butterfly.
- [Collection background](source/collection-background-v1.png): textless treasure-album surface.
- [Decorative UI surfaces](source/ui-surfaces-v1.png): wood button, leaf button, cream language-switcher plate, cream panel.

Generated images provide illustration. Code provides the exact maze, collision boundaries, ink, functional icons, text, UI, motion and audio. Never infer navigation from the painted concept. Keep decorative plants outside walkable space and use continuous code-generated wall fills under foliage.

## Source handling

- Keep `source/` immutable. Export optimized runtime files elsewhere, preserving alpha and consistent registration.
- Square character sheets returned at **1254 × 1254**, not the requested 2048 × 2048. Their nominal 4 × 4 cells are 313.5 px; do not pass a guessed integer frame width to an automatic grid splitter. Use measured rectangles and normalize frames to a common untrimmed canvas.
- Never advertise these as 4K sources. Measure useful subject pixel size before choosing display size. Request targeted higher-resolution row/frame generations from Codex if the actual game needs larger or sharper portraits.
- The native generation preview sometimes showed RGB color beneath nearly transparent pixels. Inspect the saved PNG in a normal browser, not only the generation thumbnail. Genuine alpha was verified in file metadata and browser rendering.
- Older variants are retained for provenance and comparison, not selected automatically by highest filename: treasure-kit-v1 is selected over v2, which added unnecessary saturation; character-bill-v2 and character-giganto-v2 are selected over v1.
- `references/` contains the user-supplied cast image for identity. Do not bundle it into the game. `prompts/` contains generation jobs and revision prompts. Use original cartoon references rather than the generated concept as the identity source.

## Remaining implementation work

Claude must extract/register frames, pack atlases with gutters, build and test the specified animation state machine, optimize textures, and verify at actual device size. Codex handles any illustrative revisions revealed by integration. Source generation does not replace those checks.
