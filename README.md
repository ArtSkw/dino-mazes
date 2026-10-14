# Dino Mazes

A maze game for children aged 4 to 6, inspired by *Gigantosaurus*. In each
round a friend from the jungle needs help reaching a treasure, and the child
draws the way.

**Play:** https://artskw.github.io/dino-mazes/

## Where it comes from

The characters, Bill, Tiny, Mazu, Rocky and Giganto, come from *Gigantosaurus*,
the picture book by Jonny Duddle and the animated series based on it. The art
follows the look of the series. The illustrations were generated with GPT
Imagegen in Codex, using images from the show as reference.

The characters belong to their rights holders. This is a private family
project, not an official game.

## What's in it

- A new maze every round, getting harder as the child gets better at them.
- Four jungle friends with their own quests, and Giganto as a special guest.
- A collection of treasures to fill.
- Draw with a finger, a pen, a mouse or a trackpad.
- Polish by default, English in the parents' settings.
- Works offline after the first visit and keeps progress on the device.

## How it's built

TypeScript and Vite. Phaser renders the board; the interface is plain HTML.

- The painted art is decoration only. Code draws the maze, the hedges and the
  child's trail, so the art never decides where you can walk.
- Every maze is generated from a seed and has exactly one route. The tests
  check 1,000 seeds for each difficulty level.
- A Python script cuts the generated art into sprite atlases for the game.
- Playwright runs the main flows in Chromium and WebKit, offline relaunch
  included.

```sh
npm install
npm run dev
npm test
```

More detail: [PRD.md](PRD.md), [docs/STATUS.md](docs/STATUS.md), [art/README.md](art/README.md).
