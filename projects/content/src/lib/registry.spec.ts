import { GENERAL_SKILLS } from './generals';
import { lookupGeneral } from 'engine';
import { kingdomWarsGeneralRecords } from './kingdomWarsGenerals';
import { readyKingdomWarsSkills } from './kingdomWarsSkills';
import { kingdomWarsGeneralId, isKingdomWarsGeneralId } from './generalIds';
import { buildContentRegistry } from './registry';
import { isRecastPlay } from './cards/chains';

const identityGenerals = () => [...buildContentRegistry().generals.values()].filter((g) => !isKingdomWarsGeneralId(g.id));

describe('buildContentRegistry', () => {
  it('flags exactly Chains and Ascertain as recastable', () => {
    const registry = buildContentRegistry();
    expect([...registry.cards.values()].filter((c) => c.recastable).map((c) => c.id).sort()).toEqual(['ascertain', 'chains']);
  });

  it('registers the playable cards', () => {
    const registry = buildContentRegistry();
    expect([...registry.cards.keys()].sort()).toEqual(
      ['barbarians', 'break', 'capture', 'coerce', 'draw-two', 'duel', 'green-dragon-blade', 'hail-of-arrows', 'harvest', 'lightning', 'peach', 'peach-garden', 'sha', 'shan', 'silver-lion', 'starvation', 'steal', 'wuxie', 'wine', 'black-pommel', 'crossbow', 'da-yuan', 'di-lu', 'hua-liu', 'red-hare', 'shadow-runner', 'storm-runner', 'zi-xing', 'eight-trigrams', 'black-shield', 'wood-armor', 'gender-swords', 'ancient-scimitar', 'ice-sword', 'fire-fan', 'longbow', 'axe', 'sky-scorcher', 'serpent-spear', 'blaze', 'fire-attack', 'lightning-attack', 'chains', 'wu-six-swords', 'trident-glaive', 'wuxie-guo', 'amass', 'ally-far-attack-near', 'ascertain'].sort()
    );
  });

  it('builds every data-driven general: 25 Base, 32 from the expansions (Forest Dong Zhuo replaces the placeholder)', () => {
    const registry = buildContentRegistry();
    expect(identityGenerals().length).toBe(57);
    expect(registry.generals.has('cao-cao')).toBe(true);
    expect(registry.generals.has('dong-zhuo')).toBe(true);
  });

  it('takes kingdom and maxHp from the data files (data wins over old hand-coded values)', () => {
    const registry = buildContentRegistry();
    expect(registry.generals.get('zhao-yun')!.kingdom).toBe('Shu');
    expect(registry.generals.get('cao-cao')).toMatchObject({ kingdom: 'Wei', maxHp: 4 });
    expect(registry.generals.get('dong-zhuo')).toMatchObject({ kingdom: 'Qun', maxHp: 8 });
  });

  it('attaches hand-coded skills by id and gives data-only generals no skills', () => {
    const registry = buildContentRegistry();
    const skillIds = (id: string) => registry.generals.get(id)!.skills.map((s) => s.id);
    for (const [id, skills] of GENERAL_SKILLS) expect(skillIds(id)).toEqual(skills.map((s) => s.id));
    // A General with no hand-coded skills is playable and has none.
    for (const g of identityGenerals()) if (!GENERAL_SKILLS.has(g.id)) expect(g.skills).toEqual([]);
  });

  it('has at least two generals in each of the four kingdoms', () => {
    const counts = new Map<string, number>();
    for (const g of identityGenerals()) counts.set(g.kingdom, (counts.get(g.kingdom) ?? 0) + 1);
    for (const kingdom of ['Wei', 'Shu', 'Wu', 'Qun']) {
      expect(counts.get(kingdom)).toBeGreaterThanOrEqual(2);
    }
  });
  it('gives every equipment card a slot and no other card one', () => {
    const registry = buildContentRegistry();
    for (const card of registry.cards.values()) {
      if (card.category === 'equipment') expect(card.equipSlot).toBeDefined();
      else expect(card.equipSlot).toBeUndefined();
    }
  });
  it('gives every General a gender; eight are female', () => {
    const generals = identityGenerals();
    expect(generals.every((g) => g.gender === 'male' || g.gender === 'female')).toBe(true);
    expect(generals.filter((g) => g.gender === 'female').map((g) => g.id).sort()).toEqual(
      ['cai-wenji', 'da-qiao', 'diao-chan', 'huang-yueying', 'sun-shangxiang', 'xiao-qiao', 'zhen-ji', 'zhu-rong']
    );
  });

  describe('Kingdom Wars Generals', () => {
    const registry = buildContentRegistry();
    const kingdomWarsGenerals = () => [...registry.generals.values()].filter((g) => isKingdomWarsGeneralId(g.id));

    it('registers all 60 under the kingdomWars: prefix, beside the 57 Identity ids', () => {
      expect(kingdomWarsGenerals().length).toBe(60);
      expect(kingdomWarsGenerals().map((g) => g.id).sort()).toEqual(kingdomWarsGeneralRecords().map((r) => kingdomWarsGeneralId(r.id)).sort());
      expect(registry.generals.size).toBe(117);
    });

    it('takes kingdom, HP and gender from the record', () => {
      for (const rec of kingdomWarsGeneralRecords()) {
        const g = registry.generals.get(kingdomWarsGeneralId(rec.id))!;
        expect(g.kingdom).toBe(rec.force[0].toUpperCase() + rec.force.slice(1));
        expect(g.maxHp).toBe(rec.maxHp);
        expect(g.gender).toBe(rec.gender);
      }
      expect(registry.generals.get('kingdomWars:zhang-fei')).toMatchObject({ kingdom: 'Shu', maxHp: 4 });
    });

    it('gives ready skills only', () => {
      expect(registry.generals.get('kingdomWars:zhang-fei')!.skills.map((s) => s.id)).toEqual(['roar']);
      expect(registry.generals.get('kingdomWars:liu-bei')!.skills.map((s) => s.id)).toEqual(['kingdomWars:benevolence']);
      for (const rec of kingdomWarsGeneralRecords()) {
        const ready = readyKingdomWarsSkills(rec).map((s) => s.id);
        expect(registry.generals.get(kingdomWarsGeneralId(rec.id))!.skills.map((s) => s.id)).toEqual(ready);
      }
    });

    it('has no Lord skill on any Kingdom Wars General, while Identity Liu Bei keeps his', () => {
      for (const g of kingdomWarsGenerals()) expect(g.skills.some((s) => s.lord)).toBe(false);
      const ids = registry.generals.get('liu-bei')!.skills.map((s) => s.id);
      expect(ids).toContain('kindness');
      expect(ids).toContain('fierce-general');
    });

    it('looks up a Kingdom Wars General new to Kingdom Wars, with its own skills', () => {
      expect(lookupGeneral(registry, 'kingdomWars:zou-shi').skills.map((s) => s.id)).toEqual(['kingdomWars:femme-fatale', 'kingdomWars:impetus-for-conflicts']);
    });
  });
});

describe('Recast list', () => {
  it('agrees with the cards that are recastable', () => {
    for (const [id, def] of buildContentRegistry().cards) expect(isRecastPlay(id, [])).toBe(def.recastable === true);
  });
});
