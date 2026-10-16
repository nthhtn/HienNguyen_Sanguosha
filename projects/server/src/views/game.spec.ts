import { createPlayer, createSeat } from 'engine';
import type { EngineEvent, GameState } from 'engine';
import { toGameUpdate } from './game';

const owner = { kind: 'general' as const, seatId: 'seat-b', slot: 'main' as const, skillId: 'refusing-death' };

function stateWithHiddenSkillEvent(): GameState {
  const seats = [createSeat('seat-a', 0, 'Wei', 'general-x', 'general-y', () => 4), createSeat('seat-b', 1, 'Shu', 'general-z', 'general-w', () => 4)];
  const event = { kind: 'ChoiceMadeEvent', seatId: 'seat-b', reason: { kind: 'ability', owner, abilityId: 'refusing-death' }, verb: 'use', shows: 'none' } as unknown as EngineEvent;
  return {
    seats,
    players: [createPlayer('p1', 'seat-a', 'human', 'P1'), createPlayer('p2', 'seat-b', 'bot', 'P2')],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [],
    pendingResponse: null,
    log: [event],
    rng: { seed: 1, counter: 0 },
    result: null,
    generalSelection: null,
  } as unknown as GameState;
}

describe('toGameUpdate', () => {
  const update = (seatId: string) =>
    toGameUpdate({ gameId: 'g', seq: 1, state: stateWithHiddenSkillEvent(), seatId, legalActions: [], logFrom: 0, clock: null, paused: false });

  it('leaves a hidden General’s skill id out of the events for another seat', () => {
    expect(JSON.stringify(update('seat-a').events)).not.toContain('refusing-death');
  });

  it('keeps it in the events for the owner', () => {
    expect(JSON.stringify(update('seat-b').events)).toContain('refusing-death');
  });
});
