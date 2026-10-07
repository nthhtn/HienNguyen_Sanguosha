import { advanceToDecision } from './resolve';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { GameState } from '../domain/types';
import { endFlagOf, phaseWaitsForPlayer } from '../rules/phaseSequence';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const ctx = { registry, mode };

// Seats a–d; `faceDown` seats start face down; a's End Phase.
function table(faceDown: string[] = []): GameState {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: 'Wei' as const, eliminated: false, generals: null, combinedHp: 4, maxCombinedHp: 4,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
      ...(faceDown.includes(id) ? { faceDown: true as const } : {}),
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'End',
    zones: [{ id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [{ id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] }, { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] }, { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] }])],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('a face-down seat', () => {
  it('turns face up instead of taking its turn; the next seat plays', () => {
    const s = advanceToDecision(table(['b']), ctx).state;
    expect(s.turn.ownerSeatId).toBe('c');
    expect(s.phase).toBe('Play');
    expect(s.seats[1].faceDown).toBeUndefined();
    expect(s.log).toContainEqual({ kind: 'SeatTurnedEvent', seatId: 'b', faceDown: false, passedTurn: true });
    expect(s.log.some((e) => e.kind === 'PhaseChangedEvent' && e.seatId === 'b')).toBe(false);
  });

  it('two in a row both turn face up, and the third seat plays', () => {
    const s = advanceToDecision(table(['b', 'c']), ctx).state;
    expect(s.turn.ownerSeatId).toBe('d');
    expect(s.seats.every((x) => !x.faceDown)).toBe(true);
  });

  it('TurnFaceDownEffect turns a seat face down, once', () => {
    const s = advanceToDecision({ ...table(), phase: 'Play', resolutionQueue: [{ kind: 'TurnFaceDownEffect', seatId: 'a' }, { kind: 'TurnFaceDownEffect', seatId: 'a' }] }, ctx).state;
    expect(s.seats[0].faceDown).toBe(true);
    expect(s.log.filter((e) => e.kind === 'SeatTurnedEvent')).toEqual([{ kind: 'SeatTurnedEvent', seatId: 'a', faceDown: true }]);
  });
});

describe('a Play Phase flagged to end while it runs', () => {
  it('no longer waits for the player', () => {
    const s = { ...table(), phase: 'Play' as const };
    expect(phaseWaitsForPlayer(s)).toBe(true);
    expect(phaseWaitsForPlayer({ ...s, turn: { ...s.turn, flags: { [endFlagOf('Play')]: true } } })).toBe(false);
  });
});
