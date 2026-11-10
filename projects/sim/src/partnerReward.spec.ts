import { createGame } from 'engine';
import { buildContentRegistry, guozhanMode } from 'content';
import { runGame } from './runGame';
import { checkInvariants } from './invariants';
import { withForcedPairing } from './forcedPairing';

describe('simulation: the Synergistic Partners reward', () => {
  it('plays Kingdom Wars bot games to a result with the reward on, answering any prompt it opens', () => {
    const registry = buildContentRegistry();
    const failures: string[] = [];
    let prompts = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const seatIds = Array.from({ length: [2, 4, 5, 6][seed % 4] }, (_, i) => `seat-${i}`);
      const initial = withForcedPairing(createGame(guozhanMode, registry, seatIds, seed * 17 + 3, { deck: 'kingdomWars', partnerReward: true }), 'seat-0', ['kingdomWars:liu-bei', 'kingdomWars:zhang-fei']);
      const seen = new Set<string>();
      try {
        const result = runGame(initial, { registry, mode: guozhanMode }, seed, 20000, seed % 2 ? 'rule-based' : 'random', (next) => {
          if (next.pendingChoice?.reason.kind === 'partner-reward' && !seen.has(next.pendingChoice.id)) {
            seen.add(next.pendingChoice.id);
            prompts++;
          }
        });
        if (!result.finalState.result) failures.push(`seed ${seed}: no result`);
        for (const v of checkInvariants(result.finalState, registry)) failures.push(`seed ${seed}: ${v}`);
      } catch (e) {
        failures.push(`seed ${seed}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
    // Seat 0 holds partners in every game, so the prompt must have come up (and every game still finished).
    expect(prompts).toBeGreaterThan(0);
  });
});
