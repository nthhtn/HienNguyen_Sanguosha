import type { ContentRegistry, Effect, GameState, GeneralOwner, PhaseChangedEvent, SkillTrigger } from 'engine';
import { on, used } from './skills';

// The seat mark that records an awakening skill having fired.
export const awakenedKey = (skillId: string) => `awakened:${skillId}`;

export const isAwakened = (state: GameState, seatId: string, skillId: string): boolean =>
  !!state.seats.find((s) => s.id === seatId)?.marks?.[awakenedKey(skillId)];

interface AwakeningRule {
  skillId: string;
  condition(state: GameState, owner: GeneralOwner, registry: ContentRegistry): boolean;
  // What the awakening does, after it is marked and logged.
  effects(state: GameState, owner: GeneralOwner, registry: ContentRegistry): Effect[];
}

// An awakening skill's trigger: at the start of its owner's own turn, once,
// when the condition holds. Mark it awakened first, then do the rest.
export function awakeningAtTurnStart(rule: AwakeningRule): SkillTrigger {
  return on<PhaseChangedEvent>('after:PhaseChangedEvent', {
    condition: (state, event, owner, registry) =>
      event.phase === 'Start' &&
      event.seatId === owner.seatId &&
      !isAwakened(state, owner.seatId, rule.skillId) &&
      state.seats.some((s) => s.id === owner.seatId && !s.eliminated) &&
      rule.condition(state, owner, registry),
    effect: (state, _event, owner, registry) => [
      { kind: 'IncrementEffect', scope: 'seat', seatId: owner.seatId, key: awakenedKey(rule.skillId), by: 1 },
      used(owner, 'awakened'),
      ...rule.effects(state, owner, registry),
    ],
  });
}
