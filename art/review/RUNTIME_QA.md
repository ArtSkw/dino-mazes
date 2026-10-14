# Runtime extraction QA (Claude)

## V3 characters and intro assets — 14 October 2026

Source: art/CLAUDE_HANDOFF_V3.md and art/INTRO_ASSET_HANDOFF.md. Packed by `tools/art/v3.py`
(called from `npm run art`). Sources untouched.

### Registration decision

Measured on all 180 frames against each master: the left (back) silhouette edge at several
torso heights stays within 2–3 source px; waist-band cross-correlation suggested shifts of up
to 30 px, but those came from poses that widen on one side (a raised arm, a hand at the hip),
not from drift. Applying them would introduce pops, so frames keep Codex's shared canvas
with the waist on the bottom edge. Head-centroid steps between consecutive frames (≤ 28 px
in drawing nods, 53 px in Mazu's anticipation squash) are intended motion.

### Tiers and atlases

| Tier | Subject height | Frames | Use |
|---|---|---|---|
| corner | 512 px | idle 8 / wave 8 / more 20 (drawing 8, celebration 8, talk 4) | welcome cast, corner companion |
| stage | 800 px | idle-00/02/04/06 + encouragement-16/18/19/20/21/22 | quest-intro pose |

Trimmed multiatlas pages ≤ 2048 px, 2 px padding, premultiplied LANCZOS scaling,
WebP q76 with alpha q70 (indistinguishable from q90/alpha 100 at 2× zoom on dark green;
saves ≈ 35 %). Per friend: 0.8–2.0 MB of files; 27–40 MiB decoded for the full corner set.

### Intro assets

Curtains cropped to their foliage; Giganto peek packed trimmed on its 512 px canvas; the
pop-up bushes registered with Codex's `suggestedTranslationToFirstBush` and scaled to 0.8;
dust at 0.5; sprout stages on one canvas with the soil baseline aligned; title sign cropped
with rope-loop positions and the plank area recorded for live text; vine cropped with its
bottom-loop position recorded. The peek's flat cell bottom is kept below the screen edge.

## V1/V2 extraction — 13 October 2026 (superseded by V3 above)


Runtime derivatives are produced by `tools/art/extract.py` (`npm run art`) from the
selected sources listed in [../manifest.json](../manifest.json). Sources were not
modified. Review aids are in [runtime/](runtime/): contact sheets on cream and dark
green with a fixed registration guide, one GIF per animation sequence, and
`extraction-report.json`.

## What was done

| Asset ID | Runtime output | Result |
|---|---|---|
| character-bill, -tiny, -mazu, -rocky, -giganto | `public/assets/characters/<id>.webp` (uniform 4×4 spritesheet, 4 px gutters) + `<id>.json` + `<id>-portrait.webp` | Frames cut at **measured** transparent gutters (all sheets have clean gutters at alpha ≥ 40). Near-transparent residue (alpha < 10, e.g. Rocky's red haze) and detached specks removed. Frames registered to frame 0 by correlating the torso band; bottoms aligned. No frame touches a sheet edge after cutting (Tiny's right column was checked). |
| treasure-kit | 6 × `public/assets/treasures/<id>.webp` (≤ 320 px) | Clean alpha on light and dark; berries read as blueberries; legible at 56 px. |
| foliage-kit | 8 × `public/assets/foliage/<name>.webp` (≤ 384 px) | Overhead hedge clusters, rocks and flower bush are stamped on code-drawn hedge walls and clipped away from every corridor. Framing plants are used only outside the board. Butterfly is the hint. |
| ui-surfaces | 4 × `public/assets/ui/<name>.webp` + `panel-leaf.webp` | Used as 9-slice borders (corners never stretch). Text on wood and leaf measured ≈ 5:1 with dark ink. **13 Oct update:** the cream panel's leaf accent lay outside the 76 px corner slice, so it stretched along the edges and covered the settings close button. `split_panel_leaf` now writes a clean symmetric panel (right half = mirrored left half; the frame is symmetric to the pixel at mid-height) and a separate leaf sprite that CSS places as a non-interactive corner decoration. |
| jungle-backdrop, collection-background, ground-plate | `public/assets/bg/*.webp` | Converted at source resolution (never upscaled). Ground is scaled across the board, not tiled. |

Integrated screenshots were reviewed at 1024×768, 1180×820, 1366×768, 1440×900,
768×1024 and 1024×600 (DPR 2).

## Revision requests (by asset ID)

> Superseded on 13 October 2026 by [../CODEX_REQUEST_V3.md](../CODEX_REQUEST_V3.md): one
> frame per image, 32 frames per character (double frame rate) plus an optional talk loop,
> generated as edits of one approved master per character.

1. **character-* (all five): higher resolution, same poses.** Measured frames are
   241–305 px wide. The corner companion displays at up to 230 CSS px (≈ 460 device
   px on a retina iPad) and the quest-intro pose much larger, so they are upscaled
   about 1.5–2×. They look acceptable but soft. Request: the same 16 poses at a
   2048×2048 sheet (≈ 512 px cells), identical camera, scale and registration.
   Priority: medium (visual polish, not blocking).
2. **character-giganto: optional front-three-quarter variant.** The current sheet
   faces right with the body cropped on the left. It works only in the lower-left
   corner, which the layout now enforces. A version facing the viewer would let him
   use either corner. Priority: low.
3. **jungle-backdrop: optional portrait variant (≈ 1024×1536).** In portrait the
   landscape backdrop is cropped to mostly sand. Priority: low.
4. **Likeness sign-off (owner).** Integrated screenshots show all five characters
   in context; exact cartoon fidelity still needs the family's approval.

## Motion QA notes

- Idle loops (frames 0–3) blink on frame 2 and return to frame 0 comfortably.
- Drawing-attention frames 6 (Bill, Rocky, Tiny) tilt the head; intentional, no
  anatomy drift seen at display size.
- Encouragement frame 10 (wave) and celebration frames 12–14 keep markings and eye
  shapes consistent; no duplicate limbs or clipped crests found.
- Frames were reviewed as still contact sheets against a fixed guide, and the
  sequences were seen in the running game only through headless screenshots. GIF
  loop previews are generated in `runtime/` but have not been watched in motion yet.
  Watching the loops (GIFs or on device) is still pending.
