import { wikiCards, wikiGenerals } from './wiki';

describe('wikiGenerals', () => {
  const generals = wikiGenerals();

  it('lists every general with data, grouped by kingdom then sorted by name', () => {
    expect(generals).toHaveLength(26);
    expect([...new Set(generals.map((g) => g.kingdom))]).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    expect(generals.filter((g) => g.kingdom === 'Wei').map((g) => g.name)).toEqual([
      'Cao Cao', 'Guo Jia', 'Sima Yi', 'Xiahou Dun', 'Xu Chu', 'Zhang Liao', 'Zhen Ji',
    ]);
  });

  it('marks exactly the generals whose skills are coded', () => {
    expect(generals.filter((g) => g.skillsInGame).map((g) => g.id).sort()).toEqual(
      ['dong-zhuo', 'huang-yueying', 'sun-shangxiang', 'xiahou-dun', 'zhao-yun', 'zhuge-liang']
    );
  });

  it('carries names, title, HP and skills from the data file', () => {
    const caoCao = generals.find((g) => g.id === 'cao-cao')!;
    expect(caoCao).toMatchObject({
      name: 'Cao Cao', nameZh: '曹操', title: 'Martial Emperor of Wei', titleZh: '魏武帝', kingdom: 'Wei', maxHp: 4, skillsInGame: false,
    });
    expect(caoCao.skills.map((s) => [s.name, s.nameZh])).toEqual([['Evil Hero', '奸雄'], ['Escort', '护驾']]);
  });

  it('Lu Meng has no Chinese name (Review Focus 2)', () => {
    expect(generals.find((g) => g.id === 'lu-meng')!.nameZh).toBeNull();
  });
});

describe('wikiCards', () => {
  it('lists the basic cards by name; Wine is not in the game', () => {
    const basic = wikiCards('basic');
    expect(basic.map((c) => c.name)).toEqual(['Peach', 'Sha', 'Shan', 'Wine']);
    expect(basic.filter((c) => !c.inGame).map((c) => c.id)).toEqual(['wine']);
  });

  it('carries Wine from the Army expansion', () => {
    const wine = wikiCards('basic').find((c) => c.id === 'wine')!;
    expect(wine).toMatchObject({ name: 'Wine', nameZh: '酒', category: 'basic', count: 5, mount: null, delayed: false });
    expect(wine.text).toBe(
      'When a player is on the brink of death, that player can use play wine to restore one health. Also any player can play this card once during their turn. If they do, the damage of the next attack is increased by one.'
    );
    expect(wine.printings).toEqual([
      { suit: 'spade', rank: 3 }, { suit: 'spade', rank: 9 }, { suit: 'club', rank: 3 }, { suit: 'club', rank: 9 }, { suit: 'diamond', rank: 9 },
    ]);
  });

  it('records each horse’s mount direction, and nothing else has one', () => {
    const equipment = wikiCards('equipment');
    const mountOf = Object.fromEntries(equipment.filter((c) => c.subtype === 'horse').map((c) => [c.id, c.mount]));
    expect(mountOf).toEqual({
      'da-yuan': 'minus', 'di-lu': 'plus', 'red-hare': 'minus', 'shadow-runner': 'plus', 'storm-runner': 'plus', 'zi-xing': 'minus',
    });
    expect(equipment.filter((c) => c.subtype !== 'horse').every((c) => c.mount === null)).toBe(true);
  });

  it('marks exactly Capture and Lightning as delayed', () => {
    expect(wikiCards('trick').filter((c) => c.delayed).map((c) => c.id)).toEqual(['capture', 'lightning']);
    expect([...wikiCards('basic'), ...wikiCards('equipment')].some((c) => c.delayed)).toBe(false);
  });

  it('lists equipment by subtype then name, with only Green Dragon Blade in the game', () => {
    const equipment = wikiCards('equipment');
    expect(equipment).toHaveLength(15);
    expect(equipment.map((c) => c.subtype)).toEqual([...Array(8).fill('weapon'), 'armor', ...Array(6).fill('horse')]);
    expect(equipment.slice(0, 3).map((c) => c.name)).toEqual(['Axe', 'Black Pommel', 'Crossbow']);
    expect(equipment.filter((c) => c.inGame).map((c) => c.id)).toEqual(['green-dragon-blade']);
  });

  it('reports data gaps as null or empty, never guessed (Review Focus 2)', () => {
    const redHare = wikiCards('equipment').find((c) => c.id === 'red-hare')!;
    expect(redHare).toMatchObject({ name: 'Red Hare', nameZh: '赤兔', text: null, range: null, count: null, printings: [] });
    expect(wikiCards('equipment').find((c) => c.id === 'axe')!.range).toBe(3);
  });

  it('lists the 12 tools, with Duel and Wuxie in the game and their printings', () => {
    const tools = wikiCards('trick');
    expect(tools).toHaveLength(12);
    expect(tools.filter((c) => c.inGame).map((c) => c.id)).toEqual(['duel', 'wuxie']);
    const duel = tools.find((c) => c.id === 'duel')!;
    expect(duel.count).toBe(3);
    expect(duel.printings).toEqual([{ suit: 'spade', rank: 1 }, { suit: 'club', rank: 1 }, { suit: 'diamond', rank: 1 }]);
  });

  it('never lists Silver Lion, which has no data file', () => {
    for (const category of ['basic', 'equipment', 'trick'] as const) {
      expect(wikiCards(category).some((c) => c.id === 'silver-lion')).toBe(false);
    }
  });
});
