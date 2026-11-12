import { buildContentRegistry } from './registry';
import { candidatePairs, isCandidatePair, pairKey } from './comboPairs';
import comboPairs from '../../data/decks/kingdom-wars/combo-pairs.json';

const registry = buildContentRegistry();
const entries = comboPairs.map(({ pair: [a, b], reason }) => ({ pair: [a, b] as [string, string], reason }));

// The developer's examples (spec R3): each must be a candidate whatever the fit finds.
const DEVELOPER_EXAMPLES: [string, string][] = [
  ['guo-jia', 'cao-cao'],
  ['zhang-fei', 'ma-chao'], ['zhang-fei', 'huang-zhong'],
  ['zhao-yun', 'ma-chao'], ['zhao-yun', 'huang-zhong'],
  ['guan-yu', 'ma-chao'], ['guan-yu', 'huang-zhong'],
  ['yuan-shao', 'tian-feng'],
  ['sima-yi', 'zhen-ji'],
  ['lu-xun', 'sun-shangxiang'],
  ['lu-su', 'zhou-tai'],
  ['lu-meng', 'zhou-tai'],
];

describe('the combo pairs', () => {
  it('names only Kingdom Wars Generals, unprefixed', () => {
    const unknown = entries.flatMap(({ pair }) => pair).filter((id) => id.includes(':') || !registry.generals.has(`kingdomWars:${id}`));
    expect(unknown).toEqual([]);
  });

  it('pairs Generals of the same Kingdom, never a General with itself', () => {
    const kingdomOf = (id: string) => registry.generals.get(`kingdomWars:${id}`)?.kingdom;
    expect(entries.filter(({ pair: [a, b] }) => a === b || kingdomOf(a) !== kingdomOf(b)).map(({ pair }) => pair)).toEqual([]);
  });

  it('lists each pair once, with a reason', () => {
    const keys = entries.map(({ pair: [a, b] }) => pairKey(a, b));
    expect(new Set(keys).size).toBe(keys.length);
    expect(entries.filter(({ reason }) => reason.trim() === '')).toEqual([]);
  });

  it('holds every one of the developer examples', () => {
    expect(DEVELOPER_EXAMPLES.filter(([a, b]) => !isCandidatePair(a, b))).toEqual([]);
    const listed = new Set(entries.map(({ pair: [a, b] }) => pairKey(a, b)));
    expect(DEVELOPER_EXAMPLES.filter(([a, b]) => !listed.has(pairKey(a, b)))).toEqual([]);
  });
});

describe('candidatePairs', () => {
  const keys = candidatePairs().map(([a, b]) => `${a}|${b}`);

  it('holds the Synergistic Partners and the combo pairs as full ids, sorted inside each pair, each once', () => {
    expect(candidatePairs().every(([a, b]) => a.startsWith('kingdomWars:') && b.startsWith('kingdomWars:') && a < b)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => k === 'kingdomWars:guan-yu|kingdomWars:liu-bei')).toHaveLength(1);
    expect(keys).toContain('kingdomWars:cao-cao|kingdomWars:guo-jia');
  });

  it('counts a Synergistic Partner pair once even when the combo list also has it', () => {
    // The extra Wei pair only shows that the mocked list is the one read.
    const withPartner = [...entries, { pair: ['liu-bei', 'guan-yu'], reason: 'listed twice' }, { pair: ['zhang-liao', 'cao-ren'], reason: 'marker' }];
    jest.isolateModules(() => {
      jest.doMock('../../data/decks/kingdom-wars/combo-pairs.json', () => withPartner);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('./comboPairs') as typeof import('./comboPairs');
      const freshKeys = fresh.candidatePairs().map(([a, b]) => `${a}|${b}`);
      expect(freshKeys).toContain('kingdomWars:cao-ren|kingdomWars:zhang-liao');
      expect(freshKeys.filter((k) => k === 'kingdomWars:guan-yu|kingdomWars:liu-bei')).toHaveLength(1);
    });
    jest.dontMock('../../data/decks/kingdom-wars/combo-pairs.json');
  });
});

describe('isCandidatePair and pairKey', () => {
  it('ignores order and accepts full or unprefixed ids', () => {
    expect(isCandidatePair('guo-jia', 'kingdomWars:cao-cao')).toBe(true);
    expect(isCandidatePair('kingdomWars:cao-cao', 'guo-jia')).toBe(true);
    expect(isCandidatePair('liu-bei', 'guan-yu')).toBe(true);
  });

  it('is false for unlisted, identical and unknown pairs', () => {
    expect(isCandidatePair('cao-cao', 'liu-bei')).toBe(false);
    expect(isCandidatePair('cao-cao', 'cao-cao')).toBe(false);
    expect(isCandidatePair('cao-cao', 'nobody')).toBe(false);
  });

  it('joins the two full ids, sorted', () => {
    expect(pairKey('guo-jia', 'kingdomWars:cao-cao')).toBe('kingdomWars:cao-cao|kingdomWars:guo-jia');
    expect(pairKey('kingdomWars:guo-jia', 'cao-cao')).toBe('kingdomWars:cao-cao|kingdomWars:guo-jia');
  });
});
