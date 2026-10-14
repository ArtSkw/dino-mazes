# Character voices and writing rules

14 October 2026, after the owner asked for texts that fit the friends instead of generic lines.
The texts live in `src/data/content.ts` (quests, speech bubbles) and `src/data/i18n.ts` (UI).

## Who the friends are

Polish names come from the Polish dub of "Gigantozaur" (Disney Junior). The traits below are the
ones the series establishes; the lines in the game are original, written for this game.

| Friend | Species | What the lines build on |
|---|---|---|
| Dudek / Bill | brachiosaurus | Timid, scared even of dragonflies, but brave for his friends. Always hungry, keeps secret food stashes, has the best nose around, loves coconuts, sings while he cooks. |
| Miłka / Tiny | triceratops | Playful, can't stay serious, tells jokes, paints, sings and makes music, far stronger than she looks. Two horns in our art, so lines never count horns. |
| Rudzia / Mazu | ankylosaurus | The scientist and inventor (phones made of coconuts), studies stars, comets and a meteorite, keeps the Gigantopedia about Giganto, gentle with insects, hates rushing. Named after a comet. Tail club. |
| Czupur / Rocky | parasaurolophus | Brave, the fastest, impatient, wants to break records, can't pronounce his own species, his crest toots like a horn, Giganto's biggest fan. |
| Giganto | giganotosaurus | Huge, looks fierce but watches over the little ones. Roars and growls; speaks rarely, a word or two ("Thank you", "You're welcome"). Kept warm and funny, never scary. |

Sources:
[Gigantosaurus (TV series), Wikipedia](https://en.wikipedia.org/wiki/Gigantosaurus_(TV_series)),
[Gigantozaur (serial animowany), Wikipedia](https://pl.wikipedia.org/wiki/Gigantozaur_(serial_animowany)),
character and episode pages of the [Gigantosaurus fan wiki](https://gigantosaurus.fandom.com/)
(user-edited; used only for traits that match the episode synopses).

## Treasures and their stories

Seven classic treasures are found with the friends, three only with Giganto (owner request,
14 October 2026). The new ones tie into the series: Miłka's favourite paintbrush once fell apart
(so she makes one from a feather), Arek / Archie is a bird who cannot fly (Czupur wants to try with
a feather), and the rare Giga Flower blooms in the series; amber with a leaf inside and a crystal
from his cave make Giganto's set feel old and precious.

## Rules for every text

- One or two short sentences. Speech bubbles at most 72 characters, quest cards at most 80
  (unit test). The longest Polish card still fits a 667 × 375 phone in four lines.
- The quest card narrates a tiny scene; the first bubble in the maze is the same quest in the
  friend's own voice.
- Nothing judges the route: no "dobrze/źle", "right/wrong" (PRD §4.3, unit test). Cheers are about
  effort, patience and drawing.
- Polish never uses gendered forms for the child ("zrobiłeś/zrobiłaś", "odważny/odważna"); present
  tense and imperatives only (unit test for past forms).
- Lines must match the art (Miłka has two horns).
- Polish and English are written separately, not translated word for word: Miłka's jokes are
  different jokes in each language ("Chrapozaur!", "A dino-snore!").
- Polish edited with the [miodkuj](https://github.com/bartekpucek/miodkuj) rules: plain spoken
  Polish, verbs instead of nouns, no officialese ("Gość specjalny", "na zwykłym poziomie",
  "Spróbuj jeszcze raz"), no em dashes, read aloud before keeping.
