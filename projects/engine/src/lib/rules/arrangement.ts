import { GameState } from '../domain/types';
import { Action } from '../pipeline/actions';

// Why `action` can't fill the pending arrangement, or null when it can: the
// arranger, the arrangement's id, and every card placed exactly once, on top
// or at the bottom, with no others. The engine, bots and the UI share this check.
export function validateArrangement(state: GameState, action: Extract<Action, { kind: 'ArrangeCardsAction' }>): string | null {
  const arrangement = state.pendingArrangement;
  if (!arrangement || arrangement.id !== action.arrangementId) return `No matching pending arrangement: ${action.arrangementId}`;
  if (action.seatId !== arrangement.seatId) return `Seat ${action.seatId} is not the arranger for ${arrangement.id}`;
  const placed = [...action.top, ...action.bottom];
  if (new Set(placed).size !== placed.length) return 'The same card was placed twice';
  const stray = placed.find((id) => !arrangement.cardInstanceIds.includes(id));
  if (stray) return `${stray} is not one of the cards being arranged`;
  if (placed.length !== arrangement.cardInstanceIds.length) return `Place all ${arrangement.cardInstanceIds.length} cards; got ${placed.length}`;
  return null;
}
