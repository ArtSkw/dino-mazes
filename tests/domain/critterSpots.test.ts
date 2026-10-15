import { describe, expect, it } from 'vitest';
import { CORRIDOR_RADIUS, FRAME_MARGIN, LEVELS, generateMaze, introMaze, profileFor } from '../../src/domain/maze';
import { CRITTER_RADIUS, corridorDistance, critterSpots } from '../../src/domain/critterSpots';

describe('hidden critters sit only on hedge', () => {
  const mazes = [introMaze(), ...LEVELS.flatMap((d, i) => [generateMaze(`crit-${i}-a`, profileFor(d, { cols: 7, rows: 7 })), generateMaze(`crit-${i}-b`, profileFor(d, { cols: 9, rows: 7 }))])];

  it('never on a corridor, never near the entrance or the treasure, always inside the hedge frame', () => {
    for (const m of mazes) {
      const spots = critterSpots(m);
      expect(spots.length, m.seed).toBeGreaterThan(5);
      for (const p of spots) {
        expect(corridorDistance(m, p), `${m.seed} ${p.x},${p.y}`).toBeGreaterThanOrEqual(CORRIDOR_RADIUS + CRITTER_RADIUS - 1e-9);
        expect(Math.hypot(p.x - m.entrance.outside.x, p.y - m.entrance.outside.y)).toBeGreaterThanOrEqual(1.6);
        expect(Math.hypot(p.x - m.goal.center.x, p.y - m.goal.center.y)).toBeGreaterThanOrEqual(1.2);
        expect(p.x).toBeGreaterThanOrEqual(-FRAME_MARGIN);
        expect(p.x).toBeLessThanOrEqual(m.width + FRAME_MARGIN);
        expect(p.y).toBeGreaterThanOrEqual(-FRAME_MARGIN);
        expect(p.y).toBeLessThanOrEqual(m.height + FRAME_MARGIN);
      }
    }
  });

  it('a critter (0.34 cells across) fits inside the hedge between corridors (0.4 cells)', () => {
    expect(2 * CRITTER_RADIUS).toBeLessThanOrEqual(1 - 2 * CORRIDOR_RADIUS);
  });
});
