import { createGame } from 'engine';
import type { GameState } from 'engine';
import { BASE_GENERAL_IDS, buildContentRegistry, guozhanMode } from 'content';
import { runGame } from './runGame';
import { checkInvariants, checkRestingState } from './invariants';
import { baseRegistry, firedSkills, partnerOf, withForcedPairing } from './forcedPairing';

const registry = baseRegistry(buildContentRegistry());
const ctx = { registry, mode: guozhanMode };
// Skills that are only modifiers leave no trace in the log; their unit tests cover them.
const MODIFIERS_ONLY = new Set(['roar', 'horsemanship', 'empty-city', 'wondrous-talent', 'humility', 'matchless']);

function checked(state: GameState, label: string, failures: string[]) {
  const violations = checkInvariants(state, registry);
  if (violations.length > 0) failures.push(`${label}: ${violations.join('; ')}`);
  if (!state.result) failures.push(`${label}: did not terminate`);
  if (JSON.stringify(JSON.parse(JSON.stringify(state))) !== JSON.stringify(state)) failures.push(`${label}: not serialisable`);
}

describe('simulated games with only the base Generals', () => {
  it('2 and 5 seats, random and rule-based bots: they finish, with no invariant broken', () => {
    const failures: string[] = [];
    let seed = 1000;
    for (const seats of [2, 5]) {
      for (let i = 0; i < 10; i++) {
        seed++;
        const initial = createGame(guozhanMode, registry, Array.from({ length: seats }, (_, n) => `seat-${n}`), seed, { deck: 'dynastyWars' });
        for (const [bot, maxActions] of [['random', 5000], ['rule-based', 20000]] as const) {
          const resting = new Set<string>();
          const { finalState } = runGame(initial, ctx, seed * 7 + 1, maxActions, bot, (s) => checkRestingState(s).forEach((v) => resting.add(v)));
          const label = `seed ${seed} (${seats} seats) [${bot}]`;
          if (resting.size > 0) failures.push(`${label}: ${[...resting].join('; ')}`);
          checked(finalState, label, failures);
        }
      }
    }
    expect(failures).toEqual([]);
  }, 300000);

  it('each base General, dealt to seat-0 with a same-kingdom partner, fires every skill that leaves a trace', () => {
    const missing: string[] = [];
    const failures: string[] = [];
    for (const generalId of BASE_GENERAL_IDS) {
      const expected = (registry.generals.get(generalId)?.skills ?? []).filter((s) => !s.lord).map((s) => s.id).filter((id) => !MODIFIERS_ONLY.has(id));
      if (expected.length === 0) continue;
      const fired = new Set<string>();
      for (let seed = 1; seed <= 30 && expected.some((id) => !fired.has(id)); seed++) {
        const initial = withForcedPairing(createGame(guozhanMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4'], seed, { deck: 'dynastyWars' }), 'seat-0', [generalId, partnerOf(generalId, registry)]);
        const { finalState } = runGame(initial, ctx, seed * 13 + 5, 20000, 'rule-based');
        checked(finalState, `${generalId} seed ${seed}`, failures);
        firedSkills(finalState, 'seat-0').forEach((id) => fired.add(id));
      }
      const unfired = expected.filter((id) => !fired.has(id));
      if (unfired.length > 0) missing.push(`${generalId}: ${unfired.join(', ')}`);
    }
    expect(failures).toEqual([]);
    expect(missing).toEqual([]);
  }, 600000);
});
