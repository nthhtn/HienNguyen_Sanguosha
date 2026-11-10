import { kingdomWarsGeneralRecords } from './kingdomWarsGenerals';
import { kingdomWarsSkillFor } from './kingdomWarsSkills';
import { generalTextData, type GeneralDisplayData } from './display';
import { GENERAL_SKILLS } from './generals';
import { generalsData } from '../../data/generals';
import { skillIdOf } from './skillId';
import { skillTraits } from './skillTraits';
import { baseGeneralId, isKingdomWarsGeneralId } from './generalIds';

// Presentation-facing view of a General. A Kingdom Wars skill carries `inGame`: whether the game plays it
// (as a variant or as Identity's skill). This lives apart from display.ts because it reads the skill
// registry, and the General skills import display.ts.
export function generalDisplayData(id: string, locale = 'en'): GeneralDisplayData | null {
  const text = generalTextData(id, locale);
  if (text && !isKingdomWarsGeneralId(id)) {
    const code = GENERAL_SKILLS.get(id);
    const data = generalsData[id]?.skills ?? [];
    return { ...text, skills: text.skills.map((s, i) => ({ ...s, traits: skillTraits(data[i] && code?.find((d) => d.id === skillIdOf(data[i].name))) })) };
  }
  if (!text) return text;
  const record = kingdomWarsGeneralRecords().find((g) => g.id === baseGeneralId(id));
  if (!record) return null;
  return { ...text, skills: text.skills.map((s, i) => ({ ...s, inGame: kingdomWarsSkillFor(record, record.skills[i]) !== undefined, traits: skillTraits(kingdomWarsSkillFor(record, record.skills[i])) })) };
}
