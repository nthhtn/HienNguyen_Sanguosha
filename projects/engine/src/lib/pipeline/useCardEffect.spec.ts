import { advanceToDecision } from './resolve';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { GameState } from '../domain/types';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
// A card whose play heals its target 1: proves play() ran with the given seat and targets.
const mend: CardDefinition = { id: 'mend', name: 'Mend', category: 'tool', play: (_s, ctx) => [{ kind: 'HealEffect', target: ctx.targets[0], amount: 1 }] };
const registry: ContentRegistry = { cards: new Map([['mend', mend]]), generals: new Map() };

function table(): GameState {
  const seat = (id: string, index: number, combinedHp: number) => ({
    id, index, kingdom: 'Wei' as const, eliminated: false, generals: null, combinedHp, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0, 4), seat('b', 1, 2)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      ...['a', 'b'].flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('UseCardEffect', () => {
  it('uses a card with no physical card for a seat that is not the turn owner, uncounted', () => {
    const virtual = { as: 'mend', colour: 'none' as const, physical: [] };
    const s = advanceToDecision({ ...table(), resolutionQueue: [{ kind: 'UseCardEffect', seatId: 'b', card: virtual, targets: [{ kind: 'seat', seatId: 'b' }] }] }, { registry, mode }).state;
    expect(s.log[0]).toEqual({ kind: 'CardPlayedEvent', seatId: 'b', card: virtual, targets: [{ kind: 'seat', seatId: 'b' }] });
    expect(s.seats[1].combinedHp).toBe(3);
    expect(s.turn.cardPlays).toBeUndefined();
    expect(s.turn.ownerUses).toBeUndefined();
  });
});
