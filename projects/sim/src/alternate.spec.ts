import { createGame } from 'engine';
import type { GameState } from 'engine';
import { buildContentRegistry, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { findStepLeaks } from './leaks';

const NEW_CARDS = ['wuxie-guo', 'amass', 'ascertain', 'ally-far-attack-near', 'wu-six-swords', 'trident-glaive'];

describe('simulation: Alternate deck games with bots', () => {
  it('plays seeded games to a result with no engine error and no leak', () => {
    const registry = buildContentRegistry();
    const failures: string[] = [];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const numSeats = [2, 4, 5, 6][seed % 4];
      const seatIds = Array.from({ length: numSeats }, (_, i) => `seat-${i}`);
      const initial = createGame(kingdomWarMode, registry, seatIds, seed * 31 + 7, { deck: 'alternate' });
      let prev: GameState = initial;
      const record = (next: GameState) => {
        for (const e of next.log.slice(prev.log.length)) seen.add(JSON.stringify(e));
        if (failures.length < 30) for (const leak of findStepLeaks(prev, next, registry)) failures.push(`seed ${seed}: ${leak}`);
        prev = next;
      };
      try {
        const kind = seed % 2 ? 'rule-based' : 'random';
        const result = runGame(initial, { registry, mode: kingdomWarMode }, seed, 20000, kind, record);
        if (!result.finalState.result) failures.push(`seed ${seed}: no result in 20000 actions`);
      } catch (e) {
        failures.push(`seed ${seed}: engine error ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
    // The run only means something if the new cards actually came up.
    const text = [...seen].join('\n');
    expect(NEW_CARDS.filter((id) => !text.includes(id))).toEqual([]);
  }, 300_000);
});
