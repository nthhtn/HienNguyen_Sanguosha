import { createGame } from './gameSetup';
import { GameModeDefinition } from '../registry/types';
import { GameState } from '../domain/types';

function stubSetupMode(): GameModeDefinition {
  return {
    id: 'stub-setup',
    setup: (seatIds, _registry, rng) => {
      const state: GameState = {
        seats: seatIds.map((id, index) => ({
          id, index, kingdom: 'Wei',
          generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
          combinedHp: 5, maxCombinedHp: 5,
          hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated: false,
        })),
        players: seatIds.map((id) => ({ id: `player-${id}`, seatId: id, kind: 'bot' as const })),
        turn: { turnNumber: 1, ownerSeatId: seatIds[0], extraTurnStack: [] },
        phase: 'Judgment',
        zones: [],
        pendingResponse: null,
        log: [],
        rng,
        result: null, generalSelection: null,
      };
      return { state, rng };
    },
    checkWinCondition: () => null,
    triggers: [],
  };
}

describe('createGame', () => {
  it('delegates to the mode definition\'s setup with the given seat ids and a seeded RNG', () => {
    const state = createGame(stubSetupMode(), { cards: new Map(), generals: new Map() }, ['seat-a', 'seat-b'], 99);
    expect(state.seats.map((s) => s.id)).toEqual(['seat-a', 'seat-b']);
    expect(state.turn.ownerSeatId).toBe('seat-a');
  });
});
