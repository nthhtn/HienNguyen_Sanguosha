import { baseGeneralId, skillDanger } from 'content';
import { dangerOf, generalDanger } from './danger';
import { GENERAL_VALUES } from './general-values';
import { registry } from './testing';

const kw = [...registry.generals.values()].filter((g) => g.id.startsWith('kingdomWars:'));
const value = (id: string) => GENERAL_VALUES[baseGeneralId(id)] ?? 0;
const weight = (r?: string) => (r === 'high' ? 2 : r === 'medium' ? 1 : 0);

describe('generalDanger', () => {
  it('is 2 plus 10 x its value for a General with a high and a low skill', () => {
    const g = kw.find((x) => x.skills.some((s) => skillDanger(s.id) === 'high') && x.skills.some((s) => skillDanger(s.id) === 'low'))!;
    expect(g).toBeDefined();
    expect(generalDanger(g.id, registry)).toBeCloseTo(2 + 10 * value(g.id), 10);
  });

  it('takes the highest rating over the skills, never the sum', () => {
    for (const g of kw) {
      const max = Math.max(0, ...g.skills.filter((s) => !s.lord).map((s) => weight(skillDanger(s.id))));
      expect(generalDanger(g.id, registry)).toBeCloseTo(max + 10 * value(g.id), 10);
    }
  });

  it('counts an unrated skill as 0 and an unknown General as 0', () => {
    expect(generalDanger('no-such-general', registry)).toBe(0);
    const g = kw.find((x) => x.skills.every((s) => s.lord || skillDanger(s.id) === 'low'))!;
    expect(g).toBeDefined();
    expect(generalDanger(g.id, registry)).toBeCloseTo(10 * value(g.id), 10);
  });

  it('adapts to the (generalId) => number the table takes', () => {
    const id = kw[0].id;
    expect(dangerOf(registry)(id)).toBe(generalDanger(id, registry));
  });
});
