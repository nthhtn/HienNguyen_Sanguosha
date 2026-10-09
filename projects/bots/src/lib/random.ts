import { nextInt, getActiveSeatId, getLegalActions, shuffle } from 'engine';
import type { GameState, RngState, Action, ContentRegistry } from 'engine';
import { fillSelection } from './helpers';

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
  // An arrangement template: every card on top, as given.
  if (picked.kind === 'ArrangeCardsAction' && state.pendingArrangement) {
    return { action: { ...picked, top: [...state.pendingArrangement.cardInstanceIds], bottom: [] }, rng: step.rng };
  }
  // A target template: between min and max of its eligible seats, at random.
  if ((picked.kind === 'PlayCardAction' || picked.kind === 'UseConversionAction') && picked.pickTargets) {
    const { eligibleIds, min, max } = picked.pickTargets;
    const count = nextInt(step.rng, max - min + 1);
    const shuffled = shuffle(eligibleIds, count.rng);
    const { pickTargets: _pick, ...rest } = picked;
    const targets = shuffled.items.slice(0, min + count.value).map((seatId) => ({ kind: 'seat' as const, seatId }));
    return { action: { ...rest, targets }, rng: shuffled.rng };
  }
  const selection = state.pendingSelection;
  if (picked.kind !== 'SelectAction' || !selection) return { action: picked, rng: step.rng };
  // A selection template: fill it with `min` eligible ids, picked at random.
  const shuffled = shuffle(selection.eligibleIds, step.rng);
  return { action: { ...picked, ids: fillSelection(state, selection, shuffled.items) }, rng: shuffled.rng };
}
