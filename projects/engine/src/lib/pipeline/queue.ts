import { GameState, QueueItem } from '../domain/types';

// Sets the queue; an empty queue is stored as no queue at all.
export function withQueue(state: GameState, queue: QueueItem[]): GameState {
  if (queue.length > 0) return { ...state, resolutionQueue: queue };
  if (state.resolutionQueue === undefined) return state;
  const { resolutionQueue: _dropped, ...rest } = state;
  return rest;
}

// Puts `items`, in order, ahead of everything already queued.
export function queueFront(state: GameState, items: QueueItem[]): GameState {
  if (items.length === 0) return state;
  return withQueue(state, [...items, ...(state.resolutionQueue ?? [])]);
}
