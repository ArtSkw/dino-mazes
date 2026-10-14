# Living motion for small 2D assets — research and proposal

14 October 2026, Claude Code, at the owner's request ("the seedling loader looks a bit stiff and
outdated… audit the small 2D assets (loaders, butterflies, treasures…) that could become
high-fidelity, fluid, living animations"). This is a proposal; nothing here is built yet.

## 1. What the two references actually offer

### samyost1/3dicon (MIT, Claude Code skill)

Read in full (README, SKILL.md, docs/limitations.md, `iconloop/*.py`, the shipped example).

- **It is not vector.** It is a raster video pipeline: GPT Image makes one still, a video model
  (Seedance 2.0 via OpenRouter, Kling as fallback) animates it with the *same still as first and
  last frame* (seamless loop), every frame is matted against a known grey, and the result is an
  **animated WebP** with real alpha.
- **Cost and access:** about $0.13 for the still and $0.48 plus about 4 minutes per animation,
  through an OpenRouter key (the still and prompt are sent to third-party model providers).
- **Weight:** the shipped stopwatch is 288 px, 122 frames at 24 fps, **857 KB** for one 5 s loop.
  The authors measured that dropping to 8–12 fps "looked broken on device". VP9 WebM with alpha is
  3× smaller but does not play with transparency on iPad Safari, and there is no transparent MP4.
- **Look:** glossy 3D plastic emoji. Next to our painted Gigantosaurus art it would read as a
  different game (the PRD rules out "photorealism or 3D toy redesign"). It *can* animate our own
  painted still (`animate --still`), which keeps the style.
- **Limits the authors list:** an animated WebP cannot honour reduced motion (ship a still beside
  it); never stack a code animation on top of a baked loop; contact shadows are lost.
- **What is worth taking regardless:** its motion rulebook (`iconloop/motion.py`):
  - ask "what does this object do when left alone?" — *native* (moves by itself), *event* (inert,
    performs its function once), *part* (one loose piece moves), *surface* (light travels across);
  - an energy budget (still / calm / lively / playful) instead of banning body motion; only aimless
    turntable spins and drifting are banned;
  - small and many beats large and one; repeated elements move **out of step**;
  - everything that goes out comes back (that is also what closes a loop);
  - animate the effect, not its cause.

**Verdict for Dino Mazes:** not for in-game assets. Six treasure loops alone would be ≈ 5 MB
(our whole offline download is ≈ 10.2 MB of a 12 MB budget), they would be soft when scaled,
frozen for reduced motion, and the style would clash unless every still is our own art. A
possible later use is one lazily loaded hero loop (for example the PWA splash), not gameplay.

### "Opus 5.5 Motion Lab: Make Claude Animate Like a Studio" (@flxrnc, 30 Sep 2026)

Read in full through a public mirror (the X page itself needs a login). It is about
**code-driven motion with numbers**, not about vector assets as such:

- motion tokens instead of adjectives: ease-out-expo `0.16, 1, 0.3, 1` for entrances,
  ease-out-back `0.34, 1.56, 0.64, 1` for a playful pop, exits 40–50 % shorter than entrances,
  durations feedback 150 / move 400 / hero 750 / exit 240 ms, stagger 40–120 ms;
- springs as a **pure function of time** with a damping ratio: 1.0 no bounce, 0.7–0.85 premium,
  **0.4–0.6 playful**, < 0.3 cartoon; position and size may bounce, opacity and colour never do;
- Disney principles written as numbers: anticipation (crouch 1.2 × 0.75), squash and stretch
  (0.85 × 1.28 at take-off, 1.25 × 0.7 on landing), overlapping action (limbs lag 4–6 frames),
  follow-through (≈ 2 Hz, damping 0.22), arcs;
- **one hero move at a time**; secondary moves at 50–70 % of its travel, 100–200 ms later;
  ambient motion under 5 % of the hero's travel on a slow sine;
- a ban list (glow orbs, decorative particles, everything fading in at once, fade-and-slide-up);
- a QA loop: every frame a pure function of `t`, seeded noise, loops driven by `phase = frame / N`,
  stills at named frames, contact sheets, onion skins and speed graphs read by the model;
- sound synthesized with Web Audio, each hit 1 frame after its picture;
- engines: plain HTML/CSS/SVG for short loops, GSAP (free, incl. MorphSVG and DrawSVG), Motion,
  Three.js; Remotion/HyperFrames are for rendered videos, not live game UI.

**Verdict:** directly applicable. It is the vocabulary our motion is missing.

## 2. Why the current motion feels stiff

| Place | What it does today | Why it reads as stiff |
|---|---|---|
| Butterfly (hint flight, ambient) | one flat image squashed on X to fake flapping (`src/game/scene.ts:932`, `:1345`) | both wings move as one sheet; no up/down stroke asymmetry; body never lifts on the beat |
| Treasures in the clearing | the whole image bobs on a sine yoyo (`scene.ts:378`) | rigid, unison, aimless — exactly the "bob" 3dicon bans |
| Treasure "signature" moves | whole-image rotate/scale chains (`scene.ts:1174`) and CSS keyframes in the collection (`src/styles.css` `m-roll` … `m-jiggle`) | no anticipation, no overlapping parts; the light rotates with the object |
| Loader | three still seedling frames swapped (`src/styles.css` `loader-stage`) | stop-motion steps; nothing grows continuously |
| Plants (cast and corner) | rigid ±2.5° rotation, each on its own sine (`scene.ts:433`, `:612`) | no wind: plants never react together or ripple across the screen |
| Celebration FX | canvas blobs for leaves/petals/stars (`src/game/assets.ts:97`, `:128`) | flat confetti, all exploding at once |
| Hand demo | a crude canvas hand (`assets.ts:147`) | off-style next to the painted art |

The common causes: single raster images moved as rigid sheets, sine yoyos everywhere, no
springs, no anticipation, multiples moving in unison.

## 3. Recommendation: painted parts, coded life (vector only for effects)

Flat vector (SVG/Lottie) treasures or butterflies would clash with the painted, dimensionally
shaded art of the friends, the jungle and the opening. The better route keeps the painted look
and gets the "living" quality from **rigging**:

1. **Painted parts.** Codex (GPT Imagegen) delivers the key assets split into parts on transparent
   backgrounds, with pivots: wings separate from the body, petals separate from the flower,
   berries separate from the stem, a highlight layer separate from the object.
2. **Coded motion.** Parts are animated in code with springs, anticipation, overlapping action and
   out-of-step phases, driven by a shared motion-token file (easings, durations, `spring(t, ζ, f)`
   as a pure function of time), used by both Phaser (canvas) and the DOM (Web Animations API).
3. **Vector where vector is right:** sparkles, glints, pollen, light rays, growing stems
   (stroke drawing), wind ripples, the speech-bubble tail. Drawn in code, crisp at any size,
   zero download.

No new heavy dependency is needed: Phaser tweens and particles, the Web Animations API and a
20-line spring function cover it. Measured alternatives (minified + gzip):

| Library | Size | Fit |
|---|---|---|
| GSAP 3.15 | 27.9 KB | fine; only worth it for SVG morph/draw in DOM pieces |
| Motion 14 | 25.5 KB | built for React; WAAPI already does what we need |
| Lottie (light) | 47.5 KB | needs After Effects-style authoring; flat vector look |
| Rive canvas-lite | 53 KB JS + ≈ 316 KB WASM | best interactive vector runtime, but needs the Rive editor (not generatable by Codex/Claude) and `'wasm-unsafe-eval'` in our CSP |

## 4. Place by place

| # | Place | Proposal | New 2D parts (Codex) | Code |
|---|---|---|---|---|
| 1 | **Loader** | A growing seedling: the stem *draws itself* upward (eased stroke), two leaves unfurl from its joints on springs (ζ 0.5) with the second lagging 120 ms, the soil mound squashes once at the start, a dew sparkle twinkles; loops by phase. Reduced motion: one still. | soil mound, 2 small leaves, 1 large leaf (painted, with pivots) | stem path + leaf springs (DOM/SVG or a small canvas) |
| 2 | **Butterfly** (hint, ambient, opening) | Real flapping: left and right wings hinge on the body with a fast down-stroke (40 %) and slow up-stroke (60 %), fore- and hind-wings 2 frames apart, the body lifts on each down-stroke, glides with wings held open between flaps, folds its wings and "breathes" when it lands on the hint button. Ambient butterflies flap out of step. | body, left/right forewing, left/right hindwing, antennae (top view + side view) | Phaser container rig |
| 3 | **Coconut** (event) | Rocks with anticipation, then rolls along a short arc while its **highlight stays put** (light does not rotate); fibres catch a glint; lands with a squash. | coconut body + separate highlight layer | rig + glint |
| 4 | **Nut** (event) | Crouch → hop with stretch → squash on landing; the leafy cap lags 4 frames and settles on a loose spring (follow-through). | nut + cupule (cap) | rig |
| 5 | **Flower** (native) | Each of 5 petals sways out of step, the stem bends with the wind, leaves follow through; on find it blooms (petals open from closed, staggered 60 ms) and puffs pollen. | 5 petals, centre, stem, 2 leaves | rig + pollen particles |
| 6 | **Stone** (surface) | Still body; a glint band sweeps across (masked), an inner sparkle twinkles; on find a 4-point star flares on the glint. | stone + highlight mask | code-drawn glint and star |
| 7 | **Shell** (part/surface) | A glint travels along the spiral; the shell wobbles and turns over with squash on find. | shell + spiral path points | rig + path-following glint |
| 8 | **Berries** (part) | Five berries jiggle **individually**, out of step, like jelly; leaves flutter; on find they bounce with overlapping lag. | 5 berries, stem, 2 leaves | rig |
| 9 | **Celebration** | One hero at a time: trail glow → treasure's own move → leap along an arc into a painted chest whose lid opens with anticipation and closes with a bounce; painted petals/leaves as confetti that flip and drift with drag; Web Audio hits 1 frame after each event. | painted chest (closed/open lid), 3–4 confetti petals/leaves | sequencing, particles |
| 10 | **Plants** (cast, corner, opening) | One global wind (noise sampled on a circle so it loops) drives every plant, delayed by its x so gusts ripple across the screen; leaf tips as separate parts lag behind. Ambient ≤ 5 %. | 2–3 tip parts per plant | wind function |
| 11 | **Hand demo** | A painted pointing finger that presses (squash) at the entrance, drags along the path with ease-in-out and lifts with a little follow-through. | painted finger + soft press shadow | rig |
| 12 | **Collection chest** (button) | The painted chest from #9 on the round button; its lid pops when a treasure arrives and the count badge springs. | same chest | DOM (WAAPI) |

Everything keeps the existing guarantees: reduced motion shows one still pose per state, motion
never signals right/wrong routes, and GPU memory stays within the 96 MiB budget (parts for all
six treasures, the butterfly and the chest fit in roughly one 2048 px atlas, ≈ 2–4 MiB in files).

## 5. Suggested order

1. **No new art (1 session):** motion tokens + `spring(t, ζ, f)`; wind system for all plants;
   asymmetric flap curve and landing for the current butterfly; per-treasure idle and find
   motions with anticipation and squash/stretch on the existing images; code-drawn glints and
   twinkling sparkles; contact-sheet and onion-skin QA scripts (our Playwright harness already
   captures frames).
2. **Codex parts (one request):** butterfly, six treasures, seedling, chest, confetti, finger, as
   parts with pivots, same style and light as the current kit. I can write the job list in the
   same format as `art/prompts/jobs-intro.json`.
3. **Rigs:** butterfly first (it appears in the opening, ambient and hint), then treasures, the
   loader, celebration and chest, each reviewed at real size with stills at named frames.

Not recommended now: replacing treasures with 3dicon loops (weight, style, reduced motion,
external paid API), or moving to Rive/Lottie (authoring tools we cannot drive from code, extra
runtime, CSP change).

## 6. Living-world details built on 14 October 2026 (code only, no new art)

The owner asked for subtle details that make the game feel like stepping into the cartoon,
without pulling attention from the maze. Built in `src/game/ambient.ts` and `src/game/scene.ts`;
all of it stays outside the board (or on the solved path) and is off with reduced motion.

| Detail | What happens |
|---|---|
| Wind | One breeze moves every plant on screen; every 9–16 s a gust ripples across from left to right and settles with a damped wobble (replaces the plants' separate sine yoyos). |
| Sun spots | Five small soft spots of sunlight drift on the sand and brighten when a gust shakes the canopy. Small sprites on purpose: two full-screen light layers measured 33 → 83 ms per frame in software GL; the spots cost almost nothing on a GPU. |
| Falling leaves | Every 14–26 s a painted leaf tumbles down, flipping as it falls (in a side rail during play). |
| Butterflies | Fly on curved paths with a fast down-stroke and slow up-stroke, lift a little on each beat, and perch on plants where they rest with slowly opening wings. |
| Daylight | The backdrop's colour follows the local time: cool morning, neutral day, golden evening, soft dusk. |
| Treasure twinkle | Every few seconds a star glints on the treasure in the clearing. |
| Sand under the tip | A few grains of sand puff up behind the drawing tip (rate-limited). |
| Paw prints | After a solve, the friend's prints trot along the drawn path on the sand beside it (bigger for Giganto). |
| Friends say hello | On the welcome screen a tapped friend introduces itself in a bubble ("Cześć! Jestem Miłka!"), then tells its little facts; its neighbours give a small hop. |
| Giganto nearby | Every 45–80 s on the welcome screen two soft distant footsteps: the plants shiver, the view trembles slightly, Giganto bounces. |
| Sleepy friend | After 50 s without any input on a maze, the host closes its eyes and little "z" letters float up; a tap or drawing wakes it with a wave. |

Further ideas that need new art or an owner decision (not built):

- hidden critters in the hedges (ladybug, snail, frog) that hide when tapped — Codex art, never on corridors;
- treasures "living" in their collection nests (the per-object motion from section 4);
- a very quiet synthesized jungle (an occasional bird call on the welcome screen only) — the PRD defers music, so this is the owner's call;
- seasonal touches (snow in December, a birthday cake on the child's birthday).
