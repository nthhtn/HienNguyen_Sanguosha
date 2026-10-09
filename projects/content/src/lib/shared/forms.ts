import type { ContentRegistry, GameState } from 'engine';

export interface FormSkill { generalId: string; skillId: string }

// The skills Zuo Ci may choose now: those of the Generals he holds, except Lord,
// awakening and limited skills, and the one already chosen.
export function formSkillOptions(state: GameState, seatId: string, registry: ContentRegistry): FormSkill[] {
  const forms = state.seats.find((s) => s.id === seatId)?.forms;
  if (!forms) return [];
  return forms.held.flatMap((generalId) =>
    (registry.generals.get(generalId)?.skills ?? [])
      .filter((s) => !s.lord && !s.awakening && !s.limited && !(forms.chosen?.generalId === generalId && forms.chosen.skillId === s.id))
      .map((s) => ({ generalId, skillId: s.id }))
  );
}
