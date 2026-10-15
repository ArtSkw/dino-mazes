# Codex art request: a high-fidelity entry (the leaf curtains)

16 October 2026, Claude Code. The owner finds the start screen's leaf curtains low-res on a
desktop. They are one 1024 × 1536 image per side (683 px wide after cropping), and on a large
Retina screen each covers about 68 % of the window, so it is stretched about 3×. Imagegen cannot
paint one much larger image, so each curtain becomes **layers**: every layer covers less of the
screen (two to three times the pixel density on the leaves you look at), and the layers can move
apart (parallax), which makes the entry deeper and richer.

Execute with the built-in **GPT Imagegen** skill. Jobs: [prompts/jobs-entry.json](prompts/jobs-entry.json),
**10 jobs with `status: "todo"`**.

## What to make

| Asset | Canvas | What it is | Where it goes |
|---|---|---|---|
| `curtain-left-back`, `curtain-right-back` | 1024 × 1536, alpha | deep, far foliage, cooler and softer; an irregular inner edge | the farthest layer; sways least, parts last |
| `curtain-left-mid`, `curtain-right-mid` | 1024 × 1536, alpha | medium leaves in two or three depths, sunlit tops | the middle layer |
| `curtain-left-front-top`, `curtain-right-front-top` | 1024 × 1536, alpha | two or three huge hero leaves hanging in from the top | front layer, upper half of the screen |
| `curtain-left-front-bottom`, `curtain-right-front-bottom` | 1024 × 1536, alpha | two or three huge hero leaves growing up from the bottom | front layer, lower half of the screen |
| `backing` | 1536 × 1024, opaque | a soft, glowing rainforest clearing seen between the curtains | behind everything (today a flat green gradient) |
| `leaves` | 1536 × 1024, alpha, 3 × 2 cells | six single small leaves | the start button bursts into them; they drift down as the curtains open |

The look must stay **recognisably today's curtains** (`source/intro-leaf-curtain-left.png`,
`source/intro-leaf-curtain-right.png`): the same palette, leaf species and light, with more detail.
Left and right are different paintings (not mirrors) that read as one pair.

## Rules for the layers

1. Each side's layers stack **back → mid → front-top / front-bottom** and, stacked at the same
   size, form one full curtain with no hole showing the backing except at the inner edge.
2. Every layer is rooted at its **outer edge** (left for the left curtain, right for the right):
   leaves enter from that edge; the edge itself may be cut by the canvas. The **inner edge** is an
   organic silhouette of leaf tips and gaps, never a straight line.
3. The two front pieces meet around the middle of the height; leave each a soft overlap zone of
   about 15 % where leaves from both can cross without a seam.
4. True transparency on every layer except the backing; no halo or matte (checked on cream and
   on dark green).
5. Nothing scary, no animals or characters, no text.

## Method and gates

1. Make the **left curtain's four layers first**, stack them, and stop for the owner's approval
   of the look (compare with today's left curtain at the same size).
2. Then the right curtain, the backing and the leaf sheet.
3. Record everything in `review/entry/registration.json`: each file's actual canvas, alpha
   bounds (alpha ≥ 40), the outer-edge contact (which canvas edges the leaves touch), and for the
   leaf sheet the six cell rectangles (half-open `[left, top, right, bottom]` in transparent gaps).
4. A review page or stacked previews: each side's layers stacked on the backing, at 1× and 2×.
5. Set `status: "done"` with delivery records in the jobs file and write
   `CLAUDE_HANDOFF_ENTRY.md` with what was made and any limits found.

## Stress tests

| Asset | Check |
|---|---|
| layers | stacked, no gap or seam; front-top and front-bottom cross cleanly in the overlap zone |
| layers | each layer moved ±24 px sideways and rotated ±1.5° about its outer edge: nothing unpainted appears at the outer edge |
| backing | reads as "glowing jungle far away" behind the stacked curtains, not as a busy picture |
| leaves | each leaf reads at 40 px; squeezed horizontally to 10 % (a flip) it still looks like a leaf |

## Deliverables

```text
art/source/entry/curtain-{left,right}-{back,mid,front-top,front-bottom}.png
art/source/entry/backing.png
art/source/entry/leaves.png
art/review/entry/registration.json
art/CLAUDE_HANDOFF_ENTRY.md
```

## What Claude does after delivery

- The extractor packs the layers into WebP at full resolution (the front pieces are the sharp
  ones), with the backing as a soft background image.
- The start screen stacks the layers with depth: each sways in its own rhythm (the front most, the
  back least), and on a desktop they shift a few pixels with the mouse (parallax). The pollen stays.
- On the tap the leaf button pops into the painted leaves (instead of today's small corner-leaf
  copies), the front layers part first and the back last, and a few leaves drift down over the
  opening.
- Tests: assets present and within the download budget; the start screen at tablet, phone and a
  large desktop window (2560 × 1440 at 2×) checked for sharpness.
