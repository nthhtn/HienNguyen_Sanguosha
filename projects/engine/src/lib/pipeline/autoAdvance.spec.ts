import { resolve, advanceToDecision } from './resolve';
import { getLegalActions } from '../rules/legality';
import { createRng } from '../rng/rng';
import { CardInstance, GameResult, GameState, Phase } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { EngineEvent, PhaseChangedEvent } from './events';

const selfDestruct: CardDefinition = {
  id: 'self-destruct', name: 'Self Destruct', category: 'basic',
  legalPlayTargets: () => [[]],
  play: (_state, ctx) => [{ kind: 'EliminateSeatEffect', seatId: ctx.seatId }],
};
const registry: ContentRegistry = { cards: new Map([['self-destruct', selfDestruct]]), generals: new Map() };

// Like Kingdom War: whoever enters Draw draws 2.
function mode(checkWinCondition: (s: GameState) => GameResult | null = () => null): GameModeDefinition {
  return {
    id: 'stub',
    setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
    checkWinCondition,
    triggers: [{
      point: 'after:PhaseChangedEvent',
      condition: (_s, subject) => (subject as PhaseChangedEvent).phase === 'Draw',
      effect: (_s, subject) => [{ kind: 'DrawCardsEffect', seatId: (subject as PhaseChangedEvent).seatId, count: 2 }],
    }],
  };
}
const ctx = { registry, mode: mode() };

const card = (instanceId: string, definitionId = 'sha'): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 1 });

// Three seats at HP 4; seat-a owns turn 1. The draw pile holds 20 cards.
function state(phase: Phase, handA: CardInstance[] = []): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp: 4, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated: false,
  });
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1), seat('seat-c', 2)],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase,
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: Array.from({ length: 20 }, (_, i) => card(`d${i}`)) },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...['seat-a', 'seat-b', 'seat-c'].flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: id === 'seat-a' ? handA : [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const phasesOf = (events: EngineEvent[] | { kind: string }[]) =>
  (events as EngineEvent[]).flatMap((e) =>
    e.kind === 'PhaseChangedEvent' ? [`${e.seatId}:${e.phase}`] : e.kind === 'TurnAdvancedEvent' ? [`turn ${e.turnNumber}`] : []
  );
const handOf = (s: GameState, seatId: string) => s.zones.find((z) => z.id === `${seatId}:hand`)!.cards;
const endPhase = { kind: 'EndPhaseAction' as const, seatId: 'seat-a' };

describe('advanceToDecision', () => {
  it('passes Start, Judgment and Draw on its own and rests in Play after drawing 2', () => {
    const { state: next, events } = advanceToDecision(state('Start'), ctx);
    expect(next.phase).toBe('Play');
    expect(next.turn.ownerSeatId).toBe('seat-a');
    expect(phasesOf(events)).toEqual(['seat-a:Judgment', 'seat-a:Draw', 'seat-a:Play']);
    expect(handOf(next, 'seat-a')).toHaveLength(2);
  });

  it('leaves a state that already waits untouched', () => {
    const resting = state('Play');
    expect(advanceToDecision(resting, ctx)).toEqual({ state: resting, events: [] });
  });

  it('stops at once when a phase trigger ends the game (Review Focus 4)', () => {
    const result: GameResult = { endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: [] };
    const winsOnDraw = mode((s) => (s.phase === 'Draw' ? result : null));
    const { state: next } = advanceToDecision(state('Start'), { registry, mode: winsOnDraw });
    expect(next.phase).toBe('Draw');
    expect(next.result).toEqual(result);
  });

  it('fails loudly when every seat is eliminated and the mode names no winner', () => {
    const s = state('Play');
    const allOut = { ...s, seats: s.seats.map((seat) => ({ ...seat, eliminated: true })) };
    expect(() => advanceToDecision(allOut, ctx)).toThrow('every seat is eliminated');
  });
});

describe('resolve with auto-advance', () => {
  it('ends Play within the hand limit and rests in the next seat’s Play, entering every phase on the way', () => {
    const { state: next, events } = resolve(state('Play', [card('a1')]), endPhase, ctx);
    expect(next.turn).toEqual({ turnNumber: 2, ownerSeatId: 'seat-b', extraTurnStack: [] });
    expect(next.phase).toBe('Play');
    expect(phasesOf(events)).toEqual([
      'seat-a:Discard', 'seat-a:End', 'turn 2', 'seat-b:Start', 'seat-b:Judgment', 'seat-b:Draw', 'seat-b:Play',
    ]);
  });

  it('rests in Discard when over the hand limit, then moves on once the seat has discarded down to it', () => {
    const hand = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((id) => card(id));
    const atDiscard = resolve(state('Play', hand), endPhase, ctx).state;
    expect(atDiscard.phase).toBe('Discard');
    expect(getLegalActions(atDiscard, 'seat-a', registry).map((a) => a.kind)).toEqual(Array(6).fill('DiscardCardAction'));

    const once = resolve(atDiscard, { kind: 'DiscardCardAction', seatId: 'seat-a', cardInstanceId: 'a1' }, ctx).state;
    expect(once.phase).toBe('Discard');
    const twice = resolve(once, { kind: 'DiscardCardAction', seatId: 'seat-a', cardInstanceId: 'a2' }, ctx).state;
    expect(handOf(twice, 'seat-a')).toHaveLength(4);
    expect(twice.turn.ownerSeatId).toBe('seat-b');
    expect(twice.phase).toBe('Play');
  });

  it('accepts End phase only in the Play phase', () => {
    for (const phase of ['Start', 'Judgment', 'Draw', 'Discard', 'End'] as const) {
      expect(() => resolve(state(phase), endPhase, ctx)).toThrow('EndPhaseAction is only legal in the Play phase');
    }
  });

  it('offers End phase only in Play, and nothing at all in a phase that passes on its own', () => {
    expect(getLegalActions(state('Play'), 'seat-a', registry)).toContainEqual(endPhase);
    for (const phase of ['Start', 'Judgment', 'Draw', 'Discard', 'End'] as const) {
      expect(getLegalActions(state(phase), 'seat-a', registry)).toEqual([]);
    }
  });

  it('skips the rest of the turn when the owner is eliminated by their own play (Review Focus 1)', () => {
    const { state: next, events } = resolve(
      state('Play', [card('boom', 'self-destruct')]),
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'boom', targets: [] },
      ctx
    );
    expect(next.seats.find((s) => s.id === 'seat-a')!.eliminated).toBe(true);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
    expect(phasesOf(events)).not.toContain('seat-a:Discard');
    expect(phasesOf(events)).not.toContain('seat-a:End');
  });

  it('fails loudly when the step bound is exceeded by a long stack of eliminated extra-turn seats', () => {
    const base = state('Play');
    const stuck: GameState = {
      ...base,
      seats: base.seats.map((s) => (s.id === 'seat-b' ? { ...s, eliminated: true } : s.id === 'seat-a' ? { ...s, eliminated: true } : s)),
      turn: { ...base.turn, extraTurnStack: Array.from({ length: 40 }, () => 'seat-b') },
    };
    expect(() => advanceToDecision(stuck, ctx)).toThrow(/Phases advanced \d+ times without reaching a player decision/);
  });
});
