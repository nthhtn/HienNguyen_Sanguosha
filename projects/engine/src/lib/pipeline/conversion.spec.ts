import { advanceToDecision, resolve } from './resolve';
import { Action } from './actions';
import { createRng } from '../rng/rng';
import { getLegalActions } from '../rules/legality';
import { AbilityOwner, CardInstance, GameState, PendingResponse } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';

type UseConversion = Extract<Action, { kind: 'UseConversionAction' }>;
const b = { kind: 'seat' as const, seatId: 'b' };
// Bolt: played at seat b, deals it 1 damage; as an answer it does nothing itself.
const bolt: CardDefinition = {
  id: 'bolt', name: 'Bolt', category: 'basic',
  legalPlayTargets: (state) => ((state.turn.cardPlays?.['bolt'] ?? 0) < 1 ? [[b]] : []),
  play: (_s, ctx) => (ctx.respondingTo ? [] : [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: ctx.seatId }, target: ctx.targets[0], amount: 1, nature: 'normal' } }]),
};
// Spear: while worn, 2 hand cards may be used as a Bolt.
const spear: CardDefinition = {
  id: 'spear', name: 'Spear', category: 'equipment', equipSlot: 'weapon', play: () => [],
  abilities: { conversions: [{ id: 'spear', as: 'bolt', cards: 2, when: 'both' }] },
};
const filler: CardDefinition = { id: 'filler', name: 'Filler', category: 'basic', play: () => [] };
const registry: ContentRegistry = { cards: new Map([bolt, spear, filler].map((c) => [c.id, c])), generals: new Map() };
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, suit: CardInstance['suit'], definitionId = 'filler'): CardInstance => ({ instanceId, definitionId, suit, rank: 5 });
const owner: AbilityOwner = { kind: 'equipment', seatId: 'a', cardInstanceId: 'spear-1' };
const via = { owner, conversionId: 'spear' };

function table(hand: CardInstance[] = [card('h1', 'heart'), card('c1', 'club')], wearsSpear = true, pending: PendingResponse | null = null): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'none', revealed: true }, deputy: { generalDefinitionId: 'none', revealed: true } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: hand },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: wearsSpear ? [card('spear-1', 'spade', 'spear')] : [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: pending, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}
// A window for seat a that a Bolt answers; unanswered, a takes 1 damage; answered, a draws nothing and b takes 1.
const window: PendingResponse = {
  id: 'w1', respondingSeatId: 'a', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['bolt'],
  context: { effect: { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'a' }, amount: 1, nature: 'normal' } } },
  onAnswer: [{ kind: 'DamageEffect', damage: { source: null, target: b, amount: 1, nature: 'normal' } }],
};
const conversions = (s: GameState) => getLegalActions(s, 'a', registry).filter((x): x is UseConversion => x.kind === 'UseConversionAction');
const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;

describe('conversions in the Play Phase', () => {
  it('are offered once per legal target list of the card they make, with 2 hand cards and the card worn', () => {
    expect(conversions(table())).toEqual([{ kind: 'UseConversionAction', seatId: 'a', via, targets: [b] }]);
    expect(conversions(table([card('h1', 'heart')]))).toEqual([]);
    expect(conversions(table(undefined, false))).toEqual([]);
  });

  it('open a cancellable selection of exactly 2 hand cards', () => {
    const s = act(table(), conversions(table())[0]);
    expect(s.pendingSelection).toMatchObject({
      seatId: 'a', of: 'cards', eligibleIds: ['h1', 'c1'], min: 2, max: 2, onCancel: [],
      reason: { kind: 'ability', owner, abilityId: 'spear' },
    });
  });

  it('use the 2 cards as one card: no colour from red and black, both discarded, counted toward the limit', () => {
    const picking = act(table(), conversions(table())[0]);
    const s = act(picking, { kind: 'SelectAction', seatId: 'a', selectionId: picking.pendingSelection!.id, ids: ['h1', 'c1'] });
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({
      seatId: 'a', targets: [b],
      card: { as: 'bolt', colour: 'none', physical: [{ instanceId: 'h1' }, { instanceId: 'c1' }], via: { owner, abilityId: 'spear', conversionId: 'spear' } },
    });
    expect(s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(['h1', 'c1']);
    expect(hp(s, 'b')).toBe(3);
    expect(s.turn.cardPlays).toEqual({ bolt: 1 });
    expect(conversions(s)).toEqual([]); // the made card's own limit applies
  });

  it('an action that isn’t offered is refused', () => {
    expect(() => act(table(), { kind: 'UseConversionAction', seatId: 'a', via, targets: [{ kind: 'seat', seatId: 'a' }] })).toThrow('can’t use that conversion');
  });
});

describe('conversions answering a window', () => {
  const answering = () => advanceToDecision(table(undefined, true, window), ctx).state;

  it('are offered when the window allows the card they make', () => {
    expect(conversions(answering())).toEqual([{ kind: 'UseConversionAction', seatId: 'a', via, targets: [], pendingResponseId: 'w1' }]);
    expect(conversions(advanceToDecision(table(undefined, true, { ...window, allowedCardIds: ['peach'] }), ctx).state)).toEqual([]);
  });

  it('answer with the 2 cards: the window’s answer goes ahead, uncounted', () => {
    const picking = act(answering(), conversions(answering())[0]);
    expect(picking.pendingResponse?.id).toBe('w1'); // still open under the selection
    const s = act(picking, { kind: 'SelectAction', seatId: 'a', selectionId: picking.pendingSelection!.id, ids: ['h1', 'c1'] });
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'a')).toBe(4);
    expect(hp(s, 'b')).toBe(3);
    expect(s.turn.cardPlays?.['bolt'] ?? 0).toBe(0);
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ seatId: 'a', inResponseTo: {} });
  });

  it('cancelled, the window is still open and answerable (Review Focus 3)', () => {
    const picking = act(answering(), conversions(answering())[0]);
    const s = act(picking, { kind: 'CancelSelectionAction', seatId: 'a', selectionId: picking.pendingSelection!.id });
    expect(s.pendingSelection).toBeUndefined();
    expect(s.pendingResponse?.id).toBe('w1');
    expect(getLegalActions(s, 'a', registry).map((x) => x.kind)).toEqual(['PassAction', 'UseConversionAction']);
  });
});
