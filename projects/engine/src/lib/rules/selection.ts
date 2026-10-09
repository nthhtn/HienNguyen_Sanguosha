import { GameState } from '../domain/types';
import { Action } from '../pipeline/actions';

// Why `action` can't fill the pending selection, or null when it can: the
// selector, the selection's id, only eligible ids, no repeats, and between
// min and max of them. The engine, bots and the UI share this check.
export function validateSelection(state: GameState, action: Extract<Action, { kind: 'SelectAction' }>): string | null {
  const selection = state.pendingSelection;
  if (!selection || selection.id !== action.selectionId) return `No matching pending selection: ${action.selectionId}`;
  if (action.seatId !== selection.seatId) return `Seat ${action.seatId} is not the selector for ${selection.id}`;
  if (new Set(action.ids).size !== action.ids.length) return 'The same thing was picked twice';
  const ineligible = action.ids.find((id) => !selection.eligibleIds.includes(id));
  if (ineligible) return `${ineligible} can’t be picked here`;
  if (action.ids.length < selection.min || action.ids.length > selection.max) {
    return `Pick between ${selection.min} and ${selection.max}; got ${action.ids.length}`;
  }
  if (selection.sameSuit) {
    const cards = state.zones.flatMap((z) => z.cards);
    const suits = new Set(action.ids.map((id) => cards.find((c) => c.instanceId === id)?.suit));
    if (suits.size > 1) return 'The cards must share the same suit';
  }
  return null;
}
