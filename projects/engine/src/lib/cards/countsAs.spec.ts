import { advanceToDecision, resolve } from '../pipeline/resolve';
import { getLegalActions } from '../rules/legality';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { CardInstance, GameState } from '../domain/types';
import { cardCountsAs } from './zones';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
// A delayed Tool that places itself in the target's judgment area, as what it was used as.
const trap: CardDefinition = {
  id: 'trap', name: 'Trap', category: 'tool', delayed: true,
  legalPlayTargets: () => [[{ kind: 'seat', seatId: 'b' }]],
  play: (_s, ctx) => [{ kind: 'MoveCardEffect', cardInstanceId: ctx.cardInstanceId, toZoneId: 'b:judgment', countsAs: ctx.card.as }],
};
const plain: CardDefinition = { id: 'plain', name: 'Plain', category: 'basic', play: () => [] };
const trapper: SkillDefinition = { id: 'trapper', conversions: [{ id: 'trapper', as: 'trap', cards: 1, when: 'play' }] };
const registry: ContentRegistry = {
  cards: new Map([['trap', trap], ['plain', plain]]),
  generals: new Map([['g', { id: 'g', kingdom: 'Wu', maxHp: 4, skills: [trapper] }]]),
};
const ctx = { registry, mode };
const c1: CardInstance = { instanceId: 'c1', definitionId: 'plain', suit: 'diamond', rank: 3 };

function table(): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wu' as const, eliminated: false,
    generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } },
    combinedHp: 4, maxCombinedHp: 4, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [c1] }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }, { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] }, { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] }, { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('a card that counts as another', () => {
  it('a delayed Tool made by a conversion goes straight to the judgment area, counting as that Tool', () => {
    const convert = getLegalActions(table(), 'a', registry).find((a) => a.kind === 'UseConversionAction')!;
    const selecting = resolve(table(), convert, ctx).state;
    const placed = resolve(selecting, { kind: 'SelectAction', seatId: 'a', selectionId: selecting.pendingSelection!.id, ids: ['c1'] }, ctx).state;
    const zone = placed.zones.find((z) => z.id === 'b:judgment')!;
    expect(zone.cards.map((c) => c.instanceId)).toEqual(['c1']);
    expect(zone.countsAs).toEqual({ c1: 'trap' });
    expect(cardCountsAs(zone, c1)).toBe('trap');
    expect(placed.log.some((e) => e.kind === 'CardMovedEvent' && e.toZoneId === 'discardPile')).toBe(false);
  });

  it('a zone forgets it once the card leaves, and records nothing for a card counting as itself', () => {
    const placed = advanceToDecision({ ...table(), resolutionQueue: [{ kind: 'MoveCardEffect', cardInstanceId: 'c1', toZoneId: 'b:judgment', countsAs: 'trap' }] }, ctx).state;
    const gone = advanceToDecision({ ...placed, resolutionQueue: [{ kind: 'MoveCardEffect', cardInstanceId: 'c1', toZoneId: 'discardPile' }] }, ctx).state;
    expect(gone.zones.find((z) => z.id === 'b:judgment')!.countsAs).toBeUndefined();
    const itself = advanceToDecision({ ...table(), resolutionQueue: [{ kind: 'MoveCardEffect', cardInstanceId: 'c1', toZoneId: 'b:judgment', countsAs: 'plain' }] }, ctx).state;
    expect(itself.zones.find((z) => z.id === 'b:judgment')!.countsAs).toBeUndefined();
  });
});
