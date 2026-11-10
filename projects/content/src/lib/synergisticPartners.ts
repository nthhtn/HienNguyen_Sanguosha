import pairs from '../../data/decks/kingdom-wars/synergistic-pairs.json';

// The Kingdom Wars Generals that go together, as pairs of General ids. Every pair is mutual, so each is
// listed once, in no particular order. The wiki's crawled partner text is separate (it is display only).
const PAIRS = pairs as [string, string][];

const key = (a: string, b: string): string => [a, b].sort().join('|');
const KEYS = new Set(PAIRS.map(([a, b]) => key(a, b)));

export const synergisticPairs = (): readonly (readonly [string, string])[] => PAIRS;

/** Whether two different Generals are Synergistic Partners; the order does not matter. */
export const areSynergisticPartners = (a: string, b: string): boolean => a !== b && KEYS.has(key(a, b));
