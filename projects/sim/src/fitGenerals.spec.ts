import { pairKey } from 'content';
import { collectSamples, fitPairs, fitValues, formatDeckTable, formatTable, K_PAIR } from './fitGenerals';
import type { PickSample } from './fitGenerals';

const s = (a: string, b: string, won: boolean, seats = 4): PickSample => ({ generalIds: [a, b], won, seats });
const many = (count: number, a: string, b: string, won: boolean, seats: number): PickSample[] => Array.from({ length: count }, () => s(a, b, won, seats));

describe('fitValues', () => {
  const samples = [s('a', 'b', true), s('a', 'c', true), s('b', 'c', false), s('c', 'd', false)];
  it("is each General's win-rate lift over the overall mean (no shrinkage at k = 0)", () => {
    const { values, counts } = fitValues(samples, 0);
    expect(values['a']).toBeCloseTo(0.5, 10);
    expect(values['b']).toBeCloseTo(0, 10);
    expect(values['c']).toBeCloseTo(-1 / 6, 10);
    expect(values['d']).toBeCloseTo(-0.5, 10);
    expect(counts).toEqual({ a: 2, b: 2, c: 3, d: 1 });
  });
  it('shrinks by n / (n + k)', () => {
    expect(fitValues(samples, 2).values['a']).toBeCloseTo(0.25, 10);
  });
  it('gives a General that was never sampled no entry, and nothing for no samples', () => {
    expect(fitValues(samples, 0).values['z']).toBeUndefined();
    expect(fitValues([], 200)).toEqual({ values: {}, counts: {} });
  });
});

describe('fitValues across seat counts (R2)', () => {
  it('compares win rates within each seat count, so a General winning at each count\'s own rate scores 0', () => {
    // 4 seats: everyone wins 1 in 2; 8 seats: everyone wins 1 in 4. 'g' wins at exactly those rates.
    const samples = [
      ...many(5, 'g', 'x', true, 4), ...many(5, 'g', 'x', false, 4), ...many(5, 'h', 'y', true, 4), ...many(5, 'h', 'y', false, 4),
      ...many(5, 'h', 'y', true, 8), ...many(15, 'h', 'y', false, 8), ...many(30, 'g', 'x', false, 8), ...many(10, 'g', 'x', true, 8),
    ];
    // More of 'g''s samples sit at 8 seats than 'h''s; one overall rate over both counts would rate them apart.
    const { values } = fitValues(samples, 0);
    expect(values['g']).toBeCloseTo(0, 10);
    expect(values['h']).toBeCloseTo(0, 10);
  });
  it('is not biased by how many samples each seat count has', () => {
    // 'g': +0.5 lift at 4 seats (10 samples), -0.5 at 8 seats (1000 samples); equal weights cancel out.
    const samples = [
      ...many(5, 'g', 'x', true, 4), ...many(5, 'h', 'y', false, 4),
      ...many(500, 'g', 'x', false, 8), ...many(500, 'h', 'y', true, 8),
    ];
    const { values, counts } = fitValues(samples, 0);
    expect(values['g']).toBeCloseTo(0, 10);
    expect(counts['g']).toBe(505);
  });
  it('weights 10 samples at 4 seats like 1000 at 8 seats', () => {
    // 'g': +0.5 at 4 seats (10 samples), 0 at 8 seats (1000 samples); an equal weighting averages to +0.25.
    const samples = [
      ...many(5, 'g', 'x', true, 4), ...many(5, 'h', 'y', false, 4),
      ...many(250, 'g', 'x', true, 8), ...many(250, 'g', 'x', false, 8), ...many(250, 'h', 'y', true, 8), ...many(250, 'h', 'y', false, 8),
    ];
    expect(fitValues(samples, 0).values['g']).toBeCloseTo(0.25, 10);
  });
  it('shrinks by the raw sample count', () => {
    const samples = [...many(5, 'g', 'x', true, 4), ...many(5, 'h', 'y', false, 4)];
    expect(fitValues(samples, 5).values['g']).toBeCloseTo(0.5 * (5 / 10), 10);
  });
  it('handles seat counts with no samples (a gap in the range) without NaN', () => {
    const samples = [s('g', 'x', true, 4), s('h', 'y', false, 4), s('g', 'y', false, 8), s('h', 'x', true, 8)];
    const { values } = fitValues(samples);
    for (const v of Object.values(values)) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('fitPairs (R4)', () => {
  const P = 'kingdomWars:p';
  const Q = 'kingdomWars:q';
  const R = 'kingdomWars:r';
  const T = 'kingdomWars:t';
  it('keeps a pair that wins above overall + both values, shrunk by n / (n + K_PAIR)', () => {
    expect(K_PAIR).toBe(200);
    // Overall at 4 seats is 200 / 400 = 0.5; the pair wins 0.7 with values 0, so its lift is 0.2 over 200 samples.
    const samples = [...many(140, P, Q, true, 4), ...many(60, P, Q, false, 4), ...many(60, R, T, true, 4), ...many(140, R, T, false, 4)];
    const { bonuses, counts } = fitPairs(samples, { [P]: 0, [Q]: 0 }, [[P, Q]]);
    expect(bonuses[pairKey(P, Q)]).toBeCloseTo(0.1, 10);
    expect(counts[pairKey(P, Q)]).toBe(200);
  });
  it('subtracts both values, so a pair at or below expectation gets no bonus', () => {
    // Overall 0.5; the pair wins 0.75 and its values add to 0.25: exactly at expectation (binary-exact numbers).
    const samples = [...many(96, P, Q, true, 4), ...many(32, P, Q, false, 4), ...many(32, R, T, true, 4), ...many(96, R, T, false, 4)];
    expect(fitPairs(samples, { [P]: 0.125, [Q]: 0.125 }, [[P, Q]]).bonuses).toEqual({});
    expect(fitPairs(samples, { [P]: 0.25, [Q]: 0.125 }, [[P, Q]]).bonuses).toEqual({});
    expect(fitPairs(samples, {}, [[R, T]]).bonuses).toEqual({});
  });
  it('finds a pair in either order, and gives an unseen candidate count 0 and no bonus', () => {
    const samples = [...many(140, Q, P, true, 4), ...many(60, Q, P, false, 4), ...many(60, R, T, true, 4), ...many(140, R, T, false, 4)];
    const { bonuses, counts } = fitPairs(samples, {}, [[P, Q], [P, R]]);
    expect(counts[pairKey(P, Q)]).toBe(200);
    expect(counts[pairKey(P, R)]).toBe(0);
    expect(bonuses[pairKey(P, R)]).toBeUndefined();
  });
  it('ignores pairs that are not candidates, and survives no samples', () => {
    const samples = [...many(140, P, Q, true, 4), ...many(60, R, T, false, 4)];
    expect(fitPairs(samples, {}, [[R, P]]).bonuses).toEqual({});
    expect(fitPairs([], {}, [[P, Q]])).toEqual({ bonuses: {}, counts: { [pairKey(P, Q)]: 0 } });
  });
});

describe('formatDeckTable', () => {
  it('prints both constants, sorted, with sample counts and the command that makes it', () => {
    const fit = { values: { 'kingdomWars:b': 0.1, 'kingdomWars:a': -0.2 }, counts: { 'kingdomWars:a': 10, 'kingdomWars:b': 20 } };
    const key = pairKey('kingdomWars:a', 'kingdomWars:b');
    const other = pairKey('kingdomWars:a', 'kingdomWars:c');
    const text = formatDeckTable(fit, { bonuses: { [key]: 0.05 }, counts: { [key]: 30, [other]: 0 } }, 'npm run sim -- fit-generals 20 4-5 2000000 kingdomWars');
    expect(text).toContain('GENERATED by `npm run sim -- fit-generals 20 4-5 2000000 kingdomWars`');
    expect(text).toContain('export const KINGDOM_WARS_VALUES: Readonly<Record<string, number>> = {');
    expect(text).toContain('export const KINGDOM_WARS_PAIR_BONUSES: Readonly<Record<string, number>> = {');
    expect(text).toContain("  'kingdomWars:b': 0.1000, // 20 samples");
    expect(text.indexOf("'kingdomWars:a'")).toBeLessThan(text.indexOf("'kingdomWars:b'"));
    expect(text).toContain(`  '${key}': 0.0500, // 30 samples`);
    expect(text).toContain(`// '${other}': no bonus, 0 samples`);
  });
});

describe('formatTable', () => {
  it('prints the table sorted by id, with the command that makes it', () => {
    const text = formatTable({ values: { b: 0.1, a: -0.2 }, counts: { a: 10, b: 20 } }, 'npm run sim -- fit-generals 4 4 0');
    expect(text).toContain('npm run sim -- fit-generals 4 4 0');
    expect(text.indexOf("'a'")).toBeLessThan(text.indexOf("'b'"));
    expect(text).toContain('export const GENERAL_VALUES');
  });
});

describe('collectSamples', () => {
  it('records one sample per seat of every finished game, two real Generals each', () => {
    const samples = collectSamples(2, 4, 0, 'identity');
    expect(samples.length).toBeLessThanOrEqual(8);
    expect(samples.length % 4).toBe(0);
    for (const x of samples) expect(x.generalIds[0]).not.toBe(x.generalIds[1]);
    for (const x of samples) expect(x.seats).toBe(4);
  });
  it('plays the deck it is given', () => {
    const samples = collectSamples(1, 4, 0, 'kingdomWars');
    for (const x of samples) for (const id of x.generalIds) expect(id.startsWith('kingdomWars:')).toBe(true);
  });
});
