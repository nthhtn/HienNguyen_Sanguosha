import { GameState } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { lookupCard } from '../registry/lookup';
import { ApplyResult, Effect } from './effects';
import { queueFront } from './queue';

// One step of a card's resolution: the card's onStep says what it leads to.
// Like the Tool lifecycle, it needs the registry and only reshapes the queue.
export function applyCardStep(state: GameState, step: Extract<Effect, { kind: 'CardStepEffect' }>, registry: ContentRegistry): ApplyResult {
  const definition = lookupCard(registry, step.card.as);
  if (!definition.onStep) throw new Error(`Card ${step.card.as} has no onStep (step ${step.step})`);
  return { state: queueFront(state, definition.onStep(state, step, registry) as Effect[]), events: [] };
}
