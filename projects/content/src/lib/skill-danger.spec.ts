import { buildContentRegistry } from './registry';
import { skillDanger } from './skill-danger';
import skillDangerData from '../../data/decks/kingdom-wars/skill-danger.json';

const registry = buildContentRegistry();
const kingdomWarsGenerals = [...registry.generals.values()].filter((g) => g.id.startsWith('kingdomWars:'));
const rated = (g: { skills: { id: string; lord?: boolean }[] }) => g.skills.filter((s) => !s.lord);

describe('skillDanger', () => {
  it('rates every non-Lord skill of every Kingdom Wars General', () => {
    expect(kingdomWarsGenerals.length).toBeGreaterThan(0);
    const missing = kingdomWarsGenerals.flatMap((g) => rated(g).filter((s) => !skillDanger(s.id)).map((s) => `${g.id}:${s.id}`));
    expect(missing).toEqual([]);
  });

  it('names no skill that does not exist on a Kingdom Wars General', () => {
    const known = new Set(kingdomWarsGenerals.flatMap((g) => rated(g).map((s) => s.id)));
    expect(Object.keys(skillDangerData).filter((id) => !known.has(id))).toEqual([]);
  });

  it('uses only high, medium and low', () => {
    expect(Object.values(skillDangerData).every((r) => ['high', 'medium', 'low'].includes(r))).toBe(true);
  });

  it('has no rating for an unknown id', () => {
    expect(skillDanger('no-such-skill')).toBeUndefined();
    expect(skillDanger('toString')).toBeUndefined();
  });

  it('reads a known rating', () => {
    expect(skillDanger('sow-revolt')).toBe('high');
  });
});
