# Game intro animation: ideas and GPT Imagegen plan

Drafted by Claude Code on 13 October 2026 at the owner's request. Nothing here is built yet:
it is a proposal to choose from, plus the 2D assets Codex would generate for it. Jobs for the
recommended version are listed in [prompts/jobs-intro.json](prompts/jobs-intro.json).

## What the intro should do

- Make the first seconds feel like the start of a cartoon episode: warm, funny, alive.
- Introduce the cast with personality (Giganto big and friendly, the four friends playful).
- Teach nothing and block nothing: tap anywhere skips straight to the welcome screen.
- Stay short: about 7 s the first time each day, about 2 s on later launches, a 0.8 s cross-fade
  with reduced motion. Never blocks audio rules (sound only after the first tap).

## Four concepts

| Concept | Story beat | Why it is fun | Cost |
|---|---|---|---|
| **A. Leaf curtain and the big footsteps** (recommended) | Two giant leaves part like theatre curtains. "Bum… bum…": the ground trembles, a huge shadow crosses the clearing and Giganto peeks in from the left, sniffs, grins and pulls back. Then the four friends pop up from the bushes one by one, each with a signature move. A wooden sign drops on vines with the live title, and the "Graj" leaf sprouts from a seedling. | Suspense then relief is the classic kids' laugh; every friend gets a moment; it ends exactly on the welcome screen, so no jump cut. | Medium: 8 new illustrations, the rest is code. |
| **B. Treasure map** | A parchment map unrolls; a dotted path draws itself between six treasure stamps (the same gesture the child will make), the butterfly follows it into the clearing. | Connects the story to the mechanic: drawing a path finds treasure. | Medium: map, paper edges. |
| **C. Butterfly flight** | The camera follows the hint butterfly through three parallax planes of jungle, passing each friend who waves, and lands in the clearing. | Very cinematic and calm; introduces the helper butterfly. | Higher: three parallax layers in side view. |
| **D. Daily greeting** | Short contextual openers: morning or evening backdrop, a random friend says "Dzień dobry!" in a bubble, Giganto appears on some days. | Variety for daily play; cheap once A exists. | Low: backdrop variants only. |

**Recommendation:** build A first, with D's greeting as the short daily version. B fits well
later as the transition into a future "treasure map" progression screen.

## Concept A, shot by shot (≈ 7 s)

| Time | Shot | Animation (code) | Assets |
|---|---|---|---|
| 0.0–1.0 s | Dark green, two big leaves fill the screen | Leaves slide apart with overshoot; light shafts fade in; pollen particles drift | `intro-leaf-curtain-left`, `-right`, `intro-light-shafts` |
| 1.0–2.4 s | The empty sandy clearing (the welcome backdrop) | Two "bum" beats: camera shake 4 px, dust puffs, a soft giant shadow sweeps across | `intro-giganto-shadow` (or code), dust puff |
| 2.4–3.6 s | Giganto peeks from the left foliage | 6-frame peek: in, sniff, look, grin, blink, out | `intro-giganto-peek` (6 frames) |
| 3.6–5.4 s | Friends pop up from bushes, 0.35 s apart | Bob-in with squash and stretch, then a signature frame: Dudek stretches his neck, Miłka hops, Rudzia curls and rolls, Czupur toots his crest (a note sparkle) | `intro-friend-popup-<id>` (4 frames each) |
| 5.4–6.4 s | Title sign drops on two vines | Swing with damping; live text "Dino Labirynty" stamps in letter by letter | `intro-title-sign`, `intro-vine` |
| 6.4–7.0 s | "Graj" grows from a seedling into the leaf button | 4-frame sprout, then the real DOM button fades in at the same spot | `intro-sprout` (4 frames) |

The last frame is exactly the welcome screen, so the intro hands over without a cut.

## Assets for GPT Imagegen (Codex)

Shared style rules (same as the existing kit): polished 2D cartoon illustration matching the
Gigantosaurus TV series and our current jungle art; warm light from the upper left; crisp clean
edges; true transparent alpha where marked; **no text, letters or numbers anywhere** (all words
stay live text); no logos or watermarks. Identity references: `references/gigantosaurus-cast.png`
and the approved v3 masters once they exist (see [CODEX_REQUEST_V3.md](CODEX_REQUEST_V3.md)).

| ID | What | Size, alpha | Prompt brief |
|---|---|---|---|
| `intro-leaf-curtain-left` / `-right` | Two huge overlapping jungle leaves (monstera and banana) seen from the front, filling a tall portrait canvas, edges ragged and natural | 1024×1536, alpha | "Front view, close-up giant leaves filling the frame like a stage curtain, deep emerald with lighter veins, soft shadows between layers, inner edge organic, outer edge runs off the canvas." Mirror image for the right side is acceptable. |
| `intro-light-shafts` | Soft diagonal sunbeams with floating specks | 2048×1365, alpha (mostly transparent) | "Gentle golden god-rays from the upper left over transparent background, very soft, low opacity, no objects." |
| `intro-giganto-peek` | Giganto's head and neck leaning in from the left edge through foliage, 6 frames in a 3×2 sheet, identical scale and registration | 2048×1365 sheet, alpha | Frames: peek in (only snout visible) → half head → sniffing with nostrils flared → eyes look at the viewer → friendly closed-mouth grin → blink. Body cropped by the left edge in every frame; foliage in front of the neck at the same place in all frames. |
| `intro-friend-popup-<id>` (×4) | Each friend rising from behind a bush, 4 frames in a 2×2 sheet: only the top of the head, half up, full bust with a stretch, signature pose | 1536×1536 sheet each, alpha | Signature poses: **Dudek** neck stretched tall and proud; **Miłka** mid-hop with frill bouncing; **Rudzia** curled into a cheerful ball; **Czupur** crest raised as if trumpeting. The bush is part of the frame, identical in all four frames. |
| `intro-title-sign` | Wide honey-wood plank sign with carved border, empty middle, two rope loops on top | 2048×1024, alpha | Same wood as our wooden buttons; generous empty centre for live text; slight leaves tucked at one corner. |
| `intro-vine` | One hanging jungle vine with a few leaves, vertical | 256×1536, alpha | Used twice (scaled, flipped) to hang the sign. |
| `intro-sprout` | A seedling growing into a rounded leaf shape that matches our green leaf button, 4 frames in a row | 2048×512 sheet, alpha | Frame 4 must match `ui/leaf-button` closely (same green, same shape) so the real button can replace it. |
| `intro-dust-puff` | Soft cartoon dust cloud, 3 frames | 1024×384 sheet, alpha | Pale sand colour matching the clearing. |
| *(concept D)* `jungle-backdrop-morning`, `-evening` | The existing top-down backdrop re-lit for morning mist and golden evening | 1536×1024, opaque | Same composition as `source/jungle-backdrop-v1.png`, only lighting and colour temperature change. |
| *(concept B, later)* `intro-treasure-map` | Top-down illustrated jungle map on parchment with clearings, a river and rocks, no text | 2048×1365, opaque | Plus `intro-map-roll` (rolled paper edge, alpha) for the unroll animation. |

Generation notes for Codex: one subject per image where frames are not needed; sheets only
where frames must share registration (peek, pop-ups, sprout). Save under
`art/source/intro-*.png`, keep prompts next to the jobs file, and run the same alpha and
registration self-check as in CODEX_REQUEST_V3 §5 before handing over.

## What Claude builds after delivery

- A Phaser `IntroScene` that runs before the welcome screen, driven by one timeline
  (tweens, camera shake, particle emitters for pollen and dust, sprite-sheet frames at 10–12 fps).
- Skips: tap anywhere or a small "Pomiń" button; a full intro at most once a day, otherwise
  the 2 s greeting; reduced motion gives a cross-fade only.
- A short original Web Audio motif (two "bum" drum hits, a marimba sparkle, a toot for Czupur),
  playing only if audio is already unlocked; otherwise the intro is silent.
- Lazy loading and release of intro textures after the hand-over, so the 96 MiB GPU budget and
  first-playable time are unaffected; measured again against PRD §9.
