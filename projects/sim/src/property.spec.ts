// projects/sim/src/property.spec.ts
import { createGame } from 'engine';
import { buildContentRegistry, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { checkInvariants } from './invariants';

describe('property: simulated Kingdom War games across many seeds and seat counts', () => {
  it('every game terminates with a valid, non-dangling GameResult and no invariant violations', () => {
    const registry = buildContentRegistry();
    const seatCounts = [2, 3, 4, 5, 6, 7, 8];
    const failures: string[] = [];
    let seed = 0;

    for (const numSeats of seatCounts) {
      for (let i = 0; i < 10; i++) {
        seed++;
        const seatIds = Array.from({ length: numSeats }, (_, idx) => `seat-${idx}`);
        const initialState = createGame(kingdomWarMode, registry, seatIds, seed);
        const { finalState, actionsSubmitted } = runGame(
          initialState,
          { registry, mode: kingdomWarMode },
          seed * 7 + 1,
          2000
        );

        const label = `seed ${seed} (${numSeats} seats)`;
        const violations = checkInvariants(finalState);
        if (violations.length > 0) failures.push(`${label}: ${violations.join('; ')}`);
        if (!finalState.result) failures.push(`${label}: did not terminate within ${actionsSubmitted} actions`);
        if (finalState.result && finalState.pendingResponse) {
          failures.push(`${label}: game ended with a dangling pendingResponse`);
        }

        const roundTripped = JSON.parse(JSON.stringify(finalState));
        if (JSON.stringify(roundTripped) !== JSON.stringify(finalState)) {
          failures.push(`${label}: final GameState did not survive a JSON round-trip (Serializability invariant broken)`);
        }
      }
    }

    expect(failures).toEqual([]);
  }, 60000); // drives 70 full games end-to-end; give it more headroom than Jest's 5s default
});
