# Source-art QA — 12 October 2026

## Completed checks

- All selected source PNGs opened and their actual dimensions/alpha channels measured.
- All five character sheets visually inspected for intended subject and 16-frame arrangement.
- Bill and Giganto revised; Giganto v1 had insufficient per-frame snout spacing, so v2 is the selected source.
- Saved character PNGs and treasure cutouts rendered in a browser on a cream background; the apparently bright background residue in native generation previews is not representative of their normal compositing at preview size.
- An overhead background and revised single-character concept replace the tilted group composition.
- No baked labels or game-language text appear in selected art.
- Browser check on dark green at 180 CSS-pixel nominal frame size confirms all five first frames remain visible with clean-looking transparency at that scale. Saved evidence: [characters-browser-check.png](characters-browser-check.png). Full-sequence motion QA is still pending.

## Readiness and limitations

| Asset | Finding | Required integration action |
|---|---|---|
| Five character sheets | 1254² output; 16 intended frames each. This is below requested 2048². Small camera/scale/expression variation remains. | Measure frame rectangles and usable subject size; register frames to stable anchors; preview four loops at intended screen size. Request targeted regenerated frames if facial proportions drift. |
| Tiny / Mazu / Rocky | A few poses have tight padding near nominal cell edges. | Use measured bounds rather than blind fixed-cell cuts; provide atlas gutters. Do not clip hands or frills. |
| Giganto | v2 improves separation and keeps the long muzzle visible. | Use v2. Check wave/celebration frames carefully; his large head must not dominate the playfield. |
| Bill | v2 retained after edge-cleanup pass. | Preserve long-neck proportions; do not stretch into a square portrait. |
| Transparent boards | Real alpha; native preview may show RGB under almost-transparent pixels. | Check on light and dark runtime surfaces at full scale. Preserve soft edges; never apply crude chroma-key removal based on the native preview. |
| Treasure kit | All six objects distinct; berries read as blueberries. v2 extraction attempt is more saturated; v1 selected. | Extract six independent sprites and verify at 56 px; correct scale differences through layout metadata. |
| Foliage | Top four elements intended for overhead use; bottom plants are decorative framing views. | Only overhead elements dress maze walls; other plants stay in the outer margin. No decorative collision authority. |
| Ground | Low-detail sandy texture; not certified seamless. | Use as a scaled/clipped plate or test seams before tiling; never assume seamless repetition. |
| UI surfaces | Textless skins only. | Measure corner insets for slicing, or use as restrained decoration over accessible live UI; no stretching leaves or grain arbitrarily. |
| Revised concept | More overhead, single Bill host. Still has illustrative foliage depth and an unvalidated maze. | Product's strict orthographic board/unique-route requirements override the concept. No tracing or shipping its maze bitmap. |

## Not yet claimed

- Owner approval of exact cartoon likeness.
- Finished runtime atlases, integer-aligned frames, animation timing, or seamless loops.
- Retina sharpness at all planned sizes; useful character width is less than a nominal cell width.
- Integrated-game screenshots, performance, touch comfort, or unique-route validation of any illustrated concept.
- A built or deployed game.

The browser inspection page is an art QA aid only, not game implementation. The development plan assigns frame packaging and runtime animation to Claude, and illustrative revisions to Codex.
