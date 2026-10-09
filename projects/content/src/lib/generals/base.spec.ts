import { generalsData } from '../../../data/generals';
import { skillIdOf } from '../display';
import { BASE_GENERAL_IDS, FIRE_GENERAL_IDS, GENERAL_SKILLS, WIND_GENERAL_IDS } from './index';

describe('the base Generals', () => {
  it('define every skill in their data, in order, with matching Lord flags', () => {
    for (const id of BASE_GENERAL_IDS) {
      const defined = GENERAL_SKILLS.get(id) ?? [];
      const data = generalsData[id].skills;
      expect({ id, skills: defined.map((s) => s.id) }).toEqual({ id, skills: data.map((s) => skillIdOf(s.name)) });
      expect({ id, lord: defined.map((s) => !!s.lord) }).toEqual({ id, lord: data.map((s) => !!s.lord) });
    }
  });

  it('only base, Wind and Fire Generals have skills', () => {
    expect([...GENERAL_SKILLS.keys()].sort()).toEqual([...BASE_GENERAL_IDS, ...WIND_GENERAL_IDS, ...FIRE_GENERAL_IDS].filter((id) => GENERAL_SKILLS.has(id)).sort());
  });

  it('every Wind General defines every skill in its data, in order, with matching Lord flags', () => {
    for (const id of WIND_GENERAL_IDS) {
      const defined = GENERAL_SKILLS.get(id) ?? [];
      const data = generalsData[id].skills;
      expect({ id, skills: defined.map((s) => s.id) }).toEqual({ id, skills: data.map((s) => skillIdOf(s.name)) });
      expect({ id, lord: defined.map((s) => !!s.lord) }).toEqual({ id, lord: data.map((s) => !!s.lord) });
    }
  });

  it('every Fire General defines every skill in its data, in order, with matching Lord flags', () => {
    for (const id of FIRE_GENERAL_IDS) {
      const defined = GENERAL_SKILLS.get(id) ?? [];
      const data = generalsData[id].skills;
      expect({ id, skills: defined.map((s) => s.id) }).toEqual({ id, skills: data.map((s) => skillIdOf(s.name)) });
      expect({ id, lord: defined.map((s) => !!s.lord) }).toEqual({ id, lord: data.map((s) => !!s.lord) });
    }
  });
});
