import type { CardInstance, GameState } from 'engine';

// For the Blaze selection "discard a card of the same suit": the card the target showed, and who showed it. Null for any
// other selection, or when no showing is in the log.
export function blazeShownCard(state: GameState): { card: CardInstance; seatId: string } | null {
  const then = state.pendingSelection?.then;
  if (then?.kind !== 'card-step' || then.step.step !== 'blaze-hit') return null;
  for (let i = state.log.length - 1; i >= 0; i--) {
    const event = state.log[i];
    if (event.kind === 'CardShownEvent' && event.abilityId === 'blaze') return { card: event.card, seatId: event.seatId };
  }
  return null;
}
