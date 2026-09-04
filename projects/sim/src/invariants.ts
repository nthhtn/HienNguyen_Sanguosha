import type { GameState } from 'engine';

export function checkInvariants(state: GameState): string[] {
  const violations: string[] = [];

  for (const seat of state.seats) {
    if (seat.combinedHp < 0) {
      violations.push(`Seat ${seat.id} has negative combinedHp: ${seat.combinedHp}`);
    }
  }

  if (state.pendingResponse) {
    const seat = state.seats.find((s) => s.id === state.pendingResponse!.respondingSeatId);
    if (!seat) {
      violations.push(`pendingResponse references unknown seat ${state.pendingResponse.respondingSeatId}`);
    } else if (seat.eliminated) {
      violations.push(`pendingResponse references eliminated seat ${seat.id}`);
    }
  }

  if (state.result) {
    const allIds = new Set(state.seats.map((s) => s.id));
    const seen = new Set<string>();
    for (const id of [...state.result.winningSeatIds, ...state.result.losingSeatIds]) {
      if (!allIds.has(id)) violations.push(`GameResult references unknown seat ${id}`);
      if (seen.has(id)) violations.push(`GameResult lists seat ${id} more than once`);
      seen.add(id);
    }
  }

  return violations;
}
