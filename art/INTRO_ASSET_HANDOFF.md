# Opening intro assets — complete source delivery

14 October 2026. **12 / 12 transparent PNG assets delivered**, including **7 animation sheets, 29 cells and 7 GIF previews**. The separate V3 character delivery is complete at 180 frames and 25 GIFs. These are source illustrations for Claude Code to extract, register and pack; runtime integration and motion QA remain outstanding.

## Files and measured dimensions

All paths below are relative to `art/source/`. Dimensions are actual generated sizes, not requested targets.

| PNG | Actual pixels | Layout |
|---|---:|---|
| `intro-leaf-curtain-left.png` | 1024 × 1536 | Individual overlay |
| `intro-leaf-curtain-right.png` | 1024 × 1536 | Individual overlay |
| `intro-light-shafts.png` | 1536 × 1024 | Translucent overlay |
| `intro-giganto-peek.png` | 1536 × 1024 | 3 × 2; six 512 × 512 cells |
| `intro-friend-popup-bill.png` | 1254 × 1254 | 2 × 2; four 627 × 627 cells |
| `intro-friend-popup-tiny.png` | 1254 × 1254 | 2 × 2; four 627 × 627 cells |
| `intro-friend-popup-mazu.png` | 1254 × 1254 | 2 × 2; four 627 × 627 cells |
| `intro-friend-popup-rocky.png` | 1254 × 1254 | 2 × 2; four 627 × 627 cells |
| `intro-title-sign.png` | 1774 × 887 | Blank sign; two visible rope loops |
| `intro-vine.png` | 1024 × 1536 | Narrow vine with transparent padding |
| `intro-sprout.png` | 2172 × 724 | Four stages; explicit crop rectangles below |
| `intro-dust-puff.png` | 2048 × 768 | Three cells in one row |

Read row-major order. Use the exact rectangles in [measurements.json](review/intro/measurements.json), including integer boundaries for the dust sheet. Never infer actual dimensions from original requested sizes.

## References, prompts and review

- Animation direction: concept A in [INTRO_ANIMATION_PLAN.md](INTRO_ANIMATION_PLAN.md).
- [Prepared jobs and status](prompts/jobs-intro-prepared.json) retain corrected V3 character identities. Saved revision prompts in `prompts/intro-prepared/` take precedence for revised files.
- The original `jobs-intro.json` remains unchanged; its old approval label was superseded by the owner's explicit request.
- [Interactive source review](review/intro/index.html): original PNG sheets, extracted-cell playback on cream and dark green, and a complete gallery.
- [Measured inventory](review/intro/measurements.json): dimensions, alpha, SHA256, byte size, frame rectangles, edge contact, prompt paths and approximate registration translations.
- [Manifest](manifest.json): source inventory and prompt hashes for both completed sets.
- [Browser review capture](review/intro/completed-browser-review.png).

The left curtain was generated before its right companion. All sources were generated with the built-in GPT Imagegen engine. Rejected earlier revisions are preserved outside source paths in `review/intro/rejected/`.

## QA results and integration details

All 12 PNGs have real RGBA transparency. All 29 animation cells have clear separation: no alpha ≥ 40 touches the measured extraction boundary. Curtain outer/top/bottom edges, the vine's upper anchor and light-ray origins intentionally reach their canvas edges. Browser review confirmed transparency on cream and dark green. Revisions improved popup cell spacing and restored complete title-sign rope loops.

### Register the popup bushes before packing

The bushes share a motif but are **not pixel-identical between poses**. Their measured bottom-bound variation is Bill 5 px, Tiny 3 px, Mazu 31 px and Rocky 5 px. Bill also has approximately 42 px horizontal drift. Per-cell `suggestedTranslationToFirstBush` values in the inventory are approximate bounds-based alignment hints, not a guarantee that leaf details match.

Use a consistent logical canvas and stable bush baseline. A shared foreground bush occluder can conceal foliage variation; choose it from a delivered cell. Do not normalize each pose independently to its tight bounding-box height. Review head and eye placement after alignment. Preview GIFs intentionally show raw source cells rather than claiming registration is finished.

### Sprout extraction is intentionally explicit

Imagegen retained uneven stage spacing after revisions. Use these half-open rectangles `[left, top, right, bottom]`, also saved in [cell-rects.json](review/intro/cell-rects.json):

```json
[[0,0,510,724],[510,0,967,724],[967,0,1541,724],[1541,0,2172,724]]
```

Cuts fall in transparent gaps. Do not split this sheet into equal quarters. Place extracted stages on a common logical canvas and align the soil baseline. The final rounded green leaf matches the UI palette and shape broadly; crossfade into the actual live PL/EN button instead of expecting a pixel-identical raster match.

### Scene assembly

- Giganto has six illustrated poses: emergence, farther lean, sniff, viewer glance, grin and blink. The first two are not exact geometric translations. Use a left-edge scene mask and movement tween to make the entrance continuous; keep the sniff flourish subtle.
- Popup subjects occupy roughly 400–470 source pixels in width, suitable for a small intro cast around 180–220 CSS pixels at 2× density. These cells are not intended for giant full-screen portraits. Giganto cells are 512 square.
- Size curtains from visible foliage bounds, overlap them and use a solid green backing for the fully closed state. Verify portrait and landscape coverage.
- Reuse the vine as two instances if needed. Trim transparent padding while retaining a consistent upper anchor.
- Keep title text live and localized in the blank sign. No text is baked into the delivered images.
- Tune light shafts to approximately 0.15–0.35 scene opacity and fade dust gently. Preserve straight/premultiplied alpha handling consistently through packing and rendering.
- Follow concept A's first-daily intro, shortened repeat greeting, skip, reduced-motion behavior, audio unlock and texture unloading. Claude supplies timeline/tweens, particles and the procedural giant shadow. Optional concepts B/D are outside this set.

## Rebuild and handoff boundary

```sh
python3 art/review/intro/build_review.py
```

This rebuilds measurements, the review page and seven GIF previews without changing source PNGs. GIFs use 180 ms per frame for inspection, not a prescribed runtime cadence.

All requested generation is complete. Claude Code owns crop extraction, registration, atlas packing and scene implementation. Preserve original source PNGs. `runtimeReady` stays false until the implemented intro is checked at actual tablet/laptop sizes, including transitions, memory use and reduced motion.
