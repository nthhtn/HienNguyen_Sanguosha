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
    let vanillaGames = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const numSeats = [2, 4, 5, 6][seed % 4];
      const seatIds = Array.from({ length: numSeats }, (_, i) => `seat-${i}`);
      const initial = createGame(kingdomWarMode, registry, seatIds, seed * 31 + 7, { deck: 'alternate' });
      const seated = (state: GameState) => [
        ...Object.values(state.generalSelection?.candidates ?? {}).flat(),
        ...state.seats.flatMap((seat) => (seat.generals ? [seat.generals.main.generalDefinitionId, seat.generals.deputy.generalDefinitionId] : [])),
      ];
      const seatedIds = seated(initial);
      for (const id of seatedIds) if (!id.startsWith('alternate:')) failures.push(`seed ${seed}: seated ${id} is not an alternate: General`);
      if (seatedIds.some((id) => registry.generals.get(id)?.skills.length === 0)) vanillaGames++;
      let prev: GameState = initial;
      const record = (next: GameState) => {
        for (const e of next.log.slice(prev.log.length)) seen.add(JSON.stringify(e));
        for (const id of seated(next)) if (!id.startsWith('alternate:') && failures.length < 30) failures.push(`seed ${seed}: seated ${id} is not an alternate: General`);
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
    // Generals with no ready skills play vanilla; the games above reached a result with some of them seated.
    expect(vanillaGames).toBeGreaterThan(0);
  }, 300_000);

  it('seats no alternate: General in a seeded Default game', () => {
    const registry = buildContentRegistry();
    for (const seed of [1, 2, 3]) {
      const state = createGame(kingdomWarMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3'], seed, { deck: 'default' });
      const ids = Object.values(state.generalSelection?.candidates ?? {}).flat();
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.filter((id) => id.startsWith('alternate:'))).toEqual([]);
    }
  });
});
