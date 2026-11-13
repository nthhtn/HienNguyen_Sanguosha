import combos from '../../data/decks/kingdom-wars/combo-pairs.json';
import { synergisticPairs } from './synergisticPartners';

// Candidate pairs for the bots' pick bonus (spec R3): the Synergistic Partners plus the combo pairs in
// combo-pairs.json. Only a candidate the fitting run confirms gets a bonus; the reasons are for the review.
const PREFIX = 'kingdomWars:';
const fullId = (id: string): string => (id.startsWith(PREFIX) ? id : `${PREFIX}${id}`);
const sorted = (a: string, b: string): readonly [string, string] => {
  const [x, y] = [fullId(a), fullId(b)].sort();
  return [x, y] as const;
};

/** The key of a pair: the two full `kingdomWars:` ids, sorted and joined by `|`; the order and prefix of the input do not matter. */
export const pairKey = (a: string, b: string): string => sorted(a, b).join('|');

const PAIRS = new Map<string, readonly [string, string]>();
for (const [a, b] of [...synergisticPairs(), ...combos.map(({ pair: [a, b] }) => [a, b] as const)]) {
  if (!PAIRS.has(pairKey(a, b))) PAIRS.set(pairKey(a, b), sorted(a, b));
}
const CANDIDATES = [...PAIRS.values()];

/** Every candidate pair as full ids, each once, sorted inside the pair. */
export const candidatePairs = (): readonly (readonly [string, string])[] => CANDIDATES;

/** Whether two different Generals are a candidate pair; takes full or unprefixed ids, in either order. */
export const isCandidatePair = (a: string, b: string): boolean => fullId(a) !== fullId(b) && PAIRS.has(pairKey(a, b));
