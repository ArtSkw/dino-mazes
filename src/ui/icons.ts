/**
 * Functional icons: one consistent set, Phosphor Icons (MIT), "bold" weight.
 *
 * Bold matches the bold (700) Baloo 2 labels they sit beside (≈2.25 px
 * stroke on a 24 px grid), and Phosphor's rounded terminals suit the soft,
 * cartoon UI. Icons are inlined as SVG strings (Vite `?raw`), so only the
 * glyphs listed here are bundled and every icon inherits `currentColor`.
 * Never mix in another icon family on the same surface.
 */
import arrowCounterClockwise from '@phosphor-icons/core/assets/bold/arrow-counter-clockwise-bold.svg?raw';
import arrowRight from '@phosphor-icons/core/assets/bold/arrow-right-bold.svg?raw';
import arrowUUpLeft from '@phosphor-icons/core/assets/bold/arrow-u-up-left-bold.svg?raw';
import gearSix from '@phosphor-icons/core/assets/bold/gear-six-bold.svg?raw';
import musicNotes from '@phosphor-icons/core/assets/bold/music-notes-bold.svg?raw';
import userSound from '@phosphor-icons/core/assets/bold/user-sound-bold.svg?raw';
import house from '@phosphor-icons/core/assets/bold/house-bold.svg?raw';
import play from '@phosphor-icons/core/assets/bold/play-bold.svg?raw';
import sparkle from '@phosphor-icons/core/assets/bold/sparkle-bold.svg?raw';
import speakerHigh from '@phosphor-icons/core/assets/bold/speaker-high-bold.svg?raw';
import speakerSlash from '@phosphor-icons/core/assets/bold/speaker-slash-bold.svg?raw';
import translate from '@phosphor-icons/core/assets/bold/translate-bold.svg?raw';
import treasureChest from '@phosphor-icons/core/assets/bold/treasure-chest-bold.svg?raw';
import x from '@phosphor-icons/core/assets/bold/x-bold.svg?raw';

/** Decorative by default: the button that holds an icon carries the accessible name. */
const decorative = (svg: string): string => svg.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');

export const ICONS = {
  /** Curved return arrow for "Wróć / Start over" (PRD §6). */
  restart: decorative(arrowUUpLeft),
  soundOn: decorative(speakerHigh),
  soundOff: decorative(speakerSlash),
  music: decorative(musicNotes),
  voices: decorative(userSound),
  gear: decorative(gearSix),
  close: decorative(x),
  next: decorative(arrowRight),
  home: decorative(house),
  /** Treasure chest for "Moje skarby" (a basket read as a shopping cart). */
  chest: decorative(treasureChest),
  play: decorative(play),
  language: decorative(translate),
  motion: decorative(sparkle),
  /** "Zacznij grę od nowa" (whole game, not the maze path). */
  newGame: decorative(arrowCounterClockwise),
} as const;

export type IconName = keyof typeof ICONS;
