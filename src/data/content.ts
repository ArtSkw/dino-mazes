/**
 * Authored content: characters, treasures and quests (PRD §5).
 * Original quest scenarios inspired by the characters, not episode claims.
 */
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
}

export const TREASURES: Record<TreasureId, TreasureInfo> = {
  coconut: { id: 'coconut', name: { pl: 'Kokos', en: 'Coconut' }, motion: 'roll', glow: '#ffd27a' },
  nut: { id: 'nut', name: { pl: 'Orzech', en: 'Nut' }, motion: 'hop', glow: '#ffc07a' },
  flower: { id: 'flower', name: { pl: 'Kwiatek', en: 'Flower' }, motion: 'sway', glow: '#ffb3a1' },
  stone: { id: 'stone', name: { pl: 'Kamyk', en: 'Stone' }, motion: 'glint', glow: '#9ff0ea' },
  shell: { id: 'shell', name: { pl: 'Muszelka', en: 'Shell' }, motion: 'turn', glow: '#ffd6b0' },
  berries: { id: 'berries', name: { pl: 'Jagody', en: 'Berries' }, motion: 'jiggle', glow: '#b9c8ff' },
};

export const TREASURE_ORDER: TreasureId[] = ['coconut', 'nut', 'flower', 'stone', 'shell', 'berries'];

const q = (id: string, characterId: CharacterId, treasureId: TreasureId, pl: string, en: string, special = false): Quest => ({
  id,
  characterId,
  treasureId,
  prompt: { pl, en },
  ...(special ? { special } : {}),
});

export const ORDINARY_QUESTS: Quest[] = [
  q('bill-coconut', 'bill', 'coconut', 'Pomóż Dudkowi znaleźć kokos.', 'Help Bill find a coconut.'),
  q('bill-nut', 'bill', 'nut', 'Znajdź orzech dla Dudka.', 'Find a nut for Bill.'),
  q('bill-berries', 'bill', 'berries', 'Pomóż Dudkowi znaleźć jagody na piknik.', 'Help Bill find berries for a picnic.'),
  q('tiny-flower', 'tiny', 'flower', 'Znajdź kwiatek dla Miłki.', 'Find a flower for Tiny.'),
  q('tiny-shell', 'tiny', 'shell', 'Pomóż Miłce znaleźć piękną muszelkę.', 'Help Tiny find a pretty shell.'),
  q('tiny-berries', 'tiny', 'berries', 'Znajdź jagody na piknik z Miłką.', 'Find berries for a picnic with Tiny.'),
  q('mazu-stone', 'mazu', 'stone', 'Pomóż Rudzi znaleźć błyszczący kamyk.', 'Help Mazu find a shiny stone.'),
  q('mazu-coconut', 'mazu', 'coconut', 'Znajdź kokos do wynalazku Rudzi.', "Find a coconut for Mazu's invention."),
  q('mazu-shell', 'mazu', 'shell', 'Znajdź muszelkę do kolekcji Rudzi.', "Find a shell for Mazu's collection."),
  q('rocky-nut', 'rocky', 'nut', 'Pomóż Czupurowi znaleźć wielki orzech.', 'Help Rocky find a big nut.'),
  q('rocky-flower', 'rocky', 'flower', 'Znajdź z Czupurem kwiatek dla przyjaciół.', 'Find a flower for friends with Rocky.'),
  q('rocky-stone', 'rocky', 'stone', 'Pomóż Czupurowi znaleźć niezwykły kamyk.', 'Help Rocky find a special stone.'),
];

export const SPECIAL_QUESTS: Quest[] = [
  q('giganto-coconut', 'giganto', 'coconut', 'Giganto szuka kokosa. Znajdźmy go razem!', "Giganto is looking for a coconut. Let's find it together!", true),
  q('giganto-berries', 'giganto', 'berries', 'Znajdźmy jagody dla Giganto!', "Let's find some berries for Giganto!", true),
];

/** Generic special template used when Giganto's example treasures are already collected. */
export const GIGANTO_GENERIC: Quest = q(
  'giganto-treasure',
  'giganto',
  'coconut',
  'Znajdźmy skarb dla Giganto!',
  "Let's find a treasure for Giganto!",
  true,
);

/** The very first quest uses a fixed introductory maze (PRD §3, first playable). */
export const INTRO_QUEST_ID = 'bill-coconut';
export const INTRO_PROMPT: Localized = {
  pl: 'Dudek szuka kokosa. Znajdźmy go razem!',
  en: "Bill is looking for a coconut. Let's find it together!",
};

export const ALL_QUESTS: Quest[] = [...ORDINARY_QUESTS, ...SPECIAL_QUESTS, GIGANTO_GENERIC];

export function questById(id: string): Quest | undefined {
  return ALL_QUESTS.find((x) => x.id === id);
}

/**
 * What the corner companion says when the child taps it (one short line in a
 * speech bubble). The first tap of every maze is the quest itself, in the
 * friend's own voice; later taps cycle through the friend's own lines and a
 * few warm, general ones. Lines never comment on whether the route is right
 * (PRD §4.3): they are about the friend, the jungle and the child's effort.
 */
export const ASK_FOR: Record<'friend' | 'giganto', Localized> = {
  friend: { pl: 'Pomożesz mi znaleźć {treasure}?', en: 'Will you help me find {treasure}?' },
  giganto: { pl: 'Pomożesz Giganto znaleźć {treasure}?', en: 'Will you help Giganto find {treasure}?' },
};

/** Treasure names as the object of "find …" (Polish accusative, English with article). */
export const TREASURE_OBJECT: Record<TreasureId, Localized> = {
  coconut: { pl: 'kokos', en: 'a coconut' },
  nut: { pl: 'orzech', en: 'a nut' },
  flower: { pl: 'kwiatek', en: 'a flower' },
  stone: { pl: 'kamyk', en: 'a stone' },
  shell: { pl: 'muszelkę', en: 'a shell' },
  berries: { pl: 'jagody', en: 'some berries' },
};

export const FRIEND_LINES: Record<CharacterId, Localized[]> = {
  bill: [
    { pl: 'Mam najdłuższą szyję w dżungli. Widzę wszystko z góry!', en: 'I have the longest neck in the jungle. I can see everything!' },
    { pl: 'Mniam! Najbardziej lubię liście z wysokich drzew.', en: 'Yum! I love leaves from the tallest trees.' },
    { pl: 'Kiedyś będę wyższy niż drzewa!', en: "One day I'll be taller than the trees!" },
  ],
  tiny: [
    { pl: 'Mam trzy rogi. Policzysz je ze mną?', en: 'I have three horns. Can you count them with me?' },
    { pl: 'Uwielbiam rysować. Ty też pięknie rysujesz!', en: 'I love drawing. You draw beautifully too!' },
    { pl: 'Moja kryza jest jak wielki kołnierz!', en: 'My frill is like a big collar!' },
  ],
  mazu: [
    { pl: 'Mój ogon jest twardy jak kamień!', en: 'My tail is as hard as a rock!' },
    { pl: 'Kocham wynalazki. Labirynt to też zagadka!', en: 'I love inventions. A maze is a puzzle too!' },
    { pl: 'Mam pancerz na plecach, trochę jak żółw!', en: 'I have armour on my back, a bit like a turtle!' },
  ],
  rocky: [
    { pl: 'Mój grzebień umie trąbić: tuuu, tuuu!', en: 'My crest can trumpet: toot, toot!' },
    { pl: 'Jestem bardzo odważny. Ty też!', en: "I'm very brave. So are you!" },
    { pl: 'Najlepsze przygody są z przyjaciółmi!', en: 'The best adventures are with friends!' },
  ],
  giganto: [
    { pl: 'Bum, bum! Tak Giganto mówi „cześć”!', en: 'Boom, boom! That is how Giganto says hello!' },
    { pl: 'Giganto jest ogromny, ale dziś jest bardzo miły.', en: 'Giganto is huge, but today he is very friendly.' },
    { pl: 'Grrr… to po gigantozaurowemu „dziękuję”!', en: "Grrr… that's Giganto for “thank you”!" },
  ],
};

/** What a friend says when tapped on the welcome screen the first time. */
export const HELLO: Localized = { pl: 'Cześć! Jestem {name}!', en: "Hi! I'm {name}!" };

export const KIND_LINES: Localized[] = [
  { pl: 'Świetnie ci idzie!', en: "You're doing great!" },
  { pl: 'Spokojnie, krok po kroku.', en: 'Nice and easy, step by step.' },
  { pl: 'Cieszę się, że jesteś ze mną!', en: "I'm so glad you're here with me!" },
];
