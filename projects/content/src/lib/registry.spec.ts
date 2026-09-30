import { buildContentRegistry } from './registry';

describe('buildContentRegistry', () => {
  it('registers the same seven cards as before', () => {
    const registry = buildContentRegistry();
    expect([...registry.cards.keys()].sort()).toEqual(
      ['duel', 'green-dragon-blade', 'peach', 'sha', 'shan', 'silver-lion', 'wuxie'].sort()
    );
  });

  it('builds every data-driven general: 25 base-set plus the migrated Dong Zhuo', () => {
    const registry = buildContentRegistry();
    expect(registry.generals.size).toBe(26);
    expect(registry.generals.has('cao-cao')).toBe(true);
    expect(registry.generals.has('dong-zhuo')).toBe(true);
  });

  it('takes kingdom and maxHp from the data files (data wins over old hand-coded values)', () => {
    const registry = buildContentRegistry();
    expect(registry.generals.get('zhao-yun')!.kingdom).toBe('Shu');
    expect(registry.generals.get('cao-cao')).toMatchObject({ kingdom: 'Wei', maxHp: 4 });
    expect(registry.generals.get('dong-zhuo')).toMatchObject({ kingdom: 'Qun', maxHp: 4 });
  });

  it('attaches hand-coded skills by id and gives data-only generals no skills', () => {
    const registry = buildContentRegistry();
    const skillIds = (id: string) => registry.generals.get(id)!.skills.map((s) => s.id);
    expect(skillIds('xiahou-dun')).toEqual(['ferocity']);
    expect(skillIds('sun-shangxiang')).toEqual(['valor']);
    expect(skillIds('zhuge-liang')).toEqual(['insight']);
    expect(skillIds('dong-zhuo')).toEqual(['tyranny']);
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
});
