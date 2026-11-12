import type { CardUse, ContentRegistry, GameState } from 'engine';
import { activeAbilities } from './abilities';

// Whether a trigger of the target's makes `use` have no effect: the card is wasted (rule A2). Read by bots
// only; the engine resolves the card through the triggers themselves.
export function wouldStop(state: GameState, use: CardUse, registry: ContentRegistry): boolean {
  return activeAbilities(state, use.targetSeatId, registry).some((a) => a.triggers?.some((t) => t.stops?.(state, use, use.targetSeatId, registry)));
}

// What a trigger of the target's makes `use` cost its user besides the card, or null for nothing (rule B1).
export function extraCostOf(state: GameState, use: CardUse, registry: ContentRegistry): { basicCards: number } | null {
  for (const ability of activeAbilities(state, use.targetSeatId, registry)) {
    for (const trigger of ability.triggers ?? []) {
      const cost = trigger.extraCost?.(state, use, use.targetSeatId, registry);
      if (cost) return cost;
    }
  }
  return null;
}
