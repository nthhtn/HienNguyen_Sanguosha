import { createRng, nextFloat, nextInt, shuffle } from './rng';

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

describe('shuffle', () => {
  it('returns every input item exactly once', () => {
    const { items } = shuffle(['a', 'b', 'c', 'd', 'e'], createRng(1));
    expect(items.slice().sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('is deterministic for a given seed and differs for a different seed', () => {
    const a = shuffle(['a', 'b', 'c', 'd', 'e', 'f'], createRng(1)).items;
    const b = shuffle(['a', 'b', 'c', 'd', 'e', 'f'], createRng(1)).items;
    const c = shuffle(['a', 'b', 'c', 'd', 'e', 'f'], createRng(2)).items;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('returns an updated rng distinct from the input when more than one item is shuffled', () => {
    const rng = createRng(1);
    const { rng: after } = shuffle(['a', 'b'], rng);
    expect(after).not.toEqual(rng);
  });

  it('leaves a 0- or 1-item array unshuffled and returns the rng unchanged', () => {
    const rng = createRng(1);
    expect(shuffle([], rng)).toEqual({ items: [], rng });
    expect(shuffle(['solo'], rng)).toEqual({ items: ['solo'], rng });
  });
});
