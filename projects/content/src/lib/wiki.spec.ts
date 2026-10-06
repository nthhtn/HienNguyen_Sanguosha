import { equipmentTabs, wikiCardTabs, wikiCards, wikiGeneralTabs, wikiGenerals, WikiCard } from './wiki';

describe('wikiGenerals', () => {
  const generals = wikiGenerals();

  it('lists every general with data, grouped by kingdom then sorted by name', () => {
    expect(generals).toHaveLength(57);
    expect([...new Set(generals.map((g) => g.kingdom))]).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    expect(generals.filter((g) => g.kingdom === 'Wei').map((g) => g.name)).toEqual([
      'Cao Cao', 'Cao Pi', 'Cao Ren', 'Deng Ai', 'Dian Wei', 'Guo Jia', 'Sima Yi', 'Xiahou Dun',
      'Xiahou Yuan', 'Xu Chu', 'Xu Huang', 'Xun Yu', 'Zhang He', 'Zhang Liao', 'Zhen Ji',
    ]);
  });

  it('marks exactly the generals whose skills are coded', () => {
    expect(generals.filter((g) => g.skillsInGame).map((g) => g.id).sort()).toEqual(
      ['huang-yueying', 'sun-shangxiang', 'xiahou-dun', 'zhao-yun', 'zhuge-liang']
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

  it('includes every Wind, Fire, Forest and Mountain general of the four kingdoms', () => {
    const ids = new Set(generals.map((g) => g.id));
    for (const id of [
      'xiahou-yuan', 'cao-ren', 'dian-wei', 'xun-yu', 'xu-huang', 'cao-pi', 'zhang-he', 'deng-ai',
      'huang-zhong', 'wei-yan', 'pang-tong', 'fire-zhuge-liang', 'meng-huo', 'zhu-rong', 'jiang-wei', 'liu-shan',
      'xiao-qiao', 'zhou-tai', 'taishi-ci', 'sun-jian', 'lu-su', 'sun-ce', 'zhang-zhao-and-zhang-hong',
      'zhang-jiao', 'yu-ji', 'yuan-shao', 'yan-liang-and-wen-chou', 'pang-de', 'dong-zhuo', 'jia-xu', 'zuo-ci', 'cai-wenji',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(generals.every((g) => g.maxHp !== null)).toBe(true);
  });

  it('keeps both Zhuge Liangs apart (Review Focus 3)', () => {
    const base = generals.find((g) => g.id === 'zhuge-liang')!;
    const fire = generals.find((g) => g.id === 'fire-zhuge-liang')!;
    expect([base.name, fire.name]).toEqual(['Zhuge Liang', 'Zhuge Liang']);
    expect(fire).toMatchObject({ kingdom: 'Shu', title: 'Sleeping Dragon', titleZh: '卧龙', maxHp: 3 });
    expect(base.title).not.toBe(fire.title);
  });

  it('replaces the placeholder Dong Zhuo with the Forest one', () => {
    const dongZhuo = generals.find((g) => g.id === 'dong-zhuo')!;
    expect(dongZhuo).toMatchObject({ kingdom: 'Qun', maxHp: 8 });
    expect(dongZhuo.skills.map((s) => s.name)).not.toContain('Tyranny');
  });

  it('copies skills verbatim from the page', () => {
    const xiahouYuan = generals.find((g) => g.id === 'xiahou-yuan')!;
    expect(xiahouYuan).toMatchObject({ name: 'Xiahou Yuan', nameZh: '夏侯渊', title: 'Running Cheetah', titleZh: '急行的猎豹', maxHp: 4 });
    expect(xiahouYuan.skills).toEqual([{
      name: 'Godspeed', nameZh: '神速',
      text: 'During his turn, Xiahou Yuan can exercise either or both of the following options to attack any character regardless of their distance from him: Skip his judgment and drawing phases. Skip his action phase and discard any equipment card.',
    }]);
  });

  it('tags every general with its expansion', () => {
    const count = (e: string) => generals.filter((g) => g.expansion === e).length;
    expect([count('Base'), count('Wind'), count('Fire'), count('Forest'), count('Mountain')]).toEqual([25, 8, 8, 8, 8]);
    expect(generals.find((g) => g.id === 'cao-cao')!.expansion).toBe('Base');
    expect(generals.find((g) => g.id === 'dong-zhuo')!.expansion).toBe('Forest');
  });
});

describe('wikiCards', () => {
  it('lists the basic cards by name; the Army ones are not in the game', () => {
    const basic = wikiCards('basic');
    expect(basic.map((c) => c.name)).toEqual(['Fire Attack', 'Lightning Attack', 'Peach', 'Sha', 'Shan', 'Wine']);
    expect(basic.filter((c) => !c.inGame).map((c) => c.id)).toEqual(['fire-attack', 'lightning-attack', 'wine']);
  });

  it('records the Army basics with their spreadsheet printings', () => {
    const basic = wikiCards('basic');
    expect(basic.find((c) => c.id === 'fire-attack')).toMatchObject({ nameZh: '火杀', count: 5 });
    expect(basic.find((c) => c.id === 'lightning-attack')).toMatchObject({ nameZh: '雷杀', count: 9 });
  });

  it('tags the extra copies Army and EX add to existing cards with their expansion', () => {
    const all = [...wikiCards('basic'), ...wikiCards('tool')];
    const byExpansion = (id: string) => {
      const counts: Record<string, number> = {};
      for (const p of all.find((c) => c.id === id)!.printings) counts[p.expansion ?? 'own'] = (counts[p.expansion ?? 'own'] ?? 0) + 1;
      return counts;
    };
    expect(byExpansion('shan')).toEqual({ own: 15, Army: 9 });
    expect(byExpansion('peach')).toEqual({ own: 8, Army: 4 });
    expect(byExpansion('wuxie')).toEqual({ own: 3, Army: 3, EX: 1 });
    expect(byExpansion('lightning')).toEqual({ own: 1, EX: 1 });
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
      'da-yuan': 'offensive', 'di-lu': 'defensive', 'hua-liu': 'defensive', 'red-hare': 'offensive', 'shadow-runner': 'defensive', 'storm-runner': 'defensive', 'zi-xing': 'offensive',
    });
    expect(equipment.filter((c) => c.subtype !== 'horse').every((c) => c.mount === null)).toBe(true);
  });

  it('marks exactly Capture, Lightning and Starvation as delayed', () => {
    expect(wikiCards('tool').filter((c) => c.delayed).map((c) => c.id)).toEqual(['capture', 'lightning', 'starvation']);
    expect([...wikiCards('basic'), ...wikiCards('equipment')].some((c) => c.delayed)).toBe(false);
  });

  it('lists equipment by subtype then name, with Green Dragon Blade and Silver Lion in the game', () => {
    const equipment = wikiCards('equipment');
    expect(equipment).toHaveLength(22);
    expect(equipment.map((c) => c.subtype)).toEqual([...Array(11).fill('weapon'), ...Array(4).fill('armor'), ...Array(7).fill('horse')]);
    expect(equipment.slice(0, 3).map((c) => c.name)).toEqual(['Ancient Scimitar', 'Axe', 'Black Pommel']);
    expect(equipment.filter((c) => c.inGame).map((c) => c.id)).toEqual(['green-dragon-blade', 'silver-lion']);
  });

  it('reports data gaps as null or empty, never guessed (Review Focus 2)', () => {
    const redHare = wikiCards('equipment').find((c) => c.id === 'red-hare')!;
    expect(redHare).toMatchObject({ name: 'Red Hare', nameZh: '赤兔', text: null, range: null, count: 1, printings: [{ suit: 'heart', rank: 5 }] });
    expect(wikiCards('equipment').find((c) => c.id === 'axe')!.range).toBe(3);
  });

  it('lists the 15 tools, with the playable ones in the game and their printings', () => {
    const tools = wikiCards('tool');
    expect(tools).toHaveLength(15);
    expect(tools.filter((c) => c.inGame).map((c) => c.id)).toEqual(['barbarians', 'break', 'capture', 'coerce', 'draw-two', 'duel', 'hail-of-arrows', 'harvest', 'lightning', 'peach-garden', 'starvation', 'steal', 'wuxie']);
    const duel = tools.find((c) => c.id === 'duel')!;
    expect(duel.count).toBe(3);
    expect(duel.printings).toEqual([{ suit: 'spade', rank: 1 }, { suit: 'club', rank: 1 }, { suit: 'diamond', rank: 1 }]);
  });

  it('includes the crawled EX and Army cards, not yet in the game', () => {
    const all = [...wikiCards('tool'), ...wikiCards('equipment')];
    const ids = ['blaze', 'chains', 'hua-liu', 'ancient-scimitar', 'fire-fan', 'ice-sword', 'wood-armor', 'black-shield'];
    for (const id of ids) {
      const card = all.find((c) => c.id === id)!;
      expect(card).toBeDefined();
      expect(card.inGame).toBe(false);
      expect(card.nameZh).toMatch(/[\u4e00-\u9fff]/);
    }
    expect(all.find((c) => c.id === 'chains')).toMatchObject({ count: 6, nameZh: '铁索连环' });
    expect(all.find((c) => c.id === 'ice-sword')).toMatchObject({ range: 2, subtype: 'weapon' });
    expect(all.find((c) => c.id === 'black-shield')!.printings).toEqual([]);
  });

  it('lists Silver Lion as in-game armour with its single printing', () => {
    const lion = wikiCards('equipment').find((c) => c.id === 'silver-lion')!;
    expect(lion.inGame).toBe(true);
    expect(lion.printings).toEqual([{ suit: 'club', rank: 1 }]);
  });
});

describe('wiki tabs', () => {
  const summary = (tabs: { key: string; label: string; entries: unknown[] }[]) => tabs.map((t) => [t.key, t.label, t.entries.length]);

  it('splits generals into Wei, Shu, Wu and Qun', () => {
    const tabs = wikiGeneralTabs();
    expect(summary(tabs)).toEqual([['wei', 'Wei', 15], ['shu', 'Shu', 15], ['wu', 'Wu', 15], ['qun', 'Qun', 12]]);
    expect(tabs[3].entries.every((g) => g.kingdom === 'Qun')).toBe(true);
    expect(tabs[0].entries[0].name).toBe('Cao Cao');
  });

  it('gives each basic card its own tab, the fire and lightning Sha right after Sha', () => {
    const tabs = wikiCardTabs('basic');
    expect(summary(tabs)).toEqual([
      ['sha', 'Sha', 1], ['fire-attack', 'Fire Attack', 1], ['lightning-attack', 'Lightning Attack', 1],
      ['shan', 'Shan', 1], ['wine', 'Wine', 1], ['peach', 'Peach', 1],
    ]);
    expect(tabs.map((t) => t.entries[0].id)).toEqual(['sha', 'fire-attack', 'lightning-attack', 'shan', 'wine', 'peach']);
  });

  it('splits equipment into Weapons, Armors and the two kinds of mount', () => {
    const tabs = wikiCardTabs('equipment');
    expect(summary(tabs)).toEqual([
      ['weapons', 'Weapons', 11], ['armors', 'Armors', 4], ['defensive-mount', 'Defensive Mount', 4], ['offensive-mount', 'Offensive Mount', 3],
    ]);
    expect(tabs[2].entries.map((c) => c.id)).toEqual(['di-lu', 'hua-liu', 'shadow-runner', 'storm-runner']);
    expect(tabs[3].entries.map((c) => c.id)).toEqual(['da-yuan', 'red-hare', 'zi-xing']);
  });

  it('splits Tools into Instant and Delayed', () => {
    const tabs = wikiCardTabs('tool');
    expect(summary(tabs)).toEqual([['instant', 'Instant', 12], ['delayed', 'Delayed', 3]]);
    expect(tabs[1].entries.map((c) => c.id)).toEqual(['capture', 'lightning', 'starvation']);
  });

  it('puts unclaimed entries in a trailing tab (Review Focus 4)', () => {
    const base = wikiCards('equipment').find((c) => c.id === 'red-hare')!;
    const card = (patch: Partial<WikiCard>): WikiCard => ({ ...base, ...patch });
    const tabs = equipmentTabs([
      card({ id: 'mystery-horse', name: 'Mystery Horse', mount: null }),
      card({ id: 'jade-seal', name: 'Jade Seal', subtype: 'treasure', mount: null }),
    ]);
    expect(summary(tabs)).toEqual([
      ['weapons', 'Weapons', 0], ['armors', 'Armors', 0], ['defensive-mount', 'Defensive Mount', 0], ['offensive-mount', 'Offensive Mount', 0],
      ['other-mounts', 'Other Mounts', 1], ['treasures', 'Treasures', 1],
    ]);
  });
});
