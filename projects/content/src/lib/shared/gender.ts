import type { ContentRegistry, GameState } from 'engine';

// A seat's gender: its Main General's while the Main is revealed, else its
// Deputy's while that is revealed, else none (both hidden).
export function seatGender(state: GameState, seatId: string, registry: ContentRegistry): 'male' | 'female' | null {
  const generals = state.seats.find((s) => s.id === seatId)?.generals;
  if (!generals) return null;
  const shown = generals.main.revealed ? generals.main : generals.deputy.revealed ? generals.deputy : null;
  return (shown && registry.generals.get(shown.generalDefinitionId)?.gender) ?? null;
}
