import { redactStateForSeat } from './redact';
import { createSeat, createPlayer } from './factories';
import { GameState } from './types';

function makeState(): GameState {
  const maxHp = () => 4;
  const seatA = createSeat('seat-a', 0, 'Wei', 'general-x', 'general-y', maxHp);
  const seatB = createSeat('seat-b', 1, 'Shu', 'general-z', 'general-w', maxHp);
  return {
    seats: [seatA, seatB],
    players: [createPlayer('p1', 'seat-a', 'human'), createPlayer('p2', 'seat-b', 'bot')],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    zones: [],
    pendingResponse: null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null,
  };
}

describe('redactStateForSeat', () => {
  it('hides unrevealed generals from other seats but keeps them visible to the owner', () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const ownSeat = viewFromA.seats.find((s) => s.id === 'seat-a')!;
    expect(ownSeat.generals.main.generalDefinitionId).toBe('general-x');

    const otherSeat = viewFromA.seats.find((s) => s.id === 'seat-b')!;
    expect(otherSeat.generals.main.generalDefinitionId).toBe('hidden');
    expect(otherSeat.generals.deputy.generalDefinitionId).toBe('hidden');
  });

  it('reveals a general to everyone once revealed is true', () => {
    const state = makeState();
    state.seats[1].generals.main.revealed = true;
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const otherSeat = viewFromA.seats.find((s) => s.id === 'seat-b')!;
    expect(otherSeat.generals.main.generalDefinitionId).toBe('general-z');
    expect(otherSeat.generals.deputy.generalDefinitionId).toBe('hidden');
  });
});
