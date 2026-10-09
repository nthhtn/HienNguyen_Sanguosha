import type { ContentRegistry, GameState } from 'engine';
import { BASE_GENERAL_IDS } from 'content';

// The registry with only the Generals in `ids`.
export function registryWith(registry: ContentRegistry, ids: readonly string[]): ContentRegistry {
  return { cards: registry.cards, generals: new Map([...registry.generals].filter(([id]) => ids.includes(id))) };
}

// The registry with only the 25 base Generals (their skills are the real ones).
export const baseRegistry = (registry: ContentRegistry) => registryWith(registry, BASE_GENERAL_IDS);

// The next General of the same kingdom in `pool` (wrapping).
export function partnerOf(generalId: string, registry: ContentRegistry, pool: readonly string[] = BASE_GENERAL_IDS): string {
  const kingdom = registry.generals.get(generalId)?.kingdom;
  const same = pool.filter((id) => registry.generals.get(id)?.kingdom === kingdom);
  return same[(same.indexOf(generalId) + 1) % same.length];
}

// `seatId` is dealt exactly `pair` (so it plays them, the first as Main); every
// other seat 5 of the rest. Any 5 Generals hold a same-kingdom pair (four
// kingdoms), so every seat can still choose.
export function withForcedPairing(state: GameState, seatId: string, pair: [string, string]): GameState {
  const candidates = state.generalSelection?.candidates;
  if (!candidates) throw new Error('withForcedPairing needs a game still choosing its Generals');
  const pool = Object.values(candidates).flat().filter((id) => !pair.includes(id));
  const others = Object.keys(candidates).filter((id) => id !== seatId);
  if (pool.length < others.length * 5) throw new Error(`Not enough Generals left to deal ${others.length} seats`);
  const next: Record<string, string[]> = { [seatId]: [...pair] };
  others.forEach((id, i) => (next[id] = pool.slice(i * 5, i * 5 + 5)));
  return {
    ...state,
    generalSelection: { candidates: next },
    // A forced General must not also be a spare one.
    ...(state.spareGenerals ? { spareGenerals: state.spareGenerals.filter((id) => !pair.includes(id)) } : {}),
  };
}

// The skills of `seatId`'s Generals that left a trace in the log: an ask
// answered Use, an AbilityUsedEvent, a card used through the skill, a reveal to use it.
export function firedSkills(state: GameState, seatId: string): Set<string> {
  const fired = new Set<string>();
  for (const e of state.log) {
    if (e.kind === 'AbilityUsedEvent' && e.owner.kind === 'general' && e.owner.seatId === seatId) fired.add(e.owner.skillId);
    if (e.kind === 'ChoiceMadeEvent' && e.seatId === seatId && e.reason.kind === 'ability' && e.reason.owner.kind === 'general' && e.shows.kind === 'use') fired.add(e.reason.abilityId);
    if (e.kind === 'CardPlayedEvent' && e.seatId === seatId && e.card.via?.owner.kind === 'general') fired.add(e.card.via.abilityId);
    if (e.kind === 'GeneralRevealedEvent' && e.seatId === seatId && e.forAbilityId) fired.add(e.forAbilityId);
  }
  return fired;
}
