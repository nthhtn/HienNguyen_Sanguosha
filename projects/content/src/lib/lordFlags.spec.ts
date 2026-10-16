import { generalsData } from '../../data/generals';
import { skillIdOf } from './display';
import { buildContentRegistry } from './registry';

describe('Lord flags', () => {
  it("every skill's lord flag in the General data matches its SkillDefinition", () => {
    const registry = buildContentRegistry();
    for (const [id, general] of Object.entries(generalsData)) {
      const skills = registry.generals.get(id)?.skills ?? [];
      for (const dataSkill of general.skills) {
        const definition = skills.find((s) => s.id === skillIdOf(dataSkill.name));
        // Data-only Generals carry no coded skills; only compare where the skill is coded.
        if (!definition && skills.length === 0) continue;
        expect({ general: id, skill: dataSkill.name, defined: Boolean(definition), lord: Boolean(dataSkill.lord) })
          .toEqual({ general: id, skill: dataSkill.name, defined: true, lord: Boolean(definition?.lord) });
      }
    }
  });
});
