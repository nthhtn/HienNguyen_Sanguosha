import * as fs from 'fs';
import * as path from 'path';
import type { GeneralData } from '../../data/generals';
import { alternateGeneralIds, alternateGeneralRecords } from './alternateGenerals';
import { alternateSkillStatus, wikiAlternateGeneralTabs, wikiAlternateGenerals } from './wikiAlternateGenerals';

const counterpart = (skills: { name: string; nameZh: string; lord?: boolean }[]): GeneralData => ({
  name: 'X', maxHp: 4, gender: 'male', kingdom: 'Wei', source: { url: '', site: '', crawledAt: '' },
  skills: skills.map((s) => ({ ...s, text: '' })),
});
const KINDNESS = counterpart([{ name: 'Kindness', nameZh: '仁德' }]);

describe('alternateSkillStatus', () => {
  it('is missing when the General has no Default counterpart', () => {
    expect(alternateSkillStatus({ name: 'Benevolence', nameZh: '仁德' }, undefined, new Set(['kindness']))).toBe('missing');
  });

  it('works as Default when the Chinese name matches a skill the game has code for', () => {
    expect(alternateSkillStatus({ name: 'Benevolence', nameZh: '仁德' }, KINDNESS, new Set(['kindness']))).toBe('worksAsDefault');
  });

  it('matches by English name when the Alternate skill has no Chinese name', () => {
    expect(alternateSkillStatus({ name: 'Kindness', nameZh: null }, KINDNESS, new Set(['kindness']))).toBe('worksAsDefault');
    expect(alternateSkillStatus({ name: 'KINDNESS', nameZh: null }, KINDNESS, new Set(['kindness']))).toBe('worksAsDefault');
  });

  it('is missing when the counterpart skill has no code', () => {
    expect(alternateSkillStatus({ name: 'Benevolence', nameZh: '仁德' }, KINDNESS, new Set())).toBe('missing');
  });

  it('is not a match with a Lord skill, even one with code', () => {
    const lord = counterpart([{ name: 'Rouse', nameZh: '激将', lord: true }]);
    expect(alternateSkillStatus({ name: 'Rouse', nameZh: '激将' }, lord, new Set(['rouse']))).toBe('missing');
  });

  it('lets two Alternate skills share one Default counterpart', () => {
    const coded = new Set(['kindness']);
    expect(alternateSkillStatus({ name: 'A', nameZh: '仁德' }, KINDNESS, coded)).toBe('worksAsDefault');
    expect(alternateSkillStatus({ name: 'B', nameZh: '仁德' }, KINDNESS, coded)).toBe('worksAsDefault');
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

  it('marks every skill of a General with no Default counterpart as not in game', () => {
    for (const id of ['gan-fu-ren', 'yue-jin', 'ding-feng', 'ji-ling', 'kong-rong', 'ma-teng', 'pan-feng', 'tian-feng', 'zou-shi']) {
      expect(byId(id).skills.map((s) => s.status)).toEqual(byId(id).skills.map(() => 'missing'));
      expect(byId(id).skillsRunAsDefault).toBe(false);
    }
  });

  it('pins exactly which Alternate skills are not in the game yet', () => {
    const missing = generals.flatMap((g) => g.skills.filter((s) => s.status === 'missing').map((s) => `${g.id}/${s.name}`)).sort();
    expect(missing).toEqual([
      // The nine Generals Default lacks: 15 skills.
      'ding-feng/Close Combat', 'ding-feng/Swift and Deadly',
      'gan-fu-ren/Divine Wisdom', 'gan-fu-ren/Prudence',
      'ji-ling/Double Edged',
      'kong-rong/Celebrity', 'kong-rong/Comity',
      'ma-teng/Call of Valour', 'ma-teng/Horsemanship',
      'pan-feng/Insanity Axe',
      'tian-feng/Deathly Counsel', 'tian-feng/With the Tide',
      'yue-jin/Dauntless',
      'zou-shi/Femme Fatale', 'zou-shi/Impetus for Conflicts',
      // Skills of Default's Generals with no Default skill of the same name: 4 skills. Guo Jia's, Zhang Liao's and
      // Zhang Zhao's may be the same skill under a different spelling in Default's data; Lu Xun's is a different skill.
      'guo-jia/Bequeathed Strategy', 'lu-xun/Scrutinize', 'zhang-liao/Sudden Strike', 'zhang-zhao-and-zhang-hong/Stabilization',
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
