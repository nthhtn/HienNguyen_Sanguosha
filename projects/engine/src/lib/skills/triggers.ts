import { GameState } from '../domain/types';
import {
  ContentRegistry,
  GameModeDefinition,
  SkillTrigger,
  TriggerOwner,
  TriggerPoint,
} from '../registry/types';
import { heldSkills, skillsInPlay, slotSilenced } from './generalSkills';

// A trigger paired with the General or worn card it was gathered for. `owner` is
// undefined for mode-level triggers, which belong to the GameModeDefinition
// rather than to any single seat's general.
export interface GatheredTrigger {
  trigger: SkillTrigger;
  owner?: TriggerOwner;
  // A hidden General's skill: using it reveals the General first. Its trigger is
  // asked, never applied on its own (revealFor).
  needsReveal?: boolean;
  // A hidden General's compulsory skill: a before-trigger of it asks for the reveal first (rewriteEffect).
  compulsory?: true;
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
    for (const { owner, skill, needsReveal } of skillsInPlay(state, seat.id, registry, true)) {
      for (const trigger of skill.triggers ?? []) {
        if (trigger.point === point) candidates.push({ trigger, owner, ...(needsReveal ? { needsReveal } : {}), ...(needsReveal && skill.compulsory ? { compulsory: true as const } : {}) });
      }
    }
  }

  // An eliminated seat's afterDeath skills, for its own elimination only.
  const dying = point === 'after:SeatEliminatedEvent' ? (subject as { seatId?: string }).seatId : undefined;
  const gone = dying ? state.seats.find((s) => s.id === dying && s.eliminated && s.generals && !s.silenced) : undefined;
  for (const { owner, skill } of gone ? heldSkills(state, gone.id, registry) : []) {
    // A General that lost its skills (Kingdom Wars Sorrow) has none to act with after death either.
    if (!skill.afterDeath || skill.lord || slotSilenced(gone!, owner.slot)) continue;
    for (const trigger of skill.triggers ?? []) {
      if (trigger.point === point) candidates.push({ trigger, owner });
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
