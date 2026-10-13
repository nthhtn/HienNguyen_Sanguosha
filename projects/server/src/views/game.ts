import { redactStateForSeat } from 'engine';
import type { Action, GameState } from 'engine';
import type { GameClockView, GameUpdate, SeatView } from 'protocol';

// What one seat may see: the engine's redaction, without the RNG (it holds the
// seed) and without the log (sent as events). The only game data a client gets.
export function toSeatView(state: GameState, seatId: string): SeatView {
  const { rng: _rng, log: _log, ...view } = redactStateForSeat(state, seatId);
  return view;
}

export interface GameUpdateInput {
  gameId: string;
  seq: number;
  state: GameState;
  seatId: string;
  legalActions: Action[];
  logFrom: number;
  clock: GameClockView | null;
  paused: boolean;
}

export function toGameUpdate(input: GameUpdateInput): GameUpdate {
  return {
    gameId: input.gameId,
    seq: input.seq,
    view: toSeatView(input.state, input.seatId),
    legalActions: input.legalActions,
    logFrom: input.logFrom,
    events: input.state.log.slice(input.logFrom),
    clock: input.clock,
    paused: input.paused,
  };
}
