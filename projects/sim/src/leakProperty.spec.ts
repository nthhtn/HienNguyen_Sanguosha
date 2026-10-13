import { createGame } from 'engine';
import type { GameState } from 'engine';
import { buildContentRegistry, kingdomWarMaxSeats, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { findStepLeaks } from './leaks';

describe('property: no seat learns hidden information over simulated Kingdom War games', () => {
  it('no view, log event or reshuffle leaks, at any step, for any seat', () => {
    const registry = buildContentRegistry();
    const maxSeats = kingdomWarMaxSeats(registry);
    const seatCounts = [...new Set([2, 4, 7, maxSeats])].filter((n) => n <= maxSeats);
    const failures: string[] = [];
    let reshuffles = 0;
    for (const numSeats of seatCounts) {
      for (let seed = 1; seed <= 2; seed++) {
        const seatIds = Array.from({ length: numSeats }, (_, i) => `seat-${i}`);
        const initial = createGame(kingdomWarMode, registry, seatIds, seed * 100 + numSeats);
        const label = `seed ${seed * 100 + numSeats} (${numSeats} seats)`;
        let prev: GameState = initial;
        const record = (next: GameState) => {
          reshuffles += next.log.slice(prev.log.length).filter((e) => e.kind === 'DiscardPileReshuffledEvent').length;
          if (failures.length < 50) for (const leak of findStepLeaks(prev, next)) failures.push(`${label} turn ${next.turn.turnNumber}: ${leak}`);
          prev = next;
        };
        record(initial);
        runGame(initial, { registry, mode: kingdomWarMode }, seed * 7 + 1, 20000, 'rule-based', record);
      }
    }
    expect(failures).toEqual([]);
    // The reshuffle check only means something if some game reshuffled.
    expect(reshuffles).toBeGreaterThan(0);
  }, 600_000);
});
