import type { ContentRegistry, GameState } from 'engine';

// A seat's gender: its Main General's while the Main is revealed, else its
// Deputy's while that is revealed, else none (both hidden); a chosen Form's
// (Incarnation) replaces that of the General holding it.
export function seatGender(state: GameState, seatId: string, registry: ContentRegistry): 'male' | 'female' | null {
  const seat = state.seats.find((s) => s.id === seatId);
  const generals = seat?.generals;
  if (!seat || !generals) return null;
  const slot = generals.main.revealed ? 'main' : generals.deputy.revealed ? 'deputy' : null;
  if (!slot) return null;
  // A Form chosen by the shown General's slot lends its gender (Incarnation).
  if (seat.forms?.chosen && seat.forms.slot === slot && !seat.silenced) return registry.generals.get(seat.forms.chosen.generalId)?.gender ?? null;
  return registry.generals.get(generals[slot].generalDefinitionId)?.gender ?? null;
}
