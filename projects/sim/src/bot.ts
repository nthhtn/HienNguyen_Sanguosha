import { nextInt } from 'engine';
import { getLegalActions } from 'engine';
import type { GameState, RngState, Action } from 'engine';

export function seatToAct(state: GameState): string {
  return state.pendingResponse ? state.pendingResponse.respondingSeatId : state.turn.ownerSeatId;
}

export function pickRandomAction(state: GameState, rng: RngState): { action: Action; rng: RngState } {
  const seatId = seatToAct(state);
  const legal = getLegalActions(state, seatId);
  if (legal.length === 0) {
    throw new Error(`No legal actions for seat ${seatId} to act with`);
  }
  const step = nextInt(rng, legal.length);
  return { action: legal[step.value], rng: step.rng };
}
