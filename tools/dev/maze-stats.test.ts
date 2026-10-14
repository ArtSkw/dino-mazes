import { test } from 'vitest';
import { tryGenerate, profileFor } from '../../src/domain/maze';
import type { Difficulty } from '../../src/domain/types';

test('stats', () => {
  const combos: Array<[Difficulty, number, number]> = [
    ['hard', 9, 9], ['hard', 9, 7], ['hard', 7, 9], ['hard', 7, 7], ['hard', 7, 5],
    ['expert', 9, 9], ['expert', 9, 7], ['expert', 7, 7], ['expert', 7, 5],
    ['master', 11, 9], ['master', 9, 11], ['master', 9, 9], ['master', 9, 7], ['master', 7, 7], ['master', 7, 5],
    ['grand', 11, 9], ['grand', 9, 9], ['grand', 9, 7], ['grand', 7, 7], ['grand', 7, 5], ['grand', 5, 5],
  ];
  for (const [d, c, r] of combos) {
    const p = profileFor(d, { cols: c, rows: r });
    let fails = 0; let attempts = 0; let maxA = 0; const branch: Record<number, number> = {}; let sol = 0; let dead = 0;
    const N = 1000;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      const m = tryGenerate(`s${i}`, p);
      if (!m) { fails++; continue; }
      attempts += m.attempts; maxA = Math.max(maxA, m.attempts);
      branch[m.metrics.branchChoices] = (branch[m.metrics.branchChoices] ?? 0) + 1;
      sol += m.metrics.solutionLength; dead += m.metrics.maxDeadEndDepth;
    }
    const ok = N - fails;
    process.stdout.write(`${d} ${c}x${r}: fails=${fails} avgAttempts=${(attempts / ok).toFixed(1)} maxAttempts=${maxA} avgSol=${(sol / ok).toFixed(1)} avgMaxDead=${(dead / ok).toFixed(1)} branch=${JSON.stringify(branch)} ms=${(performance.now() - t0).toFixed(0)}\n`);
  }
}, 120000);
