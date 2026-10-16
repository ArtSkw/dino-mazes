# Entry artwork — complete source delivery

16 October 2026. **All 10 jobs in `prompts/jobs-entry.json` are done:** eight curtain layers, one opaque backing and one six-leaf sprite sheet. The owner approved the four left layers before the remaining work. All artwork was produced with built-in GPT Imagegen; no CLI fallback or programmatic painting was used. Runtime implementation remains with Claude.

## Sources and registration

| Source under `source/entry/` | Actual native canvas | Format |
|---|---:|---|
| `curtain-left-{back,mid,front-top,front-bottom}.png` | 1024 × 1536 each | RGBA |
| `curtain-right-{back,mid,front-top,front-bottom}.png` | 1024 × 1536 each | RGBA |
| `backing.png` | 1536 × 1024 | RGB, opaque |
| `leaves.png` | 1536 × 1024 | RGBA, six cells |

[registration.json](review/entry/registration.json) contains all ten source paths, actual canvas sizes, SHA-256 hashes, alpha bounds, touched canvas edges/counts, draw order, pivots and prompt hashes. Bounds and sheet rectangles are half-open `[left,top,right,bottom]`; visible bounds use **alpha ≥40**. For each curtain, draw `back → mid → front-top → front-bottom`, all at identical scale and position. The files remain unmodified native outputs: there is no baked transform to apply. If the extractor trims a layer, retain its original offset within the 1024 × 1536 canvas and adjust its pivot accordingly.

Selected versions: left back/mid v1, top v2, bottom v3; right back/mid v1, top v2, bottom v3; backing/leaves v1. Original attempts are retained in `review/entry/native/`. Exact prompts and revision prompts are in `prompts/entry-executed/`. The interrupted first leaf-sheet call returned no saved artifact; a fresh built-in call produced the delivered sheet. Existing intro sources and game code were preserved.

## Visual QA and limits

The two sides are separate paintings, not flipped copies. They retain teal shadows, warm lime highlights, tropical leaf shapes and dew. The background is a soft, luminous rainforest clearing; behind the sharper curtain leaves it reads as distant scenery. It contains a few painted pollen specks, so keep additional runtime pollen restrained. Back/mid layers retain some sunlit accents; depth separation is moderate rather than uniformly dark.

Both curtains were inspected on cream and dark green, individually and stacked, and together on the new backing. No visible matte/halo or straight horizontal join was found. Leaf tips and cutouts create organic openings at the inner edges. At rest, each outer 350-pixel core is continuously covered at alpha ≥40. Full-height back/mid layers meet the top and bottom edges, but **seamless vertical texture repetition is not established**; use full-height cover, not repeat.

Foreground overlap is **18.55% on the left (y=718…1003)** and **22.40% on the right (y=765…1109)**. The right overlap remains wider than the approximately 15% brief target after two layout corrections; it produces a natural leaf overlap, with no visible seam in the reviewed stack. It is recorded accurately rather than treated as exact geometry. Foreground leaves deliberately continue past the outer/bottom canvas edges.

### Movement test

For each side, tested all four layers separately at nine dx/rotation combinations (−24/0/+24 px, −1.5/0/+1.5°) and 32 staggered-motion samples. Pivots are **left [0,768]**, **right [1024,768]**. Numeric results are in [entry-qa.json](review/entry/entry-qa.json).

**48 native pixels of overscan are required at the outer/top/bottom viewport edges.** Raw-canvas motion exposes its finite boundary and fails outer-edge coverage. Tested safe source viewports:

- Left: `[48,48,1024,1488]`, with outer coverage core `[48,48,350,1488]`.
- Right: `[0,48,976,1488]`, with outer coverage core `[674,48,976,1488]`.

With these clips, every tested extreme and animation sample retained outer-core coverage. This tests the stacked curtain, not full-screen coverage by each foreground piece. Scale overscan and translation together at other display sizes. Re-test if the pivots or ranges change. Prefer smaller, slow idle motion; the GIFs illustrate stress ranges, not finished intro timing.

### Six-leaf sheet

Native row-major cells are 512 × 512; coordinates and measured subject bounds are also in registration:

| Index | Leaf | Rectangle |
|---|---|---|
| 0 | monstera | `[0,0,512,512]` |
| 1 | heart | `[512,0,1024,512]` |
| 2 | fern | `[1024,0,1536,512]` |
| 3 | banana strip | `[0,512,512,1024]` |
| 4 | round curled-tip leaf | `[512,512,1024,1024]` |
| 5 | two-leaf sprig | `[1024,512,1536,1024]` |

All six visible silhouettes are wholly inside their cells and separated. Native output contains trace **alpha 1/255** on some cell boundaries; these original pixels were preserved. The narrowest visible cell margin is about 10 px, less than the requested nominal generous margins, but there is no clipping or contact with neighboring leaves. Extract by the registered cell rectangles, then trim using subject bounds if needed; retain pivot offsets and add atlas extrusion/gutters to prevent texture bleeding.

Each silhouette was inspected at a **40 px maximum dimension** on both backgrounds. At 10% horizontal width, the sprites become 3–4 px colored edge-on slivers: suitable for a brief animated flip, not a static recognizable leaf shape. All six remain visible in the flip preview. Do not claim species recognition at that extreme width.

## Review files

- [Final gallery](review/entry/index.html): paired scene, motion, right-side layers/comparison, leaf checks and 1×/2× view.
- [Pair on backing, native 1×](review/entry/pair-on-backing-1x.jpg), [2× inspection](review/entry/pair-on-backing-2x.jpg).
- Each side separately: `review/entry/{left,right}-on-backing-{1x,2x}.jpg`.
- Four GIFs: `left-final-stress.gif`, `right-final-stress.gif`, `pair-motion.gif`, `leaves-flip.gif` in `review/entry/`.
- [Actual 40 px / 10%-width checks](review/entry/leaves-40px.png).
- `review/entry/{left,right}-final-comparison-{cream,green}.jpg` compares the old/new artwork at exactly the same size; `*-final-layers.jpg` shows separated layers on both backgrounds.

GIFs are palette-limited review composites and can show banding; use source PNGs for final rendering. The gallery loaded all seven image elements without error/warning console entries during review. The pair's 1× image places each curtain at its native 1024 × 1536, side by side, over a cover-fitted backing. It is an art-composition reference, not an imposed game viewport layout.

**2× is inspection scaling, not newly generated detail.** Layering at identical source-to-screen scale does not automatically deliver 2–3× more pixel density. Final sharpness must be checked in the implemented layout at 2560 × 1440 and DPR 2; this source delivery does not claim that device check or the download/GPU budget has passed.

## Rebuild and Claude integration

From project root, with Pillow and NumPy available:

```sh
python3 art/review/entry/build_entry_review.py
```

This rebuilds registration, numeric QA and review artifacts from selected PNGs, without changing the source artwork. Preserve/re-add final visual/browser notes if rebuilding the QA JSON. The historical `build_left_review.py` is guarded against overwriting final registration; `left-approval.html` remains a historical approval snapshot.

Claude should pack the eight layers at full resolution, place the backing behind them, preserve the measured pivots/overscan, and integrate gentle sway/parallax. On entry, part foreground first and back last; emit the six painted leaf particles with spin/drag. Review reduced motion, phone/tablet/desktop layout, memory/download budgets and Retina sharpness in the game. All requested source artwork, registration and review assets are delivered; runtime code is outside this task.
