import { GameState } from '../domain/types';
import {
  ContentRegistry,
  GameModeDefinition,
  SkillTrigger,
  TriggerOwner,
  TriggerPoint,
} from '../registry/types';
import { skillsInPlay } from './generalSkills';

// A trigger paired with the General or worn card it was gathered for. `owner` is
// undefined for mode-level triggers, which belong to the GameModeDefinition
// rather than to any single seat's general.
export interface GatheredTrigger {
  trigger: SkillTrigger;
  owner?: TriggerOwner;
  // A hidden General's skill: using it reveals the General first.
  needsReveal?: boolean;
}

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

  // Generals' skills in play, seat by seat (see skillsInPlay).
  for (const seat of state.seats) {
    for (const { owner, skill, needsReveal } of skillsInPlay(state, seat.id, registry)) {
      for (const trigger of skill.triggers ?? []) {
        if (trigger.point === point) candidates.push({ trigger, owner, ...(needsReveal ? { needsReveal } : {}) });
      }
    }
  }

  // An eliminated seat's afterDeath skills, for its own elimination only.
  const dying = point === 'after:SeatEliminatedEvent' ? (subject as { seatId?: string }).seatId : undefined;
  const gone = dying ? state.seats.find((s) => s.id === dying && s.eliminated && s.generals && !s.silenced) : undefined;
  for (const slot of ['main', 'deputy'] as const) {
    const general = gone?.generals?.[slot];
    for (const skill of general ? (registry.generals.get(general.generalDefinitionId)?.skills ?? []) : []) {
      if (!skill.afterDeath || skill.lord) continue;
      for (const trigger of skill.triggers ?? []) {
        if (trigger.point === point) candidates.push({ trigger, owner: { kind: 'general', seatId: gone!.id, slot, skillId: skill.id } });
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
