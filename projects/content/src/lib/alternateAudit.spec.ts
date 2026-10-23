import { alternateGeneralRecords } from './alternateGenerals';
import { generalsData } from '../../data/generals';
import { GENERAL_SKILLS } from './generals';
import { alternateSkillFor, isNilNote } from './alternateSkills';

const record = (id: string) => {
  const r = alternateGeneralRecords().find((g) => g.id === id);
  if (!r) throw new Error(`no record ${id}`);
  return r;
};

// Slice 4 audit: General id to the Alternate skills (Chinese names) read as wording-only differences.
const WORDING_ONLY: Readonly<Record<string, readonly string[]>> = {
  'zhuge-liang': ['观星'],
  'guan-yu': ['武圣'],
  'huang-zhong': ['烈弓'],
  'liu-shan': ['享乐', '放权'],
  'ma-chao': ['马术', '铁骑'],
  'pang-tong': ['连环'],
  'zhu-rong': ['巨象'],
  'cao-cao': ['奸雄'],
  'cao-pi': ['行殇', '放逐'],
  'cao-ren': ['据守'],
  'guo-jia': ['天妒'],
  'sima-yi': ['反馈', '鬼才'],
  'xun-yu': ['驱虎'],
  'zhang-he': ['巧变'],
  'zhang-liao': ['突击'],
  'zhen-ji': ['倾国'],
  'sun-shangxiang': ['结姻'],
  'xiao-qiao': ['天香', '红颜'],
  'zhou-yu': ['英姿', '反间'],
  'yuan-shao': ['乱击'],
  'zhang-jiao': ['鬼道'],
  'lu-bu': ['无双'],
  'jia-xu': ['完杀'],
};

describe('wording-only Alternate skills', () => {
  const cases = Object.entries(WORDING_ONLY).flatMap(([id, names]) => names.map((zh) => [id, zh] as const));

  it('covers 29 skills', () => {
    expect(cases).toHaveLength(29);
  });

  it.each(cases)('%s %s runs as a Default skill of the same General', (id, zh) => {
    const r = record(id);
    const skill = r.skills.find((s) => s.nameZh === zh);
    expect(skill).toBeDefined();
    const def = alternateSkillFor(r, skill!);
    expect(def).toBeDefined();
    expect(def!.id.startsWith('alternate:')).toBe(false);
    expect(GENERAL_SKILLS.get(id)).toContain(def);
  });

  it("runs Zhang Liao's Sudden Strike (突击) as Default's Raid, whose Chinese name is 突袭", () => {
    const r = record('zhang-liao');
    expect(alternateSkillFor(r, r.skills.find((s) => s.nameZh === '突击')!)?.id).toBe('raid');
  });
});

describe('the Nil Generals', () => {
  const nil = alternateGeneralRecords().filter((r) => isNilNote(r.differenceFromNormal));

  it('are 22', () => {
    expect(nil).toHaveLength(22);
  });

  // Marked Nil but Stubborn is replaced by Stabilization: a slice 2 variant, covered there.
  const sameAsDefault = nil.filter((r) => r.id !== 'zhang-zhao-and-zhang-hong');

  it.each(sameAsDefault.map((r) => [r.id]))('%s has the same skills and HP as Default', (id) => {
    const r = record(id);
    const d = generalsData[id];
    expect(d).toBeDefined();
    expect(r.skills.map((s) => s.nameZh)).toEqual(d.skills.filter((s) => !s.lord).map((s) => s.nameZh));
    if (r.hpFrom === 'default') expect(r.maxHp).toBe(d.maxHp);
  });
});
