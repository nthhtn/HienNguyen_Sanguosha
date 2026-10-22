import { alternateGeneralRecords } from './alternateGenerals';
import { generalsData } from '../../data/generals';
import { ALTERNATE_VARIANTS } from './alternateVariants';
import { skillIdOf } from './skillId';

const records = alternateGeneralRecords();
const entries = Object.entries(ALTERNATE_VARIANTS).flatMap(([generalId, bySkill]) =>
  Object.entries(bySkill).map(([nameZh, variant]) => ({ generalId, nameZh, variant })));

describe('ALTERNATE_VARIANTS', () => {
  it('registers at least Liu Bei’s Benevolence', () => {
    expect(ALTERNATE_VARIANTS['liu-bei']?.['仁德']?.id).toBe('alternate:benevolence');
  });

  it('keys only Generals and Chinese skill names the Alternate records have', () => {
    for (const { generalId, nameZh } of entries) {
      const rec = records.find((r) => r.id === generalId);
      expect(rec).toBeDefined();
      expect(rec!.skills.some((s) => s.nameZh === nameZh)).toBe(true);
    }
  });

  it('names each variant alternate: plus the id of the record skill’s English name', () => {
    for (const { generalId, nameZh, variant } of entries) {
      const skill = records.find((r) => r.id === generalId)!.skills.find((s) => s.nameZh === nameZh)!;
      expect(variant.id).toBe(`alternate:${skillIdOf(skill.name)}`);
    }
  });

  it('never reuses a Default skill id, and every id is unique', () => {
    const defaultIds = new Set(Object.values(generalsData).flatMap((g) => g.skills.map((s) => skillIdOf(s.name))));
    const ids = entries.map((e) => e.variant.id);
    for (const id of ids) expect(defaultIds.has(id)).toBe(false);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
