import { advanceToDecision, resolve } from './resolve';
import { Effect } from './effects';
import { Action } from './actions';
import { createRng } from '../rng/rng';
import { usedCardOf } from '../domain/usedCard';
import { redactStateForSeat } from '../domain/redact';
import { getActiveSeatId } from '../rules/activeSeat';
import { getLegalActions } from '../rules/legality';
import { validateSelection } from '../rules/selection';
import { CardInstance, GameState, PendingSelection } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, PlayContext } from '../registry/types';

const seen: PlayContext[] = [];
const stepsSeen: unknown[] = [];
// Bolt: played, its user draws 1 (and records how it was played). Its 'count'
// step draws its user one card per picked id.
const bolt: CardDefinition = {
  id: 'bolt', name: 'Bolt', category: 'basic',
  play: (_s, ctx) => { seen.push(ctx); return [{ kind: 'DrawCardsEffect', seatId: ctx.seatId, count: 1 }]; },
  onStep: (_s, step) => {
    stepsSeen.push(step.data);
    return [{ kind: 'DrawCardsEffect', seatId: step.userSeatId, count: (step.data?.['picked'] as string[]).length }];
  },
};
const registry: ContentRegistry = { cards: new Map([[bolt.id, bolt], ['filler', { id: 'filler', name: 'Filler', category: 'basic', play: () => [] }]]), generals: new Map() };
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId = 'filler'): CardInstance => ({ instanceId, definitionId, suit: 'club', rank: 5 });
const afterwards: Effect = { kind: 'DrawCardsEffect', seatId: 'b', count: 1 };

const selection = (over: Partial<PendingSelection> = {}): PendingSelection => ({
  id: 'sel-1', seatId: 'a',
  reason: { kind: 'ability', owner: { kind: 'equipment', seatId: 'a', cardInstanceId: 'x' }, abilityId: 'x' },
  of: 'cards', eligibleIds: ['k1', 'k2', 'bolt-1'], min: 2, max: 2, then: { kind: 'discard' }, ...over,
});

// Seat a holds k1, k2 and a Bolt; the queue opens `sel`, then seat b draws 1.
function opened(sel: PendingSelection = selection()): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'none', revealed: true }, deputy: { generalDefinitionId: 'none', revealed: true } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const s: GameState = {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('k1'), card('k2'), card('bolt-1', 'bolt')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, resolutionQueue: [{ kind: 'OpenSelectionEffect', selection: sel }, afterwards],
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
  return advanceToDecision(s, ctx).state;
}
const select = (s: GameState, ids: string[]) => resolve(s, { kind: 'SelectAction', seatId: 'a', selectionId: 'sel-1', ids }, ctx).state;
const cardsIn = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);

describe('selections', () => {
  it('pause the queue for the selecting seat, who is offered a template and Cancel', () => {
    const s = opened(selection({ onCancel: [] }));
    expect(s.pendingSelection).toMatchObject({ id: 'sel-1' });
    expect(s.resolutionQueue).toEqual([afterwards]);
    expect(getActiveSeatId(s)).toBe('a');
    expect(getLegalActions(s, 'a', registry)).toEqual([
      { kind: 'SelectAction', seatId: 'a', selectionId: 'sel-1', ids: [] },
      { kind: 'CancelSelectionAction', seatId: 'a', selectionId: 'sel-1' },
    ]);
    expect(getLegalActions(s, 'b', registry)).toEqual([]);
    expect(() => resolve(s, { kind: 'EndPhaseAction', seatId: 'a' }, ctx)).toThrow('not legal while a selection is pending');
  });

  it('validates the picks: the selector, eligible ids, no repeats, between min and max', () => {
    const s = opened();
    const pick = (ids: string[], seatId = 'a'): Extract<Action, { kind: 'SelectAction' }> => ({ kind: 'SelectAction', seatId, selectionId: 'sel-1', ids });
    expect(validateSelection(s, pick(['k1', 'k2']))).toBeNull();
    expect(validateSelection(s, pick(['k1', 'k2'], 'b'))).toMatch('not the selector');
    expect(validateSelection(s, pick(['k1', 'd1']))).toMatch('can’t be picked');
    expect(validateSelection(s, pick(['k1', 'k1']))).toMatch('twice');
    expect(validateSelection(s, pick(['k1']))).toMatch('between 2 and 2');
    expect(() => select(s, ['k1'])).toThrow('between 2 and 2');
  });

  it('discard: the picks go to the discard pile, then `then`, then the rest of the queue', () => {
    const next = select(opened(selection({ then: { kind: 'discard', then: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }] } })), ['k1', 'k2']);
    expect(cardsIn(next, 'discardPile')).toEqual(['k1', 'k2']);
    expect(cardsIn(next, 'a:hand')).toEqual(['bolt-1', 'd1']);
    expect(cardsIn(next, 'b:hand')).toEqual(['d2']);
    expect(next.log[0]).toEqual({ kind: 'SelectionMadeEvent', seatId: 'a', reason: selection().reason, of: 'cards', ids: ['k1', 'k2'] });
  });

  it('card-step: the step goes ahead with the picks added to its data as `picked`', () => {
    const step: Extract<Effect, { kind: 'CardStepEffect' }> = {
      kind: 'CardStepEffect', step: 'count', card: usedCardOf(card('bolt-1', 'bolt')), userSeatId: 'a', target: { kind: 'seat', seatId: 'b' }, data: { extra: 1 },
    };
    const next = select(opened(selection({ of: 'seats', eligibleIds: ['a', 'b'], min: 1, max: 2, then: { kind: 'card-step', step } })), ['a', 'b']);
    // Bolt's 'count' step draws its user one card per picked seat.
    expect(stepsSeen).toEqual([{ extra: 1, picked: ['a', 'b'] }]);
    expect(cardsIn(next, 'a:hand')).toEqual(['k1', 'k2', 'bolt-1', 'd1', 'd2']);
  });

  it('use-card: the picked card is played at the targets, uncounted and free, then the rest of the queue', () => {
    seen.length = 0;
    const next = select(opened(selection({ eligibleIds: ['bolt-1'], min: 1, max: 1, then: { kind: 'use-card', targets: [{ kind: 'seat', seatId: 'b' }], counted: false, free: true } })), ['bolt-1']);
    expect(next.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ seatId: 'a', card: { as: 'bolt', physical: [{ instanceId: 'bolt-1' }] }, targets: [{ kind: 'seat', seatId: 'b' }] });
    expect(seen[0]).toMatchObject({ seatId: 'a', free: true, targets: [{ kind: 'seat', seatId: 'b' }] });
    expect(cardsIn(next, 'discardPile')).toEqual(['bolt-1']);
    expect(next.turn.cardPlays?.['bolt'] ?? 0).toBe(0);
  });

  it('Cancel queues onCancel; a selection without one can’t be cancelled', () => {
    const cancel = (s: GameState) => resolve(s, { kind: 'CancelSelectionAction', seatId: 'a', selectionId: 'sel-1' }, ctx).state;
    const next = cancel(opened(selection({ onCancel: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }] })));
    expect(next.pendingSelection).toBeUndefined();
    expect(cardsIn(next, 'a:hand')).toEqual(['k1', 'k2', 'bolt-1', 'd1']);
    expect(() => cancel(opened())).toThrow('can’t be cancelled');
  });

  it('a paused selection survives a JSON round trip, and the selector’s redacted view still offers it (Review Focus 5)', () => {
    const s = opened();
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(select(copy, ['k1', 'k2'])).toEqual(select(s, ['k1', 'k2']));
    expect(redactStateForSeat(s, 'a').pendingSelection).toEqual(s.pendingSelection);
    expect(getLegalActions(redactStateForSeat(s, 'a'), 'a', registry)[0]).toMatchObject({ kind: 'SelectAction' });
  });

  it('give: after the cards are picked, the seat picks who gets them; they go to that hand, then `then`', () => {
    const s = select(opened(selection({ then: { kind: 'give', toSeatIds: ['b'], then: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }] } })), ['k1', 'k2']);
    expect(s.pendingChoice).toMatchObject({ seatId: 'a', verb: 'give', reason: selection().reason, options: [{ id: 'b', shows: { kind: 'seat', seatId: 'b' } }] });
    const given = resolve(s, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: s.pendingChoice!.id, optionId: 'b' }, ctx).state;
    expect(cardsIn(given, 'b:hand')).toEqual(['k1', 'k2', 'd2']);
    expect(cardsIn(given, 'a:hand')).toEqual(['bolt-1', 'd1']);
  });
});

describe('onSelect opens no decision (S3)', () => {
  it('throws when an onSelect effect opens a decision', () => {
    const s = opened(selection({ onSelect: [{ kind: 'OpenSelectionEffect', selection: selection({ id: 'sel-2' }) }] }));
    expect(() => select(s, ['k1', 'k2'])).toThrow('opened a decision');
  });

  it('does not throw when an onSelect reveal follow-up is only queued', () => {
    // A reveal whose after-trigger queues an ask: the ask opens later, from the queue.
    const owner = { kind: 'equipment' as const, seatId: 'a', cardInstanceId: 'x' };
    const askOnReveal: GameModeDefinition = {
      ...mode,
      triggers: [{ point: 'after:GeneralRevealedEvent', condition: () => true, effect: () => [{ kind: 'AskUseEffect', owner, abilityId: 'x', effects: [] }] }],
    };
    const base = opened(selection({ onSelect: [{ kind: 'RevealGeneralEffect', seatId: 'a', slot: 'main' }] }));
    const hidden: GameState = { ...base, seats: base.seats.map((s) => (s.id === 'a' ? { ...s, generals: { ...s.generals!, main: { ...s.generals!.main, revealed: false } } } : s)) };
    const next = resolve(hidden, { kind: 'SelectAction', seatId: 'a', selectionId: 'sel-1', ids: ['k1', 'k2'] }, { registry, mode: askOnReveal }).state;
    expect(next.seats[0].generals!.main.revealed).toBe(true);
    expect(next.pendingChoice).toMatchObject({ seatId: 'a', verb: 'use' });
  });
});
