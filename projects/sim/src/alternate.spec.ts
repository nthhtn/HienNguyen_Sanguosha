import { createGame, createRng, getActiveSeatId, getLegalActions, redactEventsForSeat, redactStateForSeat, resolve } from 'engine';
import type { Action } from 'engine';
import { pickRandomAction } from 'bots';
import type { GameState } from 'engine';
import { buildContentRegistry, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { findStepLeaks, secretGeneralIds, secretSkillIds } from './leaks';
import { checkInvariants } from './invariants';
import { firedSkills, partnerOf, withForcedPairing } from './forcedPairing';

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
    // Since slice 4 every Alternate General has a ready skill, so none plays vanilla (the engine's fallback for a General with none).
    expect(vanillaGames).toBe(0);
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

  // The 14 Generals whose skills slice 2 turned into variants, each seated as Main with a same-kingdom partner.
  const VARIANT_GENERALS = ['liu-bei', 'sun-quan', 'xun-yu', 'zhu-rong', 'huang-yueying', 'sun-shangxiang', 'diao-chan', 'zhuge-liang', 'lu-xun', 'jia-xu', 'guo-jia', 'zhang-zhao-and-zhang-hong', 'zhen-ji', 'cai-wenji'];

  it('plays each variant General as Main to a result, with no engine error, no leak and no broken invariant', () => {
    const registry = buildContentRegistry();
    const ctx = { registry, mode: kingdomWarMode };
    const pool = [...registry.generals.keys()].filter((id) => id.startsWith('alternate:'));
    const failures: string[] = [];
    const rows: string[] = [];
    for (const name of VARIANT_GENERALS) {
      const generalId = `alternate:${name}`;
      const skillIds = (registry.generals.get(generalId)?.skills ?? []).map((s) => s.id);
      const games: Record<string, number> = Object.fromEntries(skillIds.map((id) => [id, 0]));
      // Default run keeps the suite fast; SIM_VERBOSE=1 prints the usage table and raises the seeds so every variant is seen firing.
      const SEEDS = process.env['SIM_VERBOSE'] ? 12 : 4;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const base = createGame(kingdomWarMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4'], seed * 17 + 3, { deck: 'alternate' });
        const initial = withForcedPairing(base, 'seat-0', [generalId, partnerOf(generalId, registry, pool)]);
        let prev: GameState = initial;
        const record = (next: GameState) => {
          if (failures.length < 30) for (const leak of findStepLeaks(prev, next, registry)) failures.push(`${name} seed ${seed}: ${leak}`);
          prev = next;
        };
        try {
          const { finalState } = runGame(initial, ctx, seed * 13 + 5, 20000, seed % 2 ? 'rule-based' : 'random', record);
          if (!finalState.result) failures.push(`${name} seed ${seed}: no result`);
          const violations = checkInvariants(finalState, registry);
          if (violations.length > 0) failures.push(`${name} seed ${seed}: ${violations.join('; ')}`);
          const fired = firedSkills(finalState, 'seat-0');
          for (const id of skillIds) if (fired.has(id)) games[id]++;
        } catch (e) {
          failures.push(`${name} seed ${seed}: engine error ${(e as Error).message}`);
        }
      }
      rows.push(`${name} (${SEEDS} games): ${skillIds.map((id) => `${id}=${games[id]}`).join(', ')}`);
    }
    if (process.env['SIM_VERBOSE']) process.stdout.write(`\nvariant skill usage:\n${rows.join('\n')}\n`);
    expect(failures).toEqual([]);
  }, 900_000);

  // The 9 Generals slice 3 adds, each seated as Main with a same-kingdom partner.
  const NEW_GENERALS = ['gan-fu-ren', 'yue-jin', 'ding-feng', 'pan-feng', 'tian-feng', 'kong-rong', 'ma-teng', 'ji-ling', 'zou-shi'];

  // Skills the bots never reach (or cannot reach within MAX_SEEDS games). Exact: if the bots start using one, the spec says to drop it here.
  // Impetus for Conflicts hides a General, which no bot policy is built to choose; the scripted spec below covers it.
  // Close Combat and Horsemanship are passive modifiers: they leave no log trace, so firedSkills cannot see them; their own specs cover them.
  const EXEMPT: Record<string, string[]> = {
    'ding-feng': ['alternate:close-combat'],
    'ma-teng': ['alternate:horsemanship'],
  };
  const MAX_SEEDS = 30;

  it('plays each new General as Main to a result, with no engine error, no leak and no broken invariant, and its skills fire', () => {
    const registry = buildContentRegistry();
    const ctx = { registry, mode: kingdomWarMode };
    const pool = [...registry.generals.keys()].filter((id) => id.startsWith('alternate:'));
    const failures: string[] = [];
    const neverFired: Record<string, string[]> = {};
    const rows: string[] = [];
    for (const name of NEW_GENERALS) {
      const generalId = `alternate:${name}`;
      expect(registry.generals.get(generalId)).toBeDefined();
      const skillIds = registry.generals.get(generalId)!.skills.map((x) => x.id);
      const fired = new Set<string>();
      let games = 0;
      // At least 4 games; more (up to MAX_SEEDS) until every reachable skill has fired.
      for (let seed = 1; seed <= MAX_SEEDS && (seed <= 4 || skillIds.some((id) => !fired.has(id) && !(EXEMPT[name] ?? []).includes(id))); seed++) {
        games++;
        const base = createGame(kingdomWarMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4'], seed * 17 + 3, { deck: 'alternate' });
        const initial = withForcedPairing(base, 'seat-0', [generalId, partnerOf(generalId, registry, pool)]);
        let prev: GameState = initial;
        const record = (next: GameState) => {
          for (const leak of findStepLeaks(prev, next, registry)) failures.push(`${name} seed ${seed}: ${leak}`);
          prev = next;
        };
        try {
          const { finalState } = runGame(initial, ctx, seed * 13 + 5, 20000, seed % 2 ? 'rule-based' : 'random', record);
          if (!finalState.result) failures.push(`${name} seed ${seed}: no result`);
          const violations = checkInvariants(finalState, registry);
          if (violations.length > 0) failures.push(`${name} seed ${seed}: ${violations.join('; ')}`);
          firedSkills(finalState, 'seat-0').forEach((id) => fired.add(id));
        } catch (e) {
          failures.push(`${name} seed ${seed}: engine error ${(e as Error).message}`);
        }
      }
      neverFired[name] = skillIds.filter((id) => !fired.has(id));
      rows.push(`${name} (${games} games): fired ${skillIds.filter((id) => fired.has(id)).join(', ') || '-'}; never ${neverFired[name].join(', ') || '-'}`);
    }
    if (process.env['SIM_VERBOSE']) process.stdout.write(`\nnew General skill usage:\n${rows.join('\n')}\n`);
    expect(failures).toEqual([]);
    // Exact: the skills that never fired are exactly the exempt ones.
    expect(Object.fromEntries(Object.entries(neverFired).filter(([, ids]) => ids.length > 0))).toEqual(EXEMPT);
  }, 1_800_000);

  // The bots never use Zou Shi's skills, so GeneralHiddenEvent never shows in a bot-driven game: script it.
  it('scripted: Femme Fatale then Impetus for Conflicts hide a General with no leak to any viewer', () => {
    const registry = buildContentRegistry();
    const ctx = { registry, mode: kingdomWarMode };
    const pool = [...registry.generals.keys()].filter((id) => id.startsWith('alternate:'));
    const base = createGame(kingdomWarMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3'], 77, { deck: 'alternate' });
    let state = withForcedPairing(base, 'seat-0', ['alternate:zou-shi', partnerOf('alternate:zou-shi', registry, pool)]);
    // Bots play on until Zou Shi's own Play Phase waits for her.
    let rng = createRng(5);
    let steps = 0;
    const ready = (s: GameState) =>
      !s.generalSelection && s.phase === 'Play' && s.turn.ownerSeatId === 'seat-0' && getActiveSeatId(s) === 'seat-0' && !s.pendingChoice && !s.pendingSelection && !s.pendingResponse;
    while (!ready(state) && !state.result && steps++ < 5000) {
      const picked = pickRandomAction(state, rng, registry);
      rng = picked.rng;
      state = resolve(state, picked.action, ctx).state;
    }
    expect(ready(state)).toBe(true);

    // A fully exposed target holding two Generals with skills, a face-down Zou Shi, and an Equipment card to discard.
    const target = 'seat-1';
    const targetGenerals = { main: 'alternate:zhang-fei', deputy: 'alternate:ma-chao' };
    expect(registry.generals.get(targetGenerals.main)!.skills.length).toBeGreaterThan(0);
    const equipment = { instanceId: 'impetus-c1', definitionId: 'axe', suit: 'spade' as const, rank: 7 };
    state = {
      ...state,
      // The two Generals are now on the table, so they are no longer spares.
      ...(state.spareGenerals ? { spareGenerals: state.spareGenerals.filter((id) => !Object.values(targetGenerals).includes(id)) } : {}),
      seats: state.seats.map((x) => {
        if (!x.generals) return x;
        if (x.id === 'seat-0') return { ...x, generals: { main: { ...x.generals.main, revealed: false }, deputy: { ...x.generals.deputy, revealed: false } } };
        if (x.id === target) return { ...x, kingdom: 'Shu' as const, generals: { main: { generalDefinitionId: targetGenerals.main, revealed: true }, deputy: { generalDefinitionId: targetGenerals.deputy, revealed: true } } };
        return { ...x, generals: { main: { ...x.generals.main, revealed: true }, deputy: { ...x.generals.deputy, revealed: true } } };
      }),
      zones: state.zones.map((z) => (z.id === 'seat-0:hand' ? { ...z, cards: [...z.cards, equipment] } : z)),
    };
    expect(secretGeneralIds(state, 'seat-2').has(targetGenerals.main)).toBe(false);

    const failures: string[] = [];
    let prev = state;
    const step = (action: Action) => {
      state = resolve(state, action, ctx).state;
      failures.push(...findStepLeaks(prev, state, registry));
      prev = state;
    };
    const skillAction = (skillId: string) => {
      const a = getLegalActions(state, 'seat-0', registry).find((x) => x.kind === 'UseSkillAction' && x.owner.kind === 'general' && x.owner.skillId === skillId);
      if (!a) throw new Error(`seat-0 is not offered ${skillId}`);
      return a;
    };

    // The random selection chose which slot Zou Shi sits in: she is exposed by her skill, whichever it is.
    const zouSlot = state.seats[0].generals!.main.generalDefinitionId === 'alternate:zou-shi' ? 'main' : 'deputy';
    step(skillAction('alternate:femme-fatale'));
    expect(state.seats[0].generals![zouSlot].revealed).toBe(true);
    step(skillAction('alternate:impetus-for-conflicts'));
    step({ kind: 'SelectAction', seatId: 'seat-0', selectionId: state.pendingSelection!.id, ids: ['impetus-c1'] });
    step({ kind: 'SelectAction', seatId: 'seat-0', selectionId: state.pendingSelection!.id, ids: [target] });
    step({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: state.pendingChoice!.id, optionId: 'main' });

    expect(state.log.filter((e) => e.kind === 'GeneralHiddenEvent')).toEqual([{ kind: 'GeneralHiddenEvent', seatId: target, slot: 'main' }]);
    expect(state.seats.find((x) => x.id === target)!.generals!.main.revealed).toBe(false);
    expect(failures).toEqual([]);

    // The hidden-again General is secret to every other viewer: no General id and no skill name in its redacted view or events.
    const hiddenSkills = registry.generals.get(targetGenerals.main)!.skills.map((x) => x.id);
    for (const viewer of ['seat-2', 'seat-3']) {
      expect(secretGeneralIds(state, viewer).has(targetGenerals.main)).toBe(true);
      for (const id of hiddenSkills) expect(secretSkillIds(state, viewer, registry).has(id)).toBe(true);
      const view = redactStateForSeat(state, viewer);
      const text = JSON.stringify([view.seats, redactEventsForSeat(state, state.log, viewer)]);
      expect(text).not.toContain(targetGenerals.main);
      for (const id of hiddenSkills) expect(text).not.toMatch(new RegExp(`(?<![a-z0-9-])${id}(?![a-z0-9-])`));
      expect(view.seats.find((x) => x.id === target)!.generals!.main).toEqual({ generalDefinitionId: 'hidden', revealed: false });
    }
    // The owner of the hidden-again General still sees it, and its own view still names the skills.
    const ownView = JSON.stringify(redactStateForSeat(state, target).seats.find((x) => x.id === target)!.generals);
    expect(ownView).toContain(targetGenerals.main);
    // The still-exposed Deputy stays visible.
    expect(JSON.stringify(redactStateForSeat(state, 'seat-2').seats)).toContain(targetGenerals.deputy);
  }, 120_000);
});
