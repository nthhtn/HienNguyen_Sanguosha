import { nextInt, getActiveSeatId, getLegalActions, shuffle } from 'engine';
import type { GameState, RngState, Action, ContentRegistry } from 'engine';

// Kept as the bot's named entry point; the engine owns the rule.
export function seatToAct(state: GameState): string | null {
  return getActiveSeatId(state);
}

export function pickRandomAction(
  state: GameState,
  rng: RngState,
  registry: ContentRegistry
): { action: Action; rng: RngState } {
  const seatId = seatToAct(state);
  if (seatId === null) {
    throw new Error(
      'No seat is able to act: the turn owner / pending responder is unknown or eliminated ' +
        `(turn owner ${state.turn.ownerSeatId}, responder ${state.pendingResponse?.respondingSeatId ?? 'none'})`
    );
  }
  const legal = getLegalActions(state, seatId, registry);
  if (legal.length === 0) {
    throw new Error(`No legal actions for seat ${seatId} to act with`);
  }
  const step = nextInt(rng, legal.length);
  const picked = legal[step.value];
  const selection = state.pendingSelection;
  if (picked.kind !== 'SelectAction' || !selection) return { action: picked, rng: step.rng };
  // A selection template: fill it with `min` eligible ids, picked at random.
  const shuffled = shuffle(selection.eligibleIds, step.rng);
  return { action: { ...picked, ids: shuffled.items.slice(0, selection.min) }, rng: shuffled.rng };
}
