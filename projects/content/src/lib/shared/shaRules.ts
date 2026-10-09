import type { ContentRegistry, GameState } from 'engine';
import { attackRange, SHA_FLAGS, seatDistance, shaFlag } from './queries';
import { untargetableBy } from './abilities';

export { SHA_FLAGS, shaFlag } from './queries';

// The seats `seatId`'s Sha may target now, in seat order: other living seats a
// Sha may target, within attack range unless its Sha ignore distance this turn.
export function shaTargetIds(state: GameState, seatId: string, registry: ContentRegistry): string[] {
  const range = attackRange(state, seatId, registry);
  const anyDistance = shaFlag(state, seatId, SHA_FLAGS.anyDistance);
  return [...state.seats]
    .sort((a, b) => a.index - b.index)
    .filter((s) => s.id !== seatId && !s.eliminated)
    .map((s) => s.id)
    .filter((id) => !untargetableBy(state, id, 'sha', registry) && (anyDistance || seatDistance(state, seatId, id, registry) <= range));
}
