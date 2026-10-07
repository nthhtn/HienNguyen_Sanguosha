import { generalsData } from '../../../data/generals';
import { skillIdOf } from '../display';
import { BASE_GENERAL_IDS, GENERAL_SKILLS } from './index';

describe('the base Generals', () => {
  it('define every skill in their data, in order, with matching Lord flags', () => {
    for (const id of BASE_GENERAL_IDS) {
      const defined = GENERAL_SKILLS.get(id) ?? [];
      const data = generalsData[id].skills;
      expect({ id, skills: defined.map((s) => s.id) }).toEqual({ id, skills: data.map((s) => skillIdOf(s.name)) });
      expect({ id, lord: defined.map((s) => !!s.lord) }).toEqual({ id, lord: data.map((s) => !!s.lord) });
    }
  });

  it('no expansion General has skills yet', () => {
    expect([...GENERAL_SKILLS.keys()].sort()).toEqual([...BASE_GENERAL_IDS].sort());
  });
});
