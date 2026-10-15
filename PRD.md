# Dino Mazes — Product Requirements Document

**Version:** 1.1 · **Date:** 12 October 2026 · **Owner:** Artur Skwarek  
**Working title:** Dino Labirynty / Dino Mazes  
**Audience:** children aged 4–6, private family use  
**Implementation:** Claude Code · **Art generation and art direction:** Codex using built-in GPT Imagegen  
**Companion:** [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)

## 1. Product vision

A warm, beautifully illustrated Gigantosaurus maze game in which a child draws a route from an entrance outside the maze to a treasure in its center. Each maze is a tiny act of helping exactly one character: Bill, Tiny, Mazu, Rocky, or occasionally Giganto. Success produces a brief amusing celebration and adds a treasure to a collection. One large button starts the next adventure.

The experience is a living 2D storybook: lush jungle framing, broad sandy paths, expressive familiar characters, soft painted light, and small ambient movements. The full maze remains visible. The emotional payoff is “I helped my friend and found something lovely.”

### Experience pillars

1. **Clear at a glance:** identify the friend, treasure, entrance, and available paths without reading.
2. **Drawing feels natural:** mouse, trackpad, pen, and touch all make one continuous, forgiving trail.
3. **Mistakes are safe:** no failure screen, countdown, lives, frightening sounds, or penalty. A visible return button clears the attempt.
4. **A recognizable cartoon world:** consistent Gigantosaurus character identities and high-quality 2D art, rather than generic dinosaur clip art.
5. **Every success has a little performance:** treasure-specific motion and a character reaction, followed by a visible collection reward.
6. **Fresh routes, familiar comfort:** procedural layouts and authored quest content; difficulty remains manageable.

## 2. Confirmed decisions and working defaults

| Topic | Requirement |
|---|---|
| Language | Polish on a fresh install, English available through a styled Polski / English switch in the parents' settings panel; remember explicit choice. Friends use their Polish dub names in Polish (Dudek, Miłka, Rudzia, Czupur, Giganto) and the original names in English. |
| Input | Draw a path with mouse, trackpad click-drag, touch, or pen. No tap-to-solve or virtual joystick. |
| Correction | “Wróć” / “Start over” clears the entire current trail and returns the endpoint to the entrance of the **same maze**. |
| View | Whole maze visible in a strict top-down orthographic view; no tilted board or foreshortening. Landscape-first tablet and small laptop support. |
| Maze structure | Exactly one simple solution from entrance to center; multiple plausible wrong branches ending in dead ends, no alternate solution or loops. |
| Quest host | Exactly one character introduced before the maze is revealed, then animated in the reserved lower-left corner; “Wróć” is always at the lower right (owner decision, 14 Oct 2026). |
| Visual medium | High-quality 2D painted assets with dimensional shading. No runtime 3D, isometric navigation, or 3D asset pipeline. |
| World | Actual Gigantosaurus characters; private family game. |
| Progression | Next maze plus treasure collection. No adventure map in v1. |
| Content production | Codex owns GPT Imagegen artwork and revisions. Claude owns implementation, asset packaging, animation, testing, and deployment setup. |
| Audio default | Gentle effects after first user interaction; sound on/off lives in the parents' settings panel (owner decision, 13 Oct 2026). Narration and music deferred, with extension points. |
| Saving | Device-local settings, collection, and resumable maze. No account or server required. |

Audio/narration scope, difficulty numbers, and content quantities below are practical v1 defaults, not additional user approvals. The final game must not require a child to read or listen to understand the objective.

## 3. Scope

### v1 release

- One polished jungle habitat, with bounded variation in foliage, flowers, and background dressing.
- Four regular friends: Bill, Tiny, Mazu, and Rocky, plus Giganto as an occasional special quest host. Quest selection rotates them; no character-selection screen required.
- Eleven collectible treasures (owner requests, 14 Oct 2026): eight classic ones found with the friends (shown 4 + 4) and three found only with Giganto; sixteen regular quests (four per friend, two per classic treasure) and three Giganto quests. A treasure joins the game once its art exists ([art/CODEX_REQUEST_TREASURES.md](art/CODEX_REQUEST_TREASURES.md)).
- Five character animation sprite sheets covering idle, drawing reaction, encouragement/reset, and celebration.
- Seeded generated mazes that grow harder automatically (four levels, starting hard), a small fixed introductory maze, and validated fallback layouts.
- Persistent drawn trail, explicit start-over, optional one-step hint, complete celebration and collection flow.
- Bilingual interface and quest content; effects audio; reduced-motion behavior.
- Responsive browser build with device-local saving, installable/offline support in the release phase.

### First playable milestone

One Bill/coconut quest, one real-art jungle scene, simple generated mazes, drawing/reset, both languages, one celebration, and one saved collection item. It must establish the shipping quality standard before content expands.

### Deferred

Music, recorded narration, other habitats, adventure atlas, multiple player profiles, cloud sync, public distribution, multiplayer, runtime AI, 3D, enemies, collectible currencies, purchases, and daily streaks.

## 4. Experience and screens

### 4.1 Welcome

A compact illustrated welcome: the title hangs on a wooden sign on two vines (live, localized text), with one prominent “Graj” / “Play” button below it, centred in the free space above the friends, plus two small round controls: the treasure collection and one settings entry. Language and sound are set only inside settings, so nothing is duplicated (owner decision, 13 Oct 2026). Returning users see “Graj dalej” / “Continue” when a saved session is valid. A fresh user begins in Polish even when the browser language is English. Browser language must not override this decision.

An opening animation plays at launch (owner request, 14 Oct 2026): the full story on the first launch of the day (leaf curtains part, Giganto's footsteps and peek, the friends pop up, the sign drops, “Graj” sprouts; about 7.5 s), a short greeting on later launches (about 2 s), a plain fade with reduced motion. Any tap or key skips it, and the game never waits on it.

The first input unlocks browser audio when permitted. If audio is unavailable, continue silently. The game is understandable without sound.

### 4.2 Quest and maze

Before revealing the maze, show only this quest's character, a treasure picture and a short invitation. Example: “Dudek wywęszył kokos. Znajdźmy go razem!” / “Bill can smell a coconut. Let's find it together!” A large “Szukajmy!” / “Let's look!” button reveals the board, with a gentle fade; do not require reading, narration or a timed wait. Returning children can tap immediately. This intro repeats briefly for each new quest.

Layout priorities: treasure and maze first, expressive friend second, controls third. Once the maze is revealed, its one host settles in the reserved lower-left corner, outside the board and controls, drawn as large as that corner allows (Giganto larger than the four friends, as in the cartoon; on the welcome screen too). The corner never changes, so “Wróć” is always at the lower right and a child learns where it is (owner decision, 14 Oct 2026). Every friend's art faces right or straight ahead, so from the left it looks at the maze; the welcome screen keeps its own arrangement. Mazes therefore never open on the left: wide and square grids open in the right half of the bottom edge, tall grids on the right side. The quest reminder is the host itself: tapping the corner friend shows a short speech bubble, first the quest in the friend's own voice, then friendly lines about the friend or the child's effort (never about whether the route is right). The friend is not shown a second time as a card. No group of dinosaurs on an active maze. Names are data-driven (Polish dub names in Polish, original names in English) in case the family prefers other names.

The maze has one external entrance and a visibly central treasure clearing. A friendly entrance marker demonstrates where drawing begins. The first puzzle may show a short looping hand trace over the first safe section, stopping permanently when input begins.

Core controls: “Wróć” / “Start over”, treasure collection, and a small settings entry. The butterfly hint appears only after the child has pressed “Wróć” three times in the same maze after drawing (the child tries alone first; the count is saved with the maze). It flies in past the host, then waits in the top-left corner as the mirror image of the top-right buttons (same size and margins). On tap it flies the next two moves of the correct route, dropping golden pollen dots that fade after a moment; from a wrong branch it flies to “Wróć” instead. A round “Ekran startowy” / “Home screen” button joins the corner controls on maze screens only (not in settings, not on the welcome screen). After solving, “Kolejna przygoda” / “Next adventure” is a wooden button centred on the screen so it stands out against the green hedges. Main controls remain visible without obscuring the maze and have at least 56 × 56 CSS-pixel hit areas.

### 4.3 Drawing contract

1. Start only inside the entrance hit area. The first accepted trail point is at the entrance outside the boundary.
2. Moving the primary pointer extends a warm golden trail along valid corridors. Preserve the child's gesture within the safe corridor; apply light smoothing rather than forcibly routing between junctions.
3. Validate the full movement segment, not just sampled endpoints. A quick swipe cannot cross a wall, jump between passages, or cut a corner.
4. A wall touch stops new ink at the last safe point. No red cross, error buzz, automatic reset, or penalty. The child can return the pointer to the endpoint and continue a safe direction.
5. Lifting the pointer preserves the drawing. Resume only near the current endpoint; pressing elsewhere must not create a disconnected trail.
6. A valid dead end remains a valid drawing. Do not reveal that a branch is wrong through automatic colors, sounds, or a hidden solver.
7. Reversing over the existing trail must not erase it. v1 does not allow drawing backward to change branches or create loops; the endpoint stops at already-traversed portions. Reset is the intended way to try a different route.
8. “Wróć” / “Start over” clears the **whole attempt**, resets endpoint and hint state, and retains seed, quest, difficulty, collection, and language. No confirmation dialog. A short fade is allowed, but the entrance becomes usable within 300 ms.
9. Pointer cancellation, loss of capture, browser backgrounding, resize, or opening UI pauses input and preserves accepted points. Never connect a newly resumed pointer across a gap.
10. Complete only when a continuous valid trail from the entrance reaches the treasure's goal region. The trail must have entered the central clearing through its valid opening. One completion event per session.

Tolerance is ergonomic, not a shortcut. It may stabilize a gesture inside its current corridor, but never snap it through a wall, across a junction, or to a nonadjacent passage. A finger that cuts the inside of a turn is led round the corner through the junction (corner assist), and hedge corners are drawn rounded, so drawing never sticks on a corner (owner tablet test, 13 Oct 2026).

The friend remains in its corner while the child draws, reacting gently. Its maximum display box starts at 140–180 CSS px wide on landscape tablets, adjusted to preserve maze space; long-necked characters must still fit the reserved margin. A small endpoint marker carries the drawing focus. During success the friend celebrates in its corner; the treasure travels to the collection. Do not add a second copy of the character moving through the maze.

Reactive animation uses four authored sprite sequences: quiet idle/blink, attentive drawing reaction, encouraging reset/retry, and happy success. Trigger drawing reactions at most once every 6 seconds, reset encouragement at most once every 4 seconds, and no looping jumping while a finger is down. React to effort and events, never whether an unexplored branch is correct. No sad/scolding expressions, speaking-mouth loops, screen shake, or large effects over the maze.

### 4.4 Success and collection

Suggested sequence: trail glows softly → treasure performs its signature motion → character changes to a delighted pose → treasure travels to its collection slot → next button appears. Target 2–3 seconds, skippable after the outcome is clear. Do not delay reward persistence until animation ends.

Examples: coconut wobbles and rolls a little; nut makes a tiny hop; flower petals sway; shiny stone catches a soft glint; shell turns slightly; berry bunch jiggles. Treasures painted in parts move their parts (14–15 Oct 2026): the coconut rocks under a still sheen, the nut hops out of its leafy cup, the flowers close and bloom petal by petal, the berries jiggle one by one, the strawberry hops while its cap swings, the feather swings on its quill, the amber's light flares, the crystals light up one after another; with reduced motion they show their still image. Butterflies flap painted wings and fold them when they perch; the collection button is a painted chest that opens for each arriving treasure. The stone's glint slides and flares, the shell turns over; painted leaves and petals burst as confetti; the framing plants sway leaf by leaf in the wind. During play, now and then a ladybug, snail or frog comes out of the jungle at the screen's left or right edge, wanders a little over the stones and leaves and disappears again (never over the board or a button, never with reduced motion). Use authored 2D transforms and approved poses. Do not attempt improvised character lip-sync or deform faces into smiles.

“Kolejna przygoda” / “Next adventure” is explicit; never advance automatically. “Moje skarby” / “My treasures” opens an illustrated collection: the eight classic treasures in two rows of four, and Giganto's three in a golden box (“Skarby Giganto”) beside them, or below them in portrait. First discoveries fill a slot with a warm arrival animation. Repeated treasures receive the same care, a soft slot pulse, and an updated internal count; there is no duplicate disappointment screen.

Collect all eight classic treasures before deliberately repeating one in the normal rotation; Giganto's quests bring his own three, unfound ones first. After that, endless new mazes continue. No rarity tiers or locked-looking shop tiles. Tapping a found treasure replays its small animation.

Opening and closing the collection while drawing restores the exact same maze and trail. Collection visits never count as new sessions or completions.

## 5. Content and replayability

Original quest scenarios for this game, built on what each friend is like in the cartoon; not assertions about specific episodes. Each quest has a card text and the friend's first speech bubble; the full texts, the friends' other lines and the research behind them are in `src/data/content.ts` and [docs/CHARACTER_VOICES.md](docs/CHARACTER_VOICES.md) (owner review, 14 October 2026).

| ID | Friend | Treasure | Polish card | English card |
|---|---|---|---|---|
| bill-coconut | Bill | Coconut | Dudek wywęszył kokos, ale boi się iść sam. Pomożesz mu? | Bill can smell a coconut, but he's scared to go alone. Will you help? |
| bill-nut | Bill | Nut | Dudkowi burczy w brzuchu. Gdzieś tu leży pyszny orzech! | Bill's tummy is rumbling. There's a tasty nut in here somewhere! |
| bill-berries | Bill | Berries | Dudek gotuje obiad dla przyjaciół. Brakuje mu tylko jagód! | Bill is cooking dinner for his friends. He just needs some berries! |
| tiny-flower | Tiny | Flower | Miłka maluje obrazek. Szuka kwiatka, który będzie jej pozował! | Tiny is painting a picture. She needs a flower to pose for her! |
| tiny-shell | Tiny | Shell | Miłka gra na muszelkach. Pomożesz jej znaleźć nową? | Tiny makes music with shells. Can you help her find a new one? |
| tiny-berries | Tiny | Berries | Miłka robi piknik. A jaki piknik bez jagód? | Tiny is having a picnic. And what's a picnic without berries? |
| mazu-stone | Mazu | Shiny stone | Rudzia bada błyszczące kamyki. Ten mógł spaść z nieba! | Mazu studies shiny stones. This one might have fallen from the sky! |
| mazu-coconut | Mazu | Coconut | Rudzia robi telefon z kokosa. Brakuje jej tylko kokosa! | Mazu is making a phone out of a coconut. She just needs the coconut! |
| mazu-shell | Mazu | Shell | Rudzia zbiera muszelki. Takiej jeszcze nie ma! | Mazu collects shells. She doesn't have this one yet! |
| rocky-nut | Rocky | Nut | Czupur chce pobić rekord. Szuka największego orzecha w dżungli! | Rocky wants to break a record. He's after the biggest nut in the jungle! |
| rocky-flower | Rocky | Flower | Czupur chce dać przyjaciołom kwiatek. Najpierw musi go znaleźć! | Rocky wants to give his friends a flower. First he has to find one! |
| rocky-stone | Rocky | Shiny stone | Czupur chce dać Giganto prezent. Może błyszczący kamyk? | Rocky wants to give Giganto a present. How about a shiny stone? |
| tiny-feather | Tiny | Feather | Miłce rozpadł się pędzel. Z piórka zrobi nowy! | Tiny's paintbrush fell apart. She can make a new one from a feather! |
| rocky-feather | Rocky | Feather | Czupur chce latać jak ptak. Na początek wystarczy mu piórko! | Rocky wants to fly like a bird. A feather will do for a start! |
| bill-strawberry | Bill | Strawberry | Dudek wywęszył coś słodkiego. Pachnie jak truskawka! | Bill can smell something sweet. It smells like a strawberry! |
| mazu-strawberry | Mazu | Strawberry | Rudzia chce zbadać, czemu truskawka nosi pestki na wierzchu! | Mazu wants to find out why a strawberry wears its seeds outside! |
| giganto-amber | Giganto | Amber | Giganto szuka bursztynu. W środku śpi maleńki listek! | Giganto is looking for amber. A tiny leaf sleeps inside it! |
| giganto-gigaflower | Giganto | Giga flower | Gigakwiat kwitnie bardzo rzadko. Giganto chce go powąchać! | The giga flower hardly ever blooms. Giganto wants to smell it! |
| giganto-crystal | Giganto | Crystal | W jaskini Giganto coś błyszczy. Może to kryształ? | Something sparkles in Giganto's cave. Could it be a crystal? |

Until Giganto's own treasures have art, his earlier quests stay in use: giganto-coconut (“Giganto zgubił kokos. Taki wielki, a nie może go znaleźć!”) and giganto-berries (“Nawet Giganto lubi jagody. Znajdźmy mu kilka!”).

Treasure names: Kokos / Coconut; Orzech / Nut; Kwiatek / Flower; Kamyk / Stone; Muszelka / Shell; Jagody / Berries; Piórko / Feather, Truskawka / Strawberry (classic); Bursztyn / Amber, Gigakwiat / Giga flower, Kryształ / Crystal (Giganto's own). Ensure berry artwork reads as a small blue berry bunch, not grapes.

Selection uses a shuffled content bag and recent-history exclusion. Do not show the same quest or normalized maze layout immediately twice. Reset retains the current maze. Next creates a new session with a new seed. Cosmetic randomness uses its own seed stream so art changes do not change routes.

### Giganto's occasional quests

Working cadence: complete five ordinary mazes to unlock the first Giganto quest, offered as maze six. Afterwards insert one Giganto quest after each group of four ordinary completions (roughly one in five). Count unique completed sessions only; resets, reloads and collection visits do not advance the counter. Persist the cadence. Keep Giganto a warm special guest, not a boss or a frightening obstacle.

Giganto quests request one level above the current automatic level, capped at the hardest supported profile and viewport corridor limits. Prefer one extra meaningful branch over shrinking the paths. Explain the special adventure with the character intro, not a warning. Provide “Łatwiejszy labirynt” / “Easier maze” in settings to restart this special quest at the current normal level without reward/progress penalty. Cadence and special-quest difficulty are explicit tunable defaults based on the user's four-to-five-maze suggestion.

Giganto's quests ask for his own three treasures, unfound ones first (owner request, 14 Oct 2026). Until their art exists, he keeps the earlier rule: select his treasure from uncollected classic items when necessary and use a generic localized special-quest template (“Giganto czeka na skarb. Poszukamy?” / “Giganto is waiting for a treasure. Shall we look?”) with the pictured target. Do not force a duplicate just because his example quests list coconut and berries.

### Automatic difficulty (owner decisions, 13 and 14 October 2026)

There is no difficulty setting. The first maze is the fixed tutorial; generated mazes start
clearly harder than the old "medium" (owner, 14 Oct: the first levels felt too easy) and step
up one level every four completed mazes (owner, 14 Oct; was three), capped at the last level. "Zacznij grę od nowa"
starts the climb again.

| Level | Mazes (after the tutorial) | Grid on a 1180 × 820 tablet | Larger screens | Meaningful branch choices (7 × 7) | Minimum route (7 × 7) |
|---|---|---|---|---|---|
| hard | 1–4 | 7 × 7 | 9 × 7 / 9 × 9 | 5–8 | 18 |
| expert | 5–8 | 7 × 7 | 9 × 7 / 9 × 9 | 6–8 | 20 |
| master | 9–12 | 7 × 7 | up to 11 × 9 | 6–9 | 22 |
| grand | 13+ | 7 × 7 | up to 11 × 9 | 7–9 | 22 |

Measured averages on 7 × 7: 5.4 → 7.2 branch choices and a 22–25-cell route (the old
starting level: 3.9 and 19). A bigger grid is used only where corridors stay ≥ 48 px **and**
the strip beside the board keeps the friend at least as large as at the old starting level
(otherwise the friend shrank by a third on tablets); there the climb comes from topology.
Non-square grids open on one axis only (wide: bottom, tall: a side), so they fit more cells.
Every profile passes 1,000 seeds with fewer than 1 % fallbacks. A centered clearing replaces
the central cell. Never shrink corridors just to keep a nominal grid size; record the actual
effective profile for QA.

## 6. Art direction and visual hierarchy

### Look

Polished 2D animation illustration with rich but controlled color, rounded foliage, warm cream sand, turquoise atmospheric depth, and expressive faces faithful to the supplied references. Depth is painted into assets. Paths are calm and light; foliage is darker; treasure and trail remain distinct from both. Avoid photographic noise, plastic 3D rendering, generic emoji, black maze lines, or busy dashboard UI.

The playfield is strictly overhead and orthographic: parallel corridors have equal width across the board, the center really is centered, and every fork is equally readable. No horizon, vanishing point or visible tall hedge faces in the playable area. Character sprites may use the cartoon's front three-quarter view independently. Foreground leaves remain outside the playable safe area. The original tilted group concept is superseded and must not guide composition.

### Asset architecture

- **Imagegen:** five character animation sheets, treasure artwork, jungle background, ground texture, modular foliage/rock decorations, collection illustration, decorative UI surfaces, and art-direction concepts.
- **Claude:** exact maze topology, corridor/wall geometry, clipping, live trail, hit targets, text, simple functional SVG icons, layout, sprite transforms, effects particles, atlas packing, and export optimization.
- A fully painted generated maze image must **never** define gameplay. Compose generated art around a validated maze graph, with code-rendered continuous wall fills so foliage cannot imply a false opening.
- No generated text embedded in images. All Polish and English labels are live text, including collection names and loading/error states.
- Preserve original high-resolution source files; ship optimized derivatives at appropriate display sizes. Do not call an upscaled or uninspected file “4K” or production-ready.

### Character consistency

Bill: blue/teal long neck, pale muzzle and underside; Tiny: green frill, cream horns and dark beak; Rocky: red/orange body, cream face and characteristic crest; Mazu: orange/brown spotted head, pale underside and recognizable rounded silhouette. Supplied cartoon references take precedence over generated concepts. Inspect anatomy, silhouettes, eye shapes, markings, hands, and tails. No character accessories invented to hide inconsistencies.

Giganto: preserve the reference's moss-green mottled head/body, heavy cream jaw, characteristic red eyes and facial ridges; friendly closed-mouth or modest smiling expressions, never a threatening roar. Use a consistent upper-body crop if his full body would make his face unreadable in the corner. All five characters must look like the cartoon, not redesigns. Generated candidates must be checked against the supplied reference; generation does not guarantee identity or frame consistency.

Each character gets a 4 × 4 sheet: four frames each for idle, attentive drawing, encouragement, and celebration. Maintain the same camera, palette, character scale and registration across every frame. Claude extracts and registers frames, implements timing and events, and reports any morphing/anatomy defects for Codex to regenerate. No directional walk cycle is needed for a stationary corner companion. A sprite sheet is accepted only after its loops have been previewed in motion.

### UI

A small coherent family of leaf/wood/cream surfaces, rounded buttons, soft shadows, and a legible rounded font with full Polish glyph coverage, verified from the font files themselves (Baloo 2; Fredoka lacked ą ć ę ń ś ź ż). The collection (treasure chest) and settings buttons are equal in size and keep the same top-right place on every screen. Nothing is stuck on top of character artwork; a tapped friend answers with its own motion and a speech bubble. Polski / English is a segmented control in settings with a clear selected state, keyboard focus, and accessible names “Polski” / “English”; flags are unnecessary. Functional icons come from one family (Phosphor, bold weight). No control, decoration or bubble may overlap another control or the board. Switching languages must not reset anything.

Large reset button combines a curved return arrow with “Wróć”; accessible name “Wyczyść ścieżkę i wróć na początek”. English visible label “Start over”. Do not label it merely “Back”, which could imply screen navigation.

## 7. Sound and motion

Quiet UI tap, soft treasure pickup, and short success flourish. No continuous sound while drawing, error buzzers, loud roars, autoplay before interaction, or ripped cartoon dialogue/music. Claude may create a small original Web Audio effects set; Imagegen generates images, not audio. Audio must pause when hidden and respect the saved mute setting.

Reserve IDs and localized optional narration paths for later. No automatic browser speech synthesis in v1. Music is deferred.

Reduced motion removes ambient sway, treasure flights, and bounce; use immediate pose/collection changes with short fades. All rewards and actions remain available. Avoid flashes, camera shake, and forced camera movement.

## 8. Device, accessibility, and persistence requirements

- Target iPad Safari, Android tablet Chrome, and MacBook Air Safari/Chrome. Verify real touch and trackpad use; emulation alone cannot prove comfort.
- Reference layouts: 1024 × 768, 1180 × 820, 1366 × 768, 1440 × 900 CSS pixels; also 768 × 1024 portrait and 1024 × 600 compact fallback.
- Entire maze and essential controls fit in landscape. Portrait reflows controls and lowers grid density when necessary; offer a gentle rotate suggestion without blocking play.
- Target usable corridor width ≥ 48 CSS px and primary controls ≥ 56 CSS px at supported layouts. Decorative margins may contract first. Ink width approximately 8–12 CSS px, with a contrasting edge; tune against actual art.
- Do not disable browser zoom globally. Use drawing-specific touch behavior only on the play surface; preserve ordinary UI behavior elsewhere.
- Accessible DOM controls, visible focus, no hover-only actions, text contrast of at least 4.5:1 for ordinary labels. Provide keyboard route extension along open graph edges as an alternate input using the same validation/reset rules; announce objective, available directions, and success without announcing every pointer sample.
- Save explicit language, mute, reduced-motion preference override, collection counts, progress counters (which set the automatic difficulty), and active session with maze-generator version. Handle disabled/corrupt storage by falling back to a playable in-memory session.
- Save completion atomically with its session ID; restoring or skipping a celebration must not award again. “Zacznij grę od nowa” / “Start the game over” lives in parent settings, is offered only while a maze adventure is open (not from the welcome screen), requires confirmation, and resets treasures, the current maze, the tutorial, Giganto's cadence and the difficulty climb while keeping the parent's settings.

## 9. Quality targets and acceptance

| Area | Acceptance |
|---|---|
| Core loop | Child can start, draw, reset a wrong attempt, solve, see a reward, and start another maze. |
| Geometry | No unsolvable shipped maze, disconnected trail, corner cut, wall crossing, or outside-boundary shortcut. |
| Input | Visible response target ≤ 50 ms on target devices; lifting/resuming and touch cancellation preserve accepted progress. |
| Recognition | All four friends and Giganto preserve cartoon identity; references outrank style concepts; frame loops do not morph faces. |
| Readability | Entrance, treasure, corridor boundaries, and endpoint remain unambiguous at actual device size. |
| Bilingual | Polish by default; complete EN parity; language switch preserves maze, trail, and collection. |
| Replay | Fresh layouts and varied quests; all six treasures achievable without rarity mechanics. |
| Performance | Target 60 fps; stable ≥ 30 fps on the agreed oldest tablet, no visible stutter during drawing. |
| Loading | Initial playable asset transfer target ≤ 5 MB compressed, complete v1 asset transfer ≤ 12 MB, first playable ≤ 4 s on a documented 10 Mbps test profile. |
| GPU memory | Target ≤ 96 MiB decoded resident texture memory; atlas edge ≤ 2048 for normal runtime assets. |
| Reliability | Twenty maze completions and ten collection round-trips without duplicate rewards, stuck input, or growing live resource counts. |
| Offline | After a completed initial cache, relaunch and play with network disabled; updates do not strand a saved session. |

Budgets are initial engineering targets, not measurements of unbuilt software. Record actual device/browser and measured results. If quality and a budget conflict, optimize assets and reduce nonessential effects before sacrificing path clarity.

## 10. Definition of done

The game opens in Polish, immediately communicates a simple quest, lets a child draw comfortably through a beautiful readable jungle, makes starting over effortless, celebrates finding the treasure, saves it exactly once, and offers another fresh maze. Both languages, all four friends plus Giganto, all six treasures, real-device input, storage recovery, and offline behavior pass the development plan's acceptance matrix. The final integrated screenshots and animations are visually reviewed; source images alone do not prove a polished game.

## 11. Reference and precedence notes

The user's supplied Gigantosaurus images are identity and mood references. The supplied Castle Atlas documents inform document structure only; their stack, agents' instructions, approval gates, past implementation status, and domain constraints do not apply here.

User decisions in this project supersede defaults in these documents. This PRD defines product behavior; DEVELOPMENT_PLAN.md defines implementation and art delivery. Record future scope changes explicitly in both relevant sections.

Background references: [Gigantosaurus series](https://en.wikipedia.org/wiki/Gigantosaurus_(TV_series)), [official character introduction](https://en.bandainamcoent.eu/gigantosaurus/news/hit-dino-show-gigantosaurus-heads-consoles-and-pc-the-first-time-roarsome-new).
