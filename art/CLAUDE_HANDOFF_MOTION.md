# Motion artwork — priority 1 source delivery

15 October 2026. The six owner-approved masters are now consistently padded, and **all 30 remaining priority-1 jobs are delivered: 28 registered parts and two extra poses**. All artwork was made with built-in GPT Imagegen. Priority 2/3 jobs and game implementation are outside this delivery. The strawberry's three layers are documented in `CLAUDE_HANDOFF_TREASURES.md`.

## Files and coordinates

| Asset | Canonical canvas | Parts | Separate pose |
|---|---:|---|---|
| butterfly | 1680² | body, wing-left-fore, wing-left-hind, wing-right-fore, wing-right-hind | perched |
| coconut | 1616² | body, highlight, tuft | — |
| nut | 1648² | nut, cup | — |
| flower | 1632² | center, petal-1…5, stem, leaf-left, leaf-right | — |
| berries | 1392² | berry-1…5, stem, leaves | — |
| chest | 1632² | base, lid | open |

All final PNGs are in `source/motion/<asset>/`; each folder includes `master.png`. Native generated images are 1254². Larger final canvas sizes result from padding/registration, not extra native detail.

Use [registration.json](review/motion/registration.json) for draw order **back to front**, master-pixel pivots, opacity and poses. The format matches the treasure registration. `nativeToCanvas` has already been baked into each final PNG: **never apply it again**. If an atlas trims transparent margins, subtract the trim offset from the pivot. Extra poses are independent whole objects, not additional rest layers. Do not auto-stack everything in a folder.

The six approved master images were padded without resizing or repainting any approved pixels. Original files remain in `review/motion/native-approved/`. [Padding measurements](review/motion/padded-master-measurements.json) record offsets, dimensions and hashes; original-pixel equality was verified. Parts are individually generated edits of these padded masters. Measured affine scale/translation registers them; original generated parts and rejected revisions remain in `review/motion/parts-native/`. No artwork was painted by code.

## Visual fidelity and motion QA

Assemblies are **close painted approximations**, not pixel-identical segmentations. Flower petal curvature and stem joints, strawberry seeds, nut cup detail and chest hardware differ slightly from the approved stills. Use the master for reduced motion; avoid an abrupt large-size master-to-rig switch without in-game review. The review comparison shows these differences explicitly.

Checked true alpha, unclipped alpha-40 bounds, shared canvas sizes, rest stacking and the following motion on cream and dark green. Review GIFs have 32 sampled phases; these checks are scoped to the supplied pivots and ranges, not arbitrary transforms.

| Asset | Tested | Findings / runtime guidance |
|---|---|---|
| butterfly | Each wing narrows to 20% horizontally around its root | Roots remain behind the body; no visible joint gap in sampled poses. Hind wings below forewings, body last. Keep positive width; don't mirror through zero. Perched pose is a distinct side view: transition with a short fade, not interpolation between identical silhouettes. |
| coconut | Body ±20°, tuft ±10°, stationary highlight | Body remains whole and the sheen stays inside it. Fibres/tuft can separate visually at the largest opposing angles; use body ±8–10° and tuft ±3–5° for idle, or parent the tuft to the body and add lag. Full-range GIF is a stress example. Highlight opacity 0.32 avoids a flat white patch. |
| nut | Nut lifts 6% of canvas height | Revised foreground cup has a low central rim; no visible hole opens below the nut in sampled poses. Draw nut then cup. Higher jumps would expose the U-shaped cutout and require a separate rear-cup layer; do not extrapolate. |
| flower | Staggered ±5° petals and separate 30% bloom scale | Five distinct generated petals, roots stay together in sampled poses. Leaf petioles are thicker than the still. At 30%, full-size stamens look prominent; scale the centre with the bloom for a natural runtime reveal. Suggested idle ±2–3°. |
| berries | Individual 85–115% scale, staggered | Full hidden fruit silhouettes overlap throughout sampled sequence. Leaves include a short branch; registered stem lies behind it. Do not separate their top branch positions. |
| chest | Lid 0 to −15° about right-side hinge | Base has a painted interior; lid remains attached at hinge in sampled poses. Removed duplicate latch from base. Some corner fittings remain visible under the lifted lid, a stylized 2D spring effect. Use −5–8° for a small button bounce; use open.png for the reward's fully opened chest. |

The first butterfly body had an unwanted glow; replaced. Coconut highlight was initially a whole husk-shaped overlay; replaced with a small soft sheen. Two flower parts contained incorrect/extra lobes; replaced with single petals. Nut cup initially hid too much of the nut; replaced. Chest base initially duplicated the lid clasp; replaced. Revision prompts and original attempts are retained.

## Review and reproduction

- [Browser review](review/motion/parts.html): select seven rigs, animated cream/green stress test, four phases, master/assembly comparison; flower has a bloom mode.
- [All assemblies](review/motion/parts-comparison.png).
- `review/motion/<asset>-stress.gif` for the six assets plus strawberry; `flower-bloom.gif` gives **eight review GIFs total**. These are composites from real layers, not additional generated frames or runtime atlases.
- [Measured source inventory](review/motion/parts-measurements.json): all 33 new PNGs including strawberry; final/native hashes, actual sizes, transforms, opacity, pivots and exact prompt hashes.
- Browser loaded all seven rigs' images and both backgrounds; no error/warning console entries returned. Captures: `review/motion/browser-<asset>.png`.
- Exact prompts: `prompts/finish-executed/`; jobs: `prompts/jobs-motion.json`.

Rebuild registered files and review images with `python3 art/review/motion/build_parts_review.py`. It reads current registration and preserved raw parts. `prepare_registration.py` reconstructs the initial measured placement table; do not run it after manual registration changes unless intentionally restoring those placements. Earlier `review/motion/build_master_review.py` describes the historical master checkpoint; padded measurements are authoritative now.

## Claude's next step

Export/pack the source PNGs, use the registered order/pivots/opacities, and review at tablet size. Switch the maze/collection stills to the approved designs together (nut now has a cup, berries have five fruit). Implement gentle idle and celebration timing, reduced motion, whole-object hops, atlas trimming and GPU checks. No runtime files or game code were changed here. Source completion does not claim runtime integration or user approval of every reconstructed frame.
