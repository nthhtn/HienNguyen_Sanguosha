import { GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition, SkillTrigger, TriggerPoint } from '../registry/types';

export function gatherTriggeredSkills(
  state: GameState,
  registry: ContentRegistry,
  mode: GameModeDefinition,
  point: TriggerPoint,
  subject: unknown
): SkillTrigger[] {
  const candidates: SkillTrigger[] = [...mode.triggers];
  for (const seat of state.seats) {
    for (const slot of [seat.generals.main, seat.generals.deputy]) {
      const general = registry.generals.get(slot.generalDefinitionId);
      if (!general) continue;
      for (const skill of general.skills) {
        for (const trigger of skill.triggers) {
          if (trigger.point === point) candidates.push(trigger);
        }
      }
    }
  }
  return candidates.filter((trigger) => trigger.condition(state, subject));
}
