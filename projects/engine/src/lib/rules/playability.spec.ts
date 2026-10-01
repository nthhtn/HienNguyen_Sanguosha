import { getLegalActions } from './legality';
import { resolve } from '../pipeline/resolve';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { GameState, Phase, Seat, Target } from '../domain/types';
import { createRng } from '../rng/rng';

const seatT = (seatId: string): Target => ({ kind: 'seat', seatId });

// 'aim' may target seat-b only; 'self' is untargeted; 'never' is not playable.
const aim: CardDefinition = { id: 'aim', name: 'Aim', category: 'basic', play: () => [], legalPlayTargets: () => [[seatT('seat-b')]] };
const self: CardDefinition = { id: 'self', name: 'Self', category: 'basic', play: () => [], legalPlayTargets: () => [[]] };
const never: CardDefinition = { id: 'never', name: 'Never', category: 'basic', play: () => [], legalPlayTargets: () => [] };
const legacy: CardDefinition = { id: 'legacy', name: 'Legacy', category: 'basic', play: () => [] };
const registry: ContentRegistry = { cards: new Map([aim, self, never, legacy].map((c) => [c.id, c])), generals: new Map() };
const mode: GameModeDefinition = { id: 'm', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };

function seat(id: string, index: number): Seat {
  return {
    id, index, kingdom: 'Wei', combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
  };
}

function state(phase: Phase, hand: string[]): GameState {
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1), seat('seat-c', 2)],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase,
    zones: [
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: hand.map((d) => ({ instanceId: `${d}-1`, definitionId: d, suit: 'spade' as const, rank: 1 })) },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const plays = (s: GameState) => getLegalActions(s, 'seat-a', registry).filter((a) => a.kind === 'PlayCardAction');

describe('card playability', () => {
  it('offers exactly the target lists the card returns', () => {
    expect(plays(state('Play', ['aim']))).toEqual([{ kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'aim-1', targets: [seatT('seat-b')] }]);
    expect(plays(state('Play', ['self']))).toEqual([{ kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'self-1', targets: [] }]);
    expect(plays(state('Play', ['never']))).toEqual([]);
  });

  it('keeps legacy offers for a card without a hook, and for callers without a registry', () => {
    expect(plays(state('Play', ['legacy']))).toHaveLength(3); // untargeted + seat-b + seat-c
    expect(getLegalActions(state('Play', ['aim']), 'seat-a').filter((a) => a.kind === 'PlayCardAction')).toHaveLength(3);
  });

  it('offers no card plays outside the Play phase, but still End phase (Review Focus 4)', () => {
    for (const phase of ['Judgment', 'Draw', 'Discard', 'End'] as const) {
      const legal = getLegalActions(state(phase, ['self', 'aim']), 'seat-a', registry);
      expect(legal).toEqual([{ kind: 'EndPhaseAction', seatId: 'seat-a' }]);
    }
  });

  it('rejects a card play outside the Play phase', () => {
    expect(() =>
      resolve(state('Draw', ['self']), { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'self-1', targets: [] }, { registry, mode })
    ).toThrow('Cards can only be played during your Play phase');
  });

  it('rejects a target list the card does not allow', () => {
    expect(() =>
      resolve(state('Play', ['aim']), { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'aim-1', targets: [seatT('seat-c')] }, { registry, mode })
    ).toThrow('Card aim cannot be played with those targets');
  });

  it('counts proactive plays per definition this turn', () => {
    const once = resolve(state('Play', ['self', 'self']), { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'self-1', targets: [] }, { registry, mode }).state;
    expect(once.turn.cardPlays).toEqual({ self: 1 });
  });

  it('starts a new turn with no play counts', () => {
    const s = { ...state('End', []), turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], cardPlays: { self: 2 } } };
    const next = resolve(s, { kind: 'EndPhaseAction', seatId: 'seat-a' }, { registry, mode }).state;
    expect(next.turn.turnNumber).toBe(2);
    expect(next.turn.cardPlays).toBeUndefined();
  });

  it('does not count a card played as a response (Review Focus 1)', () => {
    const s: GameState = {
      ...state('Play', []),
      turn: { turnNumber: 1, ownerSeatId: 'seat-b', extraTurnStack: [], cardPlays: { self: 1 } },
      pendingResponse: {
        id: 'r1', respondingSeatId: 'seat-a', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['self'],
        context: { effect: { kind: 'HealEffect', target: seatT('seat-a'), amount: 1 } },
      },
    };
    const withCard = { ...s, zones: state('Play', ['self']).zones };
    const next = resolve(withCard, { kind: 'RespondAction', seatId: 'seat-a', pendingResponseId: 'r1', cardInstanceId: 'self-1' }, { registry, mode }).state;
    expect(next.turn.cardPlays).toEqual({ self: 1 });
  });
});
