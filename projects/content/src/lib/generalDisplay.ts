import { alternateGeneralRecords } from './alternateGenerals';
import { alternateSkillFor } from './alternateSkills';
import { generalTextData, type GeneralDisplayData } from './display';
import { baseGeneralId, isAlternateGeneralId } from './generalIds';

// Presentation-facing view of a General. An Alternate skill carries `inGame`: whether the game plays it
// (as a variant or as Default's skill). This lives apart from display.ts because it reads the skill
// registry, and the General skills import display.ts.
export function generalDisplayData(id: string, locale = 'en'): GeneralDisplayData | null {
  const text = generalTextData(id, locale);
  if (!text || !isAlternateGeneralId(id)) return text;
  const record = alternateGeneralRecords().find((g) => g.id === baseGeneralId(id));
  if (!record) return null;
  return { ...text, skills: text.skills.map((s, i) => ({ ...s, inGame: alternateSkillFor(record, record.skills[i]) !== undefined })) };
}
