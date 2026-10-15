# Codex art request: the last polish (motion priorities 2 and 3)

> Status, 15 October 2026: **delivered and in the game** (art/CLAUDE_HANDOFF_MOTION.md).

15 October 2026, Claude Code. The owner asked to finish every remaining asset of the motion plan
so the whole game is painted and alive. Execute with the built-in **GPT Imagegen** skill. Jobs:
[prompts/jobs-motion.json](prompts/jobs-motion.json), **37 jobs with `status: "todo"`**
(priority 2: 25, priority 3: 12). Everything with `status: "done"` is delivered; leave it alone.

## What to make

| Priority | Asset | Master | Parts / extra pose | Where it goes in the game |
|---|---|---|---|---|
| 2 | stone | the turquoise pebble, same design as today | body, glint | treasure: the glint drifts and slides, a star flares on find |
| 2 | shell | the peach spiral shell, same design as today | body, glint | treasure: glints pulse along the spiral, it turns over on find |
| 2 | confetti | six pieces in two rows of three, wide gaps | piece-1 … piece-6 | replaces the code-drawn leaves and petals that burst from a found treasure |
| 2 | banana-plant | the banana plant already in the game | base, leaves-back, leaves-front | welcome screen and maze corner: the wind ripples through the leaves |
| 2 | fern | the fern already in the game | base, leaves-back, leaves-front | same |
| 2 | monstera | the monstera already in the game | base, leaves-back, leaves-front | same |
| 3 | pointer | a child's hand pointing up | press (pose) | the first-maze demo hand presses, drags and lifts |
| 3 | ladybug | red ladybug from above | body, shell-left, shell-right, wings | hidden on a hedge: tapped, it lifts its wing cases and flies off |
| 3 | snail | snail from above | shell, body | hidden on a hedge: tapped, it pulls into its shell |
| 3 | frog | frog sitting, from above | jump (pose) | hidden on a hedge: tapped, it hops away |

The stone, shell and the three plants must stay **recognisably the same** as today's art
(`source/treasure-kit-v1.png`, `source/foliage-kit-v1.png`). The critters are small: readable at
30 px. Nothing may be scary.

## Method and gates (as in the last delivery)

1. **Ten masters first**, priority 2 before 3, then stop for the owner's approval.
2. Pad each approved master so the subject is about 70 % of the canvas (never crop, never retouch
   approved pixels); record the padding.
3. **Parts and poses** as edits of the padded master: same canvas, scale and position, hidden
   overlaps painted. Register them with measured affine transforms, as before.
4. Add every asset to `review/motion/registration.json` in the existing format (back-to-front
   order, master-pixel pivots, opacity, baked transforms, extra poses under `poses`). Extra
   points: the **fingertip** for the pointer (same pixel in both images), the **body centre** for
   the frog (same pixel in both images).
5. Set `status: "done"` and your delivery records in the jobs file; update
   `CLAUDE_HANDOFF_MOTION.md` with what was made and any motion limits found.

## Stress tests that match the planned motion

Check each on cream and dark green and write down any limit you find (like the feather's ±2°).

| Asset | Check |
|---|---|
| stone, shell | the glint moved ±6 % of the object's width and scaled to 130 % stays inside the outline |
| confetti | every piece reads at 24 px; squeezed horizontally to 10 % (a flip) it still looks like the same piece |
| plants | `leaves-back` and `leaves-front` each rotated ±6° about the base pivot (bottom centre): no gap at the roots |
| pointer | master and `press` overlaid: the fingertip lands on the same pixel |
| ladybug | each wing case rotated outward up to 60° about its front hinge, with `wings` beneath: no gap, the body stays complete |
| snail | `body` scaled to 25 % toward the shell opening: no gap; the shell alone reads as a shell |
| frog | master and `jump` overlaid: the body centre lands on the same pixel |

## Deliverables

```text
art/source/motion/<asset>/master.png          stone, shell, confetti, banana-plant, fern, monstera,
                                              pointer, ladybug, snail, frog
art/source/motion/<asset>/<part>.png          names as in the jobs file
art/source/motion/<asset>/<pose>.png          pointer/press, frog/jump
art/review/motion/registration.json           + the ten assets
art/CLAUDE_HANDOFF_MOTION.md                  updated
```

## Codex self-check

- [ ] Ten masters approved by the owner; stone, shell and plants recognisably today's designs.
- [ ] Every part and pose on its padded master canvas; stacking reproduces the master; true alpha.
- [ ] The stress tests above pass, or their limits are written down.
- [ ] Registration complete, including the pointer's fingertip and the frog's body centre.
- [ ] Jobs marked `done` with delivery records; prompts saved.

## What Claude does after delivery

- Stone and shell become rigs like the other nine treasures (approved masters as their stills).
- Painted confetti replaces the code-drawn burst: pieces that flip, spin and drift with drag.
- The three plants become rigs driven by the existing wind on the welcome screen and in the
  maze corner (their stills switch to the approved masters).
- The painted hand replaces the code-drawn one in the first-maze demo.
- Hidden critters: now and then one sits on a hedge (never on a corridor, never during drawing),
  tappable for its little reaction; checked so they never distract from the maze.
- Reduced motion keeps stills; tests, GPU budget and tablet-size review as before.
