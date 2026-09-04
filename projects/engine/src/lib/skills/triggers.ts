import { GameState } from '../domain/types';
import {
  ContentRegistry,
  GameModeDefinition,
  SkillTrigger,
  TriggerOwner,
  TriggerPoint,
} from '../registry/types';

// A trigger paired with the general-instance it was gathered for. `owner` is
// undefined for mode-level triggers, which belong to the GameModeDefinition
// rather than to any single seat's general.
export interface GatheredTrigger {
  trigger: SkillTrigger;
  owner?: TriggerOwner;
}

const GENERAL_SLOTS: readonly ('main' | 'deputy')[] = ['main', 'deputy'];

export function gatherTriggeredSkills(
  state: GameState,
  registry: ContentRegistry,
  mode: GameModeDefinition,
  point: TriggerPoint,
  subject: unknown
): GatheredTrigger[] {
  const candidates: GatheredTrigger[] = mode.triggers
    .filter((trigger) => trigger.point === point)
    .map((trigger) => ({ trigger }));

  for (const seat of state.seats) {
    // An eliminated seat's generals are out of the game — their skills must not
    // keep firing.
    if (seat.eliminated) continue;
    for (const slot of GENERAL_SLOTS) {
      const general = registry.generals.get(seat.generals[slot].generalDefinitionId);
      if (!general) continue;
      for (const skill of general.skills) {
        for (const trigger of skill.triggers) {
          if (trigger.point === point) {
            candidates.push({ trigger, owner: { seatId: seat.id, slot } });
          }
        }
      }
    }
  }

  return candidates.filter((candidate) => candidate.trigger.condition(state, subject, candidate.owner));
}
