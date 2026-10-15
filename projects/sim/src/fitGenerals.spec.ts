import { collectSamples, fitValues, formatTable } from './fitGenerals';

const s = (a: string, b: string, won: boolean) => ({ generalIds: [a, b] as [string, string], won });

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
    const samples = collectSamples(2, 4, 0);
    expect(samples.length).toBeLessThanOrEqual(8);
    expect(samples.length % 4).toBe(0);
    for (const x of samples) expect(x.generalIds[0]).not.toBe(x.generalIds[1]);
  });
});
