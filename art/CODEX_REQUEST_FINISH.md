# Codex art request: finish the outstanding art

> Status, 15 October 2026: **delivered and in the game** (art/CLAUDE_HANDOFF_MOTION.md,
> art/CLAUDE_HANDOFF_TREASURES.md). Priority 2 and 3 of the motion plan remain for later.

14 October 2026, Claude Code, after the owner asked for an eighth classic treasure (so the
collection reads 4 + 4), Giganto's badge and the parts of the six approved motion masters.
Execute with the built-in **GPT Imagegen** skill. Every job carries a `status`; do only the
`todo` ones:

- [prompts/jobs-treasures.json](prompts/jobs-treasures.json): strawberry (4 jobs) and the badge (1 job).
- [prompts/jobs-motion.json](prompts/jobs-motion.json): the parts and extra poses of the six approved
  masters (30 priority-1 jobs). Priority 2 and 3 there are **not** part of this round.

The game is ready for all of it: the strawberry, its quests and the 4 + 4 collection switch on as
soon as its approved image exists; the badge replaces the drawn footprint by itself.

## Work order and gates

1. **Strawberry master**, then stop for the owner's approval.
2. **Giganto's badge** (can be made while waiting).
3. After approval: copy the strawberry master unchanged to `source/treasures-v2/strawberry.png`, then
   make its three parts.
4. **Parts of the six approved masters** (butterfly, coconut, nut, flower, berries, chest).
5. Handoff notes.

## 1. Strawberry (classic treasure 8)

| Id | Polish / English | Design | Why it fits |
|---|---|---|---|
| strawberry | Truskawka / Strawberry | Ripe glossy red berry, plump and gently heart-shaped, tiny golden seeds, green five-leaf cap with a short curled stem, soft highlight upper left | Dudek's nose finds anything sweet; Rudzia studies why it wears its seeds outside |

It is the only red classic treasure, and its silhouette (a heart with a leafy crown) must differ
from every other one at 80 px; unfound treasures show as a flat silhouette. Same method as the
other new treasures ([CODEX_REQUEST_TREASURES.md](CODEX_REQUEST_TREASURES.md)): master on a
transparent canvas at about 70 % (pad, never crop), owner approval, the approved copy in
`source/treasures-v2/`, then parts as edits of the master: **body** (no highlight, no cap, top
continued under the cap), **cap** (leaves and stem, bases continued onto the berry), **glint**
(only the highlight). Add the strawberry to `review/treasures/registration.json` in the same format
as the four delivered treasures (back-to-front order, master-pixel pivots, opacity): cap pivot at
the stem foot, body pivot at the bottom centre of the berry.

Motion it will get: crouch, hop with a stretch, land with a squash; the cap lags and flutters
(about ±6°); the glint stays still.

## 2. Giganto's badge

`source/ui/giganto-emblem.png`: a round painted badge, Giganto's three-toed footprint pressed into
golden sand inside a honey-wood ring with soft gold trim. It is shown at **30 to 40 px** next to
the "Skarby Giganto" title, so keep it bold and simple; no text, true alpha.

## 3. Parts of the six approved masters

Masters approved by the owner: `source/motion/{butterfly,coconut,nut,flower,berries,chest}/master.png`.

- **Framing first.** The masters fill about 90 % of their canvas. Pad each canvas so the subject
  is about 70 % (never crop, never retouch the approved pixels), record the transform, and use the
  padded master as the edit source for every part of that asset.
- **Parts** as in the jobs file, each an edit of the padded master that keeps canvas, scale and
  position and paints hidden overlaps. Extra poses (perched butterfly, open chest) are separate
  images on the same canvas.
- **Registration:** `review/motion/registration.json` in exactly the format of
  `review/treasures/registration.json` (draw order back to front, pivots in master pixels,
  opacity, baked transforms). Pivots: wing roots at the body, petal bases at the centre, berry
  stems, the nut's seat in its cup, the coconut's centre, the chest lid's hinge.
- **Stress tests that match the planned motion** (check on cream and dark green):

| Asset | Planned motion | Check |
|---|---|---|
| butterfly | wings flap seen from above: each wing narrows toward its root | each wing scaled horizontally to 20 % about its root: no gap at the body |
| coconut | rocks and rolls while the highlight stays put; the tuft lags | body rotated ±20° under a still highlight looks right; tuft ±10° |
| nut | hops and squashes; the cup lags behind | nut moved 6 % up out of the cup: no hole in the cup |
| flower | petals sway out of step; blooms on find | each petal ±5°, and all scaled to 30 % toward the centre |
| berries | each berry jiggles on its own | each berry scaled 85 to 115 %: neighbours stay covered |
| chest | lid pops a little on a spring; the open pose for the reward | lid rotated −15° about the hinge: no gap |

Lessons from the treasure delivery that apply here: Imagegen returns its own canvas and scale, so
register parts to the master with a measured affine transform; prefer a slightly broader painted
underlap to a gap; state any motion limit you find (like the feather's ±2°) in the handoff.

## Deliverables

```text
art/source/motion/strawberry/{master,body,cap,glint}.png
art/source/treasures-v2/strawberry.png            approved master, copied unchanged
art/review/treasures/registration.json            + strawberry
art/source/ui/giganto-emblem.png
art/source/motion/<asset>/<part>.png              six assets, names as in jobs-motion.json
art/review/motion/registration.json               the six assets
art/CLAUDE_HANDOFF_TREASURES.md                   updated: strawberry
art/CLAUDE_HANDOFF_MOTION.md                      updated: parts of the six, limits found
```

## Codex self-check

- [ ] Strawberry master approved by the owner; its silhouette differs from the ten others.
- [ ] Approved copy byte-identical in `source/treasures-v2/`.
- [ ] Badge readable at 40 px, no text.
- [ ] Every part on its padded master canvas; stacking reproduces the master; true alpha.
- [ ] The stress tests above pass, or their limits are written down.
- [ ] `status` set to `done` in both jobs files for what was delivered; prompts saved.

## What Claude does after delivery

- Run the art export: the strawberry enters the game (quests, maze, collection 4 + 4) with a rig;
  the badge appears in the collection.
- Rig the six: switch their still images to the approved masters at the same time (the nut gains
  its leafy cup, the berries become five), so the maze, the collection and the celebration agree;
  give the butterfly real flapping wings and the perched pose; the chest on the collection button
  pops its lid when a treasure arrives.
- Check everything at tablet size, extend the motion tests to the new rigs and keep the GPU budget.
