import { buildContentRegistry } from './registry';

describe('buildContentRegistry', () => {
  it('registers the fifteen playable cards', () => {
    const registry = buildContentRegistry();
    expect([...registry.cards.keys()].sort()).toEqual(
      ['barbarians', 'break', 'capture', 'coerce', 'draw-two', 'duel', 'green-dragon-blade', 'hail-of-arrows', 'harvest', 'lightning', 'peach', 'peach-garden', 'sha', 'shan', 'silver-lion', 'starvation', 'steal', 'wuxie'].sort()
    );
  });

  it('builds every data-driven general: 25 Base, 32 from the expansions (Forest Dong Zhuo replaces the placeholder)', () => {
    const registry = buildContentRegistry();
    expect(registry.generals.size).toBe(57);
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
    expect(skillIds('xiahou-dun')).toEqual(['ferocity']);
    expect(skillIds('sun-shangxiang')).toEqual(['valor']);
    expect(skillIds('zhuge-liang')).toEqual(['insight']);
    expect(skillIds('dong-zhuo')).toEqual([]);
    expect(skillIds('zhao-yun')).toEqual(['vanguard']);
    expect(skillIds('huang-yueying')).toEqual([]);
    expect(skillIds('cao-cao')).toEqual([]);
  });

  it('has at least two generals in each of the four kingdoms', () => {
    const registry = buildContentRegistry();
    const counts = new Map<string, number>();
    for (const g of registry.generals.values()) counts.set(g.kingdom, (counts.get(g.kingdom) ?? 0) + 1);
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
});
