import { alternateGeneralRecords } from './alternateGenerals';
import { generalsData } from '../../data/generals';
import { GENERAL_SKILLS } from './generals';
import { skillIdOf } from './skillId';
import { hasAlternateVariant, isNilNote, readyAlternateSkills, CLEARED_WORDING } from './alternateSkills';

const record = (id: string) => {
  const r = alternateGeneralRecords().find((g) => g.id === id);
  if (!r) throw new Error(`no record ${id}`);
  return r;
};
const readyIds = (id: string) => readyAlternateSkills(record(id)).map((s) => s.id);

describe('isNilNote', () => {
  it('accepts Nil in any case, trimmed, with or without a full stop', () => {
    expect(isNilNote('Nil.')).toBe(true);
    expect(isNilNote(' nil ')).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isNilNote(null)).toBe(false);
    expect(isNilNote('Nil, but weaker')).toBe(false);
  });
});

describe('readyAlternateSkills', () => {
  it('runs Zhang Fei (Nil) as Default Roar, the very same definition', () => {
    expect(readyIds('zhang-fei')).toEqual(['roar']);
    expect(readyAlternateSkills(record('zhang-fei'))[0]).toBe(GENERAL_SKILLS.get('zhang-fei')![0]);
  });
  it('runs Liu Bei as the Alternate Benevolence variant', () => {
    expect(readyIds('liu-bei')).toEqual(['alternate:benevolence']);
  });
  it('matches by Chinese name: Zhang Zhao and Zhang Hong get Direct Instruction and Stabilization but not Stubborn', () => {
    const data = generalsData['zhang-zhao-and-zhang-hong'];
    const direct = skillIdOf(data.skills.find((s) => s.nameZh === '直谏')!.name);
    const stubborn = skillIdOf(data.skills.find((s) => s.nameZh === '固执')!.name);
    const ids = readyIds('zhang-zhao-and-zhang-hong');
    expect(ids).toContain(direct);
    expect(ids).toContain('alternate:stabilization');
    expect(ids).not.toContain(stubborn);
  });
  it('runs only their own Alternate variants for Generals missing from Default (none yet for most), without throwing', () => {
    const missing = alternateGeneralRecords().filter((g) => !generalsData[g.id]);
    expect(missing.length).toBeGreaterThanOrEqual(9);
    expect(missing.map((g) => g.id)).toContain('gan-fu-ren');
    for (const g of missing) for (const skill of readyAlternateSkills(g)) expect(skill.id.startsWith('alternate:')).toBe(true);
    expect(readyIds('gan-fu-ren')).toEqual(['alternate:prudence', 'alternate:divine-wisdom']);
    expect(readyIds('yue-jin')).toEqual(['alternate:dauntless']);
    expect(readyIds('pan-feng')).toEqual(['alternate:insanity-axe']);
    expect(readyIds('tian-feng')).toEqual(['alternate:deathly-counsel', 'alternate:with-the-tide']);
    expect(readyIds('kong-rong')).toEqual(['alternate:celebrity', 'alternate:comity']);
    expect(readyIds('ding-feng')).toEqual(['alternate:close-combat', 'alternate:swift-and-deadly']);
  });
  it('never runs a Lord skill', () => {
    for (const g of alternateGeneralRecords()) {
      for (const s of readyAlternateSkills(g)) expect(s.lord).not.toBe(true);
    }
  });
  it('clears Huang Yueying’s Genius', () => {
    expect(CLEARED_WORDING['huang-yueying']).toEqual(['奇才']);
  });
  it('clears Cai Wenji’s Dirge (unchanged from Lament)', () => {
    expect(CLEARED_WORDING['cai-wenji']).toEqual(['悲歌']);
  });
  it('clears wording only for skills the Alternate records have', () => {
    for (const [id, names] of Object.entries(CLEARED_WORDING)) {
      const rec = alternateGeneralRecords().find((g) => g.id === id);
      expect(rec).toBeDefined();
      for (const nameZh of names) expect(rec!.skills.some((s) => s.nameZh === nameZh)).toBe(true);
    }
  });
});

describe('hasAlternateVariant', () => {
  it('is true for Liu Bei’s Benevolence and false for Zhang Fei’s Roar', () => {
    const skill = (id: string, zh: string) => record(id).skills.find((s) => s.nameZh === zh)!;
    expect(hasAlternateVariant(record('liu-bei'), skill('liu-bei', '仁德'))).toBe(true);
    expect(hasAlternateVariant(record('zhang-fei'), skill('zhang-fei', '咆哮'))).toBe(false);
  });
});
