import { Action, GameState } from 'engine';
import { Step } from './tutorial-types';

// Whether the step lets the player submit this action. Only an `action` step allows anything, and only what a
// pattern names: a `next` or `state` step locks the board (the engine moves by itself or a scripted bot moves).
export function allows(step: Step, action: Action, state: GameState): boolean {
  const completes = step.completes;
  if (completes.kind !== 'action') return false;
  return completes.allow.some((p) => p.kind === action.kind && (p.match ? p.match(action, state) : true));
}

// An allowed action is the one that completes an `action` step.
export function completedBy(step: Step, action: Action, after: GameState): boolean {
  return allows(step, action, after);
}

export function reachedState(step: Step, state: GameState): boolean {
  return step.completes.kind === 'state' && step.completes.reached(state);
}

// Whether the beginner has nothing to do on this step: the game completes it by itself (a scripted bot moves) or the only move
// it allows is the judgment popup closing by itself. The overlay does not dim the board then, so it can be watched.
export function isWaiting(step: Step): boolean {
  const completes = step.completes;
  if (completes.kind === 'state') return true;
  return completes.kind === 'action' && completes.allow.length > 0 && completes.allow.every((p) => p.kind === 'AcknowledgeJudgmentAction');
}
