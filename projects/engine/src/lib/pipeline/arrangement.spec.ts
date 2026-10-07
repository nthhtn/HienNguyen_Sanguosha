import { advanceToDecision, resolve } from './resolve';
import { Action } from './actions';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, PendingArrangement } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { getActiveSeatId } from '../rules/activeSeat';
import { getLegalActions } from '../rules/legality';
import { validateArrangement } from '../rules/arrangement';
import { redactStateForSeat } from '../domain/redact';

const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };
const card = (instanceId: string, definitionId = 'filler'): CardInstance => ({ instanceId, definitionId, suit: 'heart', rank: 7 });
const owner = { kind: 'general' as const, seatId: 'a', slot: 'main' as const, skillId: 'astrology' };
const arrangement: PendingArrangement = { id: 'arr-1', seatId: 'a', reason: { kind: 'ability', owner, abilityId: 'astrology' }, cardInstanceIds: ['t1', 't2', 't3'] };

// The draw pile is t1 t2 t3 (the top three, being arranged) then r1 r2.
function opened(): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Shu' as const, combinedHp: 3, maxCombinedHp: 3, eliminated: false, generals: null,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const s: GameState = {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('t1', 'peach'), card('t2', 'duel'), card('t3', 'sha'), card('r1'), card('r2')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, resolutionQueue: [{ kind: 'OpenArrangementEffect', arrangement }, { kind: 'DrawCardsEffect', seatId: 'b', count: 1 }],
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
  return advanceToDecision(s, ctx).state;
}
const arrange = (top: string[], bottom: string[], seatId = 'a'): Extract<Action, { kind: 'ArrangeCardsAction' }> => ({ kind: 'ArrangeCardsAction', seatId, arrangementId: 'arr-1', top, bottom });
const pile = (s: GameState) => s.zones.find((z) => z.id === 'drawPile')!.cards.map((c) => c.instanceId);

describe('arranging the draw pile', () => {
  it('pauses the queue for the arranging seat, who is offered a template', () => {
    const s = opened();
    expect(s.pendingArrangement).toEqual(arrangement);
    expect(getActiveSeatId(s)).toBe('a');
    expect(getLegalActions(s, 'a', registry)).toEqual([arrange([], [])]);
    expect(getLegalActions(s, 'b', registry)).toEqual([]);
    expect(() => resolve(s, { kind: 'EndPhaseAction', seatId: 'a' }, ctx)).toThrow('not legal while an arrangement is pending');
  });

  it('validates: the arranger, every card placed once, no others', () => {
    const s = opened();
    expect(validateArrangement(s, arrange(['t1'], ['t2', 't3']))).toBeNull();
    expect(validateArrangement(s, arrange(['t1'], ['t2', 't3'], 'b'))).toMatch('not the arranger');
    expect(validateArrangement(s, arrange(['t1', 't1'], ['t2']))).toMatch('twice');
    expect(validateArrangement(s, arrange(['t1', 'r1'], ['t2', 't3']))).toMatch('not one of the cards');
    expect(validateArrangement(s, arrange(['t1'], ['t2']))).toMatch('Place all 3 cards');
    expect(() => resolve(s, arrange([], []), ctx)).toThrow('Place all 3 cards');
  });

  it('puts `top` on top in order and `bottom` under the pile in order, logs the counts, then the queue goes on', () => {
    const next = resolve(opened(), arrange(['t3', 't1'], ['t2']), ctx).state;
    expect(next.pendingArrangement).toBeUndefined();
    // Seat b's queued draw then takes the new top card.
    expect(next.zones.find((z) => z.id === 'b:hand')!.cards.map((c) => c.instanceId)).toEqual(['t3']);
    expect(pile(next)).toEqual(['t1', 'r1', 'r2', 't2']);
    expect(next.log[0]).toEqual({ kind: 'ArrangementMadeEvent', seatId: 'a', reason: arrangement.reason, top: 2, bottom: 1 });
  });

  it('only the arranging seat sees the cards; a paused arrangement survives a JSON round trip (Review Focus 5)', () => {
    const s = opened();
    const faces = (viewer: string) => redactStateForSeat(s, viewer).zones.find((z) => z.id === 'drawPile')!.cards.map((c) => c.definitionId);
    expect(faces('a')).toEqual(['peach', 'duel', 'sha', 'hidden', 'hidden']);
    expect(faces('b')).toEqual(['hidden', 'hidden', 'hidden', 'hidden', 'hidden']);
    expect(getLegalActions(redactStateForSeat(s, 'a'), 'a', registry)).toEqual([arrange([], [])]);
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(resolve(copy, arrange(['t1', 't2', 't3'], []), ctx).state).toEqual(resolve(s, arrange(['t1', 't2', 't3'], []), ctx).state);
  });
});
