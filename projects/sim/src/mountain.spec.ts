import { createGame } from 'engine';
import type { GameState } from 'engine';
import { BASE_GENERAL_IDS, FIRE_GENERAL_IDS, FOREST_GENERAL_IDS, MOUNTAIN_GENERAL_IDS, WIND_GENERAL_IDS, buildContentRegistry, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { checkInvariants, checkRestingState } from './invariants';
import { firedSkills, partnerOf, registryWith, withForcedPairing } from './forcedPairing';

const POOL = [...BASE_GENERAL_IDS, ...WIND_GENERAL_IDS, ...FIRE_GENERAL_IDS, ...FOREST_GENERAL_IDS, ...MOUNTAIN_GENERAL_IDS];
const registry = registryWith(buildContentRegistry(), POOL);
const ctx = { registry, mode: kingdomWarMode };
// Skills with no trace of their own in the log: Lord skills are left out below.
const NO_TRACE = new Set<string>([]);

function checked(state: GameState, label: string, failures: string[]) {
  const violations = checkInvariants(state, registry);
  if (violations.length > 0) failures.push(`${label}: ${violations.join('; ')}`);
  if (!state.result) failures.push(`${label}: did not terminate`);
  if (JSON.stringify(JSON.parse(JSON.stringify(state))) !== JSON.stringify(state)) failures.push(`${label}: not serialisable`);
}

describe('simulated games with the base, Wind, Fire, Forest and Mountain Generals (57)', () => {
  it('2, 5 and 8 seats, random and rule-based bots: they finish, with no invariant broken', () => {
    const failures: string[] = [];
    let seed = 5000;
    for (const seats of [2, 5, 8]) {
      for (let i = 0; i < 10; i++) {
        seed++;
        const initial = createGame(kingdomWarMode, registry, Array.from({ length: seats }, (_, n) => `seat-${n}`), seed);
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

  it('each Mountain General, dealt to seat-0 with a same-kingdom partner, fires every skill that leaves a trace', () => {
    const missing: string[] = [];
    const failures: string[] = [];
    for (const generalId of MOUNTAIN_GENERAL_IDS) {
      const expected = (registry.generals.get(generalId)?.skills ?? []).filter((s) => !s.lord).map((s) => s.id).filter((id) => !NO_TRACE.has(id));
      const fired = new Set<string>();
      for (let seed = 1; seed <= 120 && expected.some((id) => !fired.has(id)); seed++) {
        const initial = withForcedPairing(createGame(kingdomWarMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4'], seed), 'seat-0', [generalId, partnerOf(generalId, registry, POOL)]);
        const { finalState } = runGame(initial, ctx, seed * 13 + 5, 20000, 'rule-based');
        checked(finalState, `${generalId} seed ${seed}`, failures);
        firedSkills(finalState, 'seat-0').forEach((id) => fired.add(id));
      }
      const unfired = expected.filter((id) => !fired.has(id));
      if (unfired.length > 0) missing.push(`${generalId}: ${unfired.join(', ')}`);
    }
    expect(failures).toEqual([]);
    expect(missing).toEqual([]);
  }, 1800000);

  it('Zuo Ci holds Forms from the first turn, and no Form is also a General in play', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const initial = withForcedPairing(createGame(kingdomWarMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3'], seed), 'seat-0', ['zuo-ci', partnerOf('zuo-ci', registry, POOL)]);
      const { finalState } = runGame(initial, ctx, seed, 20000, 'rule-based');
      const forms = finalState.seats[0].forms;
      if (!forms || forms.held.length < 2) failures.push(`seed ${seed}: Zuo Ci holds ${forms?.held.length ?? 0} Forms`);
      const inPlay = finalState.seats.flatMap((s) => (s.generals ? [s.generals.main.generalDefinitionId, s.generals.deputy.generalDefinitionId] : []));
      if (forms?.held.some((id) => inPlay.includes(id))) failures.push(`seed ${seed}: a Form is also in play`);
    }
    expect(failures).toEqual([]);
  }, 600000);
});
