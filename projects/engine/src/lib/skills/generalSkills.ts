import { GameState, GeneralOwner } from '../domain/types';
import { ContentRegistry, SkillDefinition } from '../registry/types';
import { findSkill } from '../registry/lookup';

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
  if (!seat || seat.eliminated || !seat.generals || seat.silenced) return [];
  const found: SkillInPlay[] = [];
  const add = (slot: 'main' | 'deputy', skill: SkillDefinition | undefined) => {
    const general = seat.generals![slot];
    if (!skill || skill.lord || (!general.revealed && skill.compulsory)) return;
    if (found.some((f) => f.owner.slot === slot && f.skill.id === skill.id)) return;
    found.push({ owner: { kind: 'general', seatId, slot, skillId: skill.id }, skill, needsReveal: !general.revealed });
  };
  for (const slot of SLOTS) {
    for (const skill of registry.generals.get(seat.generals[slot].generalDefinitionId)?.skills ?? []) add(slot, skill);
  }
  // Skills gained for good, then the chosen spare General's skill.
  for (const { slot, skillId } of seat.gainedSkills ?? []) add(slot, findSkill(registry, skillId));
  if (seat.forms?.chosen) {
    const { generalId, skillId } = seat.forms.chosen;
    add(seat.forms.slot, registry.generals.get(generalId)?.skills.find((s) => s.id === skillId));
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
