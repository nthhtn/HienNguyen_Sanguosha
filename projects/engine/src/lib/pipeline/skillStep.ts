import { GameState } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { skillOf } from '../skills/generalSkills';
import { ApplyResult, Effect } from './effects';
import { queueFront } from './queue';

// One step of a General's skill: the skill's onStep says what it leads to.
// Like a card step, it needs the registry and only reshapes the queue. The
// skill is found whether or not it is in play now (its General may have just
// been eliminated); onStep decides what still happens.
export function applySkillStep(state: GameState, step: Extract<Effect, { kind: 'SkillStepEffect' }>, registry: ContentRegistry): ApplyResult {
  const skill = skillOf(state, step.owner, registry);
  if (!skill?.onStep) throw new Error(`Skill ${step.owner.skillId} has no onStep (step ${step.step})`);
  return { state: queueFront(state, skill.onStep(state, step, registry) as Effect[]), events: [] };
}
