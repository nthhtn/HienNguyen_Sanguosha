// projects/sim/src/property.spec.ts
import { createGame, cardsOverHandLimit } from 'engine';
import type { GameModeDefinition, PhaseChangedEvent } from 'engine';
import { buildContentRegistry, kingdomWarMode, kingdomWarMaxSeats } from 'content';
import { runGame } from './runGame';
import { checkInvariants, checkRestingState } from './invariants';

describe('property: simulated Kingdom War games across many seeds and every legal seat count', () => {
  it('every game terminates with a valid, non-dangling GameResult and no invariant violations', () => {
    const registry = buildContentRegistry();
    // Kingdom War deals 5 unique generals per seat, so the table is capped by the pool.
    const maxSeats = kingdomWarMaxSeats(registry);
    const seatCounts = Array.from({ length: maxSeats - 1 }, (_, i) => i + 2);
    const failures: string[] = [];
    // A probe that never fires: it records any seat entering End while still over its hand limit.
    const handLimitBreaches: string[] = [];
    const probedMode: GameModeDefinition = {
      ...kingdomWarMode,
      triggers: [
        ...kingdomWarMode.triggers,
        {
          point: 'after:PhaseChangedEvent',
          condition: (state, subject) => {
            const event = subject as PhaseChangedEvent;
            if (event.phase === 'End' && cardsOverHandLimit(state, event.seatId) > 0) {
              handLimitBreaches.push(`${event.seatId} entered End over its hand limit on turn ${state.turn.turnNumber}`);
            }
            return false;
          },
          effect: () => [],
        },
      ],
    };
    let seed = 0;

    for (const numSeats of seatCounts) {
      for (let i = 0; i < 15; i++) {
        seed++;
        const seatIds = Array.from({ length: numSeats }, (_, idx) => `seat-${idx}`);
        const initialState = createGame(kingdomWarMode, registry, seatIds, seed);
        for (const [botKind, maxActions] of [['random', 5000], ['rule-based', 20000]] as const) {
          const restingViolations = new Set<string>();
          const { finalState, actionsSubmitted } = runGame(
            initialState,
            { registry, mode: probedMode },
            seed * 7 + 1,
            maxActions,
            botKind,
            (state) => checkRestingState(state).forEach((v) => restingViolations.add(v))
          );
          const label = `seed ${seed} (${numSeats} seats) [${botKind}]`;
          if (restingViolations.size > 0) failures.push(`${label}: ${[...restingViolations].join('; ')}`);
          if (handLimitBreaches.length > 0) failures.push(`${label}: ${handLimitBreaches.splice(0).join('; ')}`);
          const violations = checkInvariants(finalState, registry);
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
    }

    expect(failures).toEqual([]);
  }, 180000); // drives ~120 full games (random + rule-based bots) end-to-end
});
