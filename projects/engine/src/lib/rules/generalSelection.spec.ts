import { getLegalActions } from './legality';
import { resolve, EngineContext } from '../pipeline/resolve';
import { redactStateForSeat } from '../domain/redact';
import { ContentRegistry, GameModeDefinition, GeneralDefinition } from '../registry/types';
import { GameResult, GameState, Kingdom, Seat } from '../domain/types';
import { Action } from '../pipeline/actions';
import { createRng } from '../rng/rng';

function general(id: string, kingdom: Kingdom, maxHp: number): [string, GeneralDefinition] {
  return [id, { id, kingdom, maxHp, skills: [] }];
}

const registry: ContentRegistry = {
  cards: new Map(),
  generals: new Map([
    general('w1', 'Wei', 4), general('w2', 'Wei', 3), general('s1', 'Shu', 4), general('s2', 'Shu', 4),
    general('q1', 'Qun', 5), general('w3', 'Wei', 4), general('u1', 'Wu', 3), general('u2', 'Wu', 4),
    general('s3', 'Shu', 3), general('q2', 'Qun', 4),
  ]),
};

function unchosenSeat(id: string, index: number): Seat {
  return {
    id, index, kingdom: 'hidden', generals: null, combinedHp: 0, maxCombinedHp: 0,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated: false,
  };
}

function selectingState(): GameState {
  return {
    seats: [unchosenSeat('seat-a', 0), unchosenSeat('seat-b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'GeneralSelection',
    zones: [],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
    generalSelection: {
      candidates: { 'seat-a': ['w1', 's1', 'w2', 's2', 'q1'], 'seat-b': ['w3', 'u1', 'u2', 's3', 'q2'] },
    },
  };
}

function mode(checkWinCondition: (s: GameState) => GameResult | null = () => null): GameModeDefinition {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition, triggers: [] };
}

const ctx: EngineContext = { registry, mode: mode() };
const choose = (seatId: string, mainId: string, deputyId: string): Action => ({ kind: 'ChooseGeneralsAction', seatId, mainId, deputyId });

describe('getLegalActions during GeneralSelection', () => {
  it('offers every ordered same-kingdom pair of the active seat, main-major in candidate order', () => {
    expect(getLegalActions(selectingState(), 'seat-a', registry)).toEqual([
      choose('seat-a', 'w1', 'w2'),
      choose('seat-a', 's1', 's2'),
      choose('seat-a', 'w2', 'w1'),
      choose('seat-a', 's2', 's1'),
    ]);
  });

  it('offers nothing to a seat that is not the active chooser', () => {
    expect(getLegalActions(selectingState(), 'seat-b', registry)).toEqual([]);
  });

  it('requires the registry during GeneralSelection', () => {
    expect(() => getLegalActions(selectingState(), 'seat-a')).toThrow(/registry/);
  });
});

describe('resolving ChooseGeneralsAction', () => {
  it('seats the chosen pair unrevealed, derives kingdom and HP, and removes the candidates', () => {
    const { state } = resolve(selectingState(), choose('seat-a', 'w2', 'w1'), ctx);
    const seatA = state.seats[0];
    expect(seatA.generals).toEqual({
      main: { generalDefinitionId: 'w2', revealed: false },
      deputy: { generalDefinitionId: 'w1', revealed: false },
    });
    expect(seatA.kingdom).toBe('Wei');
    expect(seatA.combinedHp).toBe(7);
    expect(seatA.maxCombinedHp).toBe(7);
    expect(state.generalSelection).toEqual({ candidates: { 'seat-b': ['w3', 'u1', 'u2', 's3', 'q2'] } });
    expect(state.phase).toBe('GeneralSelection');
  });

  it('logs a GeneralsChosenEvent that names no general', () => {
    const { state } = resolve(selectingState(), choose('seat-a', 'w1', 'w2'), ctx);
    const event = state.log[state.log.length - 1];
    expect(event).toEqual({ kind: 'GeneralsChosenEvent', seatId: 'seat-a' });
  });

  it('starts turn 1 at Judgment once the last seat has chosen', () => {
    const afterA = resolve(selectingState(), choose('seat-a', 'w1', 'w2'), ctx).state;
    const { state } = resolve(afterA, choose('seat-b', 'u1', 'u2'), ctx);
    expect(state.phase).toBe('Judgment');
    expect(state.generalSelection).toBeNull();
    expect(state.turn).toEqual({ turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] });
    expect(state.seats.map((s) => s.kingdom)).toEqual(['Wei', 'Wu']);
  });

  it('does not evaluate the win condition until selection has finished', () => {
    const alwaysWins = mode(() => ({ endedAt: 1, winningSeatIds: [], losingSeatIds: [] }));
    const winCtx: EngineContext = { registry, mode: alwaysWins };
    const afterA = resolve(selectingState(), choose('seat-a', 'w1', 'w2'), winCtx).state;
    expect(afterA.result).toBeNull();
    const afterB = resolve(afterA, choose('seat-b', 'u1', 'u2'), winCtx).state;
    expect(afterB.result).not.toBeNull();
  });

  it.each([
    ['a seat that is not the active chooser', choose('seat-b', 'u1', 'u2'), /not seat seat-b's turn/],
    ['a general that is not one of the seat’s candidates', choose('seat-a', 'w1', 'w3'), /not a candidate/],
    ['the same general twice', choose('seat-a', 'w1', 'w1'), /different generals/],
    ['a cross-kingdom pair', choose('seat-a', 'w1', 's1'), /do not share a kingdom/],
  ])('rejects %s', (_label, action, message) => {
    expect(() => resolve(selectingState(), action, ctx)).toThrow(message);
  });

  it('rejects any other action kind during GeneralSelection', () => {
    expect(() => resolve(selectingState(), { kind: 'EndPhaseAction', seatId: 'seat-a' }, ctx)).toThrow(
      /not legal during general selection/
    );
  });

  it('rejects ChooseGeneralsAction after selection has finished', () => {
    const afterA = resolve(selectingState(), choose('seat-a', 'w1', 'w2'), ctx).state;
    const done = resolve(afterA, choose('seat-b', 'u1', 'u2'), ctx).state;
    expect(() => resolve(done, choose('seat-a', 'w1', 'w2'), ctx)).toThrow(/only be chosen during the GeneralSelection phase/);
  });
});

describe('redactStateForSeat during GeneralSelection', () => {
  it("hides other seats' candidates but keeps their count, and keeps the viewer's own", () => {
    const redacted = redactStateForSeat(selectingState(), 'seat-a');
    expect(redacted.generalSelection!.candidates['seat-a']).toEqual(['w1', 's1', 'w2', 's2', 'q1']);
    expect(redacted.generalSelection!.candidates['seat-b']).toEqual(['hidden', 'hidden', 'hidden', 'hidden', 'hidden']);
  });

  it('leaves a null generalSelection as null', () => {
    const done = { ...selectingState(), phase: 'Judgment' as const, generalSelection: null };
    expect(redactStateForSeat(done, 'seat-a').generalSelection).toBeNull();
  });
});
