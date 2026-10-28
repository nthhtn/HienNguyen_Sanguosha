import * as fs from 'fs';
import * as path from 'path';
import { buildContentRegistry } from './registry';
import { kingdomWarsSkillFor } from './kingdomWarsSkills';
import { generalDisplayData } from './generalDisplay';
import { kingdomWarsGeneralIds, kingdomWarsGeneralRecords } from './kingdomWarsGenerals';
import { kingdomWarsSkillStatus, wikiKingdomWarsGeneralTabs, wikiKingdomWarsGenerals } from './wikiKingdomWarsGenerals';

const record = (id: string) => kingdomWarsGeneralRecords().find((r) => r.id === id)!;
const skillOf = (id: string, name: string) => record(id).skills.find((s) => s.name === name)!;

describe('kingdomWarsSkillStatus', () => {
  it('works as Dynasty Wars for Zhang Fei’s Berserk, which the game plays', () => {
    expect(kingdomWarsSkillStatus(record('zhang-fei'), record('zhang-fei').skills[0])).toBe('worksAsDynastyWars');
  });

  it('works as Kingdom Wars for Liu Bei’s Benevolence, which has a variant', () => {
    expect(kingdomWarsSkillStatus(record('liu-bei'), record('liu-bei').skills[0])).toBe('worksAsKingdomWars');
  });

  it('works as Kingdom Wars for Zhang Zhao’s Stabilization, which has a variant', () => {
    expect(kingdomWarsSkillStatus(record('zhang-zhao-and-zhang-hong'), skillOf('zhang-zhao-and-zhang-hong', 'Stabilization'))).toBe('worksAsKingdomWars');
  });

  it('works as Kingdom Wars for both of Lu Xun’s skills: Humility and Scrutinize', () => {
    expect(kingdomWarsSkillStatus(record('lu-xun'), skillOf('lu-xun', 'Humility'))).toBe('worksAsKingdomWars');
    expect(kingdomWarsSkillStatus(record('lu-xun'), skillOf('lu-xun', 'Scrutinize'))).toBe('worksAsKingdomWars');
  });

  it('works as Kingdom Wars for Cai Wenji’s Sorrow, and as Dynasty Wars for her Dirge', () => {
    expect(kingdomWarsSkillStatus(record('cai-wenji'), skillOf('cai-wenji', 'Sorrow'))).toBe('worksAsKingdomWars');
    expect(kingdomWarsSkillStatus(record('cai-wenji'), skillOf('cai-wenji', 'Dirge'))).toBe('worksAsDynastyWars');
  });

  it('works as Kingdom Wars for Zhen Ji’s Goddess Luo', () => {
    expect(kingdomWarsSkillStatus(record('zhen-ji'), skillOf('zhen-ji', 'Goddess Luo'))).toBe('worksAsKingdomWars');
  });

  it('is not missing exactly when the matching kingdomWars: General has that skill in the registry', () => {
    const registry = buildContentRegistry();
    for (const rec of kingdomWarsGeneralRecords()) {
      const registered = registry.generals.get(`kingdomWars:${rec.id}`)!.skills.map((s) => s.id);
      for (const skill of rec.skills) {
        const def = kingdomWarsSkillFor(rec, skill);
        expect(kingdomWarsSkillStatus(rec, skill) !== 'missing').toBe(def !== undefined);
        if (def) expect(registered).toContain(def.id);
      }
    }
  });
});

describe('wikiKingdomWarsGenerals', () => {
  const generals = wikiKingdomWarsGenerals();
  const byId = (id: string) => generals.find((g) => g.id === id)!;

  it('lists sixty Generals, fifteen per Kingdom, in Kingdom order', () => {
    expect(generals).toHaveLength(60);
    expect([...new Set(generals.map((g) => g.kingdom))]).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    for (const k of ['Wei', 'Shu', 'Wu', 'Qun']) expect(generals.filter((g) => g.kingdom === k)).toHaveLength(15);
  });

  it('gives every General HP, gender and at least one skill', () => {
    for (const g of generals) {
      expect([3, 4, 5]).toContain(g.maxHp);
      expect(['male', 'female']).toContain(g.gender);
      expect(g.skills.length).toBeGreaterThan(0);
    }
  });

  it('keeps the two Zhuge Liangs on Dynasty Wars’ ids', () => {
    for (const id of ['zhuge-liang', 'fire-zhuge-liang']) {
      expect(byId(id)).toMatchObject({ kingdom: 'Shu', maxHp: 3, gender: 'male' });
    }
  });

  it('plays both of Zou Shi’s skills, as Kingdom Wars variants of their own', () => {
    expect(byId('zou-shi').skills.map((s) => s.status)).toEqual(['worksAsKingdomWars', 'worksAsKingdomWars']);
    expect(byId('zou-shi').skillsWorking).toBe(true);
  });

  it('plays both of Gan Fu Ren’s skills, as Kingdom Wars variants of their own', () => {
    expect(byId('gan-fu-ren').skills.map((s) => s.status)).not.toContain('missing');
    expect(byId('gan-fu-ren').skills.map((s) => s.status)).toEqual(['worksAsKingdomWars', 'worksAsKingdomWars']);
  });

  it('plays both of Ding Feng’s skills, as Kingdom Wars variants of their own', () => {
    expect(byId('ding-feng').skills.map((s) => s.status)).toEqual(['worksAsKingdomWars', 'worksAsKingdomWars']);
  });

  it('plays Tian Feng’s skills, as Kingdom Wars variants of their own', () => {
    expect(byId('tian-feng').skills.map((s) => s.status)).toEqual(['worksAsKingdomWars', 'worksAsKingdomWars']);
  });

  it('plays Kong Rong’s skills, as Kingdom Wars variants of their own', () => {
    expect(byId('kong-rong').skills.map((s) => s.status)).toEqual(['worksAsKingdomWars', 'worksAsKingdomWars']);
  });

  it('plays Ji Ling’s skill, as a Kingdom Wars variant of its own', () => {
    expect(byId('ji-ling').skills.map((s) => s.status)).toEqual(['worksAsKingdomWars']);
  });

  it('plays Ma Teng’s skills, as Kingdom Wars variants of their own', () => {
    expect(byId('ma-teng').skills.map((s) => s.status)).toEqual(['worksAsKingdomWars', 'worksAsKingdomWars']);
  });

  it('plays Pan Feng’s skill, as a Kingdom Wars variant of its own', () => {
    expect(byId('pan-feng').skills.map((s) => s.status)).toEqual(['worksAsKingdomWars']);
  });

  it('plays Yue Jin’s skill, as a Kingdom Wars variant of its own', () => {
    expect(byId('yue-jin').skills.map((s) => s.status)).toEqual(['worksAsKingdomWars']);
  });

  it('pins exactly which Kingdom Wars skills the game plays as the Dynasty Wars skill (Nil Generals and the slice 4 wording-only skills)', () => {
    const working = generals.flatMap((g) => g.skills.filter((s) => s.status === 'worksAsDynastyWars').map((s) => `${g.id}/${s.name}`)).sort();
    expect(working).toEqual([
      'cai-wenji/Dirge', 'da-qiao/Displacement', 'da-qiao/National Beauty', 'dian-wei/Ferocious Assault',
      'fire-zhuge-liang/Arson', 'fire-zhuge-liang/Eight Trigrams', 'fire-zhuge-liang/Scient',
      'gan-ning/Surprise Raid', 'hua-tuo/First Aid', 'hua-tuo/Green Salve', 'huang-gai/Trojan Flesh', 'huang-yueying/Genius',
      'lu-meng/Self-Mastery', 'lu-su/Alliance', 'lu-su/Altruism', 'meng-huo/Arise Again', 'meng-huo/The Smoking Gun',
      'pang-de/Fearsome Advance', 'pang-de/Horsemanship', 'sun-jian/Heroic Spirit', 'taishi-ci/Justice of Heaven',
      'wei-yan/Insanity Streak', 'xiahou-dun/An Eye for an Eye', 'xiahou-yuan/Godspeed', 'xu-chu/Bare-Chested',
      'xu-huang/Blockade', 'yan-liang-and-wen-chou/Dual Heroes', 'zhang-fei/Berserk',
      'zhang-zhao-and-zhang-hong/Blunt advice', 'zhao-yun/Dragon Heart', 'zhou-tai/Refuting Death',
      // Slice 4: wording-only differences, cleared as Dynasty Wars'.
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
    expect(byId('liu-bei').differenceNote).toMatch(/three or more cards/);
  });

  it('is in step with the per-General files the crawl writes', () => {
    const root = path.join(__dirname, '../../data/decks/kingdom-wars/generals');
    const files = fs.readdirSync(root).flatMap((force) =>
      fs.statSync(path.join(root, force)).isDirectory()
        ? fs.readdirSync(path.join(root, force)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(root, force, f), 'utf8')))
        : [],
    );
    const sort = (list: { id: string }[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(kingdomWarsGeneralRecords())).toEqual(sort(files));
    expect(kingdomWarsGeneralIds()).toHaveLength(60);
  });
});

describe('wikiKingdomWarsGeneralTabs', () => {
  it('has the four Kingdoms in order, 15 Generals each', () => {
    const tabs = wikiKingdomWarsGeneralTabs();
    expect(tabs.map((t) => t.key)).toEqual(['wei', 'shu', 'wu', 'qun']);
    expect(tabs.map((t) => t.label)).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    expect(tabs.map((t) => t.entries.length)).toEqual([15, 15, 15, 15]);
  });
});

describe('slice 2 variant Generals', () => {
  const SLICE_2 = ['liu-bei', 'sun-quan', 'xun-yu', 'zhu-rong', 'huang-yueying', 'sun-shangxiang', 'diao-chan', 'zhuge-liang', 'lu-xun', 'jia-xu', 'guo-jia', 'zhang-zhao-and-zhang-hong', 'zhen-ji', 'cai-wenji'];

  it('leaves no slice 2 General’s skill reading missing', () => {
    const missing = wikiKingdomWarsGenerals()
      .filter((g) => SLICE_2.includes(g.id))
      .flatMap((g) => g.skills.filter((s) => s.status === 'missing').map((s) => `${g.id}/${s.name}`))
      .sort();
    expect(missing).toEqual([]);
  });
});

// Slice 4 leaves none missing: every Kingdom Wars skill is Dynasty Wars' or a variant.
const MISSING_ELSEWHERE: string[] = [];

describe('slice 3 new Generals', () => {
  const NEW = ['gan-fu-ren', 'yue-jin', 'ding-feng', 'pan-feng', 'tian-feng', 'kong-rong', 'ma-teng', 'ji-ling', 'zou-shi'];
  const statuses = () =>
    wikiKingdomWarsGenerals()
      .filter((g) => NEW.includes(g.id))
      .flatMap((g) => g.skills.map((s) => `${g.id}/${s.name}=${s.status}`))
      .sort();

  it('reads worksAsKingdomWars for every skill of the nine, none missing (Ma Teng’s Horsemanship included)', () => {
    expect(statuses()).toEqual([
      'ding-feng/Close Combat=worksAsKingdomWars', 'ding-feng/Swift and Deadly=worksAsKingdomWars',
      'gan-fu-ren/Divine Wisdom=worksAsKingdomWars', 'gan-fu-ren/Prudence=worksAsKingdomWars',
      'ji-ling/Double Edged=worksAsKingdomWars',
      'kong-rong/Celebrity=worksAsKingdomWars', 'kong-rong/Comity=worksAsKingdomWars',
      'ma-teng/Call of Valour=worksAsKingdomWars', 'ma-teng/Horsemanship=worksAsKingdomWars',
      'pan-feng/Insanity Axe=worksAsKingdomWars',
      'tian-feng/Deathly Counsel=worksAsKingdomWars', 'tian-feng/With the Tide=worksAsKingdomWars',
      'yue-jin/Dauntless=worksAsKingdomWars',
      'zou-shi/Femme Fatale=worksAsKingdomWars', 'zou-shi/Impetus for Conflicts=worksAsKingdomWars',
    ].sort());
  });

  it('leaves no skill of the nine in the missing list, and pins every other General’s missing skills', () => {
    const missing = wikiKingdomWarsGenerals()
      .flatMap((g) => g.skills.filter((s) => s.status === 'missing').map((s) => `${g.id}/${s.name}`));
    expect(missing.filter((m) => NEW.includes(m.split('/')[0]))).toEqual([]);
    expect(missing.sort()).toEqual(MISSING_ELSEWHERE);
  });

  it('marks each of the nine In game through the registry', () => {
    const registry = buildContentRegistry();
    for (const id of NEW) {
      const display = generalDisplayData(`kingdomWars:${id}`, 'en')!;
      const registered = registry.generals.get(`kingdomWars:${id}`)!.skills.map((s) => s.id);
      expect(registered.length).toBe(display.skills.length);
      expect(display.skills.every((s) => s.inGame)).toBe(true);
    }
  });
});
