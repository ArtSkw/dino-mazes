/**
 * Authored content: characters, treasures and quests (PRD §5).
 * Original quest scenarios inspired by the characters, not episode claims.
 */
import manifestJson from './assetManifest.json';
import type { CharacterId, Localized, Quest, TreasureId } from '../domain/types';

export interface CharacterInfo {
  id: CharacterId;
  /**
   * Display name per language. Polish uses the names from the Polish dub of
   * "Gigantozaur" (Disney Junior Polska): Dudek, Miłka, Rudzia, Czupur.
   * Data-driven so the family can rename (e.g. "Billy").
   */
  name: Localized;
  /** Accent colour used for small UI touches (speech bubble edge). */
  accent: string;
  special?: boolean;
}

export const CHARACTERS: Record<CharacterId, CharacterInfo> = {
  bill: { id: 'bill', name: { pl: 'Dudek', en: 'Bill' }, accent: '#3f8fa6' },
  tiny: { id: 'tiny', name: { pl: 'Miłka', en: 'Tiny' }, accent: '#7cae3a' },
  mazu: { id: 'mazu', name: { pl: 'Rudzia', en: 'Mazu' }, accent: '#c47a2c' },
  rocky: { id: 'rocky', name: { pl: 'Czupur', en: 'Rocky' }, accent: '#c4463a' },
  giganto: { id: 'giganto', name: { pl: 'Giganto', en: 'Giganto' }, accent: '#6f8f2e', special: true },
};

export const ORDINARY_CHARACTERS: CharacterId[] = ['bill', 'tiny', 'mazu', 'rocky'];

/** Signature success motion per treasure (PRD §4.4). */
export type TreasureMotion = 'roll' | 'hop' | 'sway' | 'glint' | 'turn' | 'jiggle';

export interface TreasureInfo {
  id: TreasureId;
  name: Localized;
  motion: TreasureMotion;
  /** Glow colour behind the treasure in the clearing and collection. */
  glow: string;
  /** Classic treasures are found with the friends; Giganto's only with him. */
  kind: 'classic' | 'giganto';
}

export const TREASURES: Record<TreasureId, TreasureInfo> = {
  coconut: { id: 'coconut', name: { pl: 'Kokos', en: 'Coconut' }, motion: 'roll', glow: '#ffd27a', kind: 'classic' },
  nut: { id: 'nut', name: { pl: 'Orzech', en: 'Nut' }, motion: 'hop', glow: '#ffc07a', kind: 'classic' },
  flower: { id: 'flower', name: { pl: 'Kwiatek', en: 'Flower' }, motion: 'sway', glow: '#ffb3a1', kind: 'classic' },
  stone: { id: 'stone', name: { pl: 'Kamyk', en: 'Stone' }, motion: 'glint', glow: '#9ff0ea', kind: 'classic' },
  shell: { id: 'shell', name: { pl: 'Muszelka', en: 'Shell' }, motion: 'turn', glow: '#ffd6b0', kind: 'classic' },
  berries: { id: 'berries', name: { pl: 'Jagody', en: 'Berries' }, motion: 'jiggle', glow: '#b9c8ff', kind: 'classic' },
  // Owner request, 14 Oct 2026: seven classic treasures and three of Giganto's own.
  feather: { id: 'feather', name: { pl: 'Piórko', en: 'Feather' }, motion: 'sway', glow: '#ffe2a8', kind: 'classic' },
  // Owner request, 14 Oct 2026: an eighth classic treasure, so the collection is 4 + 4.
  strawberry: { id: 'strawberry', name: { pl: 'Truskawka', en: 'Strawberry' }, motion: 'hop', glow: '#ffb3bd', kind: 'classic' },
  amber: { id: 'amber', name: { pl: 'Bursztyn', en: 'Amber' }, motion: 'glint', glow: '#ffbe3d', kind: 'giganto' },
  gigaflower: { id: 'gigaflower', name: { pl: 'Gigakwiat', en: 'Giga flower' }, motion: 'sway', glow: '#d9b8ff', kind: 'giganto' },
  crystal: { id: 'crystal', name: { pl: 'Kryształ', en: 'Crystal' }, motion: 'glint', glow: '#b6dcff', kind: 'giganto' },
};

/** Classic treasures, in collection order. */
export const TREASURE_ORDER: TreasureId[] = ['coconut', 'nut', 'flower', 'stone', 'shell', 'berries', 'feather', 'strawberry'];
/** Giganto's own treasures, found only on his quests. */
export const GIGANTO_TREASURE_ORDER: TreasureId[] = ['amber', 'gigaflower', 'crystal'];
export const ALL_TREASURE_IDS: TreasureId[] = [...TREASURE_ORDER, ...GIGANTO_TREASURE_ORDER];

const TREASURE_ART = (manifestJson as unknown as { treasures: Record<string, unknown> }).treasures;

/**
 * A treasure is in the game only once its painted art is in the asset
 * manifest (tools/art/extract.py). New treasures therefore switch on by
 * themselves when Codex delivers them (art/CODEX_REQUEST_TREASURES.md).
 */
export function treasureHasArt(id: TreasureId): boolean {
  return Object.prototype.hasOwnProperty.call(TREASURE_ART, id);
}

const q = (id: string, characterId: CharacterId, treasureId: TreasureId, prompt: Localized, ask: Localized, special = false): Quest => ({
  id,
  characterId,
  treasureId,
  prompt,
  ask,
  ...(special ? { special } : {}),
});

/*
 * Quest texts (owner review, 14 October 2026). Each one is a tiny scene built
 * on what the friend is like in the cartoon, and never longer than two short
 * sentences:
 *   Dudek / Bill, a brachiosaurus: timid, always hungry, the best nose around,
 *     loves coconuts, sings while he cooks.
 *   Miłka / Tiny, a triceratops: playful, paints, tells jokes, makes music,
 *     much stronger than she looks.
 *   Rudzia / Mazu, an ankylosaurus: the scientist and inventor (coconut
 *     phones), studies stars and stones, writes the Gigantopedia, never rushes.
 *   Czupur / Rocky, a parasaurolophus: brave, the fastest, impatient, wants to
 *     break records, can't say his own species, a crest that toots, Giganto's
 *     biggest fan.
 *   Giganto: huge but gentle; he roars and says only a word or two.
 * `prompt` is the quest card (narrated); `ask` is the first speech bubble of
 * the maze, in the friend's own voice.
 */
export const ORDINARY_QUESTS: Quest[] = [
  q(
    'bill-coconut',
    'bill',
    'coconut',
    { pl: 'Dudek wywęszył kokos, ale boi się iść sam. Pomożesz mu?', en: "Bill can smell a coconut, but he's scared to go alone. Will you help?" },
    { pl: 'Czuję kokos! Ale boję się iść sam. Pójdziesz ze mną?', en: "I can smell a coconut! But I'm scared to go alone. Will you come?" },
  ),
  q(
    'bill-nut',
    'bill',
    'nut',
    { pl: 'Dudkowi burczy w brzuchu. Gdzieś tu leży pyszny orzech!', en: "Bill's tummy is rumbling. There's a tasty nut in here somewhere!" },
    { pl: 'Ale mi burczy w brzuchu! Znajdziesz orzech?', en: "My tummy's rumbling! Can you find a nut?" },
  ),
  q(
    'bill-berries',
    'bill',
    'berries',
    { pl: 'Dudek gotuje obiad dla przyjaciół. Brakuje mu tylko jagód!', en: 'Bill is cooking dinner for his friends. He just needs some berries!' },
    { pl: 'Obiad prawie gotowy. Przyniesiesz jagody?', en: "Dinner's nearly ready. Can you bring the berries?" },
  ),
  q(
    'tiny-flower',
    'tiny',
    'flower',
    { pl: 'Miłka maluje obrazek. Szuka kwiatka, który będzie jej pozował!', en: 'Tiny is painting a picture. She needs a flower to pose for her!' },
    { pl: 'Kwiatku, gdzie jesteś? Chcę cię namalować!', en: 'Flower, where are you? I want to paint you!' },
  ),
  q(
    'tiny-shell',
    'tiny',
    'shell',
    { pl: 'Miłka gra na muszelkach. Pomożesz jej znaleźć nową?', en: 'Tiny makes music with shells. Can you help her find a new one?' },
    { pl: 'Zagramy na muszelce? Najpierw trzeba ją znaleźć!', en: 'Shall we play a shell song? First we need a shell!' },
  ),
  q(
    'tiny-berries',
    'tiny',
    'berries',
    { pl: 'Miłka robi piknik. A jaki piknik bez jagód?', en: "Tiny is having a picnic. And what's a picnic without berries?" },
    { pl: 'Piknik bez jagód? O nie! Pomożesz?', en: 'A picnic without berries? Oh no! Will you help?' },
  ),
  q(
    'mazu-stone',
    'mazu',
    'stone',
    { pl: 'Rudzia bada błyszczące kamyki. Ten mógł spaść z nieba!', en: 'Mazu studies shiny stones. This one might have fallen from the sky!' },
    { pl: 'Ten kamyk chyba spadł z nieba! Muszę go zbadać.', en: 'I think this stone fell from the sky! I have to study it.' },
  ),
  q(
    'mazu-coconut',
    'mazu',
    'coconut',
    { pl: 'Rudzia robi telefon z kokosa. Brakuje jej tylko kokosa!', en: 'Mazu is making a phone out of a coconut. She just needs the coconut!' },
    { pl: 'Mój kokofon jest prawie gotowy. Brakuje tylko kokosa!', en: 'My coco-phone is almost ready. It just needs a coconut!' },
  ),
  q(
    'mazu-shell',
    'mazu',
    'shell',
    { pl: 'Rudzia zbiera muszelki. Takiej jeszcze nie ma!', en: "Mazu collects shells. She doesn't have this one yet!" },
    { pl: 'Takiej muszelki jeszcze nie mam! Pomożesz?', en: "I don't have a shell like this yet! Will you help?" },
  ),
  q(
    'rocky-nut',
    'rocky',
    'nut',
    { pl: 'Czupur chce pobić rekord. Szuka największego orzecha w dżungli!', en: "Rocky wants to break a record. He's after the biggest nut in the jungle!" },
    { pl: 'Największy orzech w dżungli! Rekord będzie nasz!', en: "The biggest nut in the jungle! We'll set a record!" },
  ),
  q(
    'rocky-flower',
    'rocky',
    'flower',
    { pl: 'Czupur chce dać przyjaciołom kwiatek. Najpierw musi go znaleźć!', en: 'Rocky wants to give his friends a flower. First he has to find one!' },
    { pl: 'Szybko, szybko! Gdzie jest ten kwiatek?', en: "Quick, quick! Where's that flower?" },
  ),
  q(
    'rocky-stone',
    'rocky',
    'stone',
    { pl: 'Czupur chce dać Giganto prezent. Może błyszczący kamyk?', en: 'Rocky wants to give Giganto a present. How about a shiny stone?' },
    { pl: 'Błyszczący kamyk dla Giganto! Ale się ucieszy!', en: "A shiny stone for Giganto! He'll be so happy!" },
  ),
  // The feather (owner request, 14 Oct 2026): Miłka's paintbrush fell apart
  // in the series, and Arek the archaeopteryx is a bird who cannot fly.
  q(
    'tiny-feather',
    'tiny',
    'feather',
    { pl: 'Miłce rozpadł się pędzel. Z piórka zrobi nowy!', en: "Tiny's paintbrush fell apart. She can make a new one from a feather!" },
    { pl: 'Mój pędzel się rozpadł! Znajdziesz piórko?', en: 'My paintbrush fell apart! Can you find a feather?' },
  ),
  q(
    'rocky-feather',
    'rocky',
    'feather',
    { pl: 'Czupur chce latać jak ptak. Na początek wystarczy mu piórko!', en: 'Rocky wants to fly like a bird. A feather will do for a start!' },
    { pl: 'Z piórkiem na pewno polecę! No… może trochę.', en: "With a feather I'll fly for sure! Well… maybe a bit." },
  ),
  // The strawberry: Dudek's nose finds anything sweet; Rudzia studies why it
  // wears its seeds on the outside. With it every friend has four quests.
  q(
    'bill-strawberry',
    'bill',
    'strawberry',
    { pl: 'Dudek wywęszył coś słodkiego. Pachnie jak truskawka!', en: 'Bill can smell something sweet. It smells like a strawberry!' },
    { pl: 'Mmm, truskawka! Gdzie ona się schowała?', en: 'Mmm, a strawberry! Where is it hiding?' },
  ),
  q(
    'mazu-strawberry',
    'mazu',
    'strawberry',
    { pl: 'Rudzia chce zbadać, czemu truskawka nosi pestki na wierzchu!', en: 'Mazu wants to find out why a strawberry wears its seeds outside!' },
    { pl: 'Pestki na zewnątrz? To trzeba zbadać!', en: 'Seeds on the outside? I have to study that!' },
  ),
];

/** Giganto's quests for his own three treasures (owner request, 14 Oct 2026). */
export const SPECIAL_QUESTS: Quest[] = [
  q(
    'giganto-amber',
    'giganto',
    'amber',
    { pl: 'Giganto szuka bursztynu. W środku śpi maleńki listek!', en: 'Giganto is looking for amber. A tiny leaf sleeps inside it!' },
    { pl: 'Grrr… Bursztyn? Proszę.', en: 'Grrr… Amber? Please.' },
    true,
  ),
  q(
    'giganto-gigaflower',
    'giganto',
    'gigaflower',
    { pl: 'Gigakwiat kwitnie bardzo rzadko. Giganto chce go powąchać!', en: 'The giga flower hardly ever blooms. Giganto wants to smell it!' },
    { pl: 'Mrrr… Gigakwiat? Proszę.', en: 'Mrrr… Giga flower? Please.' },
    true,
  ),
  q(
    'giganto-crystal',
    'giganto',
    'crystal',
    { pl: 'W jaskini Giganto coś błyszczy. Może to kryształ?', en: "Something sparkles in Giganto's cave. Could it be a crystal?" },
    { pl: 'Grrr… Kryształ? Proszę.', en: 'Grrr… Crystal? Please.' },
    true,
  ),
];

/**
 * Giganto's quests from before his own treasures: used only while none of
 * them has art yet, and kept so saved sessions and history still resolve.
 */
export const LEGACY_SPECIAL_QUESTS: Quest[] = [
  q(
    'giganto-coconut',
    'giganto',
    'coconut',
    { pl: 'Giganto zgubił kokos. Taki wielki, a nie może go znaleźć!', en: "Giganto has lost his coconut. He's so big, and he still can't find it!" },
    { pl: 'Grrr… Kokos? Proszę.', en: 'Grrr… Coconut? Please.' },
    true,
  ),
  q(
    'giganto-berries',
    'giganto',
    'berries',
    { pl: 'Nawet Giganto lubi jagody. Znajdźmy mu kilka!', en: "Even Giganto loves berries. Let's find him some!" },
    { pl: 'Mrrr… Jagody? Proszę.', en: 'Mrrr… Berries? Please.' },
    true,
  ),
];

/** Giganto's ask for any treasure, with its name: he says only a word or two. */
export const GIGANTO_ASK: Localized = { pl: 'Grrr… {treasure}? Proszę.', en: 'Grrr… {treasure}? Please.' };

/** Generic special template used when Giganto's example treasures are already collected. */
export const GIGANTO_GENERIC: Quest = q(
  'giganto-treasure',
  'giganto',
  'coconut',
  { pl: 'Giganto czeka na skarb. Poszukamy?', en: 'Giganto is waiting for a treasure. Shall we look?' },
  GIGANTO_ASK,
  true,
);

/** The very first quest uses a fixed introductory maze (PRD §3, first playable). */
export const INTRO_QUEST_ID = 'bill-coconut';
export const INTRO_PROMPT: Localized = {
  pl: 'Dudek wywęszył kokos. Znajdźmy go razem!',
  en: "Bill can smell a coconut. Let's find it together!",
};

export const ALL_QUESTS: Quest[] = [...ORDINARY_QUESTS, ...SPECIAL_QUESTS, ...LEGACY_SPECIAL_QUESTS, GIGANTO_GENERIC];

export function questById(id: string): Quest | undefined {
  return ALL_QUESTS.find((x) => x.id === id);
}

/** Treasure names as the object of "you found …" (Polish accusative, English with article). */
export const TREASURE_OBJECT: Record<TreasureId, Localized> = {
  coconut: { pl: 'kokos', en: 'a coconut' },
  nut: { pl: 'orzech', en: 'a nut' },
  flower: { pl: 'kwiatek', en: 'a flower' },
  stone: { pl: 'kamyk', en: 'a stone' },
  shell: { pl: 'muszelkę', en: 'a shell' },
  berries: { pl: 'jagody', en: 'some berries' },
  feather: { pl: 'piórko', en: 'a feather' },
  strawberry: { pl: 'truskawkę', en: 'a strawberry' },
  amber: { pl: 'bursztyn', en: 'a piece of amber' },
  gigaflower: { pl: 'gigakwiat', en: 'a giga flower' },
  crystal: { pl: 'kryształ', en: 'a crystal' },
};

/** Celebration banner when a treasure is found again. */
export const TREASURE_AGAIN: Record<TreasureId, Localized> = {
  coconut: { pl: 'Znowu kokos!', en: 'Another coconut!' },
  nut: { pl: 'Znowu orzech!', en: 'Another nut!' },
  flower: { pl: 'Znowu kwiatek!', en: 'Another flower!' },
  stone: { pl: 'Znowu kamyk!', en: 'Another stone!' },
  shell: { pl: 'Znowu muszelka!', en: 'Another shell!' },
  berries: { pl: 'Znowu jagody!', en: 'More berries!' },
  feather: { pl: 'Znowu piórko!', en: 'Another feather!' },
  strawberry: { pl: 'Znowu truskawka!', en: 'Another strawberry!' },
  amber: { pl: 'Znowu bursztyn!', en: 'More amber!' },
  gigaflower: { pl: 'Znowu gigakwiat!', en: 'Another giga flower!' },
  crystal: { pl: 'Znowu kryształ!', en: 'Another crystal!' },
};

/**
 * How each friend talks in speech bubbles.
 *   hello:  the first tap on the welcome screen;
 *   lines:  little things about the friend (welcome screen and maze);
 *   cheers: warm words while the child draws, in the friend's own way.
 * The first tap of every maze is the quest's `ask`; later taps alternate lines
 * and cheers. Nothing ever says whether the route is right (PRD §4.3), and
 * Polish never uses gendered forms for the child (no "zrobiłeś/zrobiłaś").
 */
export interface Voice {
  hello: Localized;
  lines: Localized[];
  cheers: Localized[];
}

export const VOICES: Record<CharacterId, Voice> = {
  bill: {
    hello: { pl: 'Cześć, jestem Dudek! Masz coś do jedzenia?', en: "Hi, I'm Bill! Got anything to eat?" },
    lines: [
      { pl: 'Mam najlepszy nos w dżungli. Wywęszę każdy owoc!', en: "I've got the best nose in the jungle. I can sniff out any fruit!" },
      { pl: 'Boję się nawet ważek. Ale z tobą jest mi raźniej.', en: 'Even dragonflies scare me. But I feel braver with you.' },
      { pl: 'Kiedy gotuję, zawsze śpiewam. Tra la la… mniam!', en: 'I always sing when I cook. La la la… yum!' },
    ],
    cheers: [
      { pl: 'Prowadź, a ja pójdę za tobą!', en: "You lead, and I'll follow!" },
      { pl: 'Spokojnie. Ja też nigdzie się nie spieszę.', en: "No rush. I'm not in a hurry either." },
    ],
  },
  tiny: {
    hello: { pl: 'Cześć, jestem Miłka! Chcesz usłyszeć dowcip?', en: "Hi, I'm Tiny! Want to hear a joke?" },
    lines: [
      { pl: 'Jak nazywa się śpiący dinozaur? Chrapozaur!', en: 'What do you call a sleeping dinosaur? A dino-snore!' },
      { pl: 'Czemu Giganto tak tupie? Nie umie chodzić na paluszkach!', en: "Why does Giganto stomp so loudly? He can't tiptoe!" },
      { pl: 'Wyglądam na małą, a jestem najsilniejsza z nas!', en: "I may be Tiny, but I'm the strongest of us all!" },
    ],
    cheers: [
      { pl: 'Ładnie rysujesz! Jak na moich obrazkach.', en: 'Lovely drawing! Just like my paintings.' },
      { pl: 'Dowcip na drogę? Dobra, później. Teraz rysujemy!', en: 'A joke for the road? Okay, later. Now we draw!' },
    ],
  },
  mazu: {
    hello: { pl: 'Cześć, jestem Rudzia! Wiem prawie wszystko o dinozaurach.', en: "Hi, I'm Mazu! I know almost everything about dinosaurs." },
    lines: [
      { pl: 'W Gigantopedii zapisuję wszystko, co robi Giganto.', en: 'I write down everything Giganto does in my Gigantopedia.' },
      { pl: 'Dostałam imię po komecie. Ładnie, prawda?', en: "I was named after a comet. Isn't that nice?" },
      { pl: 'Mój ogon to maczuga. Ale stukam nią tylko w orzechy!', en: 'My tail is a club. But I only use it to crack nuts!' },
    ],
    cheers: [
      { pl: 'Najpierw patrzymy, potem rysujemy. Tak robią naukowcy!', en: "First we look, then we draw. That's what scientists do!" },
      { pl: 'Nie spiesz się. Ja nad wynalazkami też długo myślę.', en: 'Take your time. I think for ages about my inventions too.' },
    ],
  },
  rocky: {
    hello: { pl: 'Cześć, jestem Czupur! Najszybszy dinozaur w dżungli!', en: "Hi, I'm Rocky! The fastest dino in the jungle!" },
    lines: [
      { pl: 'Jestem parazaur… paralozaur… Jestem dinozaurem z trąbką!', en: "I'm a parasaur… a paralo… I'm a dino with a trumpet!" },
      { pl: 'Mam trąbkę na głowie. Tuuu, tuuu!', en: "I've got a trumpet on my head. Toot, toot!" },
      { pl: 'Kiedyś przybiję piątkę z Giganto. Zobaczysz!', en: "One day I'll high-five Giganto. You'll see!" },
    ],
    cheers: [
      { pl: 'Ty rysujesz, a ja trąbię. Tuuu! To dla ciebie!', en: "You draw, I toot. Toot! That one's for you!" },
      { pl: 'Ja bym już pobiegł! Ale ty rób po swojemu.', en: "I'd be off running already! But you do it your way." },
    ],
  },
  giganto: {
    hello: { pl: 'GRRRAU! …Cześć.', en: 'ROOOAR! …Hello.' },
    lines: [
      { pl: 'Tup. Tup. TUP!', en: 'Stomp. Stomp. STOMP!' },
      { pl: 'Mrrr… Lubię cię.', en: 'Mrrr… I like you.' },
      { pl: 'Ziiiew… Dużo dziś tupania.', en: 'Yaaawn… Lots of stomping today.' },
    ],
    cheers: [
      { pl: 'Mrrr… Ładnie rysujesz.', en: 'Mrrr… Nice drawing.' },
      { pl: 'GRRRAU! …Przepraszam. To z radości.', en: 'ROOOAR! …Sorry. Just happy.' },
    ],
  },
};
