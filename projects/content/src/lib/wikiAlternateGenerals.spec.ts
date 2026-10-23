import * as fs from 'fs';
import * as path from 'path';
import { buildContentRegistry } from './registry';
import { alternateSkillFor } from './alternateSkills';
import { alternateGeneralIds, alternateGeneralRecords } from './alternateGenerals';
import { alternateSkillStatus, wikiAlternateGeneralTabs, wikiAlternateGenerals } from './wikiAlternateGenerals';

const record = (id: string) => alternateGeneralRecords().find((r) => r.id === id)!;
const skillOf = (id: string, name: string) => record(id).skills.find((s) => s.name === name)!;

describe('alternateSkillStatus', () => {
  it('works as Default for Zhang Fei’s Berserk, which the game plays', () => {
    expect(alternateSkillStatus(record('zhang-fei'), record('zhang-fei').skills[0])).toBe('worksAsDefault');
  });

  it('works as Alternate for Liu Bei’s Benevolence, which has a variant', () => {
    expect(alternateSkillStatus(record('liu-bei'), record('liu-bei').skills[0])).toBe('worksAsAlternate');
  });

  it('works as Alternate for Zhang Zhao’s Stabilization, which has a variant', () => {
    expect(alternateSkillStatus(record('zhang-zhao-and-zhang-hong'), skillOf('zhang-zhao-and-zhang-hong', 'Stabilization'))).toBe('worksAsAlternate');
  });

  it('works as Alternate for both of Lu Xun’s skills: Humility and Scrutinize', () => {
    expect(alternateSkillStatus(record('lu-xun'), skillOf('lu-xun', 'Humility'))).toBe('worksAsAlternate');
    expect(alternateSkillStatus(record('lu-xun'), skillOf('lu-xun', 'Scrutinize'))).toBe('worksAsAlternate');
  });

  it('works as Alternate for Cai Wenji’s Sorrow, and as Default for her Dirge', () => {
    expect(alternateSkillStatus(record('cai-wenji'), skillOf('cai-wenji', 'Sorrow'))).toBe('worksAsAlternate');
    expect(alternateSkillStatus(record('cai-wenji'), skillOf('cai-wenji', 'Dirge'))).toBe('worksAsDefault');
  });

  it('works as Alternate for Zhen Ji’s Goddess Luo', () => {
    expect(alternateSkillStatus(record('zhen-ji'), skillOf('zhen-ji', 'Goddess Luo'))).toBe('worksAsAlternate');
  });

  it('is not missing exactly when the matching alternate: General has that skill in the registry', () => {
    const registry = buildContentRegistry();
    for (const rec of alternateGeneralRecords()) {
      const registered = registry.generals.get(`alternate:${rec.id}`)!.skills.map((s) => s.id);
      for (const skill of rec.skills) {
        const def = alternateSkillFor(rec, skill);
        expect(alternateSkillStatus(rec, skill) !== 'missing').toBe(def !== undefined);
        if (def) expect(registered).toContain(def.id);
      }
    }
  });
});

describe('wikiAlternateGenerals', () => {
  const generals = wikiAlternateGenerals();
  const byId = (id: string) => generals.find((g) => g.id === id)!;

  it('lists sixty Generals, fifteen per Kingdom, in Kingdom order', () => {
    expect(generals).toHaveLength(60);
    expect([...new Set(generals.map((g) => g.kingdom))]).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    for (const k of ['Wei', 'Shu', 'Wu', 'Qun']) expect(generals.filter((g) => g.kingdom === k)).toHaveLength(15);
  });

  it('gives every General HP, gender and at least one skill', () => {
    for (const g of generals) {
      expect([3, 4]).toContain(g.maxHp);
      expect(['male', 'female']).toContain(g.gender);
      expect(g.skills.length).toBeGreaterThan(0);
    }
  });

  it('keeps the two Zhuge Liangs on Default’s ids', () => {
    for (const id of ['zhuge-liang', 'fire-zhuge-liang']) {
      expect(byId(id)).toMatchObject({ kingdom: 'Shu', maxHp: 3, gender: 'male' });
    }
  });

  it('marks every skill of a General with no Default counterpart as not in game, until its task lands', () => {
    for (const id of ['ji-ling', 'ma-teng', 'zou-shi']) {
      expect(byId(id).skills.map((s) => s.status)).toEqual(byId(id).skills.map(() => 'missing'));
      expect(byId(id).skillsRunAsDefault).toBe(false);
    }
  });

  it('plays both of Gan Fu Ren’s skills, as Alternate variants of their own', () => {
    expect(byId('gan-fu-ren').skills.map((s) => s.status)).not.toContain('missing');
    expect(byId('gan-fu-ren').skills.map((s) => s.status)).toEqual(['worksAsAlternate', 'worksAsAlternate']);
  });

  it('plays both of Ding Feng’s skills, as Alternate variants of their own', () => {
    expect(byId('ding-feng').skills.map((s) => s.status)).toEqual(['worksAsAlternate', 'worksAsAlternate']);
  });

  it('plays Tian Feng’s skills, as Alternate variants of their own', () => {
    expect(byId('tian-feng').skills.map((s) => s.status)).toEqual(['worksAsAlternate', 'worksAsAlternate']);
  });

  it('plays Kong Rong’s skills, as Alternate variants of their own', () => {
    expect(byId('kong-rong').skills.map((s) => s.status)).toEqual(['worksAsAlternate', 'worksAsAlternate']);
  });

  it('plays Pan Feng’s skill, as an Alternate variant of its own', () => {
    expect(byId('pan-feng').skills.map((s) => s.status)).toEqual(['worksAsAlternate']);
  });

  it('plays Yue Jin’s skill, as an Alternate variant of its own', () => {
    expect(byId('yue-jin').skills.map((s) => s.status)).toEqual(['worksAsAlternate']);
  });

  it('pins exactly which Alternate skills the game plays (those of Generals whose difference note is nil)', () => {
    const working = generals.flatMap((g) => g.skills.filter((s) => s.status === 'worksAsDefault').map((s) => `${g.id}/${s.name}`)).sort();
    expect(working).toEqual([
      'cai-wenji/Dirge', 'da-qiao/Displacement', 'da-qiao/National Beauty', 'dian-wei/Ferocious Assault',
      'fire-zhuge-liang/Arson', 'fire-zhuge-liang/Eight Trigrams', 'fire-zhuge-liang/Scient',
      'gan-ning/Surprise Raid', 'hua-tuo/First Aid', 'hua-tuo/Green Salve', 'huang-gai/Trojan Flesh', 'huang-yueying/Genius',
      'lu-meng/Self-Mastery', 'lu-su/Alliance', 'lu-su/Altruism', 'meng-huo/Arise Again', 'meng-huo/The Smoking Gun',
      'pang-de/Fearsome Advance', 'pang-de/Horsemanship', 'sun-jian/Heroic Spirit', 'taishi-ci/Justice of Heaven',
      'wei-yan/Insanity Streak', 'xiahou-dun/An Eye for an Eye', 'xiahou-yuan/Godspeed', 'xu-chu/Bare-Chested',
      'xu-huang/Blockade', 'yan-liang-and-wen-chou/Dual Heroes', 'zhang-fei/Berserk',
      'zhang-zhao-and-zhang-hong/Blunt advice', 'zhao-yun/Dragon Heart', 'zhou-tai/Refuting Death',
    ].sort());
  });

  it('carries the partners and the Difference note from the data', () => {
    expect(byId('liu-bei').partners).toContain('Guan Yu 关羽 (Sworn Brother)');
    expect(byId('liu-bei').differenceNote).toMatch(/weakened/);
  });

  it('is in step with the per-General files the crawl writes', () => {
    const root = path.join(__dirname, '../../data/decks/alternate/generals');
    const files = fs.readdirSync(root).flatMap((force) =>
      fs.statSync(path.join(root, force)).isDirectory()
        ? fs.readdirSync(path.join(root, force)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(root, force, f), 'utf8')))
        : [],
    );
    const sort = (list: { id: string }[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(alternateGeneralRecords())).toEqual(sort(files));
    expect(alternateGeneralIds()).toHaveLength(60);
  });
});

describe('wikiAlternateGeneralTabs', () => {
  it('has the four Kingdoms in order, 15 Generals each', () => {
    const tabs = wikiAlternateGeneralTabs();
    expect(tabs.map((t) => t.key)).toEqual(['wei', 'shu', 'wu', 'qun']);
    expect(tabs.map((t) => t.label)).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    expect(tabs.map((t) => t.entries.length)).toEqual([15, 15, 15, 15]);
  });
});

describe('slice 2 variant Generals', () => {
  const SLICE_2 = ['liu-bei', 'sun-quan', 'xun-yu', 'zhu-rong', 'huang-yueying', 'sun-shangxiang', 'diao-chan', 'zhuge-liang', 'lu-xun', 'jia-xu', 'guo-jia', 'zhang-zhao-and-zhang-hong', 'zhen-ji', 'cai-wenji'];

  it('leaves only the skills deferred to slice 4 reading missing', () => {
    const missing = wikiAlternateGenerals()
      .filter((g) => SLICE_2.includes(g.id))
      .flatMap((g) => g.skills.filter((s) => s.status === 'missing').map((s) => `${g.id}/${s.name}`))
      .sort();
    expect(missing).toEqual([
      'guo-jia/Envy of Heaven', 'jia-xu/Descend into Chaos', 'jia-xu/Unmitigated Murder', 'sun-shangxiang/Marriage',
      'xun-yu/Rouse the Tiger', 'zhen-ji/Stunning Beauty', 'zhu-rong/Giant Elephant', 'zhuge-liang/Star Gazing',
    ]);
  });
});
