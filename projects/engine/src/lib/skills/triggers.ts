import { GameState } from '../domain/types';
import {
  ContentRegistry,
  GameModeDefinition,
  SkillTrigger,
  TriggerOwner,
  TriggerPoint,
} from '../registry/types';

// A trigger paired with the General or worn card it was gathered for. `owner` is
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
    // keep firing. A seat still choosing its generals has none to fire.
    if (seat.eliminated || !seat.generals) continue;
    for (const slot of GENERAL_SLOTS) {
      const general = registry.generals.get(seat.generals[slot].generalDefinitionId);
      if (!general) continue;
      for (const skill of general.skills) {
        for (const trigger of skill.triggers) {
          if (trigger.point === point) {
            candidates.push({ trigger, owner: { kind: 'general', seatId: seat.id, slot } });
          }
        }
      }
    }
  }

  // Worn equipment, after every General: in seat order, then zone order. An
  // eliminated seat's cards are out of the game.
  for (const seat of state.seats) {
    if (seat.eliminated) continue;
    const worn = state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? [];
    for (const card of worn) {
      for (const trigger of registry.cards.get(card.definitionId)?.abilities?.triggers ?? []) {
        if (trigger.point === point) {
          candidates.push({ trigger, owner: { kind: 'equipment', seatId: seat.id, cardInstanceId: card.instanceId } });
        }
      }
    }
  }

  return candidates.filter((candidate) => candidate.trigger.condition(state, subject, candidate.owner, registry));
}
