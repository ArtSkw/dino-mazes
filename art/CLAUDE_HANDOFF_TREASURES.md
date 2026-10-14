# Four treasures — approved masters and animation parts

14 October 2026. Owner approved the four masters and authorized their parts. **All 21 priority-2 PNG parts are delivered**, together with four unchanged approved master copies. Sources use the built-in GPT Imagegen engine. This is an art-source delivery for Claude Code; runtime export, atlases and game animation remain unimplemented here.

## Files

| Asset | Canvas | Parts in `source/motion/<asset>/` |
|---|---:|---|
| feather | 1616 × 1616 | quill, vane-left, vane-right (3) |
| amber | 1472 × 1472 | body, leaf, glint (3) |
| gigaflower | 1712 × 1712 | center, petal-1…petal-6, stem, leaf-left, leaf-right (10) |
| crystal | 1600 × 1600 | base, crystal-1, crystal-2, crystal-3, glint (5) |

Each folder also contains `master.png`. The approved, byte-identical export copies are `source/treasures-v2/{feather,amber,gigaflower,crystal}.png`. **crystal-3 contains BOTH short crystals**, as specified in the jobs, so the cluster has four prisms in three crystal layers. The optional priority-3 footprint badge was not generated. The earlier six motion assets are a separate request; this delivery does not claim their parts are complete.

## Registration and rig contract

Use [registration.json](review/treasures/registration.json) for **draw order, full-canvas pivots and opacity**. Array order is back-to-front. PNGs already have the registered transforms baked in: **do not apply nativeToCanvas a second time**. If trimming for an atlas, subtract each trim offset from the pivot. Coordinates are asset-specific master pixels, not a universal 1024 canvas.

Imagegen returned 1254 × 1254 RGBA sources and did not reliably preserve scale/position. Original generated parts are archived in `review/treasures/parts-native/<asset>/`; technical affine scale/translation, including different X/Y scales where necessary, registers them to the approved master canvases. No shapes were drawn by code. Resampling uses premultiplied alpha. The approved masters themselves were never rescaled or retouched; their original transparent padding and pixels remain unchanged. Final canvas dimensions are not a claim of native generation resolution.

The registered assembly is a **painted approximation, not a pixel-identical decomposition** of the master. Petal proportions, feather barbs and crystal facets vary slightly. Use the approved master for still/reduced-motion displays and avoid a hard, unreviewed master-to-rig switch at large size. Preview both before enabling that switch.

## QA and motion limits

- All 21 parts are RGBA with real transparency, matching their own master's canvas. Visible alpha > 40 stays inside the canvas. No opaque background or floor shadow is visible on cream/dark green.
- Approved export-copy hashes match masters exactly. Actual sizes, alpha bounds, bytes, SHA256s, native hashes, transform data and executed prompt hashes are in [parts-measurements.json](review/treasures/parts-measurements.json) and [master-measurements.json](review/treasures/master-measurements.json).
- Reviewed rest assemblies and individual ±20° rotations of both feather vanes and all six flower petals. Roots remain covered in these individual stress poses. **This is not a blanket guarantee for arbitrary simultaneous rotations.**
- Feather: painted underlaps are deliberately broad. At ±20° one vane fans out and the tip silhouette visibly doubles. This stress pose is **not visually approved for runtime**. Use about ±2° independent movement, or rotate the complete feather together; do not rotate both vanes ±20° away from a stationary quill. Large bending would need mesh deformation or a different split. The generated pair is suitable for subtle motion, not anatomically separate rigid feather halves at large angles.
- Giga flower: six petals only; corrected unwanted neighbouring lobes and main-stem fragments on leaves. The calyx extends behind the bloom. About ±3° staggered petal sway is the reviewed subtle example; ±20° is a stress test.
- Amber: leaf and main white glint removed from the body and supplied separately. Leaf colour is stronger than the embedded inclusion in the master; tune its opacity if a softer submerged appearance is desired. Suggested sway ±3°; keep it within the amber body or clip at runtime.
- Crystal: all stones removed from the prism layers. Draw the revised **base after the crystal layers** to hide their continued feet. Glint contains four small white highlights, not full white crystal silhouettes; use the recorded 0.25 base opacity and a gentle pulse. Underlying crystals retain their painted facet lighting, so avoid a full-opacity additive overlay.
- Browser review loaded all four masters and all 21 parts. Cream and dark-green composites, the animation control and selected extreme poses were checked; no console errors/warnings were reported. This does not replace final in-game review at tablet size or GPU/atlas checks.

The source set is complete, with the fidelity and feather-angle limits above explicitly retained. Do not label it an exact-reconstruction pass or unrestricted ±20° production rig.

## Review and reproduction

- [Interactive parts review](review/treasures/parts.html): master / rest assembly / one-part stress test; toggle layers and backgrounds, play subtle motion.
- [Master gallery and 80 px silhouettes](review/treasures/index.html).
- [Rest comparison](review/treasures/parts-comparison.png), [individual rotation tests](review/treasures/individual-rotation-checks.png).
- Review loops: [feather](review/treasures/feather-motion.gif), [amber](review/treasures/amber-motion.gif), [giga flower](review/treasures/gigaflower-motion.gif), [crystal](review/treasures/crystal-motion.gif). These are review composites made from the real parts, not additional Imagegen source frames or runtime spritesheets.
- Browser captures: `review/treasures/browser-cream.png`, `browser-dark-motion.png`, `browser-stress.png`.

Serve `art/` locally and open `/review/treasures/parts.html` (current server: http://127.0.0.1:5198). Run `python3 art/review/treasures/build_parts_review.py` to re-register from preserved natives and rebuild measurements, rest comparisons and loops. It never edits masters. `build_master_review.py` now preserves approval status and refuses to change approved master pixels.

## Generation record

Original jobs: [jobs-treasures.json](prompts/jobs-treasures.json). Exact executed master, part and revision prompts: [treasures-executed](prompts/treasures-executed/). Rejected intermediates are retained in `review/treasures/rejected/` for traceability, not export. Revisions removed shafts from vane parts, separated two petal lobes and leaf/stem fragments, removed rocks from crystal parts, reduced the glint overlay, expanded feather underlaps and refined the foreground stone layer. One feather-underlap request had a network failure and succeeded on one retry; there is no outstanding service block.

## Claude's next step

Run the existing art export for the approved stills, then pack and rig the 21 registered parts using the recorded order/pivots. Test found/unfound silhouettes, the maze centre, collection and celebration at real size. Preserve the quiet 2–3° example motion and reduced-motion stills. Review any large-amplitude pose separately, especially the feather. No game files were changed and no runtime art export was run for this delivery.
