import skillDangerData from '../../data/decks/kingdom-wars/skill-danger.json';

export type SkillDanger = 'high' | 'medium' | 'low';

// A hand rating of how dangerous a Kingdom Wars skill is to face, keyed by skill id (base ids like
// `sow-revolt`, variant ids like `kingdomWars:benevolence`). Lord skills are not rated. Criteria:
// high is damage or card taking/discarding on the owner's own initiative each turn (or making the owner
// very hard to damage); medium is the same but conditional or reactive, once per game, or strong draw;
// low is everything else. Bots read it as data; there is no per-skill code.
const RATINGS = skillDangerData as Record<string, SkillDanger>;

export function skillDanger(skillId: string): SkillDanger | undefined {
  return Object.prototype.hasOwnProperty.call(RATINGS, skillId) ? RATINGS[skillId] : undefined;
}
