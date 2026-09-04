import { createRng, nextFloat, nextInt } from './rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const stepA = nextFloat(a);
    const stepB = nextFloat(b);
    expect(stepA.value).toBe(stepB.value);
  });

  it('advances the counter and produces different values on successive draws', () => {
    const rng = createRng(42);
    const first = nextFloat(rng);
    const second = nextFloat(first.rng);
    expect(first.rng.counter).toBe(1);
    expect(second.rng.counter).toBe(2);
    expect(first.value).not.toBe(second.value);
  });

  it('nextInt stays within [0, maxExclusive)', () => {
    let rng = createRng(7);
    for (let i = 0; i < 100; i++) {
      const step = nextInt(rng, 6);
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(6);
      rng = step.rng;
    }
  });
});
