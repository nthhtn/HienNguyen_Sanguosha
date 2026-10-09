import { generalsData } from '../../../data/generals';
import { skillIdOf } from '../display';
import { BASE_GENERAL_IDS, FIRE_GENERAL_IDS, FOREST_GENERAL_IDS, GENERAL_SKILLS, MOUNTAIN_GENERAL_IDS, WIND_GENERAL_IDS } from './index';

describe('the base Generals', () => {
  it('define every skill in their data, in order, with matching Lord flags', () => {
    for (const id of BASE_GENERAL_IDS) {
      const defined = GENERAL_SKILLS.get(id) ?? [];
      const data = generalsData[id].skills;
      expect({ id, skills: defined.map((s) => s.id) }).toEqual({ id, skills: data.map((s) => skillIdOf(s.name)) });
      expect({ id, lord: defined.map((s) => !!s.lord) }).toEqual({ id, lord: data.map((s) => !!s.lord) });
    }
  });

  it('only base, Wind, Fire, Forest and Mountain Generals have skills', () => {
    expect([...GENERAL_SKILLS.keys()].sort()).toEqual([...BASE_GENERAL_IDS, ...WIND_GENERAL_IDS, ...FIRE_GENERAL_IDS, ...FOREST_GENERAL_IDS, ...MOUNTAIN_GENERAL_IDS].filter((id) => GENERAL_SKILLS.has(id)).sort());
  });

  it('every Wind General defines every skill in its data, in order, with matching Lord flags', () => {
    for (const id of WIND_GENERAL_IDS) {
      const defined = GENERAL_SKILLS.get(id) ?? [];
      const data = generalsData[id].skills;
      expect({ id, skills: defined.map((s) => s.id) }).toEqual({ id, skills: data.map((s) => skillIdOf(s.name)) });
      expect({ id, lord: defined.map((s) => !!s.lord) }).toEqual({ id, lord: data.map((s) => !!s.lord) });
    }
  });

  it('every Mountain General defines every skill in its data, in order, with matching Lord flags', () => {
    // Complete once all eight Generals are coded (stage 11, task 6).
    for (const id of MOUNTAIN_GENERAL_IDS.filter((g) => GENERAL_SKILLS.has(g))) {
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

  it('every Forest General defines every skill in its data, in order, with matching Lord flags', () => {
    for (const id of FOREST_GENERAL_IDS) {
      const defined = GENERAL_SKILLS.get(id) ?? [];
      const data = generalsData[id].skills;
      expect({ id, skills: defined.map((s) => s.id) }).toEqual({ id, skills: data.map((s) => skillIdOf(s.name)) });
      expect({ id, lord: defined.map((s) => !!s.lord) }).toEqual({ id, lord: data.map((s) => !!s.lord) });
    }
  });
});
