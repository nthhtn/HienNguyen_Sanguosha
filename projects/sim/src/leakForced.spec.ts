import { createGame } from 'engine';
import type { GameState } from 'engine';
import { BASE_GENERAL_IDS, FIRE_GENERAL_IDS, FOREST_GENERAL_IDS, MOUNTAIN_GENERAL_IDS, WIND_GENERAL_IDS, buildContentRegistry, guozhanMode } from 'content';
import { runGame } from './runGame';
import { findStepLeaks } from './leaks';
import { firedSkills, partnerOf, registryWith, withForcedPairing } from './forcedPairing';

const POOL = [...BASE_GENERAL_IDS, ...WIND_GENERAL_IDS, ...FIRE_GENERAL_IDS, ...FOREST_GENERAL_IDS, ...MOUNTAIN_GENERAL_IDS];
const registry = registryWith(buildContentRegistry(), POOL);
const ctx = { registry, mode: guozhanMode };

// The random leak property only meets Zuo Ci (Forms) and Lu Su (Alliance) by chance, so each is dealt on purpose.
describe('property: no leak at any step when Zuo Ci or Lu Su is dealt on purpose', () => {
  for (const [generalId, skillId] of [['zuo-ci', 'incarnation'], ['lu-su', 'alliance']] as const) {
    it(`${generalId}: every view, log event and hidden skill stays clean, and the skill is used`, () => {
      const failures: string[] = [];
      let used = false;
      for (let seed = 1; seed <= 60 && (seed <= 6 || !used); seed++) {
        const initial = withForcedPairing(createGame(guozhanMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3'], seed, { deck: 'identity' }), 'seat-0', [generalId, partnerOf(generalId, registry, POOL)]);
        let prev: GameState = initial;
        const record = (next: GameState) => {
          if (failures.length < 50) for (const leak of findStepLeaks(prev, next, registry)) failures.push(`${generalId} seed ${seed} turn ${next.turn.turnNumber}: ${leak}`);
          prev = next;
        };
        const { finalState } = runGame(initial, ctx, seed * 13 + 5, 20000, 'rule-based', record);
        if (firedSkills(finalState, 'seat-0').has(skillId)) used = true;
      }
      expect(failures).toEqual([]);
      expect(used).toBe(true);
    }, 600_000);
  }
});
