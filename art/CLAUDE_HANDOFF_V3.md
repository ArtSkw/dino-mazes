# Character artwork V3 — complete source handoff

Updated 13 October 2026. **Complete: 180 selected animation frames, five additional selected masters and 25 reaction GIF previews.** The built-in GPT Imagegen resumed successfully after the daily reset. All 29 formerly missing frames were generated individually; no missing artwork was replaced by duplicate frames. Four new reaction frames received hand/arm corrections before delivery.

## Inventory

| Character | Required reactions | Talk poses | Available / planned |
|---|---:|---:|---:|
| Bill | 32 / 32 | 4 / 4 | 36 / 36 |
| Tiny | 32 / 32 | 4 / 4 | 36 / 36 |
| Mazu | 32 / 32 | 4 / 4 | 36 / 36 |
| Rocky | 32 / 32 | 4 / 4 | 36 / 36 |
| Giganto | 32 / 32 | 4 / 4 | 36 / 36 |
| Total | 160 / 160 | 20 / 20 | 180 / 180 |

All available animation PNGs are **1254 × 1254 RGBA with true alpha**, generated individually using the built-in GPT Imagegen. Five selected masters are additional files; `idle-00.png` is a byte-identical copy of each master. Master candidates are retained but are not animation frames. Never count every PNG in a source folder as part of a sequence.

Use these source directories:

```text
art/source/character-bill-v3/
art/source/character-tiny-v3/
art/source/character-mazu-v3/
art/source/character-rocky-v3/
art/source/character-giganto-v3/
```

Expected sequence mapping, same for all characters:

| State | Exact filenames | Count |
|---|---|---:|
| Neutral master | `master.png` | 1 reference |
| Idle | `idle-00.png` … `idle-07.png` | 8 |
| Drawing / attentive | `drawing-08.png` … `drawing-15.png` | 8 |
| Encouragement | `encouragement-16.png` … `encouragement-23.png` | 8 |
| Celebration | `celebration-24.png` … `celebration-31.png` | 8 |
| Talking | `talk-32.png` … `talk-35.png` | 4 |

## What changed

- Bill: slim slate-teal neck, cream front, olive dorsal spikes, no invented side fin; corrected final celebration hand position.
- Mazu: raised oval eyes, golden pebble scales, broad cream throat, green leaf satchel and vine strap; restored sparse ivory teeth in smiling poses. Her wave uses the hand on the image's right, with corrected spacing in frames 19 and 20.
- Rocky: tall cream crest, slender coral neck and arms, no pale fingernails. His encouragement wave uses the hand on the image's left; frame 17 follows that direction, and frame 23 settles both hands.
- Giganto: heavier brows, smaller eye, broad jaw and irregular teeth, no extra snout horn. He faces the image's right; use the lower-left game corner. Corrected extra digits/arm artifacts, including new frame 20; celebration 31 now settles both hands above the crop.
- Tiny: preserved the established frill and beak orientation during the attentive glance; corrected the lifting hand in frame 18.
- Mazu and Rocky's celebration key 28 uses skin-colored closed eyelids rather than white eyeballs with painted smiles.

Selected masters derive from likeness candidate C for Bill, Mazu, Rocky and Giganto, and candidate A for Tiny, followed by a framing edit. The owner authorized the final likeness refinements and animation generation on 13 October; this records permission to proceed, not a separate owner sign-off on each generated pose.

## Review and verification

- [Interactive review](review/v3/index.html): original PNG playback on cream and dark green, frame stepping, master overlay, and all complete reaction GIFs.
- **25 GIFs** exist at `art/review/v3/<character>-<reaction>.gif`, at 10 fps. Every sequence is complete; GIFs contain all 8 reaction frames or all 4 talk poses.
- [Measured inventory](review/v3/animation-measurements.json): SHA256, dimensions, alpha range, alpha-40 subject bounds, edge contact and prompt provenance per selected frame.
- [Asset manifest](manifest.json): updated V3 entries preserve the older asset inventory and use `source-candidate-runtime-qa-pending`.
- Every one of the 180 selected PNGs passed same-size/RGBA/alpha checks. None has alpha ≥ 40 on the top, left or right canvas edge. The bottom edge intentionally cuts the waist.
- Browser checks on cream and dark green show proper transparency without opaque background rectangles. Colored flecks visible in some generator previews were not visible as solid artifacts in the tested browser composites.
- **The ±2% head/eye registration target is not certified.** Some generated poses change head angle, markings or position slightly. Source previews expose those variations; they do not prove that packed animations are free of pops. Final registration and review at actual game size remain necessary.

The source busts are intentionally waist-cropped. They cannot be used as full-body walking sprites. The files are high-resolution 2D illustrations with dimensional shading, not 3D models.

## Rebuild review and inventory

```sh
python3 art/review/v3/build_previews.py
python3 art/review/v3/update_manifest.py
```

Both commands pass with 180 frames, 25 GIFs, no missing files and no top/side alpha-40 edge contact. They assemble review material and metadata only. The selected generated frames have distinct SHA256 hashes. Five idle-00 files intentionally copy their selected masters.

The full original generation prompts are in `prompts/jobs-v3-executed-animation.json`; individual revision prompts in `prompts/v3-executed/` take precedence for replaced files. Rejected variants remain outside source sequences in `review/v3/rejected/`. `prompts/jobs-v3-remaining.json` is now empty. A transient output safety rejection on Rocky talk-32 cleared on one unchanged retry.

The new frames were inspected individually and in browser playback/contact views. Transparency is clean on cream and dark green. Source motion still includes small generative changes in hands, markings and head placement; do not treat these previews as certified final runtime motion. See registration requirements below.

## Integration — Claude Code

1. Read explicit sequence filenames from the manifest. Exclude `master-*.png`, rejected variants and review GIFs from runtime atlases.
2. Register frames to each character's selected master before trimming. Preserve intended nod/breath/bounce motion; correct unintended scale or anchor drift. Do not independently scale each tight alpha box to the same height: raised hands would shrink the body. Keep consistent logical canvas coordinates and bottom waist anchor.
3. Produce trimmed Phaser atlases with source-size and sprite-source-size metadata, padding/extrusion, and straight/premultiplied alpha handled consistently. Keep original PNGs immutable.
4. Build a corner tier around 512 px subject height. Use a stage tier around 900 px only for the quest intro pose. Load the current host's full set on demand; the welcome cast needs idle only. Recheck the 96 MiB GPU budget and first-playable time from the PRD.
5. Double the old frame rates to preserve the established reaction durations. The 10 fps GIFs are review aids, not a requirement to play all runtime states at one rate. Celebration and encouragement should play once and settle to idle. Drawing remains calm; no constant repeated cheering while a child thinks.
6. Talk frames are mouth poses, not Polish/English phoneme synchronization. Use restrained short sequences while the speech bubble is visible, closing at the end. Honor reduced-motion preferences.
7. Review complete loops at corner and intro sizes on tablet/laptop, including state transitions and both backgrounds. Measure head/eye registration and memory before changing `runtimeReady` or marking runtime QA complete.

No game source code, runtime atlas or deployed behavior was changed in this art pass. Extra scenery/chest/critter suggestions in request section 7 were not selected for this character animation delivery.
