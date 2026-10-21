import type { CardInstance, GameState, Kingdom } from 'engine';
import { buildContentRegistry } from '../../registry';
import { attackRange } from '../../shared/queries';
import { alternateCardData } from '../../alternateCards';
import { withFillers } from '../../generals/fillers.testing';

const registry = withFillers(buildContentRegistry());
const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 7 });

// seat-a, seat-b, seat-c, seat-d with the given Kingdoms; `equip` fills a seat's equipment.
function table(kingdoms: Kingdom[], equip: Record<string, CardInstance[]> = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: kingdoms[index], eliminated: false,
      generals: { main: { generalDefinitionId: 'filler-xu-huang', revealed: kingdoms[index] !== 'hidden' }, deputy: { generalDefinitionId: 'filler-dong-zhuo', revealed: kingdoms[index] !== 'hidden' } },
      combinedHp: 4, maxCombinedHp: 4,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: equip[id] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}
const sword = card('sw', 'wu-six-swords');
const range = (s: GameState, id: string) => attackRange(s, id, registry);

describe('Six Swords of Wu', () => {
  it('is a range-2 weapon in the registry', () => {
    const def = registry.cards.get('wu-six-swords');
    expect(def?.equipSlot).toBe('weapon');
    expect(def?.weaponRange).toBe(alternateCardData('wu-six-swords')?.range);
    expect(def?.weaponRange).toBe(2);
  });

  it('gives its owner and each Kingdom mate +1 attack range', () => {
    const s = table(['Wu', 'Wu', 'Wei', 'Qun'], { 'seat-a': [sword] });
    expect(range(s, 'seat-a')).toBe(3);
    expect(range(s, 'seat-b')).toBe(2);
    expect(range(s, 'seat-c')).toBe(1);
    expect(range(s, 'seat-d')).toBe(1);
  });

  it('does not reach a seat with a hidden General', () => {
    const s = table(['Wu', 'hidden', 'Wei', 'Qun'], { 'seat-a': [sword] });
    expect(range(s, 'seat-b')).toBe(1);
  });

  it('with no exposed General, helps the owner alone', () => {
    const s = table(['hidden', 'hidden', 'Wu', 'Qun'], { 'seat-a': [sword] });
    expect(range(s, 'seat-a')).toBe(3);
    expect(range(s, 'seat-b')).toBe(1);
    expect(range(s, 'seat-c')).toBe(1);
  });

  it('stops at once when the sword moves to the discard pile', () => {
    const worn = table(['Wu', 'Wu', 'Wei', 'Qun'], { 'seat-a': [sword] });
    expect(range(worn, 'seat-b')).toBe(2);
    expect(range(worn, 'seat-a')).toBe(3);
    const discarded: GameState = {
      ...worn,
      zones: worn.zones.map((z) =>
        z.id === 'seat-a:equip' ? { ...z, cards: [] } : z.id === 'discardPile' ? { ...z, cards: [sword] } : z
      ),
    };
    expect(range(discarded, 'seat-b')).toBe(1);
    expect(range(discarded, 'seat-a')).toBe(1);
  });

  it('gives nothing while its owner is eliminated', () => {
    const s = table(['Wu', 'Wu', 'Wei', 'Qun'], { 'seat-a': [sword] });
    const dead: GameState = { ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, eliminated: true } : x)) };
    expect(range(dead, 'seat-b')).toBe(1);
  });

  it('adds to a mate weapon', () => {
    const s = table(['Wu', 'Wu', 'Wei', 'Qun'], { 'seat-a': [sword], 'seat-b': [card('cb', 'crossbow')] });
    const crossbow = registry.cards.get('crossbow')!.weaponRange!;
    expect(range(s, 'seat-b')).toBe(crossbow + 1);
  });
});
