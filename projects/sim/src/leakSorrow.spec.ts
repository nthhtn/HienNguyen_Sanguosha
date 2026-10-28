import { createGame } from 'engine';
import type { GameState } from 'engine';
import { buildContentRegistry, guozhanMode } from 'content';
import { runGame } from './runGame';
import { findStepLeaks } from './leaks';
import { checkInvariants, checkRestingState } from './invariants';
import { firedSkills, partnerOf, withForcedPairing } from './forcedPairing';

const registry = buildContentRegistry();
const ctx = { registry, mode: guozhanMode };
const POOL = [...registry.generals.keys()].filter((id) => id.startsWith('kingdomWars:'));
const CAI_WENJI = 'kingdomWars:cai-wenji';

// Kingdom Wars Cai Wenji is dealt on purpose. When she is killed her player, though out, picks the killer's
// Main or Deputy: the bots must answer it, the game must go on to a result, and the pick must reveal
// none of the killer's Generals to any other seat's view or the log.
describe('property: no leak at any step when Kingdom Wars Cai Wenji’s Sorrow silences one General', () => {
  it('every view, log event and hidden skill stays clean, the invariants hold, and the skill is used', () => {
    const failures: string[] = [];
    let used = 0;
    for (let seed = 1; seed <= 120 && (seed <= 6 || used < 2); seed++) {
      const initial = withForcedPairing(
        createGame(guozhanMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3'], seed, { deck: 'kingdomWars' }),
        'seat-0',
        [CAI_WENJI, partnerOf(CAI_WENJI, registry, POOL)]
      );
      let prev: GameState = initial;
      const record = (next: GameState) => {
        if (failures.length < 50) {
          for (const leak of findStepLeaks(prev, next, registry)) failures.push(`seed ${seed} turn ${next.turn.turnNumber}: ${leak}`);
          for (const v of checkRestingState(next)) failures.push(`seed ${seed} turn ${next.turn.turnNumber}: ${v}`);
        }
        prev = next;
      };
      const { finalState } = runGame(initial, ctx, seed * 17 + 3, 20000, seed % 2 ? 'rule-based' : 'random', record);
      if (!finalState.result) failures.push(`seed ${seed}: no result`);
      for (const v of checkInvariants(finalState, registry)) failures.push(`seed ${seed} (final): ${v}`);
      if (firedSkills(finalState, 'seat-0').has('kingdomWars:sorrow')) {
        used++;
        if (!finalState.seats.some((s) => s.silencedSlots?.length)) failures.push(`seed ${seed}: Sorrow used but no General silenced`);
      }
    }
    expect(failures).toEqual([]);
    expect(used).toBeGreaterThan(0);
  }, 600_000);
});
