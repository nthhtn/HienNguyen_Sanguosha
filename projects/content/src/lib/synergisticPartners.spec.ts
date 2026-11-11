import { areSynergisticPartners, synergisticPairs } from './synergisticPartners';
import { kingdomWarsGeneralIds, kingdomWarsGeneralRecords } from './kingdomWarsGenerals';

describe('the Synergistic Partners table', () => {
  it('is symmetric', () => {
    expect(areSynergisticPartners('liu-bei', 'guan-yu')).toBe(true);
    expect(areSynergisticPartners('guan-yu', 'liu-bei')).toBe(true);
  });

  it('is false for unrelated, identical and unknown ids', () => {
    expect(areSynergisticPartners('liu-bei', 'cao-cao')).toBe(false);
    expect(areSynergisticPartners('liu-bei', 'liu-bei')).toBe(false);
    expect(areSynergisticPartners('liu-bei', 'nobody')).toBe(false);
  });

  // A pair may name a General the deck does not have yet (added ahead of it, by the add-general skill): it only counts once both exist.
  const known = new Set(kingdomWarsGeneralIds());
  const bothInDeck = ([a, b]: readonly [string, string]) => known.has(a) && known.has(b);

  it('lists each pair once and never pairs a General with itself', () => {
    const keys = synergisticPairs().map(([a, b]) => [a, b].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(synergisticPairs().filter(([a, b]) => a === b)).toEqual([]);
  });

  it('agrees with the crawled partner lists on both sides of every pair', () => {
    const records = new Map(kingdomWarsGeneralRecords().map((g) => [g.id, g]));
    // The crawled text is "Name 中文 (Relation)", and a combined entry joins its Chinese with "&": compare on the English letters alone.
    const plain = (text: string) => text.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
    const missing: string[] = [];
    for (const [a, b] of synergisticPairs().filter(bothInDeck)) {
      for (const [from, to] of [[a, b], [b, a]]) {
        const listed = records.get(from)!.synergisticPartners.map(plain);
        const wanted = plain(records.get(to)!.name);
        if (!listed.includes(wanted)) missing.push(`${from} does not list ${to}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
