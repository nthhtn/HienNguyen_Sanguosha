import { advanceToDecision } from './resolve';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { CardInstance, GameState, Judgment } from '../domain/types';
import { pileZoneOf } from '../cards/zones';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const registry: ContentRegistry = { cards: new Map([['mark', { id: 'mark', name: 'Mark', category: 'tool', delayed: true, play: () => [], onJudged: () => [] }]]), generals: new Map() };
const ctx = { registry, mode };
const card = (instanceId: string, suit: CardInstance['suit'] = 'spade'): CardInstance => ({ instanceId, definitionId: 'x', suit, rank: 4 });

function table(): GameState {
  return {
    seats: [{ id: 'a', index: 0, kingdom: 'Wei', eliminated: false, generals: null, combinedHp: 4, maxCombinedHp: 4, hand: { zoneId: 'a:hand' }, equipped: { zoneId: 'a:equip' }, judgment: { zoneId: 'a:judgment' }, pile: { zoneId: 'a:pile' } }],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [card('old')] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('new', 'heart')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }, { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'a:pile', kind: 'pile', ownerSeatId: 'a', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('a pile under a seat', () => {
  it('is found by pileZoneOf, and a card moved there is face up in the log', () => {
    const s = advanceToDecision({ ...table(), resolutionQueue: [{ kind: 'MoveCardEffect', cardInstanceId: 'new', toZoneId: 'a:pile' }] }, ctx).state;
    expect(pileZoneOf(s, 'a')?.cards.map((c) => c.instanceId)).toEqual(['new']);
    expect(s.log[0]).toMatchObject({ kind: 'CardMovedEvent', card: { instanceId: 'new' } });
  });
});

describe('ReplaceJudgmentEffect.oldTo', () => {
  it('sends the replaced card to the zone given instead of the discard pile', () => {
    const judgment: Judgment = { seatId: 'a', reader: { kind: 'card', card: { as: 'mark', colour: 'black', physical: [] } }, card: card('old') };
    const s = advanceToDecision({
      ...table(),
      resolutionQueue: [{ kind: 'ReplaceJudgmentEffect', judgment, withCardInstanceId: 'new', owner: { kind: 'general', seatId: 'a', slot: 'main', skillId: 'm' }, abilityId: 'm', oldTo: 'a:hand' }],
    }, ctx).state;
    expect(s.zones.find((z) => z.id === 'a:hand')!.cards.map((c) => c.instanceId)).toEqual(['old']);
    expect(s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(['new']);
  });
});
