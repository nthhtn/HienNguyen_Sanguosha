import { createGame } from 'engine';
import type { GameState } from 'engine';
import { buildContentRegistry, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { findStepLeaks } from './leaks';
import { firedSkills, partnerOf, withForcedPairing } from './forcedPairing';

const registry = buildContentRegistry();
const ctx = { registry, mode: kingdomWarMode };
const POOL = [...registry.generals.keys()].filter((id) => id.startsWith('alternate:'));
const GUO_JIA = 'alternate:guo-jia';

// Alternate Guo Jia is dealt on purpose: the cards he is shown and gives must reach no other seat's view or the log.
describe('property: no leak at any step when Alternate Guo Jia uses Bequeathed Strategy', () => {
  it('every view, log event and hidden skill stays clean, and the skill is used', () => {
    const failures: string[] = [];
    let used = false;
    for (let seed = 1; seed <= 60 && (seed <= 6 || !used); seed++) {
      const initial = withForcedPairing(
        createGame(kingdomWarMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3'], seed, { deck: 'alternate' }),
        'seat-0',
        [GUO_JIA, partnerOf(GUO_JIA, registry, POOL)]
      );
      let prev: GameState = initial;
      const record = (next: GameState) => {
        if (failures.length < 50) for (const leak of findStepLeaks(prev, next, registry)) failures.push(`seed ${seed} turn ${next.turn.turnNumber}: ${leak}`);
        prev = next;
      };
      const { finalState } = runGame(initial, ctx, seed * 13 + 5, 20000, 'rule-based', record);
      if (firedSkills(finalState, 'seat-0').has('alternate:bequeathed-strategy')) used = true;
    }
    expect(failures).toEqual([]);
    expect(used).toBe(true);
  }, 600_000);
});
