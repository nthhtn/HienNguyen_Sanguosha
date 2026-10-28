import { kingdomWarsGeneralRecords } from './kingdomWarsGenerals';
import { generalsData } from '../../data/generals';
import { KINGDOM_WARS_VARIANTS } from './kingdomWarsVariants';
import { KINGDOM_WARS_VARIANT_BASE, VARIANTS_WITHOUT_BASE, baseSkillId, lookupWithBase } from './kingdomWarsBase';
import { GENERAL_SKILLS } from './generals';
import { skillIdOf } from './skillId';
import { abilityName } from './display';
import review from '../../data/locales/vi/review.json';

const records = kingdomWarsGeneralRecords();
const entries = Object.entries(KINGDOM_WARS_VARIANTS).flatMap(([generalId, bySkill]) =>
  Object.entries(bySkill).map(([nameZh, variant]) => ({ generalId, nameZh, variant })));

describe('KINGDOM_WARS_VARIANTS', () => {
  it('registers at least Liu Bei’s Benevolence', () => {
    expect(KINGDOM_WARS_VARIANTS['liu-bei']?.['仁德']?.id).toBe('kingdomWars:benevolence');
  });

  it('keys only Generals and Chinese skill names the Kingdom Wars records have', () => {
    for (const { generalId, nameZh } of entries) {
      const rec = records.find((r) => r.id === generalId);
      expect(rec).toBeDefined();
      expect(rec!.skills.some((s) => s.nameZh === nameZh)).toBe(true);
    }
  });

  it('names each variant kingdomWars: plus the id of the record skill’s English name', () => {
    for (const { generalId, nameZh, variant } of entries) {
      const skill = records.find((r) => r.id === generalId)!.skills.find((s) => s.nameZh === nameZh)!;
      expect(variant.id).toBe(`kingdomWars:${skillIdOf(skill.name)}`);
    }
  });

  it('never reuses a Dynasty Wars skill id, and every id is unique', () => {
    const dynastyWarsIds = new Set(Object.values(generalsData).flatMap((g) => g.skills.map((s) => skillIdOf(s.name))));
    const ids = entries.map((e) => e.variant.id);
    for (const id of ids) expect(dynastyWarsIds.has(id)).toBe(false);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('KINGDOM_WARS_VARIANT_BASE', () => {
  it('maps each variant to an existing Dynasty Wars skill id, and only variants', () => {
    const variantIds = new Set(entries.map((e) => e.variant.id));
    const dynastyWarsIds = new Set([...GENERAL_SKILLS.values()].flatMap((defs) => defs.map((d) => d.id)));
    for (const [variantId, base] of Object.entries(KINGDOM_WARS_VARIANT_BASE)) {
      expect(variantId.startsWith('kingdomWars:')).toBe(true);
      expect(variantIds.has(variantId)).toBe(true);
      expect(dynastyWarsIds.has(base)).toBe(true);
    }
  });
});

describe('variant bases', () => {
  it('every variant has an KINGDOM_WARS_VARIANT_BASE entry unless in the exported VARIANTS_WITHOUT_BASE set', () => {
    for (const { variant } of entries) {
      expect(variant.id in KINGDOM_WARS_VARIANT_BASE || VARIANTS_WITHOUT_BASE.has(variant.id)).toBe(true);
    }
  });
});

describe('baseSkillId', () => {
  it('is the Dynasty Wars id of a variant, else the id itself', () => {
    expect(baseSkillId('kindness')).toBe('kindness');
    expect(baseSkillId('kingdomWars:benevolence')).toBe('kindness');
    expect(baseSkillId('constructor')).toBe('constructor');
  });
});

describe('lookupWithBase', () => {
  it('finds the id first, then its base, and ignores inherited keys', () => {
    expect(lookupWithBase({ kindness: 'base' }, 'kingdomWars:benevolence')).toBe('base');
    expect(lookupWithBase({ kindness: 'base', 'kingdomWars:benevolence': 'own' }, 'kingdomWars:benevolence')).toBe('own');
    expect(lookupWithBase({ kindness: 'base' }, 'sha')).toBeUndefined();
    expect(lookupWithBase({}, 'constructor')).toBeUndefined();
  });
});

describe('the fifteen skills of the nine slice 3 Generals', () => {
  const NEW = ['gan-fu-ren', 'yue-jin', 'ding-feng', 'pan-feng', 'tian-feng', 'kong-rong', 'ma-teng', 'ji-ling', 'zou-shi'];
  const newEntries = entries.filter((e) => NEW.includes(e.generalId));

  it('has exactly these variant ids', () => {
    expect(newEntries.map((e) => e.variant.id).sort()).toEqual([
      'kingdomWars:call-of-valour', 'kingdomWars:celebrity', 'kingdomWars:close-combat', 'kingdomWars:comity', 'kingdomWars:dauntless',
      'kingdomWars:deathly-counsel', 'kingdomWars:divine-wisdom', 'kingdomWars:double-edged', 'kingdomWars:femme-fatale',
      'kingdomWars:horsemanship', 'kingdomWars:impetus-for-conflicts', 'kingdomWars:insanity-axe', 'kingdomWars:prudence',
      'kingdomWars:swift-and-deadly', 'kingdomWars:with-the-tide',
    ]);
  });

  it('gives each an English and a Vietnamese name, not the id fallback', () => {
    for (const { variant } of newEntries) {
      const en = abilityName(variant.id, 'en');
      const vi = abilityName(variant.id, 'vi');
      expect(en).not.toMatch(/^kingdomWars:/);
      expect(vi).not.toMatch(/^kingdomWars:/);
      expect(en.length).toBeGreaterThan(0);
      expect(vi).not.toBe(en);
    }
  });

  it('names Ma Teng’s Horsemanship apart from Dynasty Wars’ id', () => {
    expect(KINGDOM_WARS_VARIANTS['ma-teng']['马术']?.id).toBe('kingdomWars:horsemanship');
    expect(abilityName('kingdomWars:horsemanship')).toBe('Horsemanship');
  });

  it('leaves their Vietnamese text in draft: no review entry names any of them', () => {
    const reviewed = JSON.stringify(review);
    for (const { variant } of newEntries) expect(reviewed).not.toContain(variant.id);
    for (const id of NEW) expect(reviewed).not.toContain(id);
  });
});
