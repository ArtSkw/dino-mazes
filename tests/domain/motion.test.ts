import { describe, expect, it } from 'vitest';
import { firstArrival, pinnedPopUp, settleTime, spring } from '../../src/game/motion';
import { ASSETS, baseHidden } from '../../src/game/assets';
import type { CharacterId } from '../../src/domain/types';

const IDS = Object.keys(ASSETS.characters) as CharacterId[];

describe('spring', () => {
  it('starts at 0 and settles at 1', () => {
    expect(spring(0, 0.5, 2)).toBe(0);
    expect(spring(-1, 0.5, 2)).toBe(0);
    expect(spring(settleTime(0.5, 2), 0.5, 2)).toBeCloseTo(1, 2);
    expect(spring(3, 1, 2)).toBeCloseTo(1, 6);
  });

  it('overshoots by exp(-πζ/√(1-ζ²)) when underdamped', () => {
    const zeta = 0.5;
    let peak = 0;
    for (let t = 0; t < 1.5; t += 0.0005) peak = Math.max(peak, spring(t, zeta, 2));
    expect(peak - 1).toBeCloseTo(Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)), 3);
  });

  it('first arrives at rest at firstArrival', () => {
    const t1 = firstArrival(0.55, 1.8);
    expect(spring(t1, 0.55, 1.8)).toBeCloseTo(1, 6);
    expect(spring(t1 * 0.98, 0.55, 1.8)).toBeLessThan(1);
  });
});

describe('pinned pop-up (bust cut never shows)', () => {
  const cases: Array<[number, number, number]> = [
    [0.5, 2.1, 0.5],
    [0.58, 1.7, 0.42],
    [0.55, 1.8, 0.4],
  ];
  for (const [zeta, freq, amount] of cases) {
    it(`ζ ${zeta}, ${freq} Hz: the base never rises above its resting place`, () => {
      const p = pinnedPopUp(zeta, freq, amount);
      let prev = 0;
      for (let i = 0; i <= 2000; i++) {
        const v = i / 2000;
        const tr = p.travel(v);
        expect(tr).toBeLessThanOrEqual(1);
        expect(tr).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = tr;
      }
      expect(p.travel(1)).toBe(1);
    });

    it(`ζ ${zeta}, ${freq} Hz: the bounce becomes a modest stretch that settles to rest`, () => {
      const p = pinnedPopUp(zeta, freq, amount);
      let max = 0;
      let min = 0;
      for (let i = 0; i <= 2000; i++) {
        const s = p.stretch(i / 2000);
        max = Math.max(max, s);
        min = Math.min(min, s);
        if ((i / 2000) * p.duration < p.arrival - 1) expect(s).toBe(0);
      }
      expect(max).toBeGreaterThan(0.02);
      expect(max).toBeLessThan(0.09);
      expect(min).toBeGreaterThan(-0.02);
      expect(p.stretch(1)).toBe(0);
      expect(Math.abs(p.stretch(0.97))).toBeLessThan(0.002);
      expect(p.arrival).toBeLessThan(p.duration);
    });
  }
});

describe('waist cut fade', () => {
  it('every friend has the faded band recorded by tools/art/v3.py', () => {
    for (const id of IDS) expect(ASSETS.characters[id].cutFade).toBeCloseTo(0.03, 6);
  });

  it('the band rests below the screen edge with a margin', () => {
    for (const id of IDS) {
      for (const h of [120, 260, 420, 700]) {
        const band = h * ASSETS.characters[id].cutFade;
        expect(baseHidden(id, h)).toBeGreaterThanOrEqual(band + 2);
        expect(baseHidden(id, h)).toBeLessThan(band + 4);
      }
    }
  });
});
