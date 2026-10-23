import { alternateGeneralRecords } from './alternateGenerals';
import { generalsData } from '../../data/generals';
import { ALTERNATE_VARIANTS } from './alternateVariants';
import { ALTERNATE_VARIANT_BASE, VARIANTS_WITHOUT_BASE, baseSkillId, lookupWithBase } from './alternateBase';
import { GENERAL_SKILLS } from './generals';
import { skillIdOf } from './skillId';
import { abilityName } from './display';
import review from '../../data/locales/vi/review.json';

const records = alternateGeneralRecords();
const entries = Object.entries(ALTERNATE_VARIANTS).flatMap(([generalId, bySkill]) =>
  Object.entries(bySkill).map(([nameZh, variant]) => ({ generalId, nameZh, variant })));

describe('ALTERNATE_VARIANTS', () => {
  it('registers at least Liu Bei’s Benevolence', () => {
    expect(ALTERNATE_VARIANTS['liu-bei']?.['仁德']?.id).toBe('alternate:benevolence');
  });

  it('keys only Generals and Chinese skill names the Alternate records have', () => {
    for (const { generalId, nameZh } of entries) {
      const rec = records.find((r) => r.id === generalId);
      expect(rec).toBeDefined();
      expect(rec!.skills.some((s) => s.nameZh === nameZh)).toBe(true);
    }
  });

  it('names each variant alternate: plus the id of the record skill’s English name', () => {
    for (const { generalId, nameZh, variant } of entries) {
      const skill = records.find((r) => r.id === generalId)!.skills.find((s) => s.nameZh === nameZh)!;
      expect(variant.id).toBe(`alternate:${skillIdOf(skill.name)}`);
    }
  });

  it('never reuses a Default skill id, and every id is unique', () => {
    const defaultIds = new Set(Object.values(generalsData).flatMap((g) => g.skills.map((s) => skillIdOf(s.name))));
    const ids = entries.map((e) => e.variant.id);
    for (const id of ids) expect(defaultIds.has(id)).toBe(false);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ALTERNATE_VARIANT_BASE', () => {
  it('maps each variant to an existing Default skill id, and only variants', () => {
    const variantIds = new Set(entries.map((e) => e.variant.id));
    const defaultIds = new Set([...GENERAL_SKILLS.values()].flatMap((defs) => defs.map((d) => d.id)));
    for (const [variantId, base] of Object.entries(ALTERNATE_VARIANT_BASE)) {
      expect(variantId.startsWith('alternate:')).toBe(true);
      expect(variantIds.has(variantId)).toBe(true);
      expect(defaultIds.has(base)).toBe(true);
    }
  });
});

describe('variant bases', () => {
  it('every variant has an ALTERNATE_VARIANT_BASE entry unless in the exported VARIANTS_WITHOUT_BASE set', () => {
    for (const { variant } of entries) {
      expect(variant.id in ALTERNATE_VARIANT_BASE || VARIANTS_WITHOUT_BASE.has(variant.id)).toBe(true);
    }
  });
});

describe('baseSkillId', () => {
  it('is the Default id of a variant, else the id itself', () => {
    expect(baseSkillId('kindness')).toBe('kindness');
    expect(baseSkillId('alternate:benevolence')).toBe('kindness');
    expect(baseSkillId('constructor')).toBe('constructor');
  });
});

describe('lookupWithBase', () => {
  it('finds the id first, then its base, and ignores inherited keys', () => {
    expect(lookupWithBase({ kindness: 'base' }, 'alternate:benevolence')).toBe('base');
    expect(lookupWithBase({ kindness: 'base', 'alternate:benevolence': 'own' }, 'alternate:benevolence')).toBe('own');
    expect(lookupWithBase({ kindness: 'base' }, 'sha')).toBeUndefined();
    expect(lookupWithBase({}, 'constructor')).toBeUndefined();
  });
});

describe('the fifteen skills of the nine slice 3 Generals', () => {
  const NEW = ['gan-fu-ren', 'yue-jin', 'ding-feng', 'pan-feng', 'tian-feng', 'kong-rong', 'ma-teng', 'ji-ling', 'zou-shi'];
  const newEntries = entries.filter((e) => NEW.includes(e.generalId));

  it('has exactly these variant ids', () => {
    expect(newEntries.map((e) => e.variant.id).sort()).toEqual([
      'alternate:call-of-valour', 'alternate:celebrity', 'alternate:close-combat', 'alternate:comity', 'alternate:dauntless',
      'alternate:deathly-counsel', 'alternate:divine-wisdom', 'alternate:double-edged', 'alternate:femme-fatale',
      'alternate:horsemanship', 'alternate:impetus-for-conflicts', 'alternate:insanity-axe', 'alternate:prudence',
      'alternate:swift-and-deadly', 'alternate:with-the-tide',
    ]);
  });

  it('gives each an English and a Vietnamese name, not the id fallback', () => {
    for (const { variant } of newEntries) {
      const en = abilityName(variant.id, 'en');
      const vi = abilityName(variant.id, 'vi');
      expect(en).not.toMatch(/^alternate:/);
      expect(vi).not.toMatch(/^alternate:/);
      expect(en.length).toBeGreaterThan(0);
      expect(vi).not.toBe(en);
    }
  });

  it('names Ma Teng’s Horsemanship apart from Default’s id', () => {
    expect(ALTERNATE_VARIANTS['ma-teng']['马术']?.id).toBe('alternate:horsemanship');
    expect(abilityName('alternate:horsemanship')).toBe('Horsemanship');
  });

  it('leaves their Vietnamese text in draft: no review entry names any of them', () => {
    const reviewed = JSON.stringify(review);
    for (const { variant } of newEntries) expect(reviewed).not.toContain(variant.id);
    for (const id of NEW) expect(reviewed).not.toContain(id);
  });
});
