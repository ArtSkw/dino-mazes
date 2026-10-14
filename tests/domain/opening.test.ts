import { describe, expect, it } from 'vitest';
import { decideOpening, localDate } from '../../src/app/controller';

describe('which opening plays', () => {
  it('full on the first launch of the day, short later that day, a fade with reduced motion', () => {
    expect(decideOpening('auto', false, undefined, '2026-10-14')).toBe('full');
    expect(decideOpening('auto', false, '2026-10-13', '2026-10-14')).toBe('full');
    expect(decideOpening('auto', false, '2026-10-14', '2026-10-14')).toBe('short');
    expect(decideOpening('auto', true, undefined, '2026-10-14')).toBe('fade');
  });

  it('explicit policies win; off means no opening', () => {
    expect(decideOpening('off', false, undefined, '2026-10-14')).toBeNull();
    expect(decideOpening('short', true, undefined, '2026-10-14')).toBe('short');
  });

  it('dates are local YYYY-MM-DD', () => {
    expect(localDate(new Date(2026, 9, 4, 23, 30))).toBe('2026-10-04');
  });
});
