import { GameState, GeneralOwner } from '../domain/types';
import { ContentRegistry, SkillDefinition } from '../registry/types';

// One skill of a seat's Generals that is in play, and whether using it
// reveals its General first (the General is hidden).
export interface SkillInPlay {
  owner: GeneralOwner;
  skill: SkillDefinition;
  needsReveal: boolean;
}

const SLOTS = ['main', 'deputy'] as const;

// The skills of `seatId`'s Generals that are in play, Main first, in skill
// order. All of a revealed General's. A hidden General's compulsory skills are
// off (its modifiers with them); its other skills are offered, but using one
// reveals it. Lord skills never are: Kingdom War has no Lord. An eliminated
// seat has none.
export function skillsInPlay(state: GameState, seatId: string, registry: ContentRegistry): SkillInPlay[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.eliminated || !seat.generals) return [];
  const found: SkillInPlay[] = [];
  for (const slot of SLOTS) {
    const general = seat.generals[slot];
    for (const skill of registry.generals.get(general.generalDefinitionId)?.skills ?? []) {
      if (skill.lord || (!general.revealed && skill.compulsory)) continue;
      found.push({ owner: { kind: 'general', seatId, slot, skillId: skill.id }, skill, needsReveal: !general.revealed });
    }
  }
  return found;
}

// The skill behind a General owner, whether or not it is in play now.
export function skillOf(state: GameState, owner: GeneralOwner, registry: ContentRegistry): SkillDefinition | undefined {
  const general = state.seats.find((s) => s.id === owner.seatId)?.generals?.[owner.slot];
  return general && registry.generals.get(general.generalDefinitionId)?.skills.find((s) => s.id === owner.skillId);
}

// The key an active skill's uses are counted under in Turn.abilityUses.
export function abilityUseKey(owner: GeneralOwner): string {
  return `${owner.seatId}/${owner.slot}/${owner.skillId}`;
}
