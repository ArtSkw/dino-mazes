# V3 masters — likeness review

13 October 2026. Generated with built-in GPT Imagegen. This delivery completes the **master-candidate stage**, not the 32-frame animation sets.

Open [the comparison page](index.html) to see five proposed masters and two candidates per character, plus revised Bill and Mazu candidates C alongside the existing runtime pose. Each candidate is a separately generated **1254 × 1254 RGBA PNG**. The tool again returned 1254 rather than requested 2048, but one character now occupies the whole canvas instead of 1/16 of a sheet. Measured subject heights are 1080–1201 px, versus roughly 255–305 px before. No image was upscaled to claim this resolution.

## Proposed choices

| Character | Preferred candidate | Reason |
|---|---|---|
| Bill | C | Revised against three new official cartoon references: no invented side fin, slimmer neck, slate-teal skin and olive dorsal scutes. |
| Tiny | A | Familiar broad frill and existing eye/beak placement; B is slightly more front-facing. |
| Mazu | C | Taller eyes, smaller brown irises, raised golden scales, slimmer arms and her signature leaf satchel, based on new cartoon references. |
| Rocky | A | Keeps the existing crest/face balance; B is more wide-eyed. |
| Giganto | B | Maintains right-facing angle with more snout clearance than A. Still needs exact framing normalization. |

These are Codex recommendations, **not owner-approved selections**. `master.png` in each v3 folder is a byte-identical copy of the recommended candidate, marked pending in `art/manifest.json`. All candidate originals remain immutable. There are no `idle-00.png` copies or other reaction frames yet.

## Approval checkpoint

[CODEX_REQUEST_V3.md §3](../../CODEX_REQUEST_V3.md) explicitly says: “Stop and send the five masters to the owner for likeness sign-off before step 2”. This is why animation generation pauses here. Approval of these faces is still required; the initial request to begin this batch is not recorded as likeness approval.

The owner can approve the proposed set, choose A/B per character, or identify a face needing revision. Record the actual approval date only after receiving that decision. Then finish technical master framing and derive all key frames and in-betweens from the approved masters.

## Technical findings

- All twelve candidates have the same 1254² square canvas and genuine alpha. Source metadata and SHA-256 per file are in `../../manifest.json`.
- Characters, horns, frills, crests, and snouts are visible without clipping at their side/top edges. Side clearance is tight for Mazu and Giganto. Exact requested 11% headroom / 6% side margins / bottom-edge waist were **not** all achieved. This is a recorded deviation, not a passed framing check.
- The prompt's 78% occupied height, 11% headroom, and bottom-edge waist cannot all be true simultaneously. Executed prompts prioritize the explicit headroom/waist anchors, implying roughly 89% occupied height. Actual measured margins still vary; see [measurements.json](measurements.json).
- Standardize the chosen master framing before generating dependent animation frames. Prefer a targeted Imagegen framing revision preserving approved likeness; report any residual geometry limits. Do not silently change the face during normalization.
- The native generation preview can expose RGB stored under almost-transparent pixels. Judge the saved PNG composited in a browser on cream/dark green; do not discard correct alpha based on the tool thumbnail.
- No animation alignment, ±2% temporal consistency, in-between quality, GIF playback, or runtime memory claims can be made at the master-only stage.
- For later job ordering, follow dependencies rather than “all even indices first” literally: encouragement-20 depends on encouragement-19 even though 19 is odd. The manifest's `edit` dependencies must exist before an edit runs. For in-betweens, use actual adjacent approved keys when available; eye/blink poses still follow the explicit pose specification.

## Browser verification

The proposed set was inspected on cream and dark green backgrounds, and all ten candidates were inspected on cream at the larger comparison size. No opaque background rectangles were observed. See [the proposed-set screenshot](masters-browser-check.png). File hashes, prompt paths, and byte-identical recommended master copies were verified; all previous manifest asset entries were preserved.

## Scope retained

Existing game source, `public/assets`, earlier art sources, and the 185-job request list are unchanged. Exact executed master prompts are in `art/prompts/v3-executed/`. The optional talk loops and §7 suggested extra assets have not been generated in this stage.

## Bill likeness revision

Candidate C was generated with built-in GPT Imagegen after the owner supplied three additional cartoon references. Its prompt is `art/prompts/v3-executed/bill-master-c.txt`; the references are preserved in `art/references/bill-v3/`. `master.png` now points to C by byte-identical copy; A and B remain available. C remains a proposed master, not an approved animation source. Exact framing still needs normalization.

## Mazu likeness revision

Candidate C was generated with built-in GPT Imagegen from three newly supplied official cartoon references, preserved in `art/references/mazu-v3/`. Exact prompt: `art/prompts/v3-executed/mazu-master-c.txt`. It corrects the eyes, muzzle texture, cream underside, arms and costume, adding her signature vine strap and leaf satchel. `master.png` is a byte-identical copy of C; A and B remain available. Likeness approval and exact framing normalization are still pending.

Mazu C was inspected on cream and dark green backgrounds with no obvious edge artifacts at review sizes. [Comparison screenshot](mazu-revision-browser-check.png). PNG hashes verified.
