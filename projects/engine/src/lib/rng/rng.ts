export interface RngState {
  readonly seed: number;
  readonly counter: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0, counter: 0 };
}

export function nextFloat(rng: RngState): { value: number; rng: RngState } {
  const counter = rng.counter + 1;
  let t = (rng.seed + counter * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: { seed: rng.seed, counter } };
}

export function nextInt(rng: RngState, maxExclusive: number): { value: number; rng: RngState } {
  const step = nextFloat(rng);
  return { value: Math.floor(step.value * maxExclusive), rng: step.rng };
}

// Deterministic in-place-equivalent Fisher-Yates shuffle. This is the single
// seeded-shuffle mechanism shared by every part of the engine that needs to
// randomize an ordered list of items (initial deck build, discard-pile
// reshuffle, etc.) — do not reimplement this algorithm elsewhere.
export function shuffle<T>(items: readonly T[], rng: RngState): { items: T[]; rng: RngState } {
  const result = items.slice();
  let currentRng = rng;
  for (let i = result.length - 1; i > 0; i--) {
    const step = nextInt(currentRng, i + 1);
    currentRng = step.rng;
    const j = step.value;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { items: result, rng: currentRng };
}
