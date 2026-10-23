import * as fs from 'fs';
import * as path from 'path';
import { buildContentRegistry } from './registry';
import { alternateSkillFor } from './alternateSkills';
import { generalDisplayData } from './generalDisplay';
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

  it('plays both of Zou Shi’s skills, as Alternate variants of their own', () => {
    expect(byId('zou-shi').skills.map((s) => s.status)).toEqual(['worksAsAlternate', 'worksAsAlternate']);
    expect(byId('zou-shi').skillsRunAsDefault).toBe(false);
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

  it('plays Ji Ling’s skill, as an Alternate variant of its own', () => {
    expect(byId('ji-ling').skills.map((s) => s.status)).toEqual(['worksAsAlternate']);
  });

  it('plays Ma Teng’s skills, as Alternate variants of their own', () => {
    expect(byId('ma-teng').skills.map((s) => s.status)).toEqual(['worksAsAlternate', 'worksAsAlternate']);
  });

  it('plays Pan Feng’s skill, as an Alternate variant of its own', () => {
    expect(byId('pan-feng').skills.map((s) => s.status)).toEqual(['worksAsAlternate']);
  });

  it('plays Yue Jin’s skill, as an Alternate variant of its own', () => {
    expect(byId('yue-jin').skills.map((s) => s.status)).toEqual(['worksAsAlternate']);
  });

  it('pins exactly which Alternate skills the game plays as the Default skill (Nil Generals and the slice 4 wording-only skills)', () => {
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
      // Slice 4: wording-only differences, cleared as Default's.
      'cao-cao/Villainous Hero',
      'cao-pi/Banish',
      'cao-pi/Scavenge',
      'cao-ren/Entrenched',
      'guan-yu/Warrior Saint',
      'guo-jia/Envy of Heaven',
      'huang-zhong/Fearsome Archer',
      'jia-xu/Unmitigated Murder',
      'liu-shan/Devolution',
      'liu-shan/Relish',
      'lu-bu/Without Equal',
      'ma-chao/Horsemanship',
      'ma-chao/Iron Calvary',
      'pang-tong/Shackle',
      'sima-yi/Demonic Talent',
      'sima-yi/Retaliation',
      'sun-shangxiang/Marriage',
      'xiao-qiao/Heavenly Scent',
      'xiao-qiao/Rosy Cheeks',
      'xun-yu/Rouse the Tiger',
      'yuan-shao/Barrage',
      'zhang-he/Flexibility',
      'zhang-jiao/Dark Sorcery',
      'zhang-liao/Sudden Strike',
      'zhen-ji/Stunning Beauty',
      'zhou-yu/Heroic Demeanor',
      'zhou-yu/Sow Dissension',
      'zhu-rong/Giant Elephant',
      'zhuge-liang/Star Gazing',
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

  it('leaves no slice 2 General’s skill reading missing', () => {
    const missing = wikiAlternateGenerals()
      .filter((g) => SLICE_2.includes(g.id))
      .flatMap((g) => g.skills.filter((s) => s.status === 'missing').map((s) => `${g.id}/${s.name}`))
      .sort();
    expect(missing).toEqual([]);
  });
});

// Slice 4 turns this into a variant (Task 4).
const MISSING_ELSEWHERE = [
  'pang-tong/Resurrection',
];

describe('slice 3 new Generals', () => {
  const NEW = ['gan-fu-ren', 'yue-jin', 'ding-feng', 'pan-feng', 'tian-feng', 'kong-rong', 'ma-teng', 'ji-ling', 'zou-shi'];
  const statuses = () =>
    wikiAlternateGenerals()
      .filter((g) => NEW.includes(g.id))
      .flatMap((g) => g.skills.map((s) => `${g.id}/${s.name}=${s.status}`))
      .sort();

  it('reads worksAsAlternate for every skill of the nine, none missing (Ma Teng’s Horsemanship included)', () => {
    expect(statuses()).toEqual([
      'ding-feng/Close Combat=worksAsAlternate', 'ding-feng/Swift and Deadly=worksAsAlternate',
      'gan-fu-ren/Divine Wisdom=worksAsAlternate', 'gan-fu-ren/Prudence=worksAsAlternate',
      'ji-ling/Double Edged=worksAsAlternate',
      'kong-rong/Celebrity=worksAsAlternate', 'kong-rong/Comity=worksAsAlternate',
      'ma-teng/Call of Valour=worksAsAlternate', 'ma-teng/Horsemanship=worksAsAlternate',
      'pan-feng/Insanity Axe=worksAsAlternate',
      'tian-feng/Deathly Counsel=worksAsAlternate', 'tian-feng/With the Tide=worksAsAlternate',
      'yue-jin/Dauntless=worksAsAlternate',
      'zou-shi/Femme Fatale=worksAsAlternate', 'zou-shi/Impetus for Conflicts=worksAsAlternate',
    ].sort());
  });

  it('leaves no skill of the nine in the missing list, and pins every other General’s missing skills', () => {
    const missing = wikiAlternateGenerals()
      .flatMap((g) => g.skills.filter((s) => s.status === 'missing').map((s) => `${g.id}/${s.name}`));
    expect(missing.filter((m) => NEW.includes(m.split('/')[0]))).toEqual([]);
    expect(missing.sort()).toEqual(MISSING_ELSEWHERE);
  });

  it('marks each of the nine In game through the registry', () => {
    const registry = buildContentRegistry();
    for (const id of NEW) {
      const display = generalDisplayData(`alternate:${id}`, 'en')!;
      const registered = registry.generals.get(`alternate:${id}`)!.skills.map((s) => s.id);
      expect(registered.length).toBe(display.skills.length);
      expect(display.skills.every((s) => s.inGame)).toBe(true);
    }
  });
});
