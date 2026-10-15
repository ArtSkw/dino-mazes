# Motion polish — complete source delivery, 15 October 2026

All work in `CODEX_REQUEST_POLISH.md` is delivered: **10 owner-approved masters, 25 registered parts and 2 alternate poses**. All 73 jobs in `prompts/jobs-motion.json` now have `status: done` (36 priority 1, 25 priority 2, 12 priority 3). Across all priorities this is 16 masters, 53 parts and 4 poses. Artwork was generated with built-in GPT Imagegen; game implementation remains with Claude.

## Files and registration

All final images are `source/motion/<asset>/<name>.png`. Each folder includes its approved `master.png`.

| Asset | Final canvas | Parts / alternate pose |
|---|---:|---|
| stone | 1296² | body, glint |
| shell | 1392² | body, glint |
| confetti | 1648² | piece-1…6, independent particles |
| banana-plant | 1632² | base, leaves-back, leaves-front |
| fern | 1568² | base, leaves-back, leaves-front |
| monstera | 1488² | base, leaves-back, leaves-front |
| pointer | 1552² | press: whole alternate pose |
| ladybug | 1296² | body, wings, shell-left, shell-right |
| snail | 1680² | body, shell |
| frog | 1286² | jump: whole alternate pose |

[registration.json](review/motion/registration.json) now contains all 16 motion assets. Parts are listed back to front. Respect opacity and `restVisible`; whole alternate poses are under `poses`. **The `nativeToCanvas` transforms are already baked into final PNGs: do not apply them twice.** On atlas trimming, subtract the trim offset from each pivot/landmark. Confetti pieces use their own bounds/pivots and must be emitted independently, not drawn as a six-piece object.

All ten approved masters were padded without cropping, rescaling or changing approved pixels. [Padding records](review/motion/polish-padded-masters.json) contain native hashes, final hashes, sizes and offsets; exact original-pixel equality was verified. Most subjects occupy about 70%; the frog retains its smaller original framing (about 61%) to preserve the full native canvas. Native masters remain in `review/motion/polish-native/`.

The 27 new generated edits are retained at their actual native 1254² size in `review/motion/polish-parts-native/`. Final registration uses measured affine transforms with premultiplied-alpha resampling. Larger final canvases do not imply extra native detail. [Source measurements](review/motion/polish-parts-measurements.json) record final/native hashes, actual dimensions, alpha, bounds, transforms and prompt hashes. Exact executed prompts are in `prompts/polish-executed/`. No artwork was painted by code.

## QA and motion limits

All new sources have real alpha and unclipped visible bounds (alpha >40). Approved native trace-alpha pixels were preserved. Assemblies are close painted reconstructions, **not pixel-identical segmentations**: fern base, plant stems, hand details and snail opening differ slightly. Use approved masters for reduced motion and review any master-to-rig switch at the intended display size.

Tests use cream and dark-green backgrounds, 40 sampled phases per loop. All sampled frames remained unclipped. Numeric results are in [polish-delivery-qa.json](review/motion/polish-delivery-qa.json); visual limits follow.

| Asset | Test and result | Runtime guidance |
|---|---|---|
| stone, shell | Glints at ±6% object width on both axes and 130% scale: all 9 extreme positions stayed inside each body at the documented alpha thresholds. | Use registered glint opacity: stone 0.7, shell 0.4. Glints are softer than the master highlights. |
| confetti | Six distinct pieces inspected at 24 px and squeezed to 10% width, plus spinning previews. | At 10% width these are naturally colored slivers. Use this briefly as an edge-on flip, not a recognizable static silhouette. Preserve native sources for export. |
| banana-plant, fern, monstera | Both leaf groups rotated ±6° in opposing phases: roots retain overlap; no visible root gap. Minimum sampled root overlap at 320 px: banana 474/565, fern 387/608, monstera 358/205 pixels for back/front. | Prefer gentle ±2–3° idle with phase lag; ±6° is the tested stress range. |
| pointer | Master/press overlay: selected fingertip anchor maps to **[676,237]**, zero affine mapping error. | Two discrete poses. Swap at contact; avoid a long crossfade that doubles finger edges. Slight local repaint/squash remains. |
| ladybug | Wing cases open outward to 60°; hinges stay joined and the complete dark abdomen remains beneath. | **Hide wings at rest** (`restVisible:false`); reveal them as the cases open. Supplied wings are unfolded and otherwise protrude outside closed cases. |
| snail | Body scales to 25% toward the opening, behind the shell; no visible gap in sampled phases. Shell remains recognizable alone. | Draw body first, shell last. The newly painted opening is more prominent than the master and occludes the retracted body. Do not extrapolate beyond tested transforms. |
| frog | Master/jump overlay: body-centre anchor maps to **[643,606]**, zero affine mapping error; four extended limbs stay within canvas. | Two discrete whole poses. Swap at jump impulse and animate whole-body translation. No generated in-between sequence. |

Anchor errors describe the selected landmark mapping, not identical anatomy. Ladybug/snail gap checks are visual checks of the sampled composites. Browser verification loaded all 13 gallery images, with no warning/error console entries returned; plants and critters were inspected in the browser. Capture: `review/motion/polish-browser-critters.png`.

## Review and rebuilding

- [Animated review gallery](review/motion/polish-parts.html): **10 GIF previews**, each on both backgrounds, with links to four sampled phases.
- [Master/assembly comparison](review/motion/polish-parts-comparison.png).
- [Pose overlays](review/motion/polish-pose-overlays.png) and [24 px confetti / edge-on checks](review/motion/polish-confetti-24px.png).
- GIFs: `review/motion/polish-<asset>-stress.gif`. Pointer/frog have two unique poses; GIF optimization stores three frames for the loop. These previews are composites, not extra generated source frames or runtime atlases.

From the project root, with Pillow available:

```sh
python3 art/review/motion/register_polish_parts.py
python3 art/review/motion/build_polish_parts_review.py
```

The first command reproduces P2/P3 registration from preserved native sources while retaining earlier rigs. The second reproduces previews and numeric QA (it overwrites the QA JSON; preserve/re-add the final visual/browser review notes if rebuilding). The historical `build_parts_review.py` is now explicitly scoped to the six priority-1 rigs plus strawberry, preserving later registration entries. **Do not run the old `prepare_registration.py` over the final combined registration**, as it reconstructs only the earlier placement table. Earlier master approval galleries/measurements describe the native checkpoint; padded records above are authoritative for implementation.

## Claude implementation handoff

Export/pack PNGs using the supplied canvases and trim-adjusted pivots. Implement the stone/shell rigs, individual painted confetti, gentle plant wind, two-pose demo hand, and occasional tappable critters according to the plan. Keep stills for reduced motion. Runtime transitions, tablet-size review, GPU/memory budgets and gameplay distraction checks remain Claude's implementation work. No game code or runtime art paths were changed here.

---

# Motion artwork — priority 1 source delivery

15 October 2026. The six owner-approved masters are now consistently padded, and **all 30 remaining priority-1 jobs are delivered: 28 registered parts and two extra poses**. All artwork was made with built-in GPT Imagegen. This historical section covers priority 1; the completed priority 2/3 delivery is documented above. Game implementation remains with Claude. The strawberry's three layers are documented in `CLAUDE_HANDOFF_TREASURES.md`.

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
