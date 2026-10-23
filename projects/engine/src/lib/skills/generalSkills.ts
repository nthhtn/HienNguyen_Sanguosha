import { GameState, GeneralOwner, Seat } from '../domain/types';
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

// Whether the General in `slot` has lost its skills: the whole seat silenced (Heartbroken), or that
// General alone (Alternate Sorrow). Its printed skills, those gained under it and a Form it chose.
export function slotSilenced(seat: Pick<Seat, 'silenced' | 'silencedSlots'>, slot: 'main' | 'deputy'): boolean {
  return !!seat.silenced || !!seat.silencedSlots?.includes(slot);
}

// The skills of `seatId`'s Generals that are in play, Main first, in skill
// order. All of a revealed General's. A hidden General's compulsory skills are
// off (its modifiers with them); its other skills are offered, but using one
// reveals it. Lord skills never are: Kingdom War has no Lord. An eliminated
// seat has none, nor a silenced General (slotSilenced), hidden or not. While
// another seat's skill blocks its reveals (revealBlockedFor), a hidden General
// offers nothing at all: no skill of it can be used, asked or fired.
// `withHiddenCompulsory`: also a hidden General's compulsory skills (needsReveal), for the triggers that ask
// to reveal it (gatherTriggeredSkills); their modifiers stay off, so queries leave this out.
export function skillsInPlay(state: GameState, seatId: string, registry: ContentRegistry, withHiddenCompulsory = false): SkillInPlay[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.eliminated || !seat.generals || seat.silenced) return [];
  const found: SkillInPlay[] = [];
  let blockedMemo: boolean | undefined;
  const blocked = () => (blockedMemo ??= revealBlockedFor(state, seatId, registry));
  // `unique`: a gained or borrowed skill the seat already holds on its other General adds nothing.
  const add = (slot: 'main' | 'deputy', skill: SkillDefinition | undefined, unique = false) => {
    const general = seat.generals![slot];
    if (!skill || skill.lord || slotSilenced(seat, slot) || (!general.revealed && skill.compulsory && !withHiddenCompulsory)) return;
    if (!general.revealed && blocked()) return;
    if (found.some((f) => f.skill.id === skill.id && (unique || f.owner.slot === slot))) return;
    found.push({ owner: { kind: 'general', seatId, slot, skillId: skill.id }, skill, needsReveal: !general.revealed });
  };
  for (const slot of SLOTS) {
    for (const skill of registry.generals.get(seat.generals[slot].generalDefinitionId)?.skills ?? []) add(slot, skill);
  }
  // Skills gained for good, then the chosen spare General's skill.
  for (const { slot, skillId } of seat.gainedSkills ?? []) add(slot, findSkill(registry, skillId), true);
  if (seat.forms?.chosen) {
    const { generalId, skillId } = seat.forms.chosen;
    add(seat.forms.slot, registry.generals.get(generalId)?.skills.find((s) => s.id === skillId), true);
  }
  return found;
}

// Whether `seatId` may not reveal a General now: it is another seat's turn, and
// the turn owner holds a skill with blocksOtherReveals on a revealed General
// whose skills it still has (Femme Fatale). Every reveal by choice or by an ask
// consults this; a death's reveal never does.
export function revealBlockedFor(state: GameState, seatId: string, registry: ContentRegistry): boolean {
  const ownerId = state.turn.ownerSeatId;
  if (ownerId === seatId) return false;
  const owner = state.seats.find((s) => s.id === ownerId);
  if (!owner?.generals || owner.eliminated || owner.silenced) return false;
  return heldSkills(state, ownerId, registry).some(
    ({ owner: held, skill }) => !!skill.blocksOtherReveals && !skill.lord && owner.generals![held.slot].revealed && !slotSilenced(owner, held.slot)
  );
}

// Every skill `seatId` holds, whether or not it is in play: printed skills of both Generals,
// skills gained for good, and the chosen Form's skill. Elimination, hiddenness and silencing
// are ignored; the caller decides what those mean. No duplicates by (skill, slot).
export function heldSkills(state: GameState, seatId: string, registry: ContentRegistry): Array<{ owner: GeneralOwner; skill: SkillDefinition }> {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat?.generals) return [];
  const held: Array<{ owner: GeneralOwner; skill: SkillDefinition }> = [];
  const add = (slot: 'main' | 'deputy', skill: SkillDefinition | undefined) => {
    if (!skill || held.some((h) => h.skill.id === skill.id && h.owner.slot === slot)) return;
    held.push({ owner: { kind: 'general', seatId, slot, skillId: skill.id }, skill });
  };
  for (const slot of SLOTS) {
    for (const skill of registry.generals.get(seat.generals[slot].generalDefinitionId)?.skills ?? []) add(slot, skill);
  }
  for (const { slot, skillId } of seat.gainedSkills ?? []) add(slot, findSkill(registry, skillId));
  if (seat.forms?.chosen) {
    const { generalId, skillId } = seat.forms.chosen;
    add(seat.forms.slot, registry.generals.get(generalId)?.skills.find((s) => s.id === skillId));
  }
  return held;
}

// The skill behind a General owner (printed, gained or borrowed), whether or not it is in play now.
export function skillOf(state: GameState, owner: GeneralOwner, registry: ContentRegistry): SkillDefinition | undefined {
  const seat = state.seats.find((s) => s.id === owner.seatId);
  // A silenced seat holds nothing; a silenced General holds nothing.
  if (seat && slotSilenced(seat, owner.slot)) return undefined;
  const general = seat?.generals?.[owner.slot];
  const own = general && registry.generals.get(general.generalDefinitionId)?.skills.find((s) => s.id === owner.skillId);
  if (own || !seat) return own;
  // A skill the General gained, or borrowed from the Form chosen by its slot.
  if (seat.gainedSkills?.some((g) => g.slot === owner.slot && g.skillId === owner.skillId)) return findSkill(registry, owner.skillId);
  const chosen = seat.forms?.slot === owner.slot ? seat.forms.chosen : undefined;
  return chosen && chosen.skillId === owner.skillId ? registry.generals.get(chosen.generalId)?.skills.find((s) => s.id === owner.skillId) : undefined;
}

// The key an active skill's uses are counted under in Turn.abilityUses.
export function abilityUseKey(owner: GeneralOwner): string {
  return `${owner.seatId}/${owner.slot}/${owner.skillId}`;
}
