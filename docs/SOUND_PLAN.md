# Sound, music and voices with ElevenLabs

15 October 2026, Claude Code, at the owner's request: replace the synthesised effects with
production-quality sound, add a short intro theme and give the friends real voices, using the
owner's ElevenLabs subscription and API.

## 0. Pilot (15 October 2026): made, waiting for the owner's picks

Made with `tools/audio/` from `audio/cues.json` (takes, transcripts and saved voice IDs stay in
`art/source/audio/`, not committed):

| Step | Tool | What it does |
|---|---|---|
| generate | `node tools/audio/generate.mjs [--only=id,prefix] [--dry]` | makes only missing or changed cues (request hash per folder), so a run never pays twice; designs voices and saves the picked preview (`pick`, default 1) to the account |
| check | `node tools/audio/check.mjs` | Scribe speech-to-text on every line take: word error rate, tags read aloud, laughter heard (cached transcripts) |
| review | `node tools/audio/review.mjs` | loudness-matched copies and a listening page with stars and "copy picks" (`art/source/audio/review/index.html`) |

Made: 6 effects (13 takes), the opening theme (2 takes, 7.55 s on `music_v2_5` with two chunks),
4 designed voices (Miłka PL, Tiny EN, Czupur PL, Rocky EN; 3 previews each, preview 1 saved),
12 lines in `eleven_v3` and `eleven_v4` (2 takes each) and 4 lines where the Polish voice speaks
English. **About 2,200 credits.**

Findings so far:

- **The account is Starter, not Creator:** 58,341 credits a month (reset 1 November), **10 voice
  slots, 6 used** (2 earlier + 4 pilot). Lines cost about 30 credits per take; the full voicing
  (about 240 clips × 2 takes) is about 15,000 credits, so the whole plan fits this month.
- **Voice slots decide the casting:** separate PL and EN voices for 5 characters and the narrator
  need 12 slots (only 4 are free); **one voice per character for both languages needs 6**. The
  pilot's cross-language lines test that (Scribe understood all four English lines perfectly; the
  accent is the owner's call).
- **eleven_v4 is the better Polish model:** v3 said "w Jungli" instead of "w dżungli" in both of
  Czupur's takes; v4 got it right. v4 performed the laugh tags in every take (v3 in 3 of 4 in
  Polish); no take read a tag aloud.
- Effects and music did not move the credit counter noticeably; check the account's usage page.

**Owner round 1 (15 October 2026):** `eleven_v4`; **one voice per character for both languages**
(the Polish designs: Miłka preview 1, Czupur preview 3); picks recorded as `pick` in
`audio/cues.json`. The bush pop sounded sci-fi (new prompt: real leaves, acoustic); the win must be
a short happy tune like the opening theme, so it is now music (`jingle-success`, 3 s). Round 2 adds
the rest of the effects (37 cues), the short opening, and the welcome bed (36 s). The API key lacks
`voices_write`, so replaced voices (Tiny EN, Rocky EN, Czupur preview 1) must be deleted by hand in
ElevenLabs › Voices; 7 of 10 slots are in use. About 4,600 credits used so far.

## 1. Recommendation in short

- **Everything is generated offline, never in the browser.** A local script calls the API with the
  key from `.env.local` (never committed, never shipped). The game stays a static, offline site
  that only plays finished files.
- **Effects:** about 45 sounds in one warm "cartoon jungle" palette (wood, marimba, kalimba,
  leaves, soft thumps, bubbly pops), 2–3 variants for frequent ones, plus a signature sting for
  each of the eleven treasures that matches its painted motion.
- **Music:** one short intro theme for the opening (in step with the 7.5 s animation), a calm
  loopable welcome bed, and a 2 s version for the short opening. Never during a maze.
- **Voices: full voicing**, the owner's "super awesome" option, because the players are 4–6 and
  mostly cannot read (PRD §2: the game must never require reading). Every friend line, every quest
  card (read by a narrator) and the treasure announcements, in Polish and English, with one
  original designed voice per character and language, plus short wordless reactions (giggles,
  "hurra!", gasps) for the animations.
- Start with a **pilot** (one evening of generation) so the owner hears the palette, the theme and
  two voices before the full run.

## 2. Constraints this has to respect

- PRD §7 and §4.3: gentle sound after the first tap, nothing frightening, **no error buzzer**, no
  sound that judges the route, no continuous sound while drawing; Giganto stays a warm giant.
- Sound is never required to understand anything; speech bubbles remain as subtitles.
- Parents control it: separate switches (or sliders) for **effects, music and voices**.
- Download budget (PRD §9: complete offline download ≤ 12 MB; today 9.4 MB). Voices are fetched
  **per language** (only the active language is cached), which keeps the budget.
- iOS Safari: audio starts only after a tap, plays through the existing Web Audio unlock, and the
  files use a format every target browser decodes (AAC in `.m4a`, or MP3).
- Licensing: paid ElevenLabs plans grant commercial rights to effects and music
  ([sound effects](https://elevenlabs.io/sound-effects/commercial),
  [Eleven Music terms](https://elevenlabs.io/eleven-music-model-specific-terms)); this is a private
  family game, so the plan's rights are more than enough.
- **Voices are original.** No cloning or imitation of the cartoon's Polish or English actors (it
  would need their consent and break ElevenLabs' terms). ElevenLabs does not allow child or
  child-like voices in its public Voice Library
  ([policy](https://elevenlabs.io/docs/help-center/product/voices/voice-library/can-childrens-or-child-like-voices-be-added-to-the-voice-library));
  our voices stay private, and each is designed as **an adult voice actor performing a youthful
  cartoon character**, which is how cartoons are dubbed anyway. If a design is refused, the brief
  shifts toward "bright, light adult cartoon voice".

## 3. The pipeline

```text
audio/cues.json            every sound, music piece and line: id, kind, prompt or text,
                           duration, variants, loop, target loudness
tools/audio/generate.mjs   calls the API for missing or changed cues (text hash), writes takes to
                           art/source/audio/<id>/take-N.mp3 (local, not committed)
tools/audio/review.html    listening page: every take side by side, pick the favourite
                           (the owner, and ideally the young player, choose)
tools/audio/master.mjs     ffmpeg: trim silence, short fades, loudness-normalise, mono for effects
                           and voices, encode, write public/assets/audio/... and the audio manifest
src/game/audio.ts          the new player (below)
```

- **API endpoints** (checked 15 Oct 2026):
  - Sound effects: `POST /v1/sound-generation` with `eleven_text_to_sound_v2`, 0.5–30 s,
    `prompt_influence`, and `loop: true` for seamless loops
    ([docs](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)).
  - Music: `POST /v1/music` with `music_v2_5`, `prompt` or a `composition_plan` of timed chunks,
    3 s to 10 min, `force_instrumental`
    ([docs](https://elevenlabs.io/docs/api-reference/music/compose)).
  - Voice design: `POST /v1/text-to-voice/design` (`eleven_ttv_v3`, previews), then save the
    chosen preview with `POST /v1/text-to-voice`
    ([docs](https://elevenlabs.io/docs/api-reference/text-to-voice/design)).
  - Speech: `POST /v1/text-to-speech/{voice_id}` with `eleven_v3` or `eleven_v4`; both speak
    Polish ([models](https://elevenlabs.io/docs/models)). v3 understands performance tags such as
    `[laughs]`, `[whispers]`, `[excited]`
    ([prompting](https://elevenlabs.io/docs/best-practices/prompting)); whether tags work as well in
    Polish is one of the pilot's questions.
- **Mastering targets:** effects about −16 LUFS short-term with peaks ≤ −3 dBTP, voices −19 LUFS,
  music −23 LUFS (it sits under everything). Effects and voices mono; music stereo.
- **Formats and sizes:** AAC `.m4a` at 64 kbps mono (effects, voices) and 96 kbps stereo (music).
  Estimated: effects 0.4 MB, music 0.7 MB (always cached), voices about 1.4 MB per language
  (cached for the chosen language only). New offline total ≈ 11.9 MB. Needs `ffmpeg`
  (`brew install ffmpeg`).
- **The player** (`src/game/audio.ts`): decodes files into Web Audio buffers on first need (the
  current synthesised sounds stay as a fallback until a file is ready); three buses (effects,
  music, voices) with the parents' switches; random round-robin over variants and ±3 % pitch so
  repeated taps never sound mechanical; music ducks under speech; one voice at a time (a new line
  stops the previous one); everything suspends when the page is hidden, as today.

## 4. Effects: every event in the game

Prompts are drafts for the pilot; all share the palette "playful prehistoric cartoon jungle:
wooden mallets, marimba, kalimba, soft leafy rustles, bubbly pops, warm and round, no harsh highs,
not scary". Today's synthesised name is in brackets.

| Group | Event | Sound | Variants |
|---|---|---|---|
| UI | button tap (`tap`) | soft wooden "tok" of a hollow log | 3 |
| UI | open collection / settings (`pop`) | leafy page rustle with a small wooden click | 2 |
| UI | close an overlay | the same, reversed and shorter | 1 |
| UI | toggle a setting | two-note wooden tick | 1 |
| UI | "Graj" / "Szukajmy!" | bright kalimba up-arpeggio, 0.6 s | 1 |
| Maze | maze reveal (`whoosh`) | leaves parting with an airy whoosh | 2 |
| Maze | first touch at the entrance | tiny sand "pff" | 2 |
| Maze | "Wróć" clears the path | soft leaf-broom sweep, upward | 2 |
| Maze | the drawing reaches the clearing | short rising marimba glissando (just before the fanfare) | 1 |
| Hint | butterfly arrives (`flutter`) | papery wing flutter with a tiny chime | 2 |
| Hint | pollen dots drop | three soft glittery plinks | 1 |
| Reward | solved (`success`) | 1.5 s fanfare: marimba, kalimba, a little slide whistle, a giggly "boing" | 2 |
| Reward | treasure flies (`pickup`) | swoosh that ends in a sparkle | 1 |
| Reward | the chest opens and snaps shut | small wooden creak, then a bouncy lid clap | 1 |
| Reward | new treasure badge (`sparkle`) | glittery twinkle | 1 |
| Treasures | one signature sting each, on find and when tapped in the collection: coconut hollow "donk" and roll; nut cork pop; flower soft bloom whoosh with a chime; stone glassy "ting"; shell small ocean swirl; berries jelly wobble "boing"; feather airy swish; strawberry juicy squish-boing; amber warm humming glow; giga flower magical harp bloom; crystal crystalline chime cascade | 11 |
| Friends | tap a friend / speech bubble (`wave`) | soft leafy pop (the voice line follows) | 2 |
| Friends | Czupur's crest (`toot`) | cheerful parasaurolophus horn "tuu-tuu" | 2 |
| Friends | a friend hops | small springy "boing" | 2 |
| Friends | the sleepy friend | gentle snore loop (very quiet), a yawn when it wakes | 2 |
| Opening | curtains part | big leafy rustle | 1 |
| Opening | Giganto's footsteps (`bum`) | deep friendly ground thump with a little rumble, no roar | 3 |
| Opening | friends pop out of bushes (`pop`) | bush rustle into a bubbly pop | 3 |
| Opening | the title sign drops on its vines | wooden clunk and a creak of vines | 1 |
| Opening | "Graj" sprouts | quick green growth "fwip" with a pluck | 1 |
| World | distant Giganto (`bumFar`) | muffled far thump and birds taking off | 2 |
| World | butterflies / falling leaves / twinkles | silent (they stay quiet details) | – |
| World | welcome ambience | very quiet jungle bed: birds, insects, light breeze; loopable, welcome screen only | 1 |

No sounds for walls, wrong branches or dead ends (PRD). Nothing plays continuously while drawing.

## 5. Music

- **Opening theme**, about 8 s for the full opening (`music_v2_5`, a composition plan whose chunks
  follow the animation: leafy curtains, two quiet beats left for Giganto's footsteps, a playful
  burst when the friends pop up, a little flourish as the sign lands and "Graj" sprouts).
  Instruments: marimba, kalimba, pizzicato strings, wooden percussion, a soft tuba "dino" bass,
  ukulele. Instrumental, cheerful, curious, never epic or scary.
- **Welcome bed**, 30–40 s, the same theme calmer and sparser, made to loop (crossfaded in
  mastering), quiet under the friends' voices; it fades out when "Graj" is pressed.
- **Short opening**, a 2 s sting from the same theme.
- Optional later: a 3 s "all eight classic treasures found" jingle.

## 6. The friends' voices

**Recommendation: full voicing, plus short wordless reactions.** Lines per language (from
`src/data/content.ts`):

| Speaker | Lines | Count |
|---|---|---|
| each friend and Giganto | hello, 3 little things, 2 cheers | 30 |
| each friend and Giganto | the quest's first speech bubble (`ask`) | 19 |
| narrator | the quest cards and the first quest | 20 |
| narrator | "Nowy skarb: …", "Skarb Giganto: …", "Znowu …" | 22 |
| narrator | a few system moments: the first-maze instruction, the butterfly hint | about 5 |
| each friend | wordless reactions: celebration ("hurra!", laugh), encouragement after "Wróć" (warm "hmm, again?"), a gasp, a giggle | about 25 |

That is about 120 clips per language, 240 in total, each 1–4 s.

- **Casting:** one designed voice per character and language, so Polish sounds native and English
  sounds native, with the same personality in both. Briefs for Voice Design (adult performers of
  youthful cartoon characters):
  - **Dudek / Bill:** soft, warm, a little breathy and hesitant, slower pace, gentle giggle when
    food is mentioned.
  - **Miłka / Tiny:** bright, bubbly, quick, cheeky; lands a joke with a tiny pause and a giggle.
  - **Rudzia / Mazu:** clear, articulate, curious, confident "little scientist", precise diction.
  - **Czupur / Rocky:** energetic, bold, fast, a bit raspy, loud happy shouts.
  - **Giganto:** very deep, slow, soft and kind; his growls ("Grrr…", "GRRRAU!") are designed
    effects layered under a few gentle spoken words.
  - **Narrator:** warm storyteller, calm and smiling, like the narrator of a children's cartoon.
- **Performance:** v3 or v4 with performance tags where they work, three takes per line, the best
  chosen on the review page. Names and invented words get a pronunciation entry where needed
  ("Gigantopedia", "kokofon", "Chrapozaur").
- **In the game:**
  - the quest card is read aloud by the narrator after the friend appears, with a small replay
    button for non-readers;
  - tapping a friend plays its line while the bubble shows; the bubble lasts exactly as long as
    the clip;
  - the mouth animation follows the clip's real loudness (a small envelope stored with each clip
    picks open and closed mouth frames), so lips move with the words;
  - reactions play with the matching animation (celebration, encouragement after "Wróć");
  - the treasure banner is announced; voices never overlap, music ducks under them, and the
    parents' "Głosy" switch turns all of it off.
- **Tests:** every line has a clip in both languages, every clip fits its bubble time, the
  manifest matches the text (a changed line is flagged for regeneration).

## 7. Worth adding (not in the request)

- The **narrator reading the quest card** is the single biggest gain for a 4–6-year-old.
- Separate parents' switches for effects, music and voices, and music ducking.
- **Variation:** several takes of frequent sounds and slight pitch changes, so nothing grates on
  the twentieth maze.
- **Treasure stings** that match each painted motion (Section 4).
- **One sound family:** all prompts share the palette sentence, and the review page plays them
  in sequence to check that they belong together.
- The young player as a co-reviewer: picking favourite takes is fun and the best test.
- **Data safety:** the API key lives only in `.env.local` (now in `.gitignore`); generated takes
  stay local, only the final mastered files ship.

## 8. Cost estimate (ElevenLabs credits)

Rough, from current public rates
([v3 credits](https://help.elevenlabs.io/hc/en-us/articles/35869113958801-How-much-does-it-cost-to-generate-using-Eleven-v3),
[2026 overview](https://nesyona.com/articles/elevenlabs-credits-explained-2026)); check the
account's usage page during the pilot.

| Item | Amount | Credits |
|---|---|---|
| Voices | ~240 clips × ~45 characters × 3 takes | ≈ 32 000 |
| Voice design | 12 voices, a few preview rounds each | small |
| Effects | ~60 cues × 3 takes, about 200 credits per generation | ≈ 36 000 |
| Music | ~1.5 min × 3 takes, about 900 credits per minute | ≈ 4 000 |
| **Total** | | **≈ 70 000–80 000** |

This fits a Creator-level monthly allowance; the pilot uses a few thousand.

## 9. Phases

1. **Pilot:**
   - Owner: put the key in `.env.local` and run `brew install ffmpeg`.
   - Claude: build the generator and the review page, then make 6 effects, the opening theme
     (2 takes), and Miłka's and Czupur's voices in Polish and English with 3 lines each, on v3
     and v4.
   - The owner picks the palette, the model and the voice direction.
2. **Effects and music:** the full set, the new player with buses and the parents' switches, the
   opening and welcome music.
3. **Voices:** design and approve 12 voices, generate all lines and reactions, then add the quest
   card narration, the bubbles timed to the clips, the mouth envelope and the "Głosy" switch.
4. **QA:**
   - loudness pass on tablet speakers and headphones;
   - offline budget and iOS Safari;
   - tests for the manifest and every line.
