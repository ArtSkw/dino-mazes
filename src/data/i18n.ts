/**
 * Live UI strings in Polish and English. Polish is always the fresh-install
 * default; the browser language never overrides it (PRD §4.1).
 */
import type { Lang } from '../domain/types';

export const STRINGS = {
  appTitle: { pl: 'Dino Labirynty', en: 'Dino Mazes' },
  tagline: { pl: 'Pomóż przyjaciołom znaleźć skarby!', en: 'Help your friends find treasures!' },
  play: { pl: 'Graj', en: 'Play' },
  continue: { pl: 'Graj dalej', en: 'Continue' },
  letsLook: { pl: 'Szukajmy!', en: "Let's look!" },
  startOver: { pl: 'Wróć', en: 'Start over' },
  startOverA11y: { pl: 'Wyczyść ścieżkę i wróć na początek', en: 'Clear the path and go back to the start' },
  next: { pl: 'Kolejna przygoda', en: 'Next adventure' },
  myTreasures: { pl: 'Moje skarby', en: 'My treasures' },
  hint: { pl: 'Podpowiedź motylka', en: 'Butterfly hint' },
  hintReady: { pl: 'Przyleciał motylek. Możesz go poprosić o podpowiedź.', en: 'A butterfly is here. You can ask it for a hint.' },
  sound: { pl: 'Dźwięk', en: 'Sound' },
  soundOn: { pl: 'Dźwięk włączony', en: 'Sound on' },
  soundOff: { pl: 'Dźwięk wyłączony', en: 'Sound off' },
  on: { pl: 'Włączony', en: 'On' },
  off: { pl: 'Wyłączony', en: 'Off' },
  settings: { pl: 'Ustawienia', en: 'Settings' },
  forParents: { pl: 'Dla rodziców', en: 'For parents' },
  language: { pl: 'Język', en: 'Language' },
  polish: { pl: 'Polski', en: 'Polski' },
  english: { pl: 'English', en: 'English' },
  motion: { pl: 'Animacje', en: 'Motion' },
  motionSystem: { pl: 'Jak w systemie', en: 'Match system' },
  motionReduced: { pl: 'Mniej ruchu', en: 'Reduced motion' },
  easierMaze: { pl: 'Łatwiejszy labirynt', en: 'Easier maze' },
  easierMazeNote: {
    pl: 'Zacznij przygodę z Giganto od nowa, na zwykłym poziomie.',
    en: "Start Giganto's adventure again at the usual level.",
  },
  restartGame: { pl: 'Zacznij grę od nowa', en: 'Start the game over' },
  restartGameConfirm: {
    pl: 'Zacząć grę od nowa? Znikną wszystkie skarby i postępy, a labirynty znów będą łatwiejsze. Tego nie da się cofnąć.',
    en: 'Start the game over? All treasures and progress will be cleared, and the mazes will get easier again. This cannot be undone.',
  },
  yesRestart: { pl: 'Tak, od nowa', en: 'Yes, start over' },
  cancel: { pl: 'Anuluj', en: 'Cancel' },
  close: { pl: 'Zamknij', en: 'Close' },
  back: { pl: 'Powrót', en: 'Back' },
  home: { pl: 'Ekran startowy', en: 'Home screen' },
  talkTo: { pl: '{name}. Dotknij, żeby porozmawiać.', en: '{name}. Tap to talk.' },
  notFoundYet: { pl: 'Jeszcze przed nami', en: 'Still to find' },
  foundTimes: { pl: 'W kolekcji: {n}', en: 'In your collection: {n}' },
  newTreasure: { pl: 'Nowy skarb: {name}!', en: 'New treasure: {name}!' },
  newGigantoTreasure: { pl: 'Skarb Giganto: {name}!', en: "Giganto's treasure: {name}!" },
  gigantoTreasures: { pl: 'Skarby Giganto', en: "Giganto's treasures" },
  withGiganto: { pl: 'Do znalezienia z Giganto', en: 'To find with Giganto' },
  wellDone: { pl: 'Brawo!', en: 'Well done!' },
  loading: { pl: 'Ładowanie…', en: 'Loading…' },
  loadError: {
    pl: 'Nie udało się wczytać części gry. Twoje skarby są bezpieczne.',
    en: "Part of the game didn't load. Your treasures are safe.",
  },
  retry: { pl: 'Spróbuj jeszcze raz', en: 'Try again' },
  rotate: { pl: 'Obróć urządzenie poziomo, będzie więcej miejsca.', en: 'Turn your device sideways for more room.' },
  mazeLabel: {
    pl: 'Labirynt. Narysuj palcem drogę od wejścia do skarbu w środku. Możesz też rysować strzałkami.',
    en: 'Maze. Draw a path with your finger from the entrance to the treasure in the middle. You can also draw with the arrow keys.',
  },
  srObjective: {
    pl: 'Narysuj drogę od wejścia do skarbu w środku labiryntu.',
    en: 'Draw a path from the entrance to the treasure in the middle of the maze.',
  },
  srCanGo: { pl: 'Możesz iść: {dirs}.', en: 'You can go: {dirs}.' },
  srNoWay: {
    pl: 'Tu droga się kończy. Naciśnij „Wróć” i spróbuj innej.',
    en: 'The path ends here. Press "Start over" and try another way.',
  },
  srSolved: { pl: 'Brawo! Masz {treasure}!', en: 'Well done! You found {treasure}!' },
  srReset: { pl: 'Ścieżka wyczyszczona. Zacznij od wejścia.', en: 'Path cleared. Start from the entrance.' },
  up: { pl: 'w górę', en: 'up' },
  down: { pl: 'w dół', en: 'down' },
  left: { pl: 'w lewo', en: 'left' },
  right: { pl: 'w prawo', en: 'right' },
  specialGuest: { pl: 'Gość specjalny', en: 'Special guest' },
  skip: { pl: 'Pomiń', en: 'Skip' },
  waveHello: { pl: '{name} macha do ciebie!', en: '{name} waves hello!' },
  parentHelp: {
    pl: 'Dziecko rysuje drogę palcem albo myszką. „Wróć” czyści ścieżkę, ale labirynt zostaje ten sam. Po trzecim „Wróć” przylatuje motylek i pokazuje dwa kolejne ruchy. Gdy dziecko dotknie przyjaciela w rogu, ten przypomni, czego szuka. Co cztery przygody labirynty robią się trochę trudniejsze.',
    en: 'Your child draws the path with a finger or a mouse. "Start over" clears the path but keeps the same maze. After the third "Start over", a butterfly comes and shows the next two moves. Tap the friend in the corner to hear what they\'re looking for. Every four adventures, the mazes get a little harder.',
  },
  privacyNote: {
    pl: 'Postępy zapisują się tylko na tym urządzeniu.',
    en: 'Progress is saved on this device only.',
  },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof STRINGS;

export function t(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = STRINGS[key][lang];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
